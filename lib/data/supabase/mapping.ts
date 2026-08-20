import { DataCorruptError } from '../repository';
import type {
  ArchiveEntry,
  ArchiveKind,
  Organisation,
  User,
  UserRole,
} from '../types';

/**
 * Oversættelsen mellem portal-schemaets engelske kolonner og datalagets danske
 * TS-nøgler. ÉT sted, så resten af koden aldrig ser en kolonnenavn.
 *
 * | TS (lib/data/types.ts)          | portal-kolonne                     |
 * |---------------------------------|------------------------------------|
 * | Organisation.navn               | organisations.name                 |
 * | Organisation.oprettet (unix s)  | organisations.created_at (tstz)    |
 * | User.org                        | users.organisation_id              |
 * | User.rolle                      | users.role                         |
 * | User.spaerret                   | users.blocked                      |
 * | User.sidstSet (0 = aldrig)      | users.last_seen_at (null)          |
 * | ArchiveEntry.org                | archive_entries.organisation_id    |
 * | ArchiveEntry.bruger (visning)   | archive_entries.created_by_name    |
 * | (ejerskab, ikke i TS-typen)     | archive_entries.created_by_user_id |
 * | ArchiveEntry.art                | archive_entries.kind               |
 * | ArchiveEntry.navn               | archive_entries.candidate_name     |
 * | ArchiveEntry.stilling           | archive_entries.job_title          |
 * | ArchiveEntry.dato               | archive_entries.case_date (date)   |
 * | ArchiveEntry.filnavn            | archive_entries.original_filename  |
 * | ArchiveEntry.storrelse          | archive_entries.byte_size          |
 * | ArchiveEntry.tilfojet (unix s)  | archive_entries.created_at (tstz)  |
 *
 * Rækker valideres lige så højt som JSON-implementeringen validerede filer: en
 * uventet form giver DataCorruptError, aldrig en tom liste eller et 0.
 */

export const TABLES = {
  organisations: 'organisations',
  users: 'users',
  archiveEntries: 'archive_entries',
} as const;

/** Alle kolonner, eksplicit, så en skemaændring ses her og ikke som en gætteleg. */
export const ORGANISATION_COLUMNS =
  'id, legacy_id, name, default_retention_days, created_at, updated_at';
export const USER_COLUMNS =
  'id, legacy_id, organisation_id, name, email, role, blocked, last_seen_at, created_at, updated_at';
export const ARCHIVE_COLUMNS =
  'id, legacy_id, organisation_id, created_by_user_id, created_by_name, kind, candidate_name, ' +
  'job_title, case_date, note, original_filename, byte_size, content_type, storage_path, ' +
  'checksum_sha256, retention_until, created_at, updated_at';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Postgres afviser en ikke-uuid med en kryptisk 22P02-fejl; vi tjekker selv. */
export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

// ---------------------------------------------------------------- validation

function row(value: unknown, table: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new DataCorruptError(`portal.${table}: en række kom ikke tilbage som et objekt.`);
  }
  return value as Record<string, unknown>;
}

function text(source: Record<string, unknown>, key: string, table: string): string {
  const value = source[key];
  if (typeof value !== 'string') {
    throw new DataCorruptError(`portal.${table}: rækken mangler tekstkolonnen "${key}".`);
  }
  return value;
}

function optionalText(source: Record<string, unknown>, key: string, table: string): string {
  const value = source[key];
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') {
    throw new DataCorruptError(`portal.${table}: kolonnen "${key}" er ikke tekst.`);
  }
  return value;
}

function integer(source: Record<string, unknown>, key: string, table: string): number {
  const value = source[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  // bigint-kolonner kan komme som streng fra PostgREST.
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return Number(value);
  throw new DataCorruptError(`portal.${table}: kolonnen "${key}" er ikke et tal.`);
}

function bool(source: Record<string, unknown>, key: string, table: string): boolean {
  const value = source[key];
  if (typeof value !== 'boolean') {
    throw new DataCorruptError(`portal.${table}: kolonnen "${key}" er ikke en boolean.`);
  }
  return value;
}

/** timestamptz → unix sekunder, som POC'ens felter var. */
function seconds(source: Record<string, unknown>, key: string, table: string): number {
  const value = text(source, key, table);
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new DataCorruptError(`portal.${table}: kolonnen "${key}" er ikke et tidspunkt: ${value}.`);
  }
  return Math.floor(parsed / 1000);
}

/** timestamptz eller null → unix sekunder, hvor null bliver 0 (POC: sidstSet). */
function optionalSeconds(source: Record<string, unknown>, key: string, table: string): number {
  const value = source[key];
  if (value === undefined || value === null) return 0;
  return seconds(source, key, table);
}

/** date → 'YYYY-MM-DD'. PostgREST leverer allerede det format. */
function dateOnly(source: Record<string, unknown>, key: string, table: string): string {
  const value = text(source, key, table);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new DataCorruptError(`portal.${table}: kolonnen "${key}" er ikke en dato: ${value}.`);
  }
  return value;
}

function role(source: Record<string, unknown>, table: string): UserRole {
  const value = source['role'];
  if (value === 'admin') return 'admin';
  // Samme tolerance som JSON-implementeringen: POC'ens døde 'orgadmin' havde
  // præcis en brugers rettigheder. Constraint'en i portal.users tillader den
  // ikke, så dette er kun et sikkerhedsnet.
  if (value === 'bruger' || value === 'orgadmin') return 'bruger';
  throw new DataCorruptError(`portal.${table}: ukendt rolle: ${String(value)}.`);
}

function kind(source: Record<string, unknown>, table: string): ArchiveKind {
  const value = source['kind'];
  if (value === 'sag') return 'sag';
  if (value === 'rapport') return 'rapport';
  throw new DataCorruptError(`portal.${table}: ukendt art: ${String(value)}.`);
}

// ---------------------------------------------------------------- converters

export function toOrganisation(value: unknown): Organisation {
  const table = TABLES.organisations;
  const source = row(value, table);
  return {
    id: text(source, 'id', table),
    navn: text(source, 'name', table),
    oprettet: seconds(source, 'created_at', table),
  };
}

export function toUser(value: unknown): User {
  const table = TABLES.users;
  const source = row(value, table);
  return {
    id: text(source, 'id', table),
    navn: text(source, 'name', table),
    email: text(source, 'email', table),
    org: text(source, 'organisation_id', table),
    rolle: role(source, table),
    oprettet: seconds(source, 'created_at', table),
    sidstSet: optionalSeconds(source, 'last_seen_at', table),
    spaerret: bool(source, 'blocked', table),
  };
}

export function toArchiveEntry(value: unknown): ArchiveEntry {
  const table = TABLES.archiveEntries;
  const source = row(value, table);
  return {
    id: text(source, 'id', table),
    org: text(source, 'organisation_id', table),
    bruger: optionalText(source, 'created_by_name', table),
    art: kind(source, table),
    navn: text(source, 'candidate_name', table),
    stilling: optionalText(source, 'job_title', table),
    dato: dateOnly(source, 'case_date', table),
    note: optionalText(source, 'note', table),
    filnavn: optionalText(source, 'original_filename', table),
    storrelse: integer(source, 'byte_size', table),
    tilfojet: seconds(source, 'created_at', table),
  };
}

/** Kolonnerne bag en fil, som readArchiveFile har brug for. */
export function toStoredFileLocation(value: unknown): { path: string; contentType: string } {
  const table = TABLES.archiveEntries;
  const source = row(value, table);
  return {
    path: text(source, 'storage_path', table),
    contentType: text(source, 'content_type', table),
  };
}

// ---------------------------------------------------------------- storage

/**
 * org/<organisation_id>/<entry_id>.<pdf|json>
 *
 * Virksomheden ligger i stien, så en fremtidig storage-policy kan matche på
 * mappenavnet, og filnavnet er entry-id'et — ingen kandidatnavne i stier.
 */
export function archiveStoragePath(organisationId: string, entryId: string, art: ArchiveKind): string {
  return `org/${organisationId}/${entryId}.${art === 'sag' ? 'json' : 'pdf'}`;
}

/** Kolonnen content_type. Constraint'en i basen kræver præcis disse to. */
export function storedContentType(art: ArchiveKind): 'application/pdf' | 'application/json' {
  return art === 'sag' ? 'application/json' : 'application/pdf';
}

/** Det StoredFile.contentType appen altid har set — inkl. charset på JSON. */
export function deliveredContentType(art: ArchiveKind): string {
  return art === 'sag' ? 'application/json; charset=utf-8' : 'application/pdf';
}
