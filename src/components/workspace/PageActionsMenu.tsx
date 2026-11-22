'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowLeftRight,
  Bell,
  Check,
  ChevronRight,
  Clipboard,
  Clock,
  Copy,
  CornerUpRight,
  Download,
  History,
  Link2,
  ListTree,
  Lock,
  MessageSquare,
  MessageSquarePlus,
  MoreHorizontal,
  Printer,
  Search,
  Trash2,
  Unlock
} from 'lucide-react';
import { MiuAIFaceIcon } from '../ai/MiuAIFaceIcon';
import type { NoteFontStyle, NoteRecord } from '../../types/miu';
import { flattenBlocks } from '../../utils/blockTreeHelper';

interface PageActionsMenuProps {
  note: NoteRecord;
  allNotes: NoteRecord[];
  canEdit: boolean;
  isOwner: boolean;
  fontStyle: NoteFontStyle;
  isSmallText: boolean;
  isFullWidth: boolean;
  showTocOutline: boolean;
  showCommentsPanel: boolean;
  isLocked: boolean;
  onCopyActiveShareLink: () => Promise<void>;
  onCopyPageContent: () => Promise<void>;
  onDuplicateNote: () => void;
  onMoveNoteToParent: (targetParentId: string | null) => void;
  onChangeFontStyle: (style: NoteFontStyle) => void;
  onToggleSmallText: () => void;
  onToggleFullWidth: () => void;
  onToggleTocOutline: () => void;
  onToggleCommentsPanel: () => void;
  onToggleLockPage: () => void;
  onOpenAIDrawer: () => void;
  onDeleteNote: () => void;
  onExportMarkdown: () => void;
  onPrintPdf: () => void;
}

type SubView = 'main' | 'layout' | 'move' | 'analytics' | 'more';

export const PageActionsMenu: React.FC<PageActionsMenuProps> = ({
  note,
  allNotes,
  canEdit,
  isOwner,
  fontStyle,
  isSmallText,
  isFullWidth,
  showTocOutline,
  showCommentsPanel,
  isLocked,
  onCopyActiveShareLink,
  onCopyPageContent,
  onDuplicateNote,
  onMoveNoteToParent,
  onChangeFontStyle,
  onToggleSmallText,
  onToggleFullWidth,
  onToggleTocOutline,
  onToggleCommentsPanel,
  onToggleLockPage,
  onOpenAIDrawer,
  onDeleteNote,
  onExportMarkdown,
  onPrintPdf
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [subView, setSubView] = useState<SubView>('main');
  const [searchAction, setSearchAction] = useState('');
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const handleOpenPageActions = (e: Event) => {
      const custom = e as CustomEvent<{ subView?: SubView }>;
      setSubView(custom.detail?.subView || 'main');
      setSearchAction('');
      setIsOpen(true);
    };
    window.addEventListener('miu:open-page-actions', handleOpenPageActions);
    return () => {
      window.removeEventListener('miu:open-page-actions', handleOpenPageActions);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (target && containerRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (e.key === 'Escape') {
        e.preventDefault();
        if (subView !== 'main') {
          setSubView('main');
        } else {
          setIsOpen(false);
        }
        return;
      }

      if (mod && e.altKey && !e.shiftKey && (key === 'l' || e.code === 'KeyL')) {
        e.preventDefault();
        e.stopPropagation();
        void onCopyActiveShareLink().then(() => {
          showToast('Tautan halaman aktif & disalin!');
          setIsOpen(false);
        });
        return;
      }

      if (isOwner && mod && !e.shiftKey && !e.altKey && key === 'd') {
        e.preventDefault();
        e.stopPropagation();
        onDuplicateNote();
        showToast('Halaman diduplikatkan');
        setIsOpen(false);
        return;
      }

      if (isOwner && mod && e.shiftKey && !e.altKey && key === 'p') {
        e.preventDefault();
        e.stopPropagation();
        setSubView('move');
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, subView, isOwner, onCopyActiveShareLink, onDuplicateNote]);

  useEffect(() => {
    if (isOpen && subView === 'main') {
      window.setTimeout(() => searchInputRef.current?.focus(), 30);
    }
  }, [isOpen, subView]);

  const showToast = (msg: string) => {
    setFeedbackToast(msg);
    window.setTimeout(() => {
      setFeedbackToast((prev) => (prev === msg ? null : prev));
    }, 2000);
  };

  const stats = useMemo(() => {
    const flat = flattenBlocks(note.blocks);
    const fullText = [note.title || '', ...flat.map((b) => b.content || '')]
      .join(' ')
      .trim();
    const words = fullText ? fullText.split(/\s+/).filter(Boolean).length : 0;
    const chars = fullText.length;
    return {
      blocks: flat.length,
      words,
      chars,
      comments: note.comments?.length || 0
    };
  }, [note.blocks, note.title, note.comments]);

  const moveCandidates = useMemo(
    () =>
      allNotes.filter(
        (n) =>
          n.id !== note.id &&
          n.parentId !== note.id &&
          (!n.ownerId || n.ownerId === note.ownerId)
      ),
    [allNotes, note.id, note.ownerId]
  );

  const q = searchAction.trim().toLowerCase();
  const matchesQuery = (...keywords: string[]) => {
    if (!q) return true;
    return keywords.some((k) => k.toLowerCase().includes(q));
  };

  const renderSwitch = (checked: boolean) => (
    <span
      className={`relative inline-flex h-[18px] w-8 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
        checked ? 'bg-sky-600' : 'bg-text-secondary/30'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-[14px] w-[14px] transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-3.5' : 'translate-x-0'
        }`}
      />
    </span>
  );

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          const next = !isOpen;
          setIsOpen(next);
          if (next) {
            setSubView('main');
            setSearchAction('');
          }
        }}
        className={`p-1.5 rounded-md transition ${
          isOpen
            ? 'bg-subtle text-text-primary'
            : 'text-text-secondary hover:bg-subtle hover:text-text-primary'
        }`}
        title="Tindakan halaman, tampilan & tata letak"
        aria-label="Menu tindakan halaman"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {feedbackToast && (
        <div className="fixed top-14 right-5 z-50 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium shadow-xl flex items-center gap-1.5 animate-in fade-in">
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>{feedbackToast}</span>
        </div>
      )}

      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-[276px] max-w-[calc(100vw-1.5rem)] rounded-2xl bg-surface border border-border-subtle shadow-[0_18px_48px_-12px_rgba(15,23,42,0.24)] dark:shadow-[0_20px_50px_-10px_rgba(0,0,0,0.75)] z-50 overflow-hidden select-none text-[13px] text-text-primary">
          {subView === 'layout' ? (
            /* =============================================================== */
            /* IMAGE_3: TAMPILAN & TATA LETAK (3 Font Styles + View Toggles)   */
            /* =============================================================== */
            <div className="p-2.5 space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <button
                  type="button"
                  onClick={() => setSubView('main')}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-text-primary transition"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Gaya font</span>
                </button>
              </div>

              {/* 3 Font Style Cards (Default, Serif, Mono) */}
              <div className="grid grid-cols-3 gap-1.5 px-0.5">
                {(
                  [
                    {
                      id: 'default' as NoteFontStyle,
                      label: 'Default',
                      fontFamily:
                        "'Plus Jakarta Sans', Inter, -apple-system, BlinkMacSystemFont, sans-serif"
                    },
                    {
                      id: 'serif' as NoteFontStyle,
                      label: 'Serif',
                      fontFamily:
                        'Lyon-Text, Georgia, Cambria, "Times New Roman", Times, serif'
                    },
                    {
                      id: 'mono' as NoteFontStyle,
                      label: 'Mono',
                      fontFamily:
                        "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace"
                    }
                  ] as const
                ).map((item) => {
                  const active = fontStyle === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onChangeFontStyle(item.id)}
                      className={`py-2.5 px-2 rounded-xl flex flex-col items-center justify-center gap-1 transition ${
                        active
                          ? 'bg-subtle/90 dark:bg-subtle'
                          : 'hover:bg-subtle/50'
                      }`}
                    >
                      <span
                        style={{ fontFamily: item.fontFamily }}
                        className={`text-[23px] leading-none font-medium ${
                          active ? 'text-sky-600 dark:text-sky-400' : 'text-text-primary'
                        }`}
                      >
                        Ag
                      </span>
                      <span className="text-[11.5px] text-text-secondary font-medium">
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="h-px bg-border-subtle mx-1" />

              <div className="space-y-0.5">
                <div className="px-2 pb-1 text-[11.5px] font-semibold text-text-secondary">
                  Tampilan
                </div>

                {/* Teks kecil */}
                <button
                  type="button"
                  onClick={onToggleSmallText}
                  className="w-full flex items-center justify-between gap-2 px-2 py-2 rounded-lg hover:bg-subtle transition"
                >
                  <span className="inline-flex items-center gap-2.5">
                    <span className="w-4 text-center font-semibold text-xs leading-none text-text-primary">
                      A↓
                    </span>
                    <span>Teks kecil</span>
                  </span>
                  {renderSwitch(isSmallText)}
                </button>

                {/* Lebar penuh */}
                <button
                  type="button"
                  onClick={onToggleFullWidth}
                  className="w-full flex items-center justify-between gap-2 px-2 py-2 rounded-lg hover:bg-subtle transition"
                >
                  <span className="inline-flex items-center gap-2.5">
                    <ArrowLeftRight className="w-4 h-4 text-text-primary" />
                    <span>Lebar penuh</span>
                  </span>
                  {renderSwitch(isFullWidth)}
                </button>

                {/* Daftar isi */}
                <button
                  type="button"
                  onClick={onToggleTocOutline}
                  className="w-full flex items-center justify-between gap-2 px-2 py-2 rounded-lg hover:bg-subtle transition"
                >
                  <span className="inline-flex items-center gap-2.5">
                    <ListTree className="w-4 h-4 text-text-primary" />
                    <span>Daftar isi</span>
                  </span>
                  {renderSwitch(showTocOutline)}
                </button>

                {/* Diskusi Halaman */}
                <button
                  type="button"
                  onClick={onToggleCommentsPanel}
                  className="w-full flex items-center justify-between gap-2 px-2 py-2 rounded-lg hover:bg-subtle transition"
                >
                  <span className="inline-flex items-center gap-2.5">
                    <MessageSquare className="w-4 h-4 text-text-primary" />
                    <span>Diskusi Halaman</span>
                  </span>
                  {renderSwitch(showCommentsPanel)}
                </button>

                {/* Komentar sebaris */}
                <button
                  type="button"
                  onClick={() => {
                    if (!showCommentsPanel) onToggleCommentsPanel();
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center justify-between gap-2 px-2 py-2 rounded-lg hover:bg-subtle transition"
                >
                  <span className="inline-flex items-center gap-2.5">
                    <MessageSquarePlus className="w-4 h-4 text-text-primary" />
                    <span>Komentar sebaris</span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-text-secondary" />
                </button>
              </div>
            </div>
          ) : subView === 'move' ? (
            <div className="p-2.5 space-y-2">
              <button
                type="button"
                onClick={() => setSubView('main')}
                className="inline-flex items-center gap-1.5 px-1 text-xs font-medium text-text-secondary hover:text-text-primary"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Pindahkan halaman ke...</span>
              </button>
              <div className="max-h-56 overflow-y-auto space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    onMoveNoteToParent(null);
                    showToast('Dipindahkan ke Halaman Utama');
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-subtle text-left text-xs font-medium"
                >
                  <span>🏠 Halaman Utama (Root)</span>
                  {!note.parentId && <Check className="w-3.5 h-3.5 text-sky-600" />}
                </button>
                {moveCandidates.map((cand) => (
                  <button
                    key={cand.id}
                    type="button"
                    onClick={() => {
                      onMoveNoteToParent(cand.id);
                      showToast(`Dipindahkan ke ${cand.title || 'Halaman'}`);
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-subtle text-left text-xs"
                  >
                    <span className="truncate">
                      {cand.icon || '📄'} {cand.title || 'Tanpa Judul'}
                    </span>
                    {note.parentId === cand.id && (
                      <Check className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          ) : subView === 'analytics' ? (
            <div className="p-3 space-y-2.5">
              <button
                type="button"
                onClick={() => setSubView('main')}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-text-primary"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Pembaruan &amp; analitika</span>
              </button>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <div className="p-2 rounded-xl bg-subtle/70 border border-border-subtle">
                  <div className="text-[10px] text-text-secondary">Jumlah Kata</div>
                  <div className="text-sm font-bold text-text-primary">{stats.words}</div>
                </div>
                <div className="p-2 rounded-xl bg-subtle/70 border border-border-subtle">
                  <div className="text-[10px] text-text-secondary">Jumlah Blok</div>
                  <div className="text-sm font-bold text-text-primary">{stats.blocks}</div>
                </div>
                <div className="p-2 rounded-xl bg-subtle/70 border border-border-subtle">
                  <div className="text-[10px] text-text-secondary">Karakter</div>
                  <div className="text-sm font-bold text-text-primary">{stats.chars}</div>
                </div>
                <div className="p-2 rounded-xl bg-subtle/70 border border-border-subtle">
                  <div className="text-[10px] text-text-secondary">Komentar</div>
                  <div className="text-sm font-bold text-text-primary">{stats.comments}</div>
                </div>
              </div>
              <div className="text-[11px] text-text-secondary pt-1 border-t border-border-subtle">
                Diperbarui terakhir:{' '}
                <strong className="text-text-primary">
                  {new Date(note.updatedAt).toLocaleString('id-ID', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </strong>
              </div>
            </div>
          ) : subView === 'more' ? (
            <div className="p-2 space-y-1">
              <button
                type="button"
                onClick={() => setSubView('main')}
                className="inline-flex items-center gap-1.5 px-1.5 py-1 text-xs font-medium text-text-secondary hover:text-text-primary"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Lainnya</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onExportMarkdown();
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-subtle transition text-left"
              >
                <Download className="w-4 h-4 text-text-secondary" />
                <span>Unduh Markdown (.md)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  window.setTimeout(() => onPrintPdf(), 60);
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-subtle transition text-left"
              >
                <Printer className="w-4 h-4 text-text-secondary" />
                <span>Cetak / Ekspor PDF</span>
              </button>
            </div>
          ) : (
            /* =============================================================== */
            /* IMAGE_2: MAIN PAGE ACTIONS MENU                                 */
            /* =============================================================== */
            <div className="p-2 space-y-1 max-h-[82vh] overflow-y-auto">
              {/* Search Box at Top */}
              <div className="px-0.5 pb-1">
                <div className="relative flex items-center">
                  <Search className="w-3.5 h-3.5 text-text-secondary absolute left-2.5 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchAction}
                    onChange={(e) => setSearchAction(e.target.value)}
                    placeholder="Cari tindakan..."
                    className="w-full bg-surface border-2 border-sky-500/85 focus:border-sky-600 rounded-lg pl-8 pr-2.5 py-1 text-[12.5px] text-text-primary placeholder:text-text-secondary/65 focus:outline-none"
                  />
                </div>
              </div>

              {/* Group 1: Copy Link, Copy Content, Duplicate, Move, History, Analytics */}
              <div className="space-y-0.5">
                {matchesQuery('salin tautan', 'copy link', 'share') && (
                  <button
                    type="button"
                    onClick={() => {
                      void onCopyActiveShareLink().then(() => {
                        showToast('Tautan halaman aktif & disalin!');
                        setIsOpen(false);
                      });
                    }}
                    className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-subtle transition text-left"
                  >
                    <span className="inline-flex items-center gap-2.5">
                      <Link2 className="w-4 h-4 text-text-primary" />
                      <span>Salin tautan</span>
                    </span>
                    <span className="text-[11px] text-text-secondary font-mono">⌘⌥L</span>
                  </button>
                )}

                {matchesQuery('salin konten halaman', 'copy page content', 'markdown') && (
                  <button
                    type="button"
                    onClick={() => {
                      void onCopyPageContent().then(() => {
                        showToast('Konten halaman disalin!');
                        setIsOpen(false);
                      });
                    }}
                    className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-subtle transition text-left"
                  >
                    <span className="inline-flex items-center gap-2.5">
                      <Clipboard className="w-4 h-4 text-text-primary" />
                      <span>Salin konten halaman</span>
                    </span>
                  </button>
                )}

                {isOwner && matchesQuery('duplikatkan', 'duplicate') && (
                  <button
                    type="button"
                    onClick={() => {
                      onDuplicateNote();
                      showToast('Halaman diduplikatkan');
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-subtle transition text-left"
                  >
                    <span className="inline-flex items-center gap-2.5">
                      <Copy className="w-4 h-4 text-text-primary" />
                      <span>Duplikatkan</span>
                    </span>
                    <span className="text-[11px] text-text-secondary font-mono">⌘D</span>
                  </button>
                )}

                {isOwner && matchesQuery('pindahkan ke', 'move to') && (
                  <button
                    type="button"
                    onClick={() => setSubView('move')}
                    className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-subtle transition text-left"
                  >
                    <span className="inline-flex items-center gap-2.5">
                      <CornerUpRight className="w-4 h-4 text-text-primary" />
                      <span>Pindahkan ke</span>
                    </span>
                    <span className="text-[11px] text-text-secondary font-mono">⌘⇧P</span>
                  </button>
                )}

                {matchesQuery('riwayat versi', 'version history') && (
                  <button
                    type="button"
                    onClick={() => setSubView('analytics')}
                    className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-subtle transition text-left"
                  >
                    <span className="inline-flex items-center gap-2.5">
                      <History className="w-4 h-4 text-text-primary" />
                      <span>Riwayat versi</span>
                    </span>
                  </button>
                )}

                {matchesQuery('pembaruan', 'analitika', 'analytics') && (
                  <button
                    type="button"
                    onClick={() => setSubView('analytics')}
                    className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-subtle transition text-left"
                  >
                    <span className="inline-flex items-center gap-2.5">
                      <Clock className="w-4 h-4 text-text-primary" />
                      <span>Pembaruan &amp; analitika</span>
                    </span>
                  </button>
                )}
              </div>

              <div className="h-px bg-border-subtle my-1" />

              {/* Tampilan & tata letak */}
              {matchesQuery('tampilan', 'tata letak', 'font', 'serif', 'mono', 'teks kecil', 'lebar penuh', 'daftar isi') && (
                <>
                  <button
                    type="button"
                    onClick={() => setSubView('layout')}
                    className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-subtle transition text-left"
                  >
                    <span className="inline-flex items-center gap-2.5">
                      <span className="w-4 text-center font-semibold text-xs leading-none text-text-primary">
                        Aa
                      </span>
                      <span>Tampilan &amp; tata letak</span>
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-text-secondary" />
                  </button>
                  <div className="h-px bg-border-subtle my-1" />
                </>
              )}

              {/* Gunakan dengan AI */}
              {matchesQuery('gunakan dengan ai', 'ai', 'miu') && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenAIDrawer();
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-subtle transition text-left"
                  >
                    <span className="inline-flex items-center gap-2.5">
                      <MiuAIFaceIcon className="w-4 h-4 text-text-primary" />
                      <span>Gunakan dengan AI</span>
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-text-secondary" />
                  </button>
                  <div className="h-px bg-border-subtle my-1" />
                </>
              )}

              {/* Sarankan editan & Notifikasi Komentar */}
              <div className="space-y-0.5">
                {matchesQuery('sarankan editan', 'komentar', 'diskusi') && (
                  <button
                    type="button"
                    onClick={() => {
                      onToggleCommentsPanel();
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-subtle transition text-left"
                  >
                    <span className="inline-flex items-center gap-2.5">
                      <MessageSquarePlus className="w-4 h-4 text-text-primary" />
                      <span>Sarankan editan</span>
                    </span>
                  </button>
                )}

                {matchesQuery('notifikasi', 'komentar', 'beri saya') && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!showCommentsPanel) onToggleCommentsPanel();
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-subtle transition text-left"
                  >
                    <span className="inline-flex items-center gap-2.5 min-w-0">
                      <Bell className="w-4 h-4 text-text-primary shrink-0" />
                      <span className="truncate">Beri saya notif...</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-text-secondary shrink-0">
                      <span>Komentar</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </button>
                )}
              </div>

              <div className="h-px bg-border-subtle my-1" />

              {/* Kunci halaman & Pindahkan ke Sampah */}
              <div className="space-y-0.5">
                {canEdit && matchesQuery('kunci halaman', 'lock') && (
                  <button
                    type="button"
                    onClick={onToggleLockPage}
                    className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-subtle transition text-left"
                  >
                    <span className="inline-flex items-center gap-2.5">
                      {isLocked ? (
                        <Lock className="w-4 h-4 text-amber-500" />
                      ) : (
                        <Unlock className="w-4 h-4 text-text-primary" />
                      )}
                      <span>Kunci halaman</span>
                    </span>
                    {renderSwitch(isLocked)}
                  </button>
                )}

                {isOwner && matchesQuery('pindahkan ke sampah', 'hapus', 'delete', 'trash') && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onDeleteNote();
                    }}
                    className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-rose-500/10 hover:text-rose-500 transition text-left"
                  >
                    <span className="inline-flex items-center gap-2.5">
                      <Trash2 className="w-4 h-4" />
                      <span>Pindahkan ke Sampah</span>
                    </span>
                  </button>
                )}
              </div>

              <div className="h-px bg-border-subtle my-1" />

              {/* Lainnya */}
              {matchesQuery('lainnya', 'unduh', 'cetak', 'pdf', 'markdown') && (
                <button
                  type="button"
                  onClick={() => setSubView('more')}
                  className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-subtle transition text-left"
                >
                  <span className="inline-flex items-center gap-2.5">
                    <MoreHorizontal className="w-4 h-4 text-text-primary" />
                    <span>Lainnya</span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-text-secondary" />
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
