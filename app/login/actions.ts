'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { createClient } from '@supabase/supabase-js';

import {
  AUTH_LOG_PREFIX,
  hasPortalAccess,
  portalAdminAccessEnv,
} from '@/lib/supabase/auth/admin-access';
import { supabaseAuthEnv } from '@/lib/supabase/auth/config';
import {
  createPortalSessionValue,
  isLegacySupabaseCookie,
  PORTAL_SESSION_COOKIE,
  portalSessionCookieOptions,
  portalSessionSecret,
} from '@/lib/supabase/auth/portal-session';

import type { LoginState } from './login-state';

/**
 * ============================================================================
 * LOGIN — SERVER-SIDE, MED ADMIN-TJEK MOD user_profiles
 * ============================================================================
 * Supabase Auth bruges KUN til at verificere email + adgangskode. Klienten er
 * tilstandsløs (ingen cookies, ingen persisteret session): Supabase-sessionen
 * fra signInWithPassword smides væk igen med det samme, og det eneste,
 * browseren får, er portalens egen lille signerede cookie
 * (lib/supabase/auth/portal-session.ts).
 *
 * Hele flowet ligger i en server action, ikke i browseren. Det er ikke en
 * smagssag: admin-tjekket skal ske et sted, klienten ikke kan springe over,
 * og cookien er httpOnly og kan slet ikke sættes fra klientkode.
 *
 * Rækkefølgen er:
 *   1. opsætningen valideres FØRST — mangler admin-tjekkets nøgler eller
 *      sessionshemmeligheden, logges der ind på ingen måde (fail closed,
 *      uanset om kodeordet er rigtigt)
 *   2. Supabase verificerer email + adgangskode
 *   3. UID'et slås op i user_profiles og skal have rollen `admin`/`ejer` ELLER
 *      en egen rolle med Jobmatch slået til (og ikke være disabled); ellers
 *      "ingen adgang" — og ingen cookie
 *   4. Supabase-sessionen trækkes tilbage (signOut), og portal-cookien sættes
 * ============================================================================
 */

const FEJL_GENEREL =
  'Der opstod en uventet fejl under login. Prøv igen — eller skriv til pb@coachers.dk, hvis den bliver ved.';
const FEJL_FORKERT = 'Forkert email eller adgangskode';
const FEJL_INGEN_ADGANG = 'Du har ikke adgang til portalen';

export async function logIndAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim();
  const kode = String(formData.get('kode') ?? '');

  if (email === '' || kode === '') {
    return { fejl: 'Udfyld både email og adgangskode.' };
  }

  let resultat: LoginState & { uid?: string };
  try {
    resultat = await forsoegLogin(email, kode);
  } catch (error) {
    console.error(`${AUTH_LOG_PREFIX} uventet fejl under login:`, error);
    return { fejl: FEJL_GENEREL };
  }

  // redirect() kaster med vilje (NEXT_REDIRECT) og skal derfor stå uden for
  // try/catch'en ovenfor — ellers ville den blive fanget som "uventet fejl".
  if (resultat.uid) redirect('/jobmatch/');
  return { fejl: resultat.fejl };
}

async function forsoegLogin(email: string, kode: string): Promise<LoginState & { uid?: string }> {
  // Fail closed: kan admin-tjekket eller cookiesigneringen ikke laves, er der
  // ingen, der må lukkes ind — heller ikke med et korrekt kodeord. Valideres
  // FØR login-forsøget, så en manglende opsætning aldrig når at skabe noget.
  try {
    portalAdminAccessEnv();
    portalSessionSecret();
  } catch (configError) {
    console.error(
      `${AUTH_LOG_PREFIX} login spærret — opsætningen mangler:`,
      configError instanceof Error ? configError.message : configError,
    );
    return { fejl: FEJL_GENEREL };
  }

  const supabase = opretLoginKlient();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password: kode });

  if (error) {
    console.warn(
      `${AUTH_LOG_PREFIX} mislykket login for ${email}: ${error.code ?? error.name} (${error.status ?? '-'}) ${error.message}`,
    );
    // Forkert email/kode er hverdag og får den præcise besked. Alt andet
    // (rate limiting, nede backend, uventede koder) er en uventet fejl.
    const forkertKode = error.code === 'invalid_credentials' || error.status === 400;
    return { fejl: forkertKode ? FEJL_FORKERT : FEJL_GENEREL };
  }

  const user = data.user;
  if (!user) {
    console.error(`${AUTH_LOG_PREFIX} Supabase svarede uden bruger på et ellers gyldigt login.`);
    return { fejl: FEJL_GENEREL };
  }

  let harAdgang: boolean;
  try {
    harAdgang = await hasPortalAccess(user.id);
  } catch (opslagsFejl) {
    // Fail closed: fejler opslaget, behandles det som "ingen adgang".
    console.error(
      `${AUTH_LOG_PREFIX} admin-tjekket fejlede for UID ${user.id} (${email}):`,
      opslagsFejl instanceof Error ? opslagsFejl.message : opslagsFejl,
    );
    await traekSupabaseSessionTilbage(supabase, user.id);
    return { fejl: FEJL_GENEREL };
  }

  // Supabase-sessionen skal væk uanset udfaldet: portalen bruger sin egen
  // cookie, og et refresh-token, ingen nogensinde bruger, skal ikke ligge og
  // være gyldigt hos Supabase.
  await traekSupabaseSessionTilbage(supabase, user.id);

  if (!harAdgang) {
    console.warn(
      `${AUTH_LOG_PREFIX} afvist login: UID ${user.id} (${email}) har hverken admin-rolle ` +
        'eller Jobmatch-rettighed (egen rolle) i user_profiles.',
    );
    return { fejl: FEJL_INGEN_ADGANG };
  }

  const cookieStore = await cookies();
  cookieStore.set(
    PORTAL_SESSION_COOKIE,
    await createPortalSessionValue({ uid: user.id, email: user.email ?? null }),
    portalSessionCookieOptions(),
  );

  // Ryd op i gamle @supabase/ssr-cookies fra før skiftet, mens vi er her.
  for (const cookie of cookieStore.getAll()) {
    if (isLegacySupabaseCookie(cookie.name)) cookieStore.delete(cookie.name);
  }

  console.info(`${AUTH_LOG_PREFIX} login ok: UID ${user.id} (${email}).`);
  return { fejl: null, uid: user.id };
}

/**
 * Tilstandsløs klient: publishable-nøglen, ingen cookies, ingen persistens.
 * Sessionen, signInWithPassword skaber, lever kun i login-forsøgets scope.
 */
function opretLoginKlient() {
  const env = supabaseAuthEnv();
  return createClient(env.url, env.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/**
 * Trækker refresh-token'et fra signInWithPassword tilbage hos Supabase.
 * Scope 'local' rammer kun DENNE session — brugerens eventuelle sessioner i
 * coachersuniversed (samme delte projekt!) må aldrig logges ud herfra.
 */
async function traekSupabaseSessionTilbage(
  supabase: ReturnType<typeof opretLoginKlient>,
  userId: string,
): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) {
    // Ikke adgangskritisk (portalen bruger ikke token'et), men det skal kunne
    // findes i loggen, hvis døde sessioner hober sig op hos Supabase.
    console.error(
      `${AUTH_LOG_PREFIX} kunne ikke trække Supabase-sessionen tilbage for UID ${userId}:`,
      error.message,
    );
  }
}
