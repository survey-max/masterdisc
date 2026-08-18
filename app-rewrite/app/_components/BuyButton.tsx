'use client';

import { useState } from 'react';

/**
 * Ported from public_html/index.html: the price-card button reveals the
 * "Bestil på …" line under it. No form, no checkout — same as the POC.
 */
export function BuyButton({ label, variant }: { label: string; variant: 'line' | 'gold' }) {
  const [shown, setShown] = useState(false);
  return (
    <>
      <button className={`btn ${variant} kob`} type="button" onClick={() => setShown(true)}>
        {label}
      </button>
      <p className={shown ? 'bestil on' : 'bestil'}>
        Bestil på <a href="mailto:pb@coachers.dk">pb@coachers.dk</a> eller på tlf.{' '}
        <a href="tel:+4520845503">+4520845503</a>
      </p>
    </>
  );
}
