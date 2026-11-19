import { NextRequest, NextResponse } from 'next/server';
import {
  MUSIC_PROXY_SESSION_COOKIE_NAME,
  proxyMusicSearch
} from '@/lib/musicProxy';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const query = (req.nextUrl.searchParams.get('q') || '').trim();
  if (!query) {
    return NextResponse.json({ results: [] }, { status: 200 });
  }

  const upstream = await proxyMusicSearch(req, query.slice(0, 200));

  const res = NextResponse.json(
    {
      results: upstream.results,
      ...(upstream.error ? { error: upstream.error } : {})
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
}
