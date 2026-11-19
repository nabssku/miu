export type PresenceField = 'content' | 'toggleBody' | 'title';

export interface CollaboratorColorTheme {
  id: string;
  hex: string;
}

export const COLLABORATOR_PALETTE: readonly CollaboratorColorTheme[] = [
  { id: 'sky', hex: '#0284C7' },
  { id: 'violet', hex: '#7C3AED' },
  { id: 'emerald', hex: '#059669' },
  { id: 'amber', hex: '#D97706' },
  { id: 'rose', hex: '#E11D48' },
  { id: 'cyan', hex: '#0891B2' },
  { id: 'fuchsia', hex: '#C026D3' },
  { id: 'orange', hex: '#EA580C' }
] as const;

export const PRESENCE_TTL_MS = 35_000;
export const PRESENCE_HEARTBEAT_MS = 12_000;
const SESSION_STORAGE_KEY = 'miu_presence_session_v1';

let fallbackTabSessionId = '';

export function getOrCreatePresenceSessionId(): string {
  if (typeof window === 'undefined') {
    if (!fallbackTabSessionId) {
      fallbackTabSessionId = `sess-${Math.random().toString(36).slice(2, 10)}`;
    }
    return fallbackTabSessionId;
  }

  try {
    const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing && existing.length >= 6) {
      return existing;
    }
    const generated =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? `sess-${crypto.randomUUID()}`
        : `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, generated);
    return generated;
  } catch {
    if (!fallbackTabSessionId) {
      fallbackTabSessionId = `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    }
    return fallbackTabSessionId;
  }
}

export function pickCollaboratorColor(seed: string): string {
  const input = (seed || 'miu').trim();
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const index = (hash >>> 0) % COLLABORATOR_PALETTE.length;
  return COLLABORATOR_PALETTE[index]?.hex || '#0284C7';
}

export function buildPresenceRowId(noteId: string, sessionId: string): string {
  return `${noteId}:${sessionId}`;
}

export function normalizePresenceField(raw: unknown): PresenceField {
  if (raw === 'toggleBody') return 'toggleBody';
  if (raw === 'title') return 'title';
  return 'content';
}

export function clampSelectionRange(
  textLength: number,
  rawStart: number,
  rawEnd: number
): { start: number; end: number } {
  const safeLen = Math.max(0, Math.floor(Number.isFinite(textLength) ? textLength : 0));
  const s = Math.max(
    0,
    Math.min(safeLen, Math.floor(Number.isFinite(rawStart) ? rawStart : 0))
  );
  const e = Math.max(
    0,
    Math.min(safeLen, Math.floor(Number.isFinite(rawEnd) ? rawEnd : s))
  );
  return s <= e ? { start: s, end: e } : { start: e, end: s };
}

export function getLineAndColumnFromOffset(
  text: string,
  rawOffset: number
): { line: number; column: number } {
  const safeOffset = Math.max(0, Math.min(text.length, Math.floor(rawOffset || 0)));
  const slice = text.slice(0, safeOffset);
  const lines = slice.split('\n');
  return {
    line: lines.length,
    column: (lines[lines.length - 1]?.length || 0) + 1
  };
}

export function normalizePointerCoordinate(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.max(0, Math.min(1, Number(num.toFixed(4))));
}

/**
 * Maps a raw Markdown character offset (inside `block.content`) to its approximate
 * visible character offset inside `renderInlineMarkdown(rawText)`.
 */
export function mapRawMarkdownOffsetToVisible(rawText: string, rawOffset: number): number {
  const clampedRaw = Math.max(0, Math.min(rawText.length, Math.floor(rawOffset || 0)));
  if (!rawText || clampedRaw === 0) return 0;

  const tokenRegex =
    /(`[^`]+`|\$\$[^$]+\$\$|\$[^$\n]+\$|\*\*[^*]+\*\*|__[^_]+__|\[[^\]]+\]\([^)]+\)|https?:\/\/[^\s<>]+|\*[^*\n]+\*|_[^_\n]+_)/g;

  let visibleCount = 0;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(rawText)) !== null) {
    const tokenStart = match.index;
    const token = match[0];
    const tokenEnd = tokenStart + token.length;

    if (clampedRaw <= tokenStart) {
      return visibleCount + (clampedRaw - lastIndex);
    }

    // Plain text before token
    visibleCount += tokenStart - lastIndex;

    let visibleToken = token;
    let openLen = 0;
    let closeLen = 0;

    if (
      (token.startsWith('**') && token.endsWith('**') && token.length > 4) ||
      (token.startsWith('__') && token.endsWith('__') && token.length > 4)
    ) {
      openLen = 2;
      closeLen = 2;
      visibleToken = token.slice(2, -2);
    } else if (
      (token.startsWith('`') && token.endsWith('`') && token.length > 2) ||
      (token.startsWith('*') && token.endsWith('*') && token.length > 2) ||
      (token.startsWith('_') && token.endsWith('_') && token.length > 2)
    ) {
      openLen = 1;
      closeLen = 1;
      visibleToken = token.slice(1, -1);
    } else {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch && /^(https?:\/\/|mailto:|\/)/i.test(linkMatch[2].trim())) {
        openLen = 1;
        visibleToken = linkMatch[1];
        closeLen = token.length - 1 - visibleToken.length;
      } else if (token.startsWith('$$') && token.endsWith('$$') && token.length > 4) {
        // Rendered math spans vary dynamically in text length; snap proportionally
        if (clampedRaw < tokenEnd) {
          return visibleCount + 1;
        }
        visibleToken = token.slice(2, -2);
        openLen = 2;
        closeLen = 2;
      } else if (token.startsWith('$') && token.endsWith('$') && token.length > 2) {
        if (clampedRaw < tokenEnd) {
          return visibleCount + 1;
        }
        visibleToken = token.slice(1, -1);
        openLen = 1;
        closeLen = 1;
      }
    }

    if (clampedRaw < tokenEnd) {
      const innerOffset = Math.max(
        0,
        Math.min(visibleToken.length, clampedRaw - tokenStart - openLen)
      );
      return visibleCount + innerOffset;
    }

    visibleCount += Math.max(0, token.length - openLen - closeLen);
    lastIndex = tokenEnd;
  }

  return visibleCount + Math.max(0, clampedRaw - lastIndex);
}
