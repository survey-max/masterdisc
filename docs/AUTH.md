# Adgang til portalen — Supabase Auth + allowlist

Portalens jobmatch-del ligger bag login. Adgang kræver to ting, ikke én:

1. **En gyldig Supabase-session** (email + adgangskode mod Supabase Auth).
2. **At brugerens auth-UID står i `PORTAL_ALLOWED_USER_IDS`.**

Punkt 2 er ikke overforsigtighed. Supabase-projektet er **delt** med
coachersuniversed, så `auth.users` rummer mange brugere, der intet har med
portalen at gøre. Uden allowlisten ville "logget ind hos coachersuniversed"
være det samme som "adgang til jeres jobmatchfiler".

Der oprettes ingen brugere her. Der er intet signup, ingen invitation og ingen
password-reset — brugerne findes allerede i det delte projekt. Der er heller
ingen roller, ingen `user_profiles` og ingen ændringer i databasen: allowlisten
er en miljøvariabel og intet andet.

## Miljøvariabler

| Variabel | Rolle |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | projektets URL (brugtes allerede) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | nøglen auth-klienterne bruger. Nu i brug — den var reserveret til netop dette |
| `PORTAL_ALLOWED_USER_IDS` | kommasepareret liste af Supabase-auth-UID'er (`auth.users.id`), der må se portalen |

`PORTAL_ALLOWED_USER_IDS` er **ikke** `NEXT_PUBLIC_`: hvem der har adgang, skal
ikke kunne læses ud af en JS-bundle.

**Fail closed.** Er variablen tom eller ikke sat, afvises hvert eneste login —
også med korrekt adgangskode — og fejlen skrives i serverloggen med `[portal-auth]`
foran. En manglende allowlist må aldrig kunne læses som "så lukker vi alle ind".

UID'et findes i Supabase Studio under Authentication → Users.

> Middlewaren kører i Edge-runtime, og Next.js lægger `process.env`-værdier ind i
> middleware-bundlen ved **build**. Sæt derfor `PORTAL_ALLOWED_USER_IDS` i Vercel
> (Production, Preview og Development) **før** deploy — en ændring kræver et nyt
> build for at slå igennem.

## Sådan hænger det sammen

```
browser ──► middleware.ts ──► guardPortalRequest()      forny session + tjek adgang
                 │                    │
                 │                    ├─ ingen session  ──► 307 /login/
                 │                    └─ UID uden for listen ──► 307 /login/?fejl=ingen-adgang
                 │
                 └─► /jobmatch/**  layout.tsx ──► requirePortalAccess()   samme tjek igen
                     /jobmatch/filer/<id>      ──► getPortalSessionUser()
                     server actions            ──► requirePortalSession()
```

| Fil | Rolle |
|---|---|
| `middleware.ts` | porten foran `/jobmatch/**` (matcher: `/jobmatch`, `/jobmatch/:path*`) |
| `lib/supabase/auth/middleware.ts` | selve tjekket + fornyelsen af sessionens cookies |
| `lib/supabase/auth/session.ts` | `getPortalSessionUser` / `requirePortalAccess` / `requirePortalSession` |
| `lib/supabase/auth/allowlist.ts` | `PORTAL_ALLOWED_USER_IDS` — fail closed |
| `lib/supabase/auth/server.ts` | klient til server components (må ikke skrive cookies) |
| `lib/supabase/auth/route.ts` | klient til route handlers og server actions (skriver cookies) |
| `lib/supabase/auth/browser.ts` | browser-klienten |
| `app/login/` | login-siden og server action'en, der logger ind |
| `app/jobmatch/layout.tsx` | adgangstjek for alle sider under `/jobmatch/**` |
| `app/jobmatch/LogUdKnap.tsx` + `auth-actions.ts` | "Log ud" i topbjælken |

### Hvorfor middleware som primær mekanisme

`/jobmatch/**` er ikke kun sider: der er en route handler (`/jobmatch/filer/<id>`)
og server actions, der POST'er tilbage til de samme URL'er. Middlewaren er det
eneste sted, alle tre slags requests kommer forbi — og @supabase/ssr fornyer
sessionens cookies netop dér. Et tjek i hver server component ville lade
route handleren og server actions stå åbne.

Den står ikke alene: layoutet, route handleren og begge server action-filer
spørger selv gennem `lib/supabase/auth/session.ts`. En fremtidig rute, der ryger
uden for matcheren, bliver derfor ikke til en åben dør.

Alle tjek sker **server-side** og verificeres med `getUser()`, som spørger
Supabase' auth-server. Aldrig `getSession()`, der blot læser cookien og derfor
kan forfalskes.

## Hvad brugeren ser

| Situation | Besked | Log |
|---|---|---|
| Forkert email/adgangskode | "Forkert email eller adgangskode" | `[portal-auth] mislykket login for <email>: invalid_credentials …` |
| Gyldigt login, UID ikke på listen | "Du har ikke adgang til portalen" — og sessionen afsluttes med det samme | `[portal-auth] afvist login: UID <uid> … Sessionen afsluttes igen.` |
| Allowlisten mangler | generel dansk fejl | `[portal-auth] login spærret — allowlisten er ikke sat op: …` |
| Uventet fejl | generel dansk fejl | `[portal-auth] uventet fejl under login: …` |
| Request mod `/jobmatch/**` uden adgang | sendes til `/login/` | `[portal-auth] adgang nægtet til <sti>: UID … ` |

## Test lokalt

```bash
pnpm dev
```

1. Åbn `/jobmatch/` uden at være logget ind → sendes til `/login/`.
2. Log ind med forkert kode → "Forkert email eller adgangskode".
3. Log ind med en bruger på listen → portalen. "Log ud" står i topbjælken.
4. Fjern UID'et fra `PORTAL_ALLOWED_USER_IDS` i `.env.local`, og log ind igen →
   "Du har ikke adgang til portalen", og sessionen er væk (`/jobmatch/` sender
   stadig til `/login/`). Sæt UID'et tilbage bagefter.
5. Tøm `PORTAL_ALLOWED_USER_IDS` helt → alle logins afvises med den generelle
   fejl, og serverloggen siger hvorfor.

## Hvad der bevidst IKKE er lavet

- Ingen brugeroprettelse, signup, invitation eller password-reset.
- Ingen roller, rolletabeller eller `user_profiles` — de hører til det andet repo.
- Ingen triggers, functions eller RLS-ændringer på `auth.users` eller i `portal`.
- Ingen ændringer i projektets globale Supabase-settings (email templates, SMTP,
  redirect-URL'er, providers).
- `lib/auth` (mock-brugeren, `MOCK_USER_ID`) er urørt. Den afgør stadig, *hvilken*
  portalbruger siderne renderes for; det her lag afgør kun, *om* der er adgang.
  At koble et Supabase-UID til en portalbruger kræver en beslutning om, hvor
  brugerne skal ligge — og den hører sammen med det andet repo.
- `/api/portal/**` beholder sin `PORTAL_API_TOKEN`-gate uændret.
