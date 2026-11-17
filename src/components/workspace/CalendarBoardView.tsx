'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  CalendarCheck,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  FilePlus2,
  Loader2,
  Plus,
  RefreshCw,
  Unlink
} from 'lucide-react';
import {
  authorizeGoogleCalendar,
  clearStoredCalendarToken,
  fetchGoogleCalendarEvents,
  formatLocalYYYYMMDD,
  getStoredCalendarToken,
  upsertGoogleCalendarEvent,
  type GoogleCalendarEventItem
} from '@/services/googleCalendarService';
import type { NoteRecord } from '@/types/miu';
import { flattenBlocks } from '@/utils/blockTreeHelper';

interface CalendarDeadlineEntry {
  kind: 'note-deadline' | 'todo-deadline';
  id: string;
  noteId: string;
  blockId?: string;
  title: string;
  noteTitle: string;
  noteIcon: string;
  dueDate: string;
  dueTime?: string;
  checked?: boolean;
  googleEventId?: string;
  canEdit: boolean;
}

interface CalendarBoardViewProps {
  notes: NoteRecord[];
  canCreateRoot: boolean;
  canEditNote: (note: NoteRecord) => boolean;
  onOpenNote: (noteId: string) => void;
  onCreateNoteOnDate: (dueDate: string) => void;
  onToggleTodoDeadline: (noteId: string, blockId: string, nextChecked: boolean) => void;
  onSaveGoogleSyncId: (params: {
    noteId: string;
    blockId?: string;
    googleEventId: string;
  }) => Promise<void>;
}

const WEEKDAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export const CalendarBoardView: React.FC<CalendarBoardViewProps> = ({
  notes,
  canCreateRoot,
  canEditNote,
  onOpenNote,
  onCreateNoteOnDate,
  onToggleTodoDeadline,
  onSaveGoogleSyncId
}) => {
  const todayStr = formatLocalYYYYMMDD(new Date());
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Google Calendar Connection & Events State
  const [gcalToken, setGcalToken] = useState<string | null>(null);
  const [gcalEvents, setGcalEvents] = useState<GoogleCalendarEventItem[]>([]);
  const [gcalLoading, setGcalLoading] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingItemId, setSyncingItemId] = useState<string | null>(null);
  const [gcalError, setGcalError] = useState('');
  const [gcalNotice, setGcalNotice] = useState('');

  // Quick Google Event form for selected day
  const [showNewGoogleForm, setShowNewGoogleForm] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventTime, setNewEventTime] = useState('');

  useEffect(() => {
    const saved = getStoredCalendarToken();
    if (saved) setGcalToken(saved);
  }, []);

  const loadMonthGoogleEvents = useCallback(
    async (token: string, monthStart: Date) => {
      setGcalLoading(true);
      setGcalError('');
      try {
        const startRange = new Date(monthStart.getFullYear(), monthStart.getMonth(), -7);
        const endRange = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 14);
        const events = await fetchGoogleCalendarEvents(
          token,
          startRange.toISOString(),
          endRange.toISOString()
        );
        setGcalEvents(events);
      } catch (err) {
        setGcalError(
          err instanceof Error ? err.message : 'Gagal memuat agenda Google Calendar.'
        );
        if (!getStoredCalendarToken()) {
          setGcalToken(null);
        }
      } finally {
        setGcalLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!gcalToken) {
      setGcalEvents([]);
      return;
    }
    void loadMonthGoogleEvents(gcalToken, viewMonth);
  }, [gcalToken, viewMonth, loadMonthGoogleEvents]);

  // Extract all Note-level Deadlines & Todo Block Deadlines
  const miuDeadlines = useMemo<CalendarDeadlineEntry[]>(() => {
    const entries: CalendarDeadlineEntry[] = [];
    for (const note of notes) {
      const editable = canEditNote(note);
      if (note.dueDate) {
        entries.push({
          kind: 'note-deadline',
          id: `nd-${note.id}`,
          noteId: note.id,
          title: note.title || 'Tanpa Judul',
          noteTitle: note.title || 'Tanpa Judul',
          noteIcon: note.icon || '📄',
          dueDate: note.dueDate,
          dueTime: note.dueTime,
          googleEventId: note.googleEventId,
          canEdit: editable
        });
      }
      for (const blk of flattenBlocks(note.blocks)) {
        if ((blk.type === 'deadline' || blk.type === 'todo') && blk.dueDate) {
          entries.push({
            kind: 'todo-deadline',
            id: `td-${note.id}-${blk.id}`,
            noteId: note.id,
            blockId: blk.id,
            title: blk.content.trim() || 'Deadline tanpa judul',
            noteTitle: note.title || 'Tanpa Judul',
            noteIcon: note.icon || '📄',
            dueDate: blk.dueDate,
            dueTime: blk.dueTime,
            checked: Boolean(blk.checked),
            googleEventId: blk.googleEventId,
            canEdit: editable
          });
        }
      }
    }
    return entries.sort((a, b) => (a.dueTime || '99:99').localeCompare(b.dueTime || '99:99'));
  }, [notes, canEditNote]);

  // Build 42-day monthly calendar cells
  const calendarCells = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const gridStart = new Date(year, month, 1 - firstDayOfWeek);

    return Array.from({ length: 42 }, (_, idx) => {
      const dt = new Date(
        gridStart.getFullYear(),
        gridStart.getMonth(),
        gridStart.getDate() + idx
      );
      return {
        date: dt,
        dateStr: formatLocalYYYYMMDD(dt),
        dayNum: dt.getDate(),
        isCurrentMonth: dt.getMonth() === month
      };
    });
  }, [viewMonth]);

  const handleConnectGoogleCalendar = async () => {
    setGcalError('');
    setGcalNotice('');
    try {
      const token = await authorizeGoogleCalendar('consent');
      setGcalToken(token);
      setGcalNotice('Google Calendar berhasil terhubung!');
    } catch (err) {
      setGcalError(err instanceof Error ? err.message : 'Gagal menghubungkan Google Calendar.');
    }
  };

  const handleDisconnectGoogleCalendar = () => {
    clearStoredCalendarToken();
    setGcalToken(null);
    setGcalEvents([]);
    setGcalNotice('');
    setGcalError('');
  };

  const ensureValidToken = async (): Promise<string> => {
    const active = getStoredCalendarToken();
    if (active) return active;
    const fresh = await authorizeGoogleCalendar('consent');
    setGcalToken(fresh);
    return fresh;
  };

  const handleSyncSingleDeadlineToGoogle = async (entry: CalendarDeadlineEntry) => {
    setSyncingItemId(entry.id);
    setGcalError('');
    setGcalNotice('');
    try {
      const token = await ensureValidToken();
      const titlePrefix = entry.kind === 'note-deadline' ? `${entry.noteIcon} ` : '✅ ';
      const res = await upsertGoogleCalendarEvent(token, {
        title: `${titlePrefix}${entry.title}`,
        description:
          entry.kind === 'todo-deadline'
            ? `Tugas dari catatan Miu: ${entry.noteTitle}`
            : `Deadline catatan Miu Workspace: ${entry.noteTitle}`,
        dueDate: entry.dueDate,
        dueTime: entry.dueTime,
        existingEventId: entry.googleEventId
      });

      await onSaveGoogleSyncId({
        noteId: entry.noteId,
        blockId: entry.blockId,
        googleEventId: res.eventId
      });
      await loadMonthGoogleEvents(token, viewMonth);
      setGcalNotice(`"${entry.title}" disinkronkan ke Google Calendar!`);
    } catch (err) {
      setGcalError(
        err instanceof Error ? err.message : 'Gagal menyinkronkan ke Google Calendar.'
      );
    } finally {
      setSyncingItemId(null);
    }
  };

  const handleSyncAllDeadlinesToGoogle = async () => {
    const syncable = miuDeadlines.filter((d) => d.canEdit);
    if (syncable.length === 0) {
      setGcalNotice('Belum ada deadline catatan/tugas untuk disinkronkan.');
      return;
    }
    setSyncingAll(true);
    setGcalError('');
    setGcalNotice('');
    try {
      const token = await ensureValidToken();
      let syncedCount = 0;
      for (const entry of syncable) {
        const titlePrefix = entry.kind === 'note-deadline' ? `${entry.noteIcon} ` : '✅ ';
        const res = await upsertGoogleCalendarEvent(token, {
          title: `${titlePrefix}${entry.title}`,
          description:
            entry.kind === 'todo-deadline'
              ? `Tugas dari catatan Miu: ${entry.noteTitle}`
              : `Deadline catatan Miu Workspace: ${entry.noteTitle}`,
          dueDate: entry.dueDate,
          dueTime: entry.dueTime,
          existingEventId: entry.googleEventId
        });
        await onSaveGoogleSyncId({
          noteId: entry.noteId,
          blockId: entry.blockId,
          googleEventId: res.eventId
        });
        syncedCount += 1;
      }
      await loadMonthGoogleEvents(token, viewMonth);
      setGcalNotice(`${syncedCount} deadline berhasil disinkronkan ke Google Calendar!`);
    } catch (err) {
      setGcalError(
        err instanceof Error ? err.message : 'Gagal menyinkronkan deadline ke Google Calendar.'
      );
    } finally {
      setSyncingAll(false);
    }
  };

  const handleCreateDirectGoogleEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim()) return;
    setGcalLoading(true);
    setGcalError('');
    try {
      const token = await ensureValidToken();
      await upsertGoogleCalendarEvent(token, {
        title: newEventTitle.trim(),
        dueDate: selectedDate,
        dueTime: newEventTime.trim() || undefined
      });
      setNewEventTitle('');
      setNewEventTime('');
      setShowNewGoogleForm(false);
      await loadMonthGoogleEvents(token, viewMonth);
      setGcalNotice(`Agenda "${newEventTitle.trim()}" ditambahkan ke Google Calendar.`);
    } catch (err) {
      setGcalError(err instanceof Error ? err.message : 'Gagal membuat event Google Calendar.');
    } finally {
      setGcalLoading(false);
    }
  };

  const selectedDayMiuDeadlines = miuDeadlines.filter((d) => d.dueDate === selectedDate);
  const selectedDayGoogleEvents = gcalEvents.filter((g) => g.startDate === selectedDate);
  const monthLabel = viewMonth.toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric'
  });

  const selectedDatePretty = (() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    if (!y || !m || !d) return selectedDate;
    return new Date(y, m - 1, d).toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  })();

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto px-5 sm:px-8 py-6 sm:py-8 space-y-5">
      {/* Header & Google Calendar Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-border-subtle/70">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-accent-strong">
            <Calendar className="w-4 h-4" />
            <span>Kalender &amp; Deadline</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary capitalize">
            {monthLabel}
          </h1>
          <p className="text-xs text-text-secondary">
            {miuDeadlines.length} Deadline Catatan &amp; Tugas · {gcalEvents.length} Agenda Google
            Calendar
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Month Controls */}
          <div className="inline-flex items-center rounded-xl bg-subtle border border-border-subtle p-0.5">
            <button
              type="button"
              onClick={() =>
                setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
              }
              className="p-1.5 rounded-lg hover:bg-surface text-text-secondary hover:text-text-primary transition"
              title="Bulan sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                setViewMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                setSelectedDate(todayStr);
              }}
              className="px-2.5 py-1 text-xs font-semibold text-text-primary hover:bg-surface rounded-lg transition"
            >
              Hari Ini
            </button>
            <button
              type="button"
              onClick={() =>
                setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
              }
              className="p-1.5 rounded-lg hover:bg-surface text-text-secondary hover:text-text-primary transition"
              title="Bulan berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Google Calendar Integration Controls */}
          {!gcalToken ? (
            <button
              type="button"
              onClick={() => void handleConnectGoogleCalendar()}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface hover:bg-subtle border border-border-subtle hover:border-accent-strong text-xs font-bold text-text-primary shadow-sm transition"
            >
              <CalendarPlus className="w-4 h-4 text-sky-500" />
              <span>Hubungkan Google Calendar</span>
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-bold text-emerald-600 dark:text-emerald-300">
                <CalendarCheck className="w-3.5 h-3.5" />
                <span>Google Calendar Aktif</span>
              </span>

              <button
                type="button"
                disabled={gcalLoading}
                onClick={() => void loadMonthGoogleEvents(gcalToken, viewMonth)}
                className="p-2 rounded-xl bg-surface border border-border-subtle hover:border-accent-strong text-text-secondary hover:text-text-primary transition"
                title="Muat ulang agenda Google Calendar"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${gcalLoading ? 'animate-spin' : ''}`} />
              </button>

              <button
                type="button"
                disabled={syncingAll}
                onClick={() => void handleSyncAllDeadlinesToGoogle()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent-strong text-white dark:text-slate-950 text-xs font-bold hover:opacity-95 disabled:opacity-50 transition"
                title="Kirim semua deadline catatan & tugas ke Google Calendar"
              >
                {syncingAll ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                <span>Sinkron Semua Deadline</span>
              </button>

              <button
                type="button"
                onClick={handleDisconnectGoogleCalendar}
                className="p-2 rounded-xl bg-surface border border-border-subtle hover:border-rose-400 text-text-secondary hover:text-rose-500 transition"
                title="Putuskan Google Calendar"
              >
                <Unlink className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {gcalError && (
        <div className="px-3.5 py-2.5 rounded-xl bg-rose-500/10 border border-rose-400/30 text-xs text-rose-500 flex items-center justify-between gap-2">
          <span>{gcalError}</span>
          <button
            type="button"
            onClick={() => setGcalError('')}
            className="text-[11px] font-bold hover:underline shrink-0"
          >
            Tutup
          </button>
        </div>
      )}

      {gcalNotice && (
        <div className="px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-600 dark:text-emerald-300 flex items-center justify-between gap-2">
          <span>{gcalNotice}</span>
          <button
            type="button"
            onClick={() => setGcalNotice('')}
            className="text-[11px] font-bold hover:underline shrink-0"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Calendar Grid + Selected Day Agenda Split */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">
        {/* Monthly Calendar Grid (2/3 width on xl) */}
        <div className="xl:col-span-2 rounded-2xl border border-border-subtle bg-surface overflow-hidden shadow-sm">
          <div className="grid grid-cols-7 border-b border-border-subtle bg-subtle/50">
            {WEEKDAY_LABELS.map((day) => (
              <div
                key={day}
                className="py-2 text-center text-[11px] font-bold uppercase tracking-wider text-text-secondary"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {calendarCells.map((cell) => {
              const isToday = cell.dateStr === todayStr;
              const isSelected = cell.dateStr === selectedDate;
              const dayMiu = miuDeadlines.filter((d) => d.dueDate === cell.dateStr);
              const dayGcal = gcalEvents.filter((g) => g.startDate === cell.dateStr);
              const totalItems = dayMiu.length + dayGcal.length;

              return (
                <div
                  key={cell.dateStr}
                  onClick={() => setSelectedDate(cell.dateStr)}
                  className={`group min-h-[88px] sm:min-h-[104px] p-1.5 border-b border-r border-border-subtle/60 cursor-pointer transition flex flex-col gap-1 ${
                    isSelected
                      ? 'bg-accent-strong/10 ring-1 ring-inset ring-accent-strong/50'
                      : cell.isCurrentMonth
                        ? 'hover:bg-subtle/45'
                        : 'bg-subtle/25 opacity-55 hover:opacity-85'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        isToday
                          ? 'bg-accent-strong text-white dark:text-slate-950'
                          : isSelected
                            ? 'text-accent-strong'
                            : 'text-text-primary'
                      }`}
                    >
                      {cell.dayNum}
                    </span>

                    {canCreateRoot && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCreateNoteOnDate(cell.dateStr);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-surface text-text-secondary hover:text-accent-strong transition"
                        title={`Buat catatan ber-deadline ${cell.dateStr}`}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Compact Pills Inside Date Cell */}
                  <div className="space-y-0.5 overflow-hidden">
                    {dayMiu.slice(0, 2).map((item) => (
                      <div
                        key={item.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenNote(item.noteId);
                        }}
                        className={`px-1.5 py-0.5 rounded text-[10px] truncate font-medium transition ${
                          item.checked
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 line-through opacity-75'
                            : item.kind === 'note-deadline'
                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25'
                              : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/25'
                        }`}
                        title={`${item.title} (${item.noteTitle})`}
                      >
                        {item.kind === 'note-deadline' ? `${item.noteIcon} ` : '☑ '}
                        {item.title}
                      </div>
                    ))}

                    {dayGcal.slice(0, Math.max(0, 3 - Math.min(2, dayMiu.length))).map((ev) => (
                      <div
                        key={ev.id}
                        className="px-1.5 py-0.5 rounded text-[10px] truncate font-medium bg-sky-500/15 text-sky-600 dark:text-sky-300"
                        title={`Google Calendar: ${ev.summary}`}
                      >
                        🗓️ {ev.startTime ? `${ev.startTime} ` : ''}
                        {ev.summary}
                      </div>
                    ))}

                    {totalItems > 3 && (
                      <div className="text-[9px] font-mono text-text-secondary px-1">
                        +{totalItems - 3} lagi
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Date Agenda & Quick Add Panel (1/3 width on xl) */}
        <div className="rounded-2xl border border-border-subtle bg-surface p-4 space-y-4 shadow-sm">
          <div className="flex items-start justify-between gap-2 pb-3 border-b border-border-subtle">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-text-secondary">
                Agenda Tanggal
              </span>
              <h2 className="text-sm font-bold text-text-primary capitalize mt-0.5">
                {selectedDatePretty}
              </h2>
            </div>

            {canCreateRoot && (
              <button
                type="button"
                onClick={() => onCreateNoteOnDate(selectedDate)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-accent-strong text-white dark:text-slate-950 text-[11px] font-bold hover:opacity-95 transition shrink-0"
              >
                <FilePlus2 className="w-3.5 h-3.5" />
                <span>+ Catatan</span>
              </button>
            )}
          </div>

          {/* Miu Deadlines on Selected Day */}
          <div className="space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              Deadline Catatan &amp; Tugas Miu ({selectedDayMiuDeadlines.length})
            </div>

            {selectedDayMiuDeadlines.length === 0 ? (
              <p className="text-xs text-text-secondary/75 py-2 italic">
                Belum ada deadline catatan di tanggal ini.
              </p>
            ) : (
              <div className="space-y-2">
                {selectedDayMiuDeadlines.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-2.5 rounded-xl bg-subtle/50 border border-border-subtle space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0 flex-1">
                        {entry.kind === 'todo-deadline' && entry.blockId ? (
                          <button
                            type="button"
                            disabled={!entry.canEdit}
                            onClick={() =>
                              onToggleTodoDeadline(entry.noteId, entry.blockId!, !entry.checked)
                            }
                            className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition ${
                              entry.checked
                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                : 'border-text-secondary/50 bg-surface'
                            }`}
                          >
                            {entry.checked && <Check className="w-3 h-3 stroke-[3]" />}
                          </button>
                        ) : (
                          <span className="text-sm leading-none shrink-0 mt-0.5">
                            {entry.noteIcon}
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => onOpenNote(entry.noteId)}
                          className="text-left min-w-0 flex-1 group"
                        >
                          <p
                            className={`text-xs font-bold group-hover:text-accent-strong transition ${
                              entry.checked ? 'line-through text-text-secondary' : 'text-text-primary'
                            }`}
                          >
                            {entry.title}
                          </p>
                          <p className="text-[10px] text-text-secondary truncate mt-0.5">
                            {entry.kind === 'todo-deadline'
                              ? `Di catatan: ${entry.noteIcon} ${entry.noteTitle}`
                              : 'Deadline Halaman'}
                            {entry.dueTime ? ` · ⏰ ${entry.dueTime}` : ''}
                          </p>
                        </button>
                      </div>

                      {entry.canEdit && (
                        <button
                          type="button"
                          disabled={syncingItemId === entry.id}
                          onClick={() => void handleSyncSingleDeadlineToGoogle(entry)}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border transition shrink-0 ${
                            entry.googleEventId
                              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-300'
                              : 'bg-surface border-border-subtle text-text-secondary hover:text-text-primary hover:border-accent-strong'
                          }`}
                          title={
                            entry.googleEventId
                              ? 'Perbarui event di Google Calendar'
                              : 'Kirim deadline ini ke Google Calendar'
                          }
                        >
                          {syncingItemId === entry.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <CalendarPlus className="w-3 h-3" />
                          )}
                          <span>{entry.googleEventId ? 'Tersinkron' : 'Sync'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Google Calendar Events on Selected Day */}
          <div className="space-y-2 pt-3 border-t border-border-subtle">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-500">
                Google Calendar ({selectedDayGoogleEvents.length})
              </span>
              {gcalToken && (
                <button
                  type="button"
                  onClick={() => setShowNewGoogleForm((v) => !v)}
                  className="text-[11px] font-semibold text-accent-strong hover:underline"
                >
                  {showNewGoogleForm ? 'Tutup' : '+ Tambah Event'}
                </button>
              )}
            </div>

            {showNewGoogleForm && gcalToken && (
              <form
                onSubmit={(e) => void handleCreateDirectGoogleEvent(e)}
                className="p-2.5 rounded-xl bg-subtle/60 border border-border-subtle space-y-2"
              >
                <input
                  type="text"
                  required
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  placeholder="Nama agenda di Google Calendar..."
                  className="w-full bg-surface border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent-strong"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={newEventTime}
                    onChange={(e) => setNewEventTime(e.target.value)}
                    className="bg-surface border border-border-subtle rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={gcalLoading}
                    className="flex-1 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold transition"
                  >
                    Simpan ke Google
                  </button>
                </div>
              </form>
            )}

            {!gcalToken ? (
              <p className="text-xs text-text-secondary/75 leading-relaxed">
                Hubungkan <strong>Google Calendar</strong> untuk melihat agenda kalendermu di sini
                dan mengirim deadline catatan langsung ke Google Calendar.
              </p>
            ) : selectedDayGoogleEvents.length === 0 ? (
              <p className="text-xs text-text-secondary/75 italic">
                Tidak ada event Google Calendar di tanggal ini.
              </p>
            ) : (
              <div className="space-y-1.5">
                {selectedDayGoogleEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-400/30 flex items-start justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-text-primary truncate">{ev.summary}</p>
                      <p className="text-[10px] text-text-secondary flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>{ev.isAllDay ? 'Sepanjang hari' : ev.startTime}</span>
                      </p>
                    </div>
                    {ev.htmlLink && (
                      <a
                        href={ev.htmlLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded hover:bg-surface text-sky-500 shrink-0"
                        title="Buka di Google Calendar"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
