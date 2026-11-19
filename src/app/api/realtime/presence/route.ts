import { NextRequest, NextResponse } from 'next/server';
import {
  deleteServerNotePresence,
  isServerNeonConfigured,
  upsertServerNotePresence
} from '@/lib/serverCloud';

export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = { 'Cache-Control': 'private, no-store' };

interface PresenceRequestBody {
  action?: 'upsert' | 'leave';
  noteId?: string;
  sessionId?: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  userPicture?: string;
  color?: string;
  blockId?: string;
  field?: string;
  selectionStart?: number;
  selectionEnd?: number;
  isEditing?: boolean;
  pointerBlockId?: string | null;
  pointerX?: number | null;
  pointerY?: number | null;
}

export async function POST(req: NextRequest) {
  try {
    if (!isServerNeonConfigured()) {
      return NextResponse.json(
        { ok: false, cloudDisabled: true },
        { headers: NO_STORE_HEADERS }
      );
    }

    const rawText = await req.text().catch(() => '');
    let body: PresenceRequestBody = {};
    if (rawText) {
      try {
        body = JSON.parse(rawText) as PresenceRequestBody;
      } catch {
        return NextResponse.json(
          { ok: false, error: 'Payload presence tidak valid.' },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }
    }

    const noteId = typeof body.noteId === 'string' ? body.noteId.trim() : '';
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
    if (!noteId || noteId.length > 160 || !sessionId || sessionId.length > 120) {
      return NextResponse.json(
        { ok: false, error: 'noteId dan sessionId wajib valid.' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    if (body.action === 'leave') {
      const res = await deleteServerNotePresence({ noteId, sessionId });
      return NextResponse.json(
        { ok: res.ok, txid: res.txid },
        { status: res.ok ? 200 : res.status, headers: NO_STORE_HEADERS }
      );
    }

    const res = await upsertServerNotePresence({
      noteId,
      sessionId,
      userId: typeof body.userId === 'string' ? body.userId : '',
      userName: typeof body.userName === 'string' ? body.userName : '',
      userEmail: typeof body.userEmail === 'string' ? body.userEmail : '',
      userPicture: typeof body.userPicture === 'string' ? body.userPicture : '',
      color: typeof body.color === 'string' ? body.color : '',
      blockId: typeof body.blockId === 'string' ? body.blockId : '',
      field: typeof body.field === 'string' ? body.field : 'content',
      selectionStart: body.selectionStart,
      selectionEnd: body.selectionEnd,
      isEditing: Boolean(body.isEditing),
      pointerBlockId: typeof body.pointerBlockId === 'string' ? body.pointerBlockId : null,
      pointerX: body.pointerX,
      pointerY: body.pointerY
    });

    return NextResponse.json(
      {
        ok: res.ok,
        txid: res.txid,
        serverTime: res.serverTime,
        error: res.error
      },
      { status: res.ok ? 200 : res.status, headers: NO_STORE_HEADERS }
    );
  } catch (err) {
    console.warn('[API /realtime/presence POST] Error:', err);
    return NextResponse.json(
      { ok: false, error: 'Gagal memperbarui presence kolaborator.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
