import { PortalAuthConfigError } from './admin-access';

/**
 * De to offentlige Supabase-variabler til login-verifikationen.
 *
 * Publishable-nøglen bruges KUN i login-action'ens tilstandsløse klient, der
 * verificerer email + adgangskode (app/login/actions.ts). Bemærk forskellen
 * til lib/supabase/server.ts: DEN klient bruger den hemmelige nøgle og går
 * uden om RLS (maskinadgang til schemaet `portal`) — de to må aldrig blandes
 * sammen.
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
