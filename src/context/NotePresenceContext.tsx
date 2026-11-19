'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { useMiu } from '@/context/MiuContext';
import { useIsRealtimeAvailable } from '@/components/realtime/RealtimeRoot';
import {
  getOrCreatePresenceSessionId,
  pickCollaboratorColor,
  PRESENCE_HEARTBEAT_MS,
  PRESENCE_TTL_MS,
  type PresenceField
} from '@/lib/presenceHelper';
import {
  filterActiveRemoteCollaborators,
  type CollaboratorPresence
} from '@/lib/realtimeShared';
import { isNeonConfigured } from '@/services/cloudServices';

export interface LocalCursorReport {
  noteId: string;
  blockId: string;
  field: PresenceField;
  selectionStart?: number;
  selectionEnd?: number;
  isEditing?: boolean;
  immediate?: boolean;
}

export interface LocalPointerReport {
  noteId: string;
  pointerBlockId: string | null;
  pointerX: number | null;
  pointerY: number | null;
}

interface LocalPresenceSnapshot {
  noteId: string;
  blockId: string;
  field: PresenceField;
  selectionStart: number;
  selectionEnd: number;
  isEditing: boolean;
  pointerBlockId: string | null;
  pointerX: number | null;
  pointerY: number | null;
}

interface NotePresenceContextValue {
  mySessionId: string;
  myColor: string;
  remoteCollaborators: CollaboratorPresence[];
  setRawPresenceRows: (noteId: string, rows: readonly CollaboratorPresence[]) => void;
  clearPresenceRows: (noteId?: string) => void;
  updateServerClockOffset: (serverTime?: number) => void;
  reportLocalCursor: (report: LocalCursorReport) => void;
  reportLocalPointer: (report: LocalPointerReport) => void;
}

const NotePresenceContext = createContext<NotePresenceContextValue | null>(null);

const NO_COLLABORATORS: CollaboratorPresence[] = [];

export const NotePresenceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isRealtimeAvailable = useIsRealtimeAvailable();
  const { activeNoteId, currentUser, isPublicShareAccess } = useMiu();

  const [mySessionId] = useState<string>(() => getOrCreatePresenceSessionId());
  const myColor = useMemo(() => pickCollaboratorColor(mySessionId), [mySessionId]);

  const [presenceState, setPresenceState] = useState<{
    noteId: string;
    rows: readonly CollaboratorPresence[];
  }>({ noteId: '', rows: NO_COLLABORATORS });
  const [ttlTick, setTtlTick] = useState<number>(() => Date.now());

  const serverClockOffsetRef = useRef<number>(0);
  const localSnapshotRef = useRef<LocalPresenceSnapshot>({
    noteId: '',
    blockId: '',
    field: 'content',
    selectionStart: 0,
    selectionEnd: 0,
    isEditing: false,
    pointerBlockId: null,
    pointerX: null,
    pointerY: null
  });
  const lastSentAtRef = useRef<number>(0);
  const lastCursorWindowStartRef = useRef<number>(0);
  const cursorTimerRef = useRef<number | null>(null);
  const pointerTimerRef = useRef<number | null>(null);
  const activePostedNoteIdRef = useRef<string>('');
  const backoffUntilByNoteRef = useRef<Record<string, number>>({});

  const userId = currentUser?.id || '';
  const userEmail = currentUser?.email || '';
  const userName =
    currentUser?.name || `Tamu #${mySessionId.slice(-4).toUpperCase()}`;
  const userPicture = currentUser?.picture || '';

  const canPublishPresence =
    isRealtimeAvailable &&
    isNeonConfigured() &&
    Boolean(activeNoteId) &&
    (Boolean(userId) || isPublicShareAccess);

  const updateServerClockOffset = useCallback((serverTime?: number) => {
    if (typeof serverTime === 'number' && Number.isFinite(serverTime) && serverTime > 1_000_000_000_000) {
      serverClockOffsetRef.current = serverTime - Date.now();
    }
  }, []);

  const setRawPresenceRows = useCallback(
    (noteId: string, rows: readonly CollaboratorPresence[]) => {
      setPresenceState({ noteId, rows });
      setTtlTick(Date.now());
    },
    []
  );

  const clearPresenceRows = useCallback((noteId?: string) => {
    setPresenceState((prev) => {
      if (noteId && prev.noteId !== noteId) return prev;
      if (prev.rows.length === 0) return prev;
      return { noteId: '', rows: NO_COLLABORATORS };
    });
  }, []);

  // Expire stale collaborators cleanly even when no new realtime event arrives
  useEffect(() => {
    if (presenceState.rows.length === 0) return;
    const timer = window.setInterval(() => {
      setTtlTick(Date.now());
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [presenceState.rows.length]);

  const sendLeavePresence = useCallback(
    (noteIdToLeave: string, useBeacon = false) => {
      if (!noteIdToLeave || !mySessionId) return;
      if (!isRealtimeAvailable || !isNeonConfigured()) return;

      const payload = JSON.stringify({
        action: 'leave',
        noteId: noteIdToLeave,
        sessionId: mySessionId
      });

      if (useBeacon && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([payload], { type: 'application/json' });
        if (navigator.sendBeacon('/api/realtime/presence', blob)) {
          return;
        }
      }

      void fetch('/api/realtime/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true
      }).catch(() => {});
    },
    [isRealtimeAvailable, mySessionId]
  );

  const flushPresenceToServer = useCallback(async () => {
    const snap = localSnapshotRef.current;
    if (!canPublishPresence || !snap.noteId || snap.noteId !== activeNoteId) {
      return;
    }

    const now = Date.now();
    const backoffUntil = backoffUntilByNoteRef.current[snap.noteId] || 0;
    if (now < backoffUntil) return;

    lastSentAtRef.current = now;
    lastCursorWindowStartRef.current = 0;

    try {
      const res = await fetch('/api/realtime/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          action: 'upsert',
          noteId: snap.noteId,
          sessionId: mySessionId,
          userId,
          userName,
          userEmail,
          userPicture,
          color: myColor,
          blockId: snap.blockId,
          field: snap.field,
          selectionStart: snap.selectionStart,
          selectionEnd: snap.selectionEnd,
          isEditing: snap.isEditing,
          pointerBlockId: snap.pointerBlockId,
          pointerX: snap.pointerX,
          pointerY: snap.pointerY
        })
      });

      if (res.status === 404 || res.status === 403) {
        // Note not yet synced to Neon or unauthorized; back off briefly so we don't spam
        backoffUntilByNoteRef.current[snap.noteId] = Date.now() + 6_000;
        return;
      }

      if (res.ok) {
        delete backoffUntilByNoteRef.current[snap.noteId];
        activePostedNoteIdRef.current = snap.noteId;
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          serverTime?: number;
        };
        if (data.serverTime) {
          updateServerClockOffset(data.serverTime);
        }
      }
    } catch {
      // ignore transient network glitches
    }
  }, [
    activeNoteId,
    canPublishPresence,
    myColor,
    mySessionId,
    updateServerClockOffset,
    userEmail,
    userId,
    userName,
    userPicture
  ]);

  const scheduleCursorFlush = useCallback(
    (immediate = false) => {
      if (!canPublishPresence) return;

      const now = Date.now();
      if (immediate && now - lastSentAtRef.current >= 65) {
        if (cursorTimerRef.current) {
          window.clearTimeout(cursorTimerRef.current);
          cursorTimerRef.current = null;
        }
        void flushPresenceToServer();
        return;
      }

      if (!lastCursorWindowStartRef.current) {
        lastCursorWindowStartRef.current = now;
      }

      const elapsedWindow = now - lastCursorWindowStartRef.current;
      if (elapsedWindow >= 280) {
        if (cursorTimerRef.current) {
          window.clearTimeout(cursorTimerRef.current);
          cursorTimerRef.current = null;
        }
        void flushPresenceToServer();
        return;
      }

      if (cursorTimerRef.current) {
        window.clearTimeout(cursorTimerRef.current);
      }
      cursorTimerRef.current = window.setTimeout(() => {
        cursorTimerRef.current = null;
        void flushPresenceToServer();
      }, 125);
    },
    [canPublishPresence, flushPresenceToServer]
  );

  const schedulePointerFlush = useCallback(() => {
    if (!canPublishPresence) return;
    if (pointerTimerRef.current) return;

    const sinceLast = Date.now() - lastSentAtRef.current;
    const waitMs = Math.max(120, 350 - sinceLast);
    pointerTimerRef.current = window.setTimeout(() => {
      pointerTimerRef.current = null;
      if (!cursorTimerRef.current) {
        void flushPresenceToServer();
      }
    }, waitMs);
  }, [canPublishPresence, flushPresenceToServer]);

  const reportLocalCursor = useCallback(
    (report: LocalCursorReport) => {
      if (!report.noteId || report.noteId !== activeNoteId) return;

      const prev = localSnapshotRef.current;
      const start = Math.max(0, Math.floor(report.selectionStart ?? prev.selectionStart ?? 0));
      const end = Math.max(start, Math.floor(report.selectionEnd ?? start));
      const isEditing = Boolean(report.isEditing);

      const changed =
        prev.noteId !== report.noteId ||
        prev.blockId !== report.blockId ||
        prev.field !== report.field ||
        prev.selectionStart !== start ||
        prev.selectionEnd !== end ||
        prev.isEditing !== isEditing;

      if (!changed) return;

      const blockChanged = prev.blockId !== report.blockId || prev.noteId !== report.noteId;
      localSnapshotRef.current = {
        ...prev,
        noteId: report.noteId,
        blockId: report.blockId,
        field: report.field,
        selectionStart: start,
        selectionEnd: end,
        isEditing
      };

      scheduleCursorFlush(Boolean(report.immediate || blockChanged));
    },
    [activeNoteId, scheduleCursorFlush]
  );

  const reportLocalPointer = useCallback(
    (report: LocalPointerReport) => {
      if (!report.noteId || report.noteId !== activeNoteId) return;

      const prev = localSnapshotRef.current;
      const pointerChangedBlock = prev.pointerBlockId !== report.pointerBlockId;
      const pointerCleared = report.pointerBlockId === null && prev.pointerBlockId !== null;
      const dist = Math.hypot(
        (report.pointerX ?? 0) - (prev.pointerX ?? 0),
        (report.pointerY ?? 0) - (prev.pointerY ?? 0)
      );

      if (!pointerChangedBlock && !pointerCleared && dist < 0.03) {
        return;
      }

      localSnapshotRef.current = {
        ...prev,
        noteId: report.noteId,
        pointerBlockId: report.pointerBlockId,
        pointerX: report.pointerX,
        pointerY: report.pointerY,
        // For viewers who haven't clicked any block yet, also reflect their active hovered block
        blockId:
          !prev.isEditing && !prev.blockId && report.pointerBlockId
            ? report.pointerBlockId
            : prev.blockId
      };

      schedulePointerFlush();
    },
    [activeNoteId, schedulePointerFlush]
  );

  // Sync note switch, announce arrival, keepalive heartbeat, and leave cleanup
  useEffect(() => {
    const previousNoteId = activePostedNoteIdRef.current;
    if (previousNoteId && previousNoteId !== activeNoteId) {
      sendLeavePresence(previousNoteId, false);
      activePostedNoteIdRef.current = '';
    }

    if (cursorTimerRef.current) {
      window.clearTimeout(cursorTimerRef.current);
      cursorTimerRef.current = null;
    }
    if (pointerTimerRef.current) {
      window.clearTimeout(pointerTimerRef.current);
      pointerTimerRef.current = null;
    }

    localSnapshotRef.current = {
      noteId: activeNoteId || '',
      blockId: '',
      field: 'content',
      selectionStart: 0,
      selectionEnd: 0,
      isEditing: false,
      pointerBlockId: null,
      pointerX: null,
      pointerY: null
    };

    if (!canPublishPresence || !activeNoteId) {
      return;
    }

    // Small initial announcement so collaborators immediately see this session online
    const initialTimer = window.setTimeout(() => {
      void flushPresenceToServer();
    }, 350);

    const heartbeat = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (Date.now() - lastSentAtRef.current >= PRESENCE_HEARTBEAT_MS - 1_500) {
        void flushPresenceToServer();
      }
    }, PRESENCE_HEARTBEAT_MS);

    const handleVisibility = () => {
      if (!document.hidden && Date.now() - lastSentAtRef.current >= 5_000) {
        void flushPresenceToServer();
      }
    };

    const handlePageExit = () => {
      if (activeNoteId) {
        sendLeavePresence(activeNoteId, true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePageExit);
    window.addEventListener('beforeunload', handlePageExit);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(heartbeat);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handlePageExit);
      window.removeEventListener('beforeunload', handlePageExit);
      if (cursorTimerRef.current) {
        window.clearTimeout(cursorTimerRef.current);
        cursorTimerRef.current = null;
      }
      if (pointerTimerRef.current) {
        window.clearTimeout(pointerTimerRef.current);
        pointerTimerRef.current = null;
      }
      if (activePostedNoteIdRef.current === activeNoteId) {
        sendLeavePresence(activeNoteId, true);
        activePostedNoteIdRef.current = '';
      }
    };
  }, [activeNoteId, canPublishPresence, flushPresenceToServer, sendLeavePresence]);

  const remoteCollaborators = useMemo(() => {
    if (!activeNoteId || presenceState.noteId !== activeNoteId) {
      return NO_COLLABORATORS;
    }
    const adjustedNow = ttlTick + serverClockOffsetRef.current;
    return filterActiveRemoteCollaborators(
      presenceState.rows,
      activeNoteId,
      mySessionId,
      adjustedNow,
      PRESENCE_TTL_MS
    );
  }, [activeNoteId, mySessionId, presenceState, ttlTick]);

  const value = useMemo<NotePresenceContextValue>(
    () => ({
      mySessionId,
      myColor,
      remoteCollaborators,
      setRawPresenceRows,
      clearPresenceRows,
      updateServerClockOffset,
      reportLocalCursor,
      reportLocalPointer
    }),
    [
      clearPresenceRows,
      myColor,
      mySessionId,
      remoteCollaborators,
      reportLocalCursor,
      reportLocalPointer,
      setRawPresenceRows,
      updateServerClockOffset
    ]
  );

  return (
    <NotePresenceContext.Provider value={value}>{children}</NotePresenceContext.Provider>
  );
};

export function useNotePresence(): NotePresenceContextValue {
  const ctx = useContext(NotePresenceContext);
  if (!ctx) {
    throw new Error('useNotePresence must be used within NotePresenceProvider');
  }
  return ctx;
}
