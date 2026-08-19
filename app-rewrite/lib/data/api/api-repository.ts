import {
  DataAccessError,
  DataCorruptError,
  DataError,
  DataMissingError,
  type JobmatchRepository,
} from '../repository';
import type {
  ArchiveEntry,
  ArchiveEntryWithOrg,
  Organisation,
  StoredFile,
  User,
  UserRole,
} from '../types';
import { deliveredContentType } from '../supabase/mapping';

/**
 * ============================================================================
 * HTTP-IMPLEMENTERINGEN AF DATALAGET — KALDER APP'ENS EGNE API-ROUTES
 * ============================================================================
 * Samme interface, men al dataadgang går over /api/portal/* i stedet for direkte
 * til Supabase. Vælges med PORTAL_DATA_MODE=api (se lib/data/index.ts).
 *
 * Default er den direkte implementering, fordi datalaget i forvejen kører
 * server-side: et fetch mod egen origin er et ekstra hop uden sikkerhedsgevinst.
 * Denne findes, fordi routes er den vej fremtidige klienter (og skive 2's
 * rigtige auth) skal ind, og fordi den holder routes ærlige: kører portalen i
 * api-mode, er hele appen en test af dem.
 *
 * Bruger-konteksten sendes IKKE med som data: hver route slår selv dev-brugeren
 * op server-side, og virksomheds-scopingen sker dér. Viewer-parametrene bruges
 * kun som et kryds-tjek i headere — en uenighed giver en fejl, aldrig bredere
 * adgang.
 *
 * Fejl overføres med både tekst og klasse (feltet `kode`), så
 * DataMissingError/DataAccessError/DataCorruptError ikke kollapser til én
 * generisk fejl på vejen gennem HTTP.
 * ============================================================================
 */

interface Viewer {
  org: string;
  rolle: UserRole;
}

function baseUrl(): string {
  const configured = process.env.PORTAL_API_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  const vercelHost = process.env.VERCEL_URL?.trim();
  if (vercelHost) return `https://${vercelHost}`;
  const port = process.env.PORT?.trim() || '3000';
  return `http://127.0.0.1:${port}`;
}

function headers(viewer?: Viewer): Record<string, string> {
  const result: Record<string, string> = { accept: 'application/json' };
  const token = process.env.PORTAL_API_TOKEN?.trim();
  if (token) result['x-portal-api-token'] = token;
  if (viewer) {
    result['x-portal-viewer-org'] = viewer.org;
    result['x-portal-viewer-rolle'] = viewer.rolle;
  }
  return result;
}

/** Genskaber datalagets fejlklasse ud fra svaret. Ingen fejl bliver til null. */
async function fail(response: Response, what: string): Promise<never> {
  let text = '';
  let kode = '';
  try {
    const body = (await response.json()) as unknown;
    if (typeof body === 'object' && body !== null) {
      const record = body as Record<string, unknown>;
      if (typeof record['fejl'] === 'string') text = record['fejl'];
      if (typeof record['kode'] === 'string') kode = record['kode'];
    }
  } catch {
    // Ikke JSON — så bruger vi statuskoden alene.
  }
  const message = text !== '' ? text : `${what} fejlede (HTTP ${response.status}).`;
  if (kode === 'DataMissingError' || response.status === 404) throw new DataMissingError(message);
  if (kode === 'DataAccessError' || response.status === 403) throw new DataAccessError(message);
  if (kode === 'DataCorruptError') throw new DataCorruptError(message);
  throw new DataError(message);
}

async function requestJson(
  path: string,
  what: string,
  init: RequestInit & { viewer?: Viewer } = {},
): Promise<Record<string, unknown>> {
  const { viewer, ...rest } = init;
  let response: Response;
  try {
    response = await fetch(`${baseUrl()}${path}`, {
      ...rest,
      headers: { ...headers(viewer), ...(rest.headers as Record<string, string> | undefined) },
      cache: 'no-store',
    });
  } catch (cause) {
    throw new DataError(
      `${what} kunne ikke nå portalens API på ${baseUrl()}. ` +
        'Sæt PORTAL_API_BASE_URL, eller brug PORTAL_DATA_MODE=direct.',
      { cause },
    );
  }
  if (!response.ok) await fail(response, what);
  if (response.status === 204) return {};
  let body: unknown;
  try {
    body = await response.json();
  } catch (cause) {
    throw new DataCorruptError(`${what} svarede ikke med gyldig JSON.`, { cause });
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new DataCorruptError(`${what} svarede ikke med et JSON-objekt.`);
  }
  return body as Record<string, unknown>;
}

function list<T>(body: Record<string, unknown>, key: string, what: string): T[] {
  const value = body[key];
  if (!Array.isArray(value)) throw new DataCorruptError(`${what} svarede ikke med en liste.`);
  return value as T[];
}

function one<T>(body: Record<string, unknown>, key: string, what: string): T {
  const value = body[key];
  if (typeof value !== 'object' || value === null) {
    throw new DataCorruptError(`${what} svarede ikke med en post.`);
  }
  return value as T;
}

function orNull<T>(body: Record<string, unknown>, key: string, what: string): T | null {
  const value = body[key];
  if (value === null || value === undefined) return null;
  return one<T>(body, key, what);
}

export function createApiRepository(): JobmatchRepository {
  return {
    // ------------------------------------------------------------ organisations

    async listOrganisations(): Promise<Organisation[]> {
      const what = 'Hentning af virksomheder';
      return list<Organisation>(await requestJson('/api/portal/organisations/', what), 'virksomheder', what);
    },

    async getOrganisation(id: string): Promise<Organisation | null> {
      const what = `Opslag af virksomheden ${id}`;
      const body = await requestJson(`/api/portal/organisations/${encodeURIComponent(id)}/`, what);
      return orNull<Organisation>(body, 'virksomhed', what);
    },

    async createOrganisation(navn: string): Promise<Organisation> {
      const what = 'Oprettelse af virksomhed';
      const body = await requestJson('/api/portal/organisations/', what, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ navn }),
      });
      return one<Organisation>(body, 'virksomhed', what);
    },

    // -------------------------------------------------------------------- users

    async listUsers(): Promise<User[]> {
      const what = 'Hentning af brugere';
      return list<User>(await requestJson('/api/portal/users/', what), 'brugere', what);
    },

    async getUser(id: string): Promise<User | null> {
      const what = `Opslag af brugeren ${id}`;
      const body = await requestJson(`/api/portal/users/${encodeURIComponent(id)}/`, what);
      return orNull<User>(body, 'bruger', what);
    },

    async findUserByEmail(email: string): Promise<User | null> {
      const what = `Opslag af brugeren ${email}`;
      const body = await requestJson(`/api/portal/users/?email=${encodeURIComponent(email)}`, what);
      return orNull<User>(body, 'bruger', what);
    },

    async createUser({ navn, email, org, rolle }): Promise<User> {
      const what = `Oprettelse af brugeren ${email}`;
      const body = await requestJson('/api/portal/users/', what, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ navn, email, org, rolle }),
      });
      return one<User>(body, 'bruger', what);
    },

    async setUserBlocked(id: string, spaerret: boolean): Promise<User> {
      const what = `Opdatering af brugeren ${id}`;
      const body = await requestJson(`/api/portal/users/${encodeURIComponent(id)}/blocked/`, what, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ spaerret }),
      });
      return one<User>(body, 'bruger', what);
    },

    // ------------------------------------------------------------------ archive

    async listArchiveEntries(viewer): Promise<ArchiveEntryWithOrg[]> {
      const what = 'Hentning af arkivet';
      const body = await requestJson('/api/portal/archive/', what, { viewer });
      return list<ArchiveEntryWithOrg>(body, 'filer', what);
    },

    async getArchiveEntry(id, viewer): Promise<ArchiveEntry | null> {
      const what = `Opslag af arkivposten ${id}`;
      const body = await requestJson(`/api/portal/archive/${encodeURIComponent(id)}/`, what, {
        viewer,
      });
      return orNull<ArchiveEntry>(body, 'post', what);
    },

    async createArchiveEntry(input): Promise<ArchiveEntry> {
      const what = 'Gemning af arkivposten';
      const form = new FormData();
      form.set('art', input.art);
      form.set('navn', input.navn);
      form.set('stilling', input.stilling);
      form.set('dato', input.dato);
      form.set('note', input.note);
      form.set(
        'fil',
        new Blob([new Uint8Array(input.bytes)], { type: deliveredContentType(input.art) }),
        input.filnavn || (input.art === 'sag' ? 'sag.json' : 'rapport.pdf'),
      );
      // Ingen viewer-header her: routen bruger sin egen dev-brugerkontekst som
      // ejer og virksomhed, så en klient ikke kan skrive ind i en anden
      // virksomheds arkiv ved at sende et andet org-id.
      const body = await requestJson('/api/portal/archive/', what, {
        method: 'POST',
        body: form,
      });
      return one<ArchiveEntry>(body, 'post', what);
    },

    async deleteArchiveEntry(id, viewer): Promise<void> {
      const what = `Sletning af arkivposten ${id}`;
      await requestJson(`/api/portal/archive/${encodeURIComponent(id)}/`, what, {
        method: 'DELETE',
        viewer,
      });
    },

    async readArchiveFile(entry): Promise<StoredFile> {
      const what = `Hentning af filen bag arkivposten ${entry.id}`;
      const url = `${baseUrl()}/api/portal/archive/${encodeURIComponent(entry.id)}/file/`;
      let response: Response;
      try {
        response = await fetch(url, { headers: headers(), cache: 'no-store' });
      } catch (cause) {
        throw new DataError(`${what} kunne ikke nå portalens API på ${baseUrl()}.`, { cause });
      }
      if (!response.ok) await fail(response, what);
      return {
        bytes: new Uint8Array(await response.arrayBuffer()),
        contentType: deliveredContentType(entry.art),
      };
    },
  };
}
