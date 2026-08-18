import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'MasterDISC · Individualiserede adfærdsprofiler',
  description:
    'MasterDISC er en ny generation af DISC. Hver rapport skræddersys til personens konkrete jobrolle — og du får to grafer i stedet for én.',
};

/**
 * No global stylesheet on purpose: every POC page carried its own complete
 * <style> block, and those blocks are kept 1:1 as one CSS file per route.
 * Next.js loads CSS per route, so identical class names on different pages do
 * not collide.
 *
 * Inter is loaded from Google Fonts exactly as the POC did it, so the
 * typography is unchanged.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="da">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
