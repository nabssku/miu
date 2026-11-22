'use client';

import React, { useEffect, useState } from 'react';
import {
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ChevronsRight,
  Copy,
  FileText,
  Globe,
  Link2,
  Maximize2,
  MoreHorizontal,
  Plus,
  Square,
  Star
} from 'lucide-react';
import type { NoteBlock, NoteFontStyle, NoteRecord } from '../../types/miu';
import { renderInlineMarkdown } from '../../utils/markdown';
import { MermaidBlockView } from './blocks/MermaidBlockView';
import { SimpleTableBlockView } from './blocks/SimpleTableBlockView';

interface SidePeekPanelProps {
  note: NoteRecord | null;
  allNotes: NoteRecord[];
  onClose: () => void;
  onExpandToFullPage: (noteId: string) => void;
  onOpenNoteInSidePeek: (noteId: string) => void;
  onUpdateSidePeekNote: (noteId: string, patch: Partial<NoteRecord>) => Promise<void>;
  onCopyLink: (note: NoteRecord) => void;
  onDuplicate: (note: NoteRecord) => void;
  onDelete: (note: NoteRecord) => void;
}

export const SidePeekPanel: React.FC<SidePeekPanelProps> = ({
  note,
  allNotes,
  onClose,
  onExpandToFullPage,
  onOpenNoteInSidePeek,
  onUpdateSidePeekNote,
  onCopyLink,
  onDuplicate,
  onDelete
}) => {
  const [width, setWidth] = useState(560);
  const [isResizing, setIsResizing] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [openToggles, setOpenToggles] = useState<Record<string, boolean>>({});
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem('miu_side_peek_width'));
      if (Number.isFinite(saved) && saved >= 360 && saved <= 1000) {
        setWidth(saved);
      }
    } catch {
      // ignore
    }
  }, []);

  if (!note) return null;

  const handleStartResize = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = width;
    let didDrag = false;
    let latestWidth = startWidth;
    setIsResizing(true);

    const onMouseMove = (moveEvent: MouseEvent) => {
      // Dragging left increases right-panel width; dragging right decreases it
      const delta = startX - moveEvent.clientX;
      if (Math.abs(delta) > 3) {
        didDrag = true;
      }
      if (didDrag) {
        const maxAllowed =
          typeof window !== 'undefined' ? Math.floor(window.innerWidth * 0.78) : 960;
        latestWidth = Math.max(360, Math.min(maxAllowed, startWidth + delta));
        setWidth(latestWidth);
      }
    };

    const onMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (!didDrag) {
        onClose();
      } else {
        try {
          window.localStorage.setItem('miu_side_peek_width', String(latestWidth));
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const fontStyle: NoteFontStyle = note.fontStyle || 'default';
  const noteFontFamily =
    fontStyle === 'serif'
      ? 'Georgia, Cambria, "Times New Roman", Times, serif'
      : fontStyle === 'mono'
        ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
        : 'inherit';

  const handleUpdateBlockContent = async (blockId: string, nextContent: string) => {
    const nextBlocks = note.blocks.map((b) =>
      b.id === blockId ? { ...b, content: nextContent } : b
    );
    await onUpdateSidePeekNote(note.id, {
      blocks: nextBlocks,
      updatedAt: Date.now()
    });
  };

  const handleToggleBlockCheck = async (blockId: string) => {
    const nextBlocks = note.blocks.map((b) =>
      b.id === blockId ? { ...b, checked: !b.checked } : b
    );
    await onUpdateSidePeekNote(note.id, {
      blocks: nextBlocks,
      updatedAt: Date.now()
    });
  };

  const handleAppendBlock = async () => {
    const newBlk: NoteBlock = {
      id: `blk-sp-${Date.now()}`,
      type: 'text',
      content: ''
    };
    const nextBlocks = [...note.blocks, newBlk];
    await onUpdateSidePeekNote(note.id, {
      blocks: nextBlocks,
      updatedAt: Date.now()
    });
    setEditingBlockId(newBlk.id);
  };

  const childSubpages = allNotes.filter((n) => n.parentId === note.id);

  const renderSidePeekBlock = (blk: NoteBlock, index: number) => {
    const isEditing = editingBlockId === blk.id;

    if (blk.type === 'divider') {
      return <hr key={blk.id} className="my-3 border-border-subtle" />;
    }

    if (blk.type === 'subpage') {
      const targetSub = allNotes.find((n) => n.id === blk.subpageId);
      return (
        <button
          key={blk.id}
          type="button"
          onClick={() => {
            if (blk.subpageId) {
              onOpenNoteInSidePeek(blk.subpageId);
            }
          }}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-subtle text-text-primary font-medium text-[14px] transition text-left"
        >
          <span>{targetSub?.icon || blk.subpageIcon || '📄'}</span>
          <span className="underline decoration-border-subtle underline-offset-4 truncate">
            {targetSub?.title || blk.content || 'Subhalaman'}
          </span>
        </button>
      );
    }

    if (blk.type === 'callout') {
      return (
        <div
          key={blk.id}
          onClick={() => setEditingBlockId(blk.id)}
          className="my-2 rounded-xl border border-border-subtle bg-subtle/45 p-3.5 flex items-start gap-3"
        >
          <span className="text-lg leading-none select-none shrink-0 mt-0.5">
            {blk.calloutIcon || '📘'}
          </span>
          <div className="min-w-0 flex-1 text-[13.5px] leading-relaxed text-text-primary whitespace-pre-wrap">
            {isEditing ? (
              <textarea
                autoFocus
                rows={Math.max(2, (blk.content || '').split('\n').length)}
                value={blk.content}
                onChange={(e) => void handleUpdateBlockContent(blk.id, e.target.value)}
                onBlur={() => setEditingBlockId(null)}
                className="w-full bg-transparent focus:outline-none resize-none"
              />
            ) : (
              renderInlineMarkdown(blk.content || '')
            )}
          </div>
        </div>
      );
    }

    if (blk.type === 'code') {
      return (
        <div
          key={blk.id}
          className="my-2 rounded-xl bg-slate-900 text-slate-100 p-3.5 font-mono text-[12.5px] overflow-x-auto"
        >
          {blk.language && (
            <div className="text-[10.5px] uppercase tracking-wider text-slate-400 mb-1.5 font-sans">
              {blk.language}
            </div>
          )}
          <pre className="whitespace-pre-wrap break-words">{blk.content}</pre>
        </div>
      );
    }

    if (blk.type === 'mermaid') {
      return (
        <div key={blk.id} className="my-2">
          <MermaidBlockView
            block={blk}
            theme="light"
            canEdit={true}
            onChangeCode={(nextCode) => void handleUpdateBlockContent(blk.id, nextCode)}
            onChangeCaption={(caption) => {
              const nextBlocks = note.blocks.map((b) =>
                b.id === blk.id ? { ...b, caption } : b
              );
              void onUpdateSidePeekNote(note.id, {
                blocks: nextBlocks,
                updatedAt: Date.now()
              });
            }}
          />
        </div>
      );
    }

    if (blk.type === 'table') {
      return (
        <div key={blk.id} className="my-2">
          <SimpleTableBlockView
            block={blk}
            canEdit={true}
            onUpdateTable={(nextData, previewContent) => {
              const nextBlocks = note.blocks.map((b) =>
                b.id === blk.id
                  ? { ...b, tableData: nextData, content: previewContent }
                  : b
              );
              void onUpdateSidePeekNote(note.id, {
                blocks: nextBlocks,
                updatedAt: Date.now()
              });
            }}
          />
        </div>
      );
    }

    if (blk.type === 'image' && blk.content) {
      return (
        <figure key={blk.id} className="my-2.5 space-y-1">
          <img
            src={blk.content}
            alt={blk.caption || 'Gambar catatan'}
            className="rounded-xl max-h-80 object-contain border border-border-subtle"
          />
          {blk.caption && (
            <figcaption className="text-xs text-text-secondary">{blk.caption}</figcaption>
          )}
        </figure>
      );
    }

    if (blk.type === 'todo' || blk.type === 'deadline') {
      return (
        <div key={blk.id} className="flex items-start gap-2.5 py-1">
          <button
            type="button"
            onClick={() => void handleToggleBlockCheck(blk.id)}
            className="mt-0.5 text-text-secondary hover:text-text-primary shrink-0"
          >
            {blk.checked ? (
              <CheckSquare className="w-4 h-4 text-sky-600" />
            ) : (
              <Square className="w-4 h-4" />
            )}
          </button>
          <div
            onClick={() => setEditingBlockId(blk.id)}
            className={`min-w-0 flex-1 text-[14px] leading-relaxed ${
              blk.checked ? 'line-through text-text-secondary' : 'text-text-primary'
            }`}
          >
            {isEditing ? (
              <input
                type="text"
                autoFocus
                value={blk.content}
                onChange={(e) => void handleUpdateBlockContent(blk.id, e.target.value)}
                onBlur={() => setEditingBlockId(null)}
                className="w-full bg-transparent focus:outline-none"
              />
            ) : (
              renderInlineMarkdown(blk.content || 'Tugas...')
            )}
          </div>
        </div>
      );
    }

    if (blk.type === 'toggle') {
      const isOpen = Boolean(openToggles[blk.id]);
      return (
        <div key={blk.id} className="py-1">
          <button
            type="button"
            onClick={() =>
              setOpenToggles((prev) => ({ ...prev, [blk.id]: !prev[blk.id] }))
            }
            className="flex items-start gap-1.5 text-left font-medium text-[14px] text-text-primary hover:bg-subtle/60 px-1.5 py-1 rounded-lg w-full"
          >
            {isOpen ? (
              <ChevronDown className="w-4 h-4 mt-0.5 shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 mt-0.5 shrink-0" />
            )}
            <span>{renderInlineMarkdown(blk.content || 'Toggle')}</span>
          </button>
          {isOpen && blk.toggleBody && (
            <div className="pl-6 pr-2 py-1.5 text-[13.5px] text-text-secondary whitespace-pre-wrap leading-relaxed">
              {renderInlineMarkdown(blk.toggleBody)}
            </div>
          )}
        </div>
      );
    }

    if (blk.type === 'h1' || blk.type === 'h2' || blk.type === 'h3') {
      const sizeClass =
        blk.type === 'h1'
          ? 'text-[22px] font-bold mt-5 mb-1.5'
          : blk.type === 'h2'
            ? 'text-[18px] font-bold mt-4 mb-1'
            : 'text-[15.5px] font-semibold mt-3 mb-0.5';
      return (
        <div
          key={blk.id}
          onClick={() => setEditingBlockId(blk.id)}
          className={`${sizeClass} text-text-primary leading-snug cursor-text`}
        >
          {isEditing ? (
            <input
              type="text"
              autoFocus
              value={blk.content}
              onChange={(e) => void handleUpdateBlockContent(blk.id, e.target.value)}
              onBlur={() => setEditingBlockId(null)}
              className="w-full bg-transparent focus:outline-none"
            />
          ) : (
            renderInlineMarkdown(blk.content || 'Subjudul')
          )}
        </div>
      );
    }

    if (blk.type === 'bullet' || blk.type === 'numbered') {
      return (
        <div
          key={blk.id}
          onClick={() => setEditingBlockId(blk.id)}
          className="flex items-start gap-2.5 py-0.5 text-[14px] leading-relaxed text-text-primary cursor-text"
        >
          <span className="text-text-secondary select-none shrink-0 mt-0.5">
            {blk.type === 'bullet' ? '•' : `${index + 1}.`}
          </span>
          <div className="min-w-0 flex-1">
            {isEditing ? (
              <input
                type="text"
                autoFocus
                value={blk.content}
                onChange={(e) => void handleUpdateBlockContent(blk.id, e.target.value)}
                onBlur={() => setEditingBlockId(null)}
                className="w-full bg-transparent focus:outline-none"
              />
            ) : (
              renderInlineMarkdown(blk.content || '')
            )}
          </div>
        </div>
      );
    }

    if (blk.type === 'quote') {
      return (
        <blockquote
          key={blk.id}
          onClick={() => setEditingBlockId(blk.id)}
          className="my-1.5 pl-3.5 border-l-3 border-text-primary/40 italic text-[14px] text-text-secondary leading-relaxed cursor-text"
        >
          {isEditing ? (
            <input
              type="text"
              autoFocus
              value={blk.content}
              onChange={(e) => void handleUpdateBlockContent(blk.id, e.target.value)}
              onBlur={() => setEditingBlockId(null)}
              className="w-full bg-transparent focus:outline-none"
            />
          ) : (
            renderInlineMarkdown(blk.content || '')
          )}
        </blockquote>
      );
    }

    return (
      <div
        key={blk.id}
        onClick={() => setEditingBlockId(blk.id)}
        className="py-1 text-[14px] leading-relaxed text-text-primary whitespace-pre-wrap cursor-text min-h-[26px]"
      >
        {isEditing ? (
          <textarea
            autoFocus
            rows={Math.max(1, (blk.content || '').split('\n').length)}
            value={blk.content}
            onChange={(e) => void handleUpdateBlockContent(blk.id, e.target.value)}
            onBlur={() => setEditingBlockId(null)}
            placeholder="Ketik isi catatan..."
            className="w-full bg-transparent focus:outline-none resize-none"
          />
        ) : blk.content ? (
          renderInlineMarkdown(blk.content)
        ) : (
          <span className="text-text-secondary/45">Klik untuk menulis...</span>
        )}
      </div>
    );
  };

  return (
    <aside
      style={{ width: `${width}px` }}
      className="h-full overflow-hidden z-20 shrink-0 border-l border-border-subtle bg-surface text-text-primary flex flex-col relative shadow-[-10px_0_30px_-14px_rgba(15,23,42,0.12)] no-print"
    >
      {/* Left-Edge Drag-to-Resize & Click-to-Close Handle with Tooltip (Matches image_4.png) */}
      <div
        onMouseDown={handleStartResize}
        className={`group/spresizer absolute top-0 -left-1 w-2 h-full cursor-col-resize z-30 flex items-center ${
          isResizing ? 'bg-sky-500/45' : 'hover:bg-sky-500/25'
        } transition-colors`}
      >
        <div
          style={{ right: `${width + 10}px`, top: '54%' }}
          className="opacity-0 group-hover/spresizer:opacity-100 pointer-events-none fixed z-50 px-2.5 py-1.5 rounded-lg bg-slate-900/95 text-white text-[11px] leading-snug shadow-xl whitespace-nowrap transition-opacity duration-150 select-none"
        >
          <div>
            <span className="font-semibold text-white">Tutup</span>{' '}
            <span className="text-slate-300">Klik atau Esc</span>
          </div>
          <div>
            <span className="font-semibold text-white">Ubah ukuran</span>{' '}
            <span className="text-slate-300">Tarik</span>
          </div>
        </div>
      </div>

      {/* Top Header Bar (Matches image_3.png: »» ↖ on left, Bagikan 🔗 ☆ ••• on right) */}
      <header className="h-11 px-3 border-b border-border-subtle/60 flex items-center justify-between gap-2 bg-surface/95 backdrop-blur-md shrink-0 select-none">
        <div className="flex items-center gap-1 text-text-secondary">
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-subtle hover:text-text-primary transition"
            title="Tutup side peek"
            aria-label="Tutup side peek"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              onExpandToFullPage(note.id);
              onClose();
            }}
            className="p-1.5 rounded-md hover:bg-subtle hover:text-text-primary transition"
            title="Buka dalam halaman penuh"
            aria-label="Buka dalam halaman penuh"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-1 text-text-secondary relative">
          <button
            type="button"
            onClick={() => {
              onCopyLink(note);
              setLinkCopied(true);
              window.setTimeout(() => setLinkCopied(false), 1600);
            }}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-subtle text-text-primary text-[12.5px] font-medium transition"
            title="Bagikan & salin tautan halaman"
          >
            <Globe className="w-3.5 h-3.5 text-text-secondary" />
            <span>{linkCopied ? 'Disalin!' : 'Bagikan'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onCopyLink(note);
              setLinkCopied(true);
              window.setTimeout(() => setLinkCopied(false), 1600);
            }}
            className="p-1.5 rounded-md hover:bg-subtle hover:text-text-primary transition"
            title="Salin tautan"
          >
            {linkCopied ? (
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <Link2 className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() =>
              void onUpdateSidePeekNote(note.id, {
                isFavorite: !note.isFavorite,
                updatedAt: Date.now()
              })
            }
            className="p-1.5 rounded-md hover:bg-subtle hover:text-text-primary transition"
            title={note.isFavorite ? 'Hapus dari Favorit' : 'Tambahkan ke Favorit'}
          >
            <Star
              className={`w-3.5 h-3.5 ${
                note.isFavorite ? 'fill-amber-400 text-amber-500' : ''
              }`}
            />
          </button>

          <button
            type="button"
            onClick={() => setShowMoreMenu((v) => !v)}
            className="p-1.5 rounded-md hover:bg-subtle hover:text-text-primary transition"
            title="Opsi halaman"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {showMoreMenu && (
            <div className="absolute right-0 top-full mt-1 w-52 rounded-xl bg-surface border border-border-subtle shadow-2xl p-1.5 z-50 text-xs text-text-primary space-y-0.5">
              <div className="px-2 py-1 text-[10.5px] font-semibold text-text-secondary">
                Gaya Font
              </div>
              <div className="grid grid-cols-3 gap-1 px-1 pb-1">
                {(['default', 'serif', 'mono'] as const).map((fs) => (
                  <button
                    key={fs}
                    type="button"
                    onClick={() => {
                      void onUpdateSidePeekNote(note.id, { fontStyle: fs });
                      setShowMoreMenu(false);
                    }}
                    className={`py-1 rounded-md border text-[11px] capitalize ${
                      fontStyle === fs
                        ? 'bg-sky-500/15 border-sky-500 text-sky-600 font-semibold'
                        : 'border-border-subtle text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {fs}
                  </button>
                ))}
              </div>
              <div className="h-px bg-border-subtle my-1" />
              <button
                type="button"
                onClick={() => {
                  onDuplicate(note);
                  setShowMoreMenu(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-subtle text-left"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Duplikatkan</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onDelete(note);
                  setShowMoreMenu(false);
                  onClose();
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-rose-500/10 text-rose-500 text-left"
              >
                <span>Pindahkan ke Sampah</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Side Peek Scrollable Body (Matches image_3.png) */}
      <div
        style={{ fontFamily: noteFontFamily }}
        className="flex-1 overflow-y-auto pb-20"
      >
        {note.cover && (
          <div
            className="h-36 w-full bg-cover bg-center"
            style={{
              background: note.cover.startsWith('http')
                ? `url(${note.cover}) center/cover no-repeat`
                : note.cover
            }}
          />
        )}

        <div className="px-7 sm:px-10 pt-7">
          {/* Page Icon */}
          <div className="mb-3">
            <span className="text-4xl leading-none select-none">
              {note.icon || '📄'}
            </span>
          </div>

          {/* Editable Page Title */}
          <input
            type="text"
            value={note.title}
            onChange={(e) =>
              void onUpdateSidePeekNote(note.id, {
                title: e.target.value,
                updatedAt: Date.now()
              })
            }
            placeholder="Tanpa Judul"
            className="w-full bg-transparent text-[26px] sm:text-[30px] font-bold tracking-tight text-text-primary placeholder:text-text-secondary/40 focus:outline-none leading-tight mb-4"
          />

          {/* Blocks */}
          <div className="space-y-1">
            {note.blocks.map((blk, i) => renderSidePeekBlock(blk, i))}
          </div>

          {/* Child Subpages Section if any */}
          {childSubpages.length > 0 && (
            <div className="mt-6 pt-4 border-t border-border-subtle/70 space-y-1">
              <div className="text-xs font-semibold text-text-secondary mb-1.5">
                Subhalaman ({childSubpages.length})
              </div>
              {childSubpages.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => onOpenNoteInSidePeek(sub.id)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-subtle text-[13.5px] font-medium text-text-primary text-left transition"
                >
                  <FileText className="w-4 h-4 text-text-secondary shrink-0" />
                  <span>{sub.icon || '📄'}</span>
                  <span className="truncate">{sub.title || 'Tanpa Judul'}</span>
                </button>
              ))}
            </div>
          )}

          {/* Add Block Button */}
          <button
            type="button"
            onClick={() => void handleAppendBlock()}
            className="mt-4 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-text-secondary hover:text-text-primary hover:bg-subtle transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah baris baru</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
