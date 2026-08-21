import type { NextRequest } from 'next/server';

import { guardPortalRequest } from './lib/supabase/auth/middleware';

/**
 * Adgangen til JobMatch-portalen afgøres HER, før noget renderes.
 *
 * Hvorfor middleware og ikke kun et tjek i hver side: /jobmatch/** består af
 * server components (portalen, admin, værktøjet), en route handler
 * (/jobmatch/filer/<id>) og server actions, der posterer tilbage til de samme
 * URL'er. Middlewaren er det eneste sted, alle fire slags requests kommer
 * forbi — og den rydder samtidig op i gamle @supabase/ssr-cookies fra før
 * skiftet til portalens egen sessionscookie.
 *
 * Den står ikke alene: hvert af de fire steder spørger selv gennem
 * lib/supabase/auth/session.ts, så en fremtidig rute uden for matcheren nedenfor
 * ikke bliver en åben dør.
 */
export function middleware(request: NextRequest) {
  return guardPortalRequest(request);
}

export const config = {
  // Både med og uden trailing slash: next.config.ts sætter trailingSlash: true,
  // og middlewaren skal fange begge former, ikke kun den normaliserede.
  matcher: ['/jobmatch', '/jobmatch/:path*'],
};
