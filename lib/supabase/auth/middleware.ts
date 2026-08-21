import { NextResponse, type NextRequest } from 'next/server';

import { AUTH_LOG_PREFIX, isPortalAdmin, PortalAuthConfigError } from './admin-access';
import {
  isLegacySupabaseCookie,
  PORTAL_SESSION_COOKIE,
  verifyPortalSessionValue,
} from './portal-session';

/**
 * ============================================================================
 * MIDDLEWAREN — DEN FØRSTE PORT FORAN /jobmatch/**
 * ============================================================================
 * Verificerer portal-sessionscookien (HMAC + udløb) og slår admin-rollen op i
 * user_profiles. Gyldig cookie OG admin-rolle, ellers /login/.
 *
 * Der er ingen Supabase-session at forny længere: cookien er portalens egen og
 * fornys ikke — den udløber efter PORTAL_SESSION_TTL_MS, og så logges der ind
 * igen. Det gør middlewaren fri for @supabase/ssr i edge-bundlen.
 *
 * Kører i Edge-runtime. Admin-opslaget går derfor gennem fetch mod PostgREST
 * (se admin-access.ts), og PORTAL_SESSION_SECRET + SUPABASE_SECRET_KEY skal
 * være sat FØR buildet — se docs/AUTH.md.
 *
 * OPRYDNING: gamle @supabase/ssr-cookies (sb-…-auth-token.0/.1/…) fra før
 * skiftet slettes på hvert svar, der kommer forbi. De er døde, og de fylder i
 * hvert requests headers, indtil de er væk.
 * ============================================================================
 */

/** Hvor en afvist request sendes hen. Trailing slash, jf. next.config.ts. */
const LOGIN_PATH = '/login/';

export async function guardPortalRequest(request: NextRequest): Promise<NextResponse> {
  const response = NextResponse.next({ request });
  deleteLegacyCookies(request, response);

  const raw = request.cookies.get(PORTAL_SESSION_COOKIE)?.value;
  if (!raw) return redirectToLogin(request, response);

  let payload;
  try {
    payload = await verifyPortalSessionValue(raw);
  } catch (configError) {
    console.error(
      `${AUTH_LOG_PREFIX} portalen er spærret — sessionshemmeligheden mangler:`,
      configError instanceof PortalAuthConfigError ? configError.message : configError,
    );
    return redirectToLogin(request, response, 'opsaetning');
  }
  if (!payload) return redirectToLogin(request, response);

  let erAdmin: boolean;
  try {
    erAdmin = await isPortalAdmin(payload.uid);
  } catch (opslagsFejl) {
    // Fail closed: manglende opsætning OG et fejlet opslag spærrer begge.
    console.error(
      `${AUTH_LOG_PREFIX} adgang nægtet — admin-tjekket kunne ikke gennemføres:`,
      opslagsFejl instanceof PortalAuthConfigError ? opslagsFejl.message : opslagsFejl,
    );
    return redirectToLogin(request, response, 'opsaetning');
  }

  if (!erAdmin) {
    console.warn(
      `${AUTH_LOG_PREFIX} adgang nægtet til ${request.nextUrl.pathname}: ` +
        `UID ${payload.uid} har ikke admin-rolle i user_profiles.`,
    );
    return redirectToLogin(request, response, 'ingen-adgang');
  }

  return response;
}

/** Sæt gamle @supabase/ssr-cookies til sletning på svaret. */
function deleteLegacyCookies(request: NextRequest, response: NextResponse): void {
  for (const cookie of request.cookies.getAll()) {
    if (isLegacySupabaseCookie(cookie.name)) {
      response.cookies.delete(cookie.name);
    }
  }
}

/**
 * Redirect til login MED de cookies, svaret allerede har sat — herunder
 * sletningen af de gamle sb-cookies. Kopieres de ikke over, når oprydningen
 * aldrig browseren.
 */
function redirectToLogin(
  request: NextRequest,
  response: NextResponse,
  reason?: 'ingen-adgang' | 'opsaetning',
): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = LOGIN_PATH;
  url.search = reason ? `?fejl=${reason}` : '';

  const redirectResponse = NextResponse.redirect(url);
  for (const cookie of response.cookies.getAll()) {
    redirectResponse.cookies.set(cookie);
  }
  return redirectResponse;
}
