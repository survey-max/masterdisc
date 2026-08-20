import type { Metadata } from 'next';

import './admin.css';

import { DataFejl } from '@/app/_components/DataFejl';
import { requireUser } from '@/lib/auth';
import { repository } from '@/lib/data';

import { AdminForms } from './AdminForms';

export const metadata: Metadata = {
  title: 'Administration · MasterDISC JobMatch',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * public_html/jobmatch/admin.php — kun den indloggede variant. POC'ens
 * førstegangsopsætning (opret administrator + opsat.flag) er ren
 * auth-bootstrap og hører til fase 3.
 */
export default async function AdminPage() {
  try {
    const user = await requireUser();
    if (user.rolle !== 'admin') {
      return (
        <DataFejl titel="Du har ikke adgang til denne side" besked="Siden kræver rollen admin." />
      );
    }

    const [orgs, brugere] = await Promise.all([
      repository.listOrganisations(),
      repository.listUsers(),
    ]);
    const minOrg = orgs.find((o) => o.id === user.org);

    return (
      <AdminForms
        mig={{ id: user.id, navn: user.navn, orgNavn: minOrg?.navn ?? 'Ukendt virksomhed' }}
        orgs={orgs}
        brugere={brugere}
      />
    );
  } catch (error) {
    return (
      <DataFejl
        titel="Administrationen kunne ikke vises"
        besked={error instanceof Error ? error.message : 'Ukendt fejl i datalaget.'}
      />
    );
  }
}
