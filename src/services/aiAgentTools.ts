import { db } from '../db/database';
import type {
  AIChatMessage,
  BlockType,
  NoteBlock,
  NoteFontStyle,
  NoteKanbanStatus,
  NoteRecord
} from '../types/miu';
import type { AIToolExecutionRecord } from '../utils/aiChatHistory';
import {
  createBlockId,
  flattenBlocks,
  insertBlocksRelativeDeep,
  mapBlockDeep,
  removeBlockDeep
} from '../utils/blockTreeHelper';
import { parseMarkdownToNotionBlocks } from '../utils/markdown';
import {
  loadLocalCommunitySkills,
  mergeSkillLibraryItems,
  OFFICIAL_SKILL_LIBRARY,
  type SkillLibraryItem
} from '../utils/skillLibraryCatalog';
import {
  deleteNoteFromNeon,
  isNeonConfigured,
  saveNoteToNeon
} from './cloudServices';
import {
  runExternalAIStream,
  serializeBlocksForPrompt,
  type AIConfig
} from './externalApis';

export type SearchProviderMode = 'auto' | 'tavily' | 'serper';

export interface CustomExternalConnection {
  id: string;
  name: string;
  url: string;
  method: 'GET' | 'POST';
  authHeader?: string;
  description?: string;
  enabled: boolean;
}

export interface AIConnectionsConfig {
  webBrowserEnabled: boolean;
  searchProvider: SearchProviderMode;
  tavilyEnabled: boolean;
  serperEnabled: boolean;
  tavilyApiKey: string;
  serperApiKey: string;
  notesCrudEnabled: boolean;
  customConnections: CustomExternalConnection[];
}

const CONNECTIONS_STORAGE_KEY = 'miu_ai_connections_v1';
const ACTIVE_SKILLS_STORAGE_KEY = 'miu_ai_active_skills_v1';

export const DEFAULT_AI_CONNECTIONS_CONFIG: AIConnectionsConfig = {
  webBrowserEnabled: true,
  searchProvider: 'auto',
  tavilyEnabled: true,
  serperEnabled: true,
  tavilyApiKey: '',
  serperApiKey: '',
  notesCrudEnabled: true,
  customConnections: []
};

export function loadAIConnectionsConfig(): AIConnectionsConfig {
  if (typeof window === 'undefined') return DEFAULT_AI_CONNECTIONS_CONFIG;
  try {
    const raw = window.localStorage.getItem(CONNECTIONS_STORAGE_KEY);
    if (!raw) return DEFAULT_AI_CONNECTIONS_CONFIG;
    const parsed = JSON.parse(raw) as Partial<AIConnectionsConfig>;
    return {
      ...DEFAULT_AI_CONNECTIONS_CONFIG,
      ...parsed,
      customConnections: Array.isArray(parsed.customConnections)
        ? parsed.customConnections
        : []
    };
  } catch {
    return DEFAULT_AI_CONNECTIONS_CONFIG;
  }
}

export function saveAIConnectionsConfig(cfg: AIConnectionsConfig): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CONNECTIONS_STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    // ignore
  }
}

export function countActiveConnections(cfg: AIConnectionsConfig): number {
  let count = 0;
  if (cfg.notesCrudEnabled) count += 1;
  if (cfg.webBrowserEnabled && cfg.tavilyEnabled) count += 1;
  if (cfg.webBrowserEnabled && cfg.serperEnabled) count += 1;
  for (const ext of cfg.customConnections) {
    if (ext.enabled && ext.url.trim()) count += 1;
  }
  return count;
}

export function isSkillNote(note: Pick<NoteRecord, 'title' | 'icon'>): boolean {
  const t = (note.title || '').trim().toLowerCase();
  if (!t) return note.icon === '🧩';
  return (
    t === 'skill.md' ||
    t.endsWith('/skill.md') ||
    t.endsWith('-skill.md') ||
    t.endsWith('_skill.md') ||
    t.endsWith('.skill.md') ||
    t.includes('skill.md') ||
    t.startsWith('skill:') ||
    t.startsWith('[skill]') ||
    note.icon === '🧩'
  );
}

export function loadActiveSkillNoteIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(ACTIVE_SKILLS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string' && Boolean(id))
      : [];
  } catch {
    return [];
  }
}

export function saveActiveSkillNoteIds(ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      ACTIVE_SKILLS_STORAGE_KEY,
      JSON.stringify(Array.from(new Set(ids)))
    );
  } catch {
    // ignore
  }
}

export interface CreateSkillNoteOptions {
  skillName?: string;
  description?: string;
  instructionsMarkdown?: string;
  connectionUrl?: string;
  ownerId?: string;
  ownerEmail?: string;
  ownerName?: string;
  semesterId?: string;
  courseId?: string;
}

export async function createEditableSkillNote(
  opts: CreateSkillNoteOptions = {}
): Promise<NoteRecord> {
  const now = Date.now();
  const cleanName = (opts.skillName || '').trim();
  const normalizedTitle = !cleanName
    ? 'skill.md'
    : cleanName.toLowerCase().includes('skill.md')
      ? cleanName
      : `${cleanName}/skill.md`;

  const desc =
    opts.description?.trim() ||
    'Skill AI kustom yang dapat mencari web (Tavily & Serper), mengelola catatan workspace, dan terhubung ke endpoint API/Webhook eksternal.';

  const yamlConfig = [
    `name: ${cleanName || 'custom-skill'}`,
    `description: ${desc}`,
    `web_search: auto # auto | tavily | serper`,
    `workspace_access: full # baca, buat, ubah, hapus catatan`,
    `connections:`,
    `  - name: external_webhook`,
    `    url: ${opts.connectionUrl?.trim() || 'https://httpbin.org/post'}`,
    `    method: POST`
  ].join('\n');

  const parsedCustomBlocks = opts.instructionsMarkdown?.trim()
    ? parseMarkdownToNotionBlocks(opts.instructionsMarkdown.trim()).map((b, i) => ({
        ...b,
        id: `blk-skill-custom-${now}-${i}`
      }))
    : [
        {
          id: `blk-skill-b1-${now}`,
          type: 'bullet' as BlockType,
          content:
            'Gunakan pencarian web **Tavily** & **Serper** (`web_search`) saat membutuhkan referensi terbaru, berita, atau dokumentasi teknis.'
        },
        {
          id: `blk-skill-b2-${now}`,
          type: 'bullet' as BlockType,
          content:
            'Kamu bebas membaca, membuat halaman baru, mengubah blok, atau merapikan catatan pengguna menggunakan tool workspace (`create_note`, `update_note`, `delete_note`).'
        },
        {
          id: `blk-skill-b3-${now}`,
          type: 'bullet' as BlockType,
          content:
            'Jika pengguna meminta integrasi ke layanan luar, panggil tool `call_external_connection` ke URL API/Webhook yang tertulis di bawah.'
        }
      ];

  const blocks: NoteBlock[] = [
    {
      id: `blk-skill-callout-${now}`,
      type: 'callout',
      calloutIcon: '🧩',
      content:
        'Halaman Skill AI (skill.md) — Edit halaman ini secara bebas di catatan. Semua instruksi, aturan tool, dan URL koneksi di halaman ini langsung dibaca oleh Miu AI saat skill aktif.'
    },
    {
      id: `blk-skill-yaml-${now}`,
      type: 'code',
      language: 'yaml',
      content: yamlConfig
    },
    {
      id: `blk-skill-h2-inst-${now}`,
      type: 'h2',
      content: 'Instruksi & Aturan Skill'
    },
    ...parsedCustomBlocks,
    {
      id: `blk-skill-h2-conn-${now}`,
      type: 'h2',
      content: 'Koneksi & Endpoint Eksternal'
    },
    {
      id: `blk-skill-conn-txt-${now}`,
      type: 'text',
      content: opts.connectionUrl?.trim()
        ? `Endpoint Aktif: ${opts.connectionUrl.trim()}`
        : 'Tuliskan URL Webhook / REST API / MCP HTTP (https://...) beserta format JSON atau header di bagian ini agar AI dapat memanggilnya otomatis.'
    }
  ];

  const newNote: NoteRecord = {
    id: `note-skill-${now}`,
    ownerId: opts.ownerId,
    ownerEmail: opts.ownerEmail || '',
    ownerName: opts.ownerName || '',
    parentId: null,
    semesterId: opts.semesterId || 'sem-1',
    courseId: opts.courseId || 'course-default',
    title: normalizedTitle,
    icon: '🧩',
    isFavorite: true,
    kanbanStatus: 'todo',
    blocks,
    createdAt: now,
    updatedAt: now
  };

  await db.notes.add(newNote);
  if (opts.ownerId && isNeonConfigured()) {
    void saveNoteToNeon(opts.ownerId, newNote);
  }
  return newNote;
}

export async function installSkillFromLibraryItem(
  item: SkillLibraryItem,
  opts: {
    ownerId?: string;
    ownerEmail?: string;
    ownerName?: string;
    semesterId?: string;
    courseId?: string;
  }
): Promise<NoteRecord> {
  const now = Date.now();
  const normalizedTitle = item.slug?.toLowerCase().includes('skill.md')
    ? item.slug
    : `${item.slug || item.name}/skill.md`;

  const yamlConfig = [
    `name: ${item.name}`,
    `slug: ${normalizedTitle}`,
    `category: ${item.category}`,
    `author: ${item.authorName}`,
    `summary: ${item.summary}`,
    `connection_url: ${item.connectionUrl || 'https://api.example.com/webhook'}`,
    `auth_header: Authorization`,
    `tools_allowed: [web_search, list_notes, read_note, search_notes, create_note, update_note, call_external_connection]`
  ].join('\n');

  const parsedInstructionBlocks = parseMarkdownToNotionBlocks(
    item.instructionsMarkdown ||
      `## Instruksi Utama\n- Jalankan tugas sesuai fungsi skill "${item.name}": ${item.functionDescription}`
  ).map((b, idx) => ({
    ...b,
    id: `blk-skill-inst-${now}-${idx}`
  }));

  const useCaseBlocks: NoteBlock[] =
    item.useCases && item.useCases.length > 0
      ? [
          {
            id: `blk-skill-uc-h2-${now}`,
            type: 'h2',
            content: 'Fungsi & Kegunaan Skill'
          },
          ...item.useCases.map((u, idx) => ({
            id: `blk-skill-uc-${now}-${idx}`,
            type: 'bullet' as BlockType,
            content: u
          }))
        ]
      : [];

  const blocks: NoteBlock[] = [
    {
      id: `blk-skill-callout-${now}`,
      type: 'callout',
      calloutIcon: item.icon || '🧩',
      content: `📚 Pustaka Skill (${item.isOfficial ? 'Resmi Miu' : `Oleh ${item.authorName}`}): ${item.functionDescription}`
    },
    {
      id: `blk-skill-h2-cfg-${now}`,
      type: 'h2',
      content: 'Konfigurasi & Koneksi Skill'
    },
    {
      id: `blk-skill-yaml-${now}`,
      type: 'code',
      language: 'yaml',
      content: yamlConfig
    },
    ...useCaseBlocks,
    ...parsedInstructionBlocks
  ];

  const newNote: NoteRecord = {
    id: `note-skill-${now}-${Math.random().toString(36).slice(2, 6)}`,
    ownerId: opts.ownerId,
    ownerEmail: opts.ownerEmail || '',
    ownerName: opts.ownerName || '',
    parentId: null,
    semesterId: opts.semesterId || 'sem-1',
    courseId: opts.courseId || 'course-default',
    title: normalizedTitle,
    icon: item.icon || '🧩',
    isFavorite: true,
    kanbanStatus: 'todo',
    blocks,
    createdAt: now,
    updatedAt: now
  };

  await db.notes.add(newNote);
  if (opts.ownerId && isNeonConfigured()) {
    void saveNoteToNeon(opts.ownerId, newNote);
  }
  if (typeof window !== 'undefined') {
    void fetch('/api/ai/skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'install', id: item.id })
    }).catch(() => {});
  }
  return newNote;
}

export function serializeActiveSkillsForPrompt(
  allNotes: NoteRecord[],
  activeSkillIds: string[]
): string {
  if (activeSkillIds.length === 0) return '';
  const activeSet = new Set(activeSkillIds);
  const skillNotes = allNotes.filter((n) => activeSet.has(n.id));
  if (skillNotes.length === 0) return '';

  const sections = skillNotes.map((sn, idx) => {
    const serialized = serializeBlocksForPrompt(sn.title || 'skill.md', sn.blocks || []);
    return `--- SKILL AKTIF #${idx + 1}: ${sn.title || 'skill.md'} (ID: ${sn.id}) ---\n${serialized}`;
  });

  return `\n\n=== SKILL.MD AKTIF (IKUTI INSTRUKSI & KONEKSI DARI SKILL INI) ===\n${sections.join('\n\n')}`;
}

export interface ParsedToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export function extractToolCallsFromText(text: string): ParsedToolCall[] {
  const calls: ParsedToolCall[] = [];
  if (!text) return calls;

  // Match <tool_call>{...}</tool_call> or ```tool_call ... ```
  const patterns = [
    /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/gi,
    /```tool_call\s*([\s\S]*?)\s*```/gi
  ];

  for (const regex of patterns) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const inner = (match[1] || '').trim();
      if (!inner) continue;
      try {
        const parsed = JSON.parse(inner) as {
          name?: unknown;
          tool?: unknown;
          arguments?: unknown;
          params?: unknown;
        };
        const toolName = String(parsed.name || parsed.tool || '').trim();
        const rawArgs = parsed.arguments ?? parsed.params ?? {};
        const args =
          rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs)
            ? (rawArgs as Record<string, unknown>)
            : {};
        if (toolName) {
          calls.push({ name: toolName, arguments: args });
        }
      } catch {
        // ignore malformed JSON tool call
      }
    }
  }

  return calls;
}

export function stripToolCallsFromText(text: string): string {
  if (!text) return '';
  let cleaned = text
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '')
    .replace(/```tool_call[\s\S]*?```/gi, '');

  // Also strip an unclosed trailing <tool_call>... while streaming
  const openIdx = cleaned.indexOf('<tool_call>');
  if (openIdx !== -1) {
    cleaned = cleaned.slice(0, openIdx);
  }
  const fenceIdx = cleaned.indexOf('```tool_call');
  if (fenceIdx !== -1) {
    cleaned = cleaned.slice(0, fenceIdx);
  }
  return cleaned.trim();
}

export interface AgentToolContext {
  activeNoteId: string;
  activeSemesterId: string;
  activeCourseId: string;
  currentUser: { id: string; email: string; name: string } | null;
  connectionsConfig: AIConnectionsConfig;
  activeSkillIds: string[];
  onSetActiveNoteId: (noteId: string) => void;
  onActivateSkillNoteId: (noteId: string) => void;
}

async function resolveTargetNote(
  noteIdArg: unknown,
  titleQueryArg: unknown,
  fallbackActiveNoteId: string
): Promise<NoteRecord | undefined> {
  const allNotes = await db.notes.toArray();
  const explicitId = typeof noteIdArg === 'string' ? noteIdArg.trim() : '';
  if (explicitId) {
    if (explicitId === 'active' || explicitId === 'current') {
      return allNotes.find((n) => n.id === fallbackActiveNoteId) || allNotes[0];
    }
    const byId = allNotes.find((n) => n.id === explicitId);
    if (byId) return byId;
  }

  const titleQ = typeof titleQueryArg === 'string' ? titleQueryArg.trim().toLowerCase() : '';
  if (titleQ) {
    const exact = allNotes.find((n) => (n.title || '').trim().toLowerCase() === titleQ);
    if (exact) return exact;
    const partial = allNotes.find((n) => (n.title || '').toLowerCase().includes(titleQ));
    if (partial) return partial;
  }

  return allNotes.find((n) => n.id === fallbackActiveNoteId) || allNotes[0];
}

function buildToolDisplayLabel(call: ParsedToolCall): string {
  const args = call.arguments;
  switch (call.name) {
    case 'web_search': {
      const prov = String(args.provider || 'auto').toUpperCase();
      return `Mencari di Web (${prov === 'AUTO' ? 'Tavily + Serper' : prov}): "${String(args.query || '')}"`;
    }
    case 'list_notes':
      return 'Membaca daftar seluruh catatan di workspace';
    case 'read_note':
      return `Membaca isi catatan ${String(args.titleQuery || args.noteId || 'aktif')}`;
    case 'search_notes':
      return `Mencari di catatan: "${String(args.query || '')}"`;
    case 'create_note':
      return `Membuat catatan baru: "${String(args.title || 'Catatan Baru')}"`;
    case 'update_note':
      return `Mengubah catatan ${String(args.titleQuery || args.newTitle || args.noteId || 'aktif')}`;
    case 'delete_note':
      return `Menghapus catatan ${String(args.titleQuery || args.noteId || '')}`;
    case 'open_note':
      return `Membuka catatan ${String(args.titleQuery || args.noteId || '')}`;
    case 'create_skill':
      return `Membuat Skill baru: "${String(args.name || 'skill.md')}"`;
    case 'browse_skill_library':
      return `Mencari di Pustaka Skill${args.query ? `: "${String(args.query)}"` : ''}`;
    case 'install_skill_from_library':
      return `Menginstal Skill dari Pustaka: "${String(args.skillId || args.query || '')}"`;
    case 'call_external_connection':
      return `Menghubungi Koneksi Eksternal: ${String(args.connectionName || args.url || 'API')}`;
    default:
      return `Menjalankan tool ${call.name}`;
  }
}

export async function executeAIAgentToolCall(
  call: ParsedToolCall,
  ctx: AgentToolContext
): Promise<{ ok: boolean; summary: string; output: string }> {
  const args = call.arguments;

  try {
    switch (call.name) {
      case 'web_search': {
        const query = String(args.query || '').trim();
        if (!query) {
          return {
            ok: false,
            summary: 'Query kosong',
            output: JSON.stringify({ error: 'Query pencarian tidak boleh kosong.' })
          };
        }

        let requestedProvider: SearchProviderMode =
          args.provider === 'tavily' || args.provider === 'serper'
            ? args.provider
            : ctx.connectionsConfig.searchProvider;

        if (!ctx.connectionsConfig.tavilyEnabled && requestedProvider !== 'serper') {
          requestedProvider = 'serper';
        } else if (!ctx.connectionsConfig.serperEnabled && requestedProvider !== 'tavily') {
          requestedProvider = 'tavily';
        }

        const resp = await fetch('/api/ai/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'search',
            query,
            provider: requestedProvider,
            maxResults: Number(args.maxResults) || 6,
            tavilyApiKey: ctx.connectionsConfig.tavilyApiKey.trim() || undefined,
            serperApiKey: ctx.connectionsConfig.serperApiKey.trim() || undefined
          })
        });

        const data = (await resp.json()) as {
          ok?: boolean;
          providerUsed?: string;
          answer?: string;
          results?: Array<{ title: string; url: string; snippet: string; provider: string }>;
          error?: string;
        };

        if (!resp.ok || !data.ok) {
          return {
            ok: false,
            summary: data.error || 'Gagal mencari di web',
            output: JSON.stringify({ error: data.error || 'Pencarian gagal' })
          };
        }

        const count = data.results?.length || 0;
        return {
          ok: true,
          summary: `${count} hasil ditemukan via ${data.providerUsed || requestedProvider}`,
          output: JSON.stringify({
            query,
            providerUsed: data.providerUsed,
            directAnswer: data.answer,
            results: data.results || []
          })
        };
      }

      case 'list_notes': {
        const allNotes = await db.notes.toArray();
        const filterStr = typeof args.filter === 'string' ? args.filter.trim().toLowerCase() : '';
        const list = allNotes
          .filter((n) => !filterStr || (n.title || '').toLowerCase().includes(filterStr))
          .map((n) => ({
            id: n.id,
            title: n.title || 'Tanpa Judul',
            icon: n.icon || '📄',
            parentId: n.parentId || null,
            isFavorite: Boolean(n.isFavorite),
            isSkill: isSkillNote(n),
            kanbanStatus: n.kanbanStatus || 'todo',
            dueDate: n.dueDate || '',
            blockCount: flattenBlocks(n.blocks).length,
            updatedAt: new Date(n.updatedAt).toISOString()
          }));

        return {
          ok: true,
          summary: `${list.length} catatan ditemukan di workspace`,
          output: JSON.stringify({ total: list.length, notes: list })
        };
      }

      case 'read_note': {
        const target = await resolveTargetNote(
          args.noteId,
          args.titleQuery,
          ctx.activeNoteId
        );
        if (!target) {
          return {
            ok: false,
            summary: 'Catatan tidak ditemukan',
            output: JSON.stringify({ error: 'Catatan tidak ditemukan.' })
          };
        }

        const blocksSummary = (target.blocks || []).map((b, idx) => ({
          index: idx,
          blockId: b.id,
          type: b.type,
          content: b.content,
          checked: b.checked,
          caption: b.caption,
          dueDate: b.dueDate,
          tableData: b.tableData,
          voiceTranscript: b.voiceData?.transcript
        }));

        return {
          ok: true,
          summary: `Membaca "${target.title || 'Tanpa Judul'}" (${blocksSummary.length} blok)`,
          output: JSON.stringify({
            id: target.id,
            title: target.title || 'Tanpa Judul',
            icon: target.icon || '📄',
            isFavorite: Boolean(target.isFavorite),
            isFullWidth: Boolean(target.isFullWidth),
            fontStyle: target.fontStyle || 'default',
            isSmallText: Boolean(target.isSmallText),
            isLocked: Boolean(target.isLocked),
            kanbanStatus: target.kanbanStatus || 'todo',
            dueDate: target.dueDate || '',
            blocks: blocksSummary
          })
        };
      }

      case 'search_notes': {
        const q = String(args.query || '').trim().toLowerCase();
        const allNotes = await db.notes.toArray();
        const matches = allNotes
          .filter((n) => {
            if ((n.title || '').toLowerCase().includes(q)) return true;
            return flattenBlocks(n.blocks).some((b) =>
              (b.content || '').toLowerCase().includes(q)
            );
          })
          .map((n) => ({
            id: n.id,
            title: n.title || 'Tanpa Judul',
            icon: n.icon || '📄',
            preview: flattenBlocks(n.blocks)
              .map((b) => b.content)
              .filter(Boolean)
              .join(' ')
              .slice(0, 320)
          }));

        return {
          ok: true,
          summary: `${matches.length} catatan cocok dengan "${q}"`,
          output: JSON.stringify({ query: q, matches })
        };
      }

      case 'create_note': {
        if (!ctx.connectionsConfig.notesCrudEnabled) {
          return {
            ok: false,
            summary: 'Akses ubah catatan dinonaktifkan di Koneksi',
            output: JSON.stringify({ error: 'Akses CRUD catatan sedang dinonaktifkan.' })
          };
        }

        const now = Date.now();
        const title = String(args.title || 'Catatan Baru').trim();
        const icon = String(args.icon || (title.toLowerCase().includes('skill.md') ? '🧩' : '📄')).trim();
        const mdContent = String(args.markdownContent || args.content || '').trim();
        const parsedBlocks = mdContent ? parseMarkdownToNotionBlocks(mdContent) : [];

        const blocks: NoteBlock[] =
          parsedBlocks.length > 0
            ? parsedBlocks.map((b, i) => ({
                ...b,
                id: `blk-ai-${now}-${i}`
              }))
            : [{ id: `blk-ai-${now}-0`, type: 'text', content: '' }];

        const newNote: NoteRecord = {
          id: `note-${now}-${Math.random().toString(36).slice(2, 6)}`,
          ownerId: ctx.currentUser?.id,
          ownerEmail: ctx.currentUser?.email || '',
          ownerName: ctx.currentUser?.name || '',
          parentId:
            typeof args.parentId === 'string' && args.parentId.trim()
              ? args.parentId.trim()
              : null,
          semesterId: ctx.activeSemesterId || 'sem-1',
          courseId: ctx.activeCourseId || 'course-default',
          title,
          icon,
          isFavorite: Boolean(args.isFavorite),
          kanbanStatus:
            args.kanbanStatus === 'in_progress' || args.kanbanStatus === 'done'
              ? args.kanbanStatus
              : 'todo',
          dueDate: typeof args.dueDate === 'string' ? args.dueDate : '',
          blocks,
          createdAt: now,
          updatedAt: now
        };

        await db.notes.add(newNote);
        if (ctx.currentUser?.id && isNeonConfigured()) {
          void saveNoteToNeon(ctx.currentUser.id, newNote);
        }

        if (isSkillNote(newNote)) {
          ctx.onActivateSkillNoteId(newNote.id);
        }
        if (args.openAfterCreate !== false) {
          ctx.onSetActiveNoteId(newNote.id);
        }

        return {
          ok: true,
          summary: `Catatan "${title}" dibuat (${blocks.length} blok)`,
          output: JSON.stringify({
            ok: true,
            noteId: newNote.id,
            title: newNote.title,
            blockCount: blocks.length
          })
        };
      }

      case 'update_note': {
        if (!ctx.connectionsConfig.notesCrudEnabled) {
          return {
            ok: false,
            summary: 'Akses ubah catatan dinonaktifkan di Koneksi',
            output: JSON.stringify({ error: 'Akses CRUD catatan sedang dinonaktifkan.' })
          };
        }

        const target = await resolveTargetNote(
          args.noteId,
          args.titleQuery,
          ctx.activeNoteId
        );
        if (!target) {
          return {
            ok: false,
            summary: 'Catatan tidak ditemukan',
            output: JSON.stringify({ error: 'Catatan yang ingin diubah tidak ditemukan.' })
          };
        }

        const now = Date.now();
        let nextBlocks = [...(target.blocks || [])];
        const mode = String(args.mode || 'append_markdown').trim();
        const mdContent = String(args.markdownContent || args.content || '').trim();
        const targetBlockId = typeof args.blockId === 'string' ? args.blockId.trim() : '';

        if (mode === 'replace_all_markdown' && mdContent) {
          const parsed = parseMarkdownToNotionBlocks(mdContent);
          if (parsed.length > 0) {
            nextBlocks = parsed.map((b, i) => ({
              ...b,
              id: `blk-ai-rep-${now}-${i}`
            }));
          }
        } else if (mode === 'prepend_markdown' && mdContent) {
          const parsed = parseMarkdownToNotionBlocks(mdContent).map((b, i) => ({
            ...b,
            id: `blk-ai-pre-${now}-${i}`
          }));
          nextBlocks = [...parsed, ...nextBlocks];
        } else if (mode === 'append_markdown' && mdContent) {
          const parsed = parseMarkdownToNotionBlocks(mdContent).map((b, i) => ({
            ...b,
            id: `blk-ai-app-${now}-${i}`
          }));
          const isSingleEmpty =
            nextBlocks.length === 1 &&
            nextBlocks[0].type === 'text' &&
            !nextBlocks[0].content.trim();
          nextBlocks = isSingleEmpty ? parsed : [...nextBlocks, ...parsed];
        } else if (mode === 'insert_after_block' && targetBlockId && mdContent) {
          const parsed = parseMarkdownToNotionBlocks(mdContent).map((b, i) => ({
            ...b,
            id: `blk-ai-ins-${now}-${i}`
          }));
          nextBlocks = insertBlocksRelativeDeep(
            nextBlocks,
            targetBlockId,
            'after',
            parsed
          );
        } else if (mode === 'update_block' && targetBlockId) {
          nextBlocks = mapBlockDeep(nextBlocks, targetBlockId, (b) => ({
            ...b,
            ...(typeof args.blockContent === 'string'
              ? { content: args.blockContent }
              : mdContent
                ? { content: mdContent }
                : {}),
            ...(typeof args.blockType === 'string'
              ? { type: args.blockType as BlockType }
              : {}),
            ...(typeof args.checked === 'boolean' ? { checked: args.checked } : {})
          }));
        } else if (mode === 'delete_block' && targetBlockId) {
          const removed = removeBlockDeep(nextBlocks, targetBlockId).blocks;
          nextBlocks =
            removed.length > 0
              ? removed
              : [{ id: createBlockId(), type: 'text', content: '' }];
        }

        const nextTitle =
          typeof args.newTitle === 'string' && args.newTitle.trim()
            ? args.newTitle.trim()
            : target.title;
        const nextIcon =
          typeof args.icon === 'string' && args.icon.trim()
            ? args.icon.trim()
            : target.icon;
        const nextFontStyle: NoteFontStyle =
          args.fontStyle === 'serif' ||
          args.fontStyle === 'mono' ||
          args.fontStyle === 'default'
            ? args.fontStyle
            : target.fontStyle || 'default';
        const nextSmallText =
          typeof args.isSmallText === 'boolean'
            ? args.isSmallText
            : Boolean(target.isSmallText);
        const nextLocked =
          typeof args.isLocked === 'boolean'
            ? args.isLocked
            : Boolean(target.isLocked);
        const nextFullWidth =
          typeof args.isFullWidth === 'boolean'
            ? args.isFullWidth
            : Boolean(target.isFullWidth);
        const nextFavorite =
          typeof args.isFavorite === 'boolean'
            ? args.isFavorite
            : Boolean(target.isFavorite);
        const nextKanban: NoteKanbanStatus =
          args.kanbanStatus === 'todo' ||
          args.kanbanStatus === 'in_progress' ||
          args.kanbanStatus === 'done'
            ? args.kanbanStatus
            : target.kanbanStatus || 'todo';
        const nextDueDate =
          typeof args.dueDate === 'string' ? args.dueDate : target.dueDate || '';

        const nextShareSettings = {
          isPublicLink: Boolean(target.shareSettings?.isPublicLink),
          publicRole: target.shareSettings?.publicRole || 'view',
          collaborators: target.shareSettings?.collaborators || [],
          fontStyle: nextFontStyle,
          isSmallText: nextSmallText,
          isLocked: nextLocked
        };

        const updatedNote: NoteRecord = {
          ...target,
          title: nextTitle,
          icon: nextIcon,
          isFavorite: nextFavorite,
          isFullWidth: nextFullWidth,
          fontStyle: nextFontStyle,
          isSmallText: nextSmallText,
          isLocked: nextLocked,
          kanbanStatus: nextKanban,
          dueDate: nextDueDate,
          blocks: nextBlocks,
          shareSettings: nextShareSettings,
          updatedAt: now
        };

        await db.notes.put(updatedNote);
        const ownerId = updatedNote.ownerId || ctx.currentUser?.id;
        if (ownerId && isNeonConfigured()) {
          void saveNoteToNeon(ownerId, updatedNote);
        }

        return {
          ok: true,
          summary: `Catatan "${updatedNote.title || 'Tanpa Judul'}" berhasil diperbarui`,
          output: JSON.stringify({
            ok: true,
            noteId: updatedNote.id,
            title: updatedNote.title,
            blockCount: updatedNote.blocks.length
          })
        };
      }

      case 'delete_note': {
        if (!ctx.connectionsConfig.notesCrudEnabled) {
          return {
            ok: false,
            summary: 'Akses hapus catatan dinonaktifkan di Koneksi',
            output: JSON.stringify({ error: 'Akses CRUD catatan sedang dinonaktifkan.' })
          };
        }

        const target = await resolveTargetNote(
          args.noteId,
          args.titleQuery,
          ''
        );
        if (!target) {
          return {
            ok: false,
            summary: 'Catatan tidak ditemukan',
            output: JSON.stringify({ error: 'Catatan yang ingin dihapus tidak ditemukan.' })
          };
        }

        const allNotes = await db.notes.toArray();
        const idsToDelete = new Set<string>([target.id]);
        let added = true;
        while (added) {
          added = false;
          for (const candidate of allNotes) {
            if (
              candidate.parentId &&
              idsToDelete.has(candidate.parentId) &&
              !idsToDelete.has(candidate.id)
            ) {
              idsToDelete.add(candidate.id);
              added = true;
            }
          }
        }

        const remaining = allNotes.filter((n) => !idsToDelete.has(n.id));
        if (remaining.length === 0) {
          // Reset last remaining note instead of leaving workspace empty
          const resetNote: NoteRecord = {
            ...target,
            title: '',
            icon: '📄',
            cover: '',
            blocks: [{ id: createBlockId(), type: 'text', content: '' }],
            updatedAt: Date.now()
          };
          await db.notes.put(resetNote);
          if (ctx.currentUser?.id && isNeonConfigured()) {
            void saveNoteToNeon(ctx.currentUser.id, resetNote);
          }
          ctx.onSetActiveNoteId(resetNote.id);
        } else {
          for (const delId of idsToDelete) {
            await db.notes.delete(delId);
            if (ctx.currentUser?.id && isNeonConfigured()) {
              void deleteNoteFromNeon(ctx.currentUser.id, delId);
            }
          }
          if (idsToDelete.has(ctx.activeNoteId)) {
            ctx.onSetActiveNoteId(remaining[0].id);
          }
        }

        return {
          ok: true,
          summary: `Catatan "${target.title || 'Tanpa Judul'}" telah dihapus`,
          output: JSON.stringify({
            ok: true,
            deletedNoteId: target.id,
            deletedTitle: target.title
          })
        };
      }

      case 'open_note': {
        const target = await resolveTargetNote(
          args.noteId,
          args.titleQuery,
          ctx.activeNoteId
        );
        if (!target) {
          return {
            ok: false,
            summary: 'Catatan tidak ditemukan',
            output: JSON.stringify({ error: 'Catatan tidak ditemukan.' })
          };
        }
        ctx.onSetActiveNoteId(target.id);
        return {
          ok: true,
          summary: `Membuka halaman "${target.title || 'Tanpa Judul'}"`,
          output: JSON.stringify({
            ok: true,
            openedNoteId: target.id,
            title: target.title
          })
        };
      }

      case 'create_skill': {
        const created = await createEditableSkillNote({
          skillName: typeof args.name === 'string' ? args.name : 'skill.md',
          description:
            typeof args.description === 'string' ? args.description : undefined,
          instructionsMarkdown:
            typeof args.instructionsMarkdown === 'string'
              ? args.instructionsMarkdown
              : typeof args.content === 'string'
                ? args.content
                : undefined,
          connectionUrl:
            typeof args.connectionUrl === 'string' ? args.connectionUrl : undefined,
          ownerId: ctx.currentUser?.id,
          ownerEmail: ctx.currentUser?.email,
          ownerName: ctx.currentUser?.name,
          semesterId: ctx.activeSemesterId,
          courseId: ctx.activeCourseId
        });

        ctx.onActivateSkillNoteId(created.id);
        ctx.onSetActiveNoteId(created.id);

        return {
          ok: true,
          summary: `Skill "${created.title}" dibuat & dibuka di editor catatan`,
          output: JSON.stringify({
            ok: true,
            skillNoteId: created.id,
            title: created.title
          })
        };
      }

      case 'call_external_connection': {
        const connName =
          typeof args.connectionName === 'string'
            ? args.connectionName.trim().toLowerCase()
            : '';
        const matchedConn = connName
          ? ctx.connectionsConfig.customConnections.find(
              (c) => c.enabled && c.name.trim().toLowerCase() === connName
            )
          : undefined;

        const targetUrl = String(args.url || matchedConn?.url || '').trim();
        if (!targetUrl) {
          return {
            ok: false,
            summary: 'URL koneksi tidak ditemukan',
            output: JSON.stringify({
              error: 'Masukkan parameter url HTTPS atau nama koneksi yang terdaftar.'
            })
          };
        }

        const method = String(args.method || matchedConn?.method || 'GET').toUpperCase();
        const headers: Record<string, string> = {};
        if (matchedConn?.authHeader?.trim()) {
          headers.Authorization = matchedConn.authHeader.trim();
        }
        if (args.headers && typeof args.headers === 'object') {
          for (const [k, v] of Object.entries(args.headers as Record<string, unknown>)) {
            if (typeof v === 'string') headers[k] = v;
          }
        }

        const resp = await fetch('/api/ai/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'http_request',
            url: targetUrl,
            method,
            headers,
            payload: args.payload ?? args.body
          })
        });

        const data = (await resp.json()) as {
          ok?: boolean;
          status?: number;
          responsePreview?: string;
          error?: string;
        };

        if (!resp.ok || data.error) {
          return {
            ok: false,
            summary: data.error || `HTTP ${data.status || resp.status}`,
            output: JSON.stringify({ error: data.error || 'Koneksi gagal', status: data.status })
          };
        }

        return {
          ok: true,
          summary: `Terhubung ke ${targetUrl} (HTTP ${data.status})`,
          output: JSON.stringify({
            ok: data.ok,
            status: data.status,
            response: data.responsePreview
          })
        };
      }

      case 'browse_skill_library': {
        const query = String(args.query || '').trim().toLowerCase();
        const category = String(args.category || '').trim().toLowerCase();

        let librarySkills: SkillLibraryItem[] = mergeSkillLibraryItems(
          OFFICIAL_SKILL_LIBRARY,
          loadLocalCommunitySkills()
        );
        try {
          const resp = await fetch('/api/ai/skills', { method: 'GET' });
          if (resp.ok) {
            const data = (await resp.json()) as { skills?: SkillLibraryItem[] };
            if (Array.isArray(data.skills)) {
              librarySkills = mergeSkillLibraryItems(librarySkills, data.skills);
            }
          }
        } catch {
          // fallback to merged official + local community
        }

        const filtered = librarySkills.filter(item => {
          if (category && category !== 'all' && item.category !== category) return false;
          if (!query) return true;
          const haystack = `${item.name} ${item.slug} ${item.summary} ${item.functionDescription} ${item.tags.join(' ')}`.toLowerCase();
          return haystack.includes(query);
        });

        return {
          ok: true,
          summary: `Ditemukan ${filtered.length} skill di Pustaka Skill`,
          output: JSON.stringify({
            total: filtered.length,
            skills: filtered.slice(0, 12).map(s => ({
              id: s.id,
              name: s.name,
              slug: s.slug,
              icon: s.icon,
              category: s.category,
              authorName: s.authorName,
              isOfficial: s.isOfficial,
              installCount: s.installCount,
              summary: s.summary,
              functionDescription: s.functionDescription,
              useCases: s.useCases,
              tags: s.tags
            }))
          })
        };
      }

      case 'install_skill_from_library': {
        const skillId = String(args.skillId || '').trim();
        const query = String(args.query || skillId).trim().toLowerCase();

        let librarySkills: SkillLibraryItem[] = mergeSkillLibraryItems(
          OFFICIAL_SKILL_LIBRARY,
          loadLocalCommunitySkills()
        );
        try {
          const resp = await fetch('/api/ai/skills', { method: 'GET' });
          if (resp.ok) {
            const data = (await resp.json()) as { skills?: SkillLibraryItem[] };
            if (Array.isArray(data.skills)) {
              librarySkills = mergeSkillLibraryItems(librarySkills, data.skills);
            }
          }
        } catch {
          // ignore network error
        }

        const targetItem =
          librarySkills.find(s => s.id === skillId) ||
          librarySkills.find(s => s.slug.toLowerCase() === query || s.name.toLowerCase() === query) ||
          librarySkills.find(
            s =>
              s.name.toLowerCase().includes(query) ||
              s.slug.toLowerCase().includes(query) ||
              s.summary.toLowerCase().includes(query)
          );

        if (!targetItem) {
          return {
            ok: false,
            summary: `Skill "${skillId || query}" tidak ditemukan di Pustaka`,
            output: JSON.stringify({
              error: `Skill "${skillId || query}" tidak ditemukan di Pustaka Skill. Gunakan browse_skill_library terlebih dahulu.`
            })
          };
        }

        const installedNote = await installSkillFromLibraryItem(targetItem, {
          ownerId: ctx.currentUser?.id,
          ownerEmail: ctx.currentUser?.email,
          ownerName: ctx.currentUser?.name,
          semesterId: ctx.activeSemesterId,
          courseId: ctx.activeCourseId
        });

        ctx.onActivateSkillNoteId(installedNote.id);
        ctx.onSetActiveNoteId(installedNote.id);

        return {
          ok: true,
          summary: `Skill "${targetItem.name}" berhasil diinstal ke catatan sebagai "${installedNote.title}"`,
          output: JSON.stringify({
            ok: true,
            installedNoteId: installedNote.id,
            title: installedNote.title,
            skillName: targetItem.name,
            functionDescription: targetItem.functionDescription
          })
        };
      }

      default:
        return {
          ok: false,
          summary: `Tool "${call.name}" tidak dikenali`,
          output: JSON.stringify({ error: `Tool "${call.name}" tidak tersedia.` })
        };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal menjalankan tool.';
    return {
      ok: false,
      summary: msg,
      output: JSON.stringify({ error: msg })
    };
  }
}

export function buildAgentToolsSystemAddendum(
  connectionsConfig: AIConnectionsConfig,
  allNotes: NoteRecord[],
  activeSkillIds: string[]
): string {
  const lines: string[] = [
    '\n\n=== KEMAMPUAN TOOL CALLING & AGENT WORKSPACE ===',
    'Kamu memiliki akses langsung ke tool eksekusi nyata. Jika pengguna meminta kamu mencari informasi di internet/web, membaca/membuat/mengubah/menghapus catatan, membuat skill.md, atau memanggil API eksternal, kamu WAJIB memanggil tool dengan menulis blok XML berikut (bisa lebih dari satu jika diperlukan):',
    '<tool_call>{"name": "nama_tool", "arguments": {...}}</tool_call>',
    'Setelah kamu menulis <tool_call>...</tool_call>, BERHENTI dan tunggu sistem memberikan <tool_response> sebelum menyusun jawaban akhir kepada pengguna.',
    '\nDaftar Tool yang Tersedia:'
  ];

  if (connectionsConfig.webBrowserEnabled) {
    lines.push(
      `- web_search: Cari informasi real-time di internet menggunakan Tavily & Google Serper. Arguments: {"query": "kata kunci pencarian", "provider": "auto" | "tavily" | "serper"} (default provider saat ini: "${connectionsConfig.searchProvider}").`
    );
  }

  if (connectionsConfig.notesCrudEnabled) {
    lines.push(
      '- list_notes: Lihat daftar seluruh catatan/halaman yang ada di workspace pengguna. Arguments: {"filter": "opsional"}',
      '- read_note: Baca isi lengkap dan struktur blok dari sebuah catatan. Arguments: {"noteId": "id catatan atau active", "titleQuery": "judul catatan"}',
      '- search_notes: Cari teks di seluruh catatan workspace. Arguments: {"query": "kata kunci"}',
      '- create_note: Buat halaman catatan baru di workspace (otomatis terbuka di editor). Arguments: {"title": "Judul Halaman", "icon": "🚀", "markdownContent": "## Subjudul\\n- Isi poin...", "parentId": null, "isFavorite": false, "openAfterCreate": true}',
      '- update_note: Ubah isi atau properti catatan yang sudah ada. Arguments: {"noteId": "active atau id", "titleQuery": "opsional nama catatan", "newTitle": "opsional judul baru", "icon": "opsional emoji", "fontStyle": "default" | "serif" | "mono", "isSmallText": false, "isFullWidth": false, "isLocked": false, "mode": "append_markdown" | "prepend_markdown" | "replace_all_markdown" | "update_block" | "insert_after_block" | "delete_block", "markdownContent": "teks markdown baru", "blockId": "id blok spesifik jika mode *_block"}',
      '- delete_note: Hapus catatan beserta subhalamannya dari workspace. Arguments: {"noteId": "id catatan", "titleQuery": "judul catatan"}',
      '- open_note: Pindahkan tampilan editor pengguna ke catatan tertentu. Arguments: {"noteId": "id catatan", "titleQuery": "judul catatan"}',
      '- create_skill: Buat halaman skill baru (skill.md) yang dapat diedit di catatan dan langsung diaktifkan. Arguments: {"name": "nama-skill/skill.md", "description": "deskripsi skill", "instructionsMarkdown": "## Instruksi...", "connectionUrl": "https://..."}',
      '- browse_skill_library: Jelajahi & cari skill di Pustaka Skill (Skill Library resmi & komunitas) beserta penjelasan fungsi setiap skill. Arguments: {"query": "kata kunci opsional", "category": "academic | engineering | productivity | writing | integration | all"}',
      '- install_skill_from_library: Instal skill dari Pustaka Skill ke dalam catatan workspace pengguna sebagai halaman skill.md yang bisa diedit. Arguments: {"skillId": "id skill (opsional)", "query": "nama atau kata kunci skill"}'
    );
  }

  lines.push(
    '- call_external_connection: Panggil endpoint API / Webhook HTTPS eksternal (dari konfigurasi Koneksi atau dari skill.md aktif). Arguments: {"url": "https://...", "connectionName": "opsional", "method": "GET" | "POST", "headers": {}, "payload": {}}'
  );

  // Add compact index of workspace notes so AI knows existing note IDs & titles immediately
  if (allNotes.length > 0) {
    const indexLines = allNotes.slice(0, 40).map(
      (n) =>
        `  • ID: "${n.id}" | Judul: "${n.title || 'Tanpa Judul'}" | Ikon: ${n.icon || '📄'}${
          isSkillNote(n) ? ' [SKILL.MD]' : ''
        }`
    );
    lines.push(
      `\nDaftar Catatan di Workspace Saat Ini (${allNotes.length} halaman):\n${indexLines.join('\n')}`
    );
  }

  if (connectionsConfig.customConnections.length > 0) {
    const activeConns = connectionsConfig.customConnections.filter((c) => c.enabled);
    if (activeConns.length > 0) {
      lines.push(
        '\nKoneksi Eksternal Terdaftar:',
        ...activeConns.map((c) => `  • ${c.name}: ${c.method} ${c.url}`)
      );
    }
  }

  const skillsSection = serializeActiveSkillsForPrompt(allNotes, activeSkillIds);
  if (skillsSection) {
    lines.push(skillsSection);
  }

  return lines.join('\n');
}

export async function runAgentWithToolsStream(params: {
  config: AIConfig;
  baseSystemPrompt: string;
  userPrompt: string;
  history: AIChatMessage[];
  imageUrl?: string;
  signal?: AbortSignal;
  toolContext: AgentToolContext;
  onTextChunk: (visibleText: string) => void;
  onToolExecutionsUpdate: (executions: AIToolExecutionRecord[]) => void;
}): Promise<{ finalText: string; toolExecutions: AIToolExecutionRecord[] }> {
  const {
    config,
    baseSystemPrompt,
    userPrompt,
    history,
    imageUrl,
    signal,
    toolContext,
    onTextChunk,
    onToolExecutionsUpdate
  } = params;

  const allNotesSnapshot = await db.notes.toArray();
  const fullSystemPrompt = `${baseSystemPrompt}${buildAgentToolsSystemAddendum(
    toolContext.connectionsConfig,
    allNotesSnapshot,
    toolContext.activeSkillIds
  )}`;

  const workingHistory: AIChatMessage[] = [...history];
  let currentPrompt = userPrompt;
  let accumulatedVisibleText = '';
  const executions: AIToolExecutionRecord[] = [];

  for (let step = 0; step < 4; step++) {
    if (signal?.aborted) break;

    let stepRawOutput = '';
    await runExternalAIStream(
      config,
      fullSystemPrompt,
      currentPrompt,
      (rawChunk) => {
        stepRawOutput = rawChunk;
        const cleanedChunk = stripToolCallsFromText(rawChunk);
        const combined = [accumulatedVisibleText, cleanedChunk]
          .filter(Boolean)
          .join('\n\n');
        onTextChunk(combined);
      },
      step === 0 ? imageUrl : undefined,
      workingHistory,
      signal
    );

    const parsedCalls = extractToolCallsFromText(stepRawOutput);
    const stepVisible = stripToolCallsFromText(stepRawOutput);
    if (stepVisible) {
      accumulatedVisibleText = [accumulatedVisibleText, stepVisible]
        .filter(Boolean)
        .join('\n\n');
      onTextChunk(accumulatedVisibleText);
    }

    if (parsedCalls.length === 0) {
      break;
    }

    const toolResultsBlocks: string[] = [];
    for (let i = 0; i < parsedCalls.length; i++) {
      if (signal?.aborted) break;
      const call = parsedCalls[i];
      const execId = `tool-${Date.now()}-${step}-${i}`;
      const record: AIToolExecutionRecord = {
        id: execId,
        name: call.name,
        label: buildToolDisplayLabel(call),
        status: 'running'
      };
      executions.push(record);
      onToolExecutionsUpdate([...executions]);

      const result = await executeAIAgentToolCall(call, toolContext);
      record.status = result.ok ? 'done' : 'error';
      record.summary = result.summary;
      onToolExecutionsUpdate([...executions]);

      toolResultsBlocks.push(
        `<tool_response name="${call.name}">\n${result.output}\n</tool_response>`
      );
    }

    workingHistory.push(
      { role: 'user', content: currentPrompt },
      { role: 'assistant', content: stepRawOutput }
    );
    currentPrompt = `${toolResultsBlocks.join('\n\n')}\n\nBerdasarkan hasil eksekusi tool di atas, berikan jawaban akhir yang jelas dan terstruktur kepada pengguna (atau panggil tool lanjutan jika masih diperlukan). Jangan tampilkan tag <tool_call> lagi jika semua langkah sudah selesai.`;
  }

  return {
    finalText:
      accumulatedVisibleText.trim() ||
      (executions.length > 0
        ? `Selesai menjalankan ${executions.length} tindakan pada workspace.`
        : ''),
    toolExecutions: executions
  };
}
