'use client';

import React, { useCallback, useEffect, useState } from 'react';
import type { SealedLiveQuery } from '@neon/realtime/client';
import { useLiveQuery as useNeonLiveQuery } from '@neon/realtime-react';
import { db } from '@/db/database';
import { useMiu } from '@/context/MiuContext';
import { parseNeonNoteRow, type NeonNoteRow } from '@/lib/realtimeShared';
import { isNeonConfigured } from '@/services/cloudServices';
import { useIsRealtimeAvailable } from './RealtimeRoot';

interface SealedNoteState {
  noteId: string;
  sealedQuery?: SealedLiveQuery<NeonNoteRow>;
}

async function fetchSealedNoteQuery(
  noteId: string,
  userId: string,
  userEmail: string
): Promise<SealedLiveQuery<NeonNoteRow> | null> {
  const res = await fetch('/api/realtime/live-query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({
      kind: 'note',
      noteId,
      userId,
      userEmail
    })
  });

  if (res.status === 403 || res.status === 404 || res.status === 503) {
    return null;
  }

  if (!res.ok) {
    throw new Error(`Gagal mengambil live query catatan (${res.status})`);
  }

  const payload = (await res.json()) as { sealedQuery?: SealedLiveQuery<NeonNoteRow> };
  return payload.sealedQuery ?? null;
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

export const NoteRealtimeSync: React.FC = () => {
  const isRealtimeAvailable = useIsRealtimeAvailable();
  const { activeNoteId, currentUser, isPublicShareAccess } = useMiu();
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
      return;
    }

    let cancelled = false;
    fetchSealedNoteQuery(activeNoteId, userId, userEmail)
      .then((sealedQuery) => {
        if (!cancelled && sealedQuery) {
          setSealedState({ noteId: activeNoteId, sealedQuery });
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [shouldSync, activeNoteId, userId, userEmail]);

  const refreshQuery = useCallback(async () => {
    if (!activeNoteId) {
      throw new Error('Tidak ada catatan aktif untuk diperbarui.');
    }
    const renewed = await fetchSealedNoteQuery(activeNoteId, userId, userEmail);
    if (!renewed) {
      throw new Error('Akses live query catatan tidak lagi tersedia.');
    }
    return renewed;
  }, [activeNoteId, userId, userEmail]);

  if (!shouldSync || !sealedState?.sealedQuery || sealedState.noteId !== activeNoteId) {
    return null;
  }

  return (
    <NoteLiveSubscription
      key={`${activeNoteId}:${sealedState.sealedQuery.queryFingerprint}`}
      noteId={activeNoteId}
      sealedQuery={sealedState.sealedQuery}
      refreshQuery={refreshQuery}
    />
  );
};
