'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ListTree, X } from 'lucide-react';
import type { NoteBlock } from '../../types/miu';
import { flattenBlocks } from '../../utils/blockTreeHelper';
import { stripInlineMarkdown } from '../../utils/markdown';

export interface TocHeadingItem {
  id: string;
  level: 1 | 2 | 3;
  text: string;
}

interface FloatingTocOutlineProps {
  blocks: NoteBlock[];
  noteTitle?: string;
  isOpen: boolean;
  onToggleOpen: () => void;
  onSelectBlock: (blockId: string) => void;
}

export function extractTocHeadings(blocks: NoteBlock[] | undefined): TocHeadingItem[] {
  const flat = flattenBlocks(blocks);
  const headings: TocHeadingItem[] = [];
  for (const blk of flat) {
    if (blk.type === 'h1' || blk.type === 'h2' || blk.type === 'h3') {
      const level = blk.type === 'h1' ? 1 : blk.type === 'h2' ? 2 : 3;
      const cleaned = stripInlineMarkdown(blk.content || '').trim();
      headings.push({
        id: blk.id,
        level,
        text: cleaned || `Heading ${level}`
      });
    }
  }
  return headings;
}

export const FloatingTocOutline: React.FC<FloatingTocOutlineProps> = ({
  blocks,
  noteTitle,
  isOpen,
  onToggleOpen,
  onSelectBlock
}) => {
  const headings = useMemo(() => extractTocHeadings(blocks), [blocks]);
  const [activeId, setActiveId] = useState<string>('');
  const [isHoverPreview, setIsHoverPreview] = useState(false);

  useEffect(() => {
    if (headings.length === 0) {
      setActiveId('');
      return;
    }

    let rafId = 0;
    const computeActive = () => {
      rafId = 0;
      const threshold = 136;
      let current = headings[0]?.id || '';
      for (const h of headings) {
        const escaped = h.id.replace(/"/g, '\\"');
        const el = document.querySelector<HTMLElement>(`[data-miu-block-id="${escaped}"]`);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top <= threshold) {
          current = h.id;
        } else {
          break;
        }
      }
      setActiveId((prev) => (prev === current ? prev : current));
    };

    const onScrollOrResize = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(computeActive);
    };

    computeActive();
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize, { passive: true });
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [headings]);

  if (headings.length === 0) {
    return null;
  }

  const renderHeadingList = (compact = false) => (
    <nav aria-label="Daftar Isi Catatan" className="space-y-0.5 max-h-[60vh] overflow-y-auto pr-1">
      {headings.map((h) => {
        const isActive = activeId === h.id;
        const indentClass = h.level === 1 ? 'pl-2' : h.level === 2 ? 'pl-4' : 'pl-6';
        return (
          <button
            key={h.id}
            type="button"
            onClick={() => onSelectBlock(h.id)}
            title={h.text}
            className={`w-full text-left py-1 pr-2 ${indentClass} rounded-lg transition flex items-center gap-1.5 ${
              isActive
                ? 'bg-accent-strong/12 text-accent-strong font-semibold'
                : 'text-text-secondary hover:text-text-primary hover:bg-subtle/70'
            } ${compact ? 'text-[11px]' : 'text-xs'}`}
          >
            <span
              className={`shrink-0 rounded-full transition-all ${
                isActive
                  ? 'w-1.5 h-1.5 bg-accent-strong'
                  : h.level === 1
                    ? 'w-1.5 h-1.5 bg-text-secondary/40'
                    : 'w-1 h-1 bg-text-secondary/30'
              }`}
            />
            <span
              className={`truncate ${
                h.level === 1 ? 'font-semibold' : h.level === 2 ? 'font-medium' : 'font-normal'
              }`}
            >
              {h.text}
            </span>
          </button>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Mobile & Medium Screens: Popover when toggled open from header */}
      {isOpen && (
        <div className="xl:hidden fixed top-14 right-4 z-30 w-72 max-w-[calc(100vw-2rem)] miu-card shadow-2xl p-3 space-y-2.5 no-print">
          <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-border-subtle">
            <div className="flex items-center gap-1.5 min-w-0">
              <ListTree className="w-3.5 h-3.5 text-accent-strong shrink-0" />
              <span className="text-xs font-bold text-text-primary truncate">
                {noteTitle?.trim() || 'Daftar Isi'}
              </span>
            </div>
            <button
              type="button"
              onClick={onToggleOpen}
              className="p-1 rounded-md hover:bg-subtle text-text-secondary hover:text-text-primary transition"
              title="Tutup Daftar Isi"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {renderHeadingList(false)}
        </div>
      )}

      {/* Desktop XL+: Sticky Floating Right-Side Rail (Pinned Card or Minimalist Notion Minimap) */}
      <aside
        className="hidden xl:flex flex-col sticky top-20 self-start shrink-0 mr-4 z-20 no-print"
        onMouseEnter={() => setIsHoverPreview(true)}
        onMouseLeave={() => setIsHoverPreview(false)}
      >
        {isOpen ? (
          <div className="w-56 miu-card shadow-sm border border-border-subtle/80 bg-surface/90 backdrop-blur-md p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-border-subtle/70">
              <div className="flex items-center gap-1.5 min-w-0">
                <ListTree className="w-3.5 h-3.5 text-accent-strong shrink-0" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                  Daftar Isi
                </span>
                <span className="px-1.5 py-0.2 rounded-full bg-subtle text-[10px] font-mono text-text-secondary">
                  {headings.length}
                </span>
              </div>
              <button
                type="button"
                onClick={onToggleOpen}
                className="p-0.5 rounded hover:bg-subtle text-text-secondary hover:text-text-primary transition"
                title="Perkecil ke minimap"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {renderHeadingList(true)}
          </div>
        ) : (
          <div className="relative flex flex-col items-end">
            <button
              type="button"
              onClick={onToggleOpen}
              title="Buka Daftar Isi (Outline)"
              className="px-2 py-2.5 rounded-xl hover:bg-subtle/70 transition flex flex-col items-end gap-1.5"
            >
              {headings.slice(0, 18).map((h) => {
                const isActive = activeId === h.id;
                const barWidth =
                  h.level === 1 ? 'w-5' : h.level === 2 ? 'w-3.5' : 'w-2';
                return (
                  <span
                    key={h.id}
                    className={`h-[2.5px] rounded-full transition-all ${barWidth} ${
                      isActive
                        ? 'bg-accent-strong scale-x-110'
                        : 'bg-text-secondary/35'
                    }`}
                  />
                );
              })}
            </button>

            {isHoverPreview && (
              <div className="absolute right-0 top-0 w-56 miu-card shadow-xl border border-border-subtle bg-surface/95 backdrop-blur-md p-3 space-y-2 z-30">
                <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-border-subtle/70">
                  <div className="flex items-center gap-1.5">
                    <ListTree className="w-3.5 h-3.5 text-accent-strong" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                      Daftar Isi
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={onToggleOpen}
                    className="text-[10px] font-semibold text-accent-strong hover:underline"
                  >
                    Sematkan
                  </button>
                </div>
                {renderHeadingList(true)}
              </div>
            )}
          </div>
        )}
      </aside>
    </>
  );
};
