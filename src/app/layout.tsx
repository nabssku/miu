import type { Metadata, Viewport } from 'next';
import React from 'react';
import { MiuProvider } from '@/context/MiuContext';
import { MiuShell } from '@/components/shell/MiuShell';
import './globals.css';

export const metadata: Metadata = {
  title: 'Miu — Dynamic Ambient Workspace untuk Fokus & Catatan',
  description:
    'Ruang belajar dan catatan bersih dengan Dynamic Island ambien, Pomodoro, Spotify, pengingat cerdas, dan integrasi Cloud Catatan serta AI.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🐱</text></svg>"
  }
};

export const viewport: Viewport = {
  themeColor: '#EBF5FF',
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
