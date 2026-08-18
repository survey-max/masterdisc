import { createJsonRepository } from './json/json-repository';
import type { JobmatchRepository } from './repository';

/**
 * The one place the implementation is chosen.
 *
 * FASE 3: swap createJsonRepository() for the API-backed implementation. Every
 * page, action and route handler already talks to the interface, so nothing
 * else has to change.
 */
export const repository: JobmatchRepository = createJsonRepository();

export {
  DataAccessError,
  DataCorruptError,
  DataError,
  DataMissingError,
  type JobmatchRepository,
} from './repository';
export type * from './types';
