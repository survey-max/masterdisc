'use server';

import { redirect } from 'next/navigation';

import { AUTH_LOG_PREFIX } from '@/lib/supabase/auth/admin-access';
import { createSupabaseRouteClient } from '@/lib/supabase/auth/route';

/**
 * Log ud. Sessionen afsluttes hos Supabase, og cookien ryddes af klienten i
 * lib/supabase/auth/route.ts.
 *
 * Det er en server action og ikke et link til en GET-rute med vilje: et link
 * ville kunne udløses af en prefetch eller af et fremmed website og logge
 * brugeren ud uden at have bedt om det.
 */
export async function logUdAction(): Promise<{ fejl: string } | void> {
  const supabase = await createSupabaseRouteClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error(`${AUTH_LOG_PREFIX} log ud mislykkedes:`, error.message);
    return { fejl: 'Du kunne ikke logges ud. Prøv igen.' };
  }

  console.info(`${AUTH_LOG_PREFIX} bruger logget ud.`);
  // Uden for fejlhåndteringen ovenfor: redirect() kaster med vilje.
  redirect('/login/');
}
