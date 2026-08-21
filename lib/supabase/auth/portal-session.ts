/**
 * ============================================================================
 * PORTALENS EGEN SESSIONSCOOKIE — LILLE, SIGNERET, httpOnly
 * ============================================================================
 * Supabase Auth bruges KUN til at verificere email + adgangskode ved login.
 * Sessionen derefter er portalens egen: en HMAC-signeret cookie med
 * { v, uid, email, exp } — nogle få hundrede bytes. Samme mønster som
 * coachersuniversed (lib/auth/session.ts i det andet repo), og valgt af samme
 * grund: @supabase/ssr lægger HELE Supabase-sessionen i cookies, inklusive
 * brugerens metadata. Et enkelt stort felt dér (fx et foto som data-URI) gav
 * en cookie på 89 KB — og Vercel afviser alle requests med headers over 16 KB,
 * FØR portalens kode overhovedet kører. Den fejl kan denne cookie ikke få:
 * indholdet er fast og indeholder intet brugerredigerbart.
 *
 * Cookien beviser kun identitet. Rollen slås op i user_profiles ved HVERT
 * request (admin-access.ts), så en fjernet admin-rolle virker med det samme —
 * der er intet cachet privilegium i cookien.
 *
 * HMAC'en køres gennem Web Crypto (crypto.subtle), fordi verifikationen også
 * sker i middlewaren (Edge-runtime): samme kode i Node og Edge, ingen imports
 * i edge-bundlen ud over denne fil.
 *
 * FAIL CLOSED. Mangler PORTAL_SESSION_SECRET, kastes der — en manglende
 * hemmelighed må aldrig kunne læses som "så signerer vi ikke".
 * ============================================================================
 */

import { PortalAuthConfigError } from './admin-access';

export const PORTAL_SESSION_COOKIE = 'portal-session';

/** Samme levetid som coachersuniversed's sessioner. */
export const PORTAL_SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export interface PortalSessionPayload {
  /** Versionsfelt, så formatet kan skiftes uden at gamle cookies fejllæses. */
  v: 1;
  /** Supabase-auth-UID — det id, user_profiles.auth_user_id peger på. */
  uid: string;
  email: string | null;
  /** Udløb som epoch-millisekunder. Efter dette tidspunkt er cookien død. */
  exp: number;
}

/** Hemmeligheden, cookien signeres med. Kaster hvis den mangler eller er kort. */
export function portalSessionSecret(): string {
  const secret = process.env.PORTAL_SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new PortalAuthConfigError(
      'PORTAL_SESSION_SECRET mangler eller er under 32 tegn. Uden den kan der ikke ' +
        'logges ind — generér én med `openssl rand -base64 48`. Se docs/AUTH.md.',
    );
  }
  return secret;
}

/** Cookie-attributterne. httpOnly er selve pointen: JavaScript kan ikke læse den. */
export function portalSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: Math.floor(PORTAL_SESSION_TTL_MS / 1000),
  };
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(portalSessionSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

async function sign(encodedPayload: string): Promise<string> {
  const signature = await crypto.subtle.sign(
    'HMAC',
    await hmacKey(),
    new TextEncoder().encode(encodedPayload),
  );
  return base64UrlEncode(new Uint8Array(signature));
}

/** Konstant tid: sammenligningen må ikke lække, HVOR signaturen afviger. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

/** Cookieværdien for en ny session: base64url(payload).signatur */
export async function createPortalSessionValue(
  payload: Omit<PortalSessionPayload, 'v' | 'exp'>,
): Promise<string> {
  const fuld: PortalSessionPayload = { v: 1, ...payload, exp: Date.now() + PORTAL_SESSION_TTL_MS };
  const encoded = base64UrlEncode(new TextEncoder().encode(JSON.stringify(fuld)));
  return `${encoded}.${await sign(encoded)}`;
}

/**
 * Payload'en fra en cookieværdi — eller null, hvis signaturen er forkert,
 * formen er uventet eller udløbet er passeret. Null er ALTID "ingen adgang";
 * kun en manglende hemmelighed kaster (PortalAuthConfigError).
 */
export async function verifyPortalSessionValue(
  value: string,
): Promise<PortalSessionPayload | null> {
  const [encodedPayload, signature] = value.split('.');
  if (!encodedPayload || !signature) return null;

  const expected = await sign(encodedPayload);
  if (!timingSafeEqual(base64UrlDecode(signature), base64UrlDecode(expected))) return null;

  let parsed: PortalSessionPayload;
  try {
    parsed = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedPayload)));
  } catch {
    return null;
  }

  if (parsed.v !== 1 || typeof parsed.uid !== 'string' || parsed.uid === '') return null;
  if (typeof parsed.exp !== 'number' || parsed.exp <= Date.now()) return null;
  return parsed;
}

/**
 * Navnene på de gamle @supabase/ssr-cookies (sb-…-auth-token.0, .1, …), som
 * stadig kan ligge i browseren efter skiftet. De ryddes op alle steder, der
 * alligevel rører cookies — jo før de er væk, jo mindre header at sende.
 */
export function isLegacySupabaseCookie(name: string): boolean {
  return name.startsWith('sb-');
}
