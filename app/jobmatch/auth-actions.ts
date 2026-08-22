'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { AUTH_LOG_PREFIX } from '@/lib/supabase/auth/admin-access';
import {
  isLegacySupabaseCookie,
  PORTAL_SESSION_COOKIE,
  portalSessionCookieOptions,
} from '@/lib/supabase/auth/portal-session';

/**
 * Log ud. Portal-sessionen ER cookien, så log ud er at slette den — der er
 * ingen Supabase-session at afslutte (login-action'en trak den tilbage med
 * det samme). Gamle @supabase/ssr-cookies fejes med, hvis de stadig er der.
 *
 * Det er en server action og ikke et link til en GET-rute med vilje: et link
 * ville kunne udløses af en prefetch eller af et fremmed website og logge
 * brugeren ud uden at have bedt om det.
 */
export async function logUdAction(): Promise<{ fejl: string } | void> {
  const cookieStore = await cookies();
  // Sletning via set + maxAge 0: en __Host--cookie kan kun overskrives af et
  // Set-Cookie, der selv har Secure og Path=/ — en nøgen delete() har ikke det.
  cookieStore.set(PORTAL_SESSION_COOKIE, '', { ...portalSessionCookieOptions(), maxAge: 0 });
  for (const cookie of cookieStore.getAll()) {
    if (isLegacySupabaseCookie(cookie.name)) cookieStore.delete(cookie.name);
  }

  console.info(`${AUTH_LOG_PREFIX} bruger logget ud.`);
  // redirect() kaster med vilje og skal stå til sidst.
  redirect('/login/');
}
