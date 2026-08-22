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
      /**
       * Arkivet tager PDF'er op til 25 MB (MAX_ARCHIVE_BYTES i
       * lib/jobmatch/archive-input.ts), men Next.js afviser server action-bodies
       * over 1 MB som standard — uploaden fejlede, før uploadRapportAction
       * overhovedet blev kaldt. 30 MB = filgrænsen + multipart-overhead.
       */
      bodySizeLimit: '30mb',
    },
  },

  /**
   * Cutover: det gamle statiske site serverede DISC-surveyen på /survey/ og
   * /survey/<virksomhed> (rewrite i masterdisc/vercel.json). I portalen ligger
   * den under /profil/survey/. Eksterne links og QR-koder peger stadig på de
   * gamle stier, så de flyttes med her i stedet for at ende i 404.
   *
   * Permanent (308): stierne er endeligt afløst. Rod-/ er bevidst IKKE med —
   * den tilhører nu portalens forside.
   */
  /**
   * Sikkerhedsheaders. Globalt: nosniff (ingen MIME-gætteri) og en stram
   * referrer-politik. KUN på portalen og login: X-Frame-Options DENY — intet
   * legitimt indlejrer adminportalen i en iframe, og DENY lukker clickjacking.
   * /profil/** holdes udenfor: den statiske DISC-app og surveyen kan være
   * indlejret eksternt, og det må en portal-hærdning ikke knække.
   */
  async headers() {
    const portalOnly = [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ];
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      { source: '/jobmatch/:path*', headers: portalOnly },
      { source: '/login/:path*', headers: portalOnly },
    ];
  },

  async redirects() {
    return [
      { source: '/survey', destination: '/profil/survey/', permanent: true },
      {
        source: '/survey/:companySlug',
        destination: '/profil/survey/:companySlug',
        permanent: true,
      },
    ];
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
