# coachersai-portal (fase 1)

Next.js-omskrivning af coachersai.dk-POC'en (håndskrevet HTML/PHP + JSON-filer),
med masterdisc' statiske DISC-flow indlejret under `/profil/`.

Engelsk i kode og kommentarer, dansk i al UI-tekst.

## Kom i gang

```bash
pnpm install
cp .env.example .env.local   # udfyld Supabase-URL og sb_secret_-nøglen
pnpm seed                    # anonyme eksempeldata ind i portal-schemaet
pnpm dev                     # http://localhost:3000/app-rewrite
pnpm typecheck               # tsc --noEmit
pnpm build
pnpm dry-run                 # hvad en migrering af legacy-php/data/ ville gøre
```

Portaldata ligger i Supabase (schemaet `portal`, bucketen `portal-arkiv`).
Opsætningen — migrations, exposed schemas, bucket — står i
[`docs/SUPABASE.md`](docs/SUPABASE.md). Alle variabler står i `.env.example`;
de vigtigste:

| Variabel | Betydning |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Det delte Supabase-projekt. **Påkrævet.** |
| `SUPABASE_SECRET_KEY` | `sb_secret_…`. **Påkrævet.** Kun server-side, aldrig i klientkode. |
| `PORTAL_API_TOKEN` | Spærring foran `/api/portal/*`, indtil rigtig auth findes. Valgfri lokalt, påkrævet i produktion. |
| `PORTAL_DATA_MODE` | `direct` (standard) eller `api` — se `lib/data/index.ts`. |
| `MOCK_USER_ID` | Hvilken bruger portalen vises som. Default: første ikke-spærrede admin. Se `lib/auth`. |
| `NEXT_PUBLIC_DISC_API_BASE` | DISC-API'et, som konsulentkoder valideres mod. Default `https://www.unicoachers.dk` — samme default og samme rolle som `window.DISC_API_BASE` i DISC-flowet. |

## Ruter

| Rute | Fra POC'en |
|---|---|
| `/` | `public_html/index.html` (forsiden) |
| `/opret` | `public_html/opret/index.html` — eneste sted en kode indtastes; validerer mod `/api/disc/verify-code` og sender kun godkendte koder til `/profil/?kode=…` |
| `/privatliv` | `public_html/privatliv/index.html` |
| `/jobmatch` | `jobmatch/index.php`, den indloggede portal (Oversigt + Jobmatchfiler) |
| `/jobmatch/login` | `jobmatch/index.php`, login — **kun UI** |
| `/jobmatch/admin` | `jobmatch/admin.php`, den indloggede del |
| `/jobmatch/vaerktoej` | `jobmatch/vaerktoej.php`, JobMatch-værktøjet |
| `/jobmatch/filer/<id>` | `jobmatch/arkiv.php?a=hent` |
| `/api/portal/**` | Server-side dataadgang mod Supabase, se `docs/SUPABASE.md` |
| `/profil/**` | `masterdisc/` — statisk kopi, se `docs/PROFIL-INDLEJRING.md` |

## Arkitektur

```
app/                    ruter; én .css-fil pr. rute, udtrukket 1:1 fra POC'en
app/api/portal/         server-side API-routes mod Supabase (secret-nøglen)
lib/data/               ENESTE vej til portaldata (repository-interface)
lib/data/supabase/      Supabase-implementeringen (standard) + kolonne-mapping
lib/data/api/           samme interface over /api/portal/* (PORTAL_DATA_MODE=api)
lib/data/json/          POC'ens JSON-implementering — bevaret, men ikke i brug
lib/supabase/           klienten med sb_secret_-nøglen. Kun server-side
lib/auth/               MOCK — ingen session, intet password. Skive 2
lib/jobmatch/           JobMatch-model, beregning, rapport og arkiv-inputregler
public/profil/          masterdisc, kopieret uændret (tre nødvendige rettelser)
data/example/           anonyme eksempeldata (kilden til `pnpm seed`)
scripts/                seed og dry-run
supabase-migrations-til-hovedrepo/   SQL til hovedrepoet. Køres manuelt
docs/                   kortlægning, indlejring, fase-rapport, Supabase
```

Regler, der er værd at holde:

- **Ingen komponent læser eller skriver data uden om `lib/data`.** Sider bruger
  `repository`, mutationer sker i server actions.
- **Secret-nøglen forlader ikke serveren.** `lib/supabase/server.ts` og
  `app/api/portal/**` er server-side; browseren ser aldrig en Supabase-nøgle.
- **Virksomheds-scoping håndhæves server-side** i både datalag og hver route —
  aldrig ud fra noget klienten har sendt.
- **Ingen tavse fejl.** Mangler eller er en datafil korrupt, kaster datalaget, og
  siden viser fejlen. Aldrig en tom liste eller et 0 i stedet.
- **Ingen hjemmelavet auth.** Ingen bcrypt, ingen cookies, ingen sessioner.

## Dokumenter

- `docs/SUPABASE.md` — skemaet, API-routene, opsætningen og testvejledningen for Supabase-integrationen
- `docs/KORTLAEGNING.md` — hvad der blev porteret, hvad der er legacy, hvad der er dødt
- `docs/PROFIL-INDLEJRING.md` — masterdisc under `/profil/` og kodekoblingen
- `docs/FASE-RAPPORT.md` — hvad der mangler i fase 2 (hosting) og fase 3 (data + auth)
- `docs/TESTVEJLEDNING.md` — klikbar testvejledning
