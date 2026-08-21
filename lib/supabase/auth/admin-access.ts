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

/**
 * Har auth-UID'et en profil i `public.user_profiles` med admin-rolle og uden
 * `disabled`? Kaster PortalAuthConfigError ved manglende opsætning og Error,
 * hvis opslaget fejler — begge dele skal kalderen behandle som "ingen adgang".
 */
export async function isPortalAdmin(userId: string): Promise<boolean> {
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
