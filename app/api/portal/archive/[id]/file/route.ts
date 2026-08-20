import { handleWithUser, jsonFail, portalRepository } from '@/app/api/portal/_lib/context';
import { isArchiveId } from '@/lib/jobmatch/archive-input';

/**
 * Bytes bag én arkivpost. Hentes i datalaget via en kortlivet signeret URL, som
 * aldrig forlader serveren.
 *
 * Dette er den interne route (datalagets readArchiveFile i PORTAL_DATA_MODE=api).
 * Brugerens download bliver ved med at være /jobmatch/filer/<id>, som sætter
 * POC'ens filnavn og Content-Disposition.
 */
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handleWithUser(request, async ({ viewer }) => {
    const { id } = await params;
    if (!isArchiveId(id)) return jsonFail('Ukendt fil.', 404, 'DataMissingError');

    const entry = await portalRepository.getArchiveEntry(id, viewer);
    if (!entry) {
      return jsonFail(
        'Filen findes ikke, eller du har ikke adgang til den.',
        404,
        'DataMissingError',
      );
    }
    // Mangler filen bag posten, kaster datalaget DataMissingError -> 404 med
    // "findes ikke længere". Aldrig et tomt svar.
    const file = await portalRepository.readArchiveFile(entry);
    return new Response(new Uint8Array(file.bytes), {
      status: 200,
      headers: {
        'content-type': file.contentType,
        'content-length': String(file.bytes.byteLength),
        'x-content-type-options': 'nosniff',
        'cache-control': 'private, no-store',
      },
    });
  });
}
