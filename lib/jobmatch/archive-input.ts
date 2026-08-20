import type { ArchiveKind } from '@/lib/data';

/**
 * POC'ens regler for input til arkivet, ét sted.
 *
 * De lå tidligere som private hjælpere i app/jobmatch/actions.ts. Nu skal både
 * server actions OG API-routes håndhæve dem — en route er en selvstændig
 * indgang, som ikke må være mildere end formularen — så reglerne bor her i
 * stedet for at være kopieret to steder.
 *
 * Kilde: arkiv.php (MAKS, felt(), %PDF--tjekket, art-håndteringen).
 */

/** arkiv.php: MAKS = 25 MB. Samme grænse står på bucketen og som constraint. */
export const MAX_ARCHIVE_BYTES = 25 * 1024 * 1024;

/**
 * Et arkiv-id er nu et Supabase-uuid. POC'ens 16 hex-tegn accepteres stadig, så
 * gamle links (og et evt. legacy_id-opslag senere) ikke bliver en 404 med en
 * misvisende "ukendt fil"-besked før de overhovedet rammer datalaget.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LEGACY_ID_PATTERN = /^[a-f0-9]{16}$/;

export function isArchiveId(value: string): boolean {
  return UUID_PATTERN.test(value) || LEGACY_ID_PATTERN.test(value);
}

/**
 * Drops the same control characters arkiv.php's felt() stripped: everything
 * below space except tab, newline and carriage return.
 */
function stripControlChars(value: string): string {
  let out = '';
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    const isControl = code < 32 && code !== 9 && code !== 10 && code !== 13;
    if (!isControl) out += character;
  }
  return out;
}

/** arkiv.php's felt(): trim, strip control characters, cap the length. */
export function field(value: FormDataEntryValue | string | null | undefined, max = 200): string {
  if (typeof value !== 'string') return '';
  return stripControlChars(value.trim()).slice(0, max);
}

export function today(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function isoDate(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : today();
}

/** arkiv.php: filen skal faktisk starte med %PDF-. */
export function looksLikePdf(bytes: Uint8Array): boolean {
  return new TextDecoder('latin1').decode(bytes.subarray(0, 5)) === '%PDF-';
}

/** arkiv.php defaultede alt andet end 'sag' til 'rapport'. */
export function archiveKind(value: FormDataEntryValue | string | null | undefined): ArchiveKind {
  return value === 'sag' ? 'sag' : 'rapport';
}
