import type { Metadata } from 'next';
import Script from 'next/script';

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
 * pdf.js still comes from cdnjs, exactly as in the POC, so the PDF reading is
 * unchanged. Bundling it locally is a fase 2 question.
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

  return (
    <>
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"
        strategy="beforeInteractive"
      />
      <Tool />
    </>
  );
}
