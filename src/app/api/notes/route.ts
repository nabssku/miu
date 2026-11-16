import { NextRequest, NextResponse } from 'next/server';
import {
  deleteServerNote,
  fetchServerNotes,
  fetchServerSharedNote,
  isServerNeonConfigured,
  saveServerNote,
  saveServerNoteComments
} from '@/lib/serverCloud';
import type { NoteComment, NoteRecord } from '@/types/miu';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    if (!isServerNeonConfigured()) {
      return NextResponse.json({ notes: null, cloudDisabled: true });
    }

    const { searchParams } = new URL(req.url);
    const shareId = (searchParams.get('shareId') || '').trim();
    const userId = (searchParams.get('userId') || '').trim();
    const userEmail = (searchParams.get('userEmail') || '').trim();

    if (shareId) {
      const notes = await fetchServerSharedNote(shareId, userId, userEmail);
      return NextResponse.json({ notes });
    }

    if (!userId) {
      return NextResponse.json({ error: 'userId wajib diisi.' }, { status: 400 });
    }

    const notes = await fetchServerNotes(userId, userEmail);
    return NextResponse.json({ notes });
  } catch (err) {
    console.warn('[API /notes GET] Error:', err);
    return NextResponse.json({ notes: null, error: 'Gagal memuat catatan.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isServerNeonConfigured()) {
      return NextResponse.json({ ok: false, cloudDisabled: true });
    }

    const body = (await req.json()) as {
      action?: 'save-note' | 'save-comments';
      userId?: string;
      userEmail?: string;
      noteId?: string;
      comments?: NoteComment[];
      note?: NoteRecord;
    };

    if (body.action === 'save-comments') {
      if (!body.noteId || !Array.isArray(body.comments)) {
        return NextResponse.json({ ok: false, error: 'Payload komentar tidak valid.' }, { status: 400 });
      }
      const res = await saveServerNoteComments(
        body.noteId,
        body.comments,
        body.userId || '',
        body.userEmail || ''
      );
      return NextResponse.json(
        { ok: res.ok, error: res.error },
        { status: res.ok ? 200 : res.status }
      );
    }

    if (!body.note?.id || !body.userId) {
      return NextResponse.json({ ok: false, error: 'Payload catatan tidak valid.' }, { status: 400 });
    }

    const res = await saveServerNote(body.userId, body.userEmail || '', body.note);
    return NextResponse.json(
      { ok: res.ok, error: res.error },
      { status: res.ok ? 200 : res.status }
    );
  } catch (err) {
    console.warn('[API /notes POST] Error:', err);
    return NextResponse.json({ ok: false, error: 'Gagal menyimpan catatan.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!isServerNeonConfigured()) {
      return NextResponse.json({ ok: false, cloudDisabled: true });
    }

    const { searchParams } = new URL(req.url);
    const noteId = (searchParams.get('noteId') || '').trim();
    const userId = (searchParams.get('userId') || '').trim();

    if (!noteId || !userId) {
      return NextResponse.json({ ok: false, error: 'noteId dan userId wajib diisi.' }, { status: 400 });
    }

    const res = await deleteServerNote(userId, noteId);
    return NextResponse.json({ ok: res.ok }, { status: res.status });
  } catch (err) {
    console.warn('[API /notes DELETE] Error:', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
