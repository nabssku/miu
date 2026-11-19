import { NextRequest, NextResponse } from 'next/server';
import {
  MUSIC_PROXY_SESSION_COOKIE_NAME,
  proxyMusicPlayed,
  sanitizeMusicTrack
} from '@/lib/musicProxy';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      track?: unknown;
      query?: unknown;
    };

    const track = sanitizeMusicTrack(body?.track);
    if (!track) {
      return NextResponse.json(
        { ok: false, error: 'Payload track tidak valid (vid wajib diisi).' },
        { status: 400 }
      );
    }

    const query =
      typeof body?.query === 'string' && body.query.trim()
        ? body.query.trim().slice(0, 200)
        : track.title;

    const upstream = await proxyMusicPlayed(req, track, query);

    const res = NextResponse.json(
      {
        ok: upstream.ok,
        status: upstream.status,
        data: upstream.data ?? null
      },
      { status: upstream.ok ? 200 : upstream.status >= 400 ? upstream.status : 502 }
    );

    if (upstream.sessionCookie) {
      const isHttps =
        req.nextUrl.protocol === 'https:' ||
        req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() === 'https';
      res.cookies.set(MUSIC_PROXY_SESSION_COOKIE_NAME, upstream.sessionCookie, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/api/music',
        secure: isHttps,
        maxAge: 60 * 60 * 6
      });
    }

    return res;
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Format JSON tidak valid.' },
      { status: 400 }
    );
  }
}
