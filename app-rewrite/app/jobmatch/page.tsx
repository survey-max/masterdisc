import type { Metadata } from 'next';

import './portal.css';

import { DataFejl } from '@/app/_components/DataFejl';
import { requireUser } from '@/lib/auth';
import { repository } from '@/lib/data';

import { Portal } from './Portal';

export const metadata: Metadata = {
  title: 'JobMatch · MasterDISC',
  robots: { index: false, follow: false },
};

// The temporary JSON data layer reads from disk, so nothing here may be cached
// at build time.
export const dynamic = 'force-dynamic';

/**
 * public_html/jobmatch/index.php — the part that was rendered once a user was
 * logged in. Who "the user" is comes from the auth mock (lib/auth), because
 * there is no session in fase 1.
 */
export default async function JobmatchPage() {
  try {
    const user = await requireUser();
    const [entries, organisation] = await Promise.all([
      repository.listArchiveEntries(user),
      repository.getOrganisation(user.org),
    ]);
    const admin = user.rolle === 'admin';
    return (
      <Portal
        bruger={{
          navn: user.navn,
          // Same fallback as PHP's a_orgNavn().
          orgNavn: organisation?.navn ?? 'Ukendt virksomhed',
          admin,
        }}
        initialFiler={entries}
        initialVisOrg={admin}
      />
    );
  } catch (error) {
    return (
      <DataFejl
        titel="Portalen kunne ikke vises"
        besked={error instanceof Error ? error.message : 'Ukendt fejl i datalaget.'}
      />
    );
  }
}
