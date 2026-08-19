import { handleWithToken, jsonOk, portalRepository } from '@/app/api/portal/_lib/context';

export const dynamic = 'force-dynamic';

/**
 * Én virksomhed. Findes den ikke, er svaret 200 med virksomhed: null — ikke en
 * 404 — fordi datalagets getOrganisation() lover null, ikke en fejl.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handleWithToken(request, async () => {
    const { id } = await params;
    return jsonOk({ virksomhed: await portalRepository.getOrganisation(id) });
  });
}
