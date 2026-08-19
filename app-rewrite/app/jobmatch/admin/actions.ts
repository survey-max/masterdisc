'use server';

import { revalidatePath } from 'next/cache';

import { actionErrorText, actionFailed, type ActionResult } from '@/lib/action-result';
import { requireUser } from '@/lib/auth';
import { repository } from '@/lib/data';
import type { UserRole } from '@/lib/data';
import { requirePortalSession } from '@/lib/supabase/auth/session';

/**
 * Replaces admin.php's POST handlers (nyorg, nybruger, spaer).
 *
 * Deliberately missing, see docs/KORTLAEGNING.md:
 *   - 'opsaet' (first-run creation of the administrator, opsat.flag)
 *   - 'nykode' (password change)
 * Both are credential/bootstrap concerns and wait for the auth decision in
 * fase 3. No password is accepted, stored or hashed anywhere in fase 1.
 */

async function requireAdmin(): Promise<{ id: string }> {
  // Samme grund som i app/jobmatch/actions.ts: en server action er et
  // POST-endpoint, og adgangen skal derfor tjekkes her ogsaa.
  await requirePortalSession();
  const user = await requireUser();
  if (user.rolle !== 'admin') {
    throw new Error('Du har ikke adgang til denne side.');
  }
  return { id: user.id };
}

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** admin.php: h=nyorg */
export async function createOrganisationAction(formData: FormData): Promise<ActionResult<string>> {
  try {
    await requireAdmin();
    const navn = String(formData.get('orgnavn') ?? '').trim();
    if (navn === '') return actionFailed('Skriv et virksomhedsnavn.');
    const created = await repository.createOrganisation(navn);
    revalidatePath('/jobmatch/admin');
    return { ok: true, data: `Virksomheden ${created.navn} er oprettet.` };
  } catch (error) {
    return actionFailed(actionErrorText(error));
  }
}

/** admin.php: h=nybruger — uden adgangskode, se filens hoved. */
export async function createUserAction(formData: FormData): Promise<ActionResult<string>> {
  try {
    await requireAdmin();
    const navn = String(formData.get('bnavn') ?? '').trim();
    const email = String(formData.get('bemail') ?? '').trim();
    const org = String(formData.get('borg') ?? '');
    const rolleInput = String(formData.get('brolle') ?? 'bruger');
    const rolle: UserRole = rolleInput === 'admin' ? 'admin' : 'bruger';

    if (navn === '') return actionFailed('Skriv brugerens navn.');
    if (!looksLikeEmail(email)) return actionFailed('E-mailadressen ser ikke rigtig ud.');
    if (await repository.findUserByEmail(email)) {
      return actionFailed('Der findes allerede en bruger med den e-mail.');
    }
    const organisation = await repository.getOrganisation(org);
    if (!organisation) return actionFailed('Vælg en virksomhed.');

    await repository.createUser({ navn, email, org, rolle });
    revalidatePath('/jobmatch/admin');
    return {
      ok: true,
      data:
        `${navn} er oprettet under ${organisation.navn}. Brugeren har endnu ingen adgangskode: ` +
        'login besluttes i fase 3, og der udleveres ingen credentials herfra.',
    };
  } catch (error) {
    return actionFailed(actionErrorText(error));
  }
}

/** admin.php: h=spaer */
export async function toggleUserBlockedAction(formData: FormData): Promise<ActionResult<string>> {
  try {
    const me = await requireAdmin();
    const id = String(formData.get('bid') ?? '');
    if (id === me.id) return actionFailed('Du kan ikke spærre dig selv.');

    const user = await repository.getUser(id);
    if (!user) return actionFailed('Brugeren blev ikke fundet.');

    const updated = await repository.setUserBlocked(id, !user.spaerret);
    revalidatePath('/jobmatch/admin');
    return {
      ok: true,
      data: `${updated.navn} ${updated.spaerret ? 'er spærret.' : 'er åbnet igen.'}`,
    };
  } catch (error) {
    return actionFailed(actionErrorText(error));
  }
}
