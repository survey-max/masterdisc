'use client';

import { useEffect, useRef, useState } from 'react';

import { verifyConsultantCode } from '@/lib/disc/verify-code';

const FEJL_TEKST: Record<string, string> = {
  // Kommer fra /profil/, når koden mangler i URL'en.
  mangler: 'Indtast din adgangskode her, før du starter profilen.',
  // Kommer fra /profil/, når API'et afviste koden.
  ugyldig: 'Koden blev ikke godkendt. Tjek den, og prøv igen.',
  // Kommer fra /profil/, når koden ikke kunne tjekkes (netværk eller serverfejl).
  api: 'Vi kunne ikke tjekke koden lige nu. Prøv igen om et øjeblik.',
  // Kommer fra /profil/, når selve profilen ikke kunne starte.
  start: 'Profilen kunne ikke starte lige nu. Prøv igen om et øjeblik.',
};

function fejlBesked(reason: string): string {
  if (!reason) return '';
  return FEJL_TEKST[reason] ?? 'Der skete en fejl. Prøv at indtaste koden igen.';
}

const AFVIST =
  'Koden blev ikke godkendt. Tjek, at den er skrevet præcis som du har fået den.';
const UTILGAENGELIG =
  'Vi kunne ikke få kontakt til serveren, så koden kunne ikke tjekkes. Prøv igen om et øjeblik.';

/**
 * The code gate from public_html/opret/index.html — now the *only* place a code
 * is typed.
 *
 * The code is validated here, against the existing /api/disc/verify-code, before
 * the respondent is sent on. Only a code the API has accepted leads to
 * /profil/?kode=…, and the DISC flow validates it once more on arrival (without
 * showing a field), so access never rests on this page alone.
 */
export function KodeForm({
  initialKode = '',
  initialFejl = '',
  profile = '',
  company = '',
}: {
  initialKode?: string;
  initialFejl?: string;
  /** Videreføres uændret til DISC-flowet, som læser dem fra URL'en. */
  profile?: string;
  company?: string;
}) {
  const [kode, setKode] = useState(initialKode);
  const [fejl, setFejl] = useState(() => fejlBesked(initialFejl));
  const [tjekker, setTjekker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  async function submit() {
    if (tjekker) return;
    const value = kode.trim();
    // POC'ens egne lokale tjek — de sparer et kald, men afgør intet.
    if (!value) {
      setFejl('Indtast din adgangskode først.');
      inputRef.current?.focus();
      return;
    }
    if (value.length < 4) {
      setFejl('Koden ser for kort ud. Tjek den igen.');
      inputRef.current?.focus();
      return;
    }

    setFejl('');
    setTjekker(true);
    let outcome: Awaited<ReturnType<typeof verifyConsultantCode>>;
    try {
      outcome = await verifyConsultantCode(value);
    } catch {
      // verifyConsultantCode fanger selv netværksfejl; dette er sidste net, så
      // knappen aldrig hænger uden besked.
      outcome = 'unavailable';
    }

    if (outcome === 'valid') {
      // /profil/ er det indlejrede DISC-flow i public/, ikke en Next-rute, så
      // det er en almindelig sidenavigation. Knappen bliver ved med at være
      // disabled, indtil browseren skifter side.
      const target = new URLSearchParams({ kode: value });
      // Kom brugeren fra /profil/survey/<virksomhed>, følger valget med tilbage.
      if (profile) target.set('profile', profile);
      if (company) target.set('company', company);
      window.location.assign(`/profil/?${target.toString()}`);
      return;
    }

    setTjekker(false);
    setFejl(outcome === 'invalid' ? AFVIST : UTILGAENGELIG);
    inputRef.current?.focus();
    inputRef.current?.select();
  }

  return (
    <>
      <label>
        <span>Adgangskode</span>
        <input
          type="text"
          id="kode"
          ref={inputRef}
          autoComplete="off"
          spellCheck={false}
          maxLength={20}
          disabled={tjekker}
          value={kode}
          onChange={(event) => {
            setKode(event.target.value);
            setFejl('');
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void submit();
          }}
        />
      </label>
      <p className={fejl ? 'err on' : 'err'} id="err" aria-live="polite">
        {fejl}
      </p>
      <button className="btn" id="go" disabled={tjekker} onClick={() => void submit()}>
        {tjekker ? 'Tjekker koden …' : 'Gå til profilen'}
      </button>
    </>
  );
}
