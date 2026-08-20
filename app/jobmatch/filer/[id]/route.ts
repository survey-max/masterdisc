import { requireUser } from '@/lib/auth';
import { repository } from '@/lib/data';
import { isArchiveId } from '@/lib/jobmatch/archive-input';
import { getPortalSessionUser } from '@/lib/supabase/auth/session';

/**
 * Download of an archived file. Replaces arkiv.php ?a=hent.
 *
 * The org check lives in the data layer (repository.getArchiveEntry returns
 * null when the entry belongs to another company and the viewer is not admin),
 * so this handler only maps it to a response.
 */

function textResponse(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  // Middlewaren spærrer allerede /jobmatch/**, men en route handler må ikke
  // hvile på det alene: den kan kaldes direkte, og det, den svarer med, er en
  // fil fra arkivet.
  const session = await getPortalSessionUser();
  if (!session) {
    return textResponse('Du er ikke logget ind, eller du har ikke adgang til portalen.', 401);
  }

  const { id } = await params;
  if (!isArchiveId(id)) return textResponse('Ukendt fil.', 404);

  const user = await requireUser();
  const entry = await repository.getArchiveEntry(id, { org: user.org, rolle: user.rolle });
  if (!entry) {
    return textResponse('Filen findes ikke, eller du har ikke adgang til den.', 404);
  }

  // Same download name as arkiv.php: jobmatch-<kandidat>-<dato>.<pdf|json>
  const cleanName =
    entry.navn.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'jobmatch';
  const base = `jobmatch-${cleanName.toLowerCase().replace(/ /g, '-')}-${entry.dato}`;
  const extension = entry.art === 'sag' ? 'json' : 'pdf';
  // A saved case is always downloaded; a PDF opens inline unless ?mode=hent.
  const mode = new URL(request.url).searchParams.get('mode');
  const disposition = entry.art === 'sag' || mode === 'hent' ? 'attachment' : 'inline';

  let file;
  try {
    file = await repository.readArchiveFile(entry);
  } catch (error) {
    // Same answer as arkiv.php when the record exists but the file is gone —
    // said out loud, not as an empty download.
    return textResponse(
      error instanceof Error ? error.message : 'Filen findes ikke længere.',
      404,
    );
  }
  return new Response(new Uint8Array(file.bytes), {
    status: 200,
    headers: {
      'Content-Type': file.contentType,
      'Content-Disposition': `${disposition}; filename="${encodeURIComponent(`${base}.${extension}`)}"`,
      'Content-Length': String(file.bytes.byteLength),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  });
}
