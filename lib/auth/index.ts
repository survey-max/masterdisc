import { DataError, repository, type JobmatchRepository, type User } from '@/lib/data';

/**
 * ============================================================================
 * MOCK — INGEN RIGTIG AUTH I FASE 1
 * ============================================================================
 * The POC had its own sessions (PHP $_SESSION + 'mdsess' cookie), bcrypt
 * password hashes, login-attempt throttling and hand-rolled CSRF tokens. None
 * of it is ported: auth-modellen besluttes i fase 3 (SSO/Supabase Auth/andet
 * — beslutningen hører sammen med, hvor brugerne kommer til at ligge).
 *
 * Until then this module resolves "who is looking at the portal" from the data
 * layer, and nothing else. There is:
 *   - no session, no cookie, no token
 *   - no password verification (the login page is UI only)
 *   - no way to change who you are from the browser
 *
 * Everything in the app asks through this interface, so fase 3 replaces this
 * file and leaves the pages alone.
 * ============================================================================
 */
export interface AuthProvider {
  /** The user the portal is rendered for, or null if none can be resolved. */
  getCurrentUser(): Promise<SessionUser | null>;
}

export interface SessionUser {
  id: string;
  navn: string;
  email: string;
  org: string;
  rolle: User['rolle'];
}

/**
 * Picks MOCK_USER_ID if set, otherwise the first non-blocked admin, otherwise
 * the first non-blocked user. Throws rather than pretending nobody is logged
 * in when the user file cannot be read — a silent null would render an empty
 * portal and look like "no data".
 */
/**
 * Which user source to read from is a parameter, so an API-route can resolve
 * the same dev user through the direct Supabase repository. A route must not go
 * through `repository`: in PORTAL_DATA_MODE=api that would call the route again,
 * in a ring.
 */
export function createMockAuth(source: Pick<JobmatchRepository, 'listUsers'>): AuthProvider {
  return {
    async getCurrentUser(): Promise<SessionUser | null> {
      const users = await source.listUsers();
      const wanted = process.env.MOCK_USER_ID?.trim();

      if (wanted) {
        const match = users.find((u) => u.id === wanted);
        if (!match) {
          throw new DataError(
            `MOCK_USER_ID=${wanted} findes ikke i brugerdataene. Ret variablen, eller fjern den.`,
          );
        }
        return toSessionUser(match);
      }

      const active = users.filter((u) => !u.spaerret);
      const chosen = active.find((u) => u.rolle === 'admin') ?? active[0];
      return chosen ? toSessionUser(chosen) : null;
    },
  };
}

const mockAuth: AuthProvider = createMockAuth(repository);

function toSessionUser(user: User): SessionUser {
  return { id: user.id, navn: user.navn, email: user.email, org: user.org, rolle: user.rolle };
}

export const auth: AuthProvider = mockAuth;

/**
 * For pages that cannot render without a user. Mirrors the POC's
 * a_kraevLogin() as far as intent goes — but it throws instead of redirecting
 * to a login form, because there is no login to redirect to yet.
 */
export async function requireUser(): Promise<SessionUser> {
  return requireUserFrom(auth);
}

/** Same rule, but for a caller that brings its own provider (API-routes). */
export async function requireUserFrom(provider: AuthProvider): Promise<SessionUser> {
  const user = await provider.getCurrentUser();
  if (!user) {
    throw new DataError(
      'Ingen bruger kunne findes i dataene. Portalen kan ikke vises uden en bruger — ' +
        'tilføj en bruger i datamappen, eller sæt MOCK_USER_ID.',
    );
  }
  return user;
}

export function isAdmin(user: SessionUser | null): boolean {
  return user?.rolle === 'admin';
}
