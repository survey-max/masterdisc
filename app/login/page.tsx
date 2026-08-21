import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import './login.css';

import { getPortalSessionUser } from '@/lib/supabase/auth/session';

import { LoginForm } from './LoginForm';

export const metadata: Metadata = {
  title: 'Log ind · MasterDISC JobMatch',
  robots: { index: false, follow: false },
};

// Siden afhænger af sessionen på hver request og må aldrig caches.
export const dynamic = 'force-dynamic';

/**
 * Udseendet er POC'ens login (public_html/jobmatch/index.php), men adgangen er
 * rigtig nu: Supabase Auth + admin-rolle i user_profiles (se docs/AUTH.md).
 *
 * Login ligger på sin egen rute uden for /jobmatch/**, fordi middlewaren spærrer
 * alt derinde — lå login'et under /jobmatch/, ville en udlogget bruger blive
 * sendt i ring.
 */
const FEJLBESKED: Record<string, string> = {
  // Middlewaren har allerede logget UID'et; brugeren får kun beskeden.
  'ingen-adgang': 'Du har ikke adgang til portalen',
  'opsaetning':
    'Portalen er ikke sat op korrekt, og login er derfor spærret. Skriv til pb@coachers.dk.',
};

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ fejl?: string }>;
}) {
  // Er man allerede logget ind OG admin, er der intet at logge ind på.
  const session = await getPortalSessionUser();
  if (session) redirect('/jobmatch/');

  const { fejl } = await searchParams;
  const initialFejl = (fejl && FEJLBESKED[fejl]) ?? null;

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

            <LoginForm initialFejl={initialFejl} />

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
