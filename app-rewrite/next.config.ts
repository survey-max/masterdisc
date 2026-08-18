import type { NextConfig } from 'next';

import { BASE_PATH } from './lib/base-path';

/**
 * The POC served directory URLs (/opret/, /privatliv/, /jobmatch/) through
 * Apache's DirectoryIndex, and the embedded MasterDISC copy under
 * public/profil/ resolves every asset relatively (assets/…, locales/da.json,
 * disc_udsagn_da_3.0.csv). Trailing slashes keep both working: /profil/ is
 * what makes those relative paths resolve inside /profil/ instead of at the
 * site root.
 */
const nextConfig: NextConfig = {
  trailingSlash: true,

  /**
   * The app is deployed as its own Vercel project but reached through
   * masterdisc.dk/app-rewrite, which proxies to it (see masterdisc/vercel.json).
   * basePath makes the app emit every route, every _next/ asset and every
   * public/ file under that same prefix, so the single proxy rule covers all of
   * it and nothing escapes to the static site's root.
   */
  basePath: BASE_PATH,

  experimental: {
    /**
     * Server Actions reject a POST whose Origin does not match the host they
     * think they are running on. Behind the proxy the browser sends
     * Origin: https://masterdisc.dk while the app sees its own *.vercel.app
     * host, so without this every form submit fails with "Invalid Server
     * Actions request".
     */
    serverActions: {
      allowedOrigins: ['masterdisc.dk', 'www.masterdisc.dk'],
    },
  },

  async rewrites() {
    return [
      // Next.js does not do directory-index resolution for files in public/,
      // so the static MasterDISC entry points are mapped explicitly.
      // Sources and destinations are automatically prefixed with basePath.
      { source: '/profil', destination: '/profil/index.html' },
      { source: '/profil/survey', destination: '/profil/survey/index.html' },

      // Replaces masterdisc/vercel.json's rewrite of /survey/:companySlug.
      // survey/index.html reads the slug from the URL path, so the URL must
      // keep the slug while the file itself is served from a fixed path.
      { source: '/profil/survey/:companySlug', destination: '/profil/survey/index.html' },
    ];
  },
};

export default nextConfig;
