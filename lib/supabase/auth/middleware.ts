import { NextResponse, type NextRequest } from 'next/server';

import { createServerClient } from '@supabase/ssr';

import { allowedPortalUserIds, AUTH_LOG_PREFIX, PortalAuthConfigError } from './allowlist';
import { supabaseAuthEnv } from './config';

/**
 * ============================================================================
 * MIDDLEWAREN — DEN FØRSTE PORT FORAN /jobmatch/**
 * ============================================================================
 * To opgaver, i den rækkefølge @supabase/ssr kræver:
 *
 *   1. FORNY SESSIONEN. `getUser()` opdaterer access-token'et, og de nye
 *      cookies skal skrives på det svar, der sendes videre — både på
 *      NextResponse.next() og på et eventuelt redirect. Sker det ikke, ryger
 *      brugeren ud, så snart token'et udløber.
 *   2. TJEK ADGANGEN. Gyldig session OG UID på allowlisten, ellers /login/.
 *
 * Der må ikke ligge kode mellem `createServerClient` og `getUser()`: alt, der
 * kan nå at læse cookies imellem, kan gøre sessionen ustabil.
 *
 * Kører i Edge-runtime. Det betyder, at PORTAL_ALLOWED_USER_IDS skal være sat
 * FØR buildet — se docs/AUTH.md.
 * ============================================================================
 */

/** Hvor en afvist request sendes hen. Trailing slash, jf. next.config.ts. */
const LOGIN_PATH = '/login/';

export async function guardPortalRequest(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  let env;
  try {
    env = supabaseAuthEnv();
  } catch (configError) {
    console.error(
      `${AUTH_LOG_PREFIX} portalen er spærret — Supabase-variablerne mangler:`,
      configError instanceof PortalAuthConfigError ? configError.message : configError,
    );
    return redirectToLogin(request, response, 'opsaetning');
  }

  const supabase = createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data, error } = await supabase.auth.getUser();

  if (error && error.name !== 'AuthSessionMissingError') {
    console.error(`${AUTH_LOG_PREFIX} sessionen kunne ikke verificeres:`, error.message);
  }

  const user = data.user;
  if (!user) return redirectToLogin(request, response);

  let allowed: string[];
  try {
    allowed = allowedPortalUserIds();
  } catch (configError) {
    console.error(
      `${AUTH_LOG_PREFIX} adgang nægtet — allowlisten er ikke sat op:`,
      configError instanceof PortalAuthConfigError ? configError.message : configError,
    );
    return redirectToLogin(request, response, 'opsaetning');
  }

  if (!allowed.includes(user.id)) {
    console.warn(
      `${AUTH_LOG_PREFIX} adgang nægtet til ${request.nextUrl.pathname}: ` +
        `UID ${user.id} står ikke i PORTAL_ALLOWED_USER_IDS.`,
    );
    return redirectToLogin(request, response, 'ingen-adgang');
  }

  return response;
}

/**
 * Redirect til login MED de cookies, klienten netop har fornyet. Kopieres de
 * ikke over, taber svaret den nye session — det er den klassiske fælde i
 * Supabase' middleware-mønster.
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
