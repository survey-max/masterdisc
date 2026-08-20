import {
  handleWithUser,
  jsonBody,
  jsonFail,
  jsonOk,
  portalRepository,
  requireAdmin,
} from '@/app/api/portal/_lib/context';

export const dynamic = 'force-dynamic';

/** admin.php h=spaer. Samme regel: man kan ikke spærre sig selv. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handleWithUser(request, async ({ user }) => {
    requireAdmin(user);
    const { id } = await params;
    if (id === user.id) return jsonFail('Du kan ikke spærre dig selv.', 400, 'DataError');

    const body = await jsonBody(request);
    if (typeof body['spaerret'] !== 'boolean') {
      return jsonFail('Feltet "spaerret" skal være true eller false.', 400, 'DataError');
    }
    return jsonOk({ bruger: await portalRepository.setUserBlocked(id, body['spaerret']) });
  });
}
