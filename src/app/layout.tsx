import '@fontsource-variable/inter';
import './globals.css';

import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { Providers } from './providers';

export const metadata: Metadata = {
  title: { default: 'ClearWood Admin', template: '%s · ClearWood Admin' },
  description: 'Operations dashboard for ClearWood Furnitures.',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'same-origin',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#faf7f2',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-IN">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
