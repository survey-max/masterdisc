-- ============================================================================
-- portal: RLS slået til — bevidst UDEN policies
-- ============================================================================
-- Køres SIDST. Idempotent (enable row level security er en no-op når den
-- allerede er slået til).
--
-- Hvorfor nu, når skive 1 ikke har rigtig auth endnu:
--   * service_role (sb_secret_-nøglen) har BYPASSRLS, så portalens
--     server-side API-routes virker uændret.
--   * Nul policies + nul grants til anon/authenticated betyder, at tabellerne
--     er lukkede land for enhver anden vej ind — også hvis nogen senere ved et
--     uheld giver rettigheder til en browser-rolle i det delte projekt.
--   * Det koster ingenting nu, og undgår et vindue hvor rigtige data ligger i
--     et delt projekt uden RLS.
--
-- OBLIGATORISK INDEN RIGTIGE DATA (skive 2): rigtige policies. Skitse:
--   portal.users:            en bruger må se sig selv og andre i samme
--                            organisation; role='admin' må se alle.
--   portal.organisations:    egen organisation; admin alle.
--   portal.archive_entries:  organisation_id = den indloggede brugers
--                            organisation (opslag via portal.users.auth_user_id
--                            = auth.uid()); admin alle.
--   storage.objects:         bucket_id = 'portal-arkiv' og
--                            (storage.foldername(name))[2] = brugerens
--                            organisation_id::text.
-- Indtil da er der ingen policies, og adgang findes kun via service_role.
-- ============================================================================

alter table portal.organisations enable row level security;
alter table portal.users enable row level security;
alter table portal.archive_entries enable row level security;

comment on schema portal is
  'Coachersai jobmatch-portalen (app-rewrite). Alt portal-relateret ligger her; '
  'intet i public. RLS er slået til på alle tabeller UDEN policies: kun '
  'service_role (sb_secret_-nøglen fra server-side API-routes) kan læse og '
  'skrive. Rigtige policies er obligatoriske inden rigtige data — se '
  '20260818120200_portal_enable_rls.sql.';
