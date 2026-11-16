import { NextRequest, NextResponse } from 'next/server';
import { getServerCloudEnv } from '@/lib/serverCloud';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const headerKey = (req.headers.get('x-elevenlabs-key') || '').trim();
    const apiKey = headerKey || getServerCloudEnv().elevenLabsApiKey;

    if (!apiKey) {
      return NextResponse.json({ error: 'ELEVENLABS_API_KEY_MISSING' }, { status: 400 });
    }

    const upstream = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': apiKey
      },
      cache: 'no-store'
    });

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '');
      return NextResponse.json(
        { error: `ElevenLabs Voices Error (${upstream.status}): ${detail.slice(0, 140)}` },
        { status: upstream.status }
      );
    }

    const data = (await upstream.json()) as {
      voices?: Array<{
        voice_id: string;
        name: string;
        category?: string;
        labels?: Record<string, string>;
        preview_url?: string;
      }>;
    };

    const voices = (data.voices || []).map((v) => ({
      voice_id: v.voice_id,
      name: v.name,
      category: v.category || 'library',
      labels: v.labels || {},
      preview_url: v.preview_url || ''
    }));

    return NextResponse.json({ voices });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal memuat daftar suara ElevenLabs.' },
      { status: 500 }
    );
  }
}
