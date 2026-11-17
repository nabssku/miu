import { createHash } from 'node:crypto';
import type {
  DatabaseRow,
  NoteBlock,
  NoteComment,
  NoteRecord,
  NoteShareSettings,
  SharePermission
} from '../types/miu';
import { findBlockById, mapBlockDeep } from '../utils/blockTreeHelper';
import { sanitizeFormSubmission } from '../utils/databaseHelper';

export interface ServerGoogleUser {
  id: string;
  email: string;
  name: string;
  picture: string;
  provider?: 'google';
  loginAt: number;
}

export interface ServerCloudEnv {
  neonDatabaseUrl: string;
  googleClientId: string;
  cloudinaryCloudName: string;
  cloudinaryApiKey: string;
  cloudinaryApiSecret: string;
  cloudinaryUploadPreset: string;
  groqApiKey: string;
  groqModel: string;
  elevenLabsApiKey: string;
  elevenLabsVoiceId: string;
  elevenLabsModelId: string;
  elevenLabsCustomLlmSecret: string;
}

export function getServerCloudEnv(): ServerCloudEnv {
  return {
    neonDatabaseUrl: (
      process.env.NEON_DATABASE_URL ||
      process.env.VITE_NEON_DATABASE_URL ||
      ''
    ).trim(),
    googleClientId: (
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
      process.env.GOOGLE_CLIENT_ID ||
      process.env.VITE_GOOGLE_CLIENT_ID ||
      ''
    ).trim(),
    cloudinaryCloudName: (
      process.env.CLOUDINARY_CLOUD_NAME ||
      process.env.VITE_CLOUDINARY_CLOUD_NAME ||
      ''
    ).trim(),
    cloudinaryApiKey: (
      process.env.CLOUDINARY_API_KEY ||
      process.env.VITE_CLOUDINARY_API_KEY ||
      ''
    ).trim(),
    cloudinaryApiSecret: (
      process.env.CLOUDINARY_API_SECRET ||
      process.env.VITE_CLOUDINARY_API_SECRET ||
      ''
    ).trim(),
    cloudinaryUploadPreset: (
      process.env.CLOUDINARY_UPLOAD_PRESET ||
      process.env.VITE_CLOUDINARY_UPLOAD_PRESET ||
      ''
    ).trim(),
    groqApiKey: (
      process.env.GROQ_API_KEY ||
      process.env.VITE_GROQ_API_KEY ||
      ''
    ).trim(),
    groqModel: (
      process.env.GROQ_MODEL ||
      process.env.VITE_GROQ_MODEL ||
      'qwen/qwen3.8-27b'
    ).trim(),
    elevenLabsApiKey: (
      process.env.ELEVENLABS_API_KEY ||
      process.env.XI_API_KEY ||
      ''
    ).trim(),
    elevenLabsVoiceId: (
      process.env.ELEVENLABS_VOICE_ID ||
      'JBFqnCBsd6RMkjVDRZzb'
    ).trim(),
    elevenLabsModelId: (
      process.env.ELEVENLABS_MODEL_ID ||
      'eleven_flash_v2_5'
    ).trim(),
    elevenLabsCustomLlmSecret: (
      process.env.ELEVENLABS_CUSTOM_LLM_SECRET ||
      ''
    ).trim()
  };
}

function sanitizeNeonConnectionString(raw: string): string {
  return raw
    .trim()
    .replace(/^postgres:\/\//i, 'postgresql://')
    .replace(/[?&]channel_binding=require/gi, '');
}

function parseNeonHttpEndpoint(connectionString: string): string | null {
  try {
    const normalized = sanitizeNeonConnectionString(connectionString);
    const url = new URL(normalized);
    if (!url.hostname) return null;
    return `https://${url.hostname}/sql`;
  } catch {
    return null;
  }
}

export function isServerNeonConfigured(): boolean {
  const { neonDatabaseUrl } = getServerCloudEnv();
  return Boolean(neonDatabaseUrl && parseNeonHttpEndpoint(neonDatabaseUrl));
}

export function isServerCloudinaryConfigured(): boolean {
  const {
    cloudinaryCloudName,
    cloudinaryApiKey,
    cloudinaryApiSecret,
    cloudinaryUploadPreset
  } = getServerCloudEnv();
  return Boolean(
    cloudinaryCloudName &&
      ((cloudinaryApiKey && cloudinaryApiSecret) || cloudinaryUploadPreset)
  );
}

export async function executeServerNeonQuery<T = Record<string, unknown>>(
  query: string,
  params: unknown[] = []
): Promise<{ rows: T[] }> {
  const { neonDatabaseUrl } = getServerCloudEnv();
  const endpoint = parseNeonHttpEndpoint(neonDatabaseUrl);
  if (!endpoint) {
    throw new Error('Cloud Catatan belum dikonfigurasi pada server.');
  }

  const cleanConnStr = sanitizeNeonConnectionString(neonDatabaseUrl);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Neon-Connection-String': cleanConnStr
    },
    body: JSON.stringify({ query, params }),
    cache: 'no-store'
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Cloud Catatan Error (${response.status}): ${errText || response.statusText}`);
  }

  const data = (await response.json()) as { rows?: T[] };
  return { rows: data.rows || [] };
}

let schemaInitializedForUrl = '';

export async function ensureServerNeonSchema(): Promise<boolean> {
  const { neonDatabaseUrl } = getServerCloudEnv();
  if (!isServerNeonConfigured()) return false;
  if (schemaInitializedForUrl === neonDatabaseUrl) return true;

  try {
    await executeServerNeonQuery(`
      CREATE TABLE IF NOT EXISTS miu_users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        picture TEXT,
        created_at BIGINT NOT NULL
      );
    `);

    await executeServerNeonQuery(`
      CREATE TABLE IF NOT EXISTS miu_notes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        owner_email TEXT DEFAULT '',
        owner_name TEXT DEFAULT '',
        parent_id TEXT DEFAULT NULL,
        semester_id TEXT NOT NULL DEFAULT 'sem-1',
        course_id TEXT NOT NULL DEFAULT 'course-default',
        title TEXT NOT NULL DEFAULT '',
        icon TEXT DEFAULT '📄',
        cover TEXT DEFAULT '',
        is_favorite BOOLEAN DEFAULT FALSE,
        is_full_width BOOLEAN DEFAULT FALSE,
        kanban_status TEXT DEFAULT 'todo',
        due_date TEXT DEFAULT '',
        due_time TEXT DEFAULT '',
        google_event_id TEXT DEFAULT '',
        blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
        share_settings JSONB NOT NULL DEFAULT '{"isPublicLink":false,"publicRole":"view","collaborators":[]}'::jsonb,
        comments JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      );
    `);

    await executeServerNeonQuery(`
      ALTER TABLE miu_notes ADD COLUMN IF NOT EXISTS owner_email TEXT DEFAULT '';
    `);
    await executeServerNeonQuery(`
      ALTER TABLE miu_notes ADD COLUMN IF NOT EXISTS owner_name TEXT DEFAULT '';
    `);
    await executeServerNeonQuery(`
      ALTER TABLE miu_notes ADD COLUMN IF NOT EXISTS parent_id TEXT DEFAULT NULL;
    `);
    await executeServerNeonQuery(`
      ALTER TABLE miu_notes ADD COLUMN IF NOT EXISTS share_settings JSONB NOT NULL DEFAULT '{"isPublicLink":false,"publicRole":"view","collaborators":[]}'::jsonb;
    `);
    await executeServerNeonQuery(`
      ALTER TABLE miu_notes ADD COLUMN IF NOT EXISTS comments JSONB NOT NULL DEFAULT '[]'::jsonb;
    `);
    await executeServerNeonQuery(`
      ALTER TABLE miu_notes ADD COLUMN IF NOT EXISTS kanban_status TEXT DEFAULT 'todo';
    `);
    await executeServerNeonQuery(`
      ALTER TABLE miu_notes ADD COLUMN IF NOT EXISTS due_date TEXT DEFAULT '';
    `);
    await executeServerNeonQuery(`
      ALTER TABLE miu_notes ADD COLUMN IF NOT EXISTS due_time TEXT DEFAULT '';
    `);
    await executeServerNeonQuery(`
      ALTER TABLE miu_notes ADD COLUMN IF NOT EXISTS google_event_id TEXT DEFAULT '';
    `);
    await executeServerNeonQuery(`
      ALTER TABLE miu_notes ADD COLUMN IF NOT EXISTS is_full_width BOOLEAN DEFAULT FALSE;
    `);
    await executeServerNeonQuery(`
      CREATE INDEX IF NOT EXISTS idx_miu_notes_user_id ON miu_notes(user_id);
    `);

    schemaInitializedForUrl = neonDatabaseUrl;
    return true;
  } catch (err) {
    console.warn('[Server Cloud] Gagal inisialisasi skema:', err);
    return false;
  }
}

export async function upsertServerUser(user: ServerGoogleUser): Promise<boolean> {
  if (!isServerNeonConfigured()) return false;
  await ensureServerNeonSchema();
  await executeServerNeonQuery(
    `INSERT INTO miu_users (id, email, name, picture, created_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email) DO UPDATE SET
       name = EXCLUDED.name,
       picture = EXCLUDED.picture`,
    [user.id, user.email, user.name, user.picture || '', Number(user.loginAt) || Date.now()]
  );
  return true;
}

interface NeonNoteRow {
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

function parseShareSettings(raw: unknown): NoteShareSettings {
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

function parseBlocksField(raw: unknown): NoteBlock[] {
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

function parseNeonNoteRow(r: NeonNoteRow): NoteRecord {
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
    shareSettings: parseShareSettings(r.share_settings),
    comments: parsedComments,
    createdAt: Number(r.created_at) || Date.now(),
    updatedAt: Number(r.updated_at) || Date.now()
  };
}

export type EffectiveRole = 'owner' | SharePermission | null;

const ROLE_WEIGHT: Record<Exclude<EffectiveRole, null>, number> = {
  view: 1,
  comment: 2,
  edit: 3,
  owner: 4
};

function resolveDirectRole(
  ownerId: string,
  shareSettings: NoteShareSettings,
  viewerUserId: string,
  viewerEmail: string
): EffectiveRole {
  if (viewerUserId && ownerId === viewerUserId) return 'owner';

  let best: EffectiveRole = null;
  const pickBest = (candidate: EffectiveRole) => {
    if (!candidate) return;
    if (!best || ROLE_WEIGHT[candidate] > ROLE_WEIGHT[best]) {
      best = candidate;
    }
  };

  if (viewerEmail) {
    const collab = shareSettings.collaborators?.find(
      (c) => c.email.toLowerCase() === viewerEmail.toLowerCase()
    );
    if (collab) pickBest(collab.role);
  }

  if (shareSettings.isPublicLink) {
    pickBest(shareSettings.publicRole);
  }

  return best;
}

export async function getEffectiveNoteRole(
  noteId: string,
  viewerUserId = '',
  viewerEmail = ''
): Promise<{ exists: boolean; role: EffectiveRole; existingOwnerId?: string; existingShare?: NoteShareSettings }> {
  const { rows } = await executeServerNeonQuery<{
    id: string;
    user_id: string;
    parent_id: string | null;
    share_settings: unknown;
    depth: number;
  }>(
    `WITH RECURSIVE ancestors AS (
       SELECT id, user_id, parent_id, share_settings, 0 AS depth
       FROM miu_notes
       WHERE id = $1
       UNION ALL
       SELECT p.id, p.user_id, p.parent_id, p.share_settings, a.depth + 1
       FROM miu_notes p
       INNER JOIN ancestors a ON a.parent_id = p.id
       WHERE a.depth < 12
     )
     SELECT id, user_id, parent_id, share_settings, depth
     FROM ancestors
     ORDER BY depth ASC`,
    [noteId]
  );

  if (rows.length === 0) {
    return { exists: false, role: null };
  }

  let bestRole: EffectiveRole = null;
  for (const row of rows) {
    const share = parseShareSettings(row.share_settings);
    const direct = resolveDirectRole(row.user_id, share, viewerUserId, viewerEmail.trim());
    if (direct && (!bestRole || ROLE_WEIGHT[direct] > ROLE_WEIGHT[bestRole])) {
      bestRole = direct;
    }
  }

  const targetRow = rows[0];
  return {
    exists: true,
    role: bestRole,
    existingOwnerId: targetRow.user_id,
    existingShare: parseShareSettings(targetRow.share_settings)
  };
}

export async function fetchServerNotes(
  userId: string,
  userEmail = ''
): Promise<NoteRecord[] | null> {
  if (!isServerNeonConfigured()) return null;
  await ensureServerNeonSchema();

  const { rows } = await executeServerNeonQuery<NeonNoteRow>(
    `WITH RECURSIVE accessible_notes AS (
       SELECT id, user_id, owner_email, owner_name, parent_id, semester_id, course_id,
              title, icon, cover, is_favorite, is_full_width, kanban_status, due_date, due_time, google_event_id, blocks, share_settings, comments, created_at, updated_at
       FROM miu_notes
       WHERE user_id = $1
          OR (
            $2 <> '' AND EXISTS (
              SELECT 1 FROM jsonb_array_elements(COALESCE(share_settings->'collaborators', '[]'::jsonb)) AS c
              WHERE LOWER(c->>'email') = LOWER($2)
            )
          )
       UNION
       SELECT child.id, child.user_id, child.owner_email, child.owner_name, child.parent_id, child.semester_id, child.course_id,
              child.title, child.icon, child.cover, child.is_favorite, child.is_full_width, child.kanban_status, child.due_date, child.due_time, child.google_event_id, child.blocks, child.share_settings, child.comments, child.created_at, child.updated_at
       FROM miu_notes child
       INNER JOIN accessible_notes parent ON child.parent_id = parent.id
     )
     SELECT * FROM accessible_notes
     ORDER BY created_at ASC`,
    [userId, userEmail.trim()]
  );

  return rows.map(parseNeonNoteRow);
}

export async function fetchServerSharedNote(
  noteId: string,
  viewerUserId = '',
  viewerEmail = ''
): Promise<NoteRecord[] | null> {
  if (!isServerNeonConfigured() || !noteId) return null;
  await ensureServerNeonSchema();

  const access = await getEffectiveNoteRole(noteId, viewerUserId, viewerEmail);
  if (!access.exists || !access.role) {
    return null;
  }

  const { rows } = await executeServerNeonQuery<NeonNoteRow>(
    `WITH RECURSIVE descendants AS (
       SELECT id, user_id, owner_email, owner_name, parent_id, semester_id, course_id,
              title, icon, cover, is_favorite, is_full_width, kanban_status, due_date, due_time, google_event_id, blocks, share_settings, comments, created_at, updated_at
       FROM miu_notes
       WHERE id = $1
       UNION
       SELECT child.id, child.user_id, child.owner_email, child.owner_name, child.parent_id, child.semester_id, child.course_id,
              child.title, child.icon, child.cover, child.is_favorite, child.is_full_width, child.kanban_status, child.due_date, child.due_time, child.google_event_id, child.blocks, child.share_settings, child.comments, child.created_at, child.updated_at
       FROM miu_notes child
       INNER JOIN descendants parent ON child.parent_id = parent.id
     )
     SELECT * FROM descendants
     ORDER BY created_at ASC`,
    [noteId]
  );

  return rows.length > 0 ? rows.map(parseNeonNoteRow) : null;
}

export async function saveServerNote(
  actorUserId: string,
  actorEmail: string,
  note: NoteRecord
): Promise<{ ok: boolean; status: number; error?: string }> {
  if (!isServerNeonConfigured()) {
    return { ok: false, status: 503, error: 'Cloud Catatan tidak aktif.' };
  }
  await ensureServerNeonSchema();

  const existing = await getEffectiveNoteRole(note.id, actorUserId, actorEmail);
  const defaultShare: NoteShareSettings = {
    isPublicLink: false,
    publicRole: 'view',
    collaborators: []
  };

  if (existing.exists) {
    if (existing.role !== 'owner' && existing.role !== 'edit') {
      return { ok: false, status: 403, error: 'Tidak memiliki izin untuk mengedit catatan ini.' };
    }
  } else if (note.parentId) {
    const parentAccess = await getEffectiveNoteRole(note.parentId, actorUserId, actorEmail);
    if (parentAccess.exists && parentAccess.role !== 'owner' && parentAccess.role !== 'edit') {
      return { ok: false, status: 403, error: 'Tidak memiliki izin membuat subhalaman di catatan ini.' };
    }
  }

  // Only owner can change share settings on an existing note
  const nextShareSettings =
    existing.exists && existing.role !== 'owner'
      ? existing.existingShare || defaultShare
      : note.shareSettings || defaultShare;

  const ownerIdToPersist = existing.exists
    ? existing.existingOwnerId || actorUserId
    : note.ownerId || actorUserId;

  await executeServerNeonQuery(
    `INSERT INTO miu_notes (
       id, user_id, owner_email, owner_name, parent_id, semester_id, course_id,
       title, icon, cover, is_favorite, is_full_width, kanban_status, due_date, due_time, google_event_id, blocks, share_settings, comments, created_at, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb, $18::jsonb, $19::jsonb, $20, $21)
     ON CONFLICT (id) DO UPDATE SET
       parent_id = EXCLUDED.parent_id,
       title = EXCLUDED.title,
       icon = EXCLUDED.icon,
       cover = EXCLUDED.cover,
       is_favorite = EXCLUDED.is_favorite,
       is_full_width = EXCLUDED.is_full_width,
       kanban_status = EXCLUDED.kanban_status,
       due_date = EXCLUDED.due_date,
       due_time = EXCLUDED.due_time,
       google_event_id = EXCLUDED.google_event_id,
       blocks = EXCLUDED.blocks,
       share_settings = EXCLUDED.share_settings,
       comments = EXCLUDED.comments,
       updated_at = EXCLUDED.updated_at`,
    [
      note.id,
      ownerIdToPersist,
      note.ownerEmail || '',
      note.ownerName || '',
      note.parentId || null,
      note.semesterId || 'sem-1',
      note.courseId || 'course-default',
      note.title || '',
      note.icon || '📄',
      note.cover || '',
      Boolean(note.isFavorite),
      Boolean(note.isFullWidth),
      note.kanbanStatus || 'todo',
      note.dueDate || '',
      note.dueTime || '',
      note.googleEventId || '',
      JSON.stringify(note.blocks || []),
      JSON.stringify(nextShareSettings),
      JSON.stringify(note.comments || []),
      Number(note.createdAt) || Date.now(),
      Number(note.updatedAt) || Date.now()
    ]
  );

  return { ok: true, status: 200 };
}

export async function submitServerFormResponse(params: {
  sourceNoteId: string;
  formBlockId: string;
  targetNoteId: string;
  targetBlockId: string;
  values: Record<string, unknown>;
  actorUserId?: string;
  actorEmail?: string;
}): Promise<{
  ok: boolean;
  status: number;
  row?: DatabaseRow;
  submissionCount?: number;
  error?: string;
}> {
  if (!isServerNeonConfigured()) {
    return { ok: false, status: 503, error: 'Cloud Catatan tidak aktif.' };
  }
  await ensureServerNeonSchema();

  const sourceAccess = await getEffectiveNoteRole(
    params.sourceNoteId,
    params.actorUserId || '',
    params.actorEmail || ''
  );
  if (!sourceAccess.exists || !sourceAccess.role) {
    return { ok: false, status: 403, error: 'Tidak memiliki akses ke formulir ini.' };
  }

  const { rows: srcRows } = await executeServerNeonQuery<{ blocks: unknown }>(
    `SELECT blocks FROM miu_notes WHERE id = $1 LIMIT 1`,
    [params.sourceNoteId]
  );
  if (srcRows.length === 0) {
    return { ok: false, status: 404, error: 'Catatan formulir tidak ditemukan.' };
  }

  const sourceBlocks = parseBlocksField(srcRows[0].blocks);
  const formBlock = findBlockById(sourceBlocks, params.formBlockId);
  if (!formBlock || formBlock.type !== 'form' || !formBlock.formData) {
    return { ok: false, status: 404, error: 'Blok formulir tidak ditemukan.' };
  }

  const formConfig = formBlock.formData;
  if (
    formConfig.targetNoteId !== params.targetNoteId ||
    formConfig.targetBlockId !== params.targetBlockId
  ) {
    return { ok: false, status: 400, error: 'Target database formulir tidak cocok.' };
  }

  if (formConfig.responseAccess === 'closed') {
    return { ok: false, status: 403, error: 'Formulir ini sedang ditutup oleh pemiliknya.' };
  }

  if (formConfig.responseAccess === 'edit_only') {
    const targetAccess = await getEffectiveNoteRole(
      params.targetNoteId,
      params.actorUserId || '',
      params.actorEmail || ''
    );
    if (
      !targetAccess.exists ||
      (targetAccess.role !== 'owner' && targetAccess.role !== 'edit')
    ) {
      return {
        ok: false,
        status: 403,
        error: 'Formulir ini hanya dapat diisi oleh pemilik atau kolaborator Edit.'
      };
    }
  }

  let targetBlocks: NoteBlock[];
  if (params.targetNoteId === params.sourceNoteId) {
    targetBlocks = sourceBlocks;
  } else {
    const { rows: tgtRows } = await executeServerNeonQuery<{ blocks: unknown }>(
      `SELECT blocks FROM miu_notes WHERE id = $1 LIMIT 1`,
      [params.targetNoteId]
    );
    if (tgtRows.length === 0) {
      return { ok: false, status: 404, error: 'Catatan tabel database tujuan tidak ditemukan.' };
    }
    targetBlocks = parseBlocksField(tgtRows[0].blocks);
  }

  const dbBlock = findBlockById(targetBlocks, params.targetBlockId);
  if (!dbBlock || dbBlock.type !== 'database' || !dbBlock.databaseData) {
    return { ok: false, status: 404, error: 'Blok tabel database tujuan tidak ditemukan.' };
  }

  const sanitized = sanitizeFormSubmission(
    formConfig,
    dbBlock.databaseData.columns,
    params.values || {}
  );
  if (!sanitized.ok || !sanitized.row) {
    const firstErr = Object.values(sanitized.errors)[0] || 'Data formulir tidak valid.';
    return { ok: false, status: 400, error: firstErr };
  }

  const now = Date.now();
  const nextCount = (formConfig.submissionCount || 0) + 1;

  let nextTargetBlocks = mapBlockDeep(targetBlocks, params.targetBlockId, (blk) => ({
    ...blk,
    databaseData: blk.databaseData
      ? {
          ...blk.databaseData,
          rows: [...(blk.databaseData.rows || []), sanitized.row!]
        }
      : blk.databaseData
  }));

  if (params.targetNoteId === params.sourceNoteId) {
    nextTargetBlocks = mapBlockDeep(nextTargetBlocks, params.formBlockId, (blk) => ({
      ...blk,
      formData: blk.formData
        ? { ...blk.formData, submissionCount: nextCount }
        : blk.formData
    }));
    await executeServerNeonQuery(
      `UPDATE miu_notes SET blocks = $2::jsonb, updated_at = $3 WHERE id = $1`,
      [params.targetNoteId, JSON.stringify(nextTargetBlocks), now]
    );
  } else {
    await executeServerNeonQuery(
      `UPDATE miu_notes SET blocks = $2::jsonb, updated_at = $3 WHERE id = $1`,
      [params.targetNoteId, JSON.stringify(nextTargetBlocks), now]
    );
    const nextSourceBlocks = mapBlockDeep(sourceBlocks, params.formBlockId, (blk) => ({
      ...blk,
      formData: blk.formData
        ? { ...blk.formData, submissionCount: nextCount }
        : blk.formData
    }));
    await executeServerNeonQuery(
      `UPDATE miu_notes SET blocks = $2::jsonb, updated_at = $3 WHERE id = $1`,
      [params.sourceNoteId, JSON.stringify(nextSourceBlocks), now]
    );
  }

  return {
    ok: true,
    status: 200,
    row: sanitized.row,
    submissionCount: nextCount
  };
}

export async function saveServerNoteComments(
  noteId: string,
  comments: NoteComment[],
  actorUserId = '',
  actorEmail = ''
): Promise<{ ok: boolean; status: number; error?: string }> {
  if (!isServerNeonConfigured()) {
    return { ok: false, status: 503, error: 'Cloud Catatan tidak aktif.' };
  }
  await ensureServerNeonSchema();

  const existing = await getEffectiveNoteRole(noteId, actorUserId, actorEmail);
  if (!existing.exists) {
    return { ok: false, status: 404, error: 'Catatan tidak ditemukan.' };
  }
  if (
    existing.role !== 'owner' &&
    existing.role !== 'edit' &&
    existing.role !== 'comment'
  ) {
    return { ok: false, status: 403, error: 'Tidak memiliki izin memberi komentar pada catatan ini.' };
  }

  await executeServerNeonQuery(
    `UPDATE miu_notes SET comments = $2::jsonb, updated_at = $3 WHERE id = $1`,
    [noteId, JSON.stringify(comments || []), Date.now()]
  );

  return { ok: true, status: 200 };
}

export async function deleteServerNote(
  userId: string,
  noteId: string
): Promise<{ ok: boolean; status: number }> {
  if (!isServerNeonConfigured()) {
    return { ok: false, status: 503 };
  }
  await ensureServerNeonSchema();

  await executeServerNeonQuery(
    `WITH RECURSIVE note_tree AS (
       SELECT id FROM miu_notes WHERE id = $1 AND user_id = $2
       UNION ALL
       SELECT c.id FROM miu_notes c
       INNER JOIN note_tree p ON c.parent_id = p.id
       WHERE c.user_id = $2
     )
     DELETE FROM miu_notes WHERE id IN (SELECT id FROM note_tree)`,
    [noteId, userId]
  );

  return { ok: true, status: 200 };
}

export async function uploadMediaToServerCloud(
  source: Blob | string
): Promise<{ url: string; isCloudinary: boolean }> {
  const {
    cloudinaryCloudName,
    cloudinaryApiKey,
    cloudinaryApiSecret,
    cloudinaryUploadPreset
  } = getServerCloudEnv();

  if (cloudinaryCloudName && cloudinaryApiKey && cloudinaryApiSecret) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const folder = 'miu-notes';
    const toSign = `folder=${folder}&timestamp=${timestamp}${cloudinaryApiSecret}`;
    const signature = createHash('sha1').update(toSign).digest('hex');

    const formData = new FormData();
    formData.append('file', source);
    formData.append('api_key', cloudinaryApiKey);
    formData.append('timestamp', timestamp);
    formData.append('folder', folder);
    formData.append('signature', signature);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudinaryCloudName)}/auto/upload`,
      {
        method: 'POST',
        body: formData,
        cache: 'no-store'
      }
    );

    if (!res.ok) {
      const errData = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      throw new Error(
        errData.error?.message || `Gagal mengunggah gambar ke Cloud Catatan (${res.status}).`
      );
    }

    const data = (await res.json()) as { secure_url: string };
    return { url: data.secure_url, isCloudinary: true };
  }

  if (cloudinaryCloudName && cloudinaryUploadPreset) {
    const formData = new FormData();
    formData.append('file', source);
    formData.append('upload_preset', cloudinaryUploadPreset);
    formData.append('folder', 'miu-notes');

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudinaryCloudName)}/auto/upload`,
      {
        method: 'POST',
        body: formData,
        cache: 'no-store'
      }
    );

    if (!res.ok) {
      const errData = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      throw new Error(
        errData.error?.message || `Gagal mengunggah gambar ke Cloud Catatan (${res.status}).`
      );
    }

    const data = (await res.json()) as { secure_url: string };
    return { url: data.secure_url, isCloudinary: true };
  }

  if (typeof source === 'string') {
    return { url: source, isCloudinary: false };
  }

  const buffer = Buffer.from(await source.arrayBuffer());
  const mime = source.type || 'application/octet-stream';
  return {
    url: `data:${mime};base64,${buffer.toString('base64')}`,
    isCloudinary: false
  };
}
