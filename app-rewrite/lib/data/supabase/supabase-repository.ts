import { createHash, randomUUID } from 'node:crypto';

import { ARCHIVE_BUCKET, supabaseAdmin } from '@/lib/supabase/server';

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
import {
  ARCHIVE_COLUMNS,
  archiveStoragePath,
  deliveredContentType,
  isUuid,
  ORGANISATION_COLUMNS,
  storedContentType,
  TABLES,
  toArchiveEntry,
  toOrganisation,
  toStoredFileLocation,
  toUser,
  USER_COLUMNS,
} from './mapping';

/**
 * ============================================================================
 * SUPABASE-IMPLEMENTERINGEN AF DATALAGET — SERVER-SIDE ONLY
 * ============================================================================
 * Erstatter JSON-implementeringen. Samme interface, samme fejlklasser, samme
 * regler fra POC'en (virksomheds-scoping, arts-håndtering, filnavne).
 *
 * Ingen tavse fejl: hvert Supabase-kald tjekkes, og en fejl bliver en
 * DataError/DataMissingError/DataAccessError med Supabase' egen tekst i.
 * Der returneres aldrig en tom liste eller et 0, fordi et kald gik galt.
 *
 * Filer ligger i bucketen portal-arkiv; rækker i portal.archive_entries.
 * Der findes ingen transaktion på tværs af de to, så rækkefølgen er valgt så
 * en halv tilstand altid kan rulles tilbage — se createArchiveEntry og
 * deleteArchiveEntry.
 * ============================================================================
 */

/** Levetid på de signerede URL'er. Kun serveren bruger dem, og kun med det samme. */
const SIGNED_URL_TTL_SECONDS = 60;

interface SupabaseFailure {
  message: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
}

/** Oversætter et fejlet kald til en synlig fejl med et handlingsanvisende hint. */
function supabaseFailed(what: string, error: SupabaseFailure | null): never {
  if (error?.code === 'PGRST106') {
    throw new DataError(
      `${what} mislykkedes: Supabase udstiller ikke schemaet "portal" over API'et. ` +
        'Tilføj portal under Settings → API → Exposed schemas i projektet.',
      { cause: error },
    );
  }
  if (error?.code === '42P01') {
    throw new DataError(
      `${what} mislykkedes: portal-tabellerne findes ikke. Kør migrationerne i ` +
        'supabase-migrations-til-hovedrepo/ i den angivne rækkefølge.',
      { cause: error },
    );
  }
  if (error?.code === '23505') {
    throw new DataError(`${what} mislykkedes: posten findes allerede. ${error.message}`, {
      cause: error,
    });
  }
  if (error?.code === '23503') {
    throw new DataError(
      `${what} mislykkedes: der peges på en virksomhed eller bruger, som ikke findes. ${error.message}`,
      { cause: error },
    );
  }
  const code = error?.code ? ` (kode ${error.code})` : '';
  throw new DataError(`${what} mislykkedes i Supabase${code}: ${error?.message ?? 'ukendt fejl'}`, {
    cause: error,
  });
}

function looksMissing(error: SupabaseFailure | null): boolean {
  const message = error?.message ?? '';
  return /not[\s_]?found|does not exist|Object not found/i.test(message);
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Samme regel som POC'en: en admin ser alle virksomheder, alle andre kun sin egen. */
function maySee(entry: { org: string }, viewer: { org: string; rolle: UserRole }): boolean {
  return viewer.rolle === 'admin' || entry.org === viewer.org;
}

/**
 * En scoping-nøgle, der ikke er et rigtigt id, ville blive et kryptisk
 * Postgres-22P02-brøl. Sig det tydeligt i stedet.
 */
function requireOrgId(viewer: { org: string; rolle: UserRole }): string {
  if (!isUuid(viewer.org)) {
    throw new DataError(
      `Brugerens virksomheds-id (${viewer.org}) er ikke et Supabase-id. ` +
        'Kør seed-scriptet, eller ret MOCK_USER_ID til en bruger, der findes i portal-schemaet.',
    );
  }
  return viewer.org;
}

export function createSupabaseRepository(): JobmatchRepository {
  const client = () => supabaseAdmin();

  async function organisationsByIds(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const { data, error } = await client()
      .from(TABLES.organisations)
      .select(ORGANISATION_COLUMNS)
      .in('id', ids);
    if (error) supabaseFailed('Opslag af virksomhedsnavne', error);
    if (!Array.isArray(data)) throw new DataCorruptError('Virksomhedslisten kom ikke som en liste.');
    return new Map(data.map((raw) => {
      const organisation = toOrganisation(raw);
      return [organisation.id, organisation.navn];
    }));
  }

  async function loadEntryRow(id: string): Promise<Record<string, unknown> | null> {
    const { data, error } = await client()
      .from(TABLES.archiveEntries)
      .select(ARCHIVE_COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (error) supabaseFailed(`Opslag af arkivposten ${id}`, error);
    return (data as Record<string, unknown> | null) ?? null;
  }

  return {
    // ------------------------------------------------------------ organisations

    async listOrganisations(): Promise<Organisation[]> {
      const { data, error } = await client()
        .from(TABLES.organisations)
        .select(ORGANISATION_COLUMNS)
        .order('created_at', { ascending: true });
      if (error) supabaseFailed('Hentning af virksomheder', error);
      if (!Array.isArray(data)) throw new DataCorruptError('Virksomhedslisten kom ikke som en liste.');
      return data.map(toOrganisation);
    },

    async getOrganisation(id: string): Promise<Organisation | null> {
      // Et id, der ikke er et uuid, kan ikke findes. Samme svar som JSON-
      // implementeringen gav: null, ikke en fejl.
      if (!isUuid(id)) return null;
      const { data, error } = await client()
        .from(TABLES.organisations)
        .select(ORGANISATION_COLUMNS)
        .eq('id', id)
        .maybeSingle();
      if (error) supabaseFailed(`Opslag af virksomheden ${id}`, error);
      return data ? toOrganisation(data) : null;
    },

    async createOrganisation(navn: string): Promise<Organisation> {
      const trimmed = navn.trim();
      if (trimmed === '') throw new DataError('Virksomhedens navn må ikke være tomt.');
      const { data, error } = await client()
        .from(TABLES.organisations)
        .insert({ name: trimmed })
        .select(ORGANISATION_COLUMNS)
        .single();
      if (error) supabaseFailed(`Oprettelse af virksomheden ${trimmed}`, error);
      return toOrganisation(data);
    },

    // -------------------------------------------------------------------- users

    async listUsers(): Promise<User[]> {
      const { data, error } = await client()
        .from(TABLES.users)
        .select(USER_COLUMNS)
        .order('created_at', { ascending: true });
      if (error) supabaseFailed('Hentning af brugere', error);
      if (!Array.isArray(data)) throw new DataCorruptError('Brugerlisten kom ikke som en liste.');
      return data.map(toUser);
    },

    async getUser(id: string): Promise<User | null> {
      if (!isUuid(id)) return null;
      const { data, error } = await client()
        .from(TABLES.users)
        .select(USER_COLUMNS)
        .eq('id', id)
        .maybeSingle();
      if (error) supabaseFailed(`Opslag af brugeren ${id}`, error);
      return data ? toUser(data) : null;
    },

    async findUserByEmail(email: string): Promise<User | null> {
      // Kolonnen har en constraint på lower(email), så rækker er altid små
      // bogstaver, og et lowercase-opslag er det samme som POC'ens
      // case-insensitive sammenligning.
      const needle = email.trim().toLowerCase();
      if (needle === '') return null;
      const { data, error } = await client()
        .from(TABLES.users)
        .select(USER_COLUMNS)
        .eq('email', needle)
        .maybeSingle();
      if (error) supabaseFailed(`Opslag af brugeren ${needle}`, error);
      return data ? toUser(data) : null;
    },

    async createUser({ navn, email, org, rolle }): Promise<User> {
      if (!isUuid(org)) {
        throw new DataError(`Virksomheds-id'et ${org} er ikke et Supabase-id.`);
      }
      const { data, error } = await client()
        .from(TABLES.users)
        .insert({
          name: navn.trim(),
          email: email.trim().toLowerCase(),
          organisation_id: org,
          role: rolle,
        })
        .select(USER_COLUMNS)
        .single();
      if (error) supabaseFailed(`Oprettelse af brugeren ${email}`, error);
      return toUser(data);
    },

    async setUserBlocked(id: string, spaerret: boolean): Promise<User> {
      if (!isUuid(id)) throw new DataMissingError(`Brugeren ${id} blev ikke fundet.`);
      const { data, error } = await client()
        .from(TABLES.users)
        .update({ blocked: spaerret })
        .eq('id', id)
        .select(USER_COLUMNS)
        .maybeSingle();
      if (error) supabaseFailed(`Opdatering af brugeren ${id}`, error);
      if (!data) throw new DataMissingError(`Brugeren ${id} blev ikke fundet.`);
      return toUser(data);
    },

    // ------------------------------------------------------------------ archive

    async listArchiveEntries(viewer): Promise<ArchiveEntryWithOrg[]> {
      let query = client()
        .from(TABLES.archiveEntries)
        .select(ARCHIVE_COLUMNS)
        .order('case_date', { ascending: false })
        .order('created_at', { ascending: false });
      // Virksomheds-scoping i selve forespørgslen: en bruger får aldrig en
      // anden virksomheds rækker ud af databasen.
      if (viewer.rolle !== 'admin') query = query.eq('organisation_id', requireOrgId(viewer));

      const { data, error } = await query;
      if (error) supabaseFailed('Hentning af arkivet', error);
      if (!Array.isArray(data)) throw new DataCorruptError('Arkivlisten kom ikke som en liste.');

      const entries = data.map(toArchiveEntry);
      const names = await organisationsByIds([...new Set(entries.map((entry) => entry.org))]);
      return entries.map<ArchiveEntryWithOrg>((entry) => ({
        ...entry,
        // Samme fallback-tekst som POC'ens a_orgNavn().
        orgNavn: names.get(entry.org) ?? 'Ukendt virksomhed',
      }));
    },

    async getArchiveEntry(id, viewer): Promise<ArchiveEntry | null> {
      if (!isUuid(id)) return null;
      const raw = await loadEntryRow(id);
      if (!raw) return null;
      const entry = toArchiveEntry(raw);
      // Findes, men ikke for denne bruger: null, præcis som arkiv.php svarede.
      if (!maySee(entry, viewer)) return null;
      return entry;
    },

    /**
     * Rækkefølgen er valgt, så der aldrig står en halv post tilbage:
     *
     *   1. id genereres her, så stien er kendt før noget skrives
     *   2. filen uploades med upsert: false (kan ikke overskrive en anden fil)
     *   3. rækken indsættes med samme id
     *   4. fejler 3, fjernes filen igen (kompensation)
     *
     * En forældreløs fil er usynlig for brugeren og bliver ryddet op i trin 4.
     * En række uden fil ville derimod være en SYNLIG post med kandidatnavn og
     * et dødt download — derfor er filen først. Fejler oprydningen også, siges
     * det højt med stien i beskeden; intet forsvinder i stilhed.
     */
    async createArchiveEntry(input): Promise<ArchiveEntry> {
      if (!isUuid(input.org)) {
        throw new DataError(`Virksomheds-id'et ${input.org} er ikke et Supabase-id.`);
      }
      const id = randomUUID();
      const path = archiveStoragePath(input.org, id, input.art);
      const contentType = storedContentType(input.art);

      const upload = await client()
        .storage.from(ARCHIVE_BUCKET)
        .upload(path, new Blob([new Uint8Array(input.bytes)], { type: contentType }), {
          contentType,
          upsert: false,
        });
      if (upload.error) supabaseFailed(`Upload af filen til ${path}`, upload.error);

      const { data, error } = await client()
        .from(TABLES.archiveEntries)
        .insert({
          id,
          organisation_id: input.org,
          created_by_user_id: input.brugerId ?? null,
          created_by_name: input.bruger,
          kind: input.art,
          candidate_name: input.navn,
          job_title: input.stilling,
          case_date: input.dato,
          note: input.note,
          original_filename: input.filnavn,
          byte_size: input.bytes.byteLength,
          content_type: contentType,
          storage_path: path,
          checksum_sha256: sha256(input.bytes),
        })
        .select(ARCHIVE_COLUMNS)
        .single();

      if (error) {
        const cleanup = await client().storage.from(ARCHIVE_BUCKET).remove([path]);
        if (cleanup.error) {
          throw new DataError(
            `Arkivposten kunne ikke gemmes (${error.message}), og den uploadede fil ` +
              `${path} kunne heller ikke fjernes igen (${cleanup.error.message}). ` +
              'Filen ligger nu i portal-arkiv uden en post og skal slettes manuelt.',
            { cause: error },
          );
        }
        supabaseFailed('Gemning af arkivposten', error);
      }
      return toArchiveEntry(data);
    },

    /**
     * Filen først, derefter rækken.
     *
     * Filen er de persondata, privatlivspolitikken lover at slette; en
     * efterladt række er metadata, som appen i forvejen råber højt om
     * ("Filen bag arkivposten findes ikke længere"), og som et nyt forsøg
     * fjerner. Modsat rækkefølge ville kunne efterlade PDF'en liggende efter en
     * post, brugeren har set forsvinde.
     */
    async deleteArchiveEntry(id, viewer): Promise<void> {
      if (!isUuid(id)) throw new DataMissingError(`Arkivposten ${id} blev ikke fundet.`);
      const raw = await loadEntryRow(id);
      if (!raw) throw new DataMissingError(`Arkivposten ${id} blev ikke fundet.`);
      const entry = toArchiveEntry(raw);
      if (!maySee(entry, viewer)) {
        throw new DataAccessError('Du har ikke adgang til den arkivpost.');
      }
      const { path } = toStoredFileLocation(raw);

      const removed = await client().storage.from(ARCHIVE_BUCKET).remove([path]);
      // En allerede fjernet fil er ikke en fejl i Storage-API'et, så et svar
      // uden error dækker også "filen var væk i forvejen".
      if (removed.error) supabaseFailed(`Sletning af filen ${path}`, removed.error);

      const { error } = await client().from(TABLES.archiveEntries).delete().eq('id', id);
      if (error) {
        throw new DataError(
          `Filen bag arkivposten ${id} er slettet, men selve posten kunne ikke fjernes ` +
            `(${error.message}). Prøv at slette posten igen.`,
          { cause: error },
        );
      }
    },

    /**
     * Hentes via en kortlivet signeret URL, som aldrig forlader serveren:
     * interfacet leverer bytes, så route handleren kan beholde POC'ens
     * filnavn og Content-Disposition uændret.
     */
    async readArchiveFile(entry): Promise<StoredFile> {
      const raw = await loadEntryRow(entry.id);
      if (!raw) {
        throw new DataMissingError(`Arkivposten ${entry.id} findes ikke længere.`);
      }
      const { path } = toStoredFileLocation(raw);

      const signed = await client()
        .storage.from(ARCHIVE_BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
      if (signed.error || !signed.data?.signedUrl) {
        if (looksMissing(signed.error)) {
          throw new DataMissingError(`Filen bag arkivposten ${entry.id} findes ikke længere.`, {
            cause: signed.error,
          });
        }
        supabaseFailed(`Signering af URL til ${path}`, signed.error);
      }

      const response = await fetch(signed.data.signedUrl, { cache: 'no-store' });
      if (!response.ok) {
        if (response.status === 400 || response.status === 404) {
          throw new DataMissingError(`Filen bag arkivposten ${entry.id} findes ikke længere.`);
        }
        throw new DataError(
          `Filen bag arkivposten ${entry.id} kunne ikke hentes fra Supabase Storage ` +
            `(HTTP ${response.status}).`,
        );
      }
      return {
        bytes: new Uint8Array(await response.arrayBuffer()),
        contentType: deliveredContentType(entry.art),
      };
    },
  };
}
