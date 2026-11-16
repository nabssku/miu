import { NextRequest, NextResponse } from 'next/server';
import { getServerCloudEnv } from '@/lib/serverCloud';

export const dynamic = 'force-dynamic';

const GROQ_CHAT_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_VISION_FALLBACK_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

export async function POST(req: NextRequest) {
  try {
    const { groqApiKey, groqModel } = getServerCloudEnv();
    if (!groqApiKey) {
      return NextResponse.json(
        { error: 'GROQ_API_KEY_MISSING' },
        { status: 503 }
      );
    }

    const body = (await req.json()) as {
      systemPrompt?: string;
      userPrompt?: string;
      imageUrl?: string;
      model?: string;
    };

    const systemPrompt = String(body.systemPrompt || 'Kamu adalah Miu AI, asisten belajar yang cerdas dan terstruktur.');
    const userPrompt = String(body.userPrompt || '');
    const imageUrl = body.imageUrl ? String(body.imageUrl) : undefined;
    const requestedModel = (body.model || '').trim();
    const primaryModel = requestedModel && requestedModel !== 'groq-default'
      ? requestedModel
      : groqModel || 'qwen/qwen3.8-27b';

    const sendGroqRequest = async (targetModel: string, withVision: boolean) => {
      const userContent =
        withVision && imageUrl
          ? [
              { type: 'text', text: userPrompt },
              { type: 'image_url', image_url: { url: imageUrl } }
            ]
          : userPrompt;

      return fetch(GROQ_CHAT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${groqApiKey}`
        },
        body: JSON.stringify({
          model: targetModel,
          stream: true,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent }
          ]
        }),
        cache: 'no-store'
      });
    };

    let upstream = await sendGroqRequest(primaryModel, Boolean(imageUrl));

    if (!upstream.ok && imageUrl && upstream.status === 400 && primaryModel !== GROQ_VISION_FALLBACK_MODEL) {
      upstream = await sendGroqRequest(GROQ_VISION_FALLBACK_MODEL, true);
    }

    if (!upstream.ok || !upstream.body) {
      const errDetail = await upstream.text().catch(() => '');
      return NextResponse.json(
        {
          error: `GROQ Error (${upstream.status}): ${errDetail.slice(0, 180) || 'Gagal menghubungi layanan AI.'}`
        },
        { status: upstream.status || 502 }
      );
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive'
      }
    });
  } catch (err) {
    console.warn('[API /ai/chat POST] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Kesalahan server AI.' },
      { status: 500 }
    );
  }
}
