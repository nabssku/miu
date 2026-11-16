import { NextRequest, NextResponse } from 'next/server';
import { isServerNeonConfigured, upsertServerUser, type ServerGoogleUser } from '@/lib/serverCloud';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    if (!isServerNeonConfigured()) {
      return NextResponse.json({ ok: false, reason: 'CLOUD_NOT_CONFIGURED' });
    }
    const body = (await req.json()) as Partial<ServerGoogleUser>;
    if (!body?.id || !body?.email) {
      return NextResponse.json({ ok: false, error: 'Invalid user payload' }, { status: 400 });
    }
    await upsertServerUser({
      id: String(body.id),
      email: String(body.email),
      name: String(body.name || body.email.split('@')[0]),
      picture: String(body.picture || ''),
      loginAt: Number(body.loginAt) || Date.now()
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.warn('[API /cloud/auth] Gagal menyimpan user:', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
