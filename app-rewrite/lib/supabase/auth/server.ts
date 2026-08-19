import { cookies } from 'next/headers';

import { createServerClient } from '@supabase/ssr';

import { supabaseAuthEnv } from './config';

/**
 * Klienten til SERVER COMPONENTS (sider og layouts).
 *
 * En server component må ikke skrive cookies — Next.js har allerede sendt dem
 * afsted. `setAll` er derfor et bevidst no-op: en fornyet session skrives af
 * middlewaren (lib/supabase/auth/middleware.ts), som kører før renderingen på
 * hver request mod /jobmatch/**. Uden middlewaren ville sessionen aldrig blive
 * fornyet, og brugeren ville blive logget ud, når access-token'et udløber.
 */
export async function createSupabaseServerComponentClient() {
  const store = await cookies();
  const { url, publishableKey } = supabaseAuthEnv();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: () => {
        /* Se kommentaren ovenfor: middlewaren forny(e)r sessionen. */
      },
    },
  });
}
