'use client';

import { useState } from 'react';

/**
 * UI only — med vilje.
 *
 * Formularen ser ud som POC'ens, men der sker ingen autentificering: intet
 * password sendes nogen steder, der sættes ingen cookie, og der oprettes ingen
 * session. Auth-modellen besluttes i fase 3 (se lib/auth), og indtil da er der
 * bevidst ingen halvfærdig hjemmelavet login-mekanik at forveksle med den
 * rigtige.
 */
export function LoginForm() {
  const [vist, setVist] = useState(false);

  return (
    <>
      {vist ? (
        <div className="fejl">
          Login er ikke sat op endnu. Portalen kører i fase 1 på en mock-bruger fra datalaget, og
          selve auth-modellen besluttes i fase 3 — derfor er der intet at logge ind på her. Portalen
          ligger på /jobmatch/.
        </div>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          setVist(true);
        }}
      >
        <label>
          <span>E-mail</span>
          <input type="email" name="email" required autoComplete="username" autoFocus />
        </label>
        <label>
          <span>Adgangskode</span>
          <input type="password" name="kode" required autoComplete="current-password" />
        </label>
        <button className="btn" type="submit">
          Log ind
        </button>
      </form>
    </>
  );
}
