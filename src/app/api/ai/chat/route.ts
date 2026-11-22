import { NextRequest, NextResponse } from 'next/server';
import { getServerCloudEnv, resolveUpstreamAiModel } from '@/lib/serverCloud';

export const dynamic = 'force-dynamic';

const MIU_VISION_FALLBACK_MODEL = 'ciora-vision-free';
const MIU_SECONDARY_VISION_MODEL = 'nvidia/nemotron-3.5-super-vl-free';

function sanitizeErrorDetail(raw: string): string {
  return raw
    .replace(/ciora/gi, 'Miu AI')
    .replace(/groq/gi, 'Miu AI')
    .slice(0, 180)
    .trim();
}

export async function POST(req: NextRequest) {
  try {
    const { aiBaseUrl, groqApiKey, groqModel } = getServerCloudEnv();
    if (!groqApiKey) {
      return NextResponse.json(
        { error: 'MIU_AI_API_KEY_MISSING' },
        { status: 503 }
      );
    }

    const body = (await req.json()) as {
      systemPrompt?: string;
      userPrompt?: string;
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
      imageUrl?: string;
      model?: string;
    };

    const systemPrompt = String(
      body.systemPrompt || 'Kamu adalah Miu AI, asisten belajar yang cerdas dan terstruktur.'
    );
    const userPrompt = String(body.userPrompt || '');
    const history = Array.isArray(body.history)
      ? body.history
          .filter(
            (m) =>
              (m.role === 'user' || m.role === 'assistant') &&
              typeof m.content === 'string' &&
              m.content.trim()
          )
          .slice(-16)
      : [];
    const imageUrl = body.imageUrl ? String(body.imageUrl) : undefined;
    const requestedModel = (body.model || '').trim();
    const primaryModel = resolveUpstreamAiModel(
      requestedModel && requestedModel !== 'groq-default'
        ? requestedModel
        : groqModel || 'miu-ai-free'
    );

    const sendChatRequest = async (targetModel: string, withVision: boolean) => {
      const userContent =
        withVision && imageUrl
          ? [
              { type: 'text', text: userPrompt },
              { type: 'image_url', image_url: { url: imageUrl } }
            ]
          : userPrompt;

      return fetch(aiBaseUrl, {
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
            ...history.map((h) => ({ role: h.role, content: h.content })),
            { role: 'user', content: userContent }
          ]
        }),
        cache: 'no-store'
      });
    };

    let upstream = await sendChatRequest(primaryModel, Boolean(imageUrl));

    if (
      !upstream.ok &&
      imageUrl &&
      (upstream.status === 400 || upstream.status === 422) &&
      primaryModel !== MIU_VISION_FALLBACK_MODEL
    ) {
      upstream = await sendChatRequest(MIU_VISION_FALLBACK_MODEL, true);
      if (!upstream.ok && primaryModel !== MIU_SECONDARY_VISION_MODEL) {
        upstream = await sendChatRequest(MIU_SECONDARY_VISION_MODEL, true);
      }
    }

    if (!upstream.ok || !upstream.body) {
      const errDetail = await upstream.text().catch(() => '');
      return NextResponse.json(
        {
          error: `Miu AI Error (${upstream.status}): ${
            sanitizeErrorDetail(errDetail) || 'Gagal menghubungi layanan AI.'
          }`
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
