export type ThemeMode = 'light' | 'dark';

export type IslandAnchorPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'mid-left'
  | 'mid-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export type IslandPopoverType =
  | 'none'
  | 'dock'
  | 'notes'
  | 'todo'
  | 'board'
  | 'pomodoro'
  | 'music'
  | 'mirror'
  | 'lazytype'
  | 'screentime'
  | 'settings';

export type MascotMood =
  | 'idle'
  | 'sleep'
  | 'focus'
  | 'music'
  | 'lazytype'
  | 'hydration'
  | 'stretch'
  | 'sholat';

export type BlockType =
  | 'text'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bullet'
  | 'numbered'
  | 'todo'
  | 'deadline'
  | 'toggle'
  | 'callout'
  | 'code'
  | 'math'
  | 'quote'
  | 'divider'
  | 'image'
  | 'video'
  | 'link'
  | 'pdf'
  | 'subpage'
  | 'columns'
  | 'database'
  | 'chart'
  | 'form'
  | 'metric';

export interface NoteBlockBase {
  id: string;
  type: BlockType;
  content: string;
  checked?: boolean;
  pomodoros?: number;
  language?: string;
  calloutIcon?: string;
  caption?: string;
  toggleOpen?: boolean;
  toggleBody?: string;
  fileName?: string;
  pdfText?: string;
  pdfPages?: number;
  subpageId?: string;
  subpageIcon?: string;
  dueDate?: string; // YYYY-MM-DD for Todo/Deadline blocks
  dueTime?: string; // HH:mm optional
  googleEventId?: string;
  databaseData?: DatabaseBlockData;
  chartData?: ChartBlockData;
  formData?: FormBlockData;
  metricData?: MetricBlockData;
}

export interface NoteColumn {
  id: string;
  blocks: NoteBlockBase[];
}

export interface NoteBlock extends NoteBlockBase {
  columns?: NoteColumn[];
}

export type DatabaseColumnType =
  | 'text'
  | 'number'
  | 'select'
  | 'multi_select'
  | 'checkbox'
  | 'date'
  | 'url';

export type DatabaseBadgeColor = 'sky' | 'emerald' | 'amber' | 'rose' | 'violet' | 'slate';

export interface DatabaseSelectOption {
  id: string;
  label: string;
  color: DatabaseBadgeColor;
}

export interface DatabaseColumn {
  id: string;
  name: string;
  type: DatabaseColumnType;
  options?: DatabaseSelectOption[];
  numberFormat?: 'plain' | 'currency_idr' | 'percent';
  aggregation?: 'none' | 'count' | 'sum' | 'avg' | 'min' | 'max' | 'checked';
}

export type DatabaseCellValue = string | number | boolean | string[];

export interface DatabaseRow {
  id: string;
  cells: Record<string, DatabaseCellValue>;
  createdAt: number;
  updatedAt: number;
  source?: 'manual' | 'form';
}

export interface DatabaseBlockData {
  title: string;
  description?: string;
  columns: DatabaseColumn[];
  rows: DatabaseRow[];
  sortBy?: { columnId: string; direction: 'asc' | 'desc' } | null;
  filterBy?: { columnId: string; query: string } | null;
  viewMode?: 'table' | 'cards';
}

export type ChartKind = 'bar' | 'horizontal_bar' | 'donut' | 'line';
export type ChartAggregation = 'count' | 'sum' | 'avg';

export interface ChartBlockData {
  title: string;
  kind: ChartKind;
  sourceNoteId: string;
  sourceBlockId: string;
  categoryColumnId: string;
  valueColumnId?: string;
  aggregation: ChartAggregation;
  sortOrder?: 'value_desc' | 'value_asc' | 'label_asc';
  maxItems?: number;
  showLegend?: boolean;
  showValues?: boolean;
  filterColumnId?: string;
  filterValue?: string;
  palette?: 'miu' | 'ocean' | 'warm' | 'emerald';
}

export type FormResponseAccess = 'public' | 'edit_only' | 'closed';

export interface FormFieldConfig {
  id: string;
  columnId: string;
  label: string;
  helperText?: string;
  placeholder?: string;
  fieldType: DatabaseColumnType;
  options?: DatabaseSelectOption[];
  required: boolean;
  hidden?: boolean;
}

export interface FormBlockData {
  title: string;
  description?: string;
  targetNoteId: string;
  targetBlockId: string;
  fields: FormFieldConfig[];
  submitLabel?: string;
  successMessage?: string;
  responseAccess: FormResponseAccess;
  submissionCount?: number;
}

export interface MetricBlockData {
  title: string;
  sourceKind: 'database' | 'page_todos';
  sourceNoteId?: string;
  sourceBlockId?: string;
  columnId?: string;
  operation: 'count' | 'sum' | 'avg' | 'completion_rate';
  prefix?: string;
  suffix?: string;
  accentColor?: DatabaseBadgeColor;
}

export type SharePermission = 'view' | 'comment' | 'edit';

export type NoteKanbanStatus = 'todo' | 'in_progress' | 'done';

export interface SharedCollaborator {
  email: string;
  role: SharePermission;
  addedAt: number;
}

export interface NoteShareSettings {
  isPublicLink: boolean;
  publicRole: SharePermission;
  collaborators: SharedCollaborator[];
}

export interface NoteComment {
  id: string;
  authorId: string;
  authorName: string;
  authorEmail: string;
  authorPicture?: string;
  content: string;
  createdAt: number;
}

export interface SemesterRecord {
  id: string;
  name: string;
  order: number;
}

export interface CourseRecord {
  id: string;
  semesterId: string;
  name: string;
  code: string;
  color: string;
  weeklyTargetHours: number;
}

export interface NoteRecord {
  id: string;
  ownerId?: string;
  ownerEmail?: string;
  ownerName?: string;
  parentId?: string | null;
  semesterId: string;
  courseId: string;
  title: string;
  icon?: string;
  cover?: string;
  isFavorite?: boolean;
  isFullWidth?: boolean;
  kanbanStatus?: NoteKanbanStatus;
  dueDate?: string; // YYYY-MM-DD note deadline
  dueTime?: string; // HH:mm optional
  googleEventId?: string;
  blocks: NoteBlock[];
  shareSettings?: NoteShareSettings;
  comments?: NoteComment[];
  createdAt: number;
  updatedAt: number;
}

export interface TodoRecord {
  id: string;
  courseId: string;
  noteId?: string;
  text: string;
  completed: boolean;
  targetPomodoros: number;
  completedPomodoros: number;
  createdAt: number;
}

export interface BoardItemRecord {
  id: string;
  tab: 'clipboard' | 'shelf';
  contentType: 'text' | 'math' | 'image';
  title: string;
  content: string;
  createdAt: number;
}

export interface ScreenTimeLogRecord {
  id: string;
  date: string; // YYYY-MM-DD
  courseId: string;
  activeSeconds: number;
}

export interface PrayerTimings {
  Fajr: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
}

export interface PrayerCacheRecord {
  id: string; // city_YYYY-MM
  city: string;
  monthKey: string;
  timings: PrayerTimings;
  fetchedAt: number;
}

export type NoiseChannelId = 'rain' | 'forest' | 'waves' | 'cafe' | 'kalimba';

export interface LyricLine {
  timeMs: number;
  text: string;
}

export type SpotifySourceMode = 'youtube' | 'embed' | 'pkce' | 'offline';

export interface ActiveTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  durationMs: number;
  positionMs: number;
  isPlaying: boolean;
  spotifyUri?: string;
  youtubeId?: string;
  sourceQuery?: string;
  source: SpotifySourceMode;
  glowColor: string;
}

export type AIProviderId =
  | 'groq'
  | 'custom'
  | 'gemini'
  | 'claude'
  | 'openrouter'
  | 'openai'
  | 'ollama';

export interface AIChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface HotkeyConfig {
  commandBar: string;
  lazytype: string;
  lazyshot: string;
}

export interface ActiveBlockTarget {
  noteId: string;
  blockId: string;
  field?: 'content' | 'toggleBody';
  blockType?: BlockType;
  preview?: string;
  selectionStart?: number;
  selectionEnd?: number;
  source?: 'focus' | 'selection';
  updatedAt?: number;
}

export interface LastDictationEvent {
  noteId: string;
  blockId: string;
  field: 'content' | 'toggleBody';
  caret: number;
  at: number;
}

export interface DictationInsertResult {
  ok: boolean;
  error?: string;
  noteId?: string;
  targetBlockId?: string;
  field?: 'content' | 'toggleBody';
  caret?: number;
  mode?: 'updated' | 'inserted_after' | 'appended';
}

