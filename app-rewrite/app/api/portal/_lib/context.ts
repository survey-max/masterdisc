import { timingSafeEqual } from 'node:crypto';

import { createMockAuth, requireUserFrom, type SessionUser } from '@/lib/auth';
import { DataAccessError, DataCorruptError, DataError, DataMissingError } from '@/lib/data';
import { supabaseRepository } from '@/lib/data/supabase';
import type { UserRole } from '@/lib/data';

/**
 * ============================================================================
 * FÆLLES INDGANG FOR /api/portal/* — SERVER-SIDE, SECRET-NØGLE, DEV-BRUGER
 * ============================================================================
 * Tre ting sker her, så hver route ikke skal huske dem:
 *
 * 1. TOKEN-GATE. App'en er offentligt tilgængelig bag masterdisc.dk/app-rewrite,
 *    og der findes endnu ingen rigtig auth. Uden en spærring ville disse routes
 *    udlevere hele portalen til hvem som helst. PORTAL_API_TOKEN skal derfor
 *    matche headeren x-portal-api-token. Mangler variablen i produktion, svarer
 *    routen 503 i stedet for at åbne — fail closed. Lokalt (NODE_ENV != production)
 *    er den valgfri, så dev ikke kræver opsætning. Gaten forsvinder igen i
 *    skive 2, når Supabase Auth bærer identiteten.
 *
 * 2. DEV-BRUGERKONTEKST. Hvem kalderen er, slås op SERVER-SIDE via lib/auth
 *    (MOCK_USER_ID) — aldrig fra en header eller et felt i requesten. Ellers
 *    ville virksomheds-scopingen være en åben dør. Sender klienten alligevel
 *    x-portal-viewer-org/-rolle, bruges de KUN som kryds-tjek: er de uenige med
 *    den opslåede bruger, afvises kaldet. De kan aldrig give bredere adgang.
 *
 * 3. FEJL. Datalagets fejlklasser oversættes til statuskoder og et
 *    { fejl, kode }-svar, så modparten kan genskabe præcis samme klasse.
 *    Ingen route svarer med en tom liste, fordi noget gik galt.
 *
 * Routes bruger `portalRepository` (den direkte Supabase-implementering), ALDRIG
 * `repository` fra lib/data: i PORTAL_DATA_MODE=api ville det kalde routen selv.
 * ============================================================================
 */

/** Den direkte vej til Supabase. Se kommentaren ovenfor. */
export const portalRepository = supabaseRepository;

const devAuth = createMockAuth(portalRepository);

export interface Viewer {
  org: string;
  rolle: UserRole;
}

export interface ApiContext {
  /** Dev-brugeren routen handler på vegne af. Opslået server-side. */
  user: SessionUser;
  /** Nøglen til virksomheds-scoping. Kommer fra `user`, aldrig fra requesten. */
  viewer: Viewer;
}

// ------------------------------------------------------------------- svar

export function jsonOk(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export function jsonFail(fejl: string, status: number, kode: string): Response {
  return new Response(JSON.stringify({ fejl, kode }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function errorResponse(error: unknown): Response {
  if (error instanceof DataMissingError) return jsonFail(error.message, 404, error.name);
  if (error instanceof DataAccessError) return jsonFail(error.message, 403, error.name);
  if (error instanceof DataCorruptError) return jsonFail(error.message, 500, error.name);
  if (error instanceof DataError) return jsonFail(error.message, 500, error.name);
  if (error instanceof Error && error.message.trim() !== '') {
    return jsonFail(error.message, 500, 'Error');
  }
  return jsonFail('Noget gik galt på serveren.', 500, 'Error');
}

// ------------------------------------------------------------------- gates

function sameToken(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function tokenGate(request: Request): Response | null {
  const expected = process.env.PORTAL_API_TOKEN?.trim();
  const provided = request.headers.get('x-portal-api-token')?.trim() ?? '';

  if (!expected) {
    if (process.env.NODE_ENV === 'production') {
      return jsonFail(
        'Portalens API er ikke konfigureret: PORTAL_API_TOKEN mangler. Routen svarer ikke, ' +
          'før den er sat — den må ikke stå åben uden auth.',
        503,
        'DataAccessError',
      );
    }
    return null;
  }
  if (!sameToken(provided, expected)) {
    return jsonFail('Ugyldig eller manglende API-token.', 401, 'DataAccessError');
  }
  return null;
}

/** Kryds-tjek af klientens forventning. Kan kun afvise, aldrig udvide. */
function assertViewerMatches(request: Request, user: SessionUser): void {
  const org = request.headers.get('x-portal-viewer-org');
  const rolle = request.headers.get('x-portal-viewer-rolle');
  if (org !== null && org !== user.org) {
    throw new DataAccessError(
      'Bruger-konteksten i kaldet passer ikke til den bruger, serveren har slået op.',
    );
  }
  if (rolle !== null && rolle !== user.rolle) {
    throw new DataAccessError(
      'Rollen i kaldet passer ikke til den bruger, serveren har slået op.',
    );
  }
}

export function requireAdmin(user: SessionUser): void {
  if (user.rolle !== 'admin') {
    throw new DataAccessError('Handlingen kræver rollen admin.');
  }
}

// ---------------------------------------------------------------- wrappers

/**
 * Til routes, der ikke er virksomheds-scopede: virksomheds- og brugerlisterne.
 * De må ikke kræve en opslået bruger, fordi det netop er dem, dev-brugeren
 * slås op i (ellers ville opslaget bide sig selv i halen).
 */
export async function handleWithToken(
  request: Request,
  run: () => Promise<Response>,
): Promise<Response> {
  const denied = tokenGate(request);
  if (denied) return denied;
  try {
    return await run();
  } catch (error) {
    return errorResponse(error);
  }
}

/** Til alt org-scopet og alt, der skriver. */
export async function handleWithUser(
  request: Request,
  run: (context: ApiContext) => Promise<Response>,
): Promise<Response> {
  const denied = tokenGate(request);
  if (denied) return denied;
  try {
    const user = await requireUserFrom(devAuth);
    assertViewerMatches(request, user);
    return await run({ user, viewer: { org: user.org, rolle: user.rolle } });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Læser en JSON-body og siger tydeligt fra, hvis den ikke er et objekt. */
export async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch (cause) {
    throw new DataError('Kaldet indeholdt ikke gyldig JSON.', { cause });
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new DataError('Kaldet skal indeholde et JSON-objekt.');
  }
  return body as Record<string, unknown>;
}
