'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Copy,
  Link2,
  MoreHorizontal,
  PanelRight,
  Plus,
  RefreshCw,
  SquarePen,
  Star,
  Trash2
} from 'lucide-react';
import type { NoteRecord } from '../../types/miu';
import { flattenBlocks } from '../../utils/blockTreeHelper';

export interface SidebarNoteMenuTarget {
  note: NoteRecord;
  x: number;
  y: number;
}

interface SidebarNoteActionButtonsProps {
  note: NoteRecord;
  canAddSubpage?: boolean;
  onOpenMenu: (target: SidebarNoteMenuTarget) => void;
  onCreateSubpage: (parentId: string) => void;
}

export const SidebarNoteActionButtons: React.FC<SidebarNoteActionButtonsProps> = ({
  note,
  canAddSubpage = true,
  onOpenMenu,
  onCreateSubpage
}) => {
  return (
    <div
      className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0 transition-opacity"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          onOpenMenu({
            note,
            x: rect.right + 6,
            y: rect.top
          });
        }}
        className="p-0.5 rounded hover:bg-text-primary/[0.08] dark:hover:bg-white/[0.1] text-text-secondary hover:text-text-primary transition"
        title="Hapus, duplikatkan, dan lainnya..."
        aria-label="Menu opsi catatan"
      >
        <MoreHorizontal className="w-3.5 h-3.5" />
      </button>

      {canAddSubpage && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCreateSubpage(note.id);
          }}
          className="p-0.5 rounded hover:bg-text-primary/[0.08] dark:hover:bg-white/[0.1] text-text-secondary hover:text-text-primary transition"
          title="Tambahkan halaman di dalam"
          aria-label="Tambahkan halaman di dalam"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

interface SidebarNoteContextMenuProps {
  target: SidebarNoteMenuTarget | null;
  allNotes: NoteRecord[];
  currentUserName?: string;
  onClose: () => void;
  onToggleFavorite: (note: NoteRecord) => void;
  onCopyLink: (note: NoteRecord) => void;
  onDuplicate: (note: NoteRecord) => void;
  onRename: (note: NoteRecord, newTitle: string, newIcon?: string) => void;
  onMoveToParent: (noteId: string, newParentId: string | null) => void;
  onDelete: (note: NoteRecord) => void;
  onToggleWiki: (note: NoteRecord) => void;
  onOpenInNewTab: (note: NoteRecord) => void;
  onOpenInSidePeek: (note: NoteRecord) => void;
}

const QUICK_RENAME_ICONS = ['📄', '💻', '📚', '⚡', '🎓', '🔬', '📋', '🗂️', '💡', '🚀'];

export const SidebarNoteContextMenu: React.FC<SidebarNoteContextMenuProps> = ({
  target,
  allNotes,
  currentUserName,
  onClose,
  onToggleFavorite,
  onCopyLink,
  onDuplicate,
  onRename,
  onMoveToParent,
  onDelete,
  onToggleWiki,
  onOpenInNewTab,
  onOpenInSidePeek
}) => {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [subView, setSubView] = useState<'main' | 'rename' | 'move'>('main');
  const [renameTitle, setRenameTitle] = useState('');
  const [renameIcon, setRenameIcon] = useState('📄');
  const [moveSearch, setMoveSearch] = useState('');
  const [copiedFeedback, setCopiedFeedback] = useState(false);

  const note = target?.note;

  useEffect(() => {
    if (note) {
      setSubView('main');
      setRenameTitle(note.title || '');
      setRenameIcon(note.icon || '📄');
      setMoveSearch('');
      setCopiedFeedback(false);
    }
  }, [note?.id, target?.x, target?.y]);

  useEffect(() => {
    if (!target || !note) return;
    const handlePointerDown = (e: PointerEvent) => {
      const node = e.target as Node | null;
      if (node && menuRef.current?.contains(node)) return;
      onClose();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (e.key === 'Escape') {
        e.preventDefault();
        if (subView !== 'main') {
          setSubView('main');
        } else {
          onClose();
        }
        return;
      }

      if (mod && !e.shiftKey && !e.altKey && key === 'd') {
        e.preventDefault();
        e.stopPropagation();
        onDuplicate(note);
        onClose();
        return;
      }

      if (mod && e.shiftKey && !e.altKey && key === 'r') {
        e.preventDefault();
        e.stopPropagation();
        setSubView('rename');
        return;
      }

      if (mod && e.shiftKey && !e.altKey && key === 'p') {
        e.preventDefault();
        e.stopPropagation();
        setSubView('move');
        return;
      }

      if (mod && e.shiftKey && !e.altKey && e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        onOpenInNewTab(note);
        onClose();
        return;
      }

      if (mod && e.altKey && !e.shiftKey && (key === 'l' || e.code === 'KeyL')) {
        e.preventDefault();
        e.stopPropagation();
        onCopyLink(note);
        setCopiedFeedback(true);
        window.setTimeout(() => onClose(), 350);
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [target, note, subView, onClose, onDuplicate, onOpenInNewTab, onCopyLink]);

  const stats = useMemo(() => {
    if (!note) return { words: 0, chars: 0, formattedDate: '' };
    const flat = flattenBlocks(note.blocks);
    const fullText = [note.title || '', ...flat.map((b) => b.content || '')]
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    const chars = fullText.length;
    const words = fullText ? fullText.split(/\s+/).length : 0;
    const d = new Date(note.updatedAt || Date.now());
    const formattedDate = d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    const formattedTime = d
      .toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit'
      })
      .replace(':', '.');
    return {
      words,
      chars,
      formattedDate: `${formattedDate}, ${formattedTime}`
    };
  }, [note]);

  const isWikiNote = useMemo(() => {
    if (!note) return false;
    return note.blocks.some(
      (b) => b.type === 'callout' && b.content.includes('Halaman Wiki Terverifikasi')
    );
  }, [note]);

  const moveCandidates = useMemo(() => {
    if (!note) return [];
    const q = moveSearch.trim().toLowerCase();
    return allNotes.filter(
      (n) =>
        n.id !== note.id &&
        n.parentId !== note.id &&
        (!q || (n.title || 'Tanpa Judul').toLowerCase().includes(q))
    );
  }, [allNotes, note, moveSearch]);

  if (!target || !note) return null;

  // Compute safe screen coordinates so menu never overflows viewport
  const menuWidth = 264;
  const menuHeight = 430;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const left = Math.max(8, Math.min(target.x, vw - menuWidth - 12));
  const top = Math.max(8, Math.min(target.y, vh - menuHeight - 12));

  return (
    <div
      ref={menuRef}
      style={{ left: `${left}px`, top: `${top}px`, width: `${menuWidth}px` }}
      className="fixed z-[1250] rounded-2xl bg-surface border border-border-subtle shadow-[0_18px_48px_-10px_rgba(15,23,42,0.24)] dark:shadow-[0_22px_54px_-10px_rgba(0,0,0,0.78)] p-1.5 text-[13.5px] text-text-primary select-none no-print"
      onClick={(e) => e.stopPropagation()}
    >
      {subView === 'rename' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onRename(note, renameTitle.trim(), renameIcon);
            onClose();
          }}
          className="p-2 space-y-2.5"
        >
          <div className="text-[11.5px] font-semibold text-text-secondary">
            Ganti nama &amp; ikon halaman
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {QUICK_RENAME_ICONS.map((ic) => (
              <button
                key={ic}
                type="button"
                onClick={() => setRenameIcon(ic)}
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-base transition ${
                  renameIcon === ic
                    ? 'bg-sky-500/15 ring-1 ring-sky-500'
                    : 'hover:bg-subtle'
                }`}
              >
                {ic}
              </button>
            ))}
          </div>
          <input
            type="text"
            autoFocus
            value={renameTitle}
            onChange={(e) => setRenameTitle(e.target.value)}
            placeholder="Judul halaman..."
            className="w-full px-2.5 py-1.5 rounded-lg bg-subtle/70 border border-border-subtle text-[13px] text-text-primary focus:outline-none focus:border-sky-500"
          />
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setSubView('main')}
              className="px-2.5 py-1 rounded-lg text-xs text-text-secondary hover:bg-subtle"
            >
              Kembali
            </button>
            <button
              type="submit"
              className="px-3 py-1 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white"
            >
              Simpan
            </button>
          </div>
        </form>
      ) : subView === 'move' ? (
        <div className="p-2 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] font-semibold text-text-secondary">
              Pindahkan halaman ke...
            </span>
            <button
              type="button"
              onClick={() => setSubView('main')}
              className="text-[11px] text-sky-600 hover:underline"
            >
              Kembali
            </button>
          </div>
          <input
            type="text"
            autoFocus
            value={moveSearch}
            onChange={(e) => setMoveSearch(e.target.value)}
            placeholder="Cari halaman tujuan..."
            className="w-full px-2.5 py-1.5 rounded-lg bg-subtle/70 border border-border-subtle text-xs text-text-primary focus:outline-none focus:border-sky-500"
          />
          <div className="max-h-48 overflow-y-auto space-y-0.5">
            <button
              type="button"
              onClick={() => {
                onMoveToParent(note.id, null);
                onClose();
              }}
              className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs hover:bg-subtle text-left ${
                !note.parentId ? 'font-semibold text-sky-600' : 'text-text-primary'
              }`}
            >
              <span>🔒 Privat (Halaman Utama)</span>
              {!note.parentId && <Check className="w-3.5 h-3.5" />}
            </button>
            {moveCandidates.map((cand) => (
              <button
                key={cand.id}
                type="button"
                onClick={() => {
                  onMoveToParent(note.id, cand.id);
                  onClose();
                }}
                className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-xs hover:bg-subtle text-left ${
                  note.parentId === cand.id
                    ? 'font-semibold text-sky-600'
                    : 'text-text-primary'
                }`}
              >
                <span className="truncate">
                  {cand.icon || '📄'} {cand.title || 'Tanpa Judul'}
                </span>
                {note.parentId === cand.id && <Check className="w-3.5 h-3.5 shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* MAIN PAGE CONTEXT MENU (Matches image_2.png) */
        <div>
          <div className="px-2.5 pt-1.5 pb-1 text-[11.5px] font-medium text-text-secondary">
            Halaman
          </div>

          {/* 1. Tambahkan ke Favorit */}
          <button
            type="button"
            onClick={() => {
              onToggleFavorite(note);
              onClose();
            }}
            className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-subtle transition text-left"
          >
            <span className="inline-flex items-center gap-2.5">
              <Star
                className={`w-4 h-4 shrink-0 ${
                  note.isFavorite
                    ? 'fill-amber-400 text-amber-500'
                    : 'text-text-primary'
                }`}
              />
              <span>
                {note.isFavorite ? 'Hapus dari Favorit' : 'Tambahkan ke Favorit'}
              </span>
            </span>
          </button>

          <div className="h-px bg-border-subtle/70 my-1" />

          {/* 2. Salin tautan */}
          <button
            type="button"
            onClick={() => {
              onCopyLink(note);
              setCopiedFeedback(true);
              window.setTimeout(() => onClose(), 420);
            }}
            className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-subtle transition text-left"
          >
            <span className="inline-flex items-center gap-2.5">
              {copiedFeedback ? (
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : (
                <Link2 className="w-4 h-4 text-text-primary shrink-0" />
              )}
              <span>{copiedFeedback ? 'Tautan disalin!' : 'Salin tautan'}</span>
            </span>
          </button>

          {/* 3. Duplikatkan */}
          <button
            type="button"
            onClick={() => {
              onDuplicate(note);
              onClose();
            }}
            className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-subtle transition text-left"
          >
            <span className="inline-flex items-center gap-2.5">
              <Copy className="w-4 h-4 text-text-primary shrink-0" />
              <span>Duplikatkan</span>
            </span>
            <span className="text-[11.5px] text-text-secondary/75 font-sans">⌘D</span>
          </button>

          {/* 4. Ganti nama */}
          <button
            type="button"
            onClick={() => setSubView('rename')}
            className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-subtle transition text-left"
          >
            <span className="inline-flex items-center gap-2.5">
              <SquarePen className="w-4 h-4 text-text-primary shrink-0" />
              <span>Ganti nama</span>
            </span>
            <span className="text-[11.5px] text-text-secondary/75 font-sans">⌘⇧R</span>
          </button>

          {/* 5. Pindahkan ke */}
          <button
            type="button"
            onClick={() => setSubView('move')}
            className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-subtle transition text-left"
          >
            <span className="inline-flex items-center gap-2.5">
              <ArrowRight className="w-4 h-4 text-text-primary shrink-0" />
              <span>Pindahkan ke</span>
            </span>
            <span className="text-[11.5px] text-text-secondary/75 font-sans">⌘⇧P</span>
          </button>

          {/* 6. Pindahkan ke Sampah */}
          <button
            type="button"
            onClick={() => {
              onDelete(note);
              onClose();
            }}
            className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-rose-500/10 hover:text-rose-600 transition text-left"
          >
            <span className="inline-flex items-center gap-2.5">
              <Trash2 className="w-4 h-4 shrink-0" />
              <span>Pindahkan ke Sampah</span>
            </span>
          </button>

          <div className="h-px bg-border-subtle/70 my-1" />

          {/* 7. Ubah menjadi wiki */}
          <button
            type="button"
            onClick={() => {
              onToggleWiki(note);
              onClose();
            }}
            className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-subtle transition text-left"
          >
            <span className="inline-flex items-center gap-2.5">
              <RefreshCw className="w-4 h-4 text-text-primary shrink-0" />
              <span>{isWikiNote ? 'Kembalikan ke halaman' : 'Ubah menjadi wiki'}</span>
            </span>
          </button>

          <div className="h-px bg-border-subtle/70 my-1" />

          {/* 8. Buka di tab baru */}
          <button
            type="button"
            onClick={() => {
              onOpenInNewTab(note);
              onClose();
            }}
            className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-subtle transition text-left"
          >
            <span className="inline-flex items-center gap-2.5">
              <ArrowUpRight className="w-4 h-4 text-text-primary shrink-0" />
              <span>Buka di tab baru</span>
            </span>
            <span className="text-[11.5px] text-text-secondary/75 font-sans">⌘⇧↵</span>
          </button>

          {/* 9. Buka di side peek */}
          <button
            type="button"
            onClick={() => {
              onOpenInSidePeek(note);
              onClose();
            }}
            className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-subtle transition text-left"
          >
            <span className="inline-flex items-center gap-2.5">
              <PanelRight className="w-4 h-4 text-text-primary shrink-0" />
              <span>Buka di side peek</span>
            </span>
            <span className="text-[11.5px] text-text-secondary/75 font-sans">
              ⌥Click
            </span>
          </button>

          <div className="h-px bg-border-subtle/70 my-1" />

          {/* Footer: Terakhir diedit */}
          <div className="px-2.5 py-1.5 text-[11.5px] text-text-secondary space-y-0.5 leading-snug">
            <div className="font-medium text-text-secondary/85">Terakhir diedit</div>
            <div className="flex items-center gap-1.5 text-text-secondary truncate">
              <span>🤖</span>
              <span className="truncate">
                {note.ownerName || currentUserName || 'Pengguna Miu'}
              </span>
            </div>
            <div>{stats.formattedDate}</div>
            <div>
              {stats.words} kata, {stats.chars} karakter
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
