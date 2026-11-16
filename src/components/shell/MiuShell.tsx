'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useMiu } from '@/context/MiuContext';
import { DynamicIsland } from '@/components/island/DynamicIsland';
import { LazyshotOverlay } from '@/components/lazyshot/LazyshotOverlay';
import { SupportModal } from '@/components/support/SupportModal';

export const MiuShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isReady } = useMiu();
  const pathname = usePathname();
  const needsWorkspaceHydration = Boolean(pathname?.startsWith('/app'));

  return (
    <div className="min-h-screen relative">
      {/* Persistent Hover-to-Open Dynamic Island */}
      <DynamicIsland />

      {needsWorkspaceHydration && !isReady ? (
        <div className="min-h-screen flex items-center justify-center text-sm text-text-secondary">
          Menyiapkan ruang kerja lokal Miu...
        </div>
      ) : (
        children
      )}

      {/* Lazyshot Clipper, Annotator & Local OCR Overlay */}
      <LazyshotOverlay />

      {/* Traktir Kopi & Lapor Bug Modal */}
      <SupportModal />
    </div>
  );
};
