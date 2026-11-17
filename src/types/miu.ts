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
  | 'subpage';

export interface NoteBlock {
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

export type SpotifySourceMode = 'embed' | 'pkce' | 'offline';

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
