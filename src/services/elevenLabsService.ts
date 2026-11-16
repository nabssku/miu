'use client';

export type ElevenLabsModelId = 'eleven_flash_v2_5' | 'eleven_multilingual_v2';
export type VoiceSTTProvider = 'browser' | 'elevenlabs';
export type VoiceConversationMode = 'direct' | 'agent';

export interface ElevenLabsConfig {
  apiKey: string;
  voiceId: string;
  modelId: ElevenLabsModelId;
  language: 'id-ID' | 'en-US';
  sttProvider: VoiceSTTProvider;
  autoListen: boolean;
  speed: number;
  convMode: VoiceConversationMode;
  agentId: string;
}

export interface ElevenLabsVoiceOption {
  voice_id: string;
  name: string;
  category?: string;
  labels?: Record<string, string>;
  preview_url?: string;
}

export const PRESET_ELEVENLABS_VOICES: ElevenLabsVoiceOption[] = [
  { voice_id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George (Warm & Natural)', category: 'multilingual' },
  { voice_id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica (Expressive)', category: 'multilingual' },
  { voice_id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel (Clear Tutor)', category: 'multilingual' },
  { voice_id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte (Calm Study)', category: 'multilingual' },
  { voice_id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam (Conversational)', category: 'multilingual' }
];

const ELEVENLABS_STORAGE_KEY = 'miu_elevenlabs_config_v1';

export function getDefaultElevenLabsConfig(
  voiceOverride?: string,
  modelOverride?: string
): ElevenLabsConfig {
  return {
    apiKey: '',
    voiceId: voiceOverride?.trim() || 'JBFqnCBsd6RMkjVDRZzb',
    modelId:
      modelOverride === 'eleven_multilingual_v2' ? 'eleven_multilingual_v2' : 'eleven_flash_v2_5',
    language: 'id-ID',
    sttProvider: 'browser',
    autoListen: true,
    speed: 1.0,
    convMode: 'direct',
    agentId: ''
  };
}

export function loadElevenLabsConfig(
  voiceOverride?: string,
  modelOverride?: string
): ElevenLabsConfig {
  const defaults = getDefaultElevenLabsConfig(voiceOverride, modelOverride);
  if (typeof window === 'undefined') return defaults;

  try {
    const raw = window.localStorage.getItem(ELEVENLABS_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<ElevenLabsConfig>;
    return {
      ...defaults,
      ...parsed,
      apiKey: parsed.apiKey ? atob(parsed.apiKey) : '',
      voiceId: parsed.voiceId?.trim() || defaults.voiceId,
      modelId:
        parsed.modelId === 'eleven_multilingual_v2' ? 'eleven_multilingual_v2' : 'eleven_flash_v2_5',
      language: parsed.language === 'en-US' ? 'en-US' : 'id-ID',
      sttProvider: parsed.sttProvider === 'elevenlabs' ? 'elevenlabs' : 'browser',
      autoListen: parsed.autoListen !== false,
      speed: typeof parsed.speed === 'number' ? Math.max(0.7, Math.min(1.2, parsed.speed)) : 1.0,
      convMode: parsed.convMode === 'agent' ? 'agent' : 'direct',
      agentId: parsed.agentId || ''
    };
  } catch {
    return defaults;
  }
}

export function saveElevenLabsConfig(cfg: ElevenLabsConfig): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      ELEVENLABS_STORAGE_KEY,
      JSON.stringify({
        ...cfg,
        apiKey: cfg.apiKey ? btoa(cfg.apiKey) : ''
      })
    );
  } catch {
    // ignore quota errors
  }
}

export function cleanTextForSpeech(markdown: string): string {
  return markdown
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```[\s\S]*?```/g, ' (lihat contoh kode di panel catatan) ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\$\$[\s\S]*?\$\$/g, ' rumus matematika ')
    .replace(/\$([^$]+)\$/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\|/g, ' ')
    .replace(/[*_~>#]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function fetchElevenLabsVoices(apiKey?: string): Promise<ElevenLabsVoiceOption[]> {
  const headers: Record<string, string> = {};
  if (apiKey?.trim()) {
    headers['x-elevenlabs-key'] = apiKey.trim();
  }
  const res = await fetch('/api/elevenlabs/voices', {
    headers,
    cache: 'no-store'
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `Gagal mengambil suara ElevenLabs (${res.status}).`);
  }
  const data = (await res.json()) as { voices?: ElevenLabsVoiceOption[] };
  return data.voices || [];
}

export interface SpeechPlaybackHandle {
  stop: () => void;
  finished: Promise<{ engine: 'elevenlabs' | 'browser-fallback' }>;
}

export function speakConversationTurn(options: {
  text: string;
  config: ElevenLabsConfig;
  onStart?: (engine: 'elevenlabs' | 'browser-fallback') => void;
}): SpeechPlaybackHandle {
  const speechText = cleanTextForSpeech(options.text);
  let stopped = false;
  let currentAudio: HTMLAudioElement | null = null;
  let objectUrl: string | null = null;

  const stop = () => {
    stopped = true;
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.src = '';
      currentAudio = null;
    }
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  const speakWithBrowserFallback = (): Promise<{ engine: 'browser-fallback' }> =>
    new Promise((resolve) => {
      if (stopped || typeof window === 'undefined' || !('speechSynthesis' in window) || !speechText) {
        resolve({ engine: 'browser-fallback' });
        return;
      }
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(speechText);
      utter.lang = options.config.language;
      utter.rate = Math.max(0.8, Math.min(1.25, options.config.speed || 1));
      utter.onstart = () => options.onStart?.('browser-fallback');
      utter.onend = () => resolve({ engine: 'browser-fallback' });
      utter.onerror = () => resolve({ engine: 'browser-fallback' });
      window.speechSynthesis.speak(utter);
    });

  const finished = (async (): Promise<{ engine: 'elevenlabs' | 'browser-fallback' }> => {
    if (!speechText || stopped) {
      return { engine: 'elevenlabs' };
    }

    try {
      const resp = await fetch('/api/elevenlabs/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: speechText,
          voiceId: options.config.voiceId,
          modelId: options.config.modelId,
          speed: options.config.speed,
          elevenlabsApiKey: options.config.apiKey.trim() || undefined
        })
      });

      if (resp.status === 503) {
        return await speakWithBrowserFallback();
      }

      if (!resp.ok) {
        const errData = (await resp.json().catch(() => ({}))) as { error?: string };
        throw new Error(errData.error || `ElevenLabs TTS Error (${resp.status}).`);
      }

      if (stopped) return { engine: 'elevenlabs' };
      const blob = await resp.blob();
      if (stopped) return { engine: 'elevenlabs' };

      objectUrl = URL.createObjectURL(blob);
      const audio = new Audio(objectUrl);
      currentAudio = audio;

      return await new Promise<{ engine: 'elevenlabs' }>((resolve, reject) => {
        audio.onplay = () => options.onStart?.('elevenlabs');
        audio.onended = () => {
          stop();
          resolve({ engine: 'elevenlabs' });
        };
        audio.onerror = () => {
          stop();
          reject(new Error('Gagal memutar audio ElevenLabs di browser.'));
        };
        void audio.play().catch((err) => {
          stop();
          reject(err instanceof Error ? err : new Error('Playback diblokir oleh browser.'));
        });
      });
    } catch (err) {
      if (err instanceof Error && err.message.includes('ElevenLabs TTS Error')) {
        throw err;
      }
      if (stopped) return { engine: 'elevenlabs' };
      return await speakWithBrowserFallback();
    }
  })();

  return { stop, finished };
}

export interface VoiceCaptureHandle {
  commit: () => void;
  cancel: () => void;
}

export function browserSupportsSpeechRecognition(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  };
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export async function startVoiceTurnCapture(options: {
  sttProvider: VoiceSTTProvider;
  language: 'id-ID' | 'en-US';
  autoListen: boolean;
  elevenLabsApiKey?: string;
  onInterim: (text: string) => void;
  onLevel: (level: number) => void;
  onTranscribing?: () => void;
  onFinal: (transcript: string) => void;
  onError: (msg: string) => void;
}): Promise<VoiceCaptureHandle> {
  let closed = false;
  let committed = false;
  let stream: MediaStream | null = null;
  let audioCtx: AudioContext | null = null;
  let rafId = 0;
  let silenceTimer: number | null = null;
  let finalTranscript = '';
  let latestDisplayTranscript = '';
  let heardVoiceAudio = false;
  let lastVoiceActivityAt = Date.now();

  interface SpeechRec {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    onresult: ((e: unknown) => void) | null;
    onerror: ((e: unknown) => void) | null;
    start: () => void;
    stop: () => void;
  }

  let recognition: SpeechRec | null = null;
  let mediaRecorder: MediaRecorder | null = null;
  const audioChunks: BlobPart[] = [];

  const clearTimers = () => {
    if (silenceTimer !== null) {
      window.clearTimeout(silenceTimer);
      silenceTimer = null;
    }
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  };

  const cleanupHardware = () => {
    clearTimers();
    try {
      recognition?.stop();
    } catch {
      // ignore
    }
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    if (audioCtx) {
      void audioCtx.close().catch(() => {});
      audioCtx = null;
    }
    options.onLevel(0);
  };

  const canUseBrowserSTT =
    options.sttProvider === 'browser' && browserSupportsSpeechRecognition();

  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Browser tidak mendukung akses mikrofon.');
    }
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioCtx();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 128;
    source.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      if (closed || committed) return;
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const level = Math.min(1, sum / (data.length * 90));
      options.onLevel(level);

      if (!canUseBrowserSTT) {
        if (level > 0.14) {
          heardVoiceAudio = true;
          lastVoiceActivityAt = Date.now();
        } else if (
          options.autoListen &&
          heardVoiceAudio &&
          Date.now() - lastVoiceActivityAt > 1700
        ) {
          commit();
          return;
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    tick();
  } catch (err) {
    cleanupHardware();
    options.onError(
      err instanceof Error
        ? err.message
        : 'Izin mikrofon ditolak. Aktifkan izin mic pada browser.'
    );
    return { commit: () => {}, cancel: () => {} };
  }

  const commit = () => {
    if (closed || committed) return;
    committed = true;

    if (canUseBrowserSTT) {
      cleanupHardware();
      const text = (finalTranscript || latestDisplayTranscript).trim();
      if (text) {
        options.onFinal(text);
      } else {
        options.onError('Tidak ada suara yang tertangkap. Coba bicara lebih dekat ke mikrofon.');
      }
      return;
    }

    // Stop MediaRecorder & transcribe via ElevenLabs Scribe STT
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      options.onTranscribing?.();
      mediaRecorder.onstop = async () => {
        cleanupHardware();
        if (closed) return;
        const blob = new Blob(audioChunks, {
          type: mediaRecorder?.mimeType || 'audio/webm'
        });
        if (blob.size < 1200) {
          options.onError('Rekaman terlalu singkat. Coba bicara lagi.');
          return;
        }
        try {
          const form = new FormData();
          form.append('file', blob, 'speech.webm');
          form.append('languageCode', options.language === 'en-US' ? 'en' : 'id');
          if (options.elevenLabsApiKey?.trim()) {
            form.append('elevenlabsApiKey', options.elevenLabsApiKey.trim());
          }
          const res = await fetch('/api/elevenlabs/stt', { method: 'POST', body: form });
          if (!res.ok) {
            const err = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(err.error || 'Gagal mentranskripsi suara lewat ElevenLabs.');
          }
          const data = (await res.json()) as { text?: string };
          const text = (data.text || '').trim();
          if (text) {
            options.onFinal(text);
          } else {
            options.onError('ElevenLabs tidak mendeteksi ucapan pada rekaman.');
          }
        } catch (err) {
          options.onError(
            err instanceof Error ? err.message : 'Gagal mentranskripsi audio ElevenLabs.'
          );
        }
      };
      mediaRecorder.stop();
    } else {
      cleanupHardware();
    }
  };

  if (canUseBrowserSTT) {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRec;
      webkitSpeechRecognition?: new () => SpeechRec;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (Ctor) {
      recognition = new Ctor();
      recognition.lang = options.language;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event: unknown) => {
        if (closed || committed) return;
        const ev = event as {
          resultIndex: number;
          results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
        };
        let interim = '';
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const t = ev.results[i][0].transcript;
          if (ev.results[i].isFinal) {
            finalTranscript += (finalTranscript ? ' ' : '') + t;
          } else {
            interim += t;
          }
        }
        latestDisplayTranscript = `${finalTranscript} ${interim}`.trim();
        options.onInterim(latestDisplayTranscript);

        if (options.autoListen && latestDisplayTranscript) {
          if (silenceTimer !== null) window.clearTimeout(silenceTimer);
          silenceTimer = window.setTimeout(() => {
            commit();
          }, 1550);
        }
      };
      recognition.onerror = () => {
        // Ignore silent abort errors
      };
      try {
        recognition.start();
      } catch {
        // ignore already started
      }
    }
  } else if (stream && typeof MediaRecorder !== 'undefined') {
    const preferredMime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';
    mediaRecorder = preferredMime
      ? new MediaRecorder(stream, { mimeType: preferredMime })
      : new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (ev) => {
      if (ev.data.size > 0) audioChunks.push(ev.data);
    };
    mediaRecorder.start(250);
    options.onInterim('🎙️ Merekam suara untuk transkripsi ElevenLabs Scribe...');
  }

  return {
    commit,
    cancel: () => {
      closed = true;
      try {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
          mediaRecorder.onstop = null;
          mediaRecorder.stop();
        }
      } catch {
        // ignore
      }
      cleanupHardware();
    }
  };
}

// ============================================================================
// OPTIONAL: ELEVENLABS CONVAI AGENT WEBSOCKET CLIENT (PCM 16kHz + SIGNED URL)
// ============================================================================

export interface ElevenLabsAgentSession {
  sendContextUpdate: (text: string) => void;
  close: () => void;
}

export async function connectElevenLabsConvAIAgent(options: {
  agentId: string;
  apiKey?: string;
  noteContext?: string;
  onStatus: (status: 'connecting' | 'connected' | 'speaking' | 'disconnected') => void;
  onUserTranscript: (text: string) => void;
  onAgentResponse: (text: string) => void;
  onLevel: (level: number) => void;
  onError: (msg: string) => void;
}): Promise<ElevenLabsAgentSession> {
  options.onStatus('connecting');

  const headers: Record<string, string> = {};
  if (options.apiKey?.trim()) {
    headers['x-elevenlabs-key'] = options.apiKey.trim();
  }

  const urlRes = await fetch(
    `/api/elevenlabs/agent-signed-url?agentId=${encodeURIComponent(options.agentId.trim())}`,
    { headers, cache: 'no-store' }
  );
  if (!urlRes.ok) {
    const err = (await urlRes.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || 'Gagal mendapatkan Signed URL Agent ElevenLabs.');
  }
  const { signedUrl } = (await urlRes.json()) as { signedUrl: string };

  const ws = new WebSocket(signedUrl);
  let micStream: MediaStream | null = null;
  let audioCtx: AudioContext | null = null;
  let processor: ScriptProcessorNode | null = null;
  let nextPlayTime = 0;
  let activeSources: AudioBufferSourceNode[] = [];
  let closed = false;

  const stopScheduledAudio = () => {
    activeSources.forEach((src) => {
      try {
        src.stop();
      } catch {
        // ignore
      }
    });
    activeSources = [];
    if (audioCtx) {
      nextPlayTime = audioCtx.currentTime;
    }
  };

  const playPcm16Base64 = (base64Audio: string) => {
    if (!audioCtx || closed) return;
    try {
      const binStr = atob(base64Audio);
      const bytes = new Uint8Array(binStr.length);
      for (let i = 0; i < binStr.length; i++) {
        bytes[i] = binStr.charCodeAt(i);
      }
      const int16 = new Int16Array(bytes.buffer);
      if (int16.length === 0) return;

      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768;
      }

      const audioBuffer = audioCtx.createBuffer(1, float32.length, 16000);
      audioBuffer.copyToChannel(float32, 0);

      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);

      const now = audioCtx.currentTime;
      const startAt = Math.max(now + 0.02, nextPlayTime);
      source.start(startAt);
      nextPlayTime = startAt + audioBuffer.duration;
      activeSources.push(source);
      options.onStatus('speaking');

      source.onended = () => {
        activeSources = activeSources.filter((s) => s !== source);
        if (activeSources.length === 0 && !closed) {
          options.onStatus('connected');
        }
      };
    } catch {
      // ignore malformed chunk
    }
  };

  ws.onopen = async () => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtx = new AudioCtx({ sampleRate: 16000 });
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const src = audioCtx.createMediaStreamSource(micStream);
      processor = audioCtx.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN || closed) return;
        const input = e.inputBuffer.getChannelData(0);
        const inputRate = audioCtx?.sampleRate || 16000;

        // Downsample linearly to 16kHz if device ignores requested 16kHz rate
        const ratio = inputRate / 16000;
        const outLen = ratio > 1.05 ? Math.floor(input.length / ratio) : input.length;
        const pcm16 = new Int16Array(outLen);
        let energy = 0;

        for (let i = 0; i < outLen; i++) {
          const sample = ratio > 1.05 ? input[Math.floor(i * ratio)] || 0 : input[i];
          const clamped = Math.max(-1, Math.min(1, sample));
          pcm16[i] = clamped < 0 ? clamped * 32768 : clamped * 32767;
          energy += Math.abs(clamped);
        }
        options.onLevel(Math.min(1, (energy / Math.max(1, outLen)) * 6));

        const u8 = new Uint8Array(pcm16.buffer);
        let binary = '';
        for (let i = 0; i < u8.length; i++) {
          binary += String.fromCharCode(u8[i]);
        }
        ws.send(JSON.stringify({ user_audio_chunk: btoa(binary) }));
      };

      src.connect(processor);
      processor.connect(audioCtx.destination);
      options.onStatus('connected');

      if (options.noteContext?.trim()) {
        ws.send(
          JSON.stringify({
            type: 'contextual_update',
            text: options.noteContext.slice(0, 6000)
          })
        );
      }
    } catch (err) {
      options.onError(
        err instanceof Error ? err.message : 'Gagal mengakses mikrofon untuk ElevenLabs Agent.'
      );
      ws.close();
    }
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(String(event.data)) as {
        type?: string;
        ping_event?: { event_id?: number };
        user_transcription_event?: { user_transcript?: string };
        agent_response_event?: { agent_response?: string };
        audio_event?: { audio_base_64?: string };
      };

      if (data.type === 'ping' && data.ping_event?.event_id !== undefined) {
        ws.send(JSON.stringify({ type: 'pong', event_id: data.ping_event.event_id }));
      } else if (data.type === 'user_transcript' && data.user_transcription_event?.user_transcript) {
        options.onUserTranscript(data.user_transcription_event.user_transcript);
      } else if (data.type === 'agent_response' && data.agent_response_event?.agent_response) {
        options.onAgentResponse(data.agent_response_event.agent_response);
      } else if (data.type === 'interruption') {
        stopScheduledAudio();
      } else if (data.audio_event?.audio_base_64) {
        playPcm16Base64(data.audio_event.audio_base_64);
      }
    } catch {
      // ignore parse errors
    }
  };

  ws.onerror = () => {
    options.onError('Koneksi WebSocket ElevenLabs Agent mengalami kendala.');
  };

  ws.onclose = () => {
    closed = true;
    stopScheduledAudio();
    processor?.disconnect();
    micStream?.getTracks().forEach((t) => t.stop());
    if (audioCtx) void audioCtx.close().catch(() => {});
    options.onStatus('disconnected');
  };

  return {
    sendContextUpdate: (text: string) => {
      if (ws.readyState === WebSocket.OPEN && text.trim()) {
        ws.send(JSON.stringify({ type: 'contextual_update', text: text.slice(0, 6000) }));
      }
    },
    close: () => {
      closed = true;
      ws.close();
    }
  };
}
