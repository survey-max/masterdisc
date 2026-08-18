import Link from 'next/link';
import type { Metadata } from 'next';

import './privatliv.css';

export const metadata: Metadata = {
  title: 'Privatlivspolitik · MasterDISC',
};

/**
 * Ported 1:1 from public_html/privatliv/index.html — inklusive udkast-boksen og
 * de gule huller. Teksten er ikke rettet: den skal gennemgås af en, der kender
 * den faktiske databehandling, før den kan bruges.
 */
export default function Privatliv() {
  return (
    <>
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
          <div className="todo">
            <b>Udkast — skal gennemgås inden brug</b>
            <p>
              Teksten herunder er et arbejdsudkast, ikke juridisk rådgivning. Alt markeret med gult
              skal udfyldes, og hele dokumentet bør læses igennem af en, der kender jeres faktiske
              databehandling. Slet denne boks, når det er gjort.
            </p>
          </div>

          <div className="card">
            <p className="eyebrow">Juridisk</p>
            <h1>Privatlivspolitik</h1>
            <p className="dato">
              Senest opdateret <mark>dato indsættes</mark>
            </p>

            <h2>Hvem er dataansvarlig</h2>
            <p>
              <mark>Firmanavn</mark>, CVR <mark>nummer</mark>, <mark>adresse</mark>, er dataansvarlig
              for behandlingen af personoplysninger på masterdisc.dk. Spørgsmål rettes til{' '}
              <a href="mailto:pb@coachers.dk">pb@coachers.dk</a>.
            </p>

            <h2>Hvilke oplysninger vi behandler</h2>
            <p>Når du besvarer en MasterDISC-profil, behandler vi:</p>
            <ul>
              <li>Navn og e-mailadresse</li>
              <li>Jobtitel og virksomhed, hvis det oplyses</li>
              <li>Dine svar på de 27 spørgsmål samt de beregnede profilresultater</li>
              <li>Tidspunkt for besvarelsen</li>
            </ul>
            <p>
              Vi indsamler ikke særlige kategorier af personoplysninger. En MasterDISC-profil
              beskriver adfærdspræferencer og er ikke en helbredsoplysning.
            </p>

            <h2>Hvorfor vi behandler dem</h2>
            <p>
              Formålet er at udarbejde den rapport, du eller din arbejdsgiver har bestilt, og at
              kunne genfinde den ved senere opfølgning. Retsgrundlaget er{' '}
              <mark>
                angiv: aftale, jf. art. 6(1)(b), eller legitim interesse, jf. art. 6(1)(f) — afklar
                med rådgiver
              </mark>
              .
            </p>

            <h2>Hvem får adgang</h2>
            <p>
              Din rapport deles med den, der har bestilt profilen — typisk din leder eller den
              konsulent, der gennemfører forløbet. Vi videresælger aldrig oplysninger og bruger dem
              ikke til markedsføring uden dit samtykke.
            </p>
            <p>
              Vi anvender <mark>Simply.com A/S</mark> som databehandler til hosting. Der er indgået
              databehandleraftale.
            </p>

            <h2>Hvor længe vi gemmer</h2>
            <p>
              Profilbesvarelser og rapporter opbevares i <mark>angiv periode, fx 24 måneder</mark> og
              slettes derefter. Er du kandidat i en rekrutteringsproces, slettes din rapport senest{' '}
              <mark>angiv, fx 6 måneder</mark> efter processens afslutning, medmindre du har givet
              samtykke til længere opbevaring.
            </p>

            <h2>Dine rettigheder</h2>
            <p>
              Du har ret til indsigt i de oplysninger, vi har om dig, til at få rettet forkerte
              oplysninger, til at få dem slettet, og til at gøre indsigelse mod behandlingen. Skriv
              til <a href="mailto:pb@coachers.dk">pb@coachers.dk</a>, så svarer vi inden for en
              måned.
            </p>
            <p>
              Er du utilfreds med vores behandling, kan du klage til Datatilsynet, Carl Jacobsens Vej
              35, 2500 Valby — datatilsynet.dk.
            </p>

            <h2>Cookies</h2>
            <p>
              <mark>
                Beskriv de cookies sitet faktisk sætter. Bruger I kun tekniske cookies, skal der ikke
                indhentes samtykke — bruger I statistik eller markedsføring, skal der være en
                cookiebanner.
              </mark>
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
    </>
  );
}
