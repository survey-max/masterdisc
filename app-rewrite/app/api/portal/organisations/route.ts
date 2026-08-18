import {
  handleWithToken,
  handleWithUser,
  jsonBody,
  jsonFail,
  jsonOk,
  portalRepository,
  requireAdmin,
} from '@/app/api/portal/_lib/context';

/** Virksomheder. Svarer til auth.php's a_org/a_opretOrg og admin.php h=nyorg. */
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  return handleWithToken(request, async () =>
    jsonOk({ virksomheder: await portalRepository.listOrganisations() }),
  );
}

export async function POST(request: Request): Promise<Response> {
  return handleWithUser(request, async ({ user }) => {
    // Samme gating som admin.php: kun en systemadministrator opretter firmaer.
    requireAdmin(user);
    const body = await jsonBody(request);
    const navn = typeof body['navn'] === 'string' ? body['navn'].trim() : '';
    if (navn === '') return jsonFail('Skriv et virksomhedsnavn.', 400, 'DataError');
    return jsonOk({ virksomhed: await portalRepository.createOrganisation(navn) }, 201);
  });
}
