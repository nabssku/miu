import { NextRequest, NextResponse } from 'next/server';
import { getServerCloudEnv, resolveUpstreamAiModel } from '@/lib/serverCloud';

export const dynamic = 'force-dynamic';

function buildCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, x-miu-upstream-url, x-miu-upstream-key, x-miu-upstream-model'
  };
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: buildCorsHeaders() });
}

/**
 * OpenAI-Compatible Custom LLM endpoint for ElevenLabs Conversational AI Agents.
 * Forwards turns to Miu AI (default) or a user-specified OpenAI-compatible Custom Provider,
 * stripping internal `<think>...</think>` blocks so the voice agent only speaks clean answers.
 */
export async function POST(req: NextRequest) {
  const corsHeaders = buildCorsHeaders();

  try {
    const env = getServerCloudEnv();
    const { searchParams } = new URL(req.url);

    if (env.elevenLabsCustomLlmSecret) {
      const auth = (req.headers.get('authorization') || '').trim();
      const token = auth.replace(/^Bearer\s+/i, '').trim();
      if (token !== env.elevenLabsCustomLlmSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
      }
    }

    const body = (await req.json()) as {
      model?: string;
      messages?: Array<{ role: string; content: unknown }>;
      tools?: unknown[];
      tool_choice?: unknown;
      temperature?: number;
      max_tokens?: number;
      stream?: boolean;
    };

    const customUpstreamRaw =
      (req.headers.get('x-miu-upstream-url') || searchParams.get('upstream') || '').trim();
    const customUpstreamKey =
      (req.headers.get('x-miu-upstream-key') || '').trim();
    const customUpstreamModel =
      (req.headers.get('x-miu-upstream-model') || searchParams.get('model') || '').trim();

    let endpoint = env.aiBaseUrl;
    let apiKey = env.groqApiKey;

    if (customUpstreamRaw) {
      endpoint = customUpstreamRaw.endsWith('/chat/completions')
        ? customUpstreamRaw
        : `${customUpstreamRaw.replace(/\/$/, '')}/chat/completions`;
      apiKey = customUpstreamKey || env.groqApiKey;
    }

    if (!apiKey && !endpoint.includes('localhost') && !endpoint.includes('127.0.0.1')) {
      return NextResponse.json(
        { error: 'Upstream AI API key belum dikonfigurasi.' },
        { status: 503, headers: corsHeaders }
      );
    }

    const requestedModel = (body.model || '').trim();
    const rawTargetModel =
      customUpstreamModel ||
      (requestedModel && requestedModel !== 'custom-llm' ? requestedModel : '') ||
      env.groqModel ||
      'miu-ai-free';
    const targetModel = customUpstreamRaw
      ? rawTargetModel
      : resolveUpstreamAiModel(rawTargetModel);

    const shouldStream = body.stream !== false;
    const payload: Record<string, unknown> = {
      model: targetModel,
      messages: Array.isArray(body.messages) ? body.messages : [],
      stream: shouldStream
    };
    if (typeof body.temperature === 'number') payload.temperature = body.temperature;
    if (typeof body.max_tokens === 'number') payload.max_tokens = body.max_tokens;
    if (Array.isArray(body.tools) && body.tools.length > 0) payload.tools = body.tools;
    if (body.tool_choice !== undefined) payload.tool_choice = body.tool_choice;

    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify(payload),
      cache: 'no-store'
    });

    if (!upstream.ok || !upstream.body) {
      const errDetail = await upstream.text().catch(() => '');
      return NextResponse.json(
        { error: errDetail.slice(0, 220) || 'Upstream LLM error' },
        { status: upstream.status || 502, headers: corsHeaders }
      );
    }

    if (!shouldStream) {
      const json = (await upstream.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      if (json.choices?.[0]?.message?.content) {
        json.choices[0].message.content = json.choices[0].message.content
          .replace(/<think>[\s\S]*?<\/think>\s*/g, '')
          .trim();
      }
      return NextResponse.json(json, { status: 200, headers: corsHeaders });
    }

    // Stream SSE while stripping <think>...</think> blocks cleanly before ElevenLabs speaks
    let insideThink = false;
    let sseBuffer = '';
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    const reader = upstream.body.getReader();

    const filteredStream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            if (sseBuffer.trim()) {
              controller.enqueue(encoder.encode(`${sseBuffer}\n`));
            }
            controller.close();
            return;
          }

          sseBuffer += decoder.decode(value, { stream: true });
          const lines = sseBuffer.split('\n');
          sseBuffer = lines.pop() || '';
          let enqueued = false;

          for (const line of lines) {
            if (!line.startsWith('data:')) {
              controller.enqueue(encoder.encode(`${line}\n`));
              enqueued = true;
              continue;
            }
            const rawData = line.slice(5).trim();
            if (!rawData || rawData === '[DONE]') {
              controller.enqueue(encoder.encode(`${line}\n`));
              enqueued = true;
              continue;
            }

            try {
              const parsed = JSON.parse(rawData) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };
              const content = parsed?.choices?.[0]?.delta?.content;
              if (typeof content !== 'string') {
                controller.enqueue(encoder.encode(`${line}\n`));
                enqueued = true;
                continue;
              }

              let remaining = content;
              let visible = '';

              while (remaining.length > 0) {
                if (insideThink) {
                  const endIdx = remaining.indexOf('</think>');
                  if (endIdx === -1) {
                    remaining = '';
                  } else {
                    insideThink = false;
                    remaining = remaining.slice(endIdx + 8);
                  }
                } else {
                  const startIdx = remaining.indexOf('<think>');
                  if (startIdx === -1) {
                    visible += remaining;
                    remaining = '';
                  } else {
                    visible += remaining.slice(0, startIdx);
                    insideThink = true;
                    remaining = remaining.slice(startIdx + 7);
                  }
                }
              }

              if (visible.length === 0) {
                continue;
              }

              parsed.choices![0].delta!.content = visible;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(parsed)}\n`));
              enqueued = true;
            } catch {
              controller.enqueue(encoder.encode(`${line}\n`));
              enqueued = true;
            }
          }
          if (enqueued) return;
        }
      },
      cancel() {
        void reader.cancel();
      }
    });

    return new Response(filteredStream, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive'
      }
    });
  } catch (err) {
    console.warn('[API /elevenlabs/custom-llm POST] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Custom LLM proxy error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
