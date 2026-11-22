'use client';

import React, { useEffect } from 'react';
import { Keyboard, X } from 'lucide-react';
import { NOTE_SHORTCUT_GROUPS } from '../../utils/editorShortcuts';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] bg-slate-950/50 backdrop-blur-[2px] flex items-center justify-center p-4 no-print"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl max-h-[82vh] bg-surface border border-border-subtle rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border-subtle flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-sky-500/12 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <Keyboard className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-text-primary">
                Pintasan Keyboard Catatan Miu
              </h2>
              <p className="text-[11px] text-text-secondary">
                Semua pintasan mendukung Command (⌘) di macOS maupun Ctrl di Windows/Linux
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-secondary hover:bg-subtle hover:text-text-primary transition"
            aria-label="Tutup panduan pintasan"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
          {NOTE_SHORTCUT_GROUPS.map((group) => (
            <section key={group.title} className="space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary px-1">
                {group.title}
              </h3>
              <div className="rounded-xl border border-border-subtle/80 bg-subtle/35 divide-y divide-border-subtle/60">
                {group.items.map((item) => (
                  <div
                    key={item.keys + item.label}
                    className="px-3 py-2 flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="text-text-primary leading-snug">{item.label}</span>
                    <kbd className="px-2 py-0.5 rounded-md bg-surface border border-border-subtle text-[10.5px] font-mono text-text-secondary shrink-0 whitespace-nowrap shadow-[0_1px_0_rgba(15,23,42,0.06)]">
                      {item.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="px-5 py-2.5 border-t border-border-subtle bg-subtle/30 flex items-center justify-between text-[11px] text-text-secondary shrink-0">
          <span>Tip: Ketik <code className="px-1 py-0.5 rounded bg-surface border border-border-subtle font-mono">/</code> di baris kosong untuk membuka Slash Command.</span>
          <span className="font-mono">Tekan Esc atau ⌘/ untuk tutup</span>
        </div>
      </div>
    </div>
  );
};
