/**
 * ============================================================================
 * ADMIN-TJEKKET — HVEM AF SUPABASE-BRUGERNE MÅ SE PORTALEN
 * ============================================================================
 * Supabase-projektet er DELT med coachersuniversed, så `auth.users` rummer
 * mange brugere, der intet har med portalen at gøre. "Logget ind" er derfor
 * IKKE det samme som "har adgang": adgang kræver, at brugeren står i
 * `public.user_profiles` (coachersuniversed's brugertabel) med rollen `admin`
 * eller `ejer` — samme definition som ADMIN_ROLES i det andet repo — og uden
 * `disabled`-markering.
 *
 * Opslaget sker med SUPABASE_SECRET_KEY direkte mod PostgREST via fetch, ikke
 * gennem supabase-js: tjekket kører også i middlewaren (Edge-runtime), og
 * dens bundle skal holdes fri for ekstra imports.
 *
 * FAIL CLOSED. Mangler miljøvariablerne, eller fejler opslaget, kastes der.
 * En fejl må aldrig kunne læses som "så lukker vi alle ind" — det ville være
 * præcis den tavse fejl, resten af portalen er bygget for at undgå.
 * ============================================================================
 */

/** Opsætningsfejl — ikke brugerens skyld, og aldrig en grund til at lukke op. */
export class PortalAuthConfigError extends Error {
  override readonly name = 'PortalAuthConfigError';
}

/** Præfiks på alle auth-logs, så en afvisning kan findes igen i serverloggen. */
export const AUTH_LOG_PREFIX = '[portal-auth]';

/**
 * Rollerne i `user_profiles` med fuld administrativ adgang. Skal matche
 * ADMIN_ROLES i coachersuniversed (lib/auth/guard.ts) — det er samme database
 * og samme rollebegreb.
 */
export const ADMIN_ROLES: readonly string[] = ['admin', 'ejer'];

interface AdminAccessEnv {
  url: string;
  secretKey: string;
}

/**
 * De to miljøvariabler, admin-tjekket kræver. Kaster hvis en af dem mangler.
 * Kaldes også af login-action'en FØR selve login-forsøget, så en manglende
 * opsætning spærrer login i stedet for at efterlade en halv session.
 *
 * Kun server-side: den hemmelige nøgle må aldrig kunne læses i browseren.
 */
export function portalAdminAccessEnv(): AdminAccessEnv {
  if (typeof window !== 'undefined') {
    throw new PortalAuthConfigError(
      'SUPABASE_SECRET_KEY er server-side. Admin-tjekket må aldrig køre i browseren.',
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();

  if (!url || !secretKey) {
    throw new PortalAuthConfigError(
      'NEXT_PUBLIC_SUPABASE_URL og/eller SUPABASE_SECRET_KEY mangler. Portalen afviser alle ' +
        'logins, indtil begge er sat — adgang afgøres af admin-rollen i user_profiles. ' +
        'Se docs/AUTH.md.',
    );
  }
  return { url, secretKey };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Har auth-UID'et en profil i `public.user_profiles` med admin-rolle og uden
 * `disabled`? Kaster PortalAuthConfigError ved manglende opsætning og Error,
 * hvis opslaget fejler — begge dele skal kalderen behandle som "ingen adgang".
 *
 * UID'et SKAL være et UUID. Kilderne er i dag begge betroede (Supabase' eget
 * user.id og payload'en fra den signerede cookie), men værdien ender i et
 * PostgREST-filter — formkravet her gør, at en fremtidig kalder med utroet
 * input aldrig kan smugle filtersyntaks med. Fail closed: forkert form = nej.
 */
export async function isPortalAdmin(userId: string): Promise<boolean> {
  if (!UUID_PATTERN.test(userId)) {
    console.warn(`${AUTH_LOG_PREFIX} adgang nægtet: UID har ikke UUID-form.`);
    return false;
  }

  const { url, secretKey } = portalAdminAccessEnv();

  const query = new URLSearchParams({
    select: 'role,disabled',
    auth_user_id: `eq.${userId}`,
    limit: '1',
  });

  const response = await fetch(`${url}/rest/v1/user_profiles?${query}`, {
    headers: {
      apikey: secretKey,
      authorization: `Bearer ${secretKey}`,
      // user_profiles ligger i public-schemaet — IKKE i `portal`, som resten
      // af portalens data. Siges eksplicit, så det ikke arver noget en dag.
      'accept-profile': 'public',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(
      `user_profiles-opslaget for UID ${userId} svarede ${response.status}: ` +
        (await response.text()).slice(0, 300),
    );
  }

  const rows = (await response.json()) as Array<{ role?: string; disabled?: boolean }>;
  const profile = rows[0];
  if (!profile) return false;

  return ADMIN_ROLES.includes(profile.role ?? '') && profile.disabled !== true;
}

/**
 * ============================================================================
 * JOBMATCH-RETTIGHEDEN PÅ EGNE ROLLER (coachersuniversed, 2026-08-22)
 * ============================================================================
 * coachersuniversed har "egne roller" (tabel `public.custom_roles`, kolonne
 * `user_profiles.custom_role_id`, migration 20260822_custom_roles) med et
 * Jobmatch-toggle: `permissions.modules.jobmatch === true`. En bruger med en
 * sådan rolle må se portalen, selv om grundrollen ikke er admin/ejer.
 *
 * Opslaget er et SEPARAT kald, så det aldrig kan trække admin-tjekket ned:
 * før migrationen er kørt, svarer PostgREST 400 på den ukendte kolonne, og
 * det må ikke spærre admins. Svaret her er derfor "nej" ved ALLE fejl, med
 * log — aldrig et kast (modsat isPortalAdmin, hvor fejl = afvisning).
 */
export const JOBMATCH_MODULE_KEY = 'jobmatch';

export async function hasJobmatchRolePermission(userId: string): Promise<boolean> {
  if (!UUID_PATTERN.test(userId)) return false;

  const { url, secretKey } = portalAdminAccessEnv();

  const query = new URLSearchParams({
    // Embedding via FK user_profiles.custom_role_id -> custom_roles.id
    select: 'disabled,custom_role_id,custom_roles(permissions)',
    auth_user_id: `eq.${userId}`,
    limit: '1',
  });

  let response: Response;
  try {
    response = await fetch(`${url}/rest/v1/user_profiles?${query}`, {
      headers: {
        apikey: secretKey,
        authorization: `Bearer ${secretKey}`,
        'accept-profile': 'public',
      },
      cache: 'no-store',
    });
  } catch (error) {
    console.warn(`${AUTH_LOG_PREFIX} jobmatch-rolleopslag fejlede for UID ${userId}:`, error);
    return false;
  }

  if (!response.ok) {
    // 400 = kolonnen/tabellen findes ikke endnu (migration 20260822 ikke kørt)
    console.warn(
      `${AUTH_LOG_PREFIX} jobmatch-rolleopslag for UID ${userId} svarede ${response.status} ` +
        '(er migration 20260822_custom_roles kørt i det delte projekt?).',
    );
    return false;
  }

  const rows = (await response.json()) as Array<{
    disabled?: boolean;
    custom_role_id?: string | null;
    custom_roles?: { permissions?: { modules?: Record<string, unknown> } } | null;
  }>;
  const profile = rows[0];
  if (!profile || profile.disabled === true || !profile.custom_role_id) return false;

  return profile.custom_roles?.permissions?.modules?.[JOBMATCH_MODULE_KEY] === true;
}

/**
 * Må auth-UID'et se portalen? Admin/ejer i user_profiles ELLER en egen rolle
 * med Jobmatch slået til. Admin-tjekket kaster stadig ved fejl (fail closed);
 * rolle-tjekket er kun et "ja" oveni og kan aldrig give et falsk "ja" ved fejl.
 */
export async function hasPortalAccess(userId: string): Promise<boolean> {
  if (await isPortalAdmin(userId)) return true;
  return hasJobmatchRolePermission(userId);
}
