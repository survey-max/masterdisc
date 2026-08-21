# Adgang til portalen — Supabase Auth + admin-rolle

Portalens jobmatch-del ligger bag login. Adgang kræver to ting, ikke én:

1. **En gyldig Supabase-session** (email + adgangskode mod Supabase Auth).
2. **At brugeren har admin-rolle i `public.user_profiles`** — dvs. en profil med
   `auth_user_id` = brugerens auth-UID, rollen `admin` eller `ejer` og uden
   `disabled`-markering. Det er samme tabel og samme rollebegreb som
   coachersuniversed's `ADMIN_ROLES` (lib/auth/guard.ts i det andet repo).

Punkt 2 er ikke overforsigtighed. Supabase-projektet er **delt** med
coachersuniversed, så `auth.users` rummer mange brugere, der intet har med
portalen at gøre. Uden rolletjekket ville "logget ind hos coachersuniversed"
være det samme som "adgang til jeres jobmatchfiler".

Der oprettes ingen brugere her. Der er intet signup, ingen invitation og ingen
password-reset — brugerne OG deres roller administreres i coachersuniversed.
Portalen læser kun: den slår rollen op i `user_profiles` (med secret-nøglen,
direkte mod PostgREST) og ændrer intet i tabellen.

## Miljøvariabler

| Variabel | Rolle |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | projektets URL (brugtes allerede) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | nøglen auth-klienterne bruger. Nu i brug — den var reserveret til netop dette |
| `SUPABASE_SECRET_KEY` | secret-nøglen (bruges også af datalaget). Admin-tjekket slår rollen op i `user_profiles` med den |

`SUPABASE_SECRET_KEY` er **ikke** `NEXT_PUBLIC_` og må aldrig kunne læses ud af
en JS-bundle — admin-tjekket kører udelukkende server-side.

**Fail closed.** Mangler en af variablerne, eller fejler selve opslaget i
`user_profiles`, afvises hvert eneste login — også med korrekt adgangskode — og
fejlen skrives i serverloggen med `[portal-auth]` foran. En fejl må aldrig kunne
læses som "så lukker vi alle ind".

Hvem der har adgang, styres i coachersuniversed's brugeradministration: giv
brugeren rollen `admin` eller `ejer` i `user_profiles`, og adgangen følger med —
ingen deploy, intet nyt build.

> Middlewaren kører i Edge-runtime. Opslaget i `user_profiles` sker derfor med
> `fetch` direkte mod PostgREST (`lib/supabase/auth/admin-access.ts`), ikke via
> supabase-js — middleware-bundlen skal holdes fri for ekstra imports. Next.js
> lægger `process.env`-værdier ind i middleware-bundlen ved **build**, så
> `SUPABASE_SECRET_KEY` skal være sat i Vercel (Production, Preview og
> Development) **før** deploy.

## Sådan hænger det sammen

```
browser ──► middleware.ts ──► guardPortalRequest()      forny session + tjek adgang
                 │                    │
                 │                    ├─ ingen session  ──► 307 /login/
                 │                    └─ ingen admin-rolle ──► 307 /login/?fejl=ingen-adgang
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
| `lib/supabase/auth/admin-access.ts` | admin-tjekket mod `public.user_profiles` (rolle `admin`/`ejer`, ikke disabled) — fail closed |
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
| Gyldigt login uden admin-rolle | "Du har ikke adgang til portalen" — og sessionen afsluttes med det samme | `[portal-auth] afvist login: UID <uid> … Sessionen afsluttes igen.` |
| Opsætningen mangler eller opslaget fejler | generel dansk fejl | `[portal-auth] login spærret — admin-tjekket er ikke sat op: …` / `[portal-auth] admin-tjekket fejlede for UID …` |
| Uventet fejl | generel dansk fejl | `[portal-auth] uventet fejl under login: …` |
| Request mod `/jobmatch/**` uden adgang | sendes til `/login/` | `[portal-auth] adgang nægtet til <sti>: UID … ` |

## Test lokalt

```bash
pnpm dev
```

1. Åbn `/jobmatch/` uden at være logget ind → sendes til `/login/`.
2. Log ind med forkert kode → "Forkert email eller adgangskode".
3. Log ind med en bruger med admin-rolle → portalen. "Log ud" står i topbjælken.
4. Log ind med en gyldig bruger UDEN admin-rolle (fx en customer fra det delte
   projekt) → "Du har ikke adgang til portalen", og sessionen er væk
   (`/jobmatch/` sender stadig til `/login/`).
5. Fjern `SUPABASE_SECRET_KEY` fra `.env.local` → alle logins afvises med den
   generelle fejl, og serverloggen siger hvorfor. Sæt den tilbage bagefter.

## Hvad der bevidst IKKE er lavet

- Ingen brugeroprettelse, signup, invitation eller password-reset.
- Ingen egne roller eller rolletabeller — `user_profiles` ejes og administreres
  af det andet repo; portalen læser kun rollen.
- Ingen triggers, functions eller RLS-ændringer på `auth.users`, `user_profiles`
  eller i `portal`.
- Ingen ændringer i projektets globale Supabase-settings (email templates, SMTP,
  redirect-URL'er, providers).
- `lib/auth` (mock-brugeren, `MOCK_USER_ID`) er urørt. Den afgør stadig, *hvilken*
  portalbruger siderne renderes for; det her lag afgør kun, *om* der er adgang.
  At koble et Supabase-UID til en portalbruger kræver en beslutning om, hvor
  brugerne skal ligge — og den hører sammen med det andet repo.
- `/api/portal/**` beholder sin `PORTAL_API_TOKEN`-gate uændret.
