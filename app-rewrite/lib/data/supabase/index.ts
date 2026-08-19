import type { JobmatchRepository } from '../repository';

import { createSupabaseRepository } from './supabase-repository';

/**
 * Den ene, delte Supabase-implementering.
 *
 * API-routes under app/api/portal/ bruger DENNE, aldrig `repository` fra
 * lib/data — ellers ville en route i PORTAL_DATA_MODE=api kalde sig selv i ring
 * (route → datalag → route). Datalaget vælger implementering i
 * lib/data/index.ts; routes er altid den direkte vej til Supabase.
 */
export const supabaseRepository: JobmatchRepository = createSupabaseRepository();

export { createSupabaseRepository } from './supabase-repository';
