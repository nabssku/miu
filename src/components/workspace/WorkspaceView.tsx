'use client';

import React from 'react';
import { useMiu } from '@/context/MiuContext';
import { NotePresenceProvider } from '@/context/NotePresenceContext';
import { BlockEditor } from '@/components/workspace/BlockEditor';
import { ExternalAIDrawer } from '@/components/ai/ExternalAIDrawer';
import { NoteRealtimeSync } from '@/components/realtime/NoteRealtimeSync';

export const WorkspaceView: React.FC = () => {
  const { isAIDrawerOpen } = useMiu();

  return (
    <NotePresenceProvider>
      <main className="w-full min-h-screen flex bg-surface text-text-primary">
        <NoteRealtimeSync />
        <div className="flex-1 min-w-0">
          <BlockEditor />
        </div>
        {isAIDrawerOpen && <ExternalAIDrawer />}
      </main>
    </NotePresenceProvider>
  );
};
