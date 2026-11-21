import type {
  NoteBlock,
  NoteComment,
  NoteRecord,
  NoteShareSettings
} from '../types/miu';
import {
  normalizePointerCoordinate,
  normalizePresenceField,
  pickCollaboratorColor,
  PRESENCE_TTL_MS,
  type PresenceField
} from './presenceHelper';

export interface LiveItemRow {
  id: string;
  channel: string;
  content: string;
  author: string;
  created_at: Date | string;
}

export interface NeonNoteRow {
  id: string;
  user_id: string;
  owner_email: string | null;
  owner_name: string | null;
  parent_id: string | null;
  semester_id: string;
  course_id: string;
  title: string;
  icon: string | null;
  cover: string | null;
  is_favorite: boolean | null;
  is_full_width?: boolean | null;
  kanban_status?: string | null;
  due_date?: string | null;
  due_time?: string | null;
  google_event_id?: string | null;
  blocks: unknown;
  share_settings: unknown;
  comments: unknown;
  created_at: string | number;
  updated_at: string | number;
}

export interface NeonNotePresenceRow {
  id: string;
  note_id: string;
  session_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  user_picture: string;
  color: string;
  block_id: string;
  field: string;
  selection_start: number | string;
  selection_end: number | string;
  is_editing: boolean;
  pointer_block_id: string | null;
  pointer_x: number | string | null;
  pointer_y: number | string | null;
  updated_at: string | number;
}

export interface CollaboratorPresence {
  id: string;
  noteId: string;
  sessionId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPicture: string;
  color: string;
  blockId: string;
  field: PresenceField;
  selectionStart: number;
  selectionEnd: number;
  isEditing: boolean;
  pointerBlockId: string | null;
  pointerX: number | null;
  pointerY: number | null;
  updatedAt: number;
}

export function normalizeRealtimeWsUrl(rawUrl: string): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:') parsed.protocol = 'wss:';
    else if (parsed.protocol === 'http:') parsed.protocol = 'ws:';
    if (parsed.protocol !== 'wss:' && parsed.protocol !== 'ws:') return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

export function parseShareSettingsField(raw: unknown): NoteShareSettings {
  const defaultShare: NoteShareSettings = {
    isPublicLink: false,
    publicRole: 'view',
    collaborators: []
  };
  if (!raw) return defaultShare;
  if (typeof raw === 'string') {
    try {
      return { ...defaultShare, ...JSON.parse(raw) };
    } catch {
      return defaultShare;
    }
  }
  if (typeof raw === 'object') {
    return { ...defaultShare, ...(raw as Partial<NoteShareSettings>) };
  }
  return defaultShare;
}

export function parseBlocksField(raw: unknown): NoteBlock[] {
  if (Array.isArray(raw)) return raw as NoteBlock[];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as NoteBlock[];
    } catch {
      // ignore
    }
  }
  return [{ id: `blk-${Date.now()}`, type: 'text', content: '' }];
}

function parseEpochMs(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : fallback;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    const asNum = Number(trimmed);
    if (Number.isFinite(asNum)) return asNum;
    const asDate = Date.parse(trimmed);
    if (Number.isFinite(asDate)) return asDate;
  }
  return fallback;
}

export function parseNeonNoteRow(r: NeonNoteRow): NoteRecord {
  let parsedComments: NoteComment[] = [];
  if (r.comments) {
    if (Array.isArray(r.comments)) {
      parsedComments = r.comments as NoteComment[];
    } else if (typeof r.comments === 'string') {
      try {
        parsedComments = JSON.parse(r.comments) as NoteComment[];
      } catch {
        // ignore
      }
    }
  }

  const now = Date.now();
  const parsedShareSettings = parseShareSettingsField(r.share_settings);
  return {
    id: r.id,
    ownerId: r.user_id,
    ownerEmail: r.owner_email || '',
    ownerName: r.owner_name || '',
    parentId: r.parent_id || null,
    semesterId: r.semester_id || 'sem-1',
    courseId: r.course_id || 'course-default',
    title: r.title || '',
    icon: r.icon || '📄',
    cover: r.cover || '',
    isFavorite: Boolean(r.is_favorite),
    isFullWidth: Boolean(r.is_full_width),
    fontStyle: parsedShareSettings.fontStyle || 'default',
    isSmallText: Boolean(parsedShareSettings.isSmallText),
    isLocked: Boolean(parsedShareSettings.isLocked),
    kanbanStatus:
      r.kanban_status === 'in_progress' || r.kanban_status === 'done'
        ? r.kanban_status
        : 'todo',
    dueDate: r.due_date || '',
    dueTime: r.due_time || '',
    googleEventId: r.google_event_id || '',
    blocks: parseBlocksField(r.blocks),
    shareSettings: parsedShareSettings,
    comments: parsedComments,
    createdAt: parseEpochMs(r.created_at, now),
    updatedAt: parseEpochMs(r.updated_at, now)
  };
}

export function parseNeonPresenceRow(r: NeonNotePresenceRow): CollaboratorPresence {
  const start = Math.max(0, Math.floor(Number(r.selection_start) || 0));
  const end = Math.max(start, Math.floor(Number(r.selection_end) || start));
  const pointerX = normalizePointerCoordinate(r.pointer_x);
  const pointerY = normalizePointerCoordinate(r.pointer_y);
  const pointerBlockId =
    typeof r.pointer_block_id === 'string' && r.pointer_block_id.trim()
      ? r.pointer_block_id.trim()
      : null;
  const hasValidPointer = Boolean(pointerBlockId && pointerX !== null && pointerY !== null);

  return {
    id: r.id,
    noteId: r.note_id,
    sessionId: r.session_id,
    userId: r.user_id || '',
    userName: (r.user_name || '').trim() || 'Kolaborator',
    userEmail: r.user_email || '',
    userPicture: r.user_picture || '',
    color: (r.color || '').trim() || pickCollaboratorColor(r.session_id || r.user_id || r.id),
    blockId: r.block_id || '',
    field: normalizePresenceField(r.field),
    selectionStart: start,
    selectionEnd: end,
    isEditing: Boolean(r.is_editing),
    pointerBlockId: hasValidPointer ? pointerBlockId : null,
    pointerX: hasValidPointer ? pointerX : null,
    pointerY: hasValidPointer ? pointerY : null,
    updatedAt: parseEpochMs(r.updated_at, 0)
  };
}

export function filterActiveRemoteCollaborators(
  rows: readonly CollaboratorPresence[],
  noteId: string,
  mySessionId: string,
  adjustedNow: number,
  ttlMs = PRESENCE_TTL_MS
): CollaboratorPresence[] {
  if (!noteId) return [];
  const active: CollaboratorPresence[] = [];
  for (const row of rows) {
    if (row.noteId !== noteId) continue;
    if (mySessionId && row.sessionId === mySessionId) continue;
    if (row.updatedAt > 0 && adjustedNow - row.updatedAt > ttlMs) continue;
    active.push(row);
  }
  active.sort((a, b) => b.updatedAt - a.updatedAt || a.sessionId.localeCompare(b.sessionId));
  return active;
}
