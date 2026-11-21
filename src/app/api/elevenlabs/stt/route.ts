import { NextRequest, NextResponse } from 'next/server';
import { getServerCloudEnv } from '@/lib/serverCloud';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let audioBlob: Blob | null = null;
    let customKey = '';
    let languageCode = '';

    if (contentType.includes('application/json')) {
      const body = (await req.json()) as {
        audioUrl?: string;
        elevenlabsApiKey?: string;
        languageCode?: string;
      };
      customKey = String(body.elevenlabsApiKey || '').trim();
      languageCode = String(body.languageCode || '').trim();
      const rawUrl = String(body.audioUrl || '').trim();
      if (!rawUrl) {
        return NextResponse.json({ error: 'URL audio tidak ditemukan.' }, { status: 400 });
      }
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(rawUrl);
      } catch {
        return NextResponse.json({ error: 'URL audio tidak valid.' }, { status: 400 });
      }
      if (
        parsedUrl.protocol !== 'https:' ||
        /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0)/i.test(parsedUrl.hostname)
      ) {
        return NextResponse.json(
          { error: 'Hanya URL audio HTTPS publik yang diizinkan.' },
          { status: 400 }
        );
      }
      const mediaResp = await fetch(parsedUrl.toString(), { cache: 'no-store' });
      if (!mediaResp.ok) {
        return NextResponse.json(
          { error: `Gagal mengambil file audio dari cloud (${mediaResp.status}).` },
          { status: 400 }
        );
      }
      audioBlob = await mediaResp.blob();
    } else {
      const incoming = await req.formData();
      const audioFile = incoming.get('file');
      customKey = String(incoming.get('elevenlabsApiKey') || '').trim();
      languageCode = String(incoming.get('languageCode') || '').trim();

      if (!audioFile || typeof audioFile === 'string') {
        return NextResponse.json({ error: 'File audio rekaman tidak ditemukan.' }, { status: 400 });
      }
      audioBlob = audioFile;
    }

    const apiKey = customKey || getServerCloudEnv().elevenLabsApiKey;
    if (!apiKey) {
      return NextResponse.json({ error: 'ELEVENLABS_API_KEY_MISSING' }, { status: 503 });
    }

    const forward = new FormData();
    forward.append('file', audioBlob, 'voice.webm');
    forward.append('model_id', 'scribe_v1');
    if (languageCode) {
      forward.append('language_code', languageCode);
    }

    const upstream = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey
      },
      body: forward,
      cache: 'no-store'
    });

    if (!upstream.ok) {
      const errDetail = await upstream.text().catch(() => '');
      return NextResponse.json(
        {
          error: `ElevenLabs STT Error (${upstream.status}): ${
            errDetail.slice(0, 180) || 'Gagal mentranskripsi suara.'
          }`
        },
        { status: upstream.status }
      );
    }

    const data = (await upstream.json()) as { text?: string };
    return NextResponse.json({ text: (data.text || '').trim() });
  } catch (err) {
    console.warn('[API /elevenlabs/stt POST] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal memproses STT ElevenLabs.' },
      { status: 500 }
    );
  }
}
