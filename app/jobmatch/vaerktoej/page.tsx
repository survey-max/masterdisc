import type { Metadata } from 'next';

import './vaerktoej.css';

import { DataFejl } from '@/app/_components/DataFejl';
import { requireUser } from '@/lib/auth';

import { Tool } from './Tool';

export const metadata: Metadata = {
  title: 'MasterDISC Jobmatch · Rekrutteringsvurdering',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * public_html/jobmatch/vaerktoej.php.
 *
 * The PHP part was `require auth.php` + `a_kraevLogin()` + one CSRF token in the
 * archive POST. The user lookup now goes through the auth mock, and the archive
 * save through a server action.
 *
 * pdf.js (samme 3.11.174 som POC'en) serveres fra public/vendor/pdfjs/ og
 * hentes lazy af lib/jobmatch/pdf.ts, første gang en PDF skal læses. Der er
 * bevidst intet <Script>-tag her: beforeInteractive virker ikke på sideniveau
 * (scriptet blev aldrig indlæst i produktion), og afterInteractive ville bare
 * være en kapløbsbetingelse mod brugerens første filvalg.
 */
export default async function VaerktoejPage() {
  try {
    await requireUser();
  } catch (error) {
    return (
      <DataFejl
        titel="Værktøjet kunne ikke åbnes"
        besked={error instanceof Error ? error.message : 'Ukendt fejl i datalaget.'}
      />
    );
  }

  return <Tool />;
}
