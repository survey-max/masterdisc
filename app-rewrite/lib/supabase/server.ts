import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { DataError } from '@/lib/data/repository';

/**
 * ============================================================================
 * SERVER-SIDE SUPABASE-KLIENT — MÅ ALDRIG IMPORTERES FRA EN KLIENTKOMPONENT
 * ============================================================================
 * Portalen bor i et DELT Supabase-projekt (v2), som også rummer CRM og
 * besvarelser. Derfor:
 *
 *   - alt portal-data ligger i schemaet `portal` (db.schema nedenfor), aldrig i
 *     public eller et andet eksisterende schema
 *   - filer ligger i bucketen `portal-arkiv`, aldrig i en eksisterende bucket
 *   - nøglen er SUPABASE_SECRET_KEY (sb_secret_…, det nye nøgleformat, som
 *     magtmæssigt svarer til service_role og går uden om RLS). Den forlader
 *     aldrig serveren.
 *
 * NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY bruges ikke i denne skive: al adgang går
 * gennem server-side API-routes. Den står i .env.example, fordi skive 2
 * (Supabase Auth i browseren) får brug for den.
 *
 * @supabase/supabase-js 2.112.3 genkender sb_secret_/sb_publishable_-formaterne
 * eksplicit (isNewApiKey i dist), så ingen ekstra opsætning er nødvendig.
 *
 * PostgREST udleverer kun schemaer, der står under Settings → API → Exposed
 * schemas. `portal` SKAL være tilføjet dér, ellers svarer alle kald med
 * "The schema must be one of the following".
 * ============================================================================
 */

/** Schemaet alt portaldata ligger i. Ingen tabeller uden for det. */
export const PORTAL_SCHEMA = 'portal';

/** Bucketen arkivets PDF-rapporter og gemte sager ligger i. */
export const ARCHIVE_BUCKET = 'portal-arkiv';

/**
 * Klienttypen. Database-generic'en er `any`, fordi der ikke genereres
 * Database-typer fra hovedrepoets skema her — rækker valideres i stedet
 * eksplicit i lib/data/supabase/mapping.ts, som JSON-implementeringen
 * validerede filer. En genereret type ville være to kilder til samme sandhed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PortalClient = SupabaseClient<any, typeof PORTAL_SCHEMA>;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new DataError(
      `Miljøvariablen ${name} mangler. Portalen kan ikke tale med Supabase uden den — ` +
        'kopiér .env.example til .env.local og udfyld den (se docs/SUPABASE.md).',
    );
  }
  return value.trim();
}

let cached: PortalClient | null = null;

/**
 * Klienten med secret-nøglen. Kun til server-side brug: route handlers, server
 * actions, server components og scripts.
 *
 * Kaster med en læsbar besked hvis noget mangler eller ser forkert ud — ingen
 * tavs fallback til en tom klient, for så ville en glemt variabel se ud som
 * "der er ingen data".
 */
export function supabaseAdmin(): PortalClient {
  if (typeof window !== 'undefined') {
    throw new DataError(
      'Supabase-secret-nøglen må aldrig bruges i browseren. Dette modul er server-side.',
    );
  }
  if (cached) return cached;

  const url = requiredEnv('NEXT_PUBLIC_SUPABASE_URL');
  const secretKey = requiredEnv('SUPABASE_SECRET_KEY');

  if (secretKey.startsWith('sb_publishable_') || secretKey.startsWith('eyJ')) {
    throw new DataError(
      'SUPABASE_SECRET_KEY ser ud til at være en publishable nøgle eller en gammel anon-JWT. ' +
        'Brug den hemmelige nøgle (sb_secret_…), ellers afviser Supabase skrivninger til portal-schemaet.',
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cached = createClient<any, typeof PORTAL_SCHEMA>(url, secretKey, {
    db: { schema: PORTAL_SCHEMA },
    // Ingen session, ingen refresh: nøglen er en maskinnøgle, ikke en bruger.
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { 'x-portal-client': 'app-rewrite' } },
  });
  return cached;
}
