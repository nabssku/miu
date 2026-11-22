'use client';

import React from 'react';
import { useMiu } from '@/context/MiuContext';
import { NotePresenceProvider } from '@/context/NotePresenceContext';
import { BlockEditor } from '@/components/workspace/BlockEditor';
import { ExternalAIDrawer } from '@/components/ai/ExternalAIDrawer';
import { MiuAIFaceIcon } from '@/components/ai/MiuAIFaceIcon';
import { NoteRealtimeSync } from '@/components/realtime/NoteRealtimeSync';

export const WorkspaceView: React.FC = () => {
  const { isAIDrawerOpen, setIsAIDrawerOpen, islandPosition } = useMiu();

  return (
    <NotePresenceProvider>
      <main className="w-full h-dvh max-h-dvh overflow-hidden flex bg-surface text-text-primary relative print:h-auto print:max-h-none print:overflow-visible">
        <NoteRealtimeSync />
        <div className="flex-1 min-w-0 h-full overflow-hidden print:h-auto print:overflow-visible">
          <BlockEditor />
        </div>
        {isAIDrawerOpen ? (
          <ExternalAIDrawer />
        ) : (
          <button
            type="button"
            onClick={() => setIsAIDrawerOpen(true)}
            title="Tanya Miu AI"
            aria-label="Buka Asisten Miu AI"
            className={`fixed right-5 z-40 w-11 h-11 rounded-full bg-surface/95 backdrop-blur-md border border-border-subtle text-text-primary shadow-[0_6px_24px_-4px_rgba(15,23,42,0.16)] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.65)] hover:scale-105 hover:border-text-secondary/40 active:scale-95 transition-all flex items-center justify-center no-print ${
              islandPosition === 'bottom-right' ? 'bottom-16' : 'bottom-5'
            }`}
          >
            <MiuAIFaceIcon className="w-5 h-5" />
          </button>
        )}
      </main>
    </NotePresenceProvider>
  );
};
