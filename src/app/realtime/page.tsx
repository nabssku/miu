import type { Metadata } from 'next';
import React from 'react';
import { LiveItemsPanel } from '@/components/realtime/LiveItemsPanel';
import { buildPageMetadata } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: 'Neon Realtime Live Query',
  description: 'Uji dan pantau live query SQL secara real-time menggunakan Neon Realtime SDK.',
  path: '/realtime'
});

export default function RealtimePage() {
  return <LiveItemsPanel />;
}
