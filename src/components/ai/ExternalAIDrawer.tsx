'use client';

import React, { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowRightToLine,
  AudioLines,
  BrainCircuit,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  FileText,
  ImagePlus,
  ListTodo,
  Loader2,
  Maximize2,
  MessageSquare,
  Minimize2,
  RefreshCw,
  Send,
  Settings2,
  Sparkles,
  Trash2,
  Wrench,
  X,
  Zap
} from 'lucide-react';
import { ConversationalVoicePanel } from './ConversationalVoicePanel';
import { db } from '../../db/database';
import { useMiu } from '../../context/MiuContext';
import { flattenBlocks } from '../../utils/blockTreeHelper';
import { syncCloudStatus, uploadImageToCloudinary } from '../../services/cloudServices';
import {
  buildLiveNoteContext,
  DEFAULT_BASE_URLS,
  DEFAULT_MODELS,
  loadAIConfig,
  loadDefaultGroqConfig,
  runExternalAIStream,
  saveAIConfig,
  type AIConfig
} from '../../services/externalApis';
import type { AIProviderId } from '../../types/miu';
import {
  cleanThinkingTags,
  MarkdownView,
  parseMarkdownToNotionBlocks,
  stripInlineMarkdown
} from '../../utils/markdown';
import { processAndUploadPdf } from '../../utils/pdfHelper';

const CUSTOM_PROVIDER_PRESETS: Array<{
  id: AIProviderId;
  label: string;
  shortDesc: string;
}> = [
  { id: 'custom', label: 'Custom Endpoint', shortDesc: 'OpenAI-Compatible URL' },
  { id: 'gemini', label: 'Google Gemini', shortDesc: 'Google AI Studio Key' },
  { id: 'claude', label: 'Anthropic Claude', shortDesc: 'Anthropic API Key' },
  { id: 'openrouter', label: 'OpenRouter', shortDesc: 'Multi-Model Router' },
  { id: 'openai', label: 'OpenAI', shortDesc: 'GPT-4o / o3-mini' },
  { id: 'ollama', label: 'Ollama Local', shortDesc: 'Localhost:11434' }
];

export const ExternalAIDrawer: React.FC = () => {
  const {
    activeNoteId,
    activeCourseId,
    isAIDrawerOpen,
    setIsAIDrawerOpen,
    aiExplainDraft,
    aiImageAttachment,
    setAiImageAttachment,
    aiPdfAttachment,
    setAiPdfAttachment,
    insertBlocksIntoActiveNote
  } = useMiu();

  const allNotes = useLiveQuery(() => db.notes.toArray(), [], []);
  const queriedNote = useLiveQuery(() => db.notes.get(activeNoteId), [activeNoteId]);
  const activeNote = queriedNote || allNotes[0];

  const [aiTab, setAiTab] = useState<'groq' | 'custom'>('groq');
  const [interactionMode, setInteractionMode] = useState<'text' | 'voice'>('text');
  const [defaultGroqConfig, setDefaultGroqConfig] = useState<AIConfig>(() => loadDefaultGroqConfig());
  const [customConfig, setCustomConfig] = useState<AIConfig>({
    provider: 'custom',
    apiKey: '',
    model: 'gpt-4o-mini',
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    ollamaUrl: 'http://localhost:11434'
  });
  const [showCustomSettings, setShowCustomSettings] = useState<boolean>(true);
  const [configHydrated, setConfigHydrated] = useState(false);

  useEffect(() => {
    const saved = loadAIConfig();
    setCustomConfig(saved);
    setShowCustomSettings(saved.provider !== 'ollama' && !saved.apiKey.trim());
    setConfigHydrated(true);
    void syncCloudStatus().then((status) => {
      if (status.aiModel) {
        setDefaultGroqConfig(loadDefaultGroqConfig(status.aiModel));
      }
    });
  }, []);
  const [showKey, setShowKey] = useState(false);
  const [isExpandedWidth, setIsExpandedWidth] = useState(false);

  const [customPrompt, setCustomPrompt] = useState('');
  const [responseText, setResponseText] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadingRef, setUploadingRef] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [insertedSuccess, setInsertedSuccess] = useState(false);
  const [copiedResponse, setCopiedResponse] = useState(false);
  const [todosAddedSuccess, setTodosAddedSuccess] = useState(false);
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);
  const [showQuizCards, setShowQuizCards] = useState(false);
  const [contextJustUpdated, setContextJustUpdated] = useState(false);

  useEffect(() => {
    if (!activeNote?.updatedAt) return;
    setContextJustUpdated(true);
    const t = window.setTimeout(() => setContextJustUpdated(false), 1400);
    return () => window.clearTimeout(t);
  }, [activeNote?.updatedAt, activeNote?.title, activeNote?.blocks]);

  // Per-note AI Conversation History + Multi-select to delete
  const [chatHistory, setChatHistory] = useState<
    Array<{ id: string; title: string; response: string; model: string; createdAt: number }>
  >([]);
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([]);
  const [isChatSelectMode, setIsChatSelectMode] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`miu_ai_chats_${activeNoteId}`);
      const parsed = raw ? JSON.parse(raw) : [];
      setChatHistory(Array.isArray(parsed) ? parsed : []);
    } catch {
      setChatHistory([]);
    }
    setSelectedChatIds([]);
    setIsChatSelectMode(false);
  }, [activeNoteId]);

  const persistChatHistory = (
    next: Array<{ id: string; title: string; response: string; model: string; createdAt: number }>
  ) => {
    setChatHistory(next);
    try {
      localStorage.setItem(`miu_ai_chats_${activeNoteId}`, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!configHydrated) return;
    saveAIConfig(customConfig);
  }, [customConfig, configHydrated]);

  // Automatically widen drawer when a PDF is attached so long PDF analyses are comfortable to read
  useEffect(() => {
    if (aiPdfAttachment) {
      setIsExpandedWidth(true);
    }
  }, [aiPdfAttachment]);

  useEffect(() => {
    if (aiExplainDraft) {
      if (
        aiExplainDraft.startsWith('http://') ||
        aiExplainDraft.startsWith('https://') ||
        aiExplainDraft.startsWith('data:image/')
      ) {
        setAiImageAttachment({ url: aiExplainDraft, caption: 'Gambar Catatan' });
        setCustomPrompt('');
      } else {
        setCustomPrompt(
          `Jelaskan konsep ini dengan bahasa mahasiswa yang mudah dipahami:\n"${aiExplainDraft}"`
        );
      }
    }
  }, [aiExplainDraft, setAiImageAttachment]);

  if (!isAIDrawerOpen) return null;

  const activeConfig: AIConfig = aiTab === 'groq' ? defaultGroqConfig : customConfig;
  const isCustomReady =
    customConfig.provider === 'ollama'
      ? Boolean(customConfig.ollamaUrl.trim() && customConfig.model.trim())
      : Boolean(customConfig.apiKey.trim() && customConfig.model.trim());

  const flatBlocks = flattenBlocks(activeNote?.blocks);
  const noteImages = flatBlocks.filter(
    (b) => b.type === 'image' && Boolean(b.content)
  );
  const notePdfs = flatBlocks.filter(
    (b) => b.type === 'pdf' && Boolean(b.content)
  );

  const handleUploadReferenceImage = async (file: File) => {
    setUploadingRef(true);
    try {
      const { url } = await uploadImageToCloudinary(file);
      setAiImageAttachment({
        url,
        caption: file.name.replace(/\.[^/.]+$/, '') || 'Referensi Gambar'
      });
      setAiPdfAttachment(null);
    } catch {
      // ignore
    } finally {
      setUploadingRef(false);
    }
  };

  const handleUploadReferencePdf = async (file: File) => {
    setUploadingRef(true);
    try {
      const { url, fileName, text, pages } = await processAndUploadPdf(file);
      setAiPdfAttachment({ fileName, text, pages, url });
      setAiImageAttachment(null);
    } catch {
      // ignore
    } finally {
      setUploadingRef(false);
    }
  };

  const executePrompt = async (mode: 'summarize' | 'quiz' | 'breakdown' | 'explain' | 'custom') => {
    if (!activeNote) return;
    // Collapse custom provider settings automatically so the response area has full height
    if (aiTab === 'custom') {
      setShowCustomSettings(false);
    }
    setLoading(true);
    setErrorMsg('');
    setResponseText('');
    setInsertedSuccess(false);
    setShowQuizCards(mode === 'quiz');
    setFlashcardFlipped(false);

    const liveContext = await buildLiveNoteContext(
      activeNoteId || activeNote.id,
      activeNote,
      aiPdfAttachment,
      24000
    );
    const noteContent = liveContext.contextText;
    const attachedImageUrl = aiImageAttachment?.url || liveContext.noteImages[0]?.content;
    let userPrompt = customPrompt.trim();

    if (mode === 'summarize') {
      userPrompt = `Ringkas materi berikut menjadi poin-poin inti terstruktur (gunakan Heading ##, Bullet -, dan Bold **kata kunci**) dalam Bahasa Indonesia:\n\n${noteContent}`;
    } else if (mode === 'quiz') {
      userPrompt = `Buatkan 3 soal pilihan ganda latihan beserta kunci jawaban dan penjelasan singkat dari materi berikut:\n\n${noteContent}`;
    } else if (mode === 'breakdown') {
      userPrompt = `Pecah materi/tugas berikut menjadi langkah-langkah To-do actionable beserta estimasi sesi Pomodoro (🍅):\n\n${noteContent}`;
    } else if (mode === 'explain') {
      userPrompt = aiPdfAttachment
        ? `Jelaskan secara terstruktur dan lengkap poin-poin penting dari dokumen PDF "${aiPdfAttachment.fileName}" berikut dengan bahasa mahasiswa yang mudah dipahami:\n\n${noteContent}`
        : aiImageAttachment
          ? `Jelaskan secara lengkap dan terstruktur isi dari gambar referensi ini (${
              aiImageAttachment.caption || 'Gambar Catatan'
            }) beserta kaitannya dengan catatan:\n\n${noteContent}`
          : userPrompt ||
            `Jelaskan bagian tersulit atau rumus pada catatan ini menggunakan analogi sederhana:\n\n${noteContent}`;
    } else if (mode === 'custom') {
      if (!userPrompt && aiPdfAttachment) {
        userPrompt = `Jelaskan dan rangkum isi dokumen PDF "${aiPdfAttachment.fileName}" secara lengkap dan terstruktur:\n\n${noteContent}`;
      } else if (aiPdfAttachment) {
        userPrompt = `${userPrompt}\n\n${noteContent}`;
      } else if (!userPrompt && aiImageAttachment) {
        userPrompt = `Jelaskan isi gambar referensi "${
          aiImageAttachment.caption || 'ini'
        }" secara detail dengan bahasa yang mudah dipahami.`;
      } else if (aiImageAttachment) {
        userPrompt = `${userPrompt}\n\n(Gunakan gambar referensi yang dilampirkan sebagai acuan utama).`;
      }
    }

    try {
      let finalOutput = '';
      await runExternalAIStream(
        activeConfig,
        'Kamu adalah Miu AI, asisten belajar mahasiswa yang ringkas, akurat, ramah, dan suportif dalam Bahasa Indonesia. Gunakan struktur Markdown yang bersih (## Subjudul, - Poin Bullet, 1. Poin Nomor, **Tebal** untuk istilah penting, dan $...$ atau $$...$$ untuk rumus LaTeX). Jangan tampilkan tag <think>.',
        userPrompt,
        (chunk) => {
          finalOutput = chunk;
          setResponseText(chunk);
        },
        attachedImageUrl
      );

      if (finalOutput.trim()) {
        const promptTitle =
          mode === 'summarize'
            ? 'Ringkasan Catatan'
            : mode === 'quiz'
              ? 'Kuis & Flashcard'
              : mode === 'breakdown'
                ? 'Breakdown Pomodoro'
                : mode === 'explain'
                  ? aiPdfAttachment
                    ? `Penjelasan PDF: ${aiPdfAttachment.fileName}`
                    : 'Penjelasan Materi'
                  : customPrompt.trim() ||
                    (aiPdfAttachment ? `Analisis PDF: ${aiPdfAttachment.fileName}` : 'Tanya AI');

        const newItem = {
          id: `chat-${Date.now()}`,
          title: promptTitle.slice(0, 70),
          response: finalOutput,
          model: activeConfig.model,
          createdAt: Date.now()
        };
        persistChatHistory([newItem, ...chatHistory].slice(0, 20));
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menghubungi AI Provider.');
    } finally {
      setLoading(false);
    }
  };

  const handleInsertStructuredBlocks = async () => {
    const parsedBlocks = parseMarkdownToNotionBlocks(responseText);
    if (parsedBlocks.length === 0) return;
    await insertBlocksIntoActiveNote(parsedBlocks);
    setInsertedSuccess(true);
    window.setTimeout(() => setInsertedSuccess(false), 2600);
  };

  const handleCopyResponse = async () => {
    const cleaned = cleanThinkingTags(responseText);
    if (!cleaned) return;
    await navigator.clipboard.writeText(cleaned);
    setCopiedResponse(true);
    window.setTimeout(() => setCopiedResponse(false), 2000);
  };

  const handleAddBreakdownTodos = async () => {
    const cleaned = cleanThinkingTags(responseText);
    const lines = cleaned
      .split('\n')
      .map((l) => stripInlineMarkdown(l.replace(/^[-*•\d.)\[\]xX#\s]+/, '')))
      .filter((l) => l.length > 6)
      .slice(0, 6);

    for (const line of lines) {
      await db.todos.add({
        id: `todo-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        courseId: activeCourseId,
        noteId: activeNoteId,
        text: line.slice(0, 120),
        completed: false,
        targetPomodoros: 1,
        completedPomodoros: 0,
        createdAt: Date.now()
      });
    }
    setTodosAddedSuccess(true);
    window.setTimeout(() => setTodosAddedSuccess(false), 2400);
  };

  const drawerWidthClass = isExpandedWidth
    ? 'w-full sm:w-[500px] lg:w-[580px]'
    : 'w-full sm:w-[400px]';

  const activePresetMeta =
    CUSTOM_PROVIDER_PRESETS.find((p) => p.id === customConfig.provider) ||
    CUSTOM_PROVIDER_PRESETS[0];

  return (
    <aside
      className={`${drawerWidthClass} shrink-0 h-screen sticky top-0 overflow-y-auto border-l border-border-subtle bg-subtle/45 p-4 flex flex-col gap-3 no-print transition-all duration-200`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-sky-400 text-white flex items-center justify-center shadow-sm shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-text-primary leading-tight truncate">
              Asisten AI Miu
            </h3>
            <p className="text-[10px] font-mono text-text-secondary flex items-center gap-1 mt-0.5 truncate">
              {aiTab === 'groq' ? (
                <>
                  <Zap className="w-3 h-3 text-amber-500 shrink-0" />
                  <span className="truncate">{defaultGroqConfig.model}</span>
                </>
              ) : (
                <>
                  <Wrench className="w-3 h-3 text-sky-400 shrink-0" />
                  <span className="truncate">
                    {activePresetMeta.label} • {customConfig.model}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setIsExpandedWidth((v) => !v)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-surface border border-border-subtle hover:border-accent-strong text-[10px] font-medium text-text-secondary hover:text-text-primary transition"
            title={isExpandedWidth ? 'Ukuran Normal' : 'Perlebar Panel Baca AI'}
          >
            {isExpandedWidth ? (
              <>
                <Minimize2 className="w-3 h-3" />
                <span>Normal</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3 h-3" />
                <span>Perlebar</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => setIsAIDrawerOpen(false)}
            className="p-1.5 rounded-lg hover:bg-subtle text-text-secondary hover:text-text-primary transition"
            aria-label="Tutup panel AI"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mode Switcher: Default Groq AI vs AI Provider Custom */}
      <div className="flex items-center gap-1 bg-surface border border-border-subtle p-1 rounded-xl shrink-0">
        <button
          type="button"
          onClick={() => setAiTab('groq')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
            aiTab === 'groq'
              ? 'bg-accent-strong text-white dark:text-slate-950 shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          ⚡ Groq AI
        </button>
        <button
          type="button"
          onClick={() => setAiTab('custom')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
            aiTab === 'custom'
              ? 'bg-accent-strong text-white dark:text-slate-950 shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          🔧 AI Provider Custom
        </button>
      </div>

      {/* Interaction Mode: Text Chat vs ElevenLabs Voice Conversational AI */}
      <div className="flex items-center gap-1 bg-subtle/80 border border-border-subtle p-1 rounded-xl shrink-0">
        <button
          type="button"
          onClick={() => setInteractionMode('text')}
          className={`flex-1 py-1 rounded-lg text-[11px] font-semibold inline-flex items-center justify-center gap-1.5 transition ${
            interactionMode === 'text'
              ? 'bg-surface text-text-primary shadow-sm border border-border-subtle'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          <MessageSquare className="w-3 h-3" />
          <span>Chat &amp; Ringkas</span>
        </button>
        <button
          type="button"
          onClick={() => setInteractionMode('voice')}
          className={`flex-1 py-1 rounded-lg text-[11px] font-semibold inline-flex items-center justify-center gap-1.5 transition ${
            interactionMode === 'voice'
              ? 'bg-gradient-to-r from-indigo-500/20 to-sky-500/20 text-accent-strong border border-accent-strong/40 shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          <AudioLines className="w-3 h-3" />
          <span>Conversational AI (ElevenLabs)</span>
        </button>
      </div>

      {/* Live Note Context Sync Indicator */}
      {activeNote && (
        <div
          className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl border text-[10px] transition shrink-0 ${
            contextJustUpdated
              ? 'bg-emerald-500/10 border-emerald-500/35 text-emerald-600 dark:text-emerald-300'
              : 'bg-surface/70 border-border-subtle text-text-secondary'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <RefreshCw
              className={`w-3 h-3 shrink-0 ${
                contextJustUpdated ? 'animate-spin text-emerald-500' : 'text-emerald-500'
              }`}
            />
            <span className="truncate font-medium">
              Konteks Live:{' '}
              <strong className="text-text-primary">
                {activeNote.title || 'Tanpa Judul'}
              </strong>{' '}
              ({activeNote.blocks.length} blok)
            </span>
          </div>
          <span className="font-mono opacity-80 shrink-0">
            {contextJustUpdated
              ? 'Tersinkron'
              : new Date(activeNote.updatedAt).toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
          </span>
        </div>
      )}

      {/* Neat Collapsible Custom AI Provider Bar & Settings Card */}
      {aiTab === 'custom' && (
        <div className="bg-surface border border-border-subtle rounded-2xl overflow-hidden shrink-0 shadow-sm">
          {/* Compact Summary Bar (Always visible on Custom tab) */}
          <button
            type="button"
            onClick={() => setShowCustomSettings((v) => !v)}
            className="w-full px-3 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-subtle/50 transition"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  isCustomReady ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
                }`}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-text-primary truncate">
                    {activePresetMeta.label}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-subtle text-accent-strong truncate max-w-[160px]">
                    {customConfig.model || 'Pilih model'}
                  </span>
                </div>
                <p className="text-[10px] text-text-secondary truncate">
                  {isCustomReady
                    ? 'Provider aktif & siap digunakan'
                    : 'Klik untuk memasukkan API Key & Model'}
                </p>
              </div>
            </div>

            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-subtle text-[10px] font-semibold text-text-secondary shrink-0">
              <Settings2 className="w-3 h-3" />
              <span>{showCustomSettings ? 'Tutup' : 'Atur'}</span>
              {showCustomSettings ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </span>
          </button>

          {/* Collapsible Configuration Form */}
          {showCustomSettings && (
            <div className="p-3 pt-2 border-t border-border-subtle space-y-2.5 bg-subtle/20">
              <div className="grid grid-cols-3 gap-1.5">
                {CUSTOM_PROVIDER_PRESETS.map((p) => {
                  const active = customConfig.provider === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        setCustomConfig((prev) => ({
                          ...prev,
                          provider: p.id,
                          model: DEFAULT_MODELS[p.id],
                          baseUrl: DEFAULT_BASE_URLS[p.id]
                        }))
                      }
                      className={`p-2 rounded-xl text-left border transition ${
                        active
                          ? 'bg-accent-strong/15 border-accent-strong text-accent-strong shadow-sm'
                          : 'bg-surface border-border-subtle text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      <div className="text-[11px] font-bold truncate">{p.label}</div>
                      <div className="text-[9px] opacity-75 truncate">{p.shortDesc}</div>
                    </button>
                  );
                })}
              </div>

              {customConfig.provider === 'ollama' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-semibold text-text-secondary">
                      Ollama Local URL
                    </label>
                    <input
                      type="text"
                      value={customConfig.ollamaUrl}
                      onChange={(e) =>
                        setCustomConfig((prev) => ({ ...prev, ollamaUrl: e.target.value }))
                      }
                      placeholder="http://localhost:11434"
                      className="w-full bg-surface border border-border-subtle rounded-xl px-2.5 py-1.5 font-mono text-[11px] text-text-primary focus:outline-none focus:border-accent-strong"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-semibold text-text-secondary">
                      Nama Model Ollama
                    </label>
                    <input
                      type="text"
                      value={customConfig.model}
                      onChange={(e) =>
                        setCustomConfig((prev) => ({ ...prev, model: e.target.value }))
                      }
                      placeholder="llama3.2"
                      className="w-full bg-surface border border-border-subtle rounded-xl px-2.5 py-1.5 font-mono text-[11px] text-text-primary focus:outline-none focus:border-accent-strong"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {(customConfig.provider === 'custom' ||
                    customConfig.provider === 'openrouter' ||
                    customConfig.provider === 'openai') && (
                    <div className="space-y-1">
                      <label className="block text-[10px] font-semibold text-text-secondary">
                        Base URL / Endpoint (OpenAI-Compatible)
                      </label>
                      <input
                        type="text"
                        value={customConfig.baseUrl || ''}
                        onChange={(e) =>
                          setCustomConfig((prev) => ({ ...prev, baseUrl: e.target.value }))
                        }
                        placeholder="https://api.openai.com/v1/chat/completions"
                        className="w-full bg-surface border border-border-subtle rounded-xl px-2.5 py-1.5 font-mono text-[11px] text-text-primary focus:outline-none focus:border-accent-strong"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-semibold text-text-secondary">
                        API Key ({activePresetMeta.label})
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type={showKey ? 'text' : 'password'}
                          value={customConfig.apiKey}
                          onChange={(e) =>
                            setCustomConfig((prev) => ({ ...prev, apiKey: e.target.value }))
                          }
                          placeholder="sk-... / AIzaSy..."
                          className="w-full bg-surface border border-border-subtle rounded-xl pl-2.5 pr-7 py-1.5 font-mono text-[11px] text-text-primary focus:outline-none focus:border-accent-strong"
                        />
                        <button
                          type="button"
                          onClick={() => setShowKey((v) => !v)}
                          className="absolute right-2 text-text-secondary hover:text-text-primary"
                          aria-label="Tampilkan API Key"
                        >
                          {showKey ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-semibold text-text-secondary">
                        Nama Model
                      </label>
                      <input
                        type="text"
                        value={customConfig.model}
                        onChange={(e) =>
                          setCustomConfig((prev) => ({ ...prev, model: e.target.value }))
                        }
                        placeholder="gpt-4o-mini / gemini-2.5-flash"
                        className="w-full bg-surface border border-border-subtle rounded-xl px-2.5 py-1.5 font-mono text-[11px] text-text-primary focus:outline-none focus:border-accent-strong"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-0.5">
                <button
                  type="button"
                  onClick={() => setShowCustomSettings(false)}
                  className="px-3 py-1 rounded-lg bg-accent-strong text-white dark:text-slate-950 text-[11px] font-semibold hover:opacity-90 transition"
                >
                  Simpan &amp; Sembunyikan
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4 Academic Quick Action Chips (Text mode only) */}
      {interactionMode === 'text' && (
      <div className="grid grid-cols-2 gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => void executePrompt('summarize')}
          disabled={loading}
          className="px-2.5 py-2 rounded-xl bg-surface hover:border-accent-strong border border-border-subtle text-[11px] font-medium text-text-primary text-left transition"
        >
          ✨ Ringkas Catatan
        </button>
        <button
          type="button"
          onClick={() => void executePrompt('quiz')}
          disabled={loading}
          className="px-2.5 py-2 rounded-xl bg-surface hover:border-accent-strong border border-border-subtle text-[11px] font-medium text-text-primary text-left transition"
        >
          🎴 Buat Kuis &amp; Flashcard
        </button>
        <button
          type="button"
          onClick={() => void executePrompt('breakdown')}
          disabled={loading}
          className="px-2.5 py-2 rounded-xl bg-surface hover:border-accent-strong border border-border-subtle text-[11px] font-medium text-text-primary text-left transition"
        >
          🍅 Pecah ke Pomodoro
        </button>
        <button
          type="button"
          onClick={() => void executePrompt('explain')}
          disabled={loading}
          className="px-2.5 py-2 rounded-xl bg-surface hover:border-accent-strong border border-border-subtle text-[11px] font-medium text-text-primary text-left transition"
        >
          💡{' '}
          {aiPdfAttachment
            ? 'Jelaskan PDF'
            : aiImageAttachment
              ? 'Jelaskan Gambar'
              : 'Jelaskan Materi'}
        </button>
      </div>
      )}

      {/* Quick Picker for PDFs from the Active Note */}
      {notePdfs.length > 0 && !aiPdfAttachment && (
        <div className="space-y-1 shrink-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
            Pilih PDF dari Catatan:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {notePdfs.map((pdfBlk, i) => (
              <button
                key={pdfBlk.id}
                type="button"
                onClick={() =>
                  setAiPdfAttachment({
                    fileName: pdfBlk.fileName || pdfBlk.caption || `Dokumen_${i + 1}.pdf`,
                    text: pdfBlk.pdfText || '',
                    pages: pdfBlk.pdfPages || 1,
                    url: pdfBlk.content
                  })
                }
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-surface border border-border-subtle hover:border-accent-strong text-xs font-medium text-text-primary transition"
              >
                <FileText className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span className="truncate max-w-[180px]">
                  {pdfBlk.fileName || pdfBlk.caption || `PDF ${i + 1}`}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Compact PDF Reference Card */}
      {aiPdfAttachment && (
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-2xl bg-rose-500/10 border border-rose-400/35 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-500 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-600 dark:text-rose-300 font-semibold">
                PDF • {aiPdfAttachment.pages} hal
              </span>
              <p className="text-xs font-semibold text-text-primary truncate">
                {aiPdfAttachment.fileName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAiPdfAttachment(null)}
            className="p-1 rounded-full hover:bg-subtle text-text-secondary hover:text-text-primary shrink-0"
            title="Hapus referensi PDF"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Quick Picker for Images from the Active Note */}
      {noteImages.length > 0 && !aiImageAttachment && (
        <div className="space-y-1 shrink-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
            Pilih Gambar dari Catatan:
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {noteImages.map((imgBlk, i) => (
              <button
                key={imgBlk.id}
                type="button"
                onClick={() =>
                  setAiImageAttachment({
                    url: imgBlk.content,
                    caption: imgBlk.caption || `Gambar ${i + 1}`
                  })
                }
                className="group relative w-12 h-12 rounded-xl overflow-hidden border border-border-subtle hover:border-accent-strong shrink-0 transition"
                title="Klik untuk jadikan referensi gambar AI"
              >
                <img
                  src={imgBlk.content}
                  alt={imgBlk.caption || 'Gambar Catatan'}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Visual Image Reference Card */}
      {aiImageAttachment && (
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-2xl bg-indigo-500/10 border border-indigo-400/35 shrink-0">
          <img
            src={aiImageAttachment.url}
            alt={aiImageAttachment.caption || 'Referensi Gambar'}
            className="w-10 h-10 rounded-xl object-cover border border-white/15 shrink-0 bg-slate-950"
          />
          <div className="min-w-0 flex-1">
            <span className="inline-block text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 font-semibold">
              Referensi Gambar
            </span>
            <p className="text-xs font-semibold text-text-primary truncate mt-0.5">
              {aiImageAttachment.caption || 'Gambar Catatan'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAiImageAttachment(null)}
            className="p-1 rounded-full hover:bg-subtle text-text-secondary hover:text-text-primary shrink-0"
            title="Hapus referensi gambar"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {interactionMode === 'voice' ? (
        <ConversationalVoicePanel
          activeNote={activeNote}
          aiTab={aiTab}
          activeConfig={activeConfig}
          activeProviderLabel={activePresetMeta.label}
          aiPdfAttachment={aiPdfAttachment}
          aiImageAttachment={aiImageAttachment}
          onInsertBlocks={insertBlocksIntoActiveNote}
        />
      ) : (
        <>
      {/* Interactive Study Flashcard Preview when Note-to-Quiz is triggered */}
      {showQuizCards && (
        <button
          type="button"
          onClick={() => setFlashcardFlipped((v) => !v)}
          className="w-full text-left p-3 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-sky-500/10 border border-indigo-400/30 transition shrink-0"
        >
          <div className="flex items-center justify-between text-[10px] font-mono uppercase text-indigo-500 dark:text-indigo-300 mb-1">
            <span>Flashcard Interaktif</span>
            <span>Klik untuk balik</span>
          </div>
          <p className="text-xs font-semibold text-text-primary">
            {flashcardFlipped
              ? 'Jawaban telah disiapkan di respons AI di bawah!'
              : `Apa poin utama dari catatan "${activeNote?.title || 'Tanpa Judul'}"?`}
          </p>
        </button>
      )}

      {/* Custom Prompt Input + Direct Image & PDF Attachment Buttons */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void executePrompt('custom');
        }}
        className="flex gap-1.5 items-stretch shrink-0"
      >
        <div className="flex-1 relative flex items-center bg-surface border border-border-subtle rounded-xl focus-within:border-accent-strong">
          <textarea
            rows={2}
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void executePrompt('custom');
              }
            }}
            placeholder={
              aiPdfAttachment
                ? `Tanyakan tentang isi "${aiPdfAttachment.fileName}"...`
                : aiImageAttachment
                  ? 'Tanyakan sesuatu tentang gambar di atas...'
                  : 'Tanya ke AI atau lampirkan Gambar/PDF...'
            }
            className="w-full bg-transparent pl-3 pr-14 py-2 text-xs text-text-primary focus:outline-none resize-none"
          />
          <div className="absolute right-1.5 bottom-1.5 flex items-center gap-0.5">
            <label
              className="p-1 rounded-lg hover:bg-subtle text-text-secondary hover:text-rose-500 cursor-pointer transition"
              title="Unggah & baca file PDF dengan AI"
            >
              <FileText className="w-4 h-4" />
              <input
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleUploadReferencePdf(f);
                }}
              />
            </label>
            <label
              className="p-1 rounded-lg hover:bg-subtle text-text-secondary hover:text-accent-strong cursor-pointer transition"
              title="Lampirkan gambar untuk ditanyakan ke AI"
            >
              {uploadingRef ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ImagePlus className="w-4 h-4" />
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleUploadReferenceImage(f);
                }}
              />
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="px-3.5 rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 text-white flex items-center justify-center hover:opacity-90 disabled:opacity-60"
          aria-label="Kirim ke AI"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </form>

      {/* Spacious Streaming Response Area (Never squished!) */}
      {(responseText || errorMsg || loading) && (
        <div className="bg-surface border border-border-subtle rounded-2xl p-4 space-y-3 flex-1 flex flex-col min-h-[380px] shadow-sm">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-border-subtle shrink-0">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-text-primary truncate">
              <BrainCircuit className="w-4 h-4 text-indigo-500 shrink-0" />
              <span className="truncate">Respons AI ({activeConfig.model})</span>
            </span>
            {loading ? (
              <span className="inline-flex items-center gap-1 font-mono text-[10px] text-sky-500 shrink-0">
                <Loader2 className="w-3 h-3 animate-spin" />
                Streaming...
              </span>
            ) : (
              responseText && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => void handleCopyResponse()}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-subtle text-[10px] font-medium text-text-secondary hover:text-text-primary transition"
                  >
                    {copiedResponse ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-500" />
                        <span className="text-emerald-500">Tersalin</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Salin</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setResponseText('');
                      setErrorMsg('');
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/10 text-[10px] font-medium text-rose-500 hover:bg-rose-500/20 transition"
                    title="Bersihkan / tutup respons ini"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Bersihkan</span>
                  </button>
                </div>
              )
            )}
          </div>

          {errorMsg ? (
            <p className="text-xs text-rose-500 leading-relaxed">{errorMsg}</p>
          ) : (
            <div className="overflow-y-auto flex-1 pr-1">
              <MarkdownView content={responseText} />
            </div>
          )}

          {responseText && !loading && (
            <div className="flex flex-wrap items-center gap-2 pt-2.5 border-t border-border-subtle shrink-0">
              <button
                type="button"
                onClick={() => void handleInsertStructuredBlocks()}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  insertedSuccess
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'bg-accent-strong text-white dark:text-slate-950 hover:opacity-95 shadow-sm'
                }`}
              >
                {insertedSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Tersisip Rapi di Catatan!</span>
                  </>
                ) : (
                  <>
                    <ArrowRightToLine className="w-3.5 h-3.5" />
                    <span>Sisip ke Catatan</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => void handleAddBreakdownTodos()}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-subtle border border-border-subtle text-xs font-medium text-text-primary hover:border-accent-strong transition"
              >
                {todosAddedSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-500">Masuk ke To-do!</span>
                  </>
                ) : (
                  <>
                    <ListTodo className="w-3.5 h-3.5" />
                    <span>Jadikan To-do</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Saved AI Conversations on This Note (Select & Delete) */}
      {chatHistory.length > 0 && (
        <div className="bg-surface border border-border-subtle rounded-2xl p-3 space-y-2 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-text-primary">
              Riwayat Percakapan ({chatHistory.length})
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  const next = !isChatSelectMode;
                  setIsChatSelectMode(next);
                  if (!next) setSelectedChatIds([]);
                }}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold transition ${
                  isChatSelectMode || selectedChatIds.length > 0
                    ? 'bg-rose-500/15 text-rose-500'
                    : 'bg-subtle text-text-secondary hover:text-text-primary'
                }`}
              >
                <CheckSquare className="w-3 h-3" />
                <span>{isChatSelectMode ? 'Batal Pilih' : 'Pilih & Hapus'}</span>
              </button>
            </div>
          </div>

          {(isChatSelectMode || selectedChatIds.length > 0) && (
            <div className="flex items-center justify-between gap-1.5 p-2 rounded-xl bg-rose-500/10 border border-rose-400/30">
              <button
                type="button"
                onClick={() => {
                  if (selectedChatIds.length === chatHistory.length) {
                    setSelectedChatIds([]);
                  } else {
                    setSelectedChatIds(chatHistory.map((c) => c.id));
                  }
                }}
                className="text-[10px] font-semibold text-text-primary hover:underline"
              >
                {selectedChatIds.length === chatHistory.length
                  ? 'Batal Pilih Semua'
                  : 'Pilih Semua'}
              </button>
              <button
                type="button"
                disabled={selectedChatIds.length === 0}
                onClick={() => {
                  const selectedSet = new Set(selectedChatIds);
                  const remaining = chatHistory.filter((c) => !selectedSet.has(c.id));
                  persistChatHistory(remaining);
                  setSelectedChatIds([]);
                  setIsChatSelectMode(false);
                  if (remaining.length === 0) {
                    setResponseText('');
                  }
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500 hover:bg-rose-600 disabled:opacity-40 text-white text-[10px] font-semibold transition"
              >
                <Trash2 className="w-3 h-3" />
                <span>Hapus Terpilih ({selectedChatIds.length})</span>
              </button>
            </div>
          )}

          <div className="max-h-40 overflow-y-auto space-y-1 pr-0.5">
            {chatHistory.map((item) => {
              const isChecked = selectedChatIds.includes(item.id);
              const isActive = responseText === item.response;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    if (isChatSelectMode) {
                      setSelectedChatIds((prev) =>
                        prev.includes(item.id)
                          ? prev.filter((id) => id !== item.id)
                          : [...prev, item.id]
                      );
                    } else {
                      setResponseText(item.response);
                    }
                  }}
                  className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl border text-xs cursor-pointer transition ${
                    isChecked
                      ? 'bg-rose-500/15 border-rose-400/40'
                      : isActive
                        ? 'bg-accent-strong/10 border-accent-strong/40 font-semibold'
                        : 'bg-subtle/40 border-border-subtle hover:bg-subtle'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {(isChatSelectMode || selectedChatIds.length > 0) && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedChatIds((prev) =>
                            prev.includes(item.id)
                              ? prev.filter((id) => id !== item.id)
                              : [...prev, item.id]
                          );
                        }}
                        className={`w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0 ${
                          isChecked
                            ? 'bg-rose-500 border-rose-500 text-white'
                            : 'border-text-secondary/40 bg-surface'
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </span>
                    )}
                    <span className="truncate text-text-primary">{item.title}</span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const remaining = chatHistory.filter((c) => c.id !== item.id);
                      persistChatHistory(remaining);
                      setSelectedChatIds((prev) => prev.filter((id) => id !== item.id));
                      if (responseText === item.response) {
                        setResponseText(remaining[0]?.response || '');
                      }
                    }}
                    className="p-1 rounded hover:bg-rose-500/15 text-text-secondary hover:text-rose-500 shrink-0"
                    title="Hapus percakapan ini"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!responseText && !errorMsg && !loading && chatHistory.length === 0 && (
        <div className="text-[11px] text-text-secondary bg-surface/60 border border-dashed border-border-subtle rounded-2xl p-3 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
          <span>
            Gunakan <strong>⚡ Groq AI</strong> bawaan atau pindah ke tab{' '}
            <strong>🔧 AI Provider Custom</strong> untuk memasukkan Endpoint, API Key, dan Model
            pilihanmu sendiri.
          </span>
        </div>
      )}
        </>
      )}
    </aside>
  );
};
