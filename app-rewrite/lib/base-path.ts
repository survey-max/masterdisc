/**
 * The single place the deployment prefix is written down.
 *
 * The app runs as its own Vercel project but is reached through
 * masterdisc.dk/app-rewrite, which proxies to it. next.config.ts feeds this to
 * `basePath`, which is enough for every <Link>, every route and every file in
 * public/ — Next.js prefixes those itself.
 *
 * Import it only where Next.js cannot do the prefixing: URLs built by hand at
 * runtime, such as window.location.assign() to a static file in public/.
 *
 * Set it to '' to serve the app at a domain root again.
 */
export const BASE_PATH = '/app-rewrite';
