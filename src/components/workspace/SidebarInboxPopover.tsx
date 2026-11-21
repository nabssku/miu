'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Braces,
  Calendar,
  ChevronRight,
  Clock,
  FileAudio,
  Inbox,
  LayoutGrid,
  Lock,
  MessageCircle,
  MessageSquare,
  Pin,
  Search,
  Share2,
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
  { id: 'apps', label: 'Aplikasi Notion', category: 'Utama' },
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
  'private',
  'shared',
  'apps',
  'developer'
];

const SIDEBAR_SECTIONS_STORAGE_KEY = 'miu_sidebar_sections_v1';

export function loadSidebarSections(): SidebarSectionId[] {
  if (typeof window === 'undefined') return DEFAULT_SIDEBAR_SECTIONS;
  try {
    const raw = window.localStorage.getItem(SIDEBAR_SECTIONS_STORAGE_KEY);
    if (!raw) return DEFAULT_SIDEBAR_SECTIONS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_SIDEBAR_SECTIONS;
    const validIds = new Set(SIDEBAR_SECTION_CATALOG.map((s) => s.id));
    const filtered = parsed.filter((id): id is SidebarSectionId => validIds.has(id));
    return filtered.length > 0 ? filtered : DEFAULT_SIDEBAR_SECTIONS;
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

  const groups: Array<'Halaman' | 'Obrolan' | 'Rapat'> = ['Halaman', 'Obrolan', 'Rapat'];
  const q = query.trim().toLowerCase();

  return (
    <div
      ref={ref}
      className="w-56 rounded-2xl bg-surface border border-border-subtle shadow-[0_18px_46px_-12px_rgba(15,23,42,0.24)] dark:shadow-[0_20px_50px_-10px_rgba(0,0,0,0.75)] p-2.5 space-y-2.5 z-50 text-[13px] text-text-primary select-none"
    >
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari bagian..."
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
                    {item.hasChevron && (
                      <ChevronRight className="w-3.5 h-3.5 text-text-secondary shrink-0" />
                    )}
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

interface SidebarInboxPopoverProps {
  allNotes: NoteRecord[];
  sharedWithMeNotes: NoteRecord[];
  onSelectNote: (noteId: string, openComments?: boolean) => void;
}

export const SidebarInboxPopover: React.FC<SidebarInboxPopoverProps> = ({
  allNotes,
  sharedWithMeNotes,
  onSelectNote
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<'all' | 'comments' | 'shared' | 'deadlines'>('all');
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

  const inboxItems = useMemo(() => {
    const items: Array<{
      id: string;
      kind: 'comment' | 'shared' | 'deadline';
      noteId: string;
      noteTitle: string;
      noteIcon: string;
      subtitle: string;
      timestamp: number;
    }> = [];

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
  }, [allNotes, sharedWithMeNotes]);

  const filteredItems = useMemo(() => {
    if (tab === 'comments') return inboxItems.filter((i) => i.kind === 'comment');
    if (tab === 'shared') return inboxItems.filter((i) => i.kind === 'shared');
    if (tab === 'deadlines') return inboxItems.filter((i) => i.kind === 'deadline');
    return inboxItems;
  }, [inboxItems, tab]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className={`p-1.5 rounded-md transition relative ${
          isOpen
            ? 'bg-surface text-text-primary shadow-sm'
            : 'text-text-secondary hover:bg-surface/70 hover:text-text-primary'
        }`}
        title="Kotak masuk (Komentar, Dibagikan & Pengingat)"
        aria-label="Kotak masuk"
      >
        <Inbox className="w-4 h-4" />
        {inboxItems.length > 0 && (
          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-sky-500" />
        )}
      </button>

      {isOpen && (
        <div className="fixed sm:absolute left-3 sm:left-0 top-12 sm:top-full mt-1.5 w-80 max-w-[calc(100vw-1.5rem)] rounded-2xl bg-surface border border-border-subtle shadow-[0_18px_48px_-12px_rgba(15,23,42,0.25)] dark:shadow-[0_20px_50px_-10px_rgba(0,0,0,0.75)] z-50 p-3 space-y-2.5 text-xs text-text-primary">
          <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-border-subtle">
            <div className="flex items-center gap-1.5">
              <Inbox className="w-4 h-4 text-text-primary" />
              <span className="text-[13px] font-semibold">Kotak masuk</span>
              {inboxItems.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-subtle text-[10px] font-mono text-text-secondary">
                  {inboxItems.length}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-md hover:bg-subtle text-text-secondary hover:text-text-primary"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 text-[11px]">
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
                className={`px-2 py-1 rounded-md font-medium transition ${
                  tab === t.id
                    ? 'bg-subtle text-text-primary font-semibold'
                    : 'text-text-secondary hover:bg-subtle/50 hover:text-text-primary'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {filteredItems.length === 0 ? (
            <div className="py-8 text-center space-y-1.5 text-text-secondary">
              <Inbox className="w-6 h-6 mx-auto opacity-45" />
              <p className="text-xs font-medium">Tidak ada notifikasi baru</p>
              <p className="text-[11px] opacity-75">
                Komentar halaman, catatan kolaborasi, dan deadline akan muncul di sini.
              </p>
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto space-y-1 pr-0.5">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectNote(item.noteId, item.kind === 'comment');
                    setIsOpen(false);
                  }}
                  className="w-full text-left p-2 rounded-xl hover:bg-subtle transition flex items-start gap-2.5"
                >
                  <span className="text-base leading-none mt-0.5 shrink-0">
                    {item.noteIcon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="font-semibold text-text-primary truncate">
                        {item.noteTitle}
                      </span>
                      {item.kind === 'comment' ? (
                        <MessageSquare className="w-3 h-3 text-amber-500 shrink-0" />
                      ) : item.kind === 'shared' ? (
                        <Share2 className="w-3 h-3 text-sky-500 shrink-0" />
                      ) : (
                        <Calendar className="w-3 h-3 text-rose-500 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-text-secondary line-clamp-2 mt-0.5 leading-snug">
                      {item.subtitle}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
