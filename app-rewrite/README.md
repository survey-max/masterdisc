# coachersai-portal (fase 1)

Next.js-omskrivning af coachersai.dk-POC'en (håndskrevet HTML/PHP + JSON-filer),
med masterdisc' statiske DISC-flow indlejret under `/profil/`.

Engelsk i kode og kommentarer, dansk i al UI-tekst.

## Kom i gang

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm typecheck    # tsc --noEmit
pnpm build
```

Ingen miljøvariabler er nødvendige. To valgfrie:

| Variabel | Betydning |
|---|---|
| `JOBMATCH_DATA_DIR` | Mappe med portalens JSON-filer. Default `./data/example` (anonyme eksempler). Peg den uden for repoet ved arbejde med rigtige data. |
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
| `/profil/**` | `masterdisc/` — statisk kopi, se `docs/PROFIL-INDLEJRING.md` |

## Arkitektur

```
app/                    ruter; én .css-fil pr. rute, udtrukket 1:1 fra POC'en
lib/data/               ENESTE vej til portaldata (repository-interface)
lib/data/json/          midlertidig JSON-implementering — udskiftes i fase 3
lib/auth/               MOCK — ingen session, intet password. Besluttes i fase 3
lib/jobmatch/           JobMatch-model, beregning og rapportgenerering
public/profil/          masterdisc, kopieret uændret (tre nødvendige rettelser)
data/example/           anonyme eksempeldata
docs/                   kortlægning, indlejring, fase-rapport
```

Regler, der er værd at holde:

- **Ingen komponent læser eller skriver data uden om `lib/data`.** Sider bruger
  `repository`, mutationer sker i server actions.
- **Ingen tavse fejl.** Mangler eller er en datafil korrupt, kaster datalaget, og
  siden viser fejlen. Aldrig en tom liste eller et 0 i stedet.
- **Ingen hjemmelavet auth.** Ingen bcrypt, ingen cookies, ingen sessioner.

## Dokumenter

- `docs/KORTLAEGNING.md` — hvad der blev porteret, hvad der er legacy, hvad der er dødt
- `docs/PROFIL-INDLEJRING.md` — masterdisc under `/profil/` og kodekoblingen
- `docs/FASE-RAPPORT.md` — hvad der mangler i fase 2 (hosting) og fase 3 (data + auth)
- `docs/TESTVEJLEDNING.md` — klikbar testvejledning
