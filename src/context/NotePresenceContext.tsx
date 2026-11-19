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

  const [neonConfigured, setNeonConfigured] = useState<boolean>(() => isNeonConfigured());
  const [presenceState, setPresenceState] = useState<{
    noteId: string;
    rows: readonly CollaboratorPresence[];
  }>({ noteId: '', rows: NO_COLLABORATORS });
  const [ttlTick, setTtlTick] = useState<number>(() => Date.now());

  const serverClockOffsetRef = useRef<number>(0);
  const presenceRowCountRef = useRef<number>(0);
  presenceRowCountRef.current = presenceState.rows.length;

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
  const backoffRetryTimerRef = useRef<number | null>(null);
  const activePostedNoteIdRef = useRef<string>('');
  const backoffUntilByNoteRef = useRef<Record<string, number>>({});

  const userId = currentUser?.id || '';
  const userEmail = currentUser?.email || '';
  const userName =
    currentUser?.name || `Tamu #${mySessionId.slice(-4).toUpperCase()}`;
  const userPicture = currentUser?.picture || '';

  useEffect(() => {
    if (neonConfigured) return;
    if (isNeonConfigured()) {
      setNeonConfigured(true);
      return;
    }
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (isNeonConfigured()) {
        setNeonConfigured(true);
        window.clearInterval(timer);
      } else if (attempts >= 30) {
        window.clearInterval(timer);
      }
    }, 400);
    return () => window.clearInterval(timer);
  }, [neonConfigured, activeNoteId, userId, isPublicShareAccess]);

  const canPublishPresence =
    isRealtimeAvailable &&
    (neonConfigured || isNeonConfigured()) &&
    Boolean(activeNoteId) &&
    (Boolean(userId) || isPublicShareAccess);

  const activeNoteIdRef = useRef<string>(activeNoteId || '');
  activeNoteIdRef.current = activeNoteId || '';
  const canPublishPresenceRef = useRef<boolean>(canPublishPresence);
  canPublishPresenceRef.current = canPublishPresence;
  const userIdentityRef = useRef({
    userId,
    userEmail,
    userName,
    userPicture,
    color: myColor
  });
  userIdentityRef.current = {
    userId,
    userEmail,
    userName,
    userPicture,
    color: myColor
  };

  const updateServerClockOffset = useCallback((serverTime?: number) => {
    if (typeof serverTime === 'number' && Number.isFinite(serverTime) && serverTime > 1_000_000_000_000) {
      const nextOffset = serverTime - Date.now();
      const prevOffset = serverClockOffsetRef.current;
      serverClockOffsetRef.current = nextOffset;
      if (presenceRowCountRef.current > 0 && Math.abs(nextOffset - prevOffset) > 1_500) {
        setTtlTick(Date.now());
      }
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
    const currentActiveNoteId = activeNoteIdRef.current;
    if (!canPublishPresenceRef.current || !snap.noteId || snap.noteId !== currentActiveNoteId) {
      return;
    }

    const targetNoteId = snap.noteId;
    const now = Date.now();
    const backoffUntil = backoffUntilByNoteRef.current[targetNoteId] || 0;
    if (now < backoffUntil) return;

    lastSentAtRef.current = now;
    lastCursorWindowStartRef.current = 0;

    const identity = userIdentityRef.current;

    try {
      const res = await fetch('/api/realtime/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          action: 'upsert',
          noteId: targetNoteId,
          sessionId: mySessionId,
          userId: identity.userId,
          userName: identity.userName,
          userEmail: identity.userEmail,
          userPicture: identity.userPicture,
          color: identity.color,
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
        // Note not yet synced to Neon or unauthorized; back off briefly and retry once ready
        const waitMs = res.status === 404 ? 3_500 : 6_000;
        backoffUntilByNoteRef.current[targetNoteId] = Date.now() + waitMs;
        if (
          res.status === 404 &&
          !backoffRetryTimerRef.current &&
          localSnapshotRef.current.noteId === targetNoteId &&
          canPublishPresenceRef.current
        ) {
          backoffRetryTimerRef.current = window.setTimeout(() => {
            backoffRetryTimerRef.current = null;
            void flushPresenceToServer();
          }, waitMs + 100);
        }
        return;
      }

      if (res.ok) {
        delete backoffUntilByNoteRef.current[targetNoteId];
        if (localSnapshotRef.current.noteId === targetNoteId && canPublishPresenceRef.current) {
          activePostedNoteIdRef.current = targetNoteId;
        }
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
  }, [mySessionId, updateServerClockOffset]);

  const flushPresenceRef = useRef(flushPresenceToServer);
  flushPresenceRef.current = flushPresenceToServer;

  const scheduleCursorFlush = useCallback(
    (immediate = false) => {
      if (!canPublishPresenceRef.current) return;

      const now = Date.now();
      if (immediate && now - lastSentAtRef.current >= 65) {
        if (cursorTimerRef.current) {
          window.clearTimeout(cursorTimerRef.current);
          cursorTimerRef.current = null;
        }
        void flushPresenceRef.current();
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
        void flushPresenceRef.current();
        return;
      }

      if (cursorTimerRef.current) {
        window.clearTimeout(cursorTimerRef.current);
      }
      cursorTimerRef.current = window.setTimeout(() => {
        cursorTimerRef.current = null;
        void flushPresenceRef.current();
      }, 125);
    },
    []
  );

  const schedulePointerFlush = useCallback(() => {
    if (!canPublishPresenceRef.current) return;
    if (pointerTimerRef.current) return;

    const sinceLast = Date.now() - lastSentAtRef.current;
    const waitMs = Math.max(120, 350 - sinceLast);
    pointerTimerRef.current = window.setTimeout(() => {
      pointerTimerRef.current = null;
      if (!cursorTimerRef.current) {
        void flushPresenceRef.current();
      }
    }, waitMs);
  }, []);

  const reportLocalCursor = useCallback(
    (report: LocalCursorReport) => {
      if (!report.noteId || report.noteId !== activeNoteIdRef.current) return;

      const prev = localSnapshotRef.current;
      const isSameNote = prev.noteId === report.noteId;
      const start = Math.max(
        0,
        Math.floor(report.selectionStart ?? (isSameNote ? prev.selectionStart : 0))
      );
      const end = Math.max(start, Math.floor(report.selectionEnd ?? start));
      const isEditing = Boolean(report.isEditing);

      const changed =
        !isSameNote ||
        prev.blockId !== report.blockId ||
        prev.field !== report.field ||
        prev.selectionStart !== start ||
        prev.selectionEnd !== end ||
        prev.isEditing !== isEditing;

      if (!changed) return;

      const blockChanged = !isSameNote || prev.blockId !== report.blockId;
      localSnapshotRef.current = {
        noteId: report.noteId,
        blockId: report.blockId,
        field: report.field,
        selectionStart: start,
        selectionEnd: end,
        isEditing,
        pointerBlockId: isSameNote ? prev.pointerBlockId : null,
        pointerX: isSameNote ? prev.pointerX : null,
        pointerY: isSameNote ? prev.pointerY : null
      };

      scheduleCursorFlush(Boolean(report.immediate || blockChanged));
    },
    [scheduleCursorFlush]
  );

  const reportLocalPointer = useCallback(
    (report: LocalPointerReport) => {
      if (!report.noteId || report.noteId !== activeNoteIdRef.current) return;

      const prev = localSnapshotRef.current;
      const isSameNote = prev.noteId === report.noteId;
      const prevPointerBlockId = isSameNote ? prev.pointerBlockId : null;
      const prevPointerX = isSameNote ? prev.pointerX : null;
      const prevPointerY = isSameNote ? prev.pointerY : null;
      const pointerChangedBlock = prevPointerBlockId !== report.pointerBlockId;
      const pointerCleared = report.pointerBlockId === null && prevPointerBlockId !== null;
      const dist = Math.hypot(
        (report.pointerX ?? 0) - (prevPointerX ?? 0),
        (report.pointerY ?? 0) - (prevPointerY ?? 0)
      );

      if (isSameNote && !pointerChangedBlock && !pointerCleared && dist < 0.03) {
        return;
      }

      const prevBlockId = isSameNote ? prev.blockId : '';
      const prevIsEditing = isSameNote ? prev.isEditing : false;

      localSnapshotRef.current = {
        noteId: report.noteId,
        field: isSameNote ? prev.field : 'content',
        selectionStart: isSameNote ? prev.selectionStart : 0,
        selectionEnd: isSameNote ? prev.selectionEnd : 0,
        isEditing: prevIsEditing,
        pointerBlockId: report.pointerBlockId,
        pointerX: report.pointerX,
        pointerY: report.pointerY,
        // For viewers who haven't clicked any block yet, also reflect their active hovered block
        blockId:
          !prevIsEditing && !prevBlockId && report.pointerBlockId
            ? report.pointerBlockId
            : prevBlockId
      };

      schedulePointerFlush();
    },
    [schedulePointerFlush]
  );

  // Republish seamlessly when user identity details hydrate/change without dropping snapshot or sending leave
  const identityKey = `${userId}|${userEmail}|${userName}|${userPicture}|${myColor}`;
  const prevIdentityKeyRef = useRef<string>(identityKey);
  useEffect(() => {
    if (prevIdentityKeyRef.current === identityKey) return;
    prevIdentityKeyRef.current = identityKey;
    if (canPublishPresenceRef.current && activePostedNoteIdRef.current === activeNoteIdRef.current) {
      void flushPresenceRef.current();
    }
  }, [identityKey]);

  // Sync note switch, announce arrival, keepalive heartbeat, and leave cleanup
  useEffect(() => {
    const previousNoteId = activePostedNoteIdRef.current;
    if (previousNoteId && previousNoteId !== activeNoteId) {
      sendLeavePresence(previousNoteId, false);
      activePostedNoteIdRef.current = '';
    }

    if (backoffRetryTimerRef.current) {
      window.clearTimeout(backoffRetryTimerRef.current);
      backoffRetryTimerRef.current = null;
    }

    const nextNoteId = activeNoteId || '';
    if (localSnapshotRef.current.noteId !== nextNoteId) {
      if (cursorTimerRef.current) {
        window.clearTimeout(cursorTimerRef.current);
        cursorTimerRef.current = null;
      }
      if (pointerTimerRef.current) {
        window.clearTimeout(pointerTimerRef.current);
        pointerTimerRef.current = null;
      }

      localSnapshotRef.current = {
        noteId: nextNoteId,
        blockId: '',
        field: 'content',
        selectionStart: 0,
        selectionEnd: 0,
        isEditing: false,
        pointerBlockId: null,
        pointerX: null,
        pointerY: null
      };
    }

    if (!canPublishPresence || !activeNoteId) {
      return;
    }

    // Small initial announcement so collaborators immediately see this session online
    const initialTimer = window.setTimeout(() => {
      void flushPresenceRef.current();
    }, 250);

    const heartbeat = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (Date.now() - lastSentAtRef.current >= PRESENCE_HEARTBEAT_MS - 1_500) {
        void flushPresenceRef.current();
      }
    }, PRESENCE_HEARTBEAT_MS);

    const handleVisibility = () => {
      if (!document.hidden && Date.now() - lastSentAtRef.current >= 5_000) {
        void flushPresenceRef.current();
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
      if (backoffRetryTimerRef.current) {
        window.clearTimeout(backoffRetryTimerRef.current);
        backoffRetryTimerRef.current = null;
      }
      if (activePostedNoteIdRef.current === activeNoteId) {
        sendLeavePresence(activeNoteId, true);
        activePostedNoteIdRef.current = '';
      }
    };
  }, [activeNoteId, canPublishPresence, sendLeavePresence]);

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
