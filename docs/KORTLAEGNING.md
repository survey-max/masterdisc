# Kortlægning af POC-filer (fase 1)

Gennemgang af hele FTP-kopien (`public_html/`, `jobmatch-filer/`) og `masterdisc/`.
Kategorier: **(a)** porteres, **(b)** legacy persistens der erstattes af datalaget,
**(c)** død kode der ikke porteres, **(d)** assets.

## (a) Sider og flows der porteres

| POC-fil | Ny rute | Begrundelse |
|---|---|---|
| `public_html/index.html` (842 l.) | `/` | Marketing-forsiden. Ren HTML/CSS + 3 små JS-blokke (dropdown, jobprofil-karrusel, "køb"-knap der viser bestillingslinje). 1:1-port. |
| `public_html/opret/index.html` | `/opret` | Kodegaten — og nu **det eneste sted, en kode indtastes**. Siden validerer selv koden mod `/api/disc/verify-code` og sender kun godkendte koder videre til `/profil/?kode=…`. POC'ens egen TODO ("kodevalidering er ikke sat op") er dermed lukket. |
| `public_html/privatliv/index.html` | `/privatliv` | Privatlivspolitik (udkast med gule `<mark>`-huller). Ren tekstside — porteres uændret, inkl. "skal gennemgås"-boksen. |
| `public_html/jobmatch/index.php` (linje 33–121: login-formularen) | `/jobmatch/login` | Kun udseendet porteres. Ingen session, ingen `password_verify`, ingen cookies (trin 5). |
| `public_html/jobmatch/index.php` (linje 123–587: portalen) | `/jobmatch` | Oversigt + arkivfane: upload af PDF-rapport, søgning, sortering, sletning, tælleren i fanen. Al dataadgang gennem datalaget i stedet for `arkiv.php`. |
| `public_html/jobmatch/admin.php` (linje 248–351: den indloggede del) | `/jobmatch/admin` | Opret virksomhed, opret bruger, brugeroversigt, spær/åbn bruger. |
| `public_html/jobmatch/vaerktoej.php` (linje 489–1984) | `/jobmatch/vaerktoej` | Selve JobMatch-værktøjet: 5 trin, PDF-indlæsning (pdf.js), kravprofil, vurdering med vægte, beregning og A4-pagineret rapport. PHP-delen er kun `require auth.php` + `a_kraevLogin()` + ét CSRF-token i arkiv-POST'en — resten er statisk HTML/CSS/JS. |
| `masterdisc/*` (hele det statiske site) | `public/profil/**` | Kopieres uændret og serveres på `/profil/` (trin 6). Kun tre nødvendige rettelser i kopien, se `docs/PROFIL-INDLEJRING.md`. |

## (b) Legacy: PHP der kun er JSON-læsning/-skrivning og persistens

Erstattes af `lib/data/` (repository-interface). Selve reglerne (hvem ser hvad, hvilke
felter en post har, hvad der valideres ved upload) er bevaret i datalaget/handlingerne.

| POC-fil | Hvad det gør | Erstattet af |
|---|---|---|
| `public_html/jobmatch/arkiv.php` | `a=liste/gem/hent/slet` mod `data.json` + `<id>.pdf`/`<id>.json` på disk. Inkl. org-filtrering (`minPost`), PDF-sniffing (`%PDF-`), 25 MB-grænse, filnavnsdannelse ved download. | `lib/data/repository.ts` + `app/jobmatch/actions.ts` + `app/jobmatch/filer/[id]/route.ts` |
| `auth.php` linje 20–43 (`a_laes`, `a_skriv`, `a_klargoer`) | JSON-fil-database, `LOCK_EX`, selvskrevet `.htaccess`-vagt i datamappen | `lib/data/json/json-repository.ts` (midlertidig implementering) |
| `auth.php` linje 156–213 (`a_findEmail`, `a_org`, `a_orgNavn`, `a_opretOrg`, `a_opretBruger`, `a_saetKode`) | Opslag og oprettelse i `brugere.json` / `organisationer.json` | Repository-metoderne. `a_saetKode` (password-hash) porteres **ikke** — se (c). |
| `jobmatch-filer/*.json` | Selve databasen med rigtige records | Anonyme eksempelfiler i `data/example/` (samme felter og typer). De rigtige filer er git-ignoreret. |

## (c) Død kode / bevidst udeladt

| POC-element | Hvorfor det ikke porteres |
|---|---|
| `public_html/jobmatch/index.html` (1072 l., "Coachers · Floorday — forberedelse") | Et helt andet værktøj, der ligger fejlplaceret i `jobmatch/`-mappen. Bliver aldrig serveret: `.htaccess` sætter `DirectoryIndex index.php index.html`, så `/jobmatch/` rammer altid `index.php`. Ingen af portalens sider linker til den. |
| `state.priv` i `vaerktoej.php` (l. 779, 1233–1244, 1272) | `parseDisc()` læser graf 2 (privatprofilen) ud af PDF'en og gemmer den i `state.priv` — men `compute()`, `buildReport()` og alle tekstgeneratorer bruger udelukkende `state.work`. Feltet påvirker intet output. Beholdes derfor ikke i den nye state (kun nævnt i sagens JSON-format for bagudkompatibilitet ved indlæsning af gamle sager). |
| Rollen `orgadmin` ("Virksomhedsadmin") | Kan vælges i `admin.php` og vises som badge, og `a_erOrgAdmin()` findes i `auth.php` — men funktionen kaldes ingen steder i hele kodebasen (`grep`: 1 definition, 0 kald). En orgadmin har præcis samme rettigheder som `bruger`. Rollevalget i den nye admin-side har derfor kun **Bruger** og **Systemadministrator**. |
| `a_start`, `a_login`, `a_logud`, `a_bruger`, `a_kraevLogin`, `$_SESSION`, `mdsess`-cookie | Session-håndtering. Auth-modellen besluttes i fase 3 (trin 5) → erstattet af en tydeligt markeret mock bag samme interface. |
| `password_hash`/`password_verify`, `a_kodeFejl`, `a_saetKode`, "Skift kode"-formularen | Credential-håndtering. Ingen bcrypt/hashing i fase 1. Feltet "Adgangskode" er derfor væk fra opret-bruger-formularen, og "Skift"-knappen i brugertabellen er væk. |
| `a_erSpaerret`, `a_noterFejl`, `a_rydFejl`, `loginforsog.json`, `A_MAKSFEJL`, `A_SPAERTID` | Rate limiting på login — hører til auth-modellen (fase 3). `loginforsog.json` er i øvrigt tom. |
| `a_token`, `a_tokenOk`, `a_feltToken` (CSRF) | Hjemmelavet CSRF oven på egne sessioner. Next.js Server Actions har indbygget beskyttelse; CSRF-modellen følger auth-beslutningen i fase 3. |
| `opsat.flag` + førstegangsopsætningen i `admin.php` (l. 11–33, 46–71, 222–246) | Bootstrap af den første administrator med password + engangslås på filsystemet. Rent auth/persistens-bootstrap → fase 3. Admin-siden porteres kun i sin indloggede variant. |
| `public_html/.htaccess` og `jobmatch-filer/.htaccess` | Apache-specifikt. Headerne (`X-Frame-Options`, `nosniff`, `noindex`) hører til hosting-konfigurationen i fase 2 (Vercel: `headers()` i `next.config`) — se rapporten. |
| `masterdisc/test.txt` (tom), `masterdisc/CNAME`, `masterdisc/.claude/` | Ikke en del af det udgivne site (står allerede i `.vercelignore`). Kopieres ikke til `public/profil/`. |
| `masterdisc/config.json` | Ligger i repoet, men ingen af de tre HTML-filer læser den (`grep config.json` → 0 hits). Likert-vægtene deri hører til en ældre spørgsmålsmodel end den nuværende forced-choice V2.2. Kopieres med for ikke at ændre kopien, men bruges ikke. |
| `masterdisc/admin/index.html` (337 KB) | Masterdisc' eget admin-værktøj. Kopieres som en del af det statiske site (uændret), men er ikke en del af portalens flow og porteres ikke til React. |

## (d) Assets

| Fil | Håndtering |
|---|---|
| `masterdisc/assets/masterDisc_logo.png` | Kopieres til `public/profil/assets/`. |
| `masterdisc/disc_udsagn_{da,en,sv,de,es,pl}_3.0.csv` | Spørgsmålene. Kopieres uændret — hentes relativt af `index.html`. |
| `masterdisc/locales/{da,en,sv,de,es,pl}.json` | UI-oversættelser. Kopieres uændret. |
| Google Fonts (Inter) | Alle POC-sider henter Inter via `<link>` til fonts.googleapis.com. Bevares som `<link>` i layoutet, så typografien er identisk. |
| pdf.js 3.11.174 fra cdnjs | `vaerktoej.php` indlæser pdf.js + worker fra CDN. Bevares uændret (via `next/script`), så PDF-indlæsningen opfører sig som i dag. Flagget som fase-2-emne (bundling af `pdfjs-dist` lokalt). |
| MasterDISC-farvepalet og designmanual-CSS | Hver side har sit eget `<style>`-blok. CSS'en er udtrukket 1:1 til én `.css`-fil pr. rute (Next koder CSS pr. rute, så de identiske klassenavne på tværs af sider ikke kolliderer). |
