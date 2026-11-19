'use client';

import React, { useCallback, useEffect, useState } from 'react';
import type { SealedLiveQuery } from '@neon/realtime/client';
import { useLiveQuery as useNeonLiveQuery } from '@neon/realtime-react';
import { db } from '@/db/database';
import { useMiu } from '@/context/MiuContext';
import { useNotePresence } from '@/context/NotePresenceContext';
import {
  parseNeonNoteRow,
  parseNeonPresenceRow,
  type NeonNotePresenceRow,
  type NeonNoteRow
} from '@/lib/realtimeShared';
import { isNeonConfigured } from '@/services/cloudServices';
import { useIsRealtimeAvailable } from './RealtimeRoot';

interface SealedNoteState {
  noteId: string;
  ownerKey: string;
  noteGeneration: number;
  presenceGeneration: number;
  sealedQuery?: SealedLiveQuery<NeonNoteRow>;
  presenceSealedQuery?: SealedLiveQuery<NeonNotePresenceRow>;
}

interface LiveQueryApiResult {
  status: number;
  sealedQuery?: SealedLiveQuery<NeonNoteRow>;
  presenceSealedQuery?: SealedLiveQuery<NeonNotePresenceRow>;
  serverTime?: number;
}

async function fetchInitialNoteAndPresenceQueries(
  noteId: string,
  userId: string,
  userEmail: string
): Promise<LiveQueryApiResult> {
  const res = await fetch('/api/realtime/live-query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({
      kind: 'note',
      includePresence: true,
      noteId,
      userId,
      userEmail
    })
  });

  if (res.status === 403 || res.status === 404 || res.status === 503) {
    return { status: res.status };
  }

  if (!res.ok) {
    throw new Error(`Gagal mengambil live query catatan (${res.status})`);
  }

  const payload = (await res.json()) as {
    sealedQuery?: SealedLiveQuery<NeonNoteRow>;
    presenceSealedQuery?: SealedLiveQuery<NeonNotePresenceRow>;
    serverTime?: number;
  };
  return {
    status: res.status,
    sealedQuery: payload.sealedQuery,
    presenceSealedQuery: payload.presenceSealedQuery,
    serverTime: payload.serverTime
  };
}

async function renewSingleSealedQuery<Row>(
  kind: 'note' | 'presence',
  noteId: string,
  userId: string,
  userEmail: string
): Promise<{ sealedQuery: SealedLiveQuery<Row>; serverTime?: number }> {
  const res = await fetch('/api/realtime/live-query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({
      kind,
      noteId,
      userId,
      userEmail
    })
  });

  if (!res.ok) {
    throw new Error(`Akses live query ${kind} tidak tersedia (${res.status}).`);
  }

  const payload = (await res.json()) as {
    sealedQuery?: SealedLiveQuery<Row>;
    serverTime?: number;
  };
  if (!payload.sealedQuery) {
    throw new Error(`Sealed query ${kind} kosong.`);
  }
  return {
    sealedQuery: payload.sealedQuery,
    serverTime: payload.serverTime
  };
}

const NoteLiveSubscription: React.FC<{
  noteId: string;
  sealedQuery: SealedLiveQuery<NeonNoteRow>;
  refreshQuery: () => Promise<SealedLiveQuery<NeonNoteRow>>;
  onError: () => void;
}> = ({ noteId, sealedQuery, refreshQuery, onError }) => {
  const [query] = useState(sealedQuery);
  const { data, status, error } = useNeonLiveQuery(query, { refreshQuery });
  const reportedErrorRef = React.useRef(false);

  useEffect(() => {
    if (status === 'error' && !reportedErrorRef.current) {
      reportedErrorRef.current = true;
      if (process.env.NODE_ENV === 'development' && error) {
        console.warn('[Miu Realtime] Note live subscription error:', error.message);
      }
      onError();
    }
  }, [status, error, onError]);

  useEffect(() => {
    const row = data?.[0];
    if (!row || row.id !== noteId) return;

    const remoteNote = parseNeonNoteRow(row);
    let cancelled = false;

    void db.notes
      .get(remoteNote.id)
      .then((localNote) => {
        if (cancelled) return;
        if (!localNote || remoteNote.updatedAt > localNote.updatedAt) {
          return db.notes.put(remoteNote);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [data, noteId]);

  return null;
};

const PresenceLiveSubscription: React.FC<{
  noteId: string;
  sealedQuery: SealedLiveQuery<NeonNotePresenceRow>;
  refreshQuery: () => Promise<SealedLiveQuery<NeonNotePresenceRow>>;
  onError: () => void;
}> = ({ noteId, sealedQuery, refreshQuery, onError }) => {
  const [query] = useState(sealedQuery);
  const { data, status, error } = useNeonLiveQuery(query, { refreshQuery });
  const { setRawPresenceRows, clearPresenceRows } = useNotePresence();
  const reportedErrorRef = React.useRef(false);

  useEffect(() => {
    if (status === 'error' && !reportedErrorRef.current) {
      reportedErrorRef.current = true;
      if (process.env.NODE_ENV === 'development' && error) {
        console.warn('[Miu Realtime] Presence live subscription error:', error.message);
      }
      onError();
    }
  }, [status, error, onError]);

  useEffect(() => {
    if (!data) return;
    const parsed = data
      .filter((r) => r.note_id === noteId)
      .map((r) => parseNeonPresenceRow(r));
    setRawPresenceRows(noteId, parsed);
  }, [data, noteId, setRawPresenceRows]);

  useEffect(() => {
    return () => {
      clearPresenceRows(noteId);
    };
  }, [noteId, clearPresenceRows]);

  return null;
};

const RETRY_DELAYS_MS = [1200, 2600, 4800, 8000, 12000, 15000];
const MAX_INITIAL_ATTEMPTS = 20;
const ERROR_RECOVERY_DELAYS_MS = [1500, 3500, 7500, 15000];

export const NoteRealtimeSync: React.FC = () => {
  const isRealtimeAvailable = useIsRealtimeAvailable();
  const { activeNoteId, currentUser, isPublicShareAccess } = useMiu();
  const { clearPresenceRows, updateServerClockOffset } = useNotePresence();
  const [neonConfigured, setNeonConfigured] = useState<boolean>(() => isNeonConfigured());
  const [sealedState, setSealedState] = useState<SealedNoteState | undefined>();

  const userId = currentUser?.id || '';
  const userEmail = currentUser?.email || '';
  const ownerKey = `${userId}|${userEmail}|${isPublicShareAccess ? 'pub' : 'auth'}`;

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

  const shouldSync =
    isRealtimeAvailable &&
    (neonConfigured || isNeonConfigured()) &&
    Boolean(activeNoteId) &&
    (Boolean(userId) || isPublicShareAccess);

  const recoveryStateRef = React.useRef<{
    noteTimer: number | null;
    presenceTimer: number | null;
    noteAttempts: number;
    presenceAttempts: number;
    sessionToken: number;
  }>({
    noteTimer: null,
    presenceTimer: null,
    noteAttempts: 0,
    presenceAttempts: 0,
    sessionToken: 0
  });

  useEffect(() => {
    const recovery = recoveryStateRef.current;
    recovery.sessionToken += 1;
    const currentToken = recovery.sessionToken;
    recovery.noteAttempts = 0;
    recovery.presenceAttempts = 0;
    if (recovery.noteTimer) {
      window.clearTimeout(recovery.noteTimer);
      recovery.noteTimer = null;
    }
    if (recovery.presenceTimer) {
      window.clearTimeout(recovery.presenceTimer);
      recovery.presenceTimer = null;
    }

    if (!shouldSync || !activeNoteId) {
      setSealedState(undefined);
      clearPresenceRows();
      return;
    }

    setSealedState((prev) =>
      prev && (prev.noteId !== activeNoteId || prev.ownerKey !== ownerKey)
        ? undefined
        : prev
    );

    let cancelled = false;
    let resolved = false;
    let attemptCount = 0;
    let retryTimer: number | null = null;

    const scheduleRetry = () => {
      if (cancelled || resolved || attemptCount >= MAX_INITIAL_ATTEMPTS) return;
      if (retryTimer) {
        window.clearTimeout(retryTimer);
      }
      const delay = RETRY_DELAYS_MS[Math.min(attemptCount, RETRY_DELAYS_MS.length - 1)];
      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        attemptCount += 1;
        loadQueries();
      }, delay);
    };

    const loadQueries = () => {
      if (cancelled || resolved) return;
      fetchInitialNoteAndPresenceQueries(activeNoteId, userId, userEmail)
        .then((result) => {
          if (cancelled || recoveryStateRef.current.sessionToken !== currentToken) return;
          if (result.serverTime) {
            updateServerClockOffset(result.serverTime);
          }
          if (result.sealedQuery) {
            resolved = true;
            setSealedState((prev) => ({
              noteId: activeNoteId,
              ownerKey,
              noteGeneration: (prev?.noteGeneration || 0) + 1,
              presenceGeneration: (prev?.presenceGeneration || 0) + 1,
              sealedQuery: result.sealedQuery,
              presenceSealedQuery: result.presenceSealedQuery
            }));
            return;
          }
          if (result.status === 403) {
            setSealedState(undefined);
            return;
          }
          if (result.status === 404 || result.status === 503) {
            setSealedState(undefined);
            scheduleRetry();
          }
        })
        .catch(() => {
          scheduleRetry();
        });
    };

    const handleWakeRetry = () => {
      if (!cancelled && !resolved && !document.hidden) {
        loadQueries();
      }
    };

    window.addEventListener('focus', handleWakeRetry);
    window.addEventListener('online', handleWakeRetry);
    loadQueries();

    return () => {
      cancelled = true;
      window.removeEventListener('focus', handleWakeRetry);
      window.removeEventListener('online', handleWakeRetry);
      if (retryTimer) {
        window.clearTimeout(retryTimer);
      }
      if (recovery.noteTimer) {
        window.clearTimeout(recovery.noteTimer);
        recovery.noteTimer = null;
      }
      if (recovery.presenceTimer) {
        window.clearTimeout(recovery.presenceTimer);
        recovery.presenceTimer = null;
      }
    };
  }, [
    shouldSync,
    activeNoteId,
    ownerKey,
    userId,
    userEmail,
    clearPresenceRows,
    updateServerClockOffset
  ]);

  const scheduleSubscriptionRecovery = useCallback(
    (kind: 'note' | 'presence') => {
      if (!shouldSync || !activeNoteId) return;
      const recovery = recoveryStateRef.current;
      const timerKey = kind === 'note' ? 'noteTimer' : 'presenceTimer';
      const attemptsKey = kind === 'note' ? 'noteAttempts' : 'presenceAttempts';
      if (recovery[timerKey]) return;

      const sessionToken = recovery.sessionToken;
      const attemptIdx = recovery[attemptsKey];
      const delay =
        ERROR_RECOVERY_DELAYS_MS[Math.min(attemptIdx, ERROR_RECOVERY_DELAYS_MS.length - 1)];
      recovery[attemptsKey] = attemptIdx + 1;

      recovery[timerKey] = window.setTimeout(() => {
        recovery[timerKey] = null;
        if (recoveryStateRef.current.sessionToken !== sessionToken) return;

        const targetPromise =
          kind === 'note'
            ? renewSingleSealedQuery<NeonNoteRow>('note', activeNoteId, userId, userEmail)
            : renewSingleSealedQuery<NeonNotePresenceRow>(
                'presence',
                activeNoteId,
                userId,
                userEmail
              );

        targetPromise
          .then(({ sealedQuery, serverTime }) => {
            if (recoveryStateRef.current.sessionToken !== sessionToken) return;
            if (serverTime) {
              updateServerClockOffset(serverTime);
            }
            recovery[attemptsKey] = 0;
            setSealedState((prev) => {
              if (!prev || prev.noteId !== activeNoteId || prev.ownerKey !== ownerKey) {
                return prev;
              }
              if (kind === 'note') {
                return {
                  ...prev,
                  noteGeneration: prev.noteGeneration + 1,
                  sealedQuery: sealedQuery as SealedLiveQuery<NeonNoteRow>
                };
              }
              return {
                ...prev,
                presenceGeneration: prev.presenceGeneration + 1,
                presenceSealedQuery: sealedQuery as SealedLiveQuery<NeonNotePresenceRow>
              };
            });
          })
          .catch(() => {
            if (recoveryStateRef.current.sessionToken === sessionToken) {
              scheduleSubscriptionRecovery(kind);
            }
          });
      }, delay);
    },
    [activeNoteId, ownerKey, shouldSync, updateServerClockOffset, userEmail, userId]
  );

  const handleNoteSubscriptionError = useCallback(() => {
    scheduleSubscriptionRecovery('note');
  }, [scheduleSubscriptionRecovery]);

  const handlePresenceSubscriptionError = useCallback(() => {
    scheduleSubscriptionRecovery('presence');
  }, [scheduleSubscriptionRecovery]);

  const refreshNoteQuery = useCallback(async () => {
    if (!activeNoteId) {
      throw new Error('Tidak ada catatan aktif untuk diperbarui.');
    }
    const { sealedQuery, serverTime } = await renewSingleSealedQuery<NeonNoteRow>(
      'note',
      activeNoteId,
      userId,
      userEmail
    );
    if (serverTime) {
      updateServerClockOffset(serverTime);
    }
    return sealedQuery;
  }, [activeNoteId, userId, userEmail, updateServerClockOffset]);

  const refreshPresenceQuery = useCallback(async () => {
    if (!activeNoteId) {
      throw new Error('Tidak ada catatan aktif untuk memperbarui presence.');
    }
    const { sealedQuery, serverTime } =
      await renewSingleSealedQuery<NeonNotePresenceRow>(
        'presence',
        activeNoteId,
        userId,
        userEmail
      );
    if (serverTime) {
      updateServerClockOffset(serverTime);
    }
    return sealedQuery;
  }, [activeNoteId, userId, userEmail, updateServerClockOffset]);

  if (
    !shouldSync ||
    !sealedState ||
    sealedState.noteId !== activeNoteId ||
    sealedState.ownerKey !== ownerKey
  ) {
    return null;
  }

  return (
    <>
      {sealedState.sealedQuery && (
        <NoteLiveSubscription
          key={`note:${activeNoteId}:${sealedState.noteGeneration}:${sealedState.sealedQuery.queryFingerprint}`}
          noteId={activeNoteId}
          sealedQuery={sealedState.sealedQuery}
          refreshQuery={refreshNoteQuery}
          onError={handleNoteSubscriptionError}
        />
      )}
      {sealedState.presenceSealedQuery && (
        <PresenceLiveSubscription
          key={`presence:${activeNoteId}:${sealedState.presenceGeneration}:${sealedState.presenceSealedQuery.queryFingerprint}`}
          noteId={activeNoteId}
          sealedQuery={sealedState.presenceSealedQuery}
          refreshQuery={refreshPresenceQuery}
          onError={handlePresenceSubscriptionError}
        />
      )}
    </>
  );
};
