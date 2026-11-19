import { NextRequest, NextResponse } from 'next/server';
import {
  getPublicRealtimeUrl,
  isServerRealtimeConfigured,
  sealLiveItemsQuery,
  sealLiveNoteQuery
} from '@/lib/realtime';
import {
  ensureServerNeonSchema,
  getEffectiveNoteRole,
  isServerNeonConfigured
} from '@/lib/serverCloud';

export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = { 'Cache-Control': 'private, no-store' };

export async function POST(req: NextRequest) {
  try {
    if (!isServerRealtimeConfigured()) {
      return NextResponse.json(
        { error: 'Neon Realtime belum dikonfigurasi pada server.', realtimeDisabled: true },
        { status: 503, headers: NO_STORE_HEADERS }
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      kind?: 'items' | 'note';
      channel?: string;
      noteId?: string;
      userId?: string;
      userEmail?: string;
    };

    const realtimeUrl = getPublicRealtimeUrl();

    if (body.kind === 'note') {
      if (!isServerNeonConfigured()) {
        return NextResponse.json(
          { error: 'Database Postgres belum dikonfigurasi.', dbDisabled: true },
          { status: 503, headers: NO_STORE_HEADERS }
        );
      }

      const noteId = (body.noteId || '').trim();
      if (!noteId || noteId.length > 160) {
        return NextResponse.json(
          { error: 'noteId tidak valid.' },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }

      await ensureServerNeonSchema();
      const access = await getEffectiveNoteRole(
        noteId,
        (body.userId || '').trim(),
        (body.userEmail || '').trim()
      );

      if (!access.exists) {
        return NextResponse.json(
          { error: 'Catatan belum tersimpan di cloud atau tidak ditemukan.' },
          { status: 404, headers: NO_STORE_HEADERS }
        );
      }

      if (!access.role) {
        return NextResponse.json(
          { error: 'Tidak memiliki izin mengakses live query catatan ini.' },
          { status: 403, headers: NO_STORE_HEADERS }
        );
      }

      const sealedQuery = await sealLiveNoteQuery(noteId);
      return NextResponse.json(
        { sealedQuery, realtimeUrl },
        { headers: NO_STORE_HEADERS }
      );
    }

    const channel = (body.channel || 'default').trim().slice(0, 64) || 'default';
    const sealedQuery = await sealLiveItemsQuery(channel);
    return NextResponse.json(
      { sealedQuery, realtimeUrl },
      { headers: NO_STORE_HEADERS }
    );
  } catch (err) {
    console.warn('[API /realtime/live-query POST] Error:', err);
    return NextResponse.json(
      { error: 'Gagal membuat sealed live query.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
