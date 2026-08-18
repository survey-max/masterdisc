/**
 * Record shapes from the POC's JSON file database (jobmatch-filer/).
 * Field names and types are kept exactly as the POC wrote them — Danish keys,
 * unix timestamps as numbers, dates as 'YYYY-MM-DD' strings — so the same data
 * can be read by both systems during the migration.
 *
 * FASE 3: these types stay; only the implementation behind the repository
 * interface changes when the data moves to the API in the other repo.
 */

/** jobmatch-filer/organisationer.json */
export interface Organisation {
  id: string;
  navn: string;
  /** Unix seconds. */
  oprettet: number;
}

/**
 * Roles that actually grant something. The POC also allowed 'orgadmin'
 * ("Virksomhedsadmin"), but a_erOrgAdmin() was never called anywhere, so an
 * orgadmin had exactly the rights of a 'bruger'. Dropped as dead code —
 * see docs/KORTLAEGNING.md.
 */
export type UserRole = 'admin' | 'bruger';

/**
 * jobmatch-filer/brugere.json.
 *
 * The POC record also carries a bcrypt 'hash' field. It is deliberately absent
 * here: no credential ever passes through this layer in fase 1, and the auth
 * model is decided in fase 3 (see lib/auth).
 */
export interface User {
  id: string;
  navn: string;
  email: string;
  /** Organisation.id */
  org: string;
  rolle: UserRole;
  /** Unix seconds. */
  oprettet: number;
  /** Unix seconds, 0 = never seen. */
  sidstSet: number;
  spaerret: boolean;
}

/** 'rapport' = uploaded PDF, 'sag' = a JobMatch case saved from the tool. */
export type ArchiveKind = 'rapport' | 'sag';

/** jobmatch-filer/data.json */
export interface ArchiveEntry {
  /** 16 hex characters. */
  id: string;
  /** Organisation.id — the record belongs to one company. */
  org: string;
  /** Display name of the user who added it. */
  bruger: string;
  art: ArchiveKind;
  /** Candidate name. */
  navn: string;
  stilling: string;
  /** 'YYYY-MM-DD' */
  dato: string;
  note: string;
  filnavn: string;
  /** Bytes. */
  storrelse: number;
  /** Unix seconds. */
  tilfojet: number;
}

/** ArchiveEntry joined with the organisation name, as the list view needs it. */
export interface ArchiveEntryWithOrg extends ArchiveEntry {
  orgNavn: string;
}

/** The stored file behind an ArchiveEntry. */
export interface StoredFile {
  bytes: Uint8Array;
  /** 'application/pdf' or 'application/json' */
  contentType: string;
}

export interface NewArchiveEntry {
  org: string;
  bruger: string;
  art: ArchiveKind;
  navn: string;
  stilling: string;
  dato: string;
  note: string;
  filnavn: string;
  bytes: Uint8Array;
}
