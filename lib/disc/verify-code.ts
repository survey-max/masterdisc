/**
 * Consultant code validation against the existing DISC API.
 *
 * This is a byte-for-byte replication of what masterdisc' own verifyCode() does
 * (see public/profil/index.html): POST to /api/disc/verify-code with
 * Content-Type: application/json and the body {"submitCode": "<kode>"}, and a
 * code counts as valid only when the response is ok AND the body has ok: true.
 * The endpoint and its backend are unchanged and must stay that way — this file
 * only moves *when* the call happens (now already on /opret), not what it is.
 *
 * The call runs in the browser, exactly as in the DISC flow, so it hits the same
 * endpoint from the same kind of origin.
 */

/** Same default and same override as window.DISC_API_BASE in the DISC flow. */
export function discApiBase(): string {
  const configured = process.env.NEXT_PUBLIC_DISC_API_BASE?.trim();
  return (configured || 'https://www.unicoachers.dk').replace(/\/$/, '');
}

export type VerifyOutcome =
  /** The API accepted the code. */
  | 'valid'
  /** The API rejected the code. */
  | 'invalid'
  /** The API could not be reached or failed (network, 5xx) — NOT a rejection. */
  | 'unavailable';

export async function verifyConsultantCode(code: string): Promise<VerifyOutcome> {
  let response: Response;
  try {
    response = await fetch(`${discApiBase()}/api/disc/verify-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submitCode: code }),
    });
  } catch {
    // Network error, DNS, offline, CORS preflight failure …
    return 'unavailable';
  }

  // A server-side failure is not the same as "wrong code": telling the user
  // their code is invalid when the server is down would send them looking for a
  // problem that is not theirs.
  if (response.status >= 500) return 'unavailable';

  const data: unknown = await response.json().catch(() => null);
  const accepted =
    response.ok &&
    typeof data === 'object' &&
    data !== null &&
    (data as { ok?: unknown }).ok === true;

  return accepted ? 'valid' : 'invalid';
}
