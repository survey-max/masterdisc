import { handleWithToken, jsonOk, portalRepository } from '@/app/api/portal/_lib/context';

export const dynamic = 'force-dynamic';

/** Én bruger. 200 med bruger: null når hen ikke findes — se getUser()-kontrakten. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handleWithToken(request, async () => {
    const { id } = await params;
    return jsonOk({ bruger: await portalRepository.getUser(id) });
  });
}
