import { NextRequest, NextResponse } from 'next/server';
import { getServerCloudEnv } from '@/lib/serverCloud';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const env = getServerCloudEnv();
    const body = (await req.json()) as {
      text?: string;
      voiceId?: string;
      modelId?: string;
      stability?: number;
      similarityBoost?: number;
      speed?: number;
      elevenlabsApiKey?: string;
    };

    const apiKey = (body.elevenlabsApiKey || '').trim() || env.elevenLabsApiKey;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ELEVENLABS_API_KEY_MISSING' },
        { status: 503 }
      );
    }

    const cleanText = String(body.text || '').trim();
    if (!cleanText) {
      return NextResponse.json({ error: 'Teks suara tidak boleh kosong.' }, { status: 400 });
    }

    const voiceId = (body.voiceId || '').trim() || env.elevenLabsVoiceId || 'JBFqnCBsd6RMkjVDRZzb';
    const modelId = (body.modelId || '').trim() || env.elevenLabsModelId || 'eleven_flash_v2_5';
    const stability = typeof body.stability === 'number' ? Math.max(0, Math.min(1, body.stability)) : 0.5;
    const similarityBoost =
      typeof body.similarityBoost === 'number'
        ? Math.max(0, Math.min(1, body.similarityBoost))
        : 0.75;
    const speed = typeof body.speed === 'number' ? Math.max(0.7, Math.min(1.2, body.speed)) : 1.0;

    const endpoint = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(
      voiceId
    )}/stream?output_format=mp3_44100_128`;

    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
        'xi-api-key': apiKey
      },
      body: JSON.stringify({
        text: cleanText.slice(0, 4500),
        model_id: modelId,
        voice_settings: {
          stability,
          similarity_boost: similarityBoost,
          style: 0.0,
          use_speaker_boost: true,
          speed
        }
      }),
      cache: 'no-store'
    });

    if (!upstream.ok || !upstream.body) {
      const errDetail = await upstream.text().catch(() => '');
      return NextResponse.json(
        {
          error: `ElevenLabs TTS Error (${upstream.status}): ${
            errDetail.slice(0, 180) || 'Periksa API Key atau Voice ID ElevenLabs.'
          }`
        },
        { status: upstream.status || 502 }
      );
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache, no-store'
      }
    });
  } catch (err) {
    console.warn('[API /elevenlabs/tts POST] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal menghasilkan audio ElevenLabs.' },
      { status: 500 }
    );
  }
}
