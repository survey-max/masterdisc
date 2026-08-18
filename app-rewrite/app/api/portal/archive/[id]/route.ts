import { handleWithUser, jsonFail, jsonOk, portalRepository } from '@/app/api/portal/_lib/context';
import { isArchiveId } from '@/lib/jobmatch/archive-input';

/**
 * Én arkivpost. Erstatter arkiv.php ?a=slet (og opslaget bag ?a=hent).
 *
 * GET svarer 200 med post: null, når posten ikke findes ELLER tilhører en anden
 * virksomhed — samme svar som datalagets getArchiveEntry() giver, så en bruger
 * ikke kan se forskel på "findes ikke" og "ikke din".
 */
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handleWithUser(request, async ({ viewer }) => {
    const { id } = await params;
    if (!isArchiveId(id)) return jsonOk({ post: null });
    return jsonOk({ post: await portalRepository.getArchiveEntry(id, viewer) });
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handleWithUser(request, async ({ viewer }) => {
    const { id } = await params;
    if (!isArchiveId(id)) return jsonFail('Ukendt fil.', 404, 'DataMissingError');
    // Adgangen tjekkes i datalaget: en anden virksomheds post giver
    // DataAccessError -> 403, en ukendt post DataMissingError -> 404.
    await portalRepository.deleteArchiveEntry(id, viewer);
    return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  });
}
