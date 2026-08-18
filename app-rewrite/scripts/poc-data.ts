import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { archiveStoragePath, storedContentType } from '../lib/data/supabase/mapping';
import type { ArchiveKind, UserRole } from '../lib/data/types';

/**
 * ============================================================================
 * LÆSNING OG MAPNING AF POC'ENS JSON-FILDATABASE
 * ============================================================================
 * Bruges af TO scripts, med vilje:
 *
 *   scripts/seed-portal.ts     — anonyme eksempeldata fra data/example/ ind i
 *                                portal-schemaet
 *   scripts/legacy-dry-run.ts  — legacy-php/data/ (RIGTIGE data) mappet og
 *                                RAPPORTERET, uden at skrive noget
 *
 * De to filsæt har præcis samme struktur, så seeden kører den samme mapper, som
 * en rigtig migrering vil bruge. Går mapningen galt, opdages det på anonyme data.
 *
 * Intet i denne fil kalder nettet, og intet skriver til disk.
 * ============================================================================
 */

export interface PocOrganisation {
  id: string;
  navn: string;
  oprettet: number;
}

export interface PocUser {
  id: string;
  navn: string;
  email: string;
  org: string;
  rolle: UserRole;
  /** Rollen som den stod i filen — 'orgadmin' bliver til 'bruger'. */
  rolleIFilen: string;
  oprettet: number;
  sidstSet: number;
  spaerret: boolean;
  /** Havde posten et bcrypt-'hash'-felt? Det migreres ALDRIG. */
  harHash: boolean;
}

export interface PocEntry {
  id: string;
  org: string;
  bruger: string;
  art: ArchiveKind;
  navn: string;
  stilling: string;
  dato: string;
  note: string;
  filnavn: string;
  storrelse: number;
  tilfojet: number;
}

export type IssueLevel = 'fejl' | 'note';

export interface Issue {
  niveau: IssueLevel;
  tabel: 'organisations' | 'users' | 'archive_entries' | 'filer';
  /** POC-id'et, ikke persondata. */
  id: string;
  besked: string;
}

export interface PocData {
  organisations: PocOrganisation[];
  users: PocUser[];
  entries: PocEntry[];
  /** Filer fundet på disken, nøglet på POC-id. */
  filer: Map<string, { navn: string; storrelse: number }>;
  issues: Issue[];
}

const MAX_BYTES = 25 * 1024 * 1024;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ------------------------------------------------------------------ id'er

/**
 * Samme POC-id giver altid samme uuid (uuid v5-lignende: sha1 over et navnerum).
 * Derfor kan både seed og en rigtig migrering køres igen uden at lave dubletter,
 * og relationer kan mappes uden at slå op i basen først.
 */
export function deterministicUuid(namespace: string, legacyId: string): string {
  const bytes = createHash('sha1').update(`portal:${namespace}:${legacyId}`).digest().subarray(0, 16);
  // Version 5, RFC 4122-variant.
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

export function organisationUuid(legacyId: string): string {
  return deterministicUuid('organisation', legacyId);
}
export function userUuid(legacyId: string): string {
  return deterministicUuid('user', legacyId);
}
export function entryUuid(legacyId: string): string {
  return deterministicUuid('archive-entry', legacyId);
}

/** timestamptz-værdi ud fra POC'ens unix-sekunder. 0/ugyldig -> null. */
export function isoOrNull(seconds: number): string | null {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000).toISOString();
}

/** Maskeret e-mail, så en rapport kan nævne en kollision uden at vise persondata. */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at < 1) return '***';
  const domain = email.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  const tld = dot >= 0 ? domain.slice(dot) : '';
  return `${email[0]}***@***${tld}`;
}

// -------------------------------------------------------------- læsning

function readArray(dir: string, file: string): unknown[] {
  const full = path.join(dir, file);
  let raw: string;
  try {
    raw = readFileSync(full, 'utf8');
  } catch (cause) {
    throw new Error(`Datafilen ${full} kunne ikke læses.`, { cause });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (cause) {
    throw new Error(`Datafilen ${full} er ikke gyldig JSON.`, { cause });
  }
  if (!Array.isArray(parsed)) throw new Error(`Datafilen ${full} skal indeholde en JSON-liste.`);
  return parsed;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function str(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  return typeof value === 'string' ? value : '';
}

function num(source: Record<string, unknown>, key: string): number {
  const value = source[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * Læser en POC-datamappe og VALIDERER uden at kaste: alt der ikke kan migreres
 * ender som en issue, så en rapport kan vise hele billedet i stedet for at
 * stoppe ved den første fejl.
 */
export function readPocData(dir: string): PocData {
  const issues: Issue[] = [];
  const organisations: PocOrganisation[] = [];
  const users: PocUser[] = [];
  const entries: PocEntry[] = [];

  // ---- virksomheder
  const seenOrgIds = new Set<string>();
  for (const [index, value] of readArray(dir, 'organisationer.json').entries()) {
    const row = asRecord(value);
    if (!row) {
      issues.push({ niveau: 'fejl', tabel: 'organisations', id: `#${index + 1}`, besked: 'Posten er ikke et objekt.' });
      continue;
    }
    const id = str(row, 'id');
    const navn = str(row, 'navn').trim();
    if (id === '') {
      issues.push({ niveau: 'fejl', tabel: 'organisations', id: `#${index + 1}`, besked: 'Mangler id.' });
      continue;
    }
    if (seenOrgIds.has(id)) {
      issues.push({ niveau: 'fejl', tabel: 'organisations', id, besked: 'Id findes mere end én gang (kollision).' });
      continue;
    }
    seenOrgIds.add(id);
    if (navn === '') {
      issues.push({ niveau: 'fejl', tabel: 'organisations', id, besked: 'Navnet er tomt — constraint organisations_name_not_blank ville afvise rækken.' });
      continue;
    }
    organisations.push({ id, navn, oprettet: num(row, 'oprettet') });
  }

  // ---- brugere
  const seenUserIds = new Set<string>();
  const seenEmails = new Map<string, string>();
  for (const [index, value] of readArray(dir, 'brugere.json').entries()) {
    const row = asRecord(value);
    if (!row) {
      issues.push({ niveau: 'fejl', tabel: 'users', id: `#${index + 1}`, besked: 'Posten er ikke et objekt.' });
      continue;
    }
    const id = str(row, 'id');
    if (id === '') {
      issues.push({ niveau: 'fejl', tabel: 'users', id: `#${index + 1}`, besked: 'Mangler id.' });
      continue;
    }
    if (seenUserIds.has(id)) {
      issues.push({ niveau: 'fejl', tabel: 'users', id, besked: 'Id findes mere end én gang (kollision).' });
      continue;
    }
    seenUserIds.add(id);

    const navn = str(row, 'navn').trim();
    const email = str(row, 'email').trim().toLowerCase();
    const org = str(row, 'org');
    const rolleIFilen = str(row, 'rolle');
    const harHash = typeof row['hash'] === 'string' && row['hash'] !== '';

    if (navn === '') {
      issues.push({ niveau: 'fejl', tabel: 'users', id, besked: 'Navnet er tomt.' });
      continue;
    }
    if (!EMAIL_PATTERN.test(email)) {
      issues.push({ niveau: 'fejl', tabel: 'users', id, besked: `E-mailen har ikke en gyldig form (${maskEmail(email)}).` });
      continue;
    }
    const earlier = seenEmails.get(email);
    if (earlier) {
      issues.push({ niveau: 'fejl', tabel: 'users', id, besked: `Samme e-mail som bruger ${earlier} (${maskEmail(email)}) — unique index users_email_unique ville afvise den.` });
      continue;
    }
    seenEmails.set(email, id);
    if (!seenOrgIds.has(org)) {
      issues.push({ niveau: 'fejl', tabel: 'users', id, besked: `Peger på virksomheden ${org || '(tom)'}, som ikke findes i organisationer.json.` });
      continue;
    }

    let rolle: UserRole;
    if (rolleIFilen === 'admin') rolle = 'admin';
    else if (rolleIFilen === 'bruger') rolle = 'bruger';
    else if (rolleIFilen === 'orgadmin') {
      rolle = 'bruger';
      issues.push({ niveau: 'note', tabel: 'users', id, besked: "Rollen 'orgadmin' mappes til 'bruger' (den havde ingen ekstra rettigheder i POC'en)." });
    } else {
      issues.push({ niveau: 'fejl', tabel: 'users', id, besked: `Ukendt rolle: ${rolleIFilen || '(tom)'}.` });
      continue;
    }
    if (harHash) {
      issues.push({ niveau: 'note', tabel: 'users', id, besked: 'Har et bcrypt-hash i filen. Det migreres IKKE — login besluttes i skive 2.' });
    }

    users.push({
      id,
      navn,
      email,
      org,
      rolle,
      rolleIFilen,
      oprettet: num(row, 'oprettet'),
      sidstSet: num(row, 'sidstSet'),
      spaerret: row['spaerret'] === true,
      harHash,
    });
  }

  // ---- arkivposter
  const seenEntryIds = new Set<string>();
  for (const [index, value] of readArray(dir, 'data.json').entries()) {
    const row = asRecord(value);
    if (!row) {
      issues.push({ niveau: 'fejl', tabel: 'archive_entries', id: `#${index + 1}`, besked: 'Posten er ikke et objekt.' });
      continue;
    }
    const id = str(row, 'id');
    if (id === '') {
      issues.push({ niveau: 'fejl', tabel: 'archive_entries', id: `#${index + 1}`, besked: 'Mangler id.' });
      continue;
    }
    if (seenEntryIds.has(id)) {
      issues.push({ niveau: 'fejl', tabel: 'archive_entries', id, besked: 'Id findes mere end én gang (kollision).' });
      continue;
    }
    seenEntryIds.add(id);

    const org = str(row, 'org');
    if (!seenOrgIds.has(org)) {
      issues.push({ niveau: 'fejl', tabel: 'archive_entries', id, besked: `Peger på virksomheden ${org || '(tom)'}, som ikke findes i organisationer.json.` });
      continue;
    }
    const navn = str(row, 'navn').trim();
    if (navn === '') {
      issues.push({ niveau: 'fejl', tabel: 'archive_entries', id, besked: 'Kandidatnavnet er tomt — constraint archive_candidate_not_blank ville afvise rækken.' });
      continue;
    }
    const artIFilen = str(row, 'art');
    // arkiv.php defaultede alt andet end 'sag' til 'rapport'.
    const art: ArchiveKind = artIFilen === 'sag' ? 'sag' : 'rapport';
    if (artIFilen !== 'sag' && artIFilen !== 'rapport' && artIFilen !== '') {
      issues.push({ niveau: 'note', tabel: 'archive_entries', id, besked: `Ukendt art '${artIFilen}' behandles som 'rapport', som arkiv.php gjorde.` });
    }

    const dato = str(row, 'dato');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dato)) {
      issues.push({ niveau: 'fejl', tabel: 'archive_entries', id, besked: `Datoen '${dato}' er ikke YYYY-MM-DD, og case_date er NOT NULL.` });
      continue;
    }
    const filnavn = str(row, 'filnavn');
    if (filnavn.length > 160) {
      issues.push({ niveau: 'note', tabel: 'archive_entries', id, besked: 'Filnavnet er over 160 tegn og ville blive afkortet.' });
    }
    const storrelse = num(row, 'storrelse');
    if (storrelse > MAX_BYTES) {
      issues.push({ niveau: 'fejl', tabel: 'archive_entries', id, besked: `Størrelsen ${storrelse} bytes overskrider 25 MB-grænsen i constraint archive_byte_size_range.` });
      continue;
    }

    entries.push({
      id,
      org,
      bruger: str(row, 'bruger'),
      art,
      navn,
      stilling: str(row, 'stilling'),
      dato,
      note: str(row, 'note'),
      filnavn: filnavn.slice(0, 160),
      storrelse,
      tilfojet: num(row, 'tilfojet'),
    });
  }

  // ---- filer på disken (POC gemte <id>.pdf / <id>.json ved siden af JSON-db'en)
  const filer = new Map<string, { navn: string; storrelse: number }>();
  for (const name of readdirSync(dir)) {
    const match = /^([0-9a-f]{16})\.(pdf|json)$/i.exec(name);
    if (!match?.[1]) continue;
    filer.set(match[1], { navn: name, storrelse: statSync(path.join(dir, name)).size });
  }

  return { organisations, users, entries, filer, issues };
}

// -------------------------------------------------------------- mapning

export interface OrganisationInsert {
  id: string;
  legacy_id: string;
  name: string;
  created_at: string | null;
}

export interface UserInsert {
  id: string;
  legacy_id: string;
  organisation_id: string;
  name: string;
  email: string;
  role: UserRole;
  blocked: boolean;
  last_seen_at: string | null;
  created_at: string | null;
}

export interface ArchiveInsert {
  id: string;
  legacy_id: string;
  organisation_id: string;
  created_by_user_id: string | null;
  created_by_name: string;
  kind: ArchiveKind;
  candidate_name: string;
  job_title: string;
  case_date: string;
  note: string;
  original_filename: string;
  byte_size: number;
  content_type: string;
  storage_path: string;
  checksum_sha256: string | null;
  created_at: string | null;
}

export function toOrganisationInsert(organisation: PocOrganisation): OrganisationInsert {
  return {
    id: organisationUuid(organisation.id),
    legacy_id: organisation.id,
    name: organisation.navn,
    created_at: isoOrNull(organisation.oprettet),
  };
}

export function toUserInsert(user: PocUser): UserInsert {
  return {
    id: userUuid(user.id),
    legacy_id: user.id,
    organisation_id: organisationUuid(user.org),
    name: user.navn,
    email: user.email,
    role: user.rolle,
    blocked: user.spaerret,
    last_seen_at: isoOrNull(user.sidstSet),
    created_at: isoOrNull(user.oprettet),
  };
}

/**
 * Ejerskabet er en relation, men POC'en gemte kun brugerens NAVN på posten.
 * Bedste bud: navnematch inden for samme virksomhed. Findes der ikke præcis én
 * kandidat, bliver created_by_user_id null, og navnet lever videre i
 * created_by_name (visning). Det rapporteres, så det ikke sker i stilhed.
 */
export function resolveOwner(entry: PocEntry, users: PocUser[]): { id: string | null; grund: string } {
  const needle = entry.bruger.trim().toLowerCase();
  if (needle === '') return { id: null, grund: 'posten har intet brugernavn' };
  const matches = users.filter(
    (user) => user.org === entry.org && user.navn.trim().toLowerCase() === needle,
  );
  if (matches.length === 1 && matches[0]) return { id: userUuid(matches[0].id), grund: 'navnematch i samme virksomhed' };
  if (matches.length === 0) return { id: null, grund: 'ingen bruger i virksomheden med det navn' };
  return { id: null, grund: `${matches.length} brugere i virksomheden har det navn` };
}

export function toArchiveInsert(
  entry: PocEntry,
  owner: string | null,
  file: { storrelse: number; checksum: string | null } | null,
): ArchiveInsert {
  const id = entryUuid(entry.id);
  const organisationId = organisationUuid(entry.org);
  return {
    id,
    legacy_id: entry.id,
    organisation_id: organisationId,
    created_by_user_id: owner,
    created_by_name: entry.bruger,
    kind: entry.art,
    candidate_name: entry.navn,
    job_title: entry.stilling,
    case_date: entry.dato,
    note: entry.note,
    original_filename: entry.filnavn,
    // Den rigtige filstørrelse vinder over indekset, når filen findes.
    byte_size: file?.storrelse ?? entry.storrelse,
    content_type: storedContentType(entry.art),
    storage_path: archiveStoragePath(organisationId, id, entry.art),
    checksum_sha256: file?.checksum ?? null,
    created_at: isoOrNull(entry.tilfojet),
  };
}
