import type { NextConfig } from 'next';

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

  experimental: {
    /**
     * Next.js only compares Origin against the host for requests that look
     * forwarded (an x-forwarded-host that differs from Origin). Served from
     * its own root — the *.vercel.app preview, or masterdisc.dk after the
     * cutover — Origin and host are the same and nothing is rejected. The
     * list stays as the safety net for the day a proxy or an extra domain is
     * put in front again; a new domain there must be added here too.
     */
    serverActions: {
      allowedOrigins: ['masterdisc.dk', 'www.masterdisc.dk'],
    },
  },

  async rewrites() {
    return [
      // Next.js does not do directory-index resolution for files in public/,
      // so the static MasterDISC entry points are mapped explicitly.
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
