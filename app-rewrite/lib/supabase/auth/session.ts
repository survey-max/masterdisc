import { redirect } from 'next/navigation';

import { allowedPortalUserIds, AUTH_LOG_PREFIX, PortalAuthConfigError } from './allowlist';
import { createSupabaseServerComponentClient } from './server';

/**
 * ============================================================================
 * ADGANGSTJEKKET, SERVER-SIDE
 * ============================================================================
 * To ting skal være sande, før portalen må vises:
 *
 *   1. Der er en gyldig Supabase-session. Den verificeres med `getUser()`, som
 *      spørger Supabase' auth-server — ALDRIG med `getSession()`, der blot
 *      læser cookien og derfor kan forfalskes.
 *   2. Brugerens UID står i PORTAL_ALLOWED_USER_IDS. Projektet er delt med en
 *      anden app, så et gyldigt login er i sig selv ingen adgang.
 *
 * Middlewaren laver samme tjek foran hver /jobmatch/**-request. Det her er
 * laget under: sider, route handlers og server actions spørger selv, så en
 * fejlkonfigureret matcher eller en fremtidig rute aldrig bliver til åben dør.
 * ============================================================================
 */

export interface PortalSessionUser {
  /** Supabase-auth-UID. Det er dette id, allowlisten indeholder. */
  id: string;
  email: string | null;
}

/**
 * Den indloggede, tilladte bruger — eller null. Alle tre grunde til null
 * (ingen session, UID uden for listen, manglende opsætning) logges server-side.
 * Ingen af dem giver adgang.
 */
export async function getPortalSessionUser(): Promise<PortalSessionUser | null> {
  const supabase = await createSupabaseServerComponentClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    // AuthSessionMissingError er hverdag (ikke logget ind endnu) og støjer kun.
    if (error.name !== 'AuthSessionMissingError') {
      console.error(`${AUTH_LOG_PREFIX} kunne ikke verificere sessionen:`, error.message);
    }
    return null;
  }
  const user = data.user;
  if (!user) return null;

  let allowed: string[];
  try {
    allowed = allowedPortalUserIds();
  } catch (configError) {
    console.error(
      `${AUTH_LOG_PREFIX} adgang nægtet — allowlisten er ikke sat op:`,
      configError instanceof PortalAuthConfigError ? configError.message : configError,
    );
    return null;
  }

  if (!allowed.includes(user.id)) {
    console.warn(
      `${AUTH_LOG_PREFIX} adgang nægtet: UID ${user.id} står ikke i PORTAL_ALLOWED_USER_IDS.`,
    );
    return null;
  }
  return { id: user.id, email: user.email ?? null };
}

/**
 * Til server components, der ikke kan vises uden adgang. Sender til /login/ i
 * stedet for at kaste, nu hvor der endelig ER et login at sende folk til.
 */
export async function requirePortalAccess(): Promise<PortalSessionUser> {
  const user = await getPortalSessionUser();
  if (!user) redirect('/login/');
  return user;
}

/**
 * Til server actions og route handlers, der ikke kan redirecte (deres svar er
 * et resultatobjekt eller en fil). Kaster med en dansk besked, som kalderen
 * viser brugeren — aldrig en tavs afvisning.
 */
export async function requirePortalSession(): Promise<PortalSessionUser> {
  const user = await getPortalSessionUser();
  if (!user) {
    throw new Error(
      'Din session er udløbet, eller du har ikke adgang til portalen. Log ind igen.',
    );
  }
  return user;
}
