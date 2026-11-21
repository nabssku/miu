'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ListTree, Pin, X } from 'lucide-react';
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
  hasTopIsland?: boolean;
  isAIDrawerOpen?: boolean;
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
  isAIDrawerOpen = false,
  onToggleOpen,
  onSelectBlock
}) => {
  const headings = useMemo(() => extractTocHeadings(blocks), [blocks]);
  const [activeId, setActiveId] = useState<string>('');
  const [isHovered, setIsHovered] = useState(false);
  const [isPinnedList, setIsPinnedList] = useState(false);

  useEffect(() => {
    if (headings.length === 0) {
      setActiveId('');
      return;
    }

    let rafId = 0;
    const computeActive = () => {
      rafId = 0;
      const threshold = 150;
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

  if (!isOpen || headings.length === 0) {
    return null;
  }

  const showExpandedCard = isHovered || isPinnedList;

  return (
    <aside
      aria-label="Daftar Isi Halaman"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`fixed top-1/2 -translate-y-1/2 z-20 flex items-center justify-end no-print transition-all duration-200 ${
        isAIDrawerOpen
          ? 'right-3 sm:right-[354px] lg:right-[394px]'
          : 'right-3 sm:right-5'
      }`}
    >
      {/* Expanded Floating List Card on Right-Center */}
      {showExpandedCard && (
        <div className="mr-2 w-60 max-w-[calc(100vw-3rem)] rounded-xl bg-surface/95 backdrop-blur-md border border-border-subtle shadow-[0_12px_32px_-8px_rgba(15,23,42,0.18)] dark:shadow-[0_14px_36px_-8px_rgba(0,0,0,0.65)] p-2.5 space-y-1.5">
          <div className="flex items-center justify-between gap-2 px-1.5 pb-1.5 border-b border-border-subtle/70">
            <div className="flex items-center gap-1.5 min-w-0">
              <ListTree className="w-3.5 h-3.5 text-text-secondary shrink-0" />
              <span className="text-[11px] font-semibold text-text-secondary truncate">
                {noteTitle?.trim() || 'Daftar isi'}
              </span>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsPinnedList((v) => !v)}
                className={`p-1 rounded-md transition ${
                  isPinnedList
                    ? 'bg-subtle text-text-primary'
                    : 'text-text-secondary hover:bg-subtle hover:text-text-primary'
                }`}
                title={isPinnedList ? 'Lepas sematan daftar isi' : 'Sematkan daftar isi tetap terbuka'}
              >
                <Pin className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={onToggleOpen}
                className="p-1 rounded-md hover:bg-subtle text-text-secondary hover:text-text-primary transition"
                title="Sembunyikan daftar isi"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>

          <nav className="space-y-0.5 max-h-[52vh] overflow-y-auto pr-0.5">
            {headings.map((h) => {
              const isActive = activeId === h.id;
              const indentClass =
                h.level === 1 ? 'pl-2' : h.level === 2 ? 'pl-4' : 'pl-6';
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => onSelectBlock(h.id)}
                  title={h.text}
                  className={`w-full text-left py-1 pr-2 ${indentClass} rounded-lg text-[12.5px] transition flex items-center gap-2 ${
                    isActive
                      ? 'bg-subtle text-text-primary font-semibold'
                      : 'text-text-secondary hover:text-text-primary hover:bg-subtle/60'
                  }`}
                >
                  <span
                    className={`shrink-0 rounded-full ${
                      isActive
                        ? 'w-1.5 h-1.5 bg-text-primary'
                        : 'w-1 h-1 bg-text-secondary/40'
                    }`}
                  />
                  <span className="truncate">{h.text}</span>
                </button>
              );
            })}
          </nav>
        </div>
      )}

      {/* Right-Center Vertical List of Tick Bars (Notion Outline Rail) */}
      <div className="py-2 px-1.5 rounded-full flex flex-col items-end gap-2 select-none">
        {headings.slice(0, 24).map((h) => {
          const isActive = activeId === h.id;
          const barWidth =
            h.level === 1 ? 'w-4' : h.level === 2 ? 'w-3' : 'w-2';
          return (
            <button
              key={h.id}
              type="button"
              onClick={() => {
                onSelectBlock(h.id);
                setIsPinnedList((v) => !v);
              }}
              title={h.text}
              className="group/tick py-0.5 flex items-center justify-end focus:outline-none"
            >
              <span
                className={`block h-[2px] rounded-full transition-all duration-150 ${barWidth} ${
                  isActive
                    ? 'bg-text-primary w-4 h-[2.5px]'
                    : 'bg-text-secondary/30 group-hover/tick:bg-text-secondary/70'
                }`}
              />
            </button>
          );
        })}
      </div>
    </aside>
  );
};
