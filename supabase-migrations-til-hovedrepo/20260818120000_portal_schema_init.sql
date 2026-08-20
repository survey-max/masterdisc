-- ============================================================================
-- portal: schema, rettigheder og hjælpefunktion
-- ============================================================================
-- Skal køres FØRST. Idempotent: kan køres igen uden at ændre noget.
--
-- Hele coachersai-portalen (jobmatch: virksomheder, brugere, arkivposter) bor i
-- schemaet `portal` i det DELTE Supabase-projekt (v2), som også rummer CRM og
-- besvarelser. Ingen portal-objekter uden for dette schema, og intet i denne
-- fil rører public eller andre eksisterende schemas.
--
-- Rettighedsmodellen: KUN service_role får adgang. anon og authenticated får
-- ingen USAGE på schemaet og ingen rettigheder på tabellerne, så portalens
-- tabeller ikke kan nås med den publishable nøgle fra en browser — heller ikke
-- før RLS-policies findes (se 20260818120200_portal_enable_rls.sql).
--
-- FREMTIDSNOTE (ingen kode her): portal-virksomheder kan senere kobles til
-- hovedplatformens companies-tabel med en kolonne
-- portal.organisations.platform_company_id uuid + partielt unique-indeks.
-- Bevidst udeladt i denne skive: ingen foreign keys på tværs af schemas.
-- ============================================================================

create schema if not exists portal;

comment on schema portal is
  'Coachersai jobmatch-portalen (app-rewrite). Alt portal-relateret ligger her; '
  'intet i public. Adgang kun via service_role (sb_secret_-nøglen) fra '
  'server-side API-routes. RLS-policies er obligatoriske inden rigtige data.';

-- ---------------------------------------------------------------- rettigheder

-- Læses schemaet over PostgREST (supabase-js med db.schema = 'portal'), skal
-- 'portal' desuden stå under Settings -> API -> Exposed schemas i projektet.
-- Det er en projektindstilling, ikke SQL, og den er additiv.
grant usage on schema portal to service_role;

-- Ingen browser-roller. Eksplicit, så en fremtidig fejl-grant er synlig.
revoke all on schema portal from anon, authenticated;

-- Nye tabeller/sekvenser i schemaet arver samme model som ovenfor.
alter default privileges in schema portal
  grant select, insert, update, delete on tables to service_role;
alter default privileges in schema portal
  grant usage, select on sequences to service_role;
alter default privileges in schema portal
  revoke all on tables from anon, authenticated;
alter default privileges in schema portal
  revoke all on sequences from anon, authenticated;

-- ------------------------------------------------------------ hjælpefunktion

-- Holder updated_at i sync. search_path er tom og alt er fuldt kvalificeret,
-- så funktionen ikke kan omdirigeres via en kaldes søgesti.
create or replace function portal.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function portal.set_updated_at() is
  'Trigger-funktion: sætter updated_at = now() ved UPDATE. Bruges af alle '
  'portal-tabeller.';

revoke all on function portal.set_updated_at() from public;
grant execute on function portal.set_updated_at() to service_role;
