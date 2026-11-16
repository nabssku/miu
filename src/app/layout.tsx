import type { Metadata, Viewport } from 'next';
import React from 'react';
import { MiuProvider } from '@/context/MiuContext';
import { MiuShell } from '@/components/shell/MiuShell';
import {
  SITE_DESCRIPTION_DEFAULT,
  SITE_KEYWORDS,
  SITE_NAME,
  SITE_TITLE_DEFAULT,
  SITE_URL
} from '@/lib/seo';
import './globals.css';

const GOOGLE_SITE_VERIFICATION =
  process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim() ||
  'TLq0v856mAv1_JumRHtJ4YDUwcuwXM9ZGUAOCmcN5RU';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE_DEFAULT,
    template: `%s | ${SITE_NAME}`
  },
  description: SITE_DESCRIPTION_DEFAULT,
  applicationName: SITE_NAME,
  keywords: SITE_KEYWORDS,
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: 'Productivity',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/miu-icon.svg', type: 'image/svg+xml' },
      { url: '/icon', sizes: '192x192', type: 'image/png' }
    ],
    shortcut: '/miu-icon.svg',
    apple: [{ url: '/apple-icon', sizes: '180x180', type: 'image/png' }]
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1
    }
  },
  openGraph: {
    type: 'website',
    locale: 'id_ID',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_TITLE_DEFAULT,
    description: SITE_DESCRIPTION_DEFAULT
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE_DEFAULT,
    description: SITE_DESCRIPTION_DEFAULT
  },
  ...(GOOGLE_SITE_VERIFICATION
    ? {
        verification: {
          google: GOOGLE_SITE_VERIFICATION
        }
      }
    : {})
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#EBF5FF' },
    { media: '(prefers-color-scheme: dark)', color: '#161412' }
  ],
  width: 'device-width',
  initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <MiuProvider>
          <MiuShell>{children}</MiuShell>
        </MiuProvider>
      </body>
    </html>
  );
}
