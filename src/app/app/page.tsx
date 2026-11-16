import type { Metadata } from 'next';
import React from 'react';
import { WorkspaceView } from '@/components/workspace/WorkspaceView';
import { buildPageMetadata } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: 'Workspace Catatan, Kanban & Kalender',
  description:
    'Tulis catatan blok & LaTeX, kelola tugas di Kanban, atur deadline /deadline yang otomatis masuk Kalender & Google Calendar, dan berdiskusi dengan Voice AI ElevenLabs.',
  path: '/app'
});

export default function WorkspacePage() {
  return <WorkspaceView />;
}
