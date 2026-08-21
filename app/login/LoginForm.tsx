'use client';

import { useActionState } from 'react';

import { logIndAction } from './actions';
import { LOGIN_TOM, type LoginState } from './login-state';

/**
 * Formularen ser ud som POC'ens, men logger nu rigtigt ind: felterne sendes til
 * server action'en, som taler med Supabase og tjekker admin-rollen. Der sker
 * ingen autentificering i browseren, og der ligger ingen Supabase-kald her —
 * med vilje.
 *
 * `fejl` kan komme to steder fra: fra server action'en (dette forsøg) eller fra
 * `initialFejl`, når middlewaren har sendt brugeren hertil.
 */
export function LoginForm({ initialFejl }: { initialFejl: string | null }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    logIndAction,
    initialFejl ? { fejl: initialFejl } : LOGIN_TOM,
  );

  return (
    <>
      {state.fejl ? (
        <div className="fejl" role="alert">
          {state.fejl}
        </div>
      ) : null}

      <form action={formAction}>
        <label>
          <span>Email</span>
          <input type="email" name="email" required autoComplete="username" autoFocus />
        </label>
        <label>
          <span>Adgangskode</span>
          <input type="password" name="kode" required autoComplete="current-password" />
        </label>
        <button className="btn" type="submit" disabled={pending}>
          {pending ? 'Logger ind …' : 'Log ind'}
        </button>
      </form>
    </>
  );
}
