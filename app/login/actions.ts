'use server';

import { redirect } from 'next/navigation';

import {
  AUTH_LOG_PREFIX,
  isPortalAdmin,
  portalAdminAccessEnv,
} from '@/lib/supabase/auth/admin-access';
import { createSupabaseRouteClient } from '@/lib/supabase/auth/route';

import type { LoginState } from './login-state';

/**
 * ============================================================================
 * LOGIN — SERVER-SIDE, MED ADMIN-TJEK MOD user_profiles
 * ============================================================================
 * Hele flowet ligger i en server action, ikke i browseren. Det er ikke en
 * smagssag: admin-tjekket skal ske et sted, klienten ikke kan springe over,
 * og en afvist bruger skal logges ud IGEN med det samme, før svaret sendes.
 * Gjorde browseren login'et, ville den sidde med en gyldig session i det
 * sekund, tjekket faldt ud til nej.
 *
 * Rækkefølgen er:
 *   1. opsætningen til admin-tjekket valideres FØRST — mangler den, logges der
 *      ind på ingen måde (fail closed, uanset om kodeordet er rigtigt)
 *   2. Supabase verificerer email + adgangskode
 *   3. UID'et slås op i user_profiles og skal have rollen `admin` eller `ejer`
 *      (og ikke være disabled); ellers signOut() og "ingen adgang"
 *
 * Ingen tavse fejl: brugeren får en dansk besked, og alt, der ikke er et
 * almindeligt forkert kodeord, logges server-side.
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
  // Fail closed: kan admin-tjekket ikke laves, er der ingen, der må lukkes
  // ind — heller ikke med et korrekt kodeord. Valideres FØR login-forsøget,
  // så en manglende opsætning aldrig efterlader en halvfærdig session.
  try {
    portalAdminAccessEnv();
  } catch (configError) {
    console.error(
      `${AUTH_LOG_PREFIX} login spærret — admin-tjekket er ikke sat op:`,
      configError instanceof Error ? configError.message : configError,
    );
    return { fejl: FEJL_GENEREL };
  }

  const supabase = await createSupabaseRouteClient();
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

  let erAdmin: boolean;
  try {
    erAdmin = await isPortalAdmin(user.id);
  } catch (opslagsFejl) {
    // Fail closed: fejler opslaget, behandles det som "ingen adgang" — men
    // sessionen skal stadig væk, og fejlen skal kunne findes i loggen.
    console.error(
      `${AUTH_LOG_PREFIX} admin-tjekket fejlede for UID ${user.id} (${email}):`,
      opslagsFejl instanceof Error ? opslagsFejl.message : opslagsFejl,
    );
    await afslutAfvistSession(supabase, user.id);
    return { fejl: FEJL_GENEREL };
  }

  if (!erAdmin) {
    console.warn(
      `${AUTH_LOG_PREFIX} afvist login: UID ${user.id} (${email}) har ikke admin-rolle i user_profiles. Sessionen afsluttes igen.`,
    );
    await afslutAfvistSession(supabase, user.id);
    return { fejl: FEJL_INGEN_ADGANG };
  }

  console.info(`${AUTH_LOG_PREFIX} login ok: UID ${user.id} (${email}).`);
  return { fejl: null, uid: user.id };
}

/** Log en afvist bruger ud igen, før svaret sendes. Sessionen SKAL væk. */
async function afslutAfvistSession(
  supabase: Awaited<ReturnType<typeof createSupabaseRouteClient>>,
  userId: string,
): Promise<void> {
  const { error: signOutError } = await supabase.auth.signOut();
  if (signOutError) {
    // Lykkes det ikke, er det alvorligt nok til at blive sagt højt i loggen —
    // brugeren får stadig ingen adgang.
    console.error(
      `${AUTH_LOG_PREFIX} kunne IKKE afslutte sessionen for afvist UID ${userId}:`,
      signOutError.message,
    );
  }
}
