import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1
    },
    {
      url: `${SITE_URL}/app`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.9
    },
    {
      url: `${SITE_URL}/privacy-policy`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.4
    },
    {
      url: `${SITE_URL}/terms-of-service`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.4
    }
  ];
}
