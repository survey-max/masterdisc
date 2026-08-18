# Fase 1 — rapport

## 1. Hvad blev droppet som legacy eller dødt

**Legacy (funktionen bevaret, mekanikken erstattet):**

- `arkiv.php` — hele `?a=liste/gem/hent/slet`. Reglerne er bevaret: org-filtrering,
  admin ser alle, PDF skal starte med `%PDF-`, 25 MB-grænse, `felt()`-rensning af
  input, samme filnavn ved download, samme `art`-håndtering. De ligger nu i
  `lib/data` + `app/jobmatch/actions.ts` + `app/jobmatch/filer/[id]/route.ts`.
- `auth.php`'s fil-database (`a_laes`/`a_skriv`/`a_klargoer`) og opslag/oprettelse
  (`a_findEmail`, `a_org`, `a_orgNavn`, `a_opretOrg`, `a_opretBruger`) →
  repository-interfacet.
- De rigtige JSON-filer i `jobmatch-filer/` → anonyme eksempler i `data/example/`.
  De rigtige er git-ignoreret.

**Dødt (ikke porteret):**

| Element | Bevis |
|---|---|
| `public_html/jobmatch/index.html` (1072 l., "Coachers · Floorday") | Fejlplaceret, urelateret værktøj. `.htaccess` har `DirectoryIndex index.php index.html`, så `/jobmatch/` altid rammer `index.php`. Intet linker til den. |
| `state.priv` i værktøjet | Sættes fra PDF'en, men `compute()`, `buildReport()` og alle tekstgeneratorer bruger kun `state.work`. Påvirker intet output. |
| `strengthList()` og `riskList()` + tekst-tabellerne `OVER`, `UNDER`, `MATCH` (ca. 60 linjer) | Defineret, aldrig kaldt (`grep`: 1 forekomst hver). Rapporten har altid brugt `strengthShort()`/`riskShort()`. |
| Rollen `orgadmin` | `a_erOrgAdmin()` er defineret og kaldes 0 steder. En orgadmin havde præcis en `bruger`s rettigheder. Rollevalget i admin er nu Bruger/Systemadministrator. |
| Sessioner, `password_hash`/`password_verify`, `a_kodeFejl`, `a_saetKode`, "Skift kode" | Auth. Fase 3. |
| Login-spærring (`loginforsog.json`, `a_erSpaerret`/`a_noterFejl`/`a_rydFejl`) | Auth. Filen er i øvrigt tom. |
| CSRF-tokens (`a_token`/`a_tokenOk`/`a_feltToken`) | Hørte til de hjemmelavede sessioner. Server Actions har egen beskyttelse; CSRF-modellen følger auth-beslutningen. |
| Førstegangsopsætningen i `admin.php` + `opsat.flag` | Bootstrap af første admin med password + engangslås på filsystemet. Fase 3. |
| `.htaccess`-filerne | Apache. Headerne hører til hostingkonfigurationen (punkt 3). |
| `masterdisc/test.txt`, `CNAME`, `.claude/`, `vercel.json` | Ikke en del af det udgivne site. |

## 2. Hvad kræver beslutning i fase 3

1. **Auth-modellen.** Den store. Skal portalen bruge Supabase Auth, SSO/Microsoft,
   magic links eller noget helt andet? Hvem opretter brugere, og hvordan
   udleveres adgang første gang? Indtil det er afklaret, findes der ingen login i
   appen — bevidst, så der ikke bygges en midlertidig mekanik, som nogen kommer
   til at stole på. Konsekvenser: `/jobmatch/login` er kun UI, `MOCK_USER_ID`
   afgør hvem portalen vises som, "Skift kode" og førstegangsopsætningen er ikke
   porteret.
2. **Roller og rettigheder.** POC'en havde reelt to niveauer (`bruger` = egen
   virksomhed, `admin` = alle virksomheder). Skal `orgadmin` genopstå med rigtige
   rettigheder (fx administrere egne brugere), skal den designes — den var tom i
   POC'en.
3. **Hvor bor arkivfilerne?** PDF-rapporter og gemte sager ligger i dag som filer
   ved siden af JSON-databasen. Vercel har intet skrivbart filsystem, så de skal
   flyttes til storage (Supabase Storage eller lignende) med signerede URL'er.
   Route handleren `/jobmatch/filer/<id>` er stedet, der skal ændres.
4. **Ejerskab af arkivposter.** POC'en gemmer `bruger` som *navn i klartekst*, ikke
   som id. Skal det være en rigtig relation (`user_id`), kræver det en migrering
   af de eksisterende records.
5. **Sagsformatet.** Gemte sager er værktøjets hele state-objekt som JSON. Skal
   det have et versionsfelt, før det bliver et API-kontraktformat? Nye sager
   gemmes uden det døde `priv`-felt; gamle sager med `priv` kan stadig indlæses.
6. **Sletning og opbevaring.** Privatlivspolitikken (som stadig er et udkast med
   gule huller) lover sletning efter en periode. Der findes intet, der håndhæver
   det — hverken i POC'en eller nu. Skal der en opbevaringsregel ind i datalaget?
7. **Hvor håndhæves konsulentkoden?** Koden indtastes og valideres nu på `/opret`
   og valideres igen tavst i `/profil/` (se `docs/PROFIL-INDLEJRING.md`). Begge
   tjek er klientside mod det eksterne API — som i POC'en og i masterdisc. Det er
   nok til at styre flowet, men ikke en server-håndhævet adgangskontrol: en
   respondent kan i princippet stadig åbne DISC-flowets HTML uden en kode og
   kalde submit direkte (det kunne man også før — API'et er sidste led, der
   afviser en ugyldig `submitCode`). Skal adgangen håndhæves før flowet
   udleveres, kræver det en beslutning i fase 3, fx en kortlivet session efter
   godkendt kode.
8. **Samtidighed.** PHP brugte `LOCK_EX`; JSON-implementeringen har ingen
   låsning. Det er uden betydning nu, men API'et i fase 3 skal have rigtige
   transaktioner — to samtidige uploads må ikke kunne overskrive hinandens
   indeks.

## 3. Hvad mangler for Vercel-hosting i fase 2

1. **Skrivning til filsystemet.** Alt, der skriver (upload af rapport, gem sag i
   arkivet, opret virksomhed/bruger, spær bruger), går gennem
   `lib/data/json/json-repository.ts` og skriver til disk. Det virker lokalt og
   **fejler på Vercel** (read-only FS) — med en tydelig fejlbesked, ikke tavst.
   Læsning virker, hvis eksempeldataene deployes med. Enten venter deployet på
   fase 3's API, eller skrivning slås fra i et deployet miljø. Beslutning.
2. **Sikkerhedsheadere.** POC'ens `.htaccess` satte `X-Robots-Tag: noindex`,
   `X-Content-Type-Options: nosniff` og `X-Frame-Options: SAMEORIGIN` for hele
   sitet. Kun `noindex` på jobmatch-siderne er porteret (via `metadata.robots`).
   Resten skal ind som `headers()` i `next.config.ts`.
3. **~~Beskyttelse af `/profil/admin/`.~~ Løst i commit 3196bbb** — panelet er
   slettet i stedet for beskyttet. Masterdisc' adminværktøj (337 KB HTML) blev
   serveret offentligt på `/profil/admin/`, men det bruges ikke af nogen og
   koblede til Firebase (disclinedb), som er under udfasning, så det skal ikke
   med i den nye app. `public/profil/admin/` og rewriten af `/profil/admin` i
   `next.config.ts` er fjernet; `/profil/admin/` giver nu 404. Værktøjets otte
   hardkodede `https://disclinedb.web.app/survey/<slug>`-links og hele
   Firebase-konfigurationen forsvandt med filen. Tilbage står ét link til
   `disclinedb.web.app` i `/profil/survey/`s "Powered by DISCline"-footer — ikke
   en admin-reference, og bevidst ikke rørt.
4. **CDN-afhængigheder.** pdf.js 3.11.174 (værktøjet) og Font Awesome 6.5.1
   (`/profil/survey/`) hentes fra cdnjs, og Inter fra Google Fonts. Uændret fra
   POC'en, men bør pakkes lokalt, hvis der skal styr på tredjepartskald og CSP.
5. **Domæne og roder.** Slutmålet er masterdisc.dk. Skal DISC-flowet ligge på
   `/` frem for `/profil/`, er det én rewrite — men så skal portalforsiden flyttes.
6. **`trailingSlash: true`** er nødvendig for `/profil/` (relative stier i den
   kopierede masterdisc). Behold den, eller flyt DISC-flowets stier — ikke begge.
7. **Miljøvariabler.** `JOBMATCH_DATA_DIR` og `MOCK_USER_ID` er de eneste i dag.
   Der er ingen hemmeligheder i repoet, og `.env*` er git-ignoreret.
8. **Ingen tests.** Der er ingen automatiseret testsuite. Til gengæld er
   værktøjets rapportgenerering verificeret tegn-for-tegn mod POC'en (tre
   scenarier), og datalagets læse/skrive/adgangs-stier er kørt igennem manuelt.
   En rigtig testsuite bør med i fase 2/3.
