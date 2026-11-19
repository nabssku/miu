import type {
  NoteBlock,
  NoteComment,
  NoteRecord,
  NoteShareSettings
} from '../types/miu';

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
    kanbanStatus:
      r.kanban_status === 'in_progress' || r.kanban_status === 'done'
        ? r.kanban_status
        : 'todo',
    dueDate: r.due_date || '',
    dueTime: r.due_time || '',
    googleEventId: r.google_event_id || '',
    blocks: parseBlocksField(r.blocks),
    shareSettings: parseShareSettingsField(r.share_settings),
    comments: parsedComments,
    createdAt: Number(r.created_at) || Date.now(),
    updatedAt: Number(r.updated_at) || Date.now()
  };
}
