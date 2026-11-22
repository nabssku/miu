'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  AlignLeft,
  ArrowLeft,
  ArrowRightToLine,
  ArrowUp,
  AudioLines,
  BookOpen,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ChevronsRight,
  ChevronUp,
  CloudUpload,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  FileCode2,
  FileText,
  Globe,
  ImagePlus,
  Languages,
  LayoutGrid,
  Link2,
  ListTodo,
  Loader2,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Square,
  SquarePen,
  Trash2,
  Wrench,
  X
} from 'lucide-react';
import { ConversationalVoicePanel } from './ConversationalVoicePanel';
import { MiuAIFaceIcon } from './MiuAIFaceIcon';
import { db } from '../../db/database';
import { useMiu } from '../../context/MiuContext';
import { flattenBlocks } from '../../utils/blockTreeHelper';
import { syncCloudStatus, uploadImageToCloudinary } from '../../services/cloudServices';
import {
  buildLiveNoteContext,
  DEFAULT_BASE_URLS,
  DEFAULT_MODELS,
  getMiuFreeModelLabel,
  loadAIConfig,
  loadDefaultGroqConfig,
  loadSelectedMiuFreeModel,
  MIU_FREE_MODELS,
  saveAIConfig,
  saveSelectedMiuFreeModel,
  type AIConfig
} from '../../services/externalApis';
import {
  countActiveConnections,
  createEditableSkillNote,
  DEFAULT_AI_CONNECTIONS_CONFIG,
  isSkillNote,
  loadActiveSkillNoteIds,
  loadAIConnectionsConfig,
  runAgentWithToolsStream,
  saveActiveSkillNoteIds,
  saveAIConnectionsConfig,
  type AIConnectionsConfig
} from '../../services/aiAgentTools';
import type { AIChatMessage, AIProviderId } from '../../types/miu';
import {
  cleanThinkingTags,
  MarkdownView,
  parseMarkdownToNotionBlocks,
  stripInlineMarkdown
} from '../../utils/markdown';
import { extractTextFromPdfSource, processAndUploadPdf } from '../../utils/pdfHelper';
import {
  normalizeStoredAIChatThreads,
  type AIChatThread,
  type AIChatThreadMessage,
  type AIToolExecutionRecord
} from '../../utils/aiChatHistory';

type PromptMode =
  | 'summarize'
  | 'translate'
  | 'insights'
  | 'breakdown'
  | 'agenda'
  | 'quiz'
  | 'explain'
  | 'custom';

type OpenMenuType =
  | 'none'
  | 'history'
  | 'more'
  | 'attach'
  | 'attach_files'
  | 'skills'
  | 'connections'
  | 'context'
  | 'model';

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
    currentUser,
    activeSemesterId,
    activeNoteId,
    setActiveNoteId,
    activeCourseId,
    isAIDrawerOpen,
    setIsAIDrawerOpen,
    islandPosition,
    aiExplainDraft,
    setAiExplainDraft,
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
  const [defaultGroqConfig, setDefaultGroqConfig] = useState<AIConfig>(() =>
    loadDefaultGroqConfig()
  );
  const [customConfig, setCustomConfig] = useState<AIConfig>({
    provider: 'custom',
    apiKey: '',
    model: 'gpt-4o-mini',
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    ollamaUrl: 'http://localhost:11434'
  });
  const [configHydrated, setConfigHydrated] = useState(false);
  const [showProviderSheet, setShowProviderSheet] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [isExpandedWidth, setIsExpandedWidth] = useState(false);
  const [includeNoteContext, setIncludeNoteContext] = useState(true);

  // Tool Calling, Web Tool, Skills (skill.md) & External Connections
  const [connectionsConfig, setConnectionsConfig] = useState<AIConnectionsConfig>(
    () => DEFAULT_AI_CONNECTIONS_CONFIG
  );
  const [activeSkillIds, setActiveSkillIds] = useState<string[]>([]);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillConnUrl, setNewSkillConnUrl] = useState('');
  const [newConnName, setNewConnName] = useState('');
  const [newConnUrl, setNewConnUrl] = useState('');
  const [newConnMethod, setNewConnMethod] = useState<'GET' | 'POST'>('POST');
  const [newConnAuth, setNewConnAuth] = useState('');

  const openPustakaInMainPage = (subTab: 'active' | 'discover' | 'upload' = 'discover') => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('miu:open-pustaka-page', { detail: { subTab } })
      );
    }
  };

  const [openMenu, setOpenMenu] = useState<OpenMenuType>('none');
  const [customPrompt, setCustomPrompt] = useState('');
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AIChatThreadMessage[]>([]);
  const [chatThreads, setChatThreads] = useState<AIChatThread[]>([]);
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([]);
  const [isChatSelectMode, setIsChatSelectMode] = useState(false);

  const [loading, setLoading] = useState(false);
  const [uploadingRef, setUploadingRef] = useState(false);
  const [pdfProgressMsg, setPdfProgressMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [insertedMsgId, setInsertedMsgId] = useState<string | null>(null);
  const [todosMsgId, setTodosMsgId] = useState<string | null>(null);
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);
  const [showQuizCards, setShowQuizCards] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isAgentRunningRef = useRef(false);
  const agentSwitchedNoteIdRef = useRef<string | null>(null);

  useEffect(() => {
    const saved = loadAIConfig();
    setCustomConfig(saved);
    setConnectionsConfig(loadAIConnectionsConfig());
    setActiveSkillIds(loadActiveSkillNoteIds());
    setConfigHydrated(true);
    void syncCloudStatus().then((status) => {
      if (status.aiModel) {
        setDefaultGroqConfig(loadDefaultGroqConfig(status.aiModel));
      }
    });
  }, []);

  useEffect(() => {
    if (!configHydrated) return;
    saveAIConfig(customConfig);
  }, [customConfig, configHydrated]);

  useEffect(() => {
    if (!configHydrated) return;
    saveAIConnectionsConfig(connectionsConfig);
  }, [connectionsConfig, configHydrated]);

  useEffect(() => {
    if (!configHydrated) return;
    saveActiveSkillNoteIds(activeSkillIds);
  }, [activeSkillIds, configHydrated]);

  useEffect(() => {
    if (aiPdfAttachment) {
      setIsExpandedWidth(true);
    }
  }, [aiPdfAttachment]);

  // Load saved threads per note and restore active thread if reopened
  useEffect(() => {
    if (isAgentRunningRef.current) {
      return;
    }
    if (
      agentSwitchedNoteIdRef.current &&
      agentSwitchedNoteIdRef.current === activeNoteId
    ) {
      agentSwitchedNoteIdRef.current = null;
      return;
    }
    try {
      const raw = localStorage.getItem(`miu_ai_chats_${activeNoteId}`);
      const normalized = normalizeStoredAIChatThreads(raw ? JSON.parse(raw) : []);
      setChatThreads(normalized);

      const savedActiveId = sessionStorage.getItem(`miu_ai_active_thread_${activeNoteId}`);
      const matched = savedActiveId ? normalized.find((t) => t.id === savedActiveId) : undefined;
      if (matched) {
        setActiveThreadId(matched.id);
        setMessages(matched.messages);
      } else {
        setActiveThreadId(null);
        setMessages([]);
      }
    } catch {
      setChatThreads([]);
      setActiveThreadId(null);
      setMessages([]);
    }
    setSelectedChatIds([]);
    setIsChatSelectMode(false);
    setErrorMsg('');
    setShowQuizCards(false);
  }, [activeNoteId]);

  const persistChatThreads = (
    next: AIChatThread[],
    nextActiveId: string | null,
    targetNoteId: string = activeNoteId
  ) => {
    const trimmed = next.slice(0, 25);
    setChatThreads(trimmed);
    try {
      localStorage.setItem(`miu_ai_chats_${targetNoteId}`, JSON.stringify(trimmed));
      if (nextActiveId) {
        sessionStorage.setItem(`miu_ai_active_thread_${targetNoteId}`, nextActiveId);
      } else {
        sessionStorage.removeItem(`miu_ai_active_thread_${targetNoteId}`);
      }
    } catch {
      // ignore storage quota errors
    }
  };

  const persistThreadToTargetNote = (
    targetNoteId: string,
    thread: AIChatThread
  ) => {
    if (!targetNoteId) return;
    try {
      const raw = localStorage.getItem(`miu_ai_chats_${targetNoteId}`);
      const existing = normalizeStoredAIChatThreads(raw ? JSON.parse(raw) : []);
      const merged = [thread, ...existing.filter((t) => t.id !== thread.id)].slice(0, 25);
      localStorage.setItem(`miu_ai_chats_${targetNoteId}`, JSON.stringify(merged));
      sessionStorage.setItem(`miu_ai_active_thread_${targetNoteId}`, thread.id);
      setChatThreads(merged);
    } catch {
      // ignore storage quota errors
    }
  };

  // Close popovers on outside click or Escape
  useEffect(() => {
    if (openMenu === 'none') return;
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-ai-popover]')) return;
      setOpenMenu('none');
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenu('none');
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [openMenu]);

  // Handle inline "Tanya AI" triggers from document blocks
  useEffect(() => {
    if (!aiExplainDraft) return;
    const draft = aiExplainDraft;
    setAiExplainDraft('');

    setInteractionMode('text');
    if (
      draft.startsWith('http://') ||
      draft.startsWith('https://') ||
      draft.startsWith('data:image/')
    ) {
      setAiImageAttachment({ url: draft, caption: 'Gambar Catatan' });
      setCustomPrompt('');
    } else {
      setActiveThreadId(null);
      setMessages([]);
      try {
        sessionStorage.removeItem(`miu_ai_active_thread_${activeNoteId}`);
      } catch {
        // ignore
      }
      const isAlreadyStructuredPrompt =
        draft.startsWith('Analisis ') ||
        draft.startsWith('Jelaskan ') ||
        draft.startsWith('Rangkum ');
      setCustomPrompt(
        isAlreadyStructuredPrompt
          ? draft
          : `Jelaskan konsep ini dengan bahasa mahasiswa yang mudah dipahami:\n"${draft}"`
      );
    }

    window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 60);
  }, [aiExplainDraft, activeNoteId, setAiExplainDraft, setAiImageAttachment]);

  // Auto-size prompt textarea cleanly up to ~5 lines
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 136)}px`;
  }, [customPrompt]);

  // Smooth auto-scroll strictly inside the AI chat scroll container (never scrolls outer window)
  useEffect(() => {
    if (messages.length > 0 || loading) {
      const container = chatScrollContainerRef.current;
      if (container) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: loading ? 'auto' : 'smooth'
        });
      }
    }
  }, [messages, loading]);

  if (!isAIDrawerOpen) return null;

  const activeConfig: AIConfig = aiTab === 'groq' ? defaultGroqConfig : customConfig;
  const isCustomReady =
    customConfig.provider === 'ollama'
      ? Boolean(customConfig.ollamaUrl.trim() && customConfig.model.trim())
      : Boolean(customConfig.apiKey.trim() && customConfig.model.trim());

  const flatBlocks = flattenBlocks(activeNote?.blocks);
  const noteImages = flatBlocks.filter((b) => b.type === 'image' && Boolean(b.content));
  const notePdfs = flatBlocks.filter((b) => b.type === 'pdf' && Boolean(b.content));

  const skillNotes = allNotes.filter(
    (n) => isSkillNote(n) || activeSkillIds.includes(n.id)
  );
  const activeSkillNotes = allNotes.filter((n) => activeSkillIds.includes(n.id));
  const activeConnectionCount = countActiveConnections(connectionsConfig);

  const activePresetMeta =
    CUSTOM_PROVIDER_PRESETS.find((p) => p.id === customConfig.provider) ||
    CUSTOM_PROVIDER_PRESETS[0];

  const activeThread = activeThreadId
    ? chatThreads.find((t) => t.id === activeThreadId)
    : undefined;

  const startNewChat = () => {
    abortControllerRef.current?.abort();
    setLoading(false);
    setActiveThreadId(null);
    setMessages([]);
    setErrorMsg('');
    setShowQuizCards(false);
    setFlashcardFlipped(false);
    setOpenMenu('none');
    try {
      sessionStorage.removeItem(`miu_ai_active_thread_${activeNoteId}`);
    } catch {
      // ignore
    }
    window.setTimeout(() => textareaRef.current?.focus(), 40);
  };

  const handleCreateNewSkillNote = async () => {
    const created = await createEditableSkillNote({
      skillName: newSkillName.trim() || 'skill.md',
      connectionUrl: newSkillConnUrl.trim() || undefined,
      ownerId: currentUser?.id,
      ownerEmail: currentUser?.email,
      ownerName: currentUser?.name,
      semesterId: activeSemesterId,
      courseId: activeCourseId
    });
    setActiveSkillIds((prev) => Array.from(new Set([...prev, created.id])));
    setActiveNoteId(created.id);
    setNewSkillName('');
    setNewSkillConnUrl('');
    setOpenMenu('none');
  };

  const handleToggleSkillActive = (noteId: string) => {
    setActiveSkillIds((prev) =>
      prev.includes(noteId) ? prev.filter((id) => id !== noteId) : [...prev, noteId]
    );
  };

  const handleAddCustomConnection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newConnName.trim() || !newConnUrl.trim()) return;
    const item = {
      id: `conn-${Date.now()}`,
      name: newConnName.trim(),
      url: newConnUrl.trim(),
      method: newConnMethod,
      authHeader: newConnAuth.trim() || undefined,
      enabled: true
    };
    setConnectionsConfig((prev) => ({
      ...prev,
      customConnections: [...prev.customConnections, item]
    }));
    setNewConnName('');
    setNewConnUrl('');
    setNewConnAuth('');
  };

  const handleUploadReferenceImage = async (file: File) => {
    setUploadingRef(true);
    setErrorMsg('');
    try {
      const { url } = await uploadImageToCloudinary(file);
      setAiImageAttachment({
        url,
        caption: file.name.replace(/\.[^/.]+$/, '') || 'Referensi Gambar'
      });
      setAiPdfAttachment(null);
      setOpenMenu('none');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal mengunggah referensi gambar.'
      );
    } finally {
      setUploadingRef(false);
    }
  };

  const handleUploadReferencePdf = async (file: File) => {
    setUploadingRef(true);
    setErrorMsg('');
    setPdfProgressMsg('Membaca file PDF...');
    setOpenMenu('none');
    try {
      const { url, fileName, text, pages } = await processAndUploadPdf(file, (msg) =>
        setPdfProgressMsg(msg)
      );
      setAiPdfAttachment({ fileName, text, pages, url });
      setAiImageAttachment(null);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal membaca file PDF yang dipilih.'
      );
    } finally {
      setUploadingRef(false);
      setPdfProgressMsg('');
    }
  };

  const handleAttachNotePdf = async (
    pdfBlk: (typeof notePdfs)[number],
    fallbackIndex: number
  ) => {
    const fileName =
      pdfBlk.fileName || pdfBlk.caption || `Dokumen_${fallbackIndex + 1}.pdf`;
    const rawText = (pdfBlk.pdfText || '').trim();
    const isFallbackOrEmpty =
      !rawText ||
      rawText.startsWith('Dokumen PDF "') ||
      rawText.startsWith('Tidak ada teks');

    setOpenMenu('none');
    setAiImageAttachment(null);
    if (!isFallbackOrEmpty || !pdfBlk.content) {
      setAiPdfAttachment({
        fileName,
        text: pdfBlk.pdfText || '',
        pages: pdfBlk.pdfPages || 1,
        url: pdfBlk.content
      });
      return;
    }

    setUploadingRef(true);
    setErrorMsg('');
    setPdfProgressMsg(`Membaca ulang "${fileName}"...`);
    try {
      const { text, pages } = await extractTextFromPdfSource(
        pdfBlk.content,
        fileName,
        (msg) => setPdfProgressMsg(msg)
      );
      setAiPdfAttachment({ fileName, text, pages, url: pdfBlk.content });
    } catch {
      setAiPdfAttachment({
        fileName,
        text: pdfBlk.pdfText || '',
        pages: pdfBlk.pdfPages || 1,
        url: pdfBlk.content
      });
    } finally {
      setUploadingRef(false);
      setPdfProgressMsg('');
    }
  };

  const handleReExtractAttachedPdf = async () => {
    if (!aiPdfAttachment?.url || uploadingRef) return;
    setUploadingRef(true);
    setErrorMsg('');
    setPdfProgressMsg(`Mengekstrak ulang "${aiPdfAttachment.fileName}"...`);
    try {
      const { text, pages } = await extractTextFromPdfSource(
        aiPdfAttachment.url,
        aiPdfAttachment.fileName,
        (msg) => setPdfProgressMsg(msg)
      );
      setAiPdfAttachment({
        ...aiPdfAttachment,
        text,
        pages
      });
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal membaca ulang isi PDF.'
      );
    } finally {
      setUploadingRef(false);
      setPdfProgressMsg('');
    }
  };

  const executePrompt = async (
    mode: PromptMode,
    overrideCustomText?: string,
    baseHistoryOverride?: AIChatThreadMessage[]
  ) => {
    if (!activeNote || loading) return;
    const rawQuery = (overrideCustomText ?? customPrompt).trim();
    if (
      mode === 'custom' &&
      !rawQuery &&
      !aiPdfAttachment &&
      !aiImageAttachment
    ) {
      return;
    }

    setOpenMenu('none');
    setShowProviderSheet(false);
    setErrorMsg('');
    setShowQuizCards(mode === 'quiz');
    setFlashcardFlipped(false);

    const priorMessages = baseHistoryOverride ?? messages;
    const historyForApi: AIChatMessage[] = priorMessages
      .filter((m) => m.content.trim().length > 0)
      .map((m) => ({ role: m.role, content: m.content }));

    const displayUserText =
      mode === 'summarize'
        ? 'Ringkas halaman ini'
        : mode === 'translate'
          ? 'Terjemahkan halaman ini'
          : mode === 'insights'
            ? 'Analisis untuk mendapatkan wawasan'
            : mode === 'breakdown'
              ? 'Buat pelacak tugas'
              : mode === 'agenda'
                ? 'Tulis agenda rapat'
                : mode === 'quiz'
                  ? 'Buat kuis & flashcard dari catatan ini'
                  : mode === 'explain' && !rawQuery
                    ? aiPdfAttachment
                      ? `Jelaskan dokumen PDF "${aiPdfAttachment.fileName}"`
                      : aiImageAttachment
                        ? `Jelaskan gambar "${aiImageAttachment.caption || 'referensi'}"`
                        : 'Jelaskan materi catatan ini dengan analogi sederhana'
                    : rawQuery ||
                      (aiPdfAttachment
                        ? `Rangkum isi dokumen "${aiPdfAttachment.fileName}"`
                        : `Jelaskan gambar "${aiImageAttachment?.caption || 'ini'}"`);

    const attachmentParts: string[] = [];
    if (aiPdfAttachment) attachmentParts.push(`PDF: ${aiPdfAttachment.fileName}`);
    if (aiImageAttachment) {
      attachmentParts.push(`Gambar: ${aiImageAttachment.caption || 'Catatan'}`);
    }
    if (activeSkillNotes.length > 0) {
      attachmentParts.push(
        `Skill: ${activeSkillNotes.map((s) => s.title || 'skill.md').join(', ')}`
      );
    }
    const attachmentLabel =
      attachmentParts.length > 0 ? attachmentParts.join(' • ') : undefined;

    if (mode === 'custom' && overrideCustomText === undefined) {
      setCustomPrompt('');
    }

    const now = Date.now();
    const userMsgId = `msg-u-${now}`;
    const assistantMsgId = `msg-a-${now + 1}`;
    const userMessage: AIChatThreadMessage = {
      id: userMsgId,
      role: 'user',
      content: displayUserText,
      attachmentLabel,
      createdAt: now
    };
    const placeholderAssistant: AIChatThreadMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      model: activeConfig.model,
      createdAt: now + 1
    };

    const threadId = activeThreadId || `chat-${now}`;
    const threadTitle =
      activeThread?.title ||
      displayUserText.replace(/\s+/g, ' ').slice(0, 64) ||
      'Obrolan AI';

    const optimisticMessages = [...priorMessages, userMessage, placeholderAssistant];
    setActiveThreadId(threadId);
    setMessages(optimisticMessages);
    setLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let noteContent = '';
    let attachedImageUrl = aiImageAttachment?.url;

    if (includeNoteContext || mode !== 'custom' || aiPdfAttachment) {
      const liveContext = await buildLiveNoteContext(
        activeNoteId || activeNote.id,
        activeNote,
        aiPdfAttachment,
        34000,
        mode === 'custom' || mode === 'explain' ? rawQuery : ''
      );
      if (includeNoteContext || mode !== 'custom') {
        noteContent = liveContext.contextText;
      }
      if (!attachedImageUrl && includeNoteContext) {
        attachedImageUrl = liveContext.noteImages[0]?.content;
      }
    }

    let userPrompt = rawQuery;
    let contextInUserPrompt = false;

    if (mode === 'summarize') {
      userPrompt = `Ringkas materi halaman catatan berikut menjadi poin-poin inti terstruktur (gunakan Heading ##, Bullet -, dan Bold **kata kunci**) dalam Bahasa Indonesia:\n\n${noteContent}`;
      contextInUserPrompt = true;
    } else if (mode === 'translate') {
      userPrompt = `Terjemahkan seluruh isi materi halaman catatan berikut secara akurat dengan mempertahankan struktur Heading, Bullet, dan Tabel Markdown. Jika konten dominan berbahasa Indonesia, terjemahkan ke Bahasa Inggris yang natural; jika dominan berbahasa Inggris/asing, terjemahkan ke Bahasa Indonesia yang natural:\n\n${noteContent}`;
      contextInUserPrompt = true;
    } else if (mode === 'insights') {
      userPrompt = `Analisis halaman catatan berikut untuk mendapatkan wawasan mendalam: soroti konsep kunci, hubungan antar bagian, potensi celah pemahaman/risiko yang perlu diperhatikan, serta rekomendasi langkah belajar berikutnya:\n\n${noteContent}`;
      contextInUserPrompt = true;
    } else if (mode === 'agenda') {
      userPrompt = `Susun agenda rapat terstruktur (Tujuan Rapat, Daftar Topik & Durasi, Poin Diskusi Utama, dan Action Items - [ ]) berdasarkan konteks catatan ini:\n\n${noteContent}`;
      contextInUserPrompt = true;
    } else if (mode === 'quiz') {
      userPrompt = `Buatkan 3 soal pilihan ganda latihan beserta kunci jawaban dan penjelasan singkat dari materi berikut:\n\n${noteContent}`;
      contextInUserPrompt = true;
    } else if (mode === 'breakdown') {
      userPrompt = `Buatkan pelacak tugas terstruktur dalam bentuk checklist To-do actionable (- [ ] ...) beserta prioritas dan estimasi sesi Pomodoro (🍅) berdasarkan isi halaman berikut:\n\n${noteContent}`;
      contextInUserPrompt = true;
    } else if (mode === 'explain') {
      if (aiPdfAttachment) {
        userPrompt = `Jelaskan secara terstruktur dan lengkap poin-poin penting dari dokumen PDF "${aiPdfAttachment.fileName}" berikut dengan bahasa mahasiswa yang mudah dipahami:\n\n${noteContent}`;
        contextInUserPrompt = true;
      } else if (aiImageAttachment) {
        userPrompt = `Jelaskan secara lengkap dan terstruktur isi dari gambar referensi ini (${
          aiImageAttachment.caption || 'Gambar Catatan'
        }) beserta kaitannya dengan catatan:\n\n${noteContent}`;
        contextInUserPrompt = true;
      } else if (!userPrompt) {
        userPrompt = `Jelaskan bagian tersulit atau rumus pada catatan ini menggunakan analogi sederhana:\n\n${noteContent}`;
        contextInUserPrompt = true;
      }
    } else if (mode === 'custom') {
      if (!userPrompt && aiPdfAttachment) {
        userPrompt = `Jelaskan dan rangkum isi dokumen PDF "${aiPdfAttachment.fileName}" secara lengkap dan terstruktur:\n\n${noteContent}`;
        contextInUserPrompt = true;
      } else if (!userPrompt && aiImageAttachment) {
        userPrompt = `Jelaskan isi gambar referensi "${
          aiImageAttachment.caption || 'ini'
        }" secara detail dengan bahasa yang mudah dipahami.`;
      } else if (aiImageAttachment && userPrompt) {
        userPrompt = `${userPrompt}\n\n(Gunakan gambar referensi yang dilampirkan sebagai acuan utama).`;
      }
    }

    const baseSystemPrompt =
      'Kamu adalah Miu AI, asisten workspace & agent cerdas yang dapat mencari informasi via Web Tool, mengakses/mengubah/membuat/menghapus catatan pengguna secara langsung, menjalankan skill.md, dan terhubung ke API eksternal. Gunakan struktur Markdown yang bersih (## Subjudul, - Poin Bullet, 1. Poin Nomor, - [ ] Pelacak Tugas, **Tebal** untuk istilah penting, dan $...$ atau $$...$$ untuk rumus LaTeX). Jangan tampilkan tag <think>.';

    const finalSystemPrompt =
      !contextInUserPrompt && noteContent.trim()
        ? `${baseSystemPrompt}\n\n=== KONTEKS CATATAN & DOKUMEN PDF AKTIF (ID: ${
            activeNote.id
          }) ===\n${noteContent}`
        : baseSystemPrompt;

    let latestText = '';
    let latestTools: AIToolExecutionRecord[] = [];
    const originNoteId = activeNoteId;
    let switchedNoteId: string | null = null;
    isAgentRunningRef.current = true;
    try {
      const result = await runAgentWithToolsStream({
        config: activeConfig,
        baseSystemPrompt: finalSystemPrompt,
        userPrompt,
        history: historyForApi,
        imageUrl: attachedImageUrl,
        signal: controller.signal,
        toolContext: {
          activeNoteId: activeNoteId || activeNote.id,
          activeSemesterId: activeSemesterId || 'sem-1',
          activeCourseId: activeCourseId || 'course-default',
          currentUser,
          connectionsConfig,
          activeSkillIds,
          onSetActiveNoteId: (targetId) => {
            switchedNoteId = targetId;
            agentSwitchedNoteIdRef.current = targetId;
            setActiveNoteId(targetId);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('miu:open-document-note', {
                  detail: { noteId: targetId }
                })
              );
            }
          },
          onActivateSkillNoteId: (skillId) =>
            setActiveSkillIds((prev) => Array.from(new Set([...prev, skillId])))
        },
        onTextChunk: (chunk) => {
          latestText = chunk;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId ? { ...m, content: chunk } : m
            )
          );
        },
        onToolExecutionsUpdate: (execs) => {
          latestTools = execs;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId ? { ...m, toolExecutions: execs } : m
            )
          );
        }
      });

      const finalOutput = result.finalText;
      const finalExecs = result.toolExecutions;

      if (finalOutput.trim() || finalExecs.length > 0) {
        const finalizedMessages = optimisticMessages.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                content: finalOutput,
                toolExecutions: finalExecs.length > 0 ? finalExecs : undefined
              }
            : m
        );
        setMessages(finalizedMessages);

        const nextThread: AIChatThread = {
          id: threadId,
          title: threadTitle,
          messages: finalizedMessages,
          model: activeConfig.model,
          createdAt: activeThread?.createdAt || now,
          updatedAt: Date.now()
        };
        const others = chatThreads.filter((t) => t.id !== threadId);
        persistChatThreads([nextThread, ...others], threadId, originNoteId);
        if (switchedNoteId && switchedNoteId !== originNoteId) {
          persistThreadToTargetNote(switchedNoteId, nextThread);
        }
      } else {
        setMessages(priorMessages);
      }
    } catch (err) {
      const isAborted =
        controller.signal.aborted ||
        (err instanceof Error && err.name === 'AbortError');
      if (isAborted) {
        if (latestText.trim() || latestTools.length > 0) {
          const partialMessages = optimisticMessages.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content: latestText,
                  toolExecutions: latestTools.length > 0 ? latestTools : undefined
                }
              : m
          );
          setMessages(partialMessages);
          const nextThread: AIChatThread = {
            id: threadId,
            title: threadTitle,
            messages: partialMessages,
            model: activeConfig.model,
            createdAt: activeThread?.createdAt || now,
            updatedAt: Date.now()
          };
          const others = chatThreads.filter((t) => t.id !== threadId);
          persistChatThreads([nextThread, ...others], threadId, originNoteId);
          if (switchedNoteId && switchedNoteId !== originNoteId) {
            persistThreadToTargetNote(switchedNoteId, nextThread);
          }
        } else {
          setMessages(priorMessages);
        }
      } else {
        setMessages(priorMessages);
        setErrorMsg(
          err instanceof Error ? err.message : 'Gagal menghubungi AI Provider.'
        );
      }
    } finally {
      isAgentRunningRef.current = false;
      abortControllerRef.current = null;
      setLoading(false);
    }
  };

  const handleStopStreaming = () => {
    abortControllerRef.current?.abort();
  };

  const handleRegenerateLast = () => {
    if (loading || messages.length === 0) return;
    const lastUserIdx = [...messages]
      .reverse()
      .findIndex((m) => m.role === 'user');
    if (lastUserIdx === -1) return;
    const actualIdx = messages.length - 1 - lastUserIdx;
    const targetUserMsg = messages[actualIdx];
    const baseBeforeUser = messages.slice(0, actualIdx);
    void executePrompt('custom', targetUserMsg.content, baseBeforeUser);
  };

  const handleInsertStructuredBlocks = async (msgId: string, content: string) => {
    const parsedBlocks = parseMarkdownToNotionBlocks(content);
    if (parsedBlocks.length === 0) return;
    await insertBlocksIntoActiveNote(parsedBlocks);
    setInsertedMsgId(msgId);
    window.setTimeout(() => setInsertedMsgId((prev) => (prev === msgId ? null : prev)), 2500);
  };

  const handleCopyResponse = async (msgId: string, content: string) => {
    const cleaned = cleanThinkingTags(content);
    if (!cleaned) return;
    await navigator.clipboard.writeText(cleaned);
    setCopiedMsgId(msgId);
    window.setTimeout(() => setCopiedMsgId((prev) => (prev === msgId ? null : prev)), 2000);
  };

  const handleAddBreakdownTodos = async (msgId: string, content: string) => {
    const cleaned = cleanThinkingTags(content);
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
    setTodosMsgId(msgId);
    window.setTimeout(() => setTodosMsgId((prev) => (prev === msgId ? null : prev)), 2400);
  };

  const handleLoadThread = (thread: AIChatThread) => {
    abortControllerRef.current?.abort();
    setLoading(false);
    setActiveThreadId(thread.id);
    setMessages(thread.messages);
    setErrorMsg('');
    setShowQuizCards(false);
    setOpenMenu('none');
    try {
      sessionStorage.setItem(`miu_ai_active_thread_${activeNoteId}`, thread.id);
    } catch {
      // ignore
    }
  };

  const handleDeleteThread = (threadId: string) => {
    const remaining = chatThreads.filter((t) => t.id !== threadId);
    const nextActiveId = activeThreadId === threadId ? null : activeThreadId;
    if (activeThreadId === threadId) {
      setActiveThreadId(null);
      setMessages([]);
    }
    setSelectedChatIds((prev) => prev.filter((id) => id !== threadId));
    persistChatThreads(remaining, nextActiveId);
  };

  const drawerWidthClass = isExpandedWidth
    ? 'w-full sm:w-[480px] lg:w-[560px]'
    : 'w-full sm:w-[340px] lg:w-[380px]';

  const hasSendableInput = Boolean(
    customPrompt.trim() || aiPdfAttachment || aiImageAttachment
  );

  const lastAssistantMsgId =
    [...messages].reverse().find((m) => m.role === 'assistant')?.id || null;

  const renderSwitch = (checked: boolean) => (
    <span
      className={`relative inline-flex h-[18px] w-8 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
        checked ? 'bg-sky-600' : 'bg-text-secondary/30'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-[14px] w-[14px] transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-3.5' : 'translate-x-0'
        }`}
      />
    </span>
  );

  return (
    <aside
      className={`${drawerWidthClass} fixed inset-0 z-50 sm:relative sm:inset-auto sm:z-auto shrink-0 h-dvh sm:h-full max-h-dvh overflow-hidden border-l border-border-subtle bg-surface text-text-primary flex flex-col no-print transition-all duration-200`}
    >
      {/* Top Minimal Notion-style Header */}
      <header
        className={`shrink-0 px-3 ${
          islandPosition === 'top-right' ? 'pt-[52px]' : 'pt-2.5'
        } pb-2 flex items-center justify-between gap-2 relative`}
      >
        {/* Left: Chat History Switcher Dropdown */}
        <div className="relative min-w-0" data-ai-popover>
          <button
            type="button"
            onClick={() => setOpenMenu((m) => (m === 'history' ? 'none' : 'history'))}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-subtle text-text-primary transition max-w-[205px]"
            title="Buka atau ganti obrolan AI"
          >
            <MiuAIFaceIcon className="w-4 h-4 shrink-0 text-text-primary" />
            <span className="text-[13px] font-semibold truncate">
              {activeThread?.title || 'Obrolan AI baru'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-text-secondary shrink-0" />
          </button>

          {openMenu === 'history' && (
            <div className="absolute left-0 top-full mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-xl bg-surface border border-border-subtle shadow-2xl p-1.5 z-50 space-y-1">
              <button
                type="button"
                onClick={startNewChat}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-subtle text-xs font-medium text-text-primary transition"
              >
                <SquarePen className="w-3.5 h-3.5 text-text-secondary" />
                <span>Obrolan AI baru</span>
              </button>

              {chatThreads.length > 0 && (
                <>
                  <div className="h-px bg-border-subtle my-1" />
                  <div className="flex items-center justify-between px-2 py-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                      Riwayat Catatan Ini ({chatThreads.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !isChatSelectMode;
                        setIsChatSelectMode(next);
                        if (!next) setSelectedChatIds([]);
                      }}
                      className="text-[10px] font-medium text-text-secondary hover:text-text-primary"
                    >
                      {isChatSelectMode ? 'Selesai' : 'Kelola'}
                    </button>
                  </div>

                  {(isChatSelectMode || selectedChatIds.length > 0) && (
                    <div className="flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-lg bg-rose-500/10 border border-rose-400/25">
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedChatIds.length === chatThreads.length) {
                            setSelectedChatIds([]);
                          } else {
                            setSelectedChatIds(chatThreads.map((t) => t.id));
                          }
                        }}
                        className="text-[10px] font-semibold text-text-primary hover:underline"
                      >
                        {selectedChatIds.length === chatThreads.length
                          ? 'Batal semua'
                          : 'Pilih semua'}
                      </button>
                      <button
                        type="button"
                        disabled={selectedChatIds.length === 0}
                        onClick={() => {
                          const selectedSet = new Set(selectedChatIds);
                          const remaining = chatThreads.filter((t) => !selectedSet.has(t.id));
                          const resetActive = activeThreadId && selectedSet.has(activeThreadId);
                          if (resetActive) {
                            setActiveThreadId(null);
                            setMessages([]);
                          }
                          setSelectedChatIds([]);
                          setIsChatSelectMode(false);
                          persistChatThreads(remaining, resetActive ? null : activeThreadId);
                        }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500 text-white disabled:opacity-40 text-[10px] font-semibold"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                        <span>Hapus ({selectedChatIds.length})</span>
                      </button>
                    </div>
                  )}

                  <div className="max-h-60 overflow-y-auto space-y-0.5 pr-0.5">
                    {chatThreads.map((thread) => {
                      const isCurrent = activeThreadId === thread.id;
                      const isChecked = selectedChatIds.includes(thread.id);
                      return (
                        <div
                          key={thread.id}
                          onClick={() => {
                            if (isChatSelectMode) {
                              setSelectedChatIds((prev) =>
                                prev.includes(thread.id)
                                  ? prev.filter((id) => id !== thread.id)
                                  : [...prev, thread.id]
                              );
                            } else {
                              handleLoadThread(thread);
                            }
                          }}
                          className={`group flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition ${
                            isCurrent
                              ? 'bg-subtle text-text-primary font-semibold'
                              : 'text-text-secondary hover:bg-subtle/60 hover:text-text-primary'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {isChatSelectMode && (
                              <span
                                className={`w-3.5 h-3.5 rounded-[4px] border flex items-center justify-center shrink-0 ${
                                  isChecked
                                    ? 'bg-rose-500 border-rose-500 text-white'
                                    : 'border-text-secondary/40 bg-surface'
                                }`}
                              >
                                {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                              </span>
                            )}
                            <span className="truncate">{thread.title}</span>
                          </div>
                          {!isChatSelectMode && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteThread(thread.id);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-500/15 text-text-secondary hover:text-rose-500 transition shrink-0"
                              title="Hapus obrolan"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Right Header Controls */}
        <div className="flex items-center gap-0.5 shrink-0 text-text-secondary">
          <button
            type="button"
            onClick={startNewChat}
            className="p-1.5 rounded-lg hover:bg-subtle hover:text-text-primary transition"
            title="Obrolan AI baru"
            aria-label="Obrolan AI baru"
          >
            <SquarePen className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() =>
              setInteractionMode((prev) => (prev === 'text' ? 'voice' : 'text'))
            }
            className={`p-1.5 rounded-lg transition ${
              interactionMode === 'voice'
                ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300'
                : 'hover:bg-subtle hover:text-text-primary'
            }`}
            title={
              interactionMode === 'voice'
                ? 'Kembali ke Chat Teks'
                : 'Mode Suara Interaktif (ElevenLabs)'
            }
            aria-label="Beralih mode suara AI"
          >
            <AudioLines className="w-4 h-4" />
          </button>

          <div className="relative" data-ai-popover>
            <button
              type="button"
              onClick={() => setOpenMenu((m) => (m === 'more' ? 'none' : 'more'))}
              className="p-1.5 rounded-lg hover:bg-subtle hover:text-text-primary transition"
              title="Menu opsi AI"
              aria-label="Menu opsi AI"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {openMenu === 'more' && (
              <div className="absolute right-0 top-full mt-1 w-60 rounded-xl bg-surface border border-border-subtle shadow-2xl p-1.5 z-50 space-y-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setIsExpandedWidth((v) => !v);
                    setOpenMenu('none');
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-subtle text-text-primary transition"
                >
                  {isExpandedWidth ? (
                    <>
                      <Minimize2 className="w-3.5 h-3.5 text-text-secondary" />
                      <span>Ukuran panel normal</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-3.5 h-3.5 text-text-secondary" />
                      <span>Perlebar panel baca</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setOpenMenu('skills')}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-subtle text-text-primary transition"
                >
                  <FileCode2 className="w-3.5 h-3.5 text-text-secondary" />
                  <span>Kelola Skill (skill.md)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    openPustakaInMainPage('active');
                    setOpenMenu('none');
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-subtle text-text-primary transition"
                >
                  <BookOpen className="w-3.5 h-3.5 text-amber-500" />
                  <span>Pustaka Skill (Halaman)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOpenMenu('connections')}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-subtle text-text-primary transition"
                >
                  <LayoutGrid className="w-3.5 h-3.5 text-text-secondary" />
                  <span>Koneksi &amp; Web Tool</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowProviderSheet(true);
                    setOpenMenu('none');
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-subtle text-text-primary transition"
                >
                  <Settings2 className="w-3.5 h-3.5 text-text-secondary" />
                  <span>Pengaturan Provider &amp; API Key</span>
                </button>
                {interactionMode === 'text' && (
                  <button
                    type="button"
                    onClick={() => void executePrompt('quiz')}
                    disabled={loading}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-subtle text-text-primary transition"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-text-secondary" />
                    <span>Buat Kuis &amp; Flashcard</span>
                  </button>
                )}
                {messages.length > 0 && (
                  <>
                    <div className="h-px bg-border-subtle my-1" />
                    <button
                      type="button"
                      onClick={startNewChat}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-rose-500/10 text-rose-500 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Bersihkan tampilan chat</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsAIDrawerOpen(false)}
            className="p-1.5 rounded-lg hover:bg-subtle hover:text-text-primary transition"
            title="Sembunyikan panel AI"
            aria-label="Sembunyikan panel AI"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      {interactionMode === 'voice' ? (
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 pb-3 flex flex-col gap-3">
          <ConversationalVoicePanel
            activeNote={activeNote}
            aiTab={aiTab}
            activeConfig={activeConfig}
            activeProviderLabel={activePresetMeta.label}
            aiPdfAttachment={aiPdfAttachment}
            aiImageAttachment={aiImageAttachment}
            onInsertBlocks={insertBlocksIntoActiveNote}
          />
        </div>
      ) : (
        <>
          <div
            ref={chatScrollContainerRef}
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4"
          >
            {messages.length === 0 && !loading && !errorMsg ? (
              /* Clean Bottom-Anchored Welcome State matching image.png */
              <div className="min-h-full flex flex-col justify-end pb-3 pt-8">
                <div className="w-11 h-11 rounded-full bg-surface border border-border-subtle shadow-sm flex items-center justify-center text-text-primary mb-3.5">
                  <MiuAIFaceIcon className="w-5 h-5" />
                </div>

                <h2 className="text-[15px] font-semibold text-text-primary tracking-tight mb-2.5">
                  Apa yang dapat saya bantu hari ini?
                </h2>

                <div className="space-y-0.5 -mx-2">
                  <button
                    type="button"
                    onClick={() => {
                      setConnectionsConfig((prev) => ({
                        ...prev,
                        webBrowserEnabled: true
                      }));
                      setCustomPrompt('Cari menggunakan Web Tool tentang: ');
                      window.setTimeout(() => textareaRef.current?.focus(), 30);
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] text-text-primary hover:bg-subtle transition text-left"
                  >
                    <Search className="w-4 h-4 text-text-secondary shrink-0" />
                    <span>Cari apa saja</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void executePrompt('agenda')}
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] text-text-primary hover:bg-subtle transition text-left"
                  >
                    <MiuAIFaceIcon className="w-4 h-4 text-text-secondary shrink-0" />
                    <span>Tulis agenda rapat</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => pdfInputRef.current?.click()}
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] text-text-primary hover:bg-subtle transition text-left"
                  >
                    <FileText className="w-4 h-4 text-text-secondary shrink-0" />
                    <span>Analisis PDF atau gambar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void executePrompt('summarize')}
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] text-text-primary hover:bg-subtle transition text-left"
                  >
                    <AlignLeft className="w-4 h-4 text-text-secondary shrink-0" />
                    <span>Ringkas halaman ini</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void executePrompt('translate')}
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] text-text-primary hover:bg-subtle transition text-left"
                  >
                    <Languages className="w-4 h-4 text-text-secondary shrink-0" />
                    <span>Terjemahkan halaman ini</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void executePrompt('breakdown')}
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] text-text-primary hover:bg-subtle transition text-left"
                  >
                    <CheckCircle2 className="w-4 h-4 text-text-secondary shrink-0" />
                    <span>Buat pelacak tugas</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Multi-Turn Conversational Thread + Live Tool Execution Cards */
              <div className="py-3 space-y-4">
                {showQuizCards && (
                  <button
                    type="button"
                    onClick={() => setFlashcardFlipped((v) => !v)}
                    className="w-full text-left p-3 rounded-xl bg-subtle/70 border border-border-subtle transition"
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono uppercase text-text-secondary mb-1">
                      <span>Flashcard Interaktif</span>
                      <span>Klik untuk balik</span>
                    </div>
                    <p className="text-xs font-semibold text-text-primary">
                      {flashcardFlipped
                        ? 'Jawaban tersedia di respons AI di bawah!'
                        : `Apa poin utama dari catatan "${activeNote?.title || 'Tanpa Judul'}"?`}
                    </p>
                  </button>
                )}

                {messages.map((msg) => {
                  if (msg.role === 'user') {
                    return (
                      <div key={msg.id} className="flex flex-col items-end gap-1">
                        {msg.attachmentLabel && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-subtle border border-border-subtle text-[10px] text-text-secondary max-w-[88%] truncate">
                            <FileText className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">{msg.attachmentLabel}</span>
                          </span>
                        )}
                        <div className="max-w-[88%] rounded-2xl rounded-tr-md bg-subtle border border-border-subtle/70 px-3.5 py-2 text-[13px] text-text-primary whitespace-pre-wrap leading-relaxed">
                          {msg.content}
                        </div>
                      </div>
                    );
                  }

                  const isStreamingThis =
                    loading && msg.id === lastAssistantMsgId;

                  return (
                    <div key={msg.id} className="space-y-2">
                      {/* Tool Execution Badges (Web Tool, Notes CRUD, Skills, Connections) */}
                      {msg.toolExecutions && msg.toolExecutions.length > 0 && (
                        <div className="space-y-1">
                          {msg.toolExecutions.map((exec) => (
                            <div
                              key={exec.id}
                              className="rounded-xl bg-subtle/75 border border-border-subtle px-2.5 py-1.5 text-[11.5px] flex items-start justify-between gap-2"
                            >
                              <div className="flex items-start gap-2 min-w-0">
                                {exec.status === 'running' ? (
                                  <Loader2 className="w-3.5 h-3.5 text-sky-500 animate-spin shrink-0 mt-0.5" />
                                ) : exec.status === 'done' ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                ) : (
                                  <Wrench className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                                )}
                                <div className="min-w-0">
                                  <p className="font-medium text-text-primary truncate">
                                    {exec.label}
                                  </p>
                                  {exec.summary && (
                                    <p className="text-[10.5px] text-text-secondary truncate">
                                      {exec.summary}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {msg.content ? (
                        <div className="text-[13px] text-text-primary leading-relaxed">
                          <MarkdownView content={msg.content} />
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-2 text-xs text-text-secondary py-1">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>
                            {msg.toolExecutions && msg.toolExecutions.length > 0
                              ? 'Menyusun hasil dari tool...'
                              : 'Miu AI sedang berpikir...'}
                          </span>
                        </div>
                      )}

                      {msg.content && !isStreamingThis && (
                        <div className="flex flex-wrap items-center gap-1 pt-0.5 text-[11px] text-text-secondary">
                          <button
                            type="button"
                            onClick={() => void handleCopyResponse(msg.id, msg.content)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-subtle hover:text-text-primary transition"
                            title="Salin jawaban"
                          >
                            {copiedMsgId === msg.id ? (
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
                            onClick={() =>
                              void handleInsertStructuredBlocks(msg.id, msg.content)
                            }
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-subtle hover:text-text-primary transition"
                            title="Sisipkan jawaban ke catatan"
                          >
                            {insertedMsgId === msg.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-500" />
                                <span className="text-emerald-500">Tersisip!</span>
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
                            onClick={() =>
                              void handleAddBreakdownTodos(msg.id, msg.content)
                            }
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-subtle hover:text-text-primary transition"
                            title="Tambahkan poin ke daftar To-do Pomodoro"
                          >
                            {todosMsgId === msg.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-500" />
                                <span className="text-emerald-500">Masuk To-do!</span>
                              </>
                            ) : (
                              <>
                                <ListTodo className="w-3 h-3" />
                                <span>To-do</span>
                              </>
                            )}
                          </button>

                          {msg.id === lastAssistantMsgId && (
                            <button
                              type="button"
                              onClick={handleRegenerateLast}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-subtle hover:text-text-primary transition"
                              title="Buat ulang respons terakhir"
                            >
                              <RefreshCw className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {errorMsg && (
                  <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-500 flex items-start justify-between gap-2">
                    <div className="space-y-1.5">
                      <p className="leading-relaxed">{errorMsg}</p>
                      <button
                        type="button"
                        onClick={() => setShowProviderSheet(true)}
                        className="text-[11px] font-semibold underline hover:opacity-80"
                      >
                        Atur Provider / API Key
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setErrorMsg('')}
                      className="p-0.5 rounded hover:bg-rose-500/20 shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Bottom Composer Area */}
          <div className="shrink-0 px-3 pb-3 pt-1.5 space-y-2">
            {/* Collapsible BYOK Provider Configuration Sheet */}
            {showProviderSheet && (
              <div className="rounded-2xl bg-subtle/60 border border-border-subtle p-3 space-y-2.5 text-xs shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-text-primary">
                      Provider &amp; Model AI
                    </span>
                    <div className="inline-flex rounded-lg bg-surface border border-border-subtle p-0.5 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setAiTab('groq')}
                        className={`px-2 py-0.5 rounded-md font-semibold transition ${
                          aiTab === 'groq'
                            ? 'bg-text-primary text-surface'
                            : 'text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        Otomatis
                      </button>
                      <button
                        type="button"
                        onClick={() => setAiTab('custom')}
                        className={`px-2 py-0.5 rounded-md font-semibold transition ${
                          aiTab === 'custom'
                            ? 'bg-text-primary text-surface'
                            : 'text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        Custom BYOK
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowProviderSheet(false)}
                    className="p-1 rounded-lg hover:bg-surface text-text-secondary hover:text-text-primary"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {aiTab === 'groq' ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-text-secondary px-0.5">
                      <span>Pilih Model Gratis Miu AI ({MIU_FREE_MODELS.length} model)</span>
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-500 font-semibold shrink-0">
                        <CheckCircle2 className="w-3 h-3" />
                        Siap
                      </span>
                    </div>
                    <div className="max-h-44 overflow-y-auto space-y-1 pr-0.5">
                      {MIU_FREE_MODELS.map((m) => {
                        const isSelected = defaultGroqConfig.model === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              setAiTab('groq');
                              setDefaultGroqConfig(loadDefaultGroqConfig(m.id));
                              saveSelectedMiuFreeModel(m.id);
                            }}
                            className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl border text-left transition ${
                              isSelected
                                ? 'bg-surface border-sky-500/50 text-text-primary font-semibold shadow-xs'
                                : 'bg-surface/60 border-border-subtle text-text-secondary hover:bg-surface hover:text-text-primary'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="text-[11.5px] truncate">{m.label}</div>
                              <div className="text-[10px] text-text-secondary truncate">
                                {m.tag}
                              </div>
                            </div>
                            <span className="inline-flex items-center gap-1.5 shrink-0">
                              <span className="px-1.5 py-0.5 rounded bg-emerald-500/12 text-emerald-600 dark:text-emerald-300 text-[9.5px] font-semibold">
                                Free
                              </span>
                              {isSelected && (
                                <Check className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-1">
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
                            className={`p-1.5 rounded-lg text-left border transition ${
                              active
                                ? 'bg-surface border-text-primary text-text-primary font-semibold'
                                : 'bg-surface/50 border-border-subtle text-text-secondary hover:text-text-primary'
                            }`}
                          >
                            <div className="text-[10px] truncate">{p.label}</div>
                          </button>
                        );
                      })}
                    </div>

                    {customConfig.provider === 'ollama' ? (
                      <div className="grid grid-cols-2 gap-1.5">
                        <input
                          type="text"
                          value={customConfig.ollamaUrl}
                          onChange={(e) =>
                            setCustomConfig((prev) => ({
                              ...prev,
                              ollamaUrl: e.target.value
                            }))
                          }
                          placeholder="http://localhost:11434"
                          className="w-full bg-surface border border-border-subtle rounded-lg px-2 py-1 font-mono text-[11px] text-text-primary focus:outline-none focus:border-accent-strong"
                        />
                        <input
                          type="text"
                          value={customConfig.model}
                          onChange={(e) =>
                            setCustomConfig((prev) => ({
                              ...prev,
                              model: e.target.value
                            }))
                          }
                          placeholder="llama3.2"
                          className="w-full bg-surface border border-border-subtle rounded-lg px-2 py-1 font-mono text-[11px] text-text-primary focus:outline-none focus:border-accent-strong"
                        />
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {(customConfig.provider === 'custom' ||
                          customConfig.provider === 'openrouter' ||
                          customConfig.provider === 'openai') && (
                          <input
                            type="text"
                            value={customConfig.baseUrl || ''}
                            onChange={(e) =>
                              setCustomConfig((prev) => ({
                                ...prev,
                                baseUrl: e.target.value
                              }))
                            }
                            placeholder="https://api.openai.com/v1/chat/completions"
                            className="w-full bg-surface border border-border-subtle rounded-lg px-2 py-1 font-mono text-[11px] text-text-primary focus:outline-none focus:border-accent-strong"
                          />
                        )}
                        <div className="grid grid-cols-2 gap-1.5">
                          <div className="relative flex items-center">
                            <input
                              type={showKey ? 'text' : 'password'}
                              value={customConfig.apiKey}
                              onChange={(e) =>
                                setCustomConfig((prev) => ({
                                  ...prev,
                                  apiKey: e.target.value
                                }))
                              }
                              placeholder="API Key..."
                              className="w-full bg-surface border border-border-subtle rounded-lg pl-2 pr-6 py-1 font-mono text-[11px] text-text-primary focus:outline-none focus:border-accent-strong"
                            />
                            <button
                              type="button"
                              onClick={() => setShowKey((v) => !v)}
                              className="absolute right-1.5 text-text-secondary hover:text-text-primary"
                            >
                              {showKey ? (
                                <EyeOff className="w-3 h-3" />
                              ) : (
                                <Eye className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                          <input
                            type="text"
                            value={customConfig.model}
                            onChange={(e) =>
                              setCustomConfig((prev) => ({
                                ...prev,
                                model: e.target.value
                              }))
                            }
                            placeholder="Model name..."
                            className="w-full bg-surface border border-border-subtle rounded-lg px-2 py-1 font-mono text-[11px] text-text-primary focus:outline-none focus:border-accent-strong"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-text-secondary">
                      <span>
                        {isCustomReady
                          ? `${activePresetMeta.label} siap dipakai`
                          : 'Isi API Key & Model terlebih dahulu'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowProviderSheet(false)}
                        className="px-2.5 py-1 rounded-lg bg-text-primary text-surface font-semibold"
                      >
                        Simpan
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Active Skill.md & Web Tool Pills above Composer */}
            {(activeSkillNotes.length > 0 || connectionsConfig.webBrowserEnabled) && (
              <div className="flex flex-wrap items-center gap-1.5">
                {connectionsConfig.webBrowserEnabled && (
                  <button
                    type="button"
                    onClick={() => setOpenMenu('connections')}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/12 border border-sky-500/30 text-[10.5px] font-medium text-sky-600 dark:text-sky-300 hover:bg-sky-500/20 transition"
                    title="Web Tool aktif"
                  >
                    <Globe className="w-3 h-3 shrink-0" />
                    <span>Web Tool</span>
                  </button>
                )}

                {activeSkillNotes.map((sn) => (
                  <div
                    key={sn.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-subtle border border-border-subtle text-[10.5px] font-medium text-text-primary"
                  >
                    <button
                      type="button"
                      onClick={() => setActiveNoteId(sn.id)}
                      className="inline-flex items-center gap-1 hover:underline truncate max-w-[140px]"
                      title="Klik untuk mengedit skill.md ini langsung di catatan"
                    >
                      <span>{sn.icon || '🧩'}</span>
                      <span className="truncate">{sn.title || 'skill.md'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleSkillActive(sn.id)}
                      className="text-text-secondary hover:text-rose-500 ml-0.5"
                      title="Nonaktifkan skill ini"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Attachment & Extraction Pills above Composer */}
            {uploadingRef && pdfProgressMsg && (
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-subtle border border-border-subtle text-[11px] text-text-secondary">
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                <span className="truncate font-medium">{pdfProgressMsg}</span>
              </div>
            )}

            {aiPdfAttachment && (
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-rose-500/10 border border-rose-400/30">
                <FileText className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-text-primary truncate">
                    {aiPdfAttachment.fileName}{' '}
                    <span className="font-normal text-text-secondary">
                      ({aiPdfAttachment.pages} hal)
                    </span>
                  </p>
                </div>
                {aiPdfAttachment.url && (
                  <button
                    type="button"
                    disabled={uploadingRef}
                    onClick={() => void handleReExtractAttachedPdf()}
                    className="p-1 rounded-md hover:bg-surface text-text-secondary hover:text-text-primary disabled:opacity-50"
                    title="Baca ulang isi PDF"
                  >
                    <RefreshCw
                      className={`w-3 h-3 ${
                        uploadingRef && pdfProgressMsg ? 'animate-spin' : ''
                      }`}
                    />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setAiPdfAttachment(null)}
                  className="p-1 rounded-md hover:bg-surface text-text-secondary hover:text-text-primary"
                  title="Hapus lampiran PDF"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {aiImageAttachment && (
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-400/30">
                <img
                  src={aiImageAttachment.url}
                  alt={aiImageAttachment.caption || 'Referensi Gambar'}
                  className="w-7 h-7 rounded-lg object-cover border border-border-subtle shrink-0"
                />
                <p className="text-[11px] font-semibold text-text-primary truncate flex-1">
                  {aiImageAttachment.caption || 'Gambar Catatan'}
                </p>
                <button
                  type="button"
                  onClick={() => setAiImageAttachment(null)}
                  className="p-1 rounded-md hover:bg-surface text-text-secondary hover:text-text-primary"
                  title="Hapus lampiran gambar"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Rounded Prompt Input Card (Matching Notion AI Composer in image.png) */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void executePrompt('custom');
              }}
              className="rounded-2xl border border-border-subtle bg-subtle/35 dark:bg-subtle/45 focus-within:bg-surface focus-within:border-text-secondary/45 shadow-sm transition px-3 pt-2.5 pb-2 relative"
            >
              {/* Hidden upload inputs triggered via + menu */}
              <input
                ref={pdfInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void handleUploadReferencePdf(f);
                }}
              />
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void handleUploadReferenceImage(f);
                }}
              />

              <textarea
                ref={textareaRef}
                rows={1}
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
                    ? `Tanyakan tentang "${aiPdfAttachment.fileName}"...`
                    : aiImageAttachment
                      ? 'Tanyakan tentang gambar di atas...'
                      : 'Tanya, cari via Web Tool, atau kelola catatan...'
                }
                className="w-full bg-transparent text-[13px] text-text-primary placeholder:text-text-secondary/70 focus:outline-none resize-none leading-relaxed max-h-36 overflow-y-auto"
              />

              <div className="flex items-center justify-between gap-2 mt-1.5">
                {/* Bottom-left controls: + (Attachment, Skill, Browser Web, Koneksi) + Shield */}
                <div className="flex items-center gap-0.5 relative">
                  <div className="relative" data-ai-popover>
                    <button
                      type="button"
                      onClick={() =>
                        setOpenMenu((m) =>
                          m === 'attach' ||
                          m === 'attach_files' ||
                          m === 'skills' ||
                          m === 'connections'
                            ? 'none'
                            : 'attach'
                        )
                      }
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition ${
                        openMenu === 'attach' ||
                        openMenu === 'attach_files' ||
                        openMenu === 'skills' ||
                        openMenu === 'connections'
                          ? 'bg-subtle text-text-primary'
                          : 'hover:bg-subtle text-text-secondary hover:text-text-primary'
                      }`}
                      title="Tambahkan foto & file, Skill (skill.md), Browser Web, atau Koneksi"
                      aria-label="Menu tambah & koneksi AI"
                    >
                      <Plus className="w-4 h-4" />
                    </button>

                    {/* ======================================================= */}
                    {/* IMAGE.PNG: "+" MENU (Foto & File, Skill, Browser, Koneksi) */}
                    {/* ======================================================= */}
                    {openMenu === 'attach' && (
                      <div className="absolute left-0 bottom-full mb-2 w-64 rounded-2xl bg-surface border border-border-subtle shadow-[0_18px_46px_-10px_rgba(15,23,42,0.22)] dark:shadow-[0_20px_50px_-10px_rgba(0,0,0,0.75)] p-1.5 z-50 space-y-0.5 text-[13px] text-text-primary select-none">
                        {/* 1. Tambahkan foto & file */}
                        <button
                          type="button"
                          onClick={() => setOpenMenu('attach_files')}
                          className="w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-xl hover:bg-subtle transition text-left"
                        >
                          <span className="inline-flex items-center gap-2.5">
                            <Paperclip className="w-4 h-4 text-text-primary shrink-0" />
                            <span className="font-medium">Tambahkan foto &amp; file</span>
                          </span>
                        </button>

                        {/* 2. Skill (skill.md editable in notes) */}
                        <button
                          type="button"
                          onClick={() => setOpenMenu('skills')}
                          className="w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-xl hover:bg-subtle transition text-left"
                        >
                          <span className="inline-flex items-center gap-2.5">
                            <FileCode2 className="w-4 h-4 text-text-primary shrink-0" />
                            <span className="font-medium">Skill</span>
                          </span>
                          {activeSkillNotes.length > 0 && (
                            <span className="text-xs text-text-secondary font-medium">
                              {activeSkillNotes.length}
                            </span>
                          )}
                        </button>

                        {/* 3. Browser Web Beta [Toggle Switch] */}
                        <button
                          type="button"
                          onClick={() =>
                            setConnectionsConfig((prev) => ({
                              ...prev,
                              webBrowserEnabled: !prev.webBrowserEnabled
                            }))
                          }
                          className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl hover:bg-subtle transition text-left"
                        >
                          <span className="inline-flex items-center gap-2.5 min-w-0">
                            <Globe className="w-4 h-4 text-text-primary shrink-0" />
                            <span className="font-medium truncate">Browser Web</span>
                            <span className="px-1.5 py-0.5 rounded-md bg-subtle border border-border-subtle text-[10px] font-semibold text-text-secondary leading-none">
                              Beta
                            </span>
                          </span>
                          {renderSwitch(connectionsConfig.webBrowserEnabled)}
                        </button>

                        {/* 4. Koneksi [count >] */}
                        <button
                          type="button"
                          onClick={() => setOpenMenu('connections')}
                          className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl hover:bg-subtle transition text-left"
                        >
                          <span className="inline-flex items-center gap-2.5">
                            <LayoutGrid className="w-4 h-4 text-text-primary shrink-0" />
                            <span className="font-medium">Koneksi</span>
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
                            <span>{activeConnectionCount}</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        </button>
                      </div>
                    )}

                    {/* SUBMENU 1: TAMBAHKAN FOTO & FILE */}
                    {openMenu === 'attach_files' && (
                      <div className="absolute left-0 bottom-full mb-2 w-64 rounded-2xl bg-surface border border-border-subtle shadow-2xl p-2 z-50 space-y-1 text-xs">
                        <button
                          type="button"
                          onClick={() => setOpenMenu('attach')}
                          className="inline-flex items-center gap-1.5 px-1.5 py-1 text-text-secondary hover:text-text-primary font-medium"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          <span>Tambahkan foto &amp; file</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => pdfInputRef.current?.click()}
                          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-subtle text-text-primary transition"
                        >
                          <FileText className="w-4 h-4 text-rose-500" />
                          <span>Unggah dokumen PDF</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => imageInputRef.current?.click()}
                          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-subtle text-text-primary transition"
                        >
                          <ImagePlus className="w-4 h-4 text-indigo-500" />
                          <span>Unggah foto / gambar</span>
                        </button>

                        {notePdfs.length > 0 && (
                          <>
                            <div className="h-px bg-border-subtle my-1" />
                            <div className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                              PDF di Halaman Ini
                            </div>
                            <div className="max-h-28 overflow-y-auto space-y-0.5">
                              {notePdfs.map((pdfBlk, i) => (
                                <button
                                  key={pdfBlk.id}
                                  type="button"
                                  onClick={() => void handleAttachNotePdf(pdfBlk, i)}
                                  className="w-full flex items-center gap-2 px-2.5 py-1 rounded-lg hover:bg-subtle text-text-primary transition text-left"
                                >
                                  <FileText className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                  <span className="truncate">
                                    {pdfBlk.fileName || pdfBlk.caption || `PDF ${i + 1}`}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </>
                        )}

                        {noteImages.length > 0 && (
                          <>
                            <div className="h-px bg-border-subtle my-1" />
                            <div className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                              Gambar di Halaman Ini
                            </div>
                            <div className="flex items-center gap-1.5 px-2 py-1 overflow-x-auto">
                              {noteImages.map((imgBlk, i) => (
                                <button
                                  key={imgBlk.id}
                                  type="button"
                                  onClick={() => {
                                    setAiImageAttachment({
                                      url: imgBlk.content,
                                      caption: imgBlk.caption || `Gambar ${i + 1}`
                                    });
                                    setAiPdfAttachment(null);
                                    setOpenMenu('none');
                                  }}
                                  className="w-9 h-9 rounded-lg overflow-hidden border border-border-subtle hover:border-text-primary shrink-0"
                                >
                                  <img
                                    src={imgBlk.content}
                                    alt={imgBlk.caption || `Gambar ${i + 1}`}
                                    className="w-full h-full object-cover"
                                  />
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* SUBMENU 2: SKILL (skill.md) MANAGER & CREATOR */}
                    {openMenu === 'skills' && (
                      <div className="absolute left-0 bottom-full mb-2 w-80 rounded-2xl bg-surface border border-border-subtle shadow-2xl p-2.5 z-50 space-y-2.5 text-xs">
                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => setOpenMenu('attach')}
                            className="inline-flex items-center gap-1.5 text-text-secondary hover:text-text-primary font-semibold"
                          >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            <span>Skill AI (skill.md)</span>
                          </button>
                          <span className="text-[10px] text-text-secondary">
                            Pustaka &amp; Catatan
                          </span>
                        </div>

                        {/* Pustaka Skill (Browse/Install & Upload to Community Library) */}
                        <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                              <BookOpen className="w-3.5 h-3.5" />
                              <span>Pustaka Skill Komunitas</span>
                            </span>
                            <span className="text-[10px] text-amber-700/80 dark:text-amber-300/80">
                              Instal &amp; Bagikan
                            </span>
                          </div>
                          <p className="text-[10.5px] text-text-secondary leading-snug">
                            Instal skill dari pustaka beserta penjelasan fungsinya, atau unggah <code className="font-mono">skill.md</code> Anda ke pustaka.
                          </p>
                          <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                openPustakaInMainPage('active');
                                setOpenMenu('none');
                              }}
                              className="py-1.5 px-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-semibold flex items-center justify-center gap-1 transition shadow-sm"
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                              <span>Buka Pustaka</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                openPustakaInMainPage('upload');
                                setOpenMenu('none');
                              }}
                              className="py-1.5 px-2 rounded-lg bg-surface hover:bg-subtle text-text-primary border border-border-subtle text-[11px] font-semibold flex items-center justify-center gap-1 transition"
                            >
                              <CloudUpload className="w-3.5 h-3.5 text-amber-500" />
                              <span>Unggah Skill</span>
                            </button>
                          </div>
                        </div>

                        {/* Create New Editable skill.md Note */}
                        <div className="p-2 rounded-xl bg-subtle/60 border border-border-subtle space-y-1.5">
                          <div className="text-[11px] font-semibold text-text-primary">
                            Buat Skill Baru (skill.md)
                          </div>
                          <input
                            type="text"
                            value={newSkillName}
                            onChange={(e) => setNewSkillName(e.target.value)}
                            placeholder="Nama skill (mis: riset-iot/skill.md)"
                            className="w-full bg-surface border border-border-subtle rounded-lg px-2 py-1 text-[11px] text-text-primary focus:outline-none focus:border-sky-500"
                          />
                          <input
                            type="text"
                            value={newSkillConnUrl}
                            onChange={(e) => setNewSkillConnUrl(e.target.value)}
                            placeholder="URL Koneksi/Webhook (opsional https://...)"
                            className="w-full bg-surface border border-border-subtle rounded-lg px-2 py-1 font-mono text-[10.5px] text-text-primary focus:outline-none focus:border-sky-500"
                          />
                          <button
                            type="button"
                            onClick={() => void handleCreateNewSkillNote()}
                            className="w-full py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-[11.5px] font-semibold flex items-center justify-center gap-1.5 transition"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Buat &amp; Edit skill.md di Catatan</span>
                          </button>
                        </div>

                        {/* Existing skill.md notes + option to use current note as skill */}
                        <div className="space-y-1 max-h-48 overflow-y-auto pr-0.5">
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary px-1">
                            Daftar Skill di Workspace ({skillNotes.length})
                          </div>

                          {skillNotes.length === 0 ? (
                            <p className="text-[11px] text-text-secondary px-1 py-1.5">
                              Belum ada `skill.md`. Klik tombol di atas untuk membuat halaman `skill.md` baru yang bisa diedit bebas di catatan.
                            </p>
                          ) : (
                            skillNotes.map((sn) => {
                              const isActive = activeSkillIds.includes(sn.id);
                              return (
                                <div
                                  key={sn.id}
                                  className="flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-lg hover:bg-subtle transition"
                                >
                                  <button
                                    type="button"
                                    onClick={() => handleToggleSkillActive(sn.id)}
                                    className="flex items-center gap-2 min-w-0 flex-1 text-left"
                                  >
                                    <span
                                      className={`w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0 ${
                                        isActive
                                          ? 'bg-sky-600 border-sky-600 text-white'
                                          : 'border-text-secondary/40 bg-surface'
                                      }`}
                                    >
                                      {isActive && <Check className="w-3 h-3 stroke-[3]" />}
                                    </span>
                                    <span className="truncate font-medium text-text-primary">
                                      {sn.icon || '🧩'} {sn.title || 'skill.md'}
                                    </span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveNoteId(sn.id);
                                      setOpenMenu('none');
                                    }}
                                    className="px-1.5 py-0.5 rounded bg-subtle hover:bg-surface border border-border-subtle text-[10px] font-medium text-text-secondary hover:text-text-primary shrink-0 inline-flex items-center gap-1"
                                    title="Buka & edit halaman skill.md ini di editor catatan"
                                  >
                                    <span>Edit</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              );
                            })
                          )}

                          {activeNote && !skillNotes.some((s) => s.id === activeNote.id) && (
                            <button
                              type="button"
                              onClick={() => handleToggleSkillActive(activeNote.id)}
                              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-subtle text-sky-600 dark:text-sky-400 font-medium text-left transition"
                            >
                              <Plus className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">
                                Jadikan halaman aktif &ldquo;{activeNote.title || 'Tanpa Judul'}&rdquo; sebagai Skill
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* SUBMENU 3: KONEKSI & TOOL CALLING (WEB TOOL, WORKSPACE CRUD & CUSTOM WEBHOOK/API) */}
                    {openMenu === 'connections' && (
                      <div className="absolute left-0 bottom-full mb-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl bg-surface border border-border-subtle shadow-2xl p-3 z-50 space-y-2.5 text-xs max-h-[75vh] overflow-y-auto">
                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => setOpenMenu('attach')}
                            className="inline-flex items-center gap-1.5 text-text-secondary hover:text-text-primary font-semibold"
                          >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            <span>Koneksi &amp; Tool Calling ({activeConnectionCount})</span>
                          </button>
                        </div>

                        {/* 1. Web Tool (Privacy-Protected Real-Time Web Search) */}
                        <div className="p-2.5 rounded-xl bg-subtle/60 border border-border-subtle flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-text-primary">
                                Web Tool
                              </span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                                  connectionsConfig.webBrowserEnabled
                                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                                    : 'bg-subtle text-text-secondary'
                                }`}
                              >
                                {connectionsConfig.webBrowserEnabled ? 'Aktif' : 'Nonaktif'}
                              </span>
                            </div>
                            <div className="text-[10.5px] text-text-secondary mt-0.5">
                              Akses pencarian informasi &amp; referensi web real-time
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setConnectionsConfig((prev) => ({
                                ...prev,
                                webBrowserEnabled: !prev.webBrowserEnabled
                              }))
                            }
                          >
                            {renderSwitch(connectionsConfig.webBrowserEnabled)}
                          </button>
                        </div>

                        {/* 2. Full Workspace Notes CRUD Access */}
                        <div className="p-2.5 rounded-xl bg-subtle/60 border border-border-subtle flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-semibold text-text-primary">
                              Akses Penuh Catatan Workspace
                            </div>
                            <div className="text-[10.5px] text-text-secondary">
                              Lihat, buat, ubah, hapus &amp; buka semua catatan
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setConnectionsConfig((prev) => ({
                                ...prev,
                                notesCrudEnabled: !prev.notesCrudEnabled
                              }))
                            }
                          >
                            {renderSwitch(connectionsConfig.notesCrudEnabled)}
                          </button>
                        </div>

                        {/* 3. Custom External API / Webhook Connections for Skills */}
                        <div className="p-2.5 rounded-xl bg-subtle/60 border border-border-subtle space-y-2">
                          <div className="font-semibold text-text-primary">
                            Koneksi Eksternal (Webhook / API Skill)
                          </div>

                          {connectionsConfig.customConnections.length > 0 && (
                            <div className="space-y-1">
                              {connectionsConfig.customConnections.map((conn) => (
                                <div
                                  key={conn.id}
                                  className="flex items-center justify-between gap-1.5 px-2 py-1 rounded-lg bg-surface border border-border-subtle text-[11px]"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="font-semibold text-text-primary truncate">
                                      {conn.name}{' '}
                                      <span className="text-[9.5px] font-mono text-sky-500">
                                        {conn.method}
                                      </span>
                                    </div>
                                    <div className="text-[10px] font-mono text-text-secondary truncate">
                                      {conn.url}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setConnectionsConfig((prev) => ({
                                        ...prev,
                                        customConnections:
                                          prev.customConnections.filter(
                                            (c) => c.id !== conn.id
                                          )
                                      }))
                                    }
                                    className="p-1 text-text-secondary hover:text-rose-500"
                                    title="Hapus koneksi"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          <form onSubmit={handleAddCustomConnection} className="space-y-1.5">
                            <div className="flex gap-1">
                              <input
                                type="text"
                                value={newConnName}
                                onChange={(e) => setNewConnName(e.target.value)}
                                placeholder="Nama koneksi (mis: webhook_n8n)"
                                className="flex-1 bg-surface border border-border-subtle rounded-lg px-2 py-1 text-[11px] text-text-primary focus:outline-none"
                              />
                              <select
                                value={newConnMethod}
                                onChange={(e) =>
                                  setNewConnMethod(e.target.value as 'GET' | 'POST')
                                }
                                className="bg-surface border border-border-subtle rounded-lg px-1.5 py-1 text-[10.5px] font-mono text-text-primary"
                              >
                                <option value="POST">POST</option>
                                <option value="GET">GET</option>
                              </select>
                            </div>
                            <input
                              type="text"
                              value={newConnUrl}
                              onChange={(e) => setNewConnUrl(e.target.value)}
                              placeholder="https://api.example.com/webhook"
                              className="w-full bg-surface border border-border-subtle rounded-lg px-2 py-1 font-mono text-[10.5px] text-text-primary focus:outline-none"
                            />
                            <input
                              type="password"
                              value={newConnAuth}
                              onChange={(e) => setNewConnAuth(e.target.value)}
                              placeholder="Header Authorization (opsional: Bearer ...)"
                              className="w-full bg-surface border border-border-subtle rounded-lg px-2 py-1 font-mono text-[10.5px] text-text-primary focus:outline-none"
                            />
                            <button
                              type="submit"
                              className="w-full py-1.5 rounded-lg bg-surface hover:bg-subtle border border-border-subtle text-[11px] font-semibold text-text-primary flex items-center justify-center gap-1 transition"
                            >
                              <Link2 className="w-3 h-3" />
                              <span>Tambah Koneksi Eksternal</span>
                            </button>
                          </form>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="relative" data-ai-popover>
                    <button
                      type="button"
                      onClick={() =>
                        setOpenMenu((m) => (m === 'context' ? 'none' : 'context'))
                      }
                      className={`w-7 h-7 rounded-full hover:bg-subtle flex items-center justify-center transition relative ${
                        includeNoteContext
                          ? 'text-text-secondary hover:text-text-primary'
                          : 'text-text-secondary/45'
                      }`}
                      title={
                        includeNoteContext
                          ? `Konteks halaman & workspace aktif (${allNotes.length} halaman)`
                          : 'Konteks halaman dinonaktifkan'
                      }
                      aria-label="Konteks halaman catatan"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      {includeNoteContext && activeNote && (
                        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      )}
                    </button>

                    {openMenu === 'context' && (
                      <div className="absolute left-0 bottom-full mb-2 w-64 rounded-xl bg-surface border border-border-subtle shadow-2xl p-2.5 z-50 space-y-2 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-text-primary">
                              Konteks Halaman &amp; Workspace
                            </p>
                            <p className="text-[11px] text-text-secondary truncate">
                              {activeNote?.title || 'Tanpa Judul'} (
                              {activeNote?.blocks.length || 0} blok)
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIncludeNoteContext((v) => !v)}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition shrink-0 ${
                              includeNoteContext
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                                : 'bg-subtle text-text-secondary'
                            }`}
                          >
                            {includeNoteContext ? 'Aktif' : 'Nonaktif'}
                          </button>
                        </div>
                        <p className="text-[10px] text-text-secondary leading-relaxed">
                          AI memiliki akses penuh ke seluruh halaman workspace ({allNotes.length} catatan), Web Tool, serta {activeSkillNotes.length} skill.md aktif.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom-right controls: Model selector ("Otomatis ⌄") + Send/Stop circle button */}
                <div className="flex items-center gap-1.5 relative">
                  <div className="relative" data-ai-popover>
                    <button
                      type="button"
                      onClick={() =>
                        setOpenMenu((m) => (m === 'model' ? 'none' : 'model'))
                      }
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full hover:bg-subtle text-[12px] font-medium text-text-secondary hover:text-text-primary transition max-w-[140px]"
                      title="Pilih model atau provider AI"
                    >
                      <span className="truncate">
                        {aiTab === 'groq'
                          ? getMiuFreeModelLabel(defaultGroqConfig.model)
                          : activePresetMeta.label}
                      </span>
                      {openMenu === 'model' ? (
                        <ChevronUp className="w-3 h-3 shrink-0" />
                      ) : (
                        <ChevronDown className="w-3 h-3 shrink-0" />
                      )}
                    </button>

                    {openMenu === 'model' && (
                      <div className="absolute right-0 bottom-full mb-2 w-64 rounded-xl bg-surface border border-border-subtle shadow-2xl p-1.5 z-50 space-y-0.5 text-xs max-h-[70vh] overflow-y-auto">
                        <div className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-secondary flex items-center justify-between">
                          <span>Miu AI Gratis</span>
                          <span className="text-emerald-600 dark:text-emerald-400">Free</span>
                        </div>
                        {MIU_FREE_MODELS.map((m) => {
                          const isSelected =
                            aiTab === 'groq' && defaultGroqConfig.model === m.id;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setAiTab('groq');
                                setDefaultGroqConfig(loadDefaultGroqConfig(m.id));
                                saveSelectedMiuFreeModel(m.id);
                                setOpenMenu('none');
                              }}
                              className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg transition ${
                                isSelected
                                  ? 'bg-subtle text-text-primary font-semibold'
                                  : 'text-text-secondary hover:bg-subtle/60 hover:text-text-primary'
                              }`}
                            >
                              <div className="text-left min-w-0">
                                <div className="truncate">{m.label}</div>
                                <div className="text-[10px] text-text-secondary truncate">
                                  {m.tag}
                                </div>
                              </div>
                              {isSelected && (
                                <Check className="w-3.5 h-3.5 text-text-primary shrink-0" />
                              )}
                            </button>
                          );
                        })}

                        <div className="h-px bg-border-subtle my-1" />
                        <div className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                          Provider Custom (BYOK)
                        </div>
                        {CUSTOM_PROVIDER_PRESETS.map((p) => {
                          const isSelected =
                            aiTab === 'custom' && customConfig.provider === p.id;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setAiTab('custom');
                                setCustomConfig((prev) => ({
                                  ...prev,
                                  provider: p.id,
                                  model:
                                    prev.provider === p.id
                                      ? prev.model
                                      : DEFAULT_MODELS[p.id],
                                  baseUrl:
                                    prev.provider === p.id
                                      ? prev.baseUrl
                                      : DEFAULT_BASE_URLS[p.id]
                                }));
                                if (p.id !== 'ollama' && !customConfig.apiKey.trim()) {
                                  setShowProviderSheet(true);
                                }
                                setOpenMenu('none');
                              }}
                              className={`w-full flex items-center justify-between gap-2 px-2.5 py-1 rounded-lg transition ${
                                isSelected
                                  ? 'bg-subtle text-text-primary font-semibold'
                                  : 'text-text-secondary hover:bg-subtle/60 hover:text-text-primary'
                              }`}
                            >
                              <span>{p.label}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                            </button>
                          );
                        })}

                        <div className="h-px bg-border-subtle my-1" />
                        <button
                          type="button"
                          onClick={() => {
                            setShowProviderSheet(true);
                            setOpenMenu('none');
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-subtle text-text-primary transition"
                        >
                          <Settings2 className="w-3.5 h-3.5 text-text-secondary" />
                          <span>Atur API Key &amp; Model...</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {loading ? (
                    <button
                      type="button"
                      onClick={handleStopStreaming}
                      className="w-7 h-7 rounded-full bg-text-primary text-surface flex items-center justify-center hover:opacity-90 transition shrink-0"
                      title="Hentikan respons"
                      aria-label="Hentikan respons"
                    >
                      <Square className="w-2.5 h-2.5 fill-current" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!hasSendableInput}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition shrink-0 ${
                        hasSendableInput
                          ? 'bg-text-primary text-surface hover:opacity-90'
                          : 'bg-text-secondary/15 text-text-secondary/50 cursor-default'
                      }`}
                      title="Kirim pesan"
                      aria-label="Kirim ke Miu AI"
                    >
                      <ArrowUp className="w-4 h-4 stroke-[2.25]" />
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </>
      )}
    </aside>
  );
};
