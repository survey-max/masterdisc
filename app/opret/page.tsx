import Link from 'next/link';
import type { Metadata } from 'next';

import './opret.css';

import { KodeForm } from './KodeForm';

export const metadata: Metadata = {
  title: 'Opret din MasterDISC-profil',
};

/**
 * Ported 1:1 from public_html/opret/index.html.
 *
 * `?fejl=` og `?kode=` sættes af /profil/, når DISC-flowet sender respondenten
 * retur (manglende, afvist eller utjekkelig kode). Koden gives med, så den kan
 * rettes frem for at skrives forfra.
 */
export default async function Opret({
  searchParams,
}: {
  searchParams: Promise<{ fejl?: string; kode?: string; profile?: string; company?: string }>;
}) {
  const { fejl = '', kode = '', profile = '', company = '' } = await searchParams;
  return (
    <div className="p-opret">
      <header className="top">
        <div className="shell">
          <div className="toprow">
            <Link className="logo" href="/">
              <span className="dots">
                <i />
                <i />
                <i />
                <i />
              </span>
              <span className="wordmark">Master DISC</span>
            </Link>
            <Link className="back" href="/">
              ← Til forsiden
            </Link>
          </div>
        </div>
        <div className="grad" />
      </header>

      <main>
        <div className="shell wrap">
          <div className="card">
            <p className="eyebrow">Adgang</p>
            <h1>Opret din MasterDISC profil</h1>
            <p className="lede">
              Indtast herunder den adgangskode, du har modtaget af Coachers.
            </p>

            <KodeForm
              initialKode={kode}
              initialFejl={fejl}
              profile={profile}
              company={company}
            />

            <div className="help">
              <b>Har du ikke en kode?</b>
              Adgangskoder udleveres i forbindelse med et forløb eller et køb. Skriv til{' '}
              <a href="mailto:pb@coachers.dk">pb@coachers.dk</a>, så hjælper vi dig videre.
            </div>
          </div>

          <div className="info">
            <b>Sådan forløber det</b>
            <p>
              Besvarelsen tager omkring 15 minutter og består af 27 spørgsmål, hvor du vælger, hvad
              der passer mest og mindst på dig. Sæt tid af til at gøre det i ét stræk — og svar som
              du er, ikke som du tror, du bør være.
            </p>
          </div>
        </div>
      </main>

      <footer className="foot">
        <div className="shell">
          <div className="footrow">
            <span>MasterDISC · Et Finsx-koncept</span>
            <a href="mailto:pb@coachers.dk">pb@coachers.dk</a>
            <span>masterdisc.dk</span>
          </div>
        </div>
        <div className="grad" />
      </footer>
    </div>
  );
}
