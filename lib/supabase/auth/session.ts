import { redirect } from 'next/navigation';

import { AUTH_LOG_PREFIX, isPortalAdmin, PortalAuthConfigError } from './admin-access';
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
 *   2. Brugeren har admin-rolle (`admin`/`ejer`) i `public.user_profiles` og er
 *      ikke disabled. Projektet er delt med en anden app, så et gyldigt login
 *      er i sig selv ingen adgang.
 *
 * Middlewaren laver samme tjek foran hver /jobmatch/**-request. Det her er
 * laget under: sider, route handlers og server actions spørger selv, så en
 * fejlkonfigureret matcher eller en fremtidig rute aldrig bliver til åben dør.
 * ============================================================================
 */

export interface PortalSessionUser {
  /** Supabase-auth-UID. Det er dette id, user_profiles.auth_user_id peger på. */
  id: string;
  email: string | null;
}

/**
 * Den indloggede, tilladte bruger — eller null. Alle tre grunde til null
 * (ingen session, ingen admin-rolle, fejlet/manglende opslag) logges
 * server-side. Ingen af dem giver adgang.
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

  let erAdmin: boolean;
  try {
    erAdmin = await isPortalAdmin(user.id);
  } catch (opslagsFejl) {
    // Fail closed: både manglende opsætning og et fejlet opslag er "nej".
    console.error(
      `${AUTH_LOG_PREFIX} adgang nægtet — admin-tjekket kunne ikke gennemføres:`,
      opslagsFejl instanceof PortalAuthConfigError ? opslagsFejl.message : opslagsFejl,
    );
    return null;
  }

  if (!erAdmin) {
    console.warn(
      `${AUTH_LOG_PREFIX} adgang nægtet: UID ${user.id} har ikke admin-rolle i user_profiles.`,
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
