import { NextRequest, NextResponse } from 'next/server';
import { getServerCloudEnv } from '@/lib/serverCloud';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const incoming = await req.formData();
    const audioFile = incoming.get('file');
    const customKey = String(incoming.get('elevenlabsApiKey') || '').trim();
    const languageCode = String(incoming.get('languageCode') || '').trim();

    const apiKey = customKey || getServerCloudEnv().elevenLabsApiKey;
    if (!apiKey) {
      return NextResponse.json({ error: 'ELEVENLABS_API_KEY_MISSING' }, { status: 503 });
    }

    if (!audioFile || typeof audioFile === 'string') {
      return NextResponse.json({ error: 'File audio rekaman tidak ditemukan.' }, { status: 400 });
    }

    const forward = new FormData();
    forward.append('file', audioFile, 'voice.webm');
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
