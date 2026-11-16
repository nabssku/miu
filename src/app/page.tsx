import type { Metadata } from 'next';
import React from 'react';
import { LandingPage } from '@/components/landing/LandingPage';
import {
  buildPageMetadata,
  LANDING_FAQ_ITEMS,
  SITE_DESCRIPTION_DEFAULT,
  SITE_NAME,
  SITE_TITLE_DEFAULT,
  SITE_URL
} from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({
  description: SITE_DESCRIPTION_DEFAULT,
  path: '/'
});

export default function HomePage() {
  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL,
      inLanguage: 'id-ID',
      description: SITE_DESCRIPTION_DEFAULT
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: SITE_NAME,
      applicationCategory: 'ProductivityApplication',
      operatingSystem: 'Web',
      url: SITE_URL,
      description: SITE_DESCRIPTION_DEFAULT,
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'IDR'
      },
      featureList: [
        'Dynamic Island Ambient Workspace',
        'Editor Catatan Blok, KaTeX & PDF Preview',
        'Papan Kanban & Kalender dengan Blok /deadline',
        'Sinkronisasi Google Calendar Opsional',
        'Pomodoro Timer Web Worker & White Noise Mixer',
        'Asisten AI & Conversational Voice AI ElevenLabs'
      ],
      headline: SITE_TITLE_DEFAULT
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: LANDING_FAQ_ITEMS.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.a
        }
      }))
    }
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, '\\u003c')
        }}
      />
      <LandingPage />
    </>
  );
}
