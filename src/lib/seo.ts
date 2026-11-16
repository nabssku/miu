import type { Metadata } from 'next';

const RAW_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://miu.kodelokal.store';

export const SITE_URL = RAW_SITE_URL.replace(/\/+$/, '');
export const SITE_NAME = 'Miu Workspace';
export const SITE_TITLE_DEFAULT =
  'Miu — Dynamic Ambient Workspace untuk Fokus, Catatan, Kanban & Kalender AI';
export const SITE_DESCRIPTION_DEFAULT =
  'Ruang kerja local-first dengan Dynamic Island ambien, editor catatan blok & LaTeX, papan Kanban, Kalender dengan Google Calendar, Pomodoro, musik fokus, dan Voice AI ElevenLabs.';

export const SITE_KEYWORDS = [
  'Miu Workspace',
  'Miu kodelokal',
  'aplikasi catatan online gratis',
  'workspace produktivitas',
  'dynamic island web',
  'catatan notion alternatif indonesia',
  'kanban catatan online',
  'kalender deadline google calendar',
  'pomodoro timer fokus',
  'asisten ai voice elevenlabs',
  'local-first workspace'
];

export const LANDING_FAQ_ITEMS = [
  {
    q: 'Beneran gratis selamanya?',
    a: 'Ya, 100% gratis tanpa iklan dan tanpa wajib login. Fitur AI menggunakan API Key milikmu sendiri (BYOK).'
  },
  {
    q: 'Apakah catatan dan suara saya aman?',
    a: 'Seluruh catatan, To-do, Board, Screen Time, dan dikte suara disimpan dan diproses 100% lokal di browser perangkatmu.'
  },
  {
    q: 'Berat nggak di laptop?',
    a: 'Sangat ringan. Saat tab tidak aktif, animasi otomatis dijeda. Fitur seperti dikte suara dan OCR hanya dimuat saat kamu menyalakannya.'
  },
  {
    q: 'Bisa dipakai tanpa internet?',
    a: 'Bisa. Mencatat, Pomodoro, To-do, Board, White Noise, Lazytype, dan Lazyshot berjalan penuh secara offline.'
  }
] as const;

interface BuildPageMetadataInput {
  title?: string;
  description: string;
  path: string;
  keywords?: string[];
  noIndex?: boolean;
}

export function buildPageMetadata({
  title,
  description,
  path,
  keywords,
  noIndex = false
}: BuildPageMetadataInput): Metadata {
  const canonicalPath = path === '/' ? '/' : path;
  const fullUrl = canonicalPath === '/' ? SITE_URL : `${SITE_URL}${canonicalPath}`;
  const socialTitle = title ? `${title} | ${SITE_NAME}` : SITE_TITLE_DEFAULT;

  return {
    ...(title ? { title } : {}),
    description,
    keywords: keywords ?? SITE_KEYWORDS,
    alternates: {
      canonical: canonicalPath
    },
    robots: {
      index: !noIndex,
      follow: true,
      googleBot: {
        index: !noIndex,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1
      }
    },
    openGraph: {
      type: 'website',
      locale: 'id_ID',
      url: fullUrl,
      siteName: SITE_NAME,
      title: socialTitle,
      description,
      ...(canonicalPath !== '/'
        ? {
            images: [
              {
                url: '/opengraph-image',
                width: 1200,
                height: 630,
                alt: socialTitle
              }
            ]
          }
        : {})
    },
    twitter: {
      card: 'summary_large_image',
      title: socialTitle,
      description,
      ...(canonicalPath !== '/'
        ? {
            images: [
              {
                url: '/twitter-image',
                width: 1200,
                height: 630,
                alt: socialTitle
              }
            ]
          }
        : {})
    }
  };
}
