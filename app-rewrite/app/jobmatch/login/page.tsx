import type { Metadata } from 'next';

import './login.css';

import { LoginForm } from './LoginForm';

export const metadata: Metadata = {
  title: 'Log ind · MasterDISC JobMatch',
  robots: { index: false, follow: false },
};

/**
 * public_html/jobmatch/index.php — login-formularen, kun udseendet.
 *
 * Der er ingen session, ingen password-verifikation, ingen cookie og ingen
 * rate limiting i fase 1: auth-modellen besluttes i fase 3 (se lib/auth). POC'en
 * viste login på samme URL som portalen; her har den sin egen rute, fordi der
 * ikke er nogen session at afgøre det ud fra.
 */
export default function Login() {
  return (
    <div className="p-jm-login">
      <div className="top">
        <div className="shell">
          <div className="dots">
            <i />
            <i />
            <i />
            <i />
          </div>
          <b>Master DISC</b>
          <span>JobMatch</span>
        </div>
      </div>
      <div className="grad" />

      <main>
        <div className="shell wrap">
          <div className="card">
            <p className="eyebrow">Adgang</p>
            <h1>Log ind</h1>
            <p>
              Du får adgang til din virksomheds egne jobmatch. Andre virksomheder kan ikke se jeres.
            </p>

            <LoginForm />

            <p className="hjaelp">
              Har du glemt din adgangskode, eller mangler du adgang? Skriv til{' '}
              <a href="mailto:pb@coachers.dk" style={{ color: 'var(--gold-ink)' }}>
                pb@coachers.dk
              </a>
              .
            </p>
          </div>
        </div>
      </main>

      <footer className="foot">
        <div className="shell">
          <div className="footrow">
            <span>MasterDISC JobMatch · Et Finsx-koncept</span>
            <span>Fortroligt · Må ikke videregives</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
