/**
 * ============================================================================
 * ALLOWLISTEN — HVEM AF SUPABASE-BRUGERNE MÅ SE PORTALEN
 * ============================================================================
 * Supabase-projektet er DELT med coachersuniversed, så `auth.users` rummer
 * mange brugere, der intet har med portalen at gøre. "Logget ind" er derfor
 * IKKE det samme som "har adgang": et gyldigt login skal desuden have sit
 * auth-UID stående i PORTAL_ALLOWED_USER_IDS (kommasepareret).
 *
 * Listen er en ren miljøvariabel — ingen tabel, ingen rolle, intet i databasen.
 * Det er med vilje: roller og user_profiles hører til det andet repo.
 *
 * FAIL CLOSED. Er variablen tom eller ikke sat, kastes der. Et manglende
 * allowlist-opsæt må aldrig kunne læses som "så lukker vi alle ind" — det ville
 * være præcis den tavse fejl, resten af portalen er bygget for at undgå.
 * ============================================================================
 */

/** Opsætningsfejl — ikke brugerens skyld, og aldrig en grund til at lukke op. */
export class PortalAuthConfigError extends Error {
  override readonly name = 'PortalAuthConfigError';
}

export const ALLOWLIST_ENV = 'PORTAL_ALLOWED_USER_IDS';

/** Præfiks på alle auth-logs, så en afvisning kan findes igen i serverloggen. */
export const AUTH_LOG_PREFIX = '[portal-auth]';

/**
 * UID'erne fra PORTAL_ALLOWED_USER_IDS. Kaster hvis variablen mangler, er tom
 * eller kun består af separatorer.
 *
 * Kun server-side: listen er ikke NEXT_PUBLIC_, og hvem der har adgang skal
 * ikke kunne læses ud af en JS-bundle.
 */
export function allowedPortalUserIds(): string[] {
  if (typeof window !== 'undefined') {
    throw new PortalAuthConfigError(
      `${ALLOWLIST_ENV} er server-side. Allowlisten må aldrig slås op i browseren.`,
    );
  }

  const raw = process.env[ALLOWLIST_ENV];
  const ids = (raw ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id !== '');

  if (ids.length === 0) {
    throw new PortalAuthConfigError(
      `Miljøvariablen ${ALLOWLIST_ENV} mangler eller er tom. Portalen afviser alle logins, ` +
        'indtil den indeholder mindst ét Supabase-auth-UID (kommasepareret). ' +
        'Se docs/AUTH.md.',
    );
  }
  return ids;
}

/** Står UID'et på listen? Kaster samme opsætningsfejl som `allowedPortalUserIds`. */
export function isPortalUserAllowed(userId: string): boolean {
  return allowedPortalUserIds().includes(userId);
}
