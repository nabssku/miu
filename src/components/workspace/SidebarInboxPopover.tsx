'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Braces,
  Calendar,
  ChevronRight,
  ChevronsLeft,
  Clock,
  Columns3,
  FileAudio,
  HelpCircle,
  Inbox,
  LayoutGrid,
  Lock,
  MessageCircle,
  MessageSquare,
  PackageOpen,
  Pin,
  Share2,
  Sparkles,
  Star,
  Table,
  Users,
  X
} from 'lucide-react';
import { MiuAIFaceIcon } from '../ai/MiuAIFaceIcon';
import type { NoteRecord } from '../../types/miu';
import { flattenBlocks } from '../../utils/blockTreeHelper';

export type SidebarSectionId =
  | 'favorites'
  | 'recent'
  | 'database_views'
  | 'pinned'
  | 'chats'
  | 'agent'
  | 'upcoming_events'
  | 'ai_meeting_notes'
  | 'private'
  | 'shared'
  | 'apps'
  | 'developer';

export interface SidebarSectionMeta {
  id: SidebarSectionId;
  label: string;
  category?: 'Halaman' | 'Obrolan' | 'Rapat' | 'Utama';
  hasChevron?: boolean;
}

export const SIDEBAR_SECTION_CATALOG: SidebarSectionMeta[] = [
  { id: 'private', label: 'Privat', category: 'Utama' },
  { id: 'shared', label: 'Dibagikan', category: 'Utama' },
  { id: 'apps', label: 'Aplikasi Miu', category: 'Utama' },
  { id: 'developer', label: 'Developer', category: 'Utama' },
  { id: 'favorites', label: 'Favorit', category: 'Halaman' },
  { id: 'recent', label: 'Terbaru', category: 'Halaman' },
  { id: 'database_views', label: 'Tampilan database', category: 'Halaman', hasChevron: true },
  { id: 'pinned', label: 'Disematkan', category: 'Obrolan' },
  { id: 'chats', label: 'Obrolan', category: 'Obrolan' },
  { id: 'agent', label: 'Agent', category: 'Obrolan' },
  { id: 'upcoming_events', label: 'Acara mendatang', category: 'Rapat' },
  { id: 'ai_meeting_notes', label: 'Catatan Rapat AI', category: 'Rapat' }
];

export const DEFAULT_SIDEBAR_SECTIONS: SidebarSectionId[] = [
  'favorites',
  'recent',
  'private',
  'shared',
  'database_views',
  'apps',
  'developer'
];

const SIDEBAR_SECTIONS_STORAGE_KEY = 'miu_sidebar_sections_v2';
const LEGACY_SIDEBAR_SECTIONS_KEY = 'miu_sidebar_sections_v1';

export function loadSidebarSections(): SidebarSectionId[] {
  if (typeof window === 'undefined') return DEFAULT_SIDEBAR_SECTIONS;
  try {
    const validIds = new Set(SIDEBAR_SECTION_CATALOG.map((s) => s.id));
    const rawV2 = window.localStorage.getItem(SIDEBAR_SECTIONS_STORAGE_KEY);
    if (rawV2) {
      const parsed = JSON.parse(rawV2);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((id): id is SidebarSectionId =>
          validIds.has(id)
        );
        if (filtered.length > 0) return filtered;
      }
    }

    // Migrate from v1 while ensuring core sections ('private', 'shared', 'apps', 'developer') are restored
    const rawV1 = window.localStorage.getItem(LEGACY_SIDEBAR_SECTIONS_KEY);
    if (rawV1) {
      const parsedV1 = JSON.parse(rawV1);
      if (Array.isArray(parsedV1)) {
        const filteredV1 = parsedV1.filter((id): id is SidebarSectionId =>
          validIds.has(id)
        );
        const merged = Array.from(
          new Set<SidebarSectionId>([
            ...filteredV1,
            'private',
            'shared',
            'apps',
            'developer'
          ])
        );
        window.localStorage.setItem(
          SIDEBAR_SECTIONS_STORAGE_KEY,
          JSON.stringify(merged)
        );
        return merged;
      }
    }

    return DEFAULT_SIDEBAR_SECTIONS;
  } catch {
    return DEFAULT_SIDEBAR_SECTIONS;
  }
}

export function saveSidebarSections(sections: SidebarSectionId[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SIDEBAR_SECTIONS_STORAGE_KEY, JSON.stringify(sections));
  } catch {
    // ignore
  }
}

export const renderSidebarSectionIcon = (
  id: SidebarSectionId,
  className = 'w-4 h-4 text-text-secondary'
) => {
  switch (id) {
    case 'private':
      return <Lock className={className} />;
    case 'shared':
      return <Users className={className} />;
    case 'apps':
      return <LayoutGrid className={className} />;
    case 'developer':
      return <Braces className={className} />;
    case 'favorites':
      return <Star className={className} />;
    case 'recent':
      return <Clock className={className} />;
    case 'database_views':
      return <Table className={className} />;
    case 'pinned':
      return <Pin className={className} />;
    case 'chats':
      return <MessageCircle className={className} />;
    case 'agent':
      return <MiuAIFaceIcon className={className} />;
    case 'upcoming_events':
      return <Calendar className={className} />;
    case 'ai_meeting_notes':
      return <FileAudio className={className} />;
  }
};

interface AddSidebarSectionPopoverProps {
  activeSections: SidebarSectionId[];
  onToggleSection: (id: SidebarSectionId) => void;
  onClose: () => void;
}

export const AddSidebarSectionPopover: React.FC<AddSidebarSectionPopoverProps> = ({
  activeSections,
  onToggleSection,
  onClose
}) => {
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (target && ref.current?.contains(target)) return;
      onClose();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const groups: Array<'Utama' | 'Halaman' | 'Obrolan' | 'Rapat'> = [
    'Utama',
    'Halaman',
    'Obrolan',
    'Rapat'
  ];
  const q = query.trim().toLowerCase();

  return (
    <div
      ref={ref}
      className="w-60 rounded-2xl bg-surface border border-border-subtle shadow-[0_18px_46px_-12px_rgba(15,23,42,0.24)] dark:shadow-[0_20px_50px_-10px_rgba(0,0,0,0.75)] p-2.5 space-y-2.5 z-50 text-[13px] text-text-primary select-none"
    >
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari bagian (Privat, Favorit...)"
          autoFocus
          className="w-full bg-subtle/40 border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-secondary/65 focus:outline-none focus:border-sky-500"
        />
      </div>

      <div className="space-y-2.5 max-h-72 overflow-y-auto">
        {groups.map((group) => {
          const items = SIDEBAR_SECTION_CATALOG.filter(
            (s) =>
              s.category === group &&
              (!q || s.label.toLowerCase().includes(q))
          );
          if (items.length === 0) return null;
          return (
            <div key={group} className="space-y-0.5">
              <div className="px-2 pb-0.5 text-[11px] font-semibold text-text-secondary">
                {group}
              </div>
              {items.map((item) => {
                const isAdded = activeSections.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onToggleSection(item.id);
                      onClose();
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg transition text-left ${
                      isAdded
                        ? 'bg-subtle text-text-primary font-medium'
                        : 'hover:bg-subtle/75 text-text-primary'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2.5 min-w-0">
                      {renderSidebarSectionIcon(item.id, 'w-4 h-4 text-text-primary shrink-0')}
                      <span className="truncate">{item.label}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 shrink-0">
                      {isAdded && (
                        <span className="text-[10.5px] font-semibold text-sky-600 dark:text-sky-400">
                          Aktif
                        </span>
                      )}
                      {item.hasChevron && (
                        <ChevronRight className="w-3.5 h-3.5 text-text-secondary shrink-0" />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export interface InboxItemRecord {
  id: string;
  kind: 'comment' | 'shared' | 'deadline';
  noteId: string;
  noteTitle: string;
  noteIcon: string;
  subtitle: string;
  timestamp: number;
}

export function buildWorkspaceInboxItems(
  allNotes: NoteRecord[],
  sharedWithMeNotes: NoteRecord[]
): InboxItemRecord[] {
  const items: InboxItemRecord[] = [];

  for (const note of allNotes) {
    for (const cmt of note.comments || []) {
      items.push({
        id: `cmt-${cmt.id}`,
        kind: 'comment',
        noteId: note.id,
        noteTitle: note.title || 'Tanpa Judul',
        noteIcon: note.icon || '📄',
        subtitle: `${cmt.authorName}: "${cmt.content}"`,
        timestamp: cmt.createdAt
      });
    }

    for (const blk of flattenBlocks(note.blocks)) {
      if ((blk.type === 'deadline' || blk.type === 'todo') && blk.dueDate && !blk.checked) {
        items.push({
          id: `due-${note.id}-${blk.id}`,
          kind: 'deadline',
          noteId: note.id,
          noteTitle: note.title || 'Tanpa Judul',
          noteIcon: note.icon || '📅',
          subtitle: `Deadline ${blk.dueDate}${blk.dueTime ? ` ${blk.dueTime}` : ''}: ${blk.content || 'Tugas'}`,
          timestamp: note.updatedAt
        });
      }
    }
  }

  for (const shared of sharedWithMeNotes) {
    items.push({
      id: `shr-${shared.id}`,
      kind: 'shared',
      noteId: shared.id,
      noteTitle: shared.title || 'Tanpa Judul',
      noteIcon: shared.icon || '📄',
      subtitle: `Dibagikan oleh ${shared.ownerName || shared.ownerEmail || 'Kolaborator'}`,
      timestamp: shared.updatedAt
    });
  }

  return items.sort((a, b) => b.timestamp - a.timestamp);
}

interface SidebarInboxTriggerButtonProps {
  isOpen: boolean;
  onToggle: () => void;
  allNotes: NoteRecord[];
  sharedWithMeNotes: NoteRecord[];
}

export const SidebarInboxTriggerButton: React.FC<SidebarInboxTriggerButtonProps> = ({
  isOpen,
  onToggle,
  allNotes,
  sharedWithMeNotes
}) => {
  const count = useMemo(
    () => buildWorkspaceInboxItems(allNotes, sharedWithMeNotes).length,
    [allNotes, sharedWithMeNotes]
  );

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`p-1.5 rounded-md transition relative ${
        isOpen
          ? 'bg-text-primary/[0.08] dark:bg-white/[0.1] text-text-primary shadow-sm'
          : 'text-text-secondary hover:bg-text-primary/[0.06] dark:hover:bg-white/[0.06] hover:text-text-primary'
      }`}
      title="Kotak masuk (Geser dari bilah sisi kiri)"
      aria-label="Kotak masuk"
    >
      <Inbox className="w-4 h-4" />
      {count > 0 && (
        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-sky-500" />
      )}
    </button>
  );
};

interface SidebarInboxSlideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sidebarWidth: number;
  allNotes: NoteRecord[];
  sharedWithMeNotes: NoteRecord[];
  onSelectNote: (noteId: string, openComments?: boolean) => void;
}

export const SidebarInboxSlideDrawer: React.FC<SidebarInboxSlideDrawerProps> = ({
  isOpen,
  onClose,
  sidebarWidth,
  allNotes,
  sharedWithMeNotes,
  onSelectNote
}) => {
  const [tab, setTab] = useState<'all' | 'comments' | 'shared' | 'deadlines'>('all');
  const dragStartXRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const inboxItems = useMemo(
    () => buildWorkspaceInboxItems(allNotes, sharedWithMeNotes),
    [allNotes, sharedWithMeNotes]
  );

  const filteredItems = useMemo(() => {
    if (tab === 'comments') return inboxItems.filter((i) => i.kind === 'comment');
    if (tab === 'shared') return inboxItems.filter((i) => i.kind === 'shared');
    if (tab === 'deadlines') return inboxItems.filter((i) => i.kind === 'deadline');
    return inboxItems;
  }, [inboxItems, tab]);

  const handlePointerDown = (e: React.PointerEvent) => {
    dragStartXRef.current = e.clientX;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragStartXRef.current !== null) {
      const deltaX = e.clientX - dragStartXRef.current;
      // Swipe / drag left closes the panel back into the left sidebar
      if (deltaX < -45) {
        onClose();
      }
      dragStartXRef.current = null;
    }
  };

  return (
    <div
      style={{ left: `${sidebarWidth}px`, width: isOpen ? `${sidebarWidth}px` : '0px' }}
      className={`fixed top-0 bottom-0 z-30 overflow-hidden no-print transition-[width] duration-300 ease-in-out ${
        isOpen ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
    >
      <div
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        style={{ width: `${sidebarWidth}px` }}
        className={`h-screen bg-[#F7F7F5] dark:bg-subtle/95 backdrop-blur-md flex flex-col justify-between select-none transform transition-all duration-300 ease-in-out ${
          isOpen
            ? 'translate-x-0 opacity-100 border-r border-border-subtle shadow-[14px_0_36px_-12px_rgba(15,23,42,0.18)] dark:shadow-[16px_0_40px_-10px_rgba(0,0,0,0.7)]'
            : '-translate-x-full opacity-0 border-r-0 shadow-none'
        }`}
      >
        {/* Top Header */}
        <div className="px-3 pt-3 pb-2 border-b border-border-subtle/80 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Inbox className="w-4 h-4 text-text-primary shrink-0" />
              <span className="text-[13.5px] font-semibold text-text-primary truncate">
                Kotak masuk
              </span>
              {inboxItems.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-surface border border-border-subtle text-[10px] font-mono text-text-secondary shrink-0">
                  {inboxItems.length}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 px-1.5 py-1 rounded-md hover:bg-text-primary/[0.06] dark:hover:bg-white/[0.08] text-text-secondary hover:text-text-primary transition text-[11px]"
              title="Geser tutup ke kiri"
              aria-label="Tutup kotak masuk"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar text-[11.5px]">
            {(
              [
                { id: 'all', label: 'Semua' },
                { id: 'comments', label: 'Komentar' },
                { id: 'shared', label: 'Dibagikan' },
                { id: 'deadlines', label: 'Deadline' }
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-2 py-1 rounded-md font-medium whitespace-nowrap transition ${
                  tab === t.id
                    ? 'bg-surface text-text-primary font-semibold shadow-sm border border-border-subtle/70'
                    : 'text-text-secondary hover:bg-text-primary/[0.04] hover:text-text-primary'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Inbox Items List */}
        <div className="flex-1 overflow-y-auto px-2.5 py-2.5 space-y-1">
          {filteredItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-3 py-10 space-y-2 text-text-secondary">
              <div className="w-10 h-10 rounded-2xl bg-surface border border-border-subtle flex items-center justify-center shadow-sm">
                <Inbox className="w-5 h-5 opacity-55" />
              </div>
              <p className="text-[13px] font-medium text-text-primary">
                Kotak masuk Anda kosong
              </p>
              <p className="text-[11.5px] leading-relaxed opacity-80">
                Notifikasi komentar halaman, catatan yang dibagikan, dan pengingat deadline akan muncul di sini.
              </p>
            </div>
          ) : (
            filteredItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectNote(item.noteId, item.kind === 'comment');
                  onClose();
                }}
                className="w-full text-left p-2.5 rounded-xl bg-surface/60 hover:bg-surface border border-transparent hover:border-border-subtle/80 transition flex items-start gap-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.02)]"
              >
                <span className="text-[16px] leading-none mt-0.5 shrink-0">
                  {item.noteIcon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-[12.5px] font-semibold text-text-primary truncate">
                      {item.noteTitle}
                    </span>
                    {item.kind === 'comment' ? (
                      <MessageSquare className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    ) : item.kind === 'shared' ? (
                      <Share2 className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                    ) : (
                      <Calendar className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    )}
                  </div>
                  <p className="text-[11.5px] text-text-secondary line-clamp-2 mt-0.5 leading-snug">
                    {item.subtitle}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer Slide-Left Hint */}
        <div className="px-3 py-2 border-t border-border-subtle/70 flex items-center justify-between text-[11px] text-text-secondary">
          <span>Geser ke kiri untuk menutup</span>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 font-medium text-text-primary hover:underline"
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
            <span>Tutup</span>
          </button>
        </div>
      </div>
    </div>
  );
};

/* ========================================================================= */
/* WHAT'S NEW IN MIU (`?` ICON CHANGELOGS POPOVER & RELEASE NOTES MODAL)     */
/* ========================================================================= */

export interface MiuReleaseChangelog {
  id: string;
  version: string;
  shortLabel: string;
  title: string;
  date: string;
  badge: string;
  highlights: string[];
}

export const MIU_CHANGELOG_RELEASES: MiuReleaseChangelog[] = [
  {
    id: 'miu-3.9',
    version: 'Miu 3.9',
    shortLabel: 'Agen, dibangun kembali untuk...',
    title: 'Agen Miu AI, Pustaka Skill Komunitas & Web Tool',
    date: 'Terbaru',
    badge: 'Baru',
    highlights: [
      'Halaman Pustaka Skill: Temukan & instal skill.md siap pakai langsung dari halaman Pustaka atau unggah skill buatan Anda beserta penjelasan fungsinya.',
      'Tool Calling Penuh: Miu AI kini dapat membaca, membuat, mengubah, dan menghapus catatan workspace secara langsung.',
      'Web Tool Real-Time: Pencarian informasi & referensi web terkini secara otomatis oleh Agen Miu AI.',
      'Koneksi Webhook & API Eksternal: Hubungkan halaman skill.md ke endpoint REST API atau webhook luar.'
    ]
  },
  {
    id: 'miu-3.8',
    version: 'Miu 3.8',
    shortLabel: 'Miu 3.8',
    title: 'Miu 3.8 — Diagram Mermaid, Whiteboard, Simple Table & Voice Note',
    date: 'Rilis 3.8',
    badge: 'Editor',
    highlights: [
      'Mermaid & Papan Coret-Coret (Whiteboard): Buat flowchart, mind-map, sequence diagram, dan sketsa bebas langsung di dalam halaman catatan.',
      'Simple Table: Tabel teks ringan yang cepat untuk matriks ringkasan tanpa perlu membuat blok Database penuh.',
      'Voice Note Block: Rekam audio kuliah atau rapat langsung sebagai blok player lengkap dengan transkrip otomatis.'
    ]
  },
  {
    id: 'miu-3.7',
    version: 'Miu 3.7',
    shortLabel: 'Miu 3.7',
    title: 'Miu 3.7 — Outline Mengambang, Kustomisasi Sidebar & Tata Letak',
    date: 'Rilis 3.7',
    badge: 'UI & Kolaborasi',
    highlights: [
      'Daftar Isi Mengambang (Floating TOC): Navigasi cepat antar Heading H1, H2, dan H3 di sisi kanan tengah halaman.',
      'Sesuaikan Bilah Sisi & Kotak Masuk Slide: Atur urutan bagian sidebar, tarik untuk mengubah lebar, dan buka Kotak Masuk dengan slide dari sidebar kiri.',
      'Menu Tata Letak & Bagikan: Pilihan 3 gaya font (Default, Serif, Mono), mode Teks Kecil, aktifkan komentar, serta ekspor/cetak halaman.'
    ]
  }
];

export const SidebarWhatsNewButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRelease, setSelectedRelease] = useState<MiuReleaseChangelog | 'all' | null>(
    null
  );
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (target && containerRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className={`p-1 rounded-md transition relative ${
          isOpen
            ? 'bg-text-primary/[0.08] dark:bg-white/[0.1] text-text-primary'
            : 'hover:bg-text-primary/[0.05] text-text-secondary hover:text-text-primary'
        }`}
        title="Apa yang baru di Miu? (Changelog & Update Logs)"
        aria-label="Apa yang baru di Miu"
      >
        <HelpCircle className="w-4 h-4" />
        <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-rose-500" />
      </button>

      {isOpen && (
        <div className="absolute left-0 bottom-full mb-2 w-64 rounded-2xl bg-surface border border-border-subtle shadow-[0_18px_46px_-12px_rgba(15,23,42,0.25)] dark:shadow-[0_20px_50px_-10px_rgba(0,0,0,0.75)] p-3 z-50 text-text-primary select-none">
          <div className="text-[12px] font-semibold text-text-secondary pb-2 border-b border-border-subtle/70">
            Apa yang baru?
          </div>

          <div className="relative mt-2.5 pl-4 space-y-2.5 before:content-[''] before:absolute before:left-[5px] before:top-2 before:bottom-2 before:w-[1.5px] before:bg-border-subtle">
            {MIU_CHANGELOG_RELEASES.map((rel) => (
              <button
                key={rel.id}
                type="button"
                onClick={() => {
                  setSelectedRelease(rel);
                  setIsOpen(false);
                }}
                className="group relative w-full text-left flex items-center justify-between gap-2 py-0.5 text-[13.5px] font-medium text-text-primary hover:text-sky-600 dark:hover:text-sky-400 transition"
              >
                <span className="absolute -left-[13.5px] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-text-secondary/70 group-hover:bg-sky-500 ring-2 ring-surface transition" />
                <span className="truncate">{rel.shortLabel}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setSelectedRelease('all');
              setIsOpen(false);
            }}
            className="mt-3 pt-2 border-t border-border-subtle/70 w-full flex items-center gap-2.5 px-1 py-1 rounded-lg text-[13.5px] font-medium text-text-primary hover:bg-subtle/80 transition text-left"
          >
            <PackageOpen className="w-4 h-4 text-text-secondary shrink-0" />
            <span>Lihat semua rilis</span>
          </button>
        </div>
      )}

      {/* Full Changelog / Release Notes Modal */}
      {selectedRelease && (
        <div
          className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
          onClick={() => setSelectedRelease(null)}
        >
          <div
            className="w-full max-w-xl max-h-[82vh] rounded-2xl bg-surface border border-border-subtle shadow-2xl overflow-hidden flex flex-col text-text-primary"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between bg-subtle/40">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/25 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold">
                    Apa yang Baru di Miu — Catatan Rilis &amp; Pembaruan
                  </h3>
                  <p className="text-[11.5px] text-text-secondary">
                    Changelog fitur terbaru Miu Workspace &amp; Miu AI
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRelease(null)}
                className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-subtle transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5">
              {(selectedRelease === 'all'
                ? MIU_CHANGELOG_RELEASES
                : [selectedRelease]
              ).map((rel) => (
                <div
                  key={rel.id}
                  className="rounded-2xl border border-border-subtle bg-subtle/25 p-4 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/25">
                      {rel.version} • {rel.badge}
                    </span>
                    <span className="text-[11px] text-text-secondary">{rel.date}</span>
                  </div>
                  <h4 className="text-[14.5px] font-semibold text-text-primary">
                    {rel.title}
                  </h4>
                  <ul className="space-y-1.5 pt-1">
                    {rel.highlights.map((h, i) => (
                      <li
                        key={i}
                        className="text-[12.5px] text-text-secondary leading-relaxed flex items-start gap-2"
                      >
                        <span className="text-sky-500 mt-0.5">•</span>
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              {selectedRelease !== 'all' && (
                <button
                  type="button"
                  onClick={() => setSelectedRelease('all')}
                  className="w-full py-2 rounded-xl border border-border-subtle hover:bg-subtle text-[12.5px] font-medium text-text-primary transition"
                >
                  Lihat Semua Rilis Miu
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ========================================================================= */
/* BOTTOM-RIGHT 4-SQUARES (`LayoutGrid`) POPOVER: PUSTAKA SKILL & KANBAN     */
/* ========================================================================= */

interface SidebarQuickLauncherPopoverProps {
  onOpenSkillLibrary: () => void;
  onOpenKanban: () => void;
  isKanbanActive?: boolean;
}

export const SidebarQuickLauncherPopover: React.FC<SidebarQuickLauncherPopoverProps> = ({
  onOpenSkillLibrary,
  onOpenKanban,
  isKanbanActive
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (target && containerRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className={`p-1 rounded-md transition ${
          isOpen
            ? 'bg-text-primary/[0.08] dark:bg-white/[0.1] text-text-primary'
            : 'hover:bg-text-primary/[0.05] text-text-secondary hover:text-text-primary'
        }`}
        title="Menu Pintasan (Pustaka Skill & Kanban)"
        aria-label="Buka menu Pustaka Skill dan Kanban"
      >
        <LayoutGrid className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute left-0 bottom-full mb-2 w-52 rounded-2xl bg-surface border border-border-subtle shadow-[0_18px_46px_-12px_rgba(15,23,42,0.25)] dark:shadow-[0_20px_50px_-10px_rgba(0,0,0,0.75)] p-1.5 z-50 space-y-0.5 text-[13.5px] text-text-primary select-none">
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onOpenSkillLibrary();
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-subtle/80 text-text-primary font-medium transition text-left"
          >
            <BookOpen className="w-4 h-4 text-text-secondary shrink-0" />
            <span>Pustaka Skill</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onOpenKanban();
            }}
            className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-xl hover:bg-subtle/80 font-medium transition text-left ${
              isKanbanActive ? 'bg-subtle text-text-primary font-semibold' : 'text-text-primary'
            }`}
          >
            <span className="inline-flex items-center gap-2.5">
              <Columns3 className="w-4 h-4 text-text-secondary shrink-0" />
              <span>Kanban</span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
