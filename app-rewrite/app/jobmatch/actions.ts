'use server';

import { revalidatePath } from 'next/cache';

import { actionErrorText, actionFailed, type ActionResult } from '@/lib/action-result';
import { requireUser } from '@/lib/auth';
import { repository } from '@/lib/data';
import type { ArchiveEntryWithOrg, UserRole } from '@/lib/data';
import {
  field,
  isArchiveId,
  isoDate,
  looksLikePdf,
  MAX_ARCHIVE_BYTES,
} from '@/lib/jobmatch/archive-input';

/**
 * Server actions for the JobMatch portal. They replace arkiv.php's
 * ?a=liste/gem/slet. All data access goes through lib/data — nothing here
 * touches a file or a JSON structure directly.
 *
 * Nothing is swallowed: a failure comes back as { ok: false, fejl } and is
 * shown, never as an empty list or a zero.
 */

// POC'ens input-regler (MAKS, felt(), %PDF--tjekket, id-formen) ligger i
// lib/jobmatch/archive-input.ts, fordi API-routes håndhæver de samme regler.

async function viewer(): Promise<{ id: string; org: string; rolle: UserRole; navn: string }> {
  const user = await requireUser();
  return { id: user.id, org: user.org, rolle: user.rolle, navn: user.navn };
}

/** The archive as the current user may see it. Mirrors arkiv.php ?a=liste. */
export async function listEntriesAction(): Promise<
  ActionResult<{ filer: ArchiveEntryWithOrg[]; visOrg: boolean }>
> {
  try {
    const me = await viewer();
    const filer = await repository.listArchiveEntries(me);
    return { ok: true, data: { filer, visOrg: me.rolle === 'admin' } };
  } catch (error) {
    return actionFailed(actionErrorText(error));
  }
}

/** Upload of a PDF report. Mirrors arkiv.php ?a=gem with art=rapport. */
export async function uploadRapportAction(formData: FormData): Promise<ActionResult> {
  try {
    const me = await viewer();
    const file = formData.get('fil');
    if (!(file instanceof File)) return actionFailed('Der blev ikke sendt nogen fil.');
    if (file.size <= 0) return actionFailed('Filen er tom.');
    if (file.size > MAX_ARCHIVE_BYTES) return actionFailed('Filen er større end 25 MB.');

    const bytes = new Uint8Array(await file.arrayBuffer());
    // Same check as arkiv.php: the file has to actually start with %PDF-.
    if (!looksLikePdf(bytes)) return actionFailed('Filen er ikke en PDF.');

    const fallbackName = file.name.replace(/\.(pdf|json)$/i, '') || 'Uden navn';
    await repository.createArchiveEntry({
      org: me.org,
      bruger: me.navn,
      brugerId: me.id,
      art: 'rapport',
      navn: field(formData.get('navn')) || fallbackName,
      stilling: field(formData.get('stilling')),
      dato: isoDate(field(formData.get('dato'), 10)),
      note: field(formData.get('note'), 1000),
      filnavn: file.name.slice(0, 160),
      bytes,
    });
    revalidatePath('/jobmatch');
    return { ok: true, data: null };
  } catch (error) {
    return actionFailed(actionErrorText(error));
  }
}

/**
 * Saves a JobMatch case straight into the archive. Mirrors arkiv.php ?a=gem
 * with art=sag, called from the tool's "Gem i arkivet".
 */
export async function saveCaseAction(input: {
  navn: string;
  stilling: string;
  dato: string;
  note: string;
  /** The tool's full state, serialised exactly as "Gem sag som fil" does. */
  caseJson: string;
}): Promise<ActionResult> {
  try {
    const me = await viewer();
    const navn = field(input.navn);
    if (!navn) return actionFailed('Udfyld kandidatens navn på trin 1, før sagen kan gemmes.');

    try {
      JSON.parse(input.caseJson) as unknown;
    } catch {
      return actionFailed('Sagen kunne ikke læses som gyldig data.');
    }
    if (input.caseJson.length > MAX_ARCHIVE_BYTES) return actionFailed('Sagen er større end 25 MB.');

    await repository.createArchiveEntry({
      org: me.org,
      bruger: me.navn,
      brugerId: me.id,
      art: 'sag',
      navn,
      stilling: field(input.stilling),
      dato: isoDate(field(input.dato, 10)),
      note: field(input.note, 1000),
      filnavn: 'sag.json',
      bytes: new TextEncoder().encode(input.caseJson),
    });
    revalidatePath('/jobmatch');
    return { ok: true, data: null };
  } catch (error) {
    return actionFailed(actionErrorText(error));
  }
}

/** Mirrors arkiv.php ?a=slet. */
export async function deleteEntryAction(id: string): Promise<ActionResult> {
  try {
    if (!isArchiveId(id)) return actionFailed('Ukendt fil.');
    const me = await viewer();
    await repository.deleteArchiveEntry(id, me);
    revalidatePath('/jobmatch');
    return { ok: true, data: null };
  } catch (error) {
    return actionFailed(actionErrorText(error));
  }
}
