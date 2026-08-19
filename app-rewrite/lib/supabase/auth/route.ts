import { cookies } from 'next/headers';

import { createServerClient } from '@supabase/ssr';

import { supabaseAuthEnv } from './config';

/**
 * Klienten til ROUTE HANDLERS og SERVER ACTIONS — altså de steder, hvor
 * cookies FAKTISK må skrives. Det er den, login og log ud bruger:
 * `signInWithPassword` og `signOut` sætter og rydder sessions-cookien gennem
 * `setAll` herunder.
 */
export async function createSupabaseRouteClient() {
  const store = await cookies();
  const { url, publishableKey } = supabaseAuthEnv();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value, options } of cookiesToSet) {
          store.set(name, value, options);
        }
      },
    },
  });
}
