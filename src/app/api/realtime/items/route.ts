import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  insertServerLiveItem,
  isServerNeonConfigured,
  listServerLiveItems
} from '@/lib/serverCloud';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    if (!isServerNeonConfigured()) {
      return NextResponse.json({ items: [], dbDisabled: true });
    }
    const { searchParams } = new URL(req.url);
    const channel = (searchParams.get('channel') || 'default').trim().slice(0, 64) || 'default';
    const items = (await listServerLiveItems(channel)) || [];
    return NextResponse.json({ items, dbDisabled: false });
  } catch (err) {
    console.warn('[API /realtime/items GET] Error:', err);
    return NextResponse.json({ items: [], error: 'Gagal memuat item live.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isServerNeonConfigured()) {
      return NextResponse.json(
        { ok: false, dbDisabled: true, error: 'DATABASE_URL / NEON_DATABASE_URL belum dikonfigurasi.' },
        { status: 503 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      id?: string;
      channel?: string;
      content?: string;
      author?: string;
    };

    const content = typeof body.content === 'string' ? body.content.trim().slice(0, 500) : '';
    if (!content) {
      return NextResponse.json(
        { ok: false, error: 'Konten item tidak boleh kosong.' },
        { status: 400 }
      );
    }

    const channel =
      typeof body.channel === 'string' && body.channel.trim()
        ? body.channel.trim().slice(0, 64)
        : 'default';
    const author =
      typeof body.author === 'string' && body.author.trim()
        ? body.author.trim().slice(0, 80)
        : 'Miu User';
    const id =
      typeof body.id === 'string' && body.id.trim()
        ? body.id.trim().slice(0, 128)
        : randomUUID();

    const result = await insertServerLiveItem({ id, channel, content, author });
    return NextResponse.json(
      {
        ok: result.ok,
        kind: result.kind,
        txid: result.txid,
        item: result.item,
        error: result.error
      },
      { status: result.status }
    );
  } catch (err) {
    console.warn('[API /realtime/items POST] Error:', err);
    return NextResponse.json(
      { ok: false, error: 'Gagal menyimpan item ke Postgres.' },
      { status: 500 }
    );
  }
}
