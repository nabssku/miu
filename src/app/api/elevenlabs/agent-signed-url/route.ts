import { NextRequest, NextResponse } from 'next/server';
import { getServerCloudEnv } from '@/lib/serverCloud';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = (searchParams.get('agentId') || '').trim();
    const headerKey = (req.headers.get('x-elevenlabs-key') || '').trim();
    const apiKey = headerKey || getServerCloudEnv().elevenLabsApiKey;

    if (!agentId) {
      return NextResponse.json({ error: 'agentId wajib diisi.' }, { status: 400 });
    }
    if (!apiKey) {
      return NextResponse.json({ error: 'ELEVENLABS_API_KEY_MISSING' }, { status: 503 });
    }

    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(
        agentId
      )}`,
      {
        headers: {
          'xi-api-key': apiKey
        },
        cache: 'no-store'
      }
    );

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return NextResponse.json(
        {
          error: `ElevenLabs Agent Error (${res.status}): ${
            detail.slice(0, 160) || 'Periksa Agent ID & API Key ElevenLabs.'
          }`
        },
        { status: res.status }
      );
    }

    const data = (await res.json()) as { signed_url?: string };
    if (!data.signed_url) {
      return NextResponse.json(
        { error: 'Signed URL tidak tersedia dari ElevenLabs.' },
        { status: 502 }
      );
    }

    return NextResponse.json({ signedUrl: data.signed_url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal membuat signed URL ElevenLabs.' },
      { status: 500 }
    );
  }
}
