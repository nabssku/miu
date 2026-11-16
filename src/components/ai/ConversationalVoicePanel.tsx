'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRightToLine,
  AudioLines,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  RefreshCw,
  Settings2,
  Square,
  Trash2,
  Volume2,
  Wrench,
  Zap
} from 'lucide-react';
import { getCloudStatusSnapshot, syncCloudStatus } from '@/services/cloudServices';
import {
  browserSupportsSpeechRecognition,
  connectElevenLabsConvAIAgent,
  fetchElevenLabsVoices,
  getDefaultElevenLabsConfig,
  loadElevenLabsConfig,
  PRESET_ELEVENLABS_VOICES,
  saveElevenLabsConfig,
  speakConversationTurn,
  startVoiceTurnCapture,
  type ElevenLabsAgentSession,
  type ElevenLabsConfig,
  type ElevenLabsVoiceOption,
  type SpeechPlaybackHandle,
  type VoiceCaptureHandle
} from '@/services/elevenLabsService';
import {
  buildLiveNoteContext,
  runExternalAIStream,
  type AIConfig
} from '@/services/externalApis';
import type { AIChatMessage, BlockType, NoteRecord } from '@/types/miu';
import { parseMarkdownToNotionBlocks } from '@/utils/markdown';
import { MiuMascot } from '../island/MiuMascot';

interface VoiceTurnItem {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  engine?: 'elevenlabs' | 'browser-fallback' | 'agent';
  createdAt: number;
}

interface ConversationalVoicePanelProps {
  activeNote?: NoteRecord;
  aiTab: 'groq' | 'custom';
  activeConfig: AIConfig;
  activeProviderLabel: string;
  aiPdfAttachment: { fileName: string; text: string; pages: number; url?: string } | null;
  aiImageAttachment: { url: string; caption?: string } | null;
  onInsertBlocks: (
    blocks: Array<{
      type: BlockType;
      content: string;
      checked?: boolean;
      language?: string;
      calloutIcon?: string;
    }>
  ) => Promise<void>;
}

export const ConversationalVoicePanel: React.FC<ConversationalVoicePanelProps> = ({
  activeNote,
  aiTab,
  activeConfig,
  activeProviderLabel,
  aiPdfAttachment,
  aiImageAttachment,
  onInsertBlocks
}) => {
  const [cfg, setCfg] = useState<ElevenLabsConfig>(() => getDefaultElevenLabsConfig());
  const [cfgHydrated, setCfgHydrated] = useState(false);
  const [serverElevenLabsReady, setServerElevenLabsReady] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const [voices, setVoices] = useState<ElevenLabsVoiceOption[]>(PRESET_ELEVENLABS_VOICES);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [voiceLoadMsg, setVoiceLoadMsg] = useState('');

  const [voiceState, setVoiceState] = useState<
    'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking' | 'agent-live'
  >('idle');
  const [audioLevel, setAudioLevel] = useState(0);
  const [interimText, setInterimText] = useState('');
  const [streamingReply, setStreamingReply] = useState('');
  const [turns, setTurns] = useState<VoiceTurnItem[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [insertedSuccess, setInsertedSuccess] = useState(false);
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);

  const captureRef = useRef<VoiceCaptureHandle | null>(null);
  const playbackRef = useRef<SpeechPlaybackHandle | null>(null);
  const agentRef = useRef<ElevenLabsAgentSession | null>(null);
  const sessionActiveRef = useRef(false);
  const turnsRef = useRef<VoiceTurnItem[]>([]);
  const latestCfgRef = useRef(cfg);
  const latestAiConfigRef = useRef(activeConfig);
  const latestActiveNoteRef = useRef(activeNote);
  const latestPdfRef = useRef(aiPdfAttachment);
  const latestImageRef = useRef(aiImageAttachment);
  const lastSentAgentContextRef = useRef('');

  turnsRef.current = turns;
  latestCfgRef.current = cfg;
  latestAiConfigRef.current = activeConfig;
  latestActiveNoteRef.current = activeNote;
  latestPdfRef.current = aiPdfAttachment;
  latestImageRef.current = aiImageAttachment;

  useEffect(() => {
    const snap = getCloudStatusSnapshot();
    const initial = loadElevenLabsConfig(snap.elevenlabsVoiceId, snap.elevenlabsModelId);
    setCfg(initial);
    setServerElevenLabsReady(snap.elevenlabsReady);
    setCfgHydrated(true);

    if (!snap.elevenlabsReady && !initial.apiKey.trim()) {
      setShowSettings(true);
    }

    void syncCloudStatus(true).then((fresh) => {
      setServerElevenLabsReady(fresh.elevenlabsReady);
      if (fresh.elevenlabsReady) {
        setShowSettings(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!cfgHydrated) return;
    saveElevenLabsConfig(cfg);
  }, [cfg, cfgHydrated]);

  useEffect(() => {
    if (!activeNote?.id) return;
    try {
      const raw = window.localStorage.getItem(`miu_voice_turns_${activeNote.id}`);
      setTurns(raw ? (JSON.parse(raw) as VoiceTurnItem[]) : []);
    } catch {
      setTurns([]);
    }
  }, [activeNote?.id]);

  const persistTurns = (next: VoiceTurnItem[]) => {
    setTurns(next);
    if (!activeNote?.id) return;
    try {
      window.localStorage.setItem(`miu_voice_turns_${activeNote.id}`, JSON.stringify(next.slice(-30)));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    return () => {
      sessionActiveRef.current = false;
      captureRef.current?.cancel();
      playbackRef.current?.stop();
      agentRef.current?.close();
    };
  }, []);

  const hasElevenLabsKey = serverElevenLabsReady || Boolean(cfg.apiKey.trim());
  const supportsBrowserSpeech = browserSupportsSpeechRecognition();

  const getFreshNoteContext = async () => {
    const currentNote = latestActiveNoteRef.current;
    return buildLiveNoteContext(
      currentNote?.id || '',
      currentNote,
      latestPdfRef.current,
      10000
    );
  };

  // Automatically push live note edits to an active ElevenLabs Agent WebSocket session
  useEffect(() => {
    if (
      cfg.convMode !== 'agent' ||
      !agentRef.current ||
      (voiceState !== 'agent-live' && voiceState !== 'speaking')
    ) {
      return;
    }

    const timer = window.setTimeout(async () => {
      const live = await getFreshNoteContext();
      if (!agentRef.current || !live.contextText) return;
      if (live.contextText === lastSentAgentContextRef.current) return;
      lastSentAgentContextRef.current = live.contextText;
      agentRef.current.sendContextUpdate(
        `Pembaruan terbaru pada catatan pengguna (selalu gunakan isi terbaru ini):\n\n${live.contextText}`
      );
    }, 450);

    return () => window.clearTimeout(timer);
  }, [
    activeNote?.id,
    activeNote?.updatedAt,
    activeNote?.title,
    activeNote?.blocks,
    aiPdfAttachment,
    voiceState,
    cfg.convMode
  ]);

  const handleFetchAccountVoices = async () => {
    setLoadingVoices(true);
    setVoiceLoadMsg('');
    setErrorMsg('');
    try {
      const list = await fetchElevenLabsVoices(cfg.apiKey.trim() || undefined);
      if (list.length > 0) {
        setVoices(list);
        if (!list.some((v) => v.voice_id === cfg.voiceId)) {
          setCfg((prev) => ({ ...prev, voiceId: list[0].voice_id }));
        }
        setVoiceLoadMsg(`${list.length} suara berhasil dimuat dari akun ElevenLabs.`);
      } else {
        setVoiceLoadMsg('Daftar suara akun kosong, menggunakan preset bawaan.');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat suara ElevenLabs.');
    } finally {
      setLoadingVoices(false);
    }
  };

  const stopAllVoiceActivity = () => {
    sessionActiveRef.current = false;
    captureRef.current?.cancel();
    captureRef.current = null;
    playbackRef.current?.stop();
    playbackRef.current = null;
    agentRef.current?.close();
    agentRef.current = null;
    setAudioLevel(0);
    setInterimText('');
    setStreamingReply('');
    setVoiceState('idle');
  };

  const beginListeningTurn = async () => {
    const currentCfg = latestCfgRef.current;
    setErrorMsg('');
    setInterimText('');
    setVoiceState('listening');

    const handle = await startVoiceTurnCapture({
      sttProvider: currentCfg.sttProvider,
      language: currentCfg.language,
      autoListen: currentCfg.autoListen,
      elevenLabsApiKey: currentCfg.apiKey,
      onInterim: (txt) => setInterimText(txt),
      onLevel: (lvl) => setAudioLevel(lvl),
      onTranscribing: () => setVoiceState('transcribing'),
      onError: (msg) => {
        setErrorMsg(msg);
        setVoiceState('idle');
      },
      onFinal: (userTranscript) => {
        void processUserVoiceTurn(userTranscript);
      }
    });

    captureRef.current = handle;
  };

  const processUserVoiceTurn = async (userTranscript: string) => {
    const cleanUserText = userTranscript.trim();
    if (!cleanUserText) {
      setVoiceState('idle');
      return;
    }

    const userTurn: VoiceTurnItem = {
      id: `v-u-${Date.now()}`,
      role: 'user',
      text: cleanUserText,
      createdAt: Date.now()
    };

    const nextWithUser = [...turnsRef.current, userTurn];
    persistTurns(nextWithUser);
    setInterimText('');
    setStreamingReply('');
    setVoiceState('thinking');
    setErrorMsg('');

    try {
      const liveCtx = await getFreshNoteContext();
      const history: AIChatMessage[] = turnsRef.current.slice(-12).map((t) => ({
        role: t.role,
        content: t.text
      }));

      const langLabel =
        latestCfgRef.current.language === 'en-US' ? 'English' : 'Bahasa Indonesia';
      const systemPrompt = [
        `Kamu adalah Miu AI, partner belajar interaktif lewat percakapan suara.`,
        `Jawab dalam ${langLabel} dengan nada ramah, jelas, dan langsung ke inti seperti berbicara tatap muka (idealnya 2 sampai 5 kalimat yang enak didengar, kecuali pengguna meminta penjelasan panjang).`,
        `Hindari simbol Markdown rumit atau tabel karena jawaban akan dibacakan oleh suara AI ElevenLabs. Jangan pernah mengeluarkan tag <think>.`,
        `PENTING: Jika isi catatan terbaru di bawah berbeda dengan yang sempat dibahas di giliran percakapan sebelumnya, SELALU prioritaskan isi catatan TERBARU di bawah ini karena pengguna baru saja memperbarui catatannya.`,
        `\nKonteks catatan pengguna TERBARU:\n${liveCtx.contextText}`
      ].join('\n');

      const attachedImageUrl =
        latestImageRef.current?.url || liveCtx.noteImages[0]?.content;

      let replyText = '';
      await runExternalAIStream(
        latestAiConfigRef.current,
        systemPrompt,
        cleanUserText,
        (chunk) => {
          replyText = chunk;
          setStreamingReply(chunk);
        },
        attachedImageUrl,
        history
      );

      if (!replyText.trim()) {
        setVoiceState('idle');
        return;
      }

      setVoiceState('speaking');
      setStreamingReply('');

      const playHandle = speakConversationTurn({
        text: replyText,
        config: latestCfgRef.current,
        onStart: () => setVoiceState('speaking')
      });
      playbackRef.current = playHandle;

      const { engine } = await playHandle.finished;

      const assistantTurn: VoiceTurnItem = {
        id: `v-a-${Date.now()}`,
        role: 'assistant',
        text: replyText,
        engine,
        createdAt: Date.now()
      };
      persistTurns([...nextWithUser, assistantTurn]);
      playbackRef.current = null;

      if (sessionActiveRef.current && latestCfgRef.current.autoListen) {
        await beginListeningTurn();
      } else {
        setVoiceState('idle');
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal memproses percakapan suara.'
      );
      setVoiceState('idle');
      sessionActiveRef.current = false;
    }
  };

  const handleStartConversation = async () => {
    setErrorMsg('');

    if (cfg.convMode === 'agent') {
      if (!cfg.agentId.trim()) {
        setShowSettings(true);
        setErrorMsg('Masukkan ElevenLabs Agent ID terlebih dahulu untuk mode Agent Platform.');
        return;
      }
      if (!hasElevenLabsKey) {
        setShowSettings(true);
        setErrorMsg('Masukkan API Key ElevenLabs untuk menghubungkan Agent ID.');
        return;
      }
      sessionActiveRef.current = true;
      try {
        const initialCtx = await getFreshNoteContext();
        lastSentAgentContextRef.current = initialCtx.contextText;
        agentRef.current = await connectElevenLabsConvAIAgent({
          agentId: cfg.agentId,
          apiKey: cfg.apiKey,
          noteContext: initialCtx.contextText,
          onStatus: (st) => {
            if (st === 'connecting') setVoiceState('thinking');
            else if (st === 'connected') setVoiceState('agent-live');
            else if (st === 'speaking') setVoiceState('speaking');
            else setVoiceState('idle');
          },
          onLevel: (lvl) => setAudioLevel(lvl),
          onUserTranscript: (text) => {
            persistTurns([
              ...turnsRef.current,
              { id: `va-u-${Date.now()}`, role: 'user', text, createdAt: Date.now() }
            ]);
          },
          onAgentResponse: (text) => {
            persistTurns([
              ...turnsRef.current,
              {
                id: `va-a-${Date.now()}`,
                role: 'assistant',
                text,
                engine: 'agent',
                createdAt: Date.now()
              }
            ]);
          },
          onError: (msg) => setErrorMsg(msg)
        });
      } catch (err) {
        sessionActiveRef.current = false;
        setErrorMsg(
          err instanceof Error ? err.message : 'Gagal menghubungkan ElevenLabs Agent.'
        );
        setVoiceState('idle');
      }
      return;
    }

    // Direct Mode: Miu Mic STT -> Groq AI / Custom AI Provider -> ElevenLabs TTS
    playbackRef.current?.stop();
    sessionActiveRef.current = true;
    await beginListeningTurn();
  };

  const handleInterruptAndSpeak = async () => {
    playbackRef.current?.stop();
    playbackRef.current = null;
    sessionActiveRef.current = true;
    await beginListeningTurn();
  };

  const handleReplayTurn = async (item: VoiceTurnItem) => {
    playbackRef.current?.stop();
    setErrorMsg('');
    setVoiceState('speaking');
    try {
      const handle = speakConversationTurn({
        text: item.text,
        config: cfg
      });
      playbackRef.current = handle;
      await handle.finished;
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memutar ulang suara.');
    } finally {
      playbackRef.current = null;
      setVoiceState(sessionActiveRef.current ? 'listening' : 'idle');
    }
  };

  const handleInsertTranscriptToNote = async () => {
    if (turns.length === 0) return;
    const md = [
      `## 🎙️ Ringkasan Percakapan Suara Miu AI`,
      ...turns.map((t) =>
        t.role === 'user' ? `- **Kamu:** ${t.text}` : `- **Miu AI:** ${t.text}`
      )
    ].join('\n');
    const blocks = parseMarkdownToNotionBlocks(md);
    if (blocks.length === 0) return;
    await onInsertBlocks(blocks);
    setInsertedSuccess(true);
    window.setTimeout(() => setInsertedSuccess(false), 2500);
  };

  const customLlmEndpointUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/elevenlabs/custom-llm/chat/completions`
      : '/api/elevenlabs/custom-llm/chat/completions';

  return (
    <div className="flex flex-col gap-3 flex-1">
      {/* Brain + Voice Architecture Summary Card */}
      <div className="bg-surface border border-border-subtle rounded-2xl p-3 space-y-2 shadow-sm shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                hasElevenLabsKey ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-text-primary">
                  ElevenLabs Voice AI
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-subtle text-accent-strong">
                  {aiTab === 'groq' ? (
                    <>
                      <Zap className="w-2.5 h-2.5 text-amber-500" />
                      <span>Groq AI</span>
                    </>
                  ) : (
                    <>
                      <Wrench className="w-2.5 h-2.5 text-sky-400" />
                      <span className="truncate max-w-[120px]">{activeProviderLabel}</span>
                    </>
                  )}
                </span>
              </div>
              <p className="text-[10px] text-text-secondary truncate">
                {cfg.convMode === 'agent'
                  ? 'Mode Agent Platform (WebSocket + Custom LLM)'
                  : hasElevenLabsKey
                    ? `Suara ElevenLabs (${cfg.modelId}) • ${activeConfig.model}`
                    : 'Masukkan ElevenLabs API Key untuk suara neural (atau uji pakai suara browser)'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowSettings((v) => !v)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-subtle text-[10px] font-semibold text-text-secondary hover:text-text-primary shrink-0"
          >
            <Settings2 className="w-3 h-3" />
            <span>{showSettings ? 'Tutup' : 'Atur'}</span>
            {showSettings ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>
        </div>

        {showSettings && (
          <div className="pt-2.5 border-t border-border-subtle space-y-2.5">
            {/* Integration Mode Selector */}
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setCfg((prev) => ({ ...prev, convMode: 'direct' }))}
                className={`p-2 rounded-xl border text-left transition ${
                  cfg.convMode === 'direct'
                    ? 'bg-accent-strong/15 border-accent-strong text-accent-strong'
                    : 'bg-subtle/40 border-border-subtle text-text-secondary'
                }`}
              >
                <div className="text-[11px] font-bold">Mode Suara Langsung</div>
                <div className="text-[9px] opacity-80">Groq / Custom AI + ElevenLabs TTS</div>
              </button>
              <button
                type="button"
                onClick={() => setCfg((prev) => ({ ...prev, convMode: 'agent' }))}
                className={`p-2 rounded-xl border text-left transition ${
                  cfg.convMode === 'agent'
                    ? 'bg-accent-strong/15 border-accent-strong text-accent-strong'
                    : 'bg-subtle/40 border-border-subtle text-text-secondary'
                }`}
              >
                <div className="text-[11px] font-bold">ElevenLabs Agent ID</div>
                <div className="text-[9px] opacity-80">ConvAI WebSocket + Custom LLM</div>
              </button>
            </div>

            {/* ElevenLabs API Key */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-semibold text-text-secondary">
                  ElevenLabs API Key {serverElevenLabsReady && '(Server Aktif / Opsional BYOK)'}
                </label>
                {serverElevenLabsReady && !cfg.apiKey && (
                  <span className="text-[9px] font-semibold text-emerald-500">
                    ✓ Env Server Siap
                  </span>
                )}
              </div>
              <div className="relative flex items-center">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={cfg.apiKey}
                  onChange={(e) => setCfg((prev) => ({ ...prev, apiKey: e.target.value }))}
                  placeholder={
                    serverElevenLabsReady
                      ? 'Sudah aktif di server (atau timpa key pribadi)'
                      : 'xi-xxxxxxxxxxxxxxxxxxxxxxxx'
                  }
                  className="w-full bg-subtle/50 border border-border-subtle rounded-xl pl-2.5 pr-8 py-1.5 font-mono text-[11px] text-text-primary focus:outline-none focus:border-accent-strong"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey((v) => !v)}
                  className="absolute right-2 text-text-secondary hover:text-text-primary"
                >
                  {showApiKey ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {cfg.convMode === 'direct' ? (
              <>
                {/* Voice Picker */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[10px] font-semibold text-text-secondary">
                      Suara ElevenLabs (Voice)
                    </label>
                    <button
                      type="button"
                      onClick={() => void handleFetchAccountVoices()}
                      disabled={loadingVoices}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-accent-strong hover:underline disabled:opacity-50"
                    >
                      {loadingVoices ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3 h-3" />
                      )}
                      <span>Muat Voice Akun</span>
                    </button>
                  </div>
                  <select
                    value={cfg.voiceId}
                    onChange={(e) => setCfg((prev) => ({ ...prev, voiceId: e.target.value }))}
                    className="w-full bg-subtle/50 border border-border-subtle rounded-xl px-2.5 py-1.5 text-[11px] text-text-primary focus:outline-none focus:border-accent-strong"
                  >
                    {voices.map((v) => (
                      <option key={v.voice_id} value={v.voice_id}>
                        {v.name} {v.labels?.accent ? `(${v.labels.accent})` : ''}
                      </option>
                    ))}
                  </select>
                  {voiceLoadMsg && (
                    <p className="text-[10px] text-emerald-500">{voiceLoadMsg}</p>
                  )}
                </div>

                {/* Model, STT & Language */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-semibold text-text-secondary">
                      Model Suara
                    </label>
                    <select
                      value={cfg.modelId}
                      onChange={(e) =>
                        setCfg((prev) => ({
                          ...prev,
                          modelId: e.target.value as ElevenLabsConfig['modelId']
                        }))
                      }
                      className="w-full bg-subtle/50 border border-border-subtle rounded-xl px-2 py-1.5 text-[11px] text-text-primary focus:outline-none focus:border-accent-strong"
                    >
                      <option value="eleven_flash_v2_5">Flash v2.5 (Cepat)</option>
                      <option value="eleven_multilingual_v2">Multilingual v2 (Ekspresif)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-semibold text-text-secondary">
                      Bahasa Percakapan
                    </label>
                    <select
                      value={cfg.language}
                      onChange={(e) =>
                        setCfg((prev) => ({
                          ...prev,
                          language: e.target.value === 'en-US' ? 'en-US' : 'id-ID'
                        }))
                      }
                      className="w-full bg-subtle/50 border border-border-subtle rounded-xl px-2 py-1.5 text-[11px] text-text-primary focus:outline-none focus:border-accent-strong"
                    >
                      <option value="id-ID">🇮🇩 Indonesia</option>
                      <option value="en-US">🇬🇧 English</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-semibold text-text-secondary">
                      Pengenal Suara (STT)
                    </label>
                    <select
                      value={cfg.sttProvider}
                      onChange={(e) =>
                        setCfg((prev) => ({
                          ...prev,
                          sttProvider: e.target.value === 'elevenlabs' ? 'elevenlabs' : 'browser'
                        }))
                      }
                      className="w-full bg-subtle/50 border border-border-subtle rounded-xl px-2 py-1.5 text-[11px] text-text-primary focus:outline-none focus:border-accent-strong"
                    >
                      <option value="browser" disabled={!supportsBrowserSpeech}>
                        Browser Real-time {!supportsBrowserSpeech ? '(Tidak didukung)' : ''}
                      </option>
                      <option value="elevenlabs">ElevenLabs Scribe STT</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-semibold text-text-secondary">
                      Kecepatan ({cfg.speed.toFixed(2)}x)
                    </label>
                    <input
                      type="range"
                      min="0.75"
                      max="1.2"
                      step="0.05"
                      value={cfg.speed}
                      onChange={(e) =>
                        setCfg((prev) => ({ ...prev, speed: Number(e.target.value) }))
                      }
                      className="w-full accent-sky-500 mt-2"
                    />
                  </div>
                </div>

                <label className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-subtle/40 border border-border-subtle cursor-pointer">
                  <span className="text-[11px] font-medium text-text-primary">
                    Hands-Free Otomatis (giliran bicara berlanjut)
                  </span>
                  <input
                    type="checkbox"
                    checked={cfg.autoListen}
                    onChange={(e) =>
                      setCfg((prev) => ({ ...prev, autoListen: e.target.checked }))
                    }
                    className="rounded border-border-subtle accent-sky-500"
                  />
                </label>
              </>
            ) : (
              /* ElevenLabs Agent Platform + Custom LLM Endpoint Box */
              <div className="space-y-2">
                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold text-text-secondary">
                    ElevenLabs Agent ID
                  </label>
                  <input
                    type="text"
                    value={cfg.agentId}
                    onChange={(e) => setCfg((prev) => ({ ...prev, agentId: e.target.value }))}
                    placeholder="agent_xxxxxxxxxxxxxxxxxxxx"
                    className="w-full bg-subtle/50 border border-border-subtle rounded-xl px-2.5 py-1.5 font-mono text-[11px] text-text-primary focus:outline-none focus:border-accent-strong"
                  />
                </div>

                <div className="p-2.5 rounded-xl bg-subtle/60 border border-border-subtle space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-text-primary">
                      Endpoint Custom LLM (Untuk Dashboard ElevenLabs)
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(customLlmEndpointUrl);
                        setCopiedEndpoint(true);
                        window.setTimeout(() => setCopiedEndpoint(false), 2000);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface border border-border-subtle text-[10px] font-semibold text-accent-strong"
                    >
                      {copiedEndpoint ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span>Tersalin</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Salin URL</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="font-mono text-[10px] text-text-secondary break-all">
                    {customLlmEndpointUrl}
                  </p>
                  <p className="text-[10px] text-text-secondary leading-snug">
                    Tempel URL di atas ke menu <strong>Custom LLM</strong> pada Agent ElevenLabs
                    Anda untuk menghubungkan Agent ElevenLabs dengan <strong>Groq AI</strong> (atau
                    tambahkan parameter <code>?upstream=URL_PROVIDER</code> untuk Custom AI).
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Live Voice Call Stage */}
      <div className="bg-surface border border-border-subtle rounded-2xl p-4 flex flex-col items-center text-center gap-3 shadow-sm shrink-0">
        <div className="relative flex items-center justify-center w-24 h-24">
          <div
            className={`absolute inset-0 rounded-full transition-transform duration-150 ${
              voiceState === 'listening'
                ? 'bg-emerald-500/20 border-2 border-emerald-400/60'
                : voiceState === 'speaking'
                  ? 'bg-sky-500/25 border-2 border-sky-400/70'
                  : voiceState === 'thinking' || voiceState === 'transcribing'
                    ? 'bg-indigo-500/20 border-2 border-indigo-400/60 animate-pulse'
                    : voiceState === 'agent-live'
                      ? 'bg-emerald-500/20 border-2 border-emerald-400/50'
                      : 'bg-subtle border border-border-subtle'
            }`}
            style={{
              transform: `scale(${1 + audioLevel * 0.32})`
            }}
          />
          <div className="relative z-10 w-16 h-16 rounded-full bg-subtle border border-border-subtle flex items-center justify-center shadow-inner">
            <MiuMascot
              mood={
                voiceState === 'listening' || voiceState === 'agent-live'
                  ? 'lazytype'
                  : voiceState === 'speaking'
                    ? 'music'
                    : voiceState === 'thinking'
                      ? 'focus'
                      : 'idle'
              }
              size={38}
            />
          </div>
        </div>

        <div className="space-y-1 max-w-full">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-subtle text-[11px] font-bold text-text-primary">
            {voiceState === 'listening' && (
              <>
                <Mic className="w-3 h-3 text-emerald-500 animate-pulse" />
                <span>Mendengarkan suara kamu...</span>
              </>
            )}
            {voiceState === 'transcribing' && (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-sky-500" />
                <span>Mentranskripsi suara (ElevenLabs Scribe)...</span>
              </>
            )}
            {voiceState === 'thinking' && (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />
                <span>
                  Berpikir lewat {aiTab === 'groq' ? 'Groq AI' : activeProviderLabel}...
                </span>
              </>
            )}
            {voiceState === 'speaking' && (
              <>
                <Volume2 className="w-3 h-3 text-sky-500 animate-pulse" />
                <span>Miu sedang berbicara (ElevenLabs)...</span>
              </>
            )}
            {voiceState === 'agent-live' && (
              <>
                <AudioLines className="w-3 h-3 text-emerald-500" />
                <span>Terhubung ke ElevenLabs Agent Live</span>
              </>
            )}
            {voiceState === 'idle' && (
              <>
                <AudioLines className="w-3 h-3 text-text-secondary" />
                <span>Siap Percakapan Suara</span>
              </>
            )}
          </div>

          {interimText && (
            <p className="text-xs text-text-primary italic bg-subtle/60 px-3 py-1.5 rounded-xl">
              &ldquo;{interimText}&rdquo;
            </p>
          )}
          {streamingReply && (
            <p className="text-xs text-text-secondary bg-subtle/40 px-3 py-1.5 rounded-xl line-clamp-3">
              {streamingReply}
            </p>
          )}
          {errorMsg && <p className="text-[11px] text-rose-500">{errorMsg}</p>}
        </div>

        {/* Call Controls */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {voiceState === 'idle' && (
            <button
              type="button"
              onClick={() => void handleStartConversation()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-sky-500 text-white text-xs font-bold shadow-md hover:opacity-95 transition active:scale-[0.98]"
            >
              <PhoneCall className="w-4 h-4" />
              <span>Mulai Percakapan Suara</span>
            </button>
          )}

          {voiceState === 'listening' && (
            <>
              <button
                type="button"
                onClick={() => captureRef.current?.commit()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 transition shadow-sm"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Kirim Sekarang</span>
              </button>
              <button
                type="button"
                onClick={stopAllVoiceActivity}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/15 text-rose-500 text-xs font-bold hover:bg-rose-500/25 transition"
              >
                <MicOff className="w-3.5 h-3.5" />
                <span>Akhiri</span>
              </button>
            </>
          )}

          {voiceState === 'speaking' && cfg.convMode === 'direct' && (
            <>
              <button
                type="button"
                onClick={() => void handleInterruptAndSpeak()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition shadow-sm"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Potong &amp; Bicara</span>
              </button>
              <button
                type="button"
                onClick={stopAllVoiceActivity}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/15 text-rose-500 text-xs font-bold hover:bg-rose-500/25 transition"
              >
                <Square className="w-3.5 h-3.5" />
                <span>Berhenti</span>
              </button>
            </>
          )}

          {(voiceState === 'thinking' ||
            voiceState === 'transcribing' ||
            voiceState === 'agent-live' ||
            (voiceState === 'speaking' && cfg.convMode === 'agent')) && (
            <button
              type="button"
              onClick={stopAllVoiceActivity}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-rose-500 text-white text-xs font-bold hover:bg-rose-600 transition shadow-sm"
            >
              <PhoneOff className="w-4 h-4" />
              <span>Akhiri Sesi</span>
            </button>
          )}
        </div>
      </div>

      {/* Multi-turn Transcript Log */}
      {turns.length > 0 && (
        <div className="bg-surface border border-border-subtle rounded-2xl p-3 flex flex-col gap-2.5 flex-1 min-h-[200px] shadow-sm">
          <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-border-subtle">
            <span className="text-[11px] font-bold text-text-primary">
              Transkrip Percakapan ({turns.length})
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => void handleInsertTranscriptToNote()}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold transition ${
                  insertedSuccess
                    ? 'bg-emerald-500 text-white'
                    : 'bg-accent-strong text-white dark:text-slate-950 hover:opacity-90'
                }`}
              >
                {insertedSuccess ? (
                  <>
                    <Check className="w-3 h-3" />
                    <span>Tersisip!</span>
                  </>
                ) : (
                  <>
                    <ArrowRightToLine className="w-3 h-3" />
                    <span>Sisip ke Catatan</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => persistTurns([])}
                className="p-1 rounded-lg hover:bg-rose-500/15 text-text-secondary hover:text-rose-500 transition"
                title="Bersihkan transkrip suara"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="space-y-2 overflow-y-auto max-h-72 pr-1">
            {turns.map((turn) => (
              <div
                key={turn.id}
                className={`p-2.5 rounded-xl text-xs leading-relaxed ${
                  turn.role === 'user'
                    ? 'bg-accent-strong/10 border border-accent-strong/25 ml-6 text-text-primary'
                    : 'bg-subtle/60 border border-border-subtle mr-4 text-text-primary'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-text-secondary">
                    {turn.role === 'user'
                      ? 'Kamu'
                      : turn.engine === 'browser-fallback'
                        ? 'Miu AI (Suara Browser)'
                        : 'Miu AI (ElevenLabs)'}
                  </span>
                  {turn.role === 'assistant' && cfg.convMode === 'direct' && (
                    <button
                      type="button"
                      onClick={() => void handleReplayTurn(turn)}
                      className="inline-flex items-center gap-1 text-[10px] text-accent-strong hover:underline"
                    >
                      <Volume2 className="w-3 h-3" />
                      <span>Putar</span>
                    </button>
                  )}
                </div>
                <p className="whitespace-pre-wrap">{turn.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
