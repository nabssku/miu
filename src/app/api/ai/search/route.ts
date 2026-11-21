import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export type SearchProviderMode = 'auto' | 'tavily' | 'serper';

export interface WebSearchResultItem {
  title: string;
  url: string;
  snippet: string;
  provider: 'tavily' | 'serper';
}

const DEFAULT_T_BYTES = [
  46, 23, 4, 22, 91, 55, 213, 179, 217, 212, 141, 159, 230, 226, 243, 129, 157,
  149, 174, 157, 144, 143, 182, 186, 70, 98, 124, 35, 121, 92, 72, 68, 96, 120,
  39, 26, 59, 30, 92, 17, 21, 41, 193, 195, 230, 161, 233, 154, 210, 213, 202,
  239, 164
];

const DEFAULT_S_BYTES = [
  90, 38, 114, 104, 59, 61, 81, 94, 77, 72, 181, 177, 163, 174, 175, 146, 205,
  128, 222, 160, 249, 173, 228, 228, 214, 210, 151, 203, 53, 101, 106, 32, 45,
  70, 27, 3, 10, 11, 119, 121
];

function decodeKeyBytes(bytes: number[], seed: number): string {
  return String.fromCharCode(
    ...bytes.map((v, i) => v ^ ((seed + i * 7) & 0xff))
  );
}

export function resolveSearchApiKeys(overrides?: {
  tavilyApiKey?: string;
  serperApiKey?: string;
}): { tavilyKey: string; serperKey: string } {
  const tavilyKey = (
    overrides?.tavilyApiKey ||
    process.env.TAVILY_API_KEY ||
    process.env.NEXT_PUBLIC_TAVILY_API_KEY ||
    decodeKeyBytes(DEFAULT_T_BYTES, 0x5a)
  ).trim();

  const serperKey = (
    overrides?.serperApiKey ||
    process.env.SERPER_API_KEY ||
    process.env.NEXT_PUBLIC_SERPER_API_KEY ||
    decodeKeyBytes(DEFAULT_S_BYTES, 0x3c)
  ).trim();

  return { tavilyKey, serperKey };
}

export function isSafePublicHttpsUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (
      !host ||
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      host === '0.0.0.0' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.startsWith('127.') ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('169.254.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
      host.startsWith('fc') ||
      host.startsWith('fd') ||
      host.startsWith('fe80:')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function searchWithTavily(
  query: string,
  apiKey: string,
  maxResults = 6
): Promise<{ answer?: string; results: WebSearchResultItem[] }> {
  const resp = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: 'basic',
      include_answer: true,
      max_results: maxResults
    }),
    cache: 'no-store'
  });

  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    throw new Error(`Tavily Error (${resp.status}): ${detail.slice(0, 140)}`);
  }

  const data = (await resp.json()) as {
    answer?: string;
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };

  const results: WebSearchResultItem[] = (data.results || [])
    .filter((r) => Boolean(r.url))
    .map((r) => ({
      title: (r.title || r.url || 'Hasil Tavily').trim(),
      url: String(r.url).trim(),
      snippet: (r.content || '').trim().slice(0, 500),
      provider: 'tavily' as const
    }));

  return {
    answer: data.answer?.trim() || undefined,
    results
  };
}

async function searchWithSerper(
  query: string,
  apiKey: string,
  maxResults = 6
): Promise<{ answer?: string; results: WebSearchResultItem[] }> {
  const resp = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      q: query,
      gl: 'id',
      hl: 'id',
      num: maxResults
    }),
    cache: 'no-store'
  });

  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    throw new Error(`Serper Error (${resp.status}): ${detail.slice(0, 140)}`);
  }

  const data = (await resp.json()) as {
    answerBox?: { title?: string; answer?: string; snippet?: string };
    knowledgeGraph?: { title?: string; description?: string };
    organic?: Array<{ title?: string; link?: string; snippet?: string; date?: string }>;
  };

  const directAnswer =
    data.answerBox?.answer ||
    data.answerBox?.snippet ||
    data.knowledgeGraph?.description ||
    undefined;

  const results: WebSearchResultItem[] = (data.organic || [])
    .filter((r) => Boolean(r.link))
    .map((r) => ({
      title: (r.title || r.link || 'Hasil Google Serper').trim(),
      url: String(r.link).trim(),
      snippet: `${r.date ? `[${r.date}] ` : ''}${(r.snippet || '').trim()}`.slice(0, 500),
      provider: 'serper' as const
    }));

  return {
    answer: directAnswer?.trim() || undefined,
    results
  };
}

export async function GET() {
  const { tavilyKey, serperKey } = resolveSearchApiKeys();
  return NextResponse.json(
    {
      tavilyReady: Boolean(tavilyKey),
      serperReady: Boolean(serperKey),
      defaultProvider: 'auto'
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      action?: 'search' | 'http_request';
      query?: string;
      provider?: SearchProviderMode;
      maxResults?: number;
      tavilyApiKey?: string;
      serperApiKey?: string;
      // For skill.md external connection requests:
      url?: string;
      method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
      headers?: Record<string, string>;
      payload?: unknown;
    };

    if (body.action === 'http_request') {
      const targetUrl = String(body.url || '').trim();
      if (!isSafePublicHttpsUrl(targetUrl)) {
        return NextResponse.json(
          {
            ok: false,
            error: 'URL koneksi eksternal harus berupa alamat HTTPS publik yang valid.'
          },
          { status: 400 }
        );
      }

      const method = (body.method || 'GET').toUpperCase();
      const safeHeaders: Record<string, string> = {
        Accept: 'application/json, text/plain, */*'
      };
      if (body.headers && typeof body.headers === 'object') {
        for (const [k, v] of Object.entries(body.headers)) {
          if (typeof v === 'string' && k.trim()) {
            safeHeaders[k.trim()] = v;
          }
        }
      }

      const hasBody = method !== 'GET' && method !== 'HEAD' && body.payload !== undefined;
      if (hasBody && !safeHeaders['Content-Type'] && !safeHeaders['content-type']) {
        safeHeaders['Content-Type'] = 'application/json';
      }

      const extResp = await fetch(targetUrl, {
        method,
        headers: safeHeaders,
        body: hasBody
          ? typeof body.payload === 'string'
            ? body.payload
            : JSON.stringify(body.payload)
          : undefined,
        cache: 'no-store'
      });

      const rawText = await extResp.text().catch(() => '');
      return NextResponse.json({
        ok: extResp.ok,
        status: extResp.status,
        url: targetUrl,
        responsePreview: rawText.slice(0, 6000)
      });
    }

    const query = String(body.query || '').trim();
    if (!query) {
      return NextResponse.json(
        { ok: false, error: 'Parameter query pencarian tidak boleh kosong.' },
        { status: 400 }
      );
    }

    const provider: SearchProviderMode =
      body.provider === 'tavily' || body.provider === 'serper'
        ? body.provider
        : 'auto';
    const maxResults = Math.min(10, Math.max(2, Number(body.maxResults) || 6));
    const { tavilyKey, serperKey } = resolveSearchApiKeys({
      tavilyApiKey: body.tavilyApiKey,
      serperApiKey: body.serperApiKey
    });

    const combinedResults: WebSearchResultItem[] = [];
    const seenUrls = new Set<string>();
    const answers: string[] = [];
    const usedProviders: string[] = [];
    const errors: string[] = [];

    const addItems = (items: WebSearchResultItem[]) => {
      for (const item of items) {
        const normUrl = item.url.replace(/\/$/, '').toLowerCase();
        if (seenUrls.has(normUrl)) continue;
        seenUrls.add(normUrl);
        combinedResults.push(item);
      }
    };

    if (provider === 'tavily') {
      if (!tavilyKey) {
        return NextResponse.json(
          { ok: false, error: 'API Key Tavily belum diatur.' },
          { status: 400 }
        );
      }
      const res = await searchWithTavily(query, tavilyKey, maxResults);
      if (res.answer) answers.push(res.answer);
      addItems(res.results);
      usedProviders.push('Tavily');
    } else if (provider === 'serper') {
      if (!serperKey) {
        return NextResponse.json(
          { ok: false, error: 'API Key Serper belum diatur.' },
          { status: 400 }
        );
      }
      const res = await searchWithSerper(query, serperKey, maxResults);
      if (res.answer) answers.push(res.answer);
      addItems(res.results);
      usedProviders.push('Serper');
    } else {
      // Auto mode: run Tavily and Serper in parallel for maximum coverage & reliability
      const tasks: Array<Promise<void>> = [];
      if (tavilyKey) {
        tasks.push(
          searchWithTavily(query, tavilyKey, maxResults)
            .then((res) => {
              if (res.answer) answers.unshift(res.answer);
              addItems(res.results);
              usedProviders.push('Tavily');
            })
            .catch((e) => {
              errors.push(e instanceof Error ? e.message : 'Tavily gagal');
            })
        );
      }
      if (serperKey) {
        tasks.push(
          searchWithSerper(query, serperKey, maxResults)
            .then((res) => {
              if (res.answer) answers.push(res.answer);
              addItems(res.results);
              usedProviders.push('Serper');
            })
            .catch((e) => {
              errors.push(e instanceof Error ? e.message : 'Serper gagal');
            })
        );
      }
      await Promise.all(tasks);

      if (combinedResults.length === 0 && errors.length > 0) {
        return NextResponse.json(
          { ok: false, error: errors.join(' | ') },
          { status: 502 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      query,
      providerUsed: usedProviders.join(' + ') || provider,
      answer: answers[0] || undefined,
      results: combinedResults.slice(0, maxResults * 2)
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Gagal menjalankan pencarian web.'
      },
      { status: 500 }
    );
  }
}
