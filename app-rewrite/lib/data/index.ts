import { createApiRepository } from './api/api-repository';
import type { JobmatchRepository } from './repository';
import { createSupabaseRepository } from './supabase/supabase-repository';

/**
 * The one place the implementation is chosen.
 *
 * FASE 3 / SKIVE 1: portal data lives in Supabase (schema `portal` + bucket
 * `portal-arkiv`). Two implementations satisfy the same interface:
 *
 *   PORTAL_DATA_MODE=direct  (default) — server-side Supabase calls in-process.
 *                            The data layer already runs on the server, so this
 *                            is one hop instead of two.
 *   PORTAL_DATA_MODE=api     — the same operations over the app's own
 *                            /api/portal/* routes. Slower, but it exercises the
 *                            routes end to end and is the shape a future
 *                            non-Next client would use.
 *
 * The JSON implementation in ./json is kept as a file for reference and is no
 * longer wired up anywhere: it wrote to the filesystem, which is read-only on
 * Vercel.
 */
function chooseRepository(): JobmatchRepository {
  const mode = process.env.PORTAL_DATA_MODE?.trim().toLowerCase() ?? 'direct';
  if (mode === 'api') return createApiRepository();
  if (mode === '' || mode === 'direct') return createSupabaseRepository();
  // Aldrig en tavs fallback: en stavefejl i variablen skal ses med det samme.
  throw new Error(
    `PORTAL_DATA_MODE=${mode} kendes ikke. Brug 'direct' (standard) eller 'api'.`,
  );
}

export const repository: JobmatchRepository = chooseRepository();

export {
  DataAccessError,
  DataCorruptError,
  DataError,
  DataMissingError,
  type JobmatchRepository,
} from './repository';
export type * from './types';
