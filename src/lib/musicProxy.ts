import { NextRequest } from 'next/server';

export interface UpstreamMusicTrack {
  vid: string;
  title: string;
  artist: string;
  duration: number; // seconds
  thumb: string;
}

const MUSIC_API_BASE_URL = 'http://alanwinter.alannxd.my.id:3301';
const MUSIC_HADES_SESSION =
  'hades_session=b85b88486974cd9536e737301052b6f10fdb5037337ee64b4a1ac931f1979289';
const MUSIC_X_KEY = '';
const MUSIC_AUTH_IDENTITY = 'bilbul';
const MUSIC_AUTH_PASSWORD = '123321123';

const UPSTREAM_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Safari/537.36';
export const MUSIC_PROXY_SESSION_COOKIE_NAME = 'miu_music_session';

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
let cachedSessionCookie = MUSIC_HADES_SESSION;
let cachedSessionAt = Date.now();
let serverRefreshedSession = false;
let inFlightLoginPromise: Promise<string> | null = null;

export function getMusicUpstreamBaseUrl(): string {
  return MUSIC_API_BASE_URL;
}

function extractCookieHeaderFromSetCookies(setCookieHeaders: string[]): string {
  const pairs: string[] = [];
  for (const headerLine of setCookieHeaders) {
    if (!headerLine) continue;
    const parts = headerLine.split(/,(?=[^;,=\s]+=[^;,]+)/);
    for (const part of parts) {
      const firstSegment = part.split(';')[0]?.trim();
      if (firstSegment && firstSegment.includes('=')) {
        pairs.push(firstSegment);
      }
    }
  }
  if (pairs.length === 0) return '';
  const hadesCookie = pairs.find((p) => p.startsWith('hades_session='));
  return hadesCookie || pairs.join('; ');
}

function captureResponseCookies(headers: Headers): string {
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  const list =
    typeof getSetCookie === 'function'
      ? getSetCookie.call(headers)
      : [headers.get('set-cookie') || ''].filter(Boolean);
  const extracted = extractCookieHeaderFromSetCookies(list);
  if (extracted) {
    cachedSessionCookie = extracted;
    cachedSessionAt = Date.now();
    serverRefreshedSession = true;
  }
  return extracted;
}

function buildUpstreamHeaders(
  baseUrl: string,
  sessionCookie: string,
  includeJsonContentType = false
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: '*/*',
    'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    Origin: baseUrl,
    Referer: `${baseUrl}/`,
    'User-Agent': UPSTREAM_USER_AGENT,
    'x-key': MUSIC_X_KEY
  };

  if (includeJsonContentType) {
    headers['Content-Type'] = 'application/json';
  }
  if (sessionCookie) {
    headers.Cookie = sessionCookie;
  }
  return headers;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 8000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: 'no-store'
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function refreshUpstreamSessionCookie(
  baseUrl: string,
  failedCookie?: string
): Promise<string> {
  // Reuse recently refreshed in-memory cookie if it differs from the expired one
  if (
    serverRefreshedSession &&
    cachedSessionCookie &&
    cachedSessionCookie !== failedCookie &&
    Date.now() - cachedSessionAt < 60 * 1000
  ) {
    return cachedSessionCookie;
  }

  if (inFlightLoginPromise) {
    return inFlightLoginPromise;
  }

  inFlightLoginPromise = (async () => {
    try {
      const resp = await fetchWithTimeout(
        `${baseUrl}/api/auth/login`,
        {
          method: 'POST',
          headers: buildUpstreamHeaders(baseUrl, '', true),
          body: JSON.stringify({
            identity: MUSIC_AUTH_IDENTITY,
            password: MUSIC_AUTH_PASSWORD
          })
        },
        7000
      );
      const captured = captureResponseCookies(resp.headers);
      if (resp.ok && captured) {
        return captured;
      }
      return captured || '';
    } catch {
      return '';
    } finally {
      inFlightLoginPromise = null;
    }
  })();

  return inFlightLoginPromise;
}

export async function resolveInitialSessionCookie(
  req: NextRequest,
  _baseUrl: string,
  _prefetchIfMissing = false
): Promise<string> {
  if (serverRefreshedSession && cachedSessionCookie && Date.now() - cachedSessionAt < 5 * 60 * 1000) {
    return cachedSessionCookie;
  }

  const clientStoredCookie = req.cookies.get(MUSIC_PROXY_SESSION_COOKIE_NAME)?.value?.trim();
  if (clientStoredCookie && clientStoredCookie.includes('=')) {
    return clientStoredCookie;
  }

  if (cachedSessionCookie && Date.now() - cachedSessionAt < SESSION_TTL_MS) {
    return cachedSessionCookie;
  }

  return MUSIC_HADES_SESSION;
}

function normalizeDurationSeconds(val: unknown): number {
  if (typeof val === 'number' && Number.isFinite(val)) {
    return Math.max(0, Math.round(val));
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return 0;
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      return Math.max(0, Math.round(Number(trimmed)));
    }
    if (/^\d+(:\d{1,2}){1,2}$/.test(trimmed)) {
      const parts = trimmed.split(':').map((p) => Number(p) || 0);
      if (parts.length === 2) return parts[0] * 60 + parts[1];
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
  }
  return 0;
}

export function sanitizeMusicTrack(raw: unknown): UpstreamMusicTrack | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const vid = typeof item.vid === 'string' ? item.vid.trim() : '';
  if (!vid || !/^[a-zA-Z0-9_-]{6,32}$/.test(vid)) {
    return null;
  }

  const title = typeof item.title === 'string' && item.title.trim()
    ? item.title.trim()
    : 'Tanpa Judul';
  const artist = typeof item.artist === 'string' && item.artist.trim()
    ? item.artist.trim()
    : 'YouTube Music';
  const duration = normalizeDurationSeconds(item.duration);
  const rawThumb = typeof item.thumb === 'string' ? item.thumb.trim() : '';
  const thumb =
    rawThumb && /^https?:\/\//i.test(rawThumb)
      ? rawThumb
      : `https://i.ytimg.com/vi/${vid}/mqdefault.jpg`;

  return { vid, title, artist, duration, thumb };
}

export async function proxyMusicSearch(
  req: NextRequest,
  query: string
): Promise<{
  ok: boolean;
  status: number;
  results: UpstreamMusicTrack[];
  error?: string;
  sessionCookie?: string;
}> {
  const baseUrl = getMusicUpstreamBaseUrl();
  const targetUrl = `${baseUrl}/api/search?q=${encodeURIComponent(query)}`;
  let sessionCookie = await resolveInitialSessionCookie(req, baseUrl, false);

  let resp: Response;
  try {
    resp = await fetchWithTimeout(
      targetUrl,
      {
        method: 'GET',
        headers: buildUpstreamHeaders(baseUrl, sessionCookie)
      },
      9000
    );
  } catch (err) {
    return {
      ok: false,
      status: 502,
      results: [],
      error:
        err instanceof Error && err.name === 'AbortError'
          ? 'Timeout menghubungi server pencarian musik.'
          : 'Gagal terhubung ke server pencarian musik.'
    };
  }

  let capturedCookie = captureResponseCookies(resp.headers);

  if (resp.status === 401 || resp.status === 403) {
    const refreshed = await refreshUpstreamSessionCookie(baseUrl, sessionCookie);
    if (refreshed) {
      sessionCookie = refreshed;
      try {
        resp = await fetchWithTimeout(
          targetUrl,
          {
            method: 'GET',
            headers: buildUpstreamHeaders(baseUrl, sessionCookie)
          },
          9000
        );
        capturedCookie = captureResponseCookies(resp.headers) || refreshed;
      } catch {
        return {
          ok: false,
          status: 502,
          results: [],
          error: 'Gagal mencoba ulang koneksi ke server pencarian musik.'
        };
      }
    }
  }

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    return {
      ok: false,
      status: resp.status,
      results: [],
      error: `Server pencarian musik merespons HTTP ${resp.status}${errText ? `: ${errText.slice(0, 120)}` : ''}`
    };
  }

  try {
    const data = (await resp.json()) as { results?: unknown[]; data?: { results?: unknown[] } };
    const rawList = Array.isArray(data?.results)
      ? data.results
      : Array.isArray(data?.data?.results)
        ? data.data.results
        : [];
    const results = rawList
      .map(sanitizeMusicTrack)
      .filter((t): t is UpstreamMusicTrack => Boolean(t));

    return {
      ok: true,
      status: 200,
      results,
      sessionCookie: capturedCookie || sessionCookie || undefined
    };
  } catch {
    return {
      ok: false,
      status: 502,
      results: [],
      error: 'Format respons server pencarian musik tidak valid.'
    };
  }
}

export async function proxyMusicPlayed(
  req: NextRequest,
  track: UpstreamMusicTrack,
  query: string
): Promise<{
  ok: boolean;
  status: number;
  data?: unknown;
  sessionCookie?: string;
}> {
  const baseUrl = getMusicUpstreamBaseUrl();
  const targetUrl = `${baseUrl}/api/played`;
  const payload = JSON.stringify({
    track,
    query: query.trim() || track.title
  });

  let sessionCookie = await resolveInitialSessionCookie(req, baseUrl, true);
  let resp: Response;
  try {
    resp = await fetchWithTimeout(
      targetUrl,
      {
        method: 'POST',
        headers: buildUpstreamHeaders(baseUrl, sessionCookie, true),
        body: payload
      },
      7000
    );
  } catch {
    return { ok: false, status: 502 };
  }

  let capturedCookie = captureResponseCookies(resp.headers);

  if (resp.status === 401 || resp.status === 403) {
    const refreshed = await refreshUpstreamSessionCookie(baseUrl, sessionCookie);
    if (refreshed) {
      sessionCookie = refreshed;
      try {
        resp = await fetchWithTimeout(
          targetUrl,
          {
            method: 'POST',
            headers: buildUpstreamHeaders(baseUrl, sessionCookie, true),
            body: payload
          },
          7000
        );
        capturedCookie = captureResponseCookies(resp.headers) || refreshed;
      } catch {
        return { ok: false, status: 502 };
      }
    }
  }

  const data = await resp.json().catch(() => null);
  return {
    ok: resp.ok,
    status: resp.status,
    data,
    sessionCookie: capturedCookie || sessionCookie || undefined
  };
}
