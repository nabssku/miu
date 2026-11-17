'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Clock,
  Columns3,
  Copy,
  GripVertical,
  MessageSquare,
  Plus,
  Star,
  Trash2,
  Users
} from 'lucide-react';
import type { NoteKanbanStatus, NoteRecord } from '@/types/miu';
import { flattenBlocks } from '@/utils/blockTreeHelper';

export const KANBAN_COLUMNS: Array<{
  id: NoteKanbanStatus;
  label: string;
  desc: string;
  badgeClass: string;
  columnBgClass: string;
  dropRingClass: string;
}> = [
  {
    id: 'todo',
    label: 'Rencana',
    desc: 'Ide & catatan yang akan dikerjakan',
    badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30',
    columnBgClass: 'bg-subtle/45',
    dropRingClass: 'ring-2 ring-amber-500/70 bg-amber-500/5'
  },
  {
    id: 'in_progress',
    label: 'Dikerjakan',
    desc: 'Catatan atau tugas yang sedang berlangsung',
    badgeClass: 'bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/30',
    columnBgClass: 'bg-subtle/45',
    dropRingClass: 'ring-2 ring-sky-500/70 bg-sky-500/5'
  },
  {
    id: 'done',
    label: 'Selesai',
    desc: 'Materi atau tugas yang sudah tuntas',
    badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30',
    columnBgClass: 'bg-subtle/45',
    dropRingClass: 'ring-2 ring-emerald-500/70 bg-emerald-500/5'
  }
];

export function renderKanbanStatusIcon(status: NoteKanbanStatus, className = 'w-3.5 h-3.5') {
  if (status === 'in_progress') return <Clock className={`${className} text-sky-500`} />;
  if (status === 'done') return <CheckCircle2 className={`${className} text-emerald-500`} />;
  return <Circle className={`${className} text-amber-500`} />;
}

interface KanbanBoardViewProps {
  notes: NoteRecord[];
  allNotes: NoteRecord[];
  activeNoteId: string;
  canCreateRoot: boolean;
  canMoveNote: (note: NoteRecord) => boolean;
  isOwnerNote: (note: NoteRecord) => boolean;
  onOpenNote: (noteId: string) => void;
  onCreateNoteInStatus: (status: NoteKanbanStatus) => void;
  onMoveNoteStatus: (noteId: string, status: NoteKanbanStatus) => void;
  onDuplicateNote: (note: NoteRecord, e: React.MouseEvent) => void;
  onDeleteNote: (note: NoteRecord, e: React.MouseEvent) => void;
  onToggleFavorite: (note: NoteRecord, e: React.MouseEvent) => void;
}

export const KanbanBoardView: React.FC<KanbanBoardViewProps> = ({
  notes,
  allNotes,
  activeNoteId,
  canCreateRoot,
  canMoveNote,
  isOwnerNote,
  onOpenNote,
  onCreateNoteInStatus,
  onMoveNoteStatus,
  onDuplicateNote,
  onDeleteNote,
  onToggleFavorite
}) => {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropColumn, setDropColumn] = useState<NoteKanbanStatus | null>(null);

  const counts = {
    todo: notes.filter((n) => (n.kanbanStatus || 'todo') === 'todo').length,
    in_progress: notes.filter((n) => n.kanbanStatus === 'in_progress').length,
    done: notes.filter((n) => n.kanbanStatus === 'done').length
  };

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto px-5 sm:px-10 py-8 sm:py-10 space-y-6">
      {/* Board Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border-subtle/70">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-accent-strong">
            <Columns3 className="w-4 h-4" />
            <span>Tampilan Board</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary">
            Papan Kanban Catatan
          </h1>
          <p className="text-xs text-text-secondary">
            {counts.todo} Rencana · {counts.in_progress} Dikerjakan · {counts.done} Selesai — Seret
            kartu antar kolom atau klik kartu untuk membuka dokumen.
          </p>
        </div>

        {canCreateRoot && (
          <button
            type="button"
            onClick={() => onCreateNoteInStatus('todo')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent-strong text-white dark:text-slate-950 text-xs font-bold shadow-sm hover:opacity-95 transition self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Catatan Baru</span>
          </button>
        )}
      </div>

      {/* 3 Full Kanban Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        {KANBAN_COLUMNS.map((col) => {
          const colNotes = notes.filter((n) => (n.kanbanStatus || 'todo') === col.id);
          const isOver = dropColumn === col.id;

          return (
            <div
              key={col.id}
              onDragOver={(e) => {
                if (!draggedId) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dropColumn !== col.id) setDropColumn(col.id);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDropColumn((prev) => (prev === col.id ? null : prev));
                }
              }}
              onDrop={(e) => {
                const sourceId =
                  e.dataTransfer.getData('application/miu-kanban-note-id') || draggedId;
                setDraggedId(null);
                setDropColumn(null);
                if (!sourceId) return;
                e.preventDefault();
                e.stopPropagation();
                onMoveNoteStatus(sourceId, col.id);
              }}
              className={`rounded-2xl border border-border-subtle p-3.5 space-y-3 min-h-[340px] flex flex-col transition ${
                col.columnBgClass
              } ${isOver ? col.dropRingClass : ''}`}
            >
              {/* Column Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-bold ${col.badgeClass}`}
                    >
                      {renderKanbanStatusIcon(col.id, 'w-3.5 h-3.5')}
                      <span>{col.label}</span>
                    </span>
                    <span className="text-xs font-mono font-semibold text-text-secondary">
                      {colNotes.length}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-secondary/80 pl-1">{col.desc}</p>
                </div>

                {canCreateRoot && (
                  <button
                    type="button"
                    onClick={() => onCreateNoteInStatus(col.id)}
                    className="p-1.5 rounded-lg hover:bg-surface text-text-secondary hover:text-text-primary transition shrink-0"
                    title={`Tambah catatan di ${col.label}`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Cards */}
              <div className="space-y-2.5 flex-1">
                {colNotes.length === 0 ? (
                  <div className="h-28 rounded-xl border border-dashed border-border-subtle flex items-center justify-center text-xs text-text-secondary/70 px-4 text-center">
                    {isOver ? 'Lepaskan kartu di sini' : 'Belum ada catatan — seret kartu ke sini'}
                  </div>
                ) : (
                  colNotes.map((note) => {
                    const selected = note.id === activeNoteId;
                    const movable = canMoveNote(note);
                    const owner = isOwnerNote(note);
                    const previewSnippet =
                      flattenBlocks(note.blocks)
                        .find((b) => b.type !== 'columns' && b.content?.trim())
                        ?.content.trim() || '';
                    const parentNote = note.parentId
                      ? allNotes.find((p) => p.id === note.parentId)
                      : undefined;

                    return (
                      <div
                        key={`board-${note.id}`}
                        draggable={movable}
                        onDragStart={(e) => {
                          if (!movable) return;
                          e.dataTransfer.setData('application/miu-kanban-note-id', note.id);
                          e.dataTransfer.effectAllowed = 'move';
                          setDraggedId(note.id);
                        }}
                        onDragEnd={() => {
                          setDraggedId(null);
                          setDropColumn(null);
                        }}
                        onClick={() => onOpenNote(note.id)}
                        className={`group rounded-xl border bg-surface overflow-hidden cursor-pointer transition hover:shadow-md ${
                          selected
                            ? 'border-accent-strong ring-1 ring-accent-strong/30 shadow-sm'
                            : 'border-border-subtle hover:border-accent-strong/60'
                        } ${draggedId === note.id ? 'opacity-45' : ''}`}
                      >
                        {note.cover && (
                          <div
                            className="h-2 w-full"
                            style={{ background: note.cover }}
                          />
                        )}

                        <div className="p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-1.5 min-w-0 flex-1">
                              {movable && (
                                <GripVertical className="w-3.5 h-3.5 text-text-secondary/45 group-hover:text-text-secondary shrink-0 mt-0.5 cursor-grab" />
                              )}
                              <span className="text-base leading-none shrink-0 mt-0.5">
                                {note.icon || '📄'}
                              </span>
                              <div className="min-w-0 flex-1">
                                <h3 className="text-sm font-bold text-text-primary leading-snug line-clamp-2">
                                  {note.title || 'Tanpa Judul'}
                                </h3>
                                {parentNote && (
                                  <p className="text-[10px] text-text-secondary truncate mt-0.5">
                                    ↳ di dalam {parentNote.icon || '📄'}{' '}
                                    {parentNote.title || 'Tanpa Judul'}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div
                              className="flex items-center gap-0.5 shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {movable && (
                                <button
                                  type="button"
                                  onClick={(e) => onToggleFavorite(note, e)}
                                  className={`p-1 rounded hover:bg-subtle transition ${
                                    note.isFavorite
                                      ? 'text-amber-500'
                                      : 'opacity-0 group-hover:opacity-100 text-text-secondary hover:text-amber-500'
                                  }`}
                                  title="Favorit"
                                >
                                  <Star
                                    className={`w-3.5 h-3.5 ${
                                      note.isFavorite ? 'fill-current' : ''
                                    }`}
                                  />
                                </button>
                              )}
                              {owner && (
                                <>
                                  <button
                                    type="button"
                                    onClick={(e) => onDuplicateNote(note, e)}
                                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-subtle text-text-secondary hover:text-text-primary transition"
                                    title="Duplikat"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => onDeleteNote(note, e)}
                                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-subtle text-text-secondary hover:text-rose-500 transition"
                                    title="Hapus"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {previewSnippet && (
                            <p className="text-xs text-text-secondary line-clamp-3 leading-relaxed">
                              {previewSnippet}
                            </p>
                          )}

                          {/* Footer Metadata + Quick Column Switcher */}
                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border-subtle/60">
                            <div className="flex items-center gap-2 text-[10px] text-text-secondary">
                              <span>{note.blocks.length} blok</span>
                              {(note.comments?.length || 0) > 0 && (
                                <span className="inline-flex items-center gap-0.5">
                                  <MessageSquare className="w-3 h-3" />
                                  {note.comments?.length}
                                </span>
                              )}
                              {!owner && (
                                <span className="inline-flex items-center gap-0.5 text-sky-500 font-medium">
                                  <Users className="w-3 h-3" />
                                  <span>Shared</span>
                                </span>
                              )}
                            </div>

                            {movable && (
                              <div
                                className="flex items-center gap-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {KANBAN_COLUMNS.map((targetCol) => {
                                  const isCurrent = (note.kanbanStatus || 'todo') === targetCol.id;
                                  return (
                                    <button
                                      key={targetCol.id}
                                      type="button"
                                      onClick={() => onMoveNoteStatus(note.id, targetCol.id)}
                                      title={`Pindah ke ${targetCol.label}`}
                                      className={`p-1 rounded-md transition ${
                                        isCurrent
                                          ? 'bg-subtle ring-1 ring-border-subtle'
                                          : 'opacity-45 hover:opacity-100 hover:bg-subtle'
                                      }`}
                                    >
                                      {renderKanbanStatusIcon(targetCol.id, 'w-3 h-3')}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {canCreateRoot && (
                <button
                  type="button"
                  onClick={() => onCreateNoteInStatus(col.id)}
                  className="w-full py-1.5 px-2.5 rounded-xl hover:bg-surface text-xs font-medium text-text-secondary hover:text-text-primary inline-flex items-center gap-1.5 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah di {col.label}</span>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
