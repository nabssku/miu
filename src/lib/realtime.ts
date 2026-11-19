import 'server-only';

import { createRealtime, rawSql } from '@neon/realtime/server';
import {
  normalizeRealtimeWsUrl,
  type LiveItemRow,
  type NeonNoteRow
} from './realtimeShared';

let cachedRealtime: ReturnType<typeof createRealtime> | undefined;

function resolveRealtimeDatabaseName(): string {
  const explicit = (process.env.NEON_REALTIME_DB || '').trim();
  if (explicit) return explicit;

  const conn = (
    process.env.NEON_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.VITE_NEON_DATABASE_URL ||
    ''
  ).trim();

  if (conn) {
    try {
      const normalized = conn
        .replace(/^postgres:\/\//i, 'postgresql://')
        .replace(/[?&]channel_binding=require/gi, '');
      const dbName = new URL(normalized).pathname.replace(/^\/+/, '').trim();
      if (dbName) return dbName;
    } catch {
      // ignore malformed URL and fall back to neondb
    }
  }

  return 'neondb';
}

export function getPublicRealtimeUrl(): string {
  const raw = (
    process.env.NEON_REALTIME_URL ||
    process.env.NEXT_PUBLIC_NEON_REALTIME_URL ||
    ''
  ).trim();
  return normalizeRealtimeWsUrl(raw);
}

export function isServerRealtimeConfigured(): boolean {
  const secret = (process.env.NEON_REALTIME_SECRET || '').trim();
  return Boolean(secret && getPublicRealtimeUrl());
}

export function getRealtime() {
  if (cachedRealtime) return cachedRealtime;
  const secret = (process.env.NEON_REALTIME_SECRET || '').trim();
  if (!secret) {
    throw new Error('NEON_REALTIME_SECRET belum dikonfigurasi pada server.');
  }
  cachedRealtime = createRealtime({
    secret,
    db: resolveRealtimeDatabaseName(),
    debugMode: process.env.NODE_ENV === 'development'
  });
  return cachedRealtime;
}

export function liveItemsQuery(channel = 'default') {
  return rawSql<LiveItemRow>(
    `SELECT id, channel, content, author, created_at
     FROM miu_live_items
     WHERE channel = $1
     ORDER BY created_at DESC, id DESC
     LIMIT 50`,
    [channel]
  );
}

export function sealLiveItemsQuery(channel = 'default') {
  return getRealtime().seal({ query: liveItemsQuery(channel) });
}

export function liveNoteQuery(noteId: string) {
  return rawSql<NeonNoteRow>(
    `SELECT id, user_id, owner_email, owner_name, parent_id, semester_id, course_id,
            title, icon, cover, is_favorite, is_full_width, kanban_status, due_date,
            due_time, google_event_id, blocks, share_settings, comments, created_at, updated_at
     FROM miu_notes
     WHERE id = $1`,
    [noteId]
  );
}

export function sealLiveNoteQuery(noteId: string) {
  return getRealtime().seal({ query: liveNoteQuery(noteId) });
}
