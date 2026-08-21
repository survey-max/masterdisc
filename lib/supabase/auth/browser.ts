import { createBrowserClient } from '@supabase/ssr';

import { supabaseAuthEnv } from './config';

/**
 * Browser-klienten. Sessionen ligger i cookies (ikke localStorage), så serveren
 * kan læse den med — det er hele pointen i @supabase/ssr.
 *
 * Portalens login går bevidst gennem en server action og ikke herigennem:
 * admin-tjekket SKAL ske server-side. Klienten er her, fordi mønsteret
 * kræver alle tre (browser, server component, route handler), og fordi
 * klientkode, der skal kende sin egen session, ellers ville friste til at
 * genbruge en server-klient.
 */
export function createSupabaseBrowserClient() {
  const { url, publishableKey } = supabaseAuthEnv();
  return createBrowserClient(url, publishableKey);
}
