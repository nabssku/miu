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
}> = ({ noteId, sealedQuery, refreshQuery }) => {
  const [query] = useState(sealedQuery);
  const { data } = useNeonLiveQuery(query, { refreshQuery });

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
}> = ({ noteId, sealedQuery, refreshQuery }) => {
  const [query] = useState(sealedQuery);
  const { data } = useNeonLiveQuery(query, { refreshQuery });
  const { setRawPresenceRows, clearPresenceRows } = useNotePresence();

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

const RETRY_DELAYS_MS = [1200, 2600, 4800];

export const NoteRealtimeSync: React.FC = () => {
  const isRealtimeAvailable = useIsRealtimeAvailable();
  const { activeNoteId, currentUser, isPublicShareAccess } = useMiu();
  const { clearPresenceRows, updateServerClockOffset } = useNotePresence();
  const [sealedState, setSealedState] = useState<SealedNoteState | undefined>();

  const userId = currentUser?.id || '';
  const userEmail = currentUser?.email || '';
  const shouldSync =
    isRealtimeAvailable &&
    isNeonConfigured() &&
    Boolean(activeNoteId) &&
    (Boolean(userId) || isPublicShareAccess);

  useEffect(() => {
    if (!shouldSync || !activeNoteId) {
      setSealedState(undefined);
      clearPresenceRows();
      return;
    }

    let cancelled = false;
    let retryTimer: number | null = null;

    const loadQueries = (attemptIdx: number) => {
      fetchInitialNoteAndPresenceQueries(activeNoteId, userId, userEmail)
        .then((result) => {
          if (cancelled) return;
          if (result.serverTime) {
            updateServerClockOffset(result.serverTime);
          }
          if (result.sealedQuery) {
            setSealedState({
              noteId: activeNoteId,
              sealedQuery: result.sealedQuery,
              presenceSealedQuery: result.presenceSealedQuery
            });
            return;
          }
          if (result.status === 404 && attemptIdx < RETRY_DELAYS_MS.length) {
            retryTimer = window.setTimeout(() => {
              loadQueries(attemptIdx + 1);
            }, RETRY_DELAYS_MS[attemptIdx]);
          }
        })
        .catch(() => {});
    };

    loadQueries(0);

    return () => {
      cancelled = true;
      if (retryTimer) {
        window.clearTimeout(retryTimer);
      }
    };
  }, [
    shouldSync,
    activeNoteId,
    userId,
    userEmail,
    clearPresenceRows,
    updateServerClockOffset
  ]);

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

  if (!shouldSync || !sealedState || sealedState.noteId !== activeNoteId) {
    return null;
  }

  return (
    <>
      {sealedState.sealedQuery && (
        <NoteLiveSubscription
          key={`note:${activeNoteId}:${sealedState.sealedQuery.queryFingerprint}`}
          noteId={activeNoteId}
          sealedQuery={sealedState.sealedQuery}
          refreshQuery={refreshNoteQuery}
        />
      )}
      {sealedState.presenceSealedQuery && (
        <PresenceLiveSubscription
          key={`presence:${activeNoteId}:${sealedState.presenceSealedQuery.queryFingerprint}`}
          noteId={activeNoteId}
          sealedQuery={sealedState.presenceSealedQuery}
          refreshQuery={refreshPresenceQuery}
        />
      )}
    </>
  );
};
