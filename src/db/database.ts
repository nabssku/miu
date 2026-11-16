import Dexie, { type Table } from 'dexie';
import type {
  BoardItemRecord,
  CourseRecord,
  NoteRecord,
  PrayerCacheRecord,
  ScreenTimeLogRecord,
  SemesterRecord,
  TodoRecord
} from '../types/miu';

export class MiuDatabase extends Dexie {
  semesters!: Table<SemesterRecord, string>;
  courses!: Table<CourseRecord, string>;
  notes!: Table<NoteRecord, string>;
  todos!: Table<TodoRecord, string>;
  boardItems!: Table<BoardItemRecord, string>;
  screenTimeLogs!: Table<ScreenTimeLogRecord, string>;
  prayerCache!: Table<PrayerCacheRecord, string>;

  constructor() {
    super('MiuWorkspaceDB');
    this.version(2).stores({
      semesters: 'id, order',
      courses: 'id, semesterId, code',
      notes: 'id, courseId, semesterId, createdAt, updatedAt',
      todos: 'id, courseId, noteId, completed, createdAt',
      boardItems: 'id, tab, createdAt',
      screenTimeLogs: 'id, date, courseId',
      prayerCache: 'id, city, monthKey'
    });
  }
}

export const db = new MiuDatabase();

export async function ensureInitialSeed(): Promise<void> {
  if (typeof window === 'undefined') return;
  // One-time reset of old dummy seed data so workspace starts clean & blank
  const cleanFlag = window.localStorage.getItem('miu_clean_blank_v1');
  if (!cleanFlag) {
    await Promise.all([
      db.semesters.clear(),
      db.courses.clear(),
      db.notes.clear(),
      db.todos.clear(),
      db.boardItems.clear(),
      db.screenTimeLogs.clear()
    ]);
    window.localStorage.setItem('miu_clean_blank_v1', '1');
  }

  const existingNotes = await db.notes.count();
  if (existingNotes > 0) return;

  const now = Date.now();

  await db.semesters.put({ id: 'sem-1', name: 'Umum', order: 1 });
  await db.courses.put({
    id: 'course-default',
    semesterId: 'sem-1',
    name: 'Catatan Pribadi',
    code: 'CATATAN',
    color: '#38BDF8',
    weeklyTargetHours: 4
  });

  await db.notes.put({
    id: 'note-default',
    semesterId: 'sem-1',
    courseId: 'course-default',
    title: '',
    icon: '📄',
    isFavorite: false,
    createdAt: now,
    updatedAt: now,
    blocks: [
      {
        id: 'blk-initial',
        type: 'text',
        content: ''
      }
    ]
  });
}
