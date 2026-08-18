# Supabase-integration — skive 1 (skema, API-routes, datalag)

Portalens data ligger nu i Supabase i stedet for JSON-filer på disken. Det er
det, der gjorde skrivninger umulige på Vercel (read-only filsystem).

Auth er stadig mock. Supabase Auth, RLS-policies og rigtige brugere er skive 2.

## Det korte overblik

```
app/jobmatch/**            uændret UI + server actions
        │
lib/data (interface)       uændret udadtil
        │
        ├── PORTAL_DATA_MODE=direct (standard) ──► lib/data/supabase ──┐
        │                                                             │
        └── PORTAL_DATA_MODE=api ──► app/api/portal/** ──► lib/data/supabase
                                                                      │
                                            Supabase: schema `portal` ┘
                                                      bucket `portal-arkiv`
```

- **Alt portaldata ligger i schemaet `portal`.** Intet i `public`, intet i CRM'ets
  eller besvarelsernes tabeller.
- **Alle filer ligger i bucketen `portal-arkiv`.** Ingen eksisterende bucket røres.
- **Secret-nøglen (`sb_secret_…`) bruges kun server-side.** Den er aldrig i
  klientkode og aldrig i repoet.
- **Ingen tavse fejl.** Et fejlet Supabase-kald bliver en `DataError` /
  `DataMissingError` / `DataAccessError` med Supabase' egen tekst i, og den
  vises i UI'et. Der returneres aldrig en tom liste eller et `0`, fordi noget
  gik galt.

## Filer der kom til

| Sti | Rolle |
|---|---|
| `supabase-migrations-til-hovedrepo/` | tre SQL-migrations + README. **Køres manuelt af jer**, hører hjemme i hovedrepoets `supabase/migrations/` |
| `lib/supabase/server.ts` | klienten med secret-nøglen (`db.schema = 'portal'`) |
| `lib/data/supabase/mapping.ts` | dansk TS ⇄ engelske kolonner, plus streng validering af hver række |
| `lib/data/supabase/supabase-repository.ts` | datalaget mod Supabase (standard) |
| `lib/data/api/api-repository.ts` | datalaget over app'ens egne routes (`PORTAL_DATA_MODE=api`) |
| `app/api/portal/**` | server-side API-routes |
| `lib/jobmatch/archive-input.ts` | POC'ens input-regler, delt af server actions og routes |
| `scripts/poc-data.ts` | læser og mapper POC'ens JSON-struktur — delt af seed og dry-run |
| `scripts/seed-portal.ts` | `pnpm seed` (anonyme eksempeldata) |
| `scripts/legacy-dry-run.ts` | `pnpm dry-run` (rigtige data, rapport uden skrivning) |
| `.env.example` | alle variabler, ingen værdier |

`lib/data/json/json-repository.ts` er bevaret som fil, men er ikke længere
koblet op nogen steder.

## Miljøvariabler

Kopiér `.env.example` til `.env.local`. `.env*` er git-ignoreret.

| Variabel | Betydning |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | projektets URL |
| `SUPABASE_SECRET_KEY` | `sb_secret_…`. Kun server-side, går uden om RLS |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | **ubrugt i denne skive** — al adgang er server-side. Med til skive 2 |
| `PORTAL_API_TOKEN` | spærring foran `/api/portal/*`. Valgfri lokalt, **påkrævet i produktion** (ellers svarer routene 503) |
| `PORTAL_DATA_MODE` | `direct` (standard) eller `api` |
| `PORTAL_API_BASE_URL` | kun ved `api`-mode; ellers gættes `http://127.0.0.1:3000/app-rewrite` |
| `MOCK_USER_ID` | hvilken bruger portalen vises som, indtil der findes auth |

`@supabase/supabase-js` er **2.112.3**. Den genkender de nye nøgleformater
eksplicit (`isNewApiKey` matcher `sb_publishable_` og `sb_secret_`), så
`sb_secret_`-nøglen virker uden ekstra opsætning. Ingen opgradering var
nødvendig — pakken var ikke installeret før.

## Skemaet

Engelske kolonnenavne (repo-reglen: engelsk i kode, dansk i UI). Oversættelsen
til datalagets danske nøgler sker ét sted: `lib/data/supabase/mapping.ts`.

### `portal.organisations`
`id` (uuid, pk) · `legacy_id` (POC's 16 hex, unique) · `name` ·
`default_retention_days` (**forberedt** opbevaringsregel, ikke håndhævet) ·
`created_at` · `updated_at`

### `portal.users`
`id` · `legacy_id` · `organisation_id` → organisations · `name` · `email`
(unique på `lower(email)`) · `role` (`admin` | `bruger`) · `blocked` ·
`last_seen_at` · `created_at` · `updated_at`

**Ingen adgangskodekolonne.** POC'ens bcrypt-`hash` migreres aldrig hertil.
Skive 2 tilføjer `auth_user_id` → `auth.users`.

### `portal.archive_entries`
`id` · `legacy_id` · `organisation_id` (**virksomheds-scopingen hænger på
denne**) · `created_by_user_id` → users (**ejerskab som relation**) ·
`created_by_name` (visnings-snapshot, aldrig adgangskontrol) · `kind`
(`rapport` | `sag`) · `candidate_name` · `job_title` · `case_date` · `note` ·
`original_filename` · `byte_size` (≤ 25 MB) · `content_type` · `storage_path`
(unique) · `checksum_sha256` · `retention_until` (**forberedt**) ·
`created_at` · `updated_at`

Indeks `(organisation_id, case_date desc, created_at desc)` er præcis
listevisningens sortering.

**Én afvigelse fra det godkendte forslag:** kolonnen hedder `job_title`, ikke
`position`, fordi `position` er et SQL-nøgleord. Mapningen til
`ArchiveEntry.stilling` er den samme.

### Mapping-tabel

| TS (`lib/data/types.ts`) | Kolonne | Konvertering |
|---|---|---|
| `oprettet`, `tilfojet` | `created_at` | `timestamptz` → unix sekunder |
| `sidstSet` | `last_seen_at` | `null` → `0` |
| `spaerret` | `blocked` | — |
| `org` | `organisation_id` | — |
| `bruger` | `created_by_name` | visning; ejerskab er `created_by_user_id` |
| `art` | `kind` | — |
| `navn` / `stilling` / `dato` | `candidate_name` / `job_title` / `case_date` | `date` → `'YYYY-MM-DD'` |
| `filnavn` / `storrelse` | `original_filename` / `byte_size` | — |
| `orgNavn` | join på organisations | fallback `'Ukendt virksomhed'` bevaret |

### Storage

Bucket `portal-arkiv`, privat. Sti:

```
org/<organisation_id>/<archive_entry_id>.<pdf|json>
```

Virksomheden ligger i stien, så en fremtidig storage-policy kan matche på
mappenavnet. Filnavnet er entry-id'et — ingen kandidatnavne i stier. Det
oprindelige filnavn lever kun i databasen, og downloadnavnet bygges som i POC'en
af `/jobmatch/filer/<id>`.

Gemte sager ligger som storage-objekter, ikke som `jsonb`: så er
`readArchiveFile` symmetrisk for begge arter, 25 MB-blobs holdes ude af
Postgres, og sagsformatet er ikke bundet til en kolonne (fase-rapportens
beslutning 5). `jsonb` er en mulighed senere, hvis sager skal kunne søges i.

## Rækkefølge: ingen halve poster

**Oprettelse** (`createArchiveEntry`):

1. `id` genereres i appen → stien er kendt, før noget skrives.
2. filen uploades med `upsert: false` (kan ikke overskrive en anden fil).
3. rækken indsættes med samme `id`.
4. fejler 3, fjernes filen igen. Fejler oprydningen også, siges det højt **med
   stien i fejlbeskeden**.

En forældreløs fil er usynlig for brugeren og bliver ryddet op i trin 4. En
række uden fil ville derimod være en *synlig* post med kandidatnavn og et dødt
download. Der findes ingen transaktion på tværs af Postgres og Storage — et
oprydningsjob for forældreløse objekter er en senere opgave.

**Sletning** (`deleteArchiveEntry`): filen først, derefter rækken. Filen er de
persondata, privatlivspolitikken lover at slette; en efterladt række er
metadata, som appen i forvejen råber højt om ("Filen bag arkivposten findes ikke
længere"), og som endnu et forsøg fjerner.

**Samtidighed:** primærnøglen og `unique(storage_path)` erstatter POC'ens
`LOCK_EX`. To samtidige uploads kan ikke længere overskrive hinandens indeks
(fase-rapportens beslutning 8).

## API-routes

Alle ligger under `/app-rewrite/api/portal/` (basePath). Alle svarer
`{ fejl, kode }` på fejl, så modparten kan genskabe præcis samme fejlklasse.

| Metode | Rute | Datalags-operation | Gate |
|---|---|---|---|
| GET | `organisations/` | `listOrganisations` | token |
| POST | `organisations/` | `createOrganisation` | token + admin |
| GET | `organisations/<id>/` | `getOrganisation` | token |
| GET | `users/` | `listUsers` | token |
| GET | `users/?email=` | `findUserByEmail` | token |
| POST | `users/` | `createUser` | token + admin |
| GET | `users/<id>/` | `getUser` | token |
| PATCH | `users/<id>/blocked/` | `setUserBlocked` | token + admin |
| GET | `archive/` | `listArchiveEntries` | token + org-scoping |
| POST | `archive/` | `createArchiveEntry` (multipart) | token + org-scoping |
| GET | `archive/<id>/` | `getArchiveEntry` | token + org-scoping |
| DELETE | `archive/<id>/` | `deleteArchiveEntry` | token + org-scoping |
| GET | `archive/<id>/file/` | `readArchiveFile` | token + org-scoping |

Tre regler holder routene ærlige:

1. **Hvem kalderen er, slås op server-side** via `lib/auth` (`MOCK_USER_ID`) —
   aldrig fra en header eller et felt i requesten. Sender klienten
   `x-portal-viewer-org`/`-rolle`, bruges de kun som kryds-tjek: uenighed
   afviser kaldet, den kan aldrig give bredere adgang.
2. **`POST archive/` skriver altid til kalderens egen virksomhed** med hende som
   ejer. Et `org`-id fra klienten ignoreres.
3. **`GET users/` kræver bevidst ikke en opslået bruger** — det er netop det
   opslag, dev-brugerkonteksten selv bygger på. Token-gaten dækker den.

`PORTAL_API_TOKEN` er spærringen, indtil skive 2 bærer identiteten: app'en er
offentligt tilgængelig bag `masterdisc.dk/app-rewrite`, og der er ingen auth
endnu. Mangler variablen i produktion, svarer routene **503** i stedet for at
stå åbne.

Routene bruger altid den direkte Supabase-implementering — aldrig `repository`
fra `lib/data`. Ellers ville en route i `PORTAL_DATA_MODE=api` kalde sig selv i
ring.

## RLS og rettigheder

I det delte projekt er RLS **obligatorisk inden rigtige data**. Derfor er
tabellerne oprettet med:

- rettigheder **kun** til `service_role`; `anon` og `authenticated` har hverken
  `USAGE` på schemaet eller rettigheder på tabellerne
- **RLS slået til, uden policies.** `service_role` går uden om RLS, så appen
  virker; alt andet er lukket land — også hvis nogen senere ved et uheld giver
  rettigheder til en browser-rolle

Skive 2's policies (skitseret i migration 3): org-medlemskab via
`portal.users.auth_user_id = auth.uid()`, `role = 'admin'` for tværgående
adgang, og storage-policies på `(storage.foldername(name))[2]`.

## Bevidst udskudt

Supabase Auth + `auth_user_id` · RLS-policies · storage-policies ·
`orgadmin`-rollen · versionsfelt på sagsformatet · håndhævelse af
`retention_until` (fx pg_cron) · slette-audit-log · soft delete ·
`checksum_sha256` for legacy-poster · kobling til hovedplatformens `companies`
(kun en fremtidsnote i migrationen — ingen FK på tværs af schemas) ·
oprydningsjob for forældreløse storage-objekter · automatiseret testsuite.

---

# Sådan tester vi

## 0. Engangsopsætning i Supabase (jer, ikke Claude)

1. **Kør migrationerne** i SQL-editoren i denne rækkefølge:
   1. `20260818120000_portal_schema_init.sql`
   2. `20260818120100_portal_tables.sql`
   3. `20260818120200_portal_enable_rls.sql`

   Alle tre er idempotente. Se `supabase-migrations-til-hovedrepo/README.md` om
   filnavne-konventionen, der skal verificeres mod hovedrepoet.
2. **Settings → API → Exposed schemas:** tilføj `portal`. Uden det svarer alle
   kald "The schema must be one of the following" (appen oversætter det til en
   besked, der siger præcis det).
3. **Storage → New bucket:** `portal-arkiv`, **privat**, file size limit
   `26214400`, allowed MIME `application/pdf` og `application/json`.
4. `cp .env.example .env.local` og udfyld URL + `sb_secret_`-nøglen.

## 1. Seed

```bash
pnpm seed
```

Forventet: 2 virksomheder, 3 brugere (Anna Eksempel = admin), 2 arkivposter.
Scriptet siger selv, at **arkivpost nr. 2 med vilje ikke får nogen fil** — den
tester "filen findes ikke længere"-stien. Kør den gerne to gange: den er
idempotent, tallene ændrer sig ikke.

Verificér i dashboardet: **Table editor → schema `portal`** (tre tabeller) og
**Storage → portal-arkiv** (én fil under `org/<uuid>/`).

## 2. Portalen

```bash
pnpm dev
```

1. Åbn `http://localhost:3000/app-rewrite/jobmatch/` — listen kommer nu fra
   Supabase. Du er Anna Eksempel (admin), så begge virksomheders poster vises.
2. **Opret sag med PDF-upload:** vælg en PDF under "Tilføj rapport", udfyld navn,
   gem. Posten dukker op øverst. Verificér i dashboardet, at der er kommet én
   række i `portal.archive_entries` og ét objekt i `portal-arkiv` under
   `org/<Anna's org-uuid>/`.
3. **Download:** klik posten. Filen hentes gennem en signeret URL server-side og
   udleveres med POC'ens filnavn (`jobmatch-<kandidat>-<dato>.pdf`).
4. **Prøv en ikke-PDF:** upload en `.txt` omdøbt til `.pdf` → "Filen er ikke en
   PDF." Grænsen på 25 MB giver "Filen er større end 25 MB."
5. **Den fil-løse post:** klik arkivposten for Jens Opdigtet → "Filen bag
   arkivposten … findes ikke længere." (Ikke et tomt download.)
6. **Slet:** slet posten du selv oprettede. Verificér i dashboardet, at både
   rækken og objektet er væk.
7. **Anden virksomheds sag afvises:** sæt `MOCK_USER_ID` til Bo Testesen (rollen
   `bruger`, virksomhed 1) i `.env.local`, genstart `pnpm dev`, og åbn
   `/app-rewrite/jobmatch/filer/<id på Nordisk Industris post>/` → "Filen findes
   ikke, eller du har ikke adgang til den." Listen viser nu kun virksomhed 1.
   Bruger-id'erne står i `portal.users` (kolonnen `id`).

### Samme tur gennem API-routene

```bash
# i .env.local
PORTAL_DATA_MODE=api
PORTAL_API_TOKEN=et-langt-tilfældigt-ord
```

Genstart `pnpm dev` og gentag punkt 1–7. Alt skal opføre sig identisk — nu går
hvert kald over `/api/portal/*`. Et kald uden token svarer 401:

```bash
curl -i http://localhost:3000/app-rewrite/api/portal/archive/
```

## 3. Dry-run på de rigtige data

```bash
pnpm dry-run                # læser legacy-php/data/, skriver INTET, rører ikke nettet
pnpm dry-run:db             # samme + read-only SELECT mod portal-tabellerne
```

Rapporten viser hvad der *ville* blive oprettet (antal pr. tabel, antal
storage-objekter, stiformat), hvordan ejerskabet ville blive løst, hvilke poster
der mangler en fil, hvilke filer der ikke har en post, hvor mange bcrypt-hash
der droppes, og alle valideringsfejl/kollisioner. **Ingen persondata i
rapporten** — kun antal, POC-id'er, feltnavne og maskerede e-mails. Exitkoden er
1, hvis noget ikke kan migreres.

## 4. Grønt værktøj

```bash
pnpm typecheck
pnpm build
```
