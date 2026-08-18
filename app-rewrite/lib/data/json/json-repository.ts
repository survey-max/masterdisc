import { randomBytes } from 'node:crypto';
import { readFile, writeFile, unlink, mkdir } from 'node:fs/promises';
import path from 'node:path';

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
  ArchiveKind,
  Organisation,
  User,
  UserRole,
} from '../types';

/**
 * ============================================================================
 * MIDLERTIDIG IMPLEMENTERING — UDSKIFTES I FASE 3
 * ============================================================================
 * Reads and writes the POC's JSON file structure (jobmatch-filer/) so the
 * portal can run locally on realistic data. Same files, same field names, same
 * pretty-printed output as PHP's a_skriv().
 *
 * It is a development stand-in, not a database:
 *   - no transactions, no locking (PHP used LOCK_EX; here two concurrent
 *     writes can still lose one another)
 *   - the filesystem is read-only on Vercel, so every write fails there
 *   - uploaded PDFs and saved cases land next to the JSON files
 *
 * In fase 3 this file is deleted and replaced by an API-backed implementation
 * of JobmatchRepository. Nothing outside lib/data/ may depend on it.
 *
 * Data directory: JOBMATCH_DATA_DIR, default ./data/example (anonymous sample
 * records). Point it at a directory outside the repo for real data.
 * ============================================================================
 */

const FILES = {
  users: 'brugere.json',
  organisations: 'organisationer.json',
  archive: 'data.json',
} as const;

function dataDir(): string {
  const configured = process.env.JOBMATCH_DATA_DIR;
  if (configured && configured.trim() !== '') {
    return path.resolve(configured.trim());
  }
  return path.join(process.cwd(), 'data', 'example');
}

function filePath(name: string): string {
  return path.join(dataDir(), name);
}

/**
 * Reads a JSON array. Never returns an empty list as a stand-in for a problem:
 * a missing file and a corrupt file are two different, loud failures.
 */
async function readJsonArray(name: string): Promise<unknown[]> {
  const file = filePath(name);
  let raw: string;
  try {
    raw = await readFile(file, 'utf8');
  } catch (cause) {
    throw new DataMissingError(
      `Datafilen ${name} blev ikke fundet (${file}). Sæt JOBMATCH_DATA_DIR, eller opret filen.`,
      { cause },
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (cause) {
    throw new DataCorruptError(`Datafilen ${name} (${file}) er ikke gyldig JSON.`, { cause });
  }
  if (!Array.isArray(parsed)) {
    throw new DataCorruptError(`Datafilen ${name} (${file}) skal indeholde en JSON-liste.`);
  }
  return parsed;
}

async function writeJsonArray(name: string, rows: unknown[]): Promise<void> {
  const file = filePath(name);
  await mkdir(path.dirname(file), { recursive: true });
  // Same output shape as PHP's JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT.
  await writeFile(file, `${JSON.stringify(rows, null, 4)}\n`, 'utf8');
}

// ---------------------------------------------------------------- validation

function record(value: unknown, file: string, index: number): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new DataCorruptError(`${file}: post nr. ${index + 1} er ikke et objekt.`);
  }
  return value as Record<string, unknown>;
}

function str(row: Record<string, unknown>, key: string, file: string, index: number): string {
  const value = row[key];
  if (typeof value !== 'string') {
    throw new DataCorruptError(`${file}: post nr. ${index + 1} mangler tekstfeltet "${key}".`);
  }
  return value;
}

function optionalStr(row: Record<string, unknown>, key: string, file: string, index: number): string {
  const value = row[key];
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') {
    throw new DataCorruptError(`${file}: post nr. ${index + 1} har et ugyldigt "${key}"-felt.`);
  }
  return value;
}

function num(row: Record<string, unknown>, key: string, file: string, index: number): number {
  const value = row[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new DataCorruptError(`${file}: post nr. ${index + 1} mangler taltfeltet "${key}".`);
  }
  return value;
}

function optionalNum(row: Record<string, unknown>, key: string, file: string, index: number): number {
  const value = row[key];
  if (value === undefined || value === null) return 0;
  return num(row, key, file, index);
}

function role(row: Record<string, unknown>, file: string, index: number): UserRole {
  const value = row['rolle'];
  if (value === 'admin') return 'admin';
  // The POC's dead 'orgadmin' role had the rights of a plain user; existing
  // records are read as 'bruger' rather than rejected.
  if (value === 'bruger' || value === 'orgadmin') return 'bruger';
  throw new DataCorruptError(`${file}: post nr. ${index + 1} har en ukendt rolle: ${String(value)}.`);
}

function kind(row: Record<string, unknown>, file: string, index: number): ArchiveKind {
  const value = row['art'];
  // arkiv.php defaulted anything but 'sag' to 'rapport'.
  if (value === undefined || value === null || value === 'rapport') return 'rapport';
  if (value === 'sag') return 'sag';
  throw new DataCorruptError(`${file}: post nr. ${index + 1} har en ukendt art: ${String(value)}.`);
}

function toOrganisation(value: unknown, index: number): Organisation {
  const file = FILES.organisations;
  const row = record(value, file, index);
  return {
    id: str(row, 'id', file, index),
    navn: str(row, 'navn', file, index),
    oprettet: optionalNum(row, 'oprettet', file, index),
  };
}

function toUser(value: unknown, index: number): User {
  const file = FILES.users;
  const row = record(value, file, index);
  // Note: a 'hash' field in the source file is ignored on purpose — no
  // credential leaves this layer in fase 1.
  return {
    id: str(row, 'id', file, index),
    navn: str(row, 'navn', file, index),
    email: str(row, 'email', file, index),
    org: str(row, 'org', file, index),
    rolle: role(row, file, index),
    oprettet: optionalNum(row, 'oprettet', file, index),
    sidstSet: optionalNum(row, 'sidstSet', file, index),
    spaerret: row['spaerret'] === true,
  };
}

function toArchiveEntry(value: unknown, index: number): ArchiveEntry {
  const file = FILES.archive;
  const row = record(value, file, index);
  return {
    id: str(row, 'id', file, index),
    org: str(row, 'org', file, index),
    bruger: optionalStr(row, 'bruger', file, index),
    art: kind(row, file, index),
    navn: str(row, 'navn', file, index),
    stilling: optionalStr(row, 'stilling', file, index),
    dato: optionalStr(row, 'dato', file, index),
    note: optionalStr(row, 'note', file, index),
    filnavn: optionalStr(row, 'filnavn', file, index),
    storrelse: optionalNum(row, 'storrelse', file, index),
    tilfojet: optionalNum(row, 'tilfojet', file, index),
  };
}

// ---------------------------------------------------------------- helpers

/** 16 hex characters, exactly like PHP's bin2hex(random_bytes(8)). */
function newId(): string {
  return randomBytes(8).toString('hex');
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function storedFileName(id: string, art: ArchiveKind): string {
  return `${id}${art === 'sag' ? '.json' : '.pdf'}`;
}

function maySee(entry: ArchiveEntry, viewer: { org: string; rolle: UserRole }): boolean {
  return viewer.rolle === 'admin' || entry.org === viewer.org;
}

// ---------------------------------------------------------------- repository

export function createJsonRepository(): JobmatchRepository {
  async function organisations(): Promise<Organisation[]> {
    return (await readJsonArray(FILES.organisations)).map(toOrganisation);
  }

  async function users(): Promise<User[]> {
    return (await readJsonArray(FILES.users)).map(toUser);
  }

  async function archive(): Promise<ArchiveEntry[]> {
    return (await readJsonArray(FILES.archive)).map(toArchiveEntry);
  }

  return {
    listOrganisations: organisations,

    async getOrganisation(id) {
      return (await organisations()).find((o) => o.id === id) ?? null;
    },

    async createOrganisation(navn) {
      const trimmed = navn.trim();
      if (trimmed === '') throw new DataError('Virksomhedens navn må ikke være tomt.');
      const all = await organisations();
      const created: Organisation = { id: newId(), navn: trimmed, oprettet: nowSeconds() };
      await writeJsonArray(FILES.organisations, [...all, created]);
      return created;
    },

    listUsers: users,

    async getUser(id) {
      return (await users()).find((u) => u.id === id) ?? null;
    },

    async findUserByEmail(email) {
      const needle = email.trim().toLowerCase();
      return (await users()).find((u) => u.email.toLowerCase() === needle) ?? null;
    },

    async createUser({ navn, email, org, rolle }) {
      const all = await users();
      const created: User = {
        id: newId(),
        navn: navn.trim(),
        email: email.trim().toLowerCase(),
        org,
        rolle,
        oprettet: nowSeconds(),
        sidstSet: 0,
        spaerret: false,
      };
      await writeJsonArray(FILES.users, [...all, created]);
      return created;
    },

    async setUserBlocked(id, spaerret) {
      const all = await users();
      const target = all.find((u) => u.id === id);
      if (!target) throw new DataMissingError(`Brugeren ${id} blev ikke fundet.`);
      const updated: User = { ...target, spaerret };
      await writeJsonArray(
        FILES.users,
        all.map((u) => (u.id === id ? updated : u)),
      );
      return updated;
    },

    async listArchiveEntries(viewer) {
      const [entries, orgs] = await Promise.all([archive(), organisations()]);
      const orgName = new Map(orgs.map((o) => [o.id, o.navn]));
      return entries
        .filter((entry) => maySee(entry, viewer))
        .map<ArchiveEntryWithOrg>((entry) => ({
          ...entry,
          // Same fallback text as PHP's a_orgNavn().
          orgNavn: orgName.get(entry.org) ?? 'Ukendt virksomhed',
        }))
        .sort((a, b) => b.dato.localeCompare(a.dato) || b.tilfojet - a.tilfojet);
    },

    async getArchiveEntry(id, viewer) {
      const entry = (await archive()).find((e) => e.id === id);
      if (!entry || !maySee(entry, viewer)) return null;
      return entry;
    },

    async createArchiveEntry(input) {
      const entry: ArchiveEntry = {
        id: newId(),
        org: input.org,
        bruger: input.bruger,
        art: input.art,
        navn: input.navn,
        stilling: input.stilling,
        dato: input.dato,
        note: input.note,
        filnavn: input.filnavn,
        storrelse: input.bytes.byteLength,
        tilfojet: nowSeconds(),
      };
      const dir = dataDir();
      await mkdir(dir, { recursive: true });
      const target = path.join(dir, storedFileName(entry.id, entry.art));
      await writeFile(target, input.bytes);
      try {
        await writeJsonArray(FILES.archive, [...(await archive()), entry]);
      } catch (cause) {
        // The index is the source of truth: an orphan file would be invisible
        // but still hold personal data, so it goes away with the failed write.
        await unlink(target).catch(() => undefined);
        throw cause;
      }
      return entry;
    },

    async deleteArchiveEntry(id, viewer) {
      const all = await archive();
      const entry = all.find((e) => e.id === id);
      if (!entry) throw new DataMissingError(`Arkivposten ${id} blev ikke fundet.`);
      if (!maySee(entry, viewer)) {
        throw new DataAccessError('Du har ikke adgang til den arkivpost.');
      }
      await writeJsonArray(
        FILES.archive,
        all.filter((e) => e.id !== id),
      );
      await unlink(path.join(dataDir(), storedFileName(entry.id, entry.art))).catch(() => undefined);
    },

    async readArchiveFile(entry) {
      const file = path.join(dataDir(), storedFileName(entry.id, entry.art));
      try {
        const bytes = await readFile(file);
        return {
          bytes,
          contentType: entry.art === 'sag' ? 'application/json; charset=utf-8' : 'application/pdf',
        };
      } catch (cause) {
        throw new DataMissingError(`Filen bag arkivposten ${entry.id} findes ikke længere.`, {
          cause,
        });
      }
    },
  };
}
