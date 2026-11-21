import { db } from '../db/database';
import type {
  AIChatMessage,
  AIProviderId,
  LyricLine,
  NoteBlock,
  NoteBlockBase,
  NoteRecord,
  PrayerTimings
} from '../types/miu';
import { findBlockById, flattenBlocks } from '../utils/blockTreeHelper';
import {
  aggregateDatabaseForChart,
  computeMetricValue,
  databaseToMarkdownTable
} from '../utils/databaseHelper';

// --- LRCLIB Live Synced Lyrics Parser & Fetcher ---
export function parseLrc(lrcText: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const regex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\](.*)/;

  for (const rawLine of lrcText.split('\n')) {
    const match = rawLine.match(regex);
    if (!match) continue;
    const mins = parseInt(match[1], 10);
    const secs = parseInt(match[2], 10);
    const msStr = (match[3] || '0').padEnd(3, '0').slice(0, 3);
    const ms = parseInt(msStr, 10);
    const text = match[4].trim();
    if (text) {
      lines.push({
        timeMs: mins * 60 * 1000 + secs * 1000 + ms,
        text
      });
    }
  }
  return lines.sort((a, b) => a.timeMs - b.timeMs);
}

export async function fetchSyncedLyricsFromLRCLIB(
  trackName: string,
  artistName: string,
  durationMs?: number
): Promise<LyricLine[]> {
  if (!trackName) return [];
  try {
    const params = new URLSearchParams({
      track_name: trackName,
      artist_name: artistName
    });
    if (durationMs && durationMs > 0) {
      params.set('duration', String(Math.round(durationMs / 1000)));
    }
    const resp = await fetch(`https://lrclib.net/api/get?${params.toString()}`);
    if (resp.ok) {
      const json = await resp.json();
      if (json.syncedLyrics) {
        return parseLrc(json.syncedLyrics);
      }
      if (json.plainLyrics) {
        return (json.plainLyrics as string)
          .split('\n')
          .filter(Boolean)
          .map((t, i) => ({ timeMs: i * 4500, text: t }));
      }
    }

    // Fallback search query
    const searchResp = await fetch(
      `https://lrclib.net/api/search?q=${encodeURIComponent(`${trackName} ${artistName}`)}`
    );
    if (searchResp.ok) {
      const results = await searchResp.json();
      const first = Array.isArray(results)
        ? results.find((r) => r.syncedLyrics) || results[0]
        : null;
      if (first?.syncedLyrics) {
        return parseLrc(first.syncedLyrics);
      }
      if (first?.plainLyrics) {
        return (first.plainLyrics as string)
          .split('\n')
          .filter(Boolean)
          .map((t, i) => ({ timeMs: i * 4500, text: t }));
      }
    }
  } catch {
    // Offline or network blocked
  }
  return [];
}

// --- Prayer Times (Aladhan API method 20 / Kemenag RI + Monthly IndexedDB Cache) ---
export const INDONESIA_CITIES = [
  'Jakarta',
  'Bandung',
  'Yogyakarta',
  'Surabaya',
  'Malang',
  'Semarang',
  'Depok',
  'Bogor',
  'Medan',
  'Makassar'
];

const DEFAULT_FALLBACK_TIMINGS: PrayerTimings = {
  Fajr: '04:21',
  Dhuhr: '11:48',
  Asr: '15:06',
  Maghrib: '17:55',
  Isha: '19:07'
};

export async function getPrayerTimingsForCity(city: string): Promise<PrayerTimings> {
  const cleanCity = city.trim() || 'Jakarta';
  const monthKey = new Date().toISOString().slice(0, 7);
  const cacheId = `${cleanCity.toLowerCase()}_${monthKey}`;

  const cached = await db.prayerCache.get(cacheId);
  if (cached) return cached.timings;

  try {
    const resp = await fetch(
      `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(
        cleanCity
      )}&country=Indonesia&method=20`
    );
    if (resp.ok) {
      const json = await resp.json();
      const t = json?.data?.timings;
      if (t) {
        const timings: PrayerTimings = {
          Fajr: String(t.Fajr).slice(0, 5),
          Dhuhr: String(t.Dhuhr).slice(0, 5),
          Asr: String(t.Asr).slice(0, 5),
          Maghrib: String(t.Maghrib).slice(0, 5),
          Isha: String(t.Isha).slice(0, 5)
        };
        await db.prayerCache.put({
          id: cacheId,
          city: cleanCity,
          monthKey,
          timings,
          fetchedAt: Date.now()
        });
        return timings;
      }
    }
  } catch {
    // Fallback to offline default schedule
  }

  return DEFAULT_FALLBACK_TIMINGS;
}

export function getNextPrayerInfo(timings: PrayerTimings): {
  name: string;
  time: string;
  minutesRemaining: number;
} {
  const now = new Date();
  const currentMins = now.getHours() * 60 + now.getMinutes();

  const list: Array<{ name: string; time: string }> = [
    { name: 'Subuh', time: timings.Fajr },
    { name: 'Dzuhur', time: timings.Dhuhr },
    { name: 'Ashar', time: timings.Asr },
    { name: 'Maghrib', time: timings.Maghrib },
    { name: 'Isya', time: timings.Isha }
  ];

  for (const item of list) {
    const [h, m] = item.time.split(':').map(Number);
    const targetMins = h * 60 + m;
    if (targetMins > currentMins) {
      return {
        name: item.name,
        time: item.time,
        minutesRemaining: targetMins - currentMins
      };
    }
  }

  const [fh, fm] = timings.Fajr.split(':').map(Number);
  return {
    name: 'Subuh',
    time: timings.Fajr,
    minutesRemaining: 24 * 60 - currentMins + fh * 60 + fm
  };
}

// --- External AI (Groq Server Proxy + Custom AI Provider) Client ---
const CUSTOM_AI_STORAGE = 'miu_custom_ai_provider_v1';

const DEFAULT_GROQ_MODEL = 'qwen/qwen3.8-27b';

export interface AIConfig {
  provider: AIProviderId;
  apiKey: string;
  model: string;
  baseUrl?: string;
  ollamaUrl: string;
}

export const DEFAULT_MODELS: Record<AIProviderId, string> = {
  groq: DEFAULT_GROQ_MODEL,
  custom: 'gpt-4o-mini',
  gemini: 'gemini-2.0-flash',
  claude: 'claude-3-5-sonnet-latest',
  openrouter: 'google/gemini-2.0-flash-001',
  openai: 'gpt-4o-mini',
  ollama: 'llama3.2'
};

export const DEFAULT_BASE_URLS: Record<AIProviderId, string> = {
  groq: '/api/ai/chat',
  custom: 'https://api.openai.com/v1/chat/completions',
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
  claude: 'https://api.anthropic.com/v1/messages',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  openai: 'https://api.openai.com/v1/chat/completions',
  ollama: 'http://localhost:11434'
};

export function loadDefaultGroqConfig(modelOverride?: string): AIConfig {
  return {
    provider: 'groq',
    apiKey: '',
    model: modelOverride?.trim() || DEFAULT_GROQ_MODEL,
    baseUrl: DEFAULT_BASE_URLS.groq,
    ollamaUrl: 'http://localhost:11434'
  };
}

export function loadAIConfig(): AIConfig {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(CUSTOM_AI_STORAGE);
      if (raw) {
        const parsed = JSON.parse(raw);
        const prov = (parsed.provider as AIProviderId) || 'custom';
        return {
          provider: prov,
          apiKey: parsed.apiKey ? atob(parsed.apiKey) : '',
          model: parsed.model || DEFAULT_MODELS[prov] || 'gpt-4o-mini',
          baseUrl: parsed.baseUrl || DEFAULT_BASE_URLS[prov] || '',
          ollamaUrl: parsed.ollamaUrl || 'http://localhost:11434'
        };
      }
    } catch {
      // ignore
    }
  }
  return {
    provider: 'custom',
    apiKey: '',
    model: 'gpt-4o-mini',
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    ollamaUrl: 'http://localhost:11434'
  };
}

export function saveAIConfig(config: AIConfig): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    CUSTOM_AI_STORAGE,
    JSON.stringify({
      provider: config.provider,
      apiKey: config.apiKey ? btoa(config.apiKey) : '',
      model: config.model,
      baseUrl: config.baseUrl || '',
      ollamaUrl: config.ollamaUrl
    })
  );
}

const STOPWORDS_ID_EN = new Set([
  'yang', 'dan', 'atau', 'dari', 'pada', 'untuk', 'dengan', 'adalah', 'ini', 'itu',
  'dalam', 'ke', 'di', 'sebagai', 'oleh', 'akan', 'juga', 'tidak', 'bisa', 'dapat',
  'the', 'and', 'or', 'from', 'for', 'with', 'this', 'that', 'are', 'was', 'were',
  'apa', 'bagaimana', 'jelaskan', 'ringkas', 'rangkum', 'buatkan', 'tentang', 'isi',
  'dokumen', 'pdf', 'halaman', 'tolong', 'coba', 'please', 'explain', 'summarize'
]);

export function selectRelevantPdfContext(
  pdfText: string,
  maxBudgetChars: number,
  userQuery = ''
): string {
  const clean = pdfText.trim();
  if (!clean) return '';
  if (clean.length <= maxBudgetChars) return clean;

  // Split into page chunks using `[Halaman N]` or `[Halaman N (OCR)]` markers
  const markerRegex = /(?=\[Halaman\s+\d+(?:\s*\(OCR\))?\])/g;
  const rawChunks = clean.split(markerRegex).map((c) => c.trim()).filter(Boolean);

  if (rawChunks.length <= 1) {
    // Unstructured long text: keep start (70%) + tail (30%) instead of losing ending completely
    const headLen = Math.floor(maxBudgetChars * 0.7);
    const tailLen = Math.max(400, maxBudgetChars - headLen - 60);
    return `${clean.slice(0, headLen)}\n\n[... bagian tengah dipotong karena batas panjang ...]\n\n${clean.slice(-tailLen)}`;
  }

  const parsedChunks = rawChunks.map((chunk, idx) => {
    const pageMatch = chunk.match(/^\[Halaman\s+(\d+)/);
    const pageNum = pageMatch ? Number(pageMatch[1]) : idx + 1;
    return { idx, pageNum, text: chunk };
  });

  // Detect explicit page number requests in userQuery (e.g. "hal 12", "halaman 15", "page 3")
  const exactRequestedPages = new Set<number>();
  const neighborRequestedPages = new Set<number>();
  const pageReqMatches = userQuery.matchAll(/(?:hal(?:aman)?|page|p\.?)\s*(\d{1,3})/gi);
  for (const m of pageReqMatches) {
    const num = Number(m[1]);
    if (num > 0) {
      exactRequestedPages.add(num);
      neighborRequestedPages.add(num - 1);
      neighborRequestedPages.add(num + 1);
    }
  }

  // Extract query keywords for relevance scoring
  const keywords = Array.from(
    new Set(
      userQuery
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !STOPWORDS_ID_EN.has(w))
    )
  );

  const scored = parsedChunks.map((chunk) => {
    let score = 0;
    const lower = chunk.text.toLowerCase();

    if (chunk.idx === 0) score += 8; // Title / intro / TOC page
    if (chunk.idx === parsedChunks.length - 1) score += 3; // Conclusion / end page
    if (exactRequestedPages.has(chunk.pageNum)) score += 150;
    else if (neighborRequestedPages.has(chunk.pageNum)) score += 45;

    for (const kw of keywords) {
      if (lower.includes(kw)) {
        // Count up to 5 occurrences per keyword
        let count = 0;
        let pos = 0;
        while (count < 5) {
          pos = lower.indexOf(kw, pos);
          if (pos === -1) break;
          count++;
          pos += kw.length;
        }
        score += 10 + count * 2;
      }
    }

    return { ...chunk, score };
  });

  const selectedIndices = new Set<number>();
  const selectionBudget = maxBudgetChars > 600 ? maxBudgetChars - 180 : maxBudgetChars;
  let usedChars = 0;

  const trySelect = (idx: number) => {
    if (selectedIndices.has(idx)) return false;
    const chunk = parsedChunks[idx];
    if (!chunk) return false;
    const cost = chunk.text.length + 24;
    if (usedChars + cost > selectionBudget && selectedIndices.size > 0) return false;
    selectedIndices.add(idx);
    usedChars += cost;
    return true;
  };

  if (keywords.length > 0 || exactRequestedPages.size > 0) {
    // Select by relevance score first
    const byScore = [...scored].sort((a, b) => b.score - a.score || a.idx - b.idx);
    for (const item of byScore) {
      trySelect(item.idx);
    }
  } else {
    // Broad summary: cover start, middle, and conclusion evenly
    trySelect(0);
    trySelect(parsedChunks.length - 1);
    for (let i = 1; i < parsedChunks.length - 1; i++) {
      trySelect(i);
    }
  }

  // Fallback if Page 1 alone exceeded budget
  if (selectedIndices.size === 0) {
    return parsedChunks[0].text.slice(0, maxBudgetChars);
  }

  const orderedIndices = Array.from(selectedIndices).sort((a, b) => a - b);
  const outputParts: string[] = [];
  let prevIdx = -1;

  if (orderedIndices[0] > 0) {
    const firstSkippedStart = parsedChunks[0].pageNum;
    const firstSkippedEnd = parsedChunks[orderedIndices[0] - 1].pageNum;
    outputParts.push(
      firstSkippedStart === firstSkippedEnd
        ? `[... Halaman ${firstSkippedStart} dilewati karena batas panjang konteks ...]`
        : `[... Halaman ${firstSkippedStart}-${firstSkippedEnd} dilewati karena batas panjang konteks ...]`
    );
  }

  for (const idx of orderedIndices) {
    if (prevIdx !== -1 && idx > prevIdx + 1) {
      const skippedStart = parsedChunks[prevIdx + 1].pageNum;
      const skippedEnd = parsedChunks[idx - 1].pageNum;
      outputParts.push(
        skippedStart === skippedEnd
          ? `[... Halaman ${skippedStart} dilewati karena batas panjang konteks ...]`
          : `[... Halaman ${skippedStart}-${skippedEnd} dilewati karena batas panjang konteks ...]`
      );
    }
    outputParts.push(parsedChunks[idx].text);
    prevIdx = idx;
  }

  if (prevIdx < parsedChunks.length - 1) {
    const skippedStart = parsedChunks[prevIdx + 1].pageNum;
    const skippedEnd = parsedChunks[parsedChunks.length - 1].pageNum;
    outputParts.push(
      skippedStart === skippedEnd
        ? `[... Halaman ${skippedStart} tidak disertakan karena batas panjang konteks ...]`
        : `[... Halaman ${skippedStart}-${skippedEnd} tidak disertakan karena batas panjang konteks ...]`
    );
  }

  return outputParts.join('\n\n').slice(0, maxBudgetChars);
}

interface PdfExclusionTarget {
  fileName?: string;
  url?: string;
}

function serializeBlockListForPrompt(
  blocks: Array<NoteBlock | NoteBlockBase>,
  allNotes: NoteRecord[],
  activeBlocks: NoteBlock[],
  excludePdf?: PdfExclusionTarget | null,
  userQuery = ''
): string[] {
  const lines: string[] = [];
  let numberedIdx = 0;

  for (const b of blocks) {
    if (b.type === 'numbered') {
      numberedIdx += 1;
    } else {
      numberedIdx = 0;
    }

    if (b.type === 'h1') lines.push(`# ${b.content}`);
    else if (b.type === 'h2') lines.push(`## ${b.content}`);
    else if (b.type === 'h3') lines.push(`### ${b.content}`);
    else if (b.type === 'bullet') lines.push(`- ${b.content}`);
    else if (b.type === 'numbered') lines.push(`${numberedIdx}. ${b.content}`);
    else if (b.type === 'todo') {
      const dueStr = b.dueDate ? ` [Deadline: ${b.dueDate}${b.dueTime ? ` ${b.dueTime}` : ''}]` : '';
      lines.push(`- [${b.checked ? 'x' : ' '}] ${b.content}${dueStr}`);
    } else if (b.type === 'deadline') {
      lines.push(
        `- [${b.checked ? 'x' : ' '}] [DEADLINE ${b.dueDate || 'Tanpa Tanggal'}${
          b.dueTime ? ` ${b.dueTime}` : ''
        }] ${b.content}`
      );
    } else if (b.type === 'toggle') {
      lines.push(`▸ ${b.content}`);
      if (b.toggleBody?.trim()) {
        lines.push(`  ${b.toggleBody.trim()}`);
      }
    } else if (b.type === 'callout') {
      lines.push(`[${b.calloutIcon || '💡'} Callout] ${b.content}`);
    } else if (b.type === 'quote') {
      lines.push(`> ${b.content}`);
    } else if (b.type === 'divider') {
      lines.push('---');
    } else if (b.type === 'math') {
      lines.push(`Rumus LaTeX: $${b.content}$`);
    } else if (b.type === 'code') {
      lines.push(`\`\`\`${b.language || ''}\n${b.content}\n\`\`\``);
    } else if (b.type === 'image') {
      lines.push(`[Gambar terlampir${b.caption ? `: ${b.caption}` : ''}]`);
    } else if (b.type === 'video') {
      lines.push(`[Video tersemat${b.caption ? `: ${b.caption}` : ''}: ${b.content}]`);
    } else if (b.type === 'link') {
      lines.push(`[Tautan URL${b.caption ? `: ${b.caption}` : ''}: ${b.content}]`);
    } else if (b.type === 'pdf') {
      const pdfName = b.fileName || b.caption || 'Lampiran.pdf';
      const isDuplicateOfAttachment =
        Boolean(excludePdf) &&
        ((excludePdf?.url && b.content && excludePdf.url === b.content) ||
          (excludePdf?.fileName &&
            pdfName.toLowerCase() === excludePdf.fileName.toLowerCase()));

      if (isDuplicateOfAttachment) {
        lines.push(
          `[Dokumen PDF: ${pdfName} (${b.pdfPages || 1} halaman) — isi lengkap dilampirkan pada bagian Referensi PDF di bawah]`
        );
      } else {
        const selectedText = b.pdfText
          ? selectRelevantPdfContext(b.pdfText, 24000, userQuery)
          : '';
        lines.push(
          `[Dokumen PDF: ${pdfName} (${b.pdfPages || 1} halaman)]\n${selectedText}`
        );
      }
    } else if (b.type === 'subpage') {
      lines.push(`[Subhalaman: ${b.content || 'Halaman Tanpa Judul'}]`);
    } else if (b.type === 'database' && b.databaseData) {
      lines.push(
        `[Tabel Database: ${b.databaseData.title || 'Tabel'} (${b.databaseData.rows.length} baris)]\n${databaseToMarkdownTable(b.databaseData, 50)}`
      );
    } else if (b.type === 'chart' && b.chartData) {
      const srcNote = allNotes.find((n) => n.id === b.chartData?.sourceNoteId);
      const srcBlock = findBlockById(srcNote?.blocks || activeBlocks, b.chartData.sourceBlockId);
      const agg = aggregateDatabaseForChart(srcBlock?.databaseData, b.chartData);
      const summary = agg.items.map((i) => `${i.label}: ${i.value} (${i.percent}%)`).join(', ');
      lines.push(
        `[Diagram ${b.chartData.kind === 'donut' ? 'Donat' : b.chartData.kind === 'line' ? 'Garis' : 'Batang'}: ${b.chartData.title}${summary ? ` -> ${summary}` : ''}]`
      );
    } else if (b.type === 'form' && b.formData) {
      const fieldsList = b.formData.fields
        .filter((f) => !f.hidden)
        .map((f) => f.label)
        .join(', ');
      lines.push(
        `[Formulir: ${b.formData.title} (${b.formData.submissionCount || 0} respon) | Pertanyaan: ${fieldsList}]`
      );
    } else if (b.type === 'metric' && b.metricData) {
      const srcNote = b.metricData.sourceNoteId
        ? allNotes.find((n) => n.id === b.metricData?.sourceNoteId)
        : undefined;
      const srcBlock =
        b.metricData.sourceBlockId
          ? findBlockById(srcNote?.blocks || activeBlocks, b.metricData.sourceBlockId)
          : undefined;
      const computed = computeMetricValue(srcBlock?.databaseData, activeBlocks, b.metricData);
      lines.push(`[Metrik ${b.metricData.title}: ${computed.displayValue} (${computed.subtitle})]`);
    } else if (b.type === 'table' && b.tableData?.rows?.length) {
      const tableMd = b.tableData.rows
        .slice(0, 40)
        .map((r, rIdx) => {
          const line = `| ${r.map((c) => (c || '').replace(/\|/g, '\\|')).join(' | ')} |`;
          if (rIdx === 0 && b.tableData?.hasHeaderRow !== false) {
            const sep = `| ${r.map(() => '---').join(' | ')} |`;
            return `${line}\n${sep}`;
          }
          return line;
        })
        .join('\n');
      lines.push(`[Tabel Sederhana]\n${tableMd}`);
    } else if (b.type === 'mermaid') {
      lines.push(`[Diagram Mermaid${b.caption ? `: ${b.caption}` : ''}]\n\`\`\`mermaid\n${b.content}\n\`\`\``);
    } else if (b.type === 'voice') {
      const title = b.caption || 'Voice Note';
      const dur = b.voiceData?.durationSec ? `${Math.round(b.voiceData.durationSec)}s` : '';
      const transcript = b.voiceData?.transcript?.trim() || '';
      lines.push(
        `[Voice Note: ${title}${dur ? ` (${dur})` : ''}]${transcript ? `\nTranskrip: ${transcript}` : ''}`
      );
    } else if ('columns' in b && b.type === 'columns' && Array.isArray(b.columns)) {
      b.columns.forEach((col, colIdx) => {
        lines.push(`[Kolom ${colIdx + 1}/${b.columns?.length || 0}]`);
        lines.push(
          ...serializeBlockListForPrompt(
            col.blocks || [],
            allNotes,
            activeBlocks,
            excludePdf,
            userQuery
          )
        );
      });
    } else if (b.content) {
      lines.push(b.content);
    }
  }

  return lines;
}

export function serializeBlocksForPrompt(
  title: string,
  blocks: NoteBlock[],
  subpages: Array<Pick<NoteRecord, 'title' | 'blocks'>> = [],
  kanbanStatus?: NoteRecord['kanbanStatus'],
  dueDate?: string,
  dueTime?: string,
  allNotes: NoteRecord[] = [],
  excludePdf?: PdfExclusionTarget | null,
  userQuery = ''
): string {
  const statusLabel =
    kanbanStatus === 'in_progress'
      ? 'Dikerjakan (In Progress)'
      : kanbanStatus === 'done'
        ? 'Selesai (Done)'
        : 'Rencana (To Do)';
  const lines = [`Judul Catatan: ${title}`, `Status Kanban: ${statusLabel}`];
  if (dueDate?.trim()) {
    lines.push(`Deadline Catatan: ${dueDate}${dueTime ? ` ${dueTime}` : ''}`);
  }
  lines.push('---');
  lines.push(...serializeBlockListForPrompt(blocks, allNotes, blocks, excludePdf, userQuery));

  if (subpages.length > 0) {
    lines.push('\n--- Subhalaman Terkait ---');
    for (const sub of subpages.slice(0, 6)) {
      const subSnippet = flattenBlocks(sub.blocks || [])
        .map((blk) => blk.content)
        .filter(Boolean)
        .join(' ')
        .slice(0, 500);
      lines.push(`• ${sub.title || 'Subhalaman Tanpa Judul'}${subSnippet ? `: ${subSnippet}` : ''}`);
    }
  }

  return lines.join('\n');
}

export interface LiveNoteContextResult {
  note: NoteRecord | undefined;
  contextText: string;
  updatedAt: number;
  noteImages: NoteBlock[];
}

export async function buildLiveNoteContext(
  noteId: string,
  fallbackNote?: NoteRecord,
  pdfAttachment?: { fileName: string; text: string; pages: number; url?: string } | null,
  maxChars = 34000,
  userQuery = ''
): Promise<LiveNoteContextResult> {
  const targetId = noteId || fallbackNote?.id || '';
  const freshNote = targetId ? (await db.notes.get(targetId)) || fallbackNote : fallbackNote;

  let allNotes: NoteRecord[] = [];
  try {
    allNotes = await db.notes.toArray();
  } catch {
    allNotes = [];
  }
  const subpages = freshNote?.id ? allNotes.filter((n) => n.parentId === freshNote.id) : [];

  const rawNoteContent = freshNote
    ? serializeBlocksForPrompt(
        freshNote.title || 'Catatan',
        freshNote.blocks || [],
        subpages,
        freshNote.kanbanStatus,
        freshNote.dueDate,
        freshNote.dueTime,
        allNotes,
        pdfAttachment ? { fileName: pdfAttachment.fileName, url: pdfAttachment.url } : null,
        userQuery
      )
    : 'Tidak ada catatan aktif.';

  let combined = '';
  if (pdfAttachment) {
    const header = `\n\n=== ISI DOKUMEN PDF REFERENSI (${pdfAttachment.fileName}, ${pdfAttachment.pages} halaman) ===\n`;
    const minPdfBudget = Math.floor(maxChars * 0.72);
    const maxNoteBudget = Math.max(1200, maxChars - minPdfBudget - header.length);
    const trimmedNote =
      rawNoteContent.length > maxNoteBudget
        ? `${rawNoteContent.slice(0, maxNoteBudget)}\n[... catatan dipersingkat agar isi PDF utuh ...]`
        : rawNoteContent;

    const remainingForPdf = Math.max(minPdfBudget, maxChars - trimmedNote.length - header.length);
    const selectedPdf = selectRelevantPdfContext(pdfAttachment.text, remainingForPdf, userQuery);
    combined = `${trimmedNote}${header}${selectedPdf}`.slice(0, maxChars);
  } else {
    combined = rawNoteContent.slice(0, maxChars);
  }

  return {
    note: freshNote,
    contextText: combined,
    updatedAt: freshNote?.updatedAt || Date.now(),
    noteImages: flattenBlocks(freshNote?.blocks || []).filter(
      (b) => b.type === 'image' && Boolean(b.content)
    )
  };
}

function cleanAIThinkingTags(txt: string): string {
  const withoutClosed = txt.replace(/<think>[\s\S]*?<\/think>\s*/g, '');
  const openIdx = withoutClosed.indexOf('<think>');
  if (openIdx !== -1) {
    return withoutClosed.slice(0, openIdx).trim() || '⏳ Miu AI sedang berpikir...';
  }
  return withoutClosed;
}

async function readOpenAISSEStream(
  body: ReadableStream<Uint8Array>,
  onChunk: (fullText: string) => void
): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let rawFull = '';
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const dataStr = line.slice(5).trim();
      if (!dataStr || dataStr === '[DONE]') continue;
      try {
        const json = JSON.parse(dataStr);
        const delta = json?.choices?.[0]?.delta?.content || '';
        if (delta) {
          rawFull += delta;
          onChunk(cleanAIThinkingTags(rawFull));
        }
      } catch {
        // ignore partial chunk
      }
    }
  }
  const finalCleaned = cleanAIThinkingTags(rawFull);
  onChunk(finalCleaned);
  return finalCleaned;
}

export async function runExternalAIStream(
  config: AIConfig,
  systemPrompt: string,
  userPrompt: string,
  onChunk: (fullText: string) => void,
  imageUrl?: string,
  history: AIChatMessage[] = []
): Promise<string> {
  const cleanHistory = history
    .filter((m) => m.content.trim().length > 0)
    .slice(-16);

  if (config.provider === 'groq' && !config.apiKey.trim()) {
    const resp = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemPrompt,
        userPrompt,
        history: cleanHistory,
        imageUrl,
        model: config.model
      })
    });

    if (resp.status === 503) {
      const simulated = buildOfflineAssistantPreview(userPrompt);
      let current = '';
      const words = simulated.split(' ');
      for (let i = 0; i < words.length; i++) {
        current += (i === 0 ? '' : ' ') + words[i];
        onChunk(current);
        await new Promise((r) => setTimeout(r, 18));
      }
      return current;
    }

    if (!resp.ok || !resp.body) {
      const errData = (await resp.json().catch(() => ({}))) as { error?: string };
      throw new Error(errData.error || `AI Error (${resp.status}): Gagal menghubungi Groq AI.`);
    }

    return readOpenAISSEStream(resp.body, onChunk);
  }

  if (config.provider !== 'ollama' && !config.apiKey.trim()) {
    const simulated = buildOfflineAssistantPreview(userPrompt);
    let current = '';
    const words = simulated.split(' ');
    for (let i = 0; i < words.length; i++) {
      current += (i === 0 ? '' : ' ') + words[i];
      onChunk(current);
      await new Promise((r) => setTimeout(r, 18));
    }
    return current;
  }

  if (config.provider === 'gemini') {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      config.model || 'gemini-2.0-flash'
    )}:streamGenerateContent?alt=sse&key=${encodeURIComponent(config.apiKey.trim())}`;

    const contents = [
      ...cleanHistory.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      })),
      { role: 'user', parts: [{ text: userPrompt }] }
    ];

    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents
      })
    });

    if (!resp.ok || !resp.body) {
      throw new Error(`Gemini API Error (${resp.status}): Periksa kembali API Key BYOK kamu.`);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let full = '';
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const jsonStr = line.slice(5).trim();
        if (!jsonStr || jsonStr === '[DONE]') continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const part = parsed?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (part) {
            full += part;
            onChunk(full);
          }
        } catch {
          // ignore partial JSON
        }
      }
    }
    return full;
  }

  if (config.provider === 'ollama') {
    const base = (config.ollamaUrl || 'http://localhost:11434').replace(/\/$/, '');
    const resp = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model || 'llama3.2',
        stream: true,
        messages: [
          { role: 'system', content: systemPrompt },
          ...cleanHistory.map((m) => ({ role: m.role, content: m.content })),
          { role: 'user', content: userPrompt }
        ]
      })
    });

    if (!resp.ok || !resp.body) {
      throw new Error(`Ollama tidak terjangkau di ${base}. Pastikan Ollama berjalan dengan OLLAMA_ORIGINS="*".`);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let full = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split('\n')) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed?.message?.content) {
            full += parsed.message.content;
            onChunk(full);
          }
        } catch {
          // ignore
        }
      }
    }
    return full;
  }

  if (config.provider === 'claude') {
    const endpoint = config.baseUrl?.trim() || 'https://api.anthropic.com/v1/messages';
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey.trim(),
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: config.model || DEFAULT_MODELS.claude,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [
          ...cleanHistory.map((m) => ({ role: m.role, content: m.content })),
          { role: 'user', content: userPrompt }
        ]
      })
    });

    if (!resp.ok) {
      const errDetail = await resp.text().catch(() => '');
      throw new Error(
        `Claude API Error (${resp.status}): ${errDetail.slice(0, 140) || 'Periksa API Key Claude.'}`
      );
    }

    const data = (await resp.json()) as { content?: Array<{ text?: string }> };
    const text = data.content?.map((c) => c.text || '').join('') || '';
    onChunk(text);
    return text;
  }

  // Groq, Custom OpenAI-Compatible, OpenAI & OpenRouter SSE
  const resolveOpenAICompatibleEndpoint = (): string => {
    if (config.provider === 'groq') {
      return 'https://api.groq.com/openai/v1/chat/completions';
    }
    const rawBase = config.baseUrl?.trim();
    if (rawBase) {
      if (rawBase.endsWith('/chat/completions')) return rawBase;
      return `${rawBase.replace(/\/$/, '')}/chat/completions`;
    }
    if (config.provider === 'openrouter') {
      return 'https://openrouter.ai/api/v1/chat/completions';
    }
    return 'https://api.openai.com/v1/chat/completions';
  };

  const endpoint = resolveOpenAICompatibleEndpoint();

  const makeCompletionRequest = async (modelName: string, withVision: boolean) => {
    const userMessageContent =
      withVision && imageUrl
        ? [
            { type: 'text', text: userPrompt },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        : userPrompt;

    return fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey.trim()}`,
        ...(config.provider === 'openrouter' || endpoint.includes('openrouter.ai')
          ? { 'HTTP-Referer': window.location.origin, 'X-Title': 'Miu Workspace' }
          : {})
      },
      body: JSON.stringify({
        model: modelName,
        stream: true,
        messages: [
          { role: 'system', content: systemPrompt },
          ...cleanHistory.map((m) => ({ role: m.role, content: m.content })),
          { role: 'user', content: userMessageContent }
        ]
      })
    });
  };

  const hasImage = Boolean(imageUrl);
  const targetModel =
    config.model || DEFAULT_MODELS[config.provider] || 'gpt-4o-mini';

  const resp = await makeCompletionRequest(targetModel, hasImage);

  if (!resp.ok || !resp.body) {
    const errDetail = await resp.text().catch(() => '');
    throw new Error(
      `${config.provider.toUpperCase()} Error (${resp.status}): ${
        errDetail.slice(0, 140) || 'Periksa API Key atau nama model.'
      }`
    );
  }

  return readOpenAISSEStream(resp.body, onChunk);
}

function buildOfflineAssistantPreview(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (lower.includes('kuis') || lower.includes('quiz') || lower.includes('flashcard')) {
    return [
      '**[Mode Pratinjau Lokal — Masukkan API Key BYOK di atas untuk respons AI langsung]**\n',
      '1. **Pertanyaan:** Apa syarat utama agar sebuah relasi memenuhi Boyce-Codd Normal Form (BCNF)?',
      '   - A) Tidak memiliki atribut bernilai ganda',
      '   - B) Setiap determinan pada ketergantungan fungsional non-trivial adalah superkey ✅',
      '   - C) Semua kolom memiliki tipe data VARCHAR',
      '\n2. **Flashcard:** *Lossless-Join Decomposition* → Dekomposisi tabel yang menjamin saat di-JOIN kembali tidak menghasilkan tupel palsu.'
    ].join('\n');
  }
  if (lower.includes('pecah') || lower.includes('pomodoro') || lower.includes('breakdown')) {
    return [
      '**[Mode Pratinjau Lokal — Estimasi Pomodoro Otomatis]**\n',
      '- [ ] Baca ulang definisi & identifikasi ketergantungan fungsional (🍅 1 Pomodoro)',
      '- [ ] Latihan dekomposisi 3NF menuju BCNF pada 5 studi kasus (🍅 2 Pomodoro)',
      '- [ ] Tulis ringkasan SQL & verifikasi *primary key* di catatan Miu (🍅 1 Pomodoro)'
    ].join('\n');
  }
  return [
    '**[Mode Pratinjau Lokal — Tempel Gemini / OpenRouter / OpenAI / Ollama Key di atas untuk AI nyata]**\n',
    '### Intisari Catatan Aktif',
    '- Fokus utama materi adalah menjaga struktur catatan tetap bersih, terstruktur, dan bebas anomali data.',
    '- Rumus atau konsep inti sudah terdeteksi pada blok catatanmu dan siap diubah menjadi kuis latihan atau daftar *To-do* Pomodoro.'
  ].join('\n');
}
