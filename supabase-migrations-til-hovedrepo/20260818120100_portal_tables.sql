-- ============================================================================
-- portal: virksomheder, brugere og arkivposter
-- ============================================================================
-- Køres EFTER 20260818120000_portal_schema_init.sql. Idempotent.
--
-- Kolonnenavne er engelske (repo-reglen: engelsk i kode, dansk i UI).
-- Datalagets danske TS-nøgler mappes ét sted: app-rewrite/lib/data/supabase/
-- mapping.ts. Se også app-rewrite/docs/SUPABASE.md for mapping-tabellen.
--
-- Ingen adgangskoder nogen steder: POC'ens bcrypt-'hash' migreres ALDRIG.
-- Login besluttes i skive 2 (Supabase Auth), og dér kommer også
-- portal.users.auth_user_id.
-- ============================================================================

-- ------------------------------------------------------------- virksomheder

create table if not exists portal.organisations (
  id uuid primary key default gen_random_uuid(),
  -- POC'ens 16 hex-tegn. Nøglen der gør migrering fra legacy-data idempotent.
  legacy_id text unique,
  name text not null
    constraint organisations_name_not_blank check (btrim(name) <> ''),
  -- Opbevaringsregel pr. virksomhed. Ingen håndhævelse i denne skive.
  default_retention_days integer
    constraint organisations_retention_positive
    check (default_retention_days is null or default_retention_days > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table portal.organisations is
  'Virksomheder i portalen (POC: organisationer.json). FREMTIDSNOTE: kobling '
  'til hovedplatformens companies sker senere via platform_company_id uuid — '
  'ingen foreign key på tværs af schemas.';
comment on column portal.organisations.legacy_id is
  'POC-id (16 hex). Bruges kun til migrering/seed-idempotens, aldrig i URL''er.';
comment on column portal.organisations.default_retention_days is
  'Forberedt: standard opbevaringsperiode for virksomhedens arkivposter. '
  'Intet i systemet håndhæver den endnu.';

drop trigger if exists organisations_set_updated_at on portal.organisations;
create trigger organisations_set_updated_at
  before update on portal.organisations
  for each row execute function portal.set_updated_at();

-- ------------------------------------------------------------------ brugere

create table if not exists portal.users (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  organisation_id uuid not null
    references portal.organisations (id) on delete restrict,
  name text not null
    constraint users_name_not_blank check (btrim(name) <> ''),
  -- Gemmes altid i små bogstaver, så unikhed og opslag er den samme regel.
  email text not null
    constraint users_email_shape check (
      email = lower(email)
      and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    ),
  -- POC'ens 'orgadmin' havde præcis en brugers rettigheder og er droppet som
  -- død kode; legacy-rækker mappes til 'bruger' ved migrering.
  role text not null default 'bruger'
    constraint users_role_known check (role in ('admin', 'bruger')),
  blocked boolean not null default false,
  -- POC: sidstSet = 0 betyder "aldrig set" og bliver null her.
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table portal.users is
  'Portalbrugere (POC: brugere.json), UDEN credentials. Ingen password-hash '
  'migreres nogensinde hertil. Skive 2 tilføjer auth_user_id -> auth.users '
  'og RLS-policies baseret på organisation_id.';
comment on column portal.users.blocked is 'POC: spaerret.';

create unique index if not exists users_email_unique
  on portal.users (lower(email));
create index if not exists users_organisation_idx
  on portal.users (organisation_id);

drop trigger if exists users_set_updated_at on portal.users;
create trigger users_set_updated_at
  before update on portal.users
  for each row execute function portal.set_updated_at();

-- -------------------------------------------------------------- arkivposter

create table if not exists portal.archive_entries (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  -- Virksomheds-scoping hænger på denne kolonne. Alt filtreres på den.
  organisation_id uuid not null
    references portal.organisations (id) on delete restrict,
  -- EJERSKAB: en rigtig relation, ikke et navn i klartekst.
  created_by_user_id uuid references portal.users (id) on delete set null,
  -- Visnings-snapshot af navnet (POC's 'bruger'-felt). Display-only: må ALDRIG
  -- bruges til adgangskontrol, og bevares for legacy-poster uden kendt bruger.
  created_by_name text not null default '',
  kind text not null
    constraint archive_kind_known check (kind in ('rapport', 'sag')),
  candidate_name text not null
    constraint archive_candidate_not_blank check (btrim(candidate_name) <> ''),
  -- POC: stilling. Hedder job_title, fordi 'position' er et SQL-nøgleord.
  job_title text not null default '',
  case_date date not null,
  note text not null default '',
  original_filename text not null default ''
    constraint archive_filename_length check (length(original_filename) <= 160),
  -- arkiv.php's MAKS = 25 MB, håndhævet igen her og på bucketen.
  byte_size bigint not null
    constraint archive_byte_size_range
    check (byte_size >= 0 and byte_size <= 26214400),
  content_type text not null
    constraint archive_content_type_known
    check (content_type in ('application/pdf', 'application/json')),
  -- Sti i bucketen portal-arkiv: org/<organisation_id>/<id>.<pdf|json>
  storage_path text not null unique,
  checksum_sha256 text
    constraint archive_checksum_shape
    check (checksum_sha256 is null or checksum_sha256 ~ '^[0-9a-f]{64}$'),
  -- Forberedt til senere slettehåndhævelse (fx pg_cron). Intet håndhæver den.
  retention_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint archive_kind_matches_content_type check (
    (kind = 'rapport' and content_type = 'application/pdf')
    or (kind = 'sag' and content_type = 'application/json')
  )
);

comment on table portal.archive_entries is
  'Arkivets indeks (POC: data.json). En post = én uploadet PDF-rapport '
  '(kind=rapport) eller én gemt JobMatch-sag (kind=sag). Selve filen ligger i '
  'storage-bucketen portal-arkiv på storage_path — ikke i Postgres.';
comment on column portal.archive_entries.created_by_name is
  'Kun til visning (POC-kompatibilitet). Adgangskontrol bruger '
  'organisation_id, ejerskab bruger created_by_user_id.';
comment on column portal.archive_entries.retention_until is
  'Forberedt: tidspunktet hvor posten og dens fil skal slettes. Der findes '
  'endnu ingen håndhævelse — hverken her eller i appen.';
comment on column portal.archive_entries.storage_path is
  'Unik, så to samtidige uploads ikke kan overskrive hinandens fil. '
  'Erstatter POC''ens LOCK_EX sammen med primærnøglen.';

-- Præcis listevisningens sortering (nyeste dato først, derefter tilføjet).
create index if not exists archive_entries_list_idx
  on portal.archive_entries (organisation_id, case_date desc, created_at desc);
create index if not exists archive_entries_created_by_idx
  on portal.archive_entries (created_by_user_id);
create index if not exists archive_entries_retention_idx
  on portal.archive_entries (retention_until)
  where retention_until is not null;

drop trigger if exists archive_entries_set_updated_at on portal.archive_entries;
create trigger archive_entries_set_updated_at
  before update on portal.archive_entries
  for each row execute function portal.set_updated_at();

-- ------------------------------------------------------------- rettigheder

-- Gentaget her, så tabellerne har den rigtige model også hvis
-- default privileges ikke slog igennem (fx anden kørende rolle).
grant select, insert, update, delete on all tables in schema portal to service_role;
revoke all on all tables in schema portal from anon, authenticated;
