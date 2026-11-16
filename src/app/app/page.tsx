'use client';

import React from 'react';
import { useMiu } from '@/context/MiuContext';
import { BlockEditor } from '@/components/workspace/BlockEditor';
import { ExternalAIDrawer } from '@/components/ai/ExternalAIDrawer';

export default function WorkspacePage() {
  const { isAIDrawerOpen } = useMiu();

  return (
    <main className="w-full min-h-screen flex bg-surface text-text-primary">
      <div className="flex-1 min-w-0">
        <BlockEditor />
      </div>
      {isAIDrawerOpen && <ExternalAIDrawer />}
    </main>
  );
}
