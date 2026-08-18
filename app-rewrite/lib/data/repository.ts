import type {
  ArchiveEntry,
  ArchiveEntryWithOrg,
  NewArchiveEntry,
  Organisation,
  StoredFile,
  User,
  UserRole,
} from './types';

/**
 * The single door to all portal data. No component, page, route handler or
 * action may read or write portal data any other way.
 *
 * FASE 3: the JSON implementation in ./json is replaced by one that calls the
 * API in the other repo (Supabase-backed). Method signatures are what the app
 * depends on, so they are the contract to keep — not the JSON files.
 */
export interface JobmatchRepository {
  // ---- organisations ----
  listOrganisations(): Promise<Organisation[]>;
  getOrganisation(id: string): Promise<Organisation | null>;
  createOrganisation(navn: string): Promise<Organisation>;

  // ---- users ----
  listUsers(): Promise<User[]>;
  getUser(id: string): Promise<User | null>;
  findUserByEmail(email: string): Promise<User | null>;
  createUser(input: { navn: string; email: string; org: string; rolle: UserRole }): Promise<User>;
  /** Returns the updated user. Throws if the user does not exist. */
  setUserBlocked(id: string, spaerret: boolean): Promise<User>;

  // ---- archive ----
  /**
   * Archive entries visible to one user, newest first.
   * Mirrors arkiv.php: a 'bruger' sees only their own organisation, an 'admin'
   * sees every organisation.
   */
  listArchiveEntries(viewer: { org: string; rolle: UserRole }): Promise<ArchiveEntryWithOrg[]>;
  /** Null when the entry does not exist or is not visible to the viewer. */
  getArchiveEntry(id: string, viewer: { org: string; rolle: UserRole }): Promise<ArchiveEntry | null>;
  createArchiveEntry(input: NewArchiveEntry): Promise<ArchiveEntry>;
  deleteArchiveEntry(id: string, viewer: { org: string; rolle: UserRole }): Promise<void>;
  /** The stored PDF or case JSON. Throws DataMissingError if the file is gone. */
  readArchiveFile(entry: ArchiveEntry): Promise<StoredFile>;
}

/** Base class for every failure the data layer reports. Never swallowed. */
export class DataError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'DataError';
  }
}

/** A file or record that must exist is missing. */
export class DataMissingError extends DataError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'DataMissingError';
  }
}

/** A file exists but cannot be trusted: unparsable JSON or wrong shape. */
export class DataCorruptError extends DataError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'DataCorruptError';
  }
}

/** The caller asked for something they are not allowed to see or change. */
export class DataAccessError extends DataError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'DataAccessError';
  }
}
