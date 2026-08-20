import {
  handleWithToken,
  handleWithUser,
  jsonBody,
  jsonFail,
  jsonOk,
  portalRepository,
  requireAdmin,
} from '@/app/api/portal/_lib/context';
import type { UserRole } from '@/lib/data';

/**
 * Brugere. Ingen adgangskoder nogen steder: POST opretter en bruger uden
 * credentials, præcis som admin.php h=nybruger gør i denne fase.
 *
 * GET kræver bevidst IKKE en opslået bruger — det er netop dette opslag,
 * dev-brugerkonteksten selv bygger på (lib/auth). Token-gaten dækker den.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  return handleWithToken(request, async () => {
    const email = new URL(request.url).searchParams.get('email');
    if (email !== null) {
      return jsonOk({ bruger: await portalRepository.findUserByEmail(email) });
    }
    return jsonOk({ brugere: await portalRepository.listUsers() });
  });
}

export async function POST(request: Request): Promise<Response> {
  return handleWithUser(request, async ({ user }) => {
    requireAdmin(user);
    const body = await jsonBody(request);
    const navn = typeof body['navn'] === 'string' ? body['navn'].trim() : '';
    const email = typeof body['email'] === 'string' ? body['email'].trim() : '';
    const org = typeof body['org'] === 'string' ? body['org'] : '';
    const rolle: UserRole = body['rolle'] === 'admin' ? 'admin' : 'bruger';

    if (navn === '') return jsonFail('Skriv brugerens navn.', 400, 'DataError');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonFail('E-mailadressen ser ikke rigtig ud.', 400, 'DataError');
    }
    if (await portalRepository.findUserByEmail(email)) {
      return jsonFail('Der findes allerede en bruger med den e-mail.', 409, 'DataError');
    }
    if (!(await portalRepository.getOrganisation(org))) {
      return jsonFail('Vælg en virksomhed.', 400, 'DataError');
    }
    return jsonOk({ bruger: await portalRepository.createUser({ navn, email, org, rolle }) }, 201);
  });
}
