import type { ReactNode } from 'react';

import { requirePortalAccess } from '@/lib/supabase/auth/session';

/**
 * Adgangstjekket for alle sider under /jobmatch/**, ét lag under middlewaren.
 *
 * Middlewaren afviser requesten, før noget renderes; det her tjek sikrer, at en
 * side aldrig kan renderes uden session, selv om matcheren i middleware.ts en
 * dag skulle ramme forkert. Tjekket er server-side og verificeres mod Supabase
 * (getUser), aldrig ud fra noget browseren har sendt.
 *
 * Layoutet tegner ikke noget selv: hver rute har sin egen 1:1-kopi af POC'ens
 * markup og sit eget prefiksede stylesheet, og et ekstra element her ville lande
 * uden for de wrappers.
 */
export default async function JobmatchLayout({ children }: { children: ReactNode }) {
  await requirePortalAccess();
  return <>{children}</>;
}
