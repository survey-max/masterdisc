'use client';

import { useState, useTransition } from 'react';

import { logUdAction } from './auth-actions';

/**
 * "Log ud" i portalens topbjælke — samme diskrete plads som POC'ens
 * `index.php?logud=1`, men som en knap, der kalder en server action.
 *
 * Knappen vises kun der, hvor der ER en session: hele /jobmatch/** er spærret
 * af middlewaren og af layoutets eget tjek, så en udlogget bruger ser den aldrig.
 *
 * Mislykkes udlogningen, siges det højt her — sessionen ville ellers leve videre,
 * mens brugeren troede, den var slut.
 */
export function LogUdKnap() {
  const [pending, start] = useTransition();
  const [fejl, setFejl] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        className="logud"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const svar = await logUdAction();
            setFejl(svar?.fejl ?? null);
          })
        }
      >
        {pending ? 'Logger ud …' : 'Log ud'}
      </button>
      {fejl ? <span className="logud-fejl">{fejl}</span> : null}
    </>
  );
}
