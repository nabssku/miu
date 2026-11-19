import { NextResponse } from 'next/server';
import {
  ensureServerNeonSchema,
  getServerCloudEnv,
  isServerCloudinaryConfigured,
  isServerNeonConfigured
} from '@/lib/serverCloud';

import { getPublicRealtimeUrl, isServerRealtimeConfigured } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

export async function GET() {
  const env = getServerCloudEnv();
  return NextResponse.json({
    dbReady: isServerNeonConfigured(),
    realtimeReady: isServerRealtimeConfigured(),
    realtimeUrl: getPublicRealtimeUrl(),
    mediaReady: isServerCloudinaryConfigured(),
    aiReady: Boolean(env.groqApiKey),
    aiModel: env.groqModel,
    googleClientId: env.googleClientId,
    elevenlabsReady: Boolean(env.elevenLabsApiKey),
    elevenlabsVoiceId: env.elevenLabsVoiceId,
    elevenlabsModelId: env.elevenLabsModelId
  });
}

export async function POST() {
  const ok = await ensureServerNeonSchema();
  return NextResponse.json({ ok }, { status: ok ? 200 : 503 });
}
