import { PortalAuthConfigError } from './admin-access';

/**
 * De to offentlige Supabase-variabler, auth-klienterne deles om.
 *
 * Bemærk forskellen til lib/supabase/server.ts: DEN klient bruger den hemmelige
 * nøgle og går uden om RLS (maskinadgang til schemaet `portal`). Auth-klienterne
 * her bruger publishable-nøglen og handler på vegne af den indloggede bruger —
 * de to må aldrig blandes sammen.
 */
export interface SupabaseAuthEnv {
  url: string;
  publishableKey: string;
}

export function supabaseAuthEnv(): SupabaseAuthEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !publishableKey) {
    throw new PortalAuthConfigError(
      'NEXT_PUBLIC_SUPABASE_URL og/eller NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY mangler. ' +
        'Uden dem kan der ikke logges ind — kopiér .env.example til .env.local og udfyld dem.',
    );
  }
  return { url, publishableKey };
}
