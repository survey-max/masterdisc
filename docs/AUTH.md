# Adgang til portalen — Supabase Auth + admin-rolle

Portalens jobmatch-del ligger bag login. Adgang kræver to ting, ikke én:

1. **En gyldig portal-session** — portalens egen HMAC-signerede, httpOnly
   cookie (`portal-session`). Supabase Auth bruges KUN i selve login-øjeblikket
   til at verificere email + adgangskode; Supabase-sessionen trækkes tilbage
   med det samme og gemmes aldrig i cookies.
2. **At brugeren har adgang i `public.user_profiles`** — dvs. en profil med
   `auth_user_id` = brugerens auth-UID, uden `disabled`-markering, og ENTEN
   rollen `admin`/`ejer` (samme rollebegreb som coachersuniversed's
   `ADMIN_ROLES`, lib/auth/guard.ts i det andet repo) ELLER en **egen rolle
   med Jobmatch slået til** (siden 2026-08-22): `user_profiles.custom_role_id`
   peger på en række i `public.custom_roles`, hvis
   `permissions.modules.jobmatch` er `true`. Egne roller oprettes og tildeles i
   coachersuniversed under Indstillinger → Brugere → Roller (toggle "Jobmatch").
   Rolle-opslaget er et separat, fejltolerant kald
   (`hasJobmatchRolePermission` i `lib/supabase/auth/admin-access.ts`): er
   migrationen `20260822_custom_roles` ikke kørt i det delte projekt, svarer det
   blot "nej" og admin-adgangen er upåvirket.

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
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | nøglen, login-action'ens tilstandsløse klient verificerer kodeordet med |
| `SUPABASE_SECRET_KEY` | secret-nøglen (bruges også af datalaget). Admin-tjekket slår rollen op i `user_profiles` med den |
| `PORTAL_SESSION_SECRET` | hemmeligheden, portal-sessionscookien HMAC-signeres med. Min. 32 tegn (`openssl rand -base64 48`). Rotation logger alle ud |

`SUPABASE_SECRET_KEY` og `PORTAL_SESSION_SECRET` er **ikke** `NEXT_PUBLIC_` og
må aldrig kunne læses ud af en JS-bundle — både admin-tjek og signering kører
udelukkende server-side.

**Fail closed.** Mangler en af variablerne, eller fejler selve opslaget i
`user_profiles`, afvises hvert eneste login — også med korrekt adgangskode — og
fejlen skrives i serverloggen med `[portal-auth]` foran. En fejl må aldrig kunne
læses som "så lukker vi alle ind".

Hvem der har adgang, styres i coachersuniversed's brugeradministration: giv
brugeren rollen `admin` eller `ejer` i `user_profiles` — eller tildel en egen
rolle med Jobmatch slået til — og adgangen følger med; ingen deploy, intet nyt
build.

> Middlewaren kører i Edge-runtime. Opslaget i `user_profiles` sker derfor med
> `fetch` direkte mod PostgREST (`lib/supabase/auth/admin-access.ts`), ikke via
> supabase-js — middleware-bundlen skal holdes fri for ekstra imports. Next.js
> lægger `process.env`-værdier ind i middleware-bundlen ved **build**, så
> `SUPABASE_SECRET_KEY` og `PORTAL_SESSION_SECRET` skal være sat i Vercel
> (Production, Preview og Development) **før** deploy.

## Sådan hænger det sammen

```
browser ──► middleware.ts ──► guardPortalRequest()      verificér cookie + tjek rolle
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
| `lib/supabase/auth/middleware.ts` | selve tjekket + oprydning af gamle @supabase/ssr-cookies |
| `lib/supabase/auth/portal-session.ts` | sessionscookien: HMAC-signering, verifikation, cookie-attributter |
| `lib/supabase/auth/session.ts` | `getPortalSessionUser` / `requirePortalAccess` / `requirePortalSession` |
| `lib/supabase/auth/admin-access.ts` | adgangstjekket mod `public.user_profiles`: `isPortalAdmin` (rolle `admin`/`ejer`, ikke disabled — fail closed) + `hasJobmatchRolePermission` (egen rolle med Jobmatch-toggle — fejl = nej) samlet i `hasPortalAccess` |
| `lib/supabase/auth/config.ts` | de offentlige Supabase-variabler til login-verifikationen |
| `app/login/` | login-siden og server action'en, der logger ind |
| `app/jobmatch/layout.tsx` | adgangstjek for alle sider under `/jobmatch/**` |
| `app/jobmatch/LogUdKnap.tsx` + `auth-actions.ts` | "Log ud" i topbjælken |

### Hvorfor middleware som primær mekanisme

`/jobmatch/**` er ikke kun sider: der er en route handler (`/jobmatch/filer/<id>`)
og server actions, der POST'er tilbage til de samme URL'er. Middlewaren er det
eneste sted, alle tre slags requests kommer forbi. Et tjek i hver server
component ville lade route handleren og server actions stå åbne.

Den står ikke alene: layoutet, route handleren og begge server action-filer
spørger selv gennem `lib/supabase/auth/session.ts`. En fremtidig rute, der ryger
uden for matcheren, bliver derfor ikke til en åben dør.

Alle tjek sker **server-side**: cookien verificeres mod HMAC-signaturen
(kan ikke forfalskes uden `PORTAL_SESSION_SECRET`), og rollen slås op i
`user_profiles` ved HVERT request. Cookien beviser kun identitet — der ligger
intet privilegium cachet i den, så en fjernet admin-rolle virker med det samme.

### Hvorfor portalens egen cookie og ikke @supabase/ssr

Portalen brugte oprindeligt @supabase/ssr, som gemmer HELE Supabase-sessionen i
cookies — inklusive brugerens metadata. En bruger med et profilfoto gemt som
data-URI i metadataen fik en cookie på 89 KB fordelt på 28 bidder, og Vercel
afviser alle requests med headers over 16 KB (`494 REQUEST_HEADER_TOO_LARGE`)
FØR portalens kode kører — hele domænet var dødt for den bruger, og portalen
kunne ikke engang rette det selv. Portalens egen cookie er nogle få hundrede
bytes med fast indhold (`{v, uid, email, exp}`), er httpOnly (JavaScript kan
ikke læse den) og indeholder intet brugerredigerbart. I produktion hedder den
`__Host-portal-session`: præfikset håndhæves af browseren og betyder, at
cookien kun kan sættes med Secure + Path=/ og uden Domain — et subdomæne eller
en http-forbindelse kan aldrig plante eller overskygge den. Mønsteret er det samme
som coachersuniversed's session (lib/auth/session.ts i det andet repo).
Middlewaren og login/log ud sletter desuden gamle `sb-…`-cookies, når de ser dem.

## Hvad brugeren ser

| Situation | Besked | Log |
|---|---|---|
| Forkert email/adgangskode | "Forkert email eller adgangskode" | `[portal-auth] mislykket login for <email>: invalid_credentials …` |
| Gyldigt login uden adgang | "Du har ikke adgang til portalen" — og der sættes ingen cookie | `[portal-auth] afvist login: UID <uid> … har hverken admin-rolle eller Jobmatch-rettighed (egen rolle) i user_profiles.` |
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
   projekt) → "Du har ikke adgang til portalen", og der er ingen cookie
   (`/jobmatch/` sender stadig til `/login/`).
5. Fjern `SUPABASE_SECRET_KEY` eller `PORTAL_SESSION_SECRET` fra `.env.local` →
   alle logins afvises med den generelle fejl, og serverloggen siger hvorfor.
   Sæt dem tilbage bagefter.

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
