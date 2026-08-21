import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { AUTH_LOG_PREFIX, isPortalAdmin, PortalAuthConfigError } from './admin-access';
import { PORTAL_SESSION_COOKIE, verifyPortalSessionValue } from './portal-session';

/**
 * ============================================================================
 * ADGANGSTJEKKET, SERVER-SIDE
 * ============================================================================
 * To ting skal være sande, før portalen må vises:
 *
 *   1. Der er en gyldig portal-session: cookien i PORTAL_SESSION_COOKIE
 *      verificeres mod HMAC-signaturen og sit udløb (portal-session.ts).
 *      Cookien er httpOnly og signeret server-side — den kan ikke forfalskes
 *      eller læses af klientkode.
 *   2. Brugeren har admin-rolle (`admin`/`ejer`) i `public.user_profiles` og er
 *      ikke disabled. Rollen slås op ved HVERT kald — cookien beviser kun
 *      identitet, aldrig privilegium.
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
 * Den indloggede, tilladte bruger — eller null. Alle grunde til null
 * (ingen/ugyldig/udløbet cookie, ingen admin-rolle, fejlet/manglende opslag)
 * logges server-side. Ingen af dem giver adgang.
 */
export async function getPortalSessionUser(): Promise<PortalSessionUser | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(PORTAL_SESSION_COOKIE)?.value;
  if (!raw) return null;

  let payload;
  try {
    payload = await verifyPortalSessionValue(raw);
  } catch (configError) {
    console.error(
      `${AUTH_LOG_PREFIX} adgang nægtet — sessionshemmeligheden er ikke sat op:`,
      configError instanceof PortalAuthConfigError ? configError.message : configError,
    );
    return null;
  }
  if (!payload) {
    // Udløbet er hverdag; en forkert signatur er det ikke. Begge afvises ens,
    // og cookien skelner ikke — loggen her er nok til at finde mønstre.
    console.warn(`${AUTH_LOG_PREFIX} afvist: ugyldig eller udløbet portal-session.`);
    return null;
  }

  let erAdmin: boolean;
  try {
    erAdmin = await isPortalAdmin(payload.uid);
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
      `${AUTH_LOG_PREFIX} adgang nægtet: UID ${payload.uid} har ikke admin-rolle i user_profiles.`,
    );
    return null;
  }
  return { id: payload.uid, email: payload.email };
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
