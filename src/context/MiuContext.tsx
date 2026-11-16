'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ensureInitialSeed } from '../db/database';
import { audioEngine } from '../services/audioEngine';
import {
  fetchNotesFromNeon,
  fetchSharedNoteByIdFromNeon,
  getStoredGoogleUser,
  saveNoteToNeon,
  setStoredGoogleUser,
  syncCloudStatus,
  upsertUserToNeon,
  type GoogleUser
} from '../services/cloudServices';
import {
  fetchSyncedLyricsFromLRCLIB,
  getNextPrayerInfo,
  getPrayerTimingsForCity
} from '../services/externalApis';
import {
  extractDominantGlowColor,
  fetchSpotifyOEmbedMeta,
  parseSpotifyUri,
  resolveDirectAudioStream,
  SPOTIFY_STUDY_PRESETS,
  type SpotifyEmbedController,
  type SpotifyTrackItem
} from '../services/spotifyService';
import type {
  ActiveTrack,
  BlockType,
  HotkeyConfig,
  IslandAnchorPosition,
  IslandPopoverType,
  LyricLine,
  MascotMood,
  NoiseChannelId,
  NoteBlock,
  PrayerTimings,
  SpotifySourceMode,
  ThemeMode
} from '../types/miu';

export type PomodoroPhase = 'focus' | 'short-break' | 'long-break';

interface ActiveReminderAlert {
  id: string;
  kind: 'hydration' | 'stretch' | 'sholat' | 'pomodoro';
  title: string;
  message: string;
}

interface MiuContextValue {
  isReady: boolean;
  viewMode: 'landing' | 'workspace';
  setViewMode: (mode: 'landing' | 'workspace') => void;
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;

  islandPosition: IslandAnchorPosition;
  setIslandPosition: (pos: IslandAnchorPosition) => void;
  activePopover: IslandPopoverType;
  setActivePopover: (p: IslandPopoverType) => void;
  isPageHidden: boolean;
  mascotMood: MascotMood;

  // Academic hierarchy & Cloud Auth
  currentUser: GoogleUser | null;
  isPublicShareAccess: boolean;
  loginGoogleUser: (user: GoogleUser) => Promise<void>;
  logoutGoogleUser: () => void;
  activeSemesterId: string;
  setActiveSemesterId: (id: string) => void;
  activeCourseId: string;
  setActiveCourseId: (id: string) => void;
  activeNoteId: string;
  setActiveNoteId: (id: string) => void;
  insertBlockIntoActiveNote: (block: Omit<NoteBlock, 'id'>) => Promise<void>;
  insertBlocksIntoActiveNote: (blocks: Array<Omit<NoteBlock, 'id'>>) => Promise<void>;
  appendDictationToActiveNote: (text: string) => Promise<void>;

  // Right Drawer & Overlays
  isAIDrawerOpen: boolean;
  setIsAIDrawerOpen: (v: boolean) => void;
  aiExplainDraft: string;
  aiImageAttachment: { url: string; caption?: string } | null;
  setAiImageAttachment: (img: { url: string; caption?: string } | null) => void;
  aiPdfAttachment: { fileName: string; text: string; pages: number; url?: string } | null;
  setAiPdfAttachment: (
    pdf: { fileName: string; text: string; pages: number; url?: string } | null
  ) => void;
  triggerInlineAIExplain: (
    snippet: string,
    imageAttachment?: { url: string; caption?: string },
    pdfAttachment?: { fileName: string; text: string; pages: number; url?: string }
  ) => void;
  isLazyshotOpen: boolean;
  setIsLazyshotOpen: (v: boolean) => void;
  isSupportModalOpen: 'coffee' | 'bug' | null;
  setIsSupportModalOpen: (v: 'coffee' | 'bug' | null) => void;

  // Pomodoro
  pomodoroPhase: PomodoroPhase;
  pomodoroSeconds: number;
  pomodoroTotalSeconds: number;
  pomodoroRunning: boolean;
  pomodoroCustomMinutes: Record<PomodoroPhase, number>;
  setPomodoroPhaseMinutes: (phase: PomodoroPhase, minutes: number) => void;
  linkedTodoId: string | null;
  setLinkedTodoId: (id: string | null) => void;
  startPomodoro: () => void;
  pausePomodoro: () => void;
  resetPomodoro: (phase?: PomodoroPhase) => void;

  // Spotify Search, Source & LRCLIB
  activeTrack: ActiveTrack;
  lyrics: LyricLine[];
  activeLyricText: string;
  lyricsLoading: boolean;
  spotifyMode: SpotifySourceMode;
  setSpotifyMode: (mode: SpotifySourceMode) => void;
  spotifyEmbedUri: string;
  loadSpotifyUrlOrPreset: (
    urlOrUri: string,
    presetMeta?: { title: string; artist: string; coverUrl: string; glowColor: string }
  ) => void;
  playSpotifyTrackItem: (item: SpotifyTrackItem) => void;
  registerEmbedController: (ctrl: SpotifyEmbedController | null) => void;
  updateEmbedPlaybackState: (positionMs: number, durationMs: number, isPaused: boolean) => void;
  togglePlayMusic: () => void;
  seekMusic: (positionMs: number) => void;
  nextTrack: () => void;
  prevTrack: () => void;

  // Layered White Noise & 3-Channel Mixer
  activeNoises: NoiseChannelId[];
  toggleNoiseChannel: (id: NoiseChannelId) => void;
  volumes: { spotify: number; noise: number; notif: number };
  setChannelVolume: (channel: 'spotify' | 'noise' | 'notif', val: number) => void;

  // Screen Time & Reminders
  todayCourseSeconds: number;
  todayTotalSeconds: number;
  hydrationEnabled: boolean;
  setHydrationEnabled: (v: boolean) => void;
  stretchEnabled: boolean;
  setStretchEnabled: (v: boolean) => void;
  hydrationCountdownSec: number;
  stretchCountdownSec: number;
  prayerCity: string;
  setPrayerCity: (city: string) => void;
  prayerTimings: PrayerTimings | null;
  nextPrayer: { name: string; time: string; minutesRemaining: number };
  activeAlert: ActiveReminderAlert | null;
  dismissAlert: () => void;
  triggerDemoReminder: (kind: 'hydration' | 'stretch' | 'sholat') => void;

  // Lazytype
  isLazytypeActive: boolean;
  setIsLazytypeActive: (v: boolean) => void;
  lazytypeLang: 'id-ID' | 'en-US';
  setLazytypeLang: (lang: 'id-ID' | 'en-US') => void;

  // Hotkeys & PWA Update
  hotkeys: HotkeyConfig;
  setHotkeys: (h: HotkeyConfig) => void;
  pwaUpdateAvailable: boolean;
  setPwaUpdateAvailable: (v: boolean) => void;
  applyPwaUpdate: () => void;
}

const MiuContext = createContext<MiuContextValue | null>(null);

const DEFAULT_PHASE_MINUTES: Record<PomodoroPhase, number> = {
  focus: 25,
  'short-break': 5,
  'long-break': 15
};

export const MiuProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();
  const [prefsHydrated, setPrefsHydrated] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isPublicShareAccess, setIsPublicShareAccess] = useState(false);
  const viewMode: 'landing' | 'workspace' =
    pathname?.startsWith('/app') || isPublicShareAccess ? 'workspace' : 'landing';
  const [theme, setThemeState] = useState<ThemeMode>('light');
  const [islandPosition, setIslandPositionState] = useState<IslandAnchorPosition>('top-center');
  const [activePopover, setActivePopover] = useState<IslandPopoverType>('none');
  const [isPageHidden, setIsPageHidden] = useState<boolean>(false);

  // Academic selection & Google Auth
  const [currentUser, setCurrentUserState] = useState<GoogleUser | null>(null);
  const [activeSemesterId, setActiveSemesterId] = useState('sem-1');
  const [activeCourseId, setActiveCourseId] = useState('course-default');
  const [activeNoteId, setActiveNoteId] = useState('note-default');

  // Drawer & overlays
  const [isAIDrawerOpen, setIsAIDrawerOpen] = useState(false);
  const [aiExplainDraft, setAiExplainDraft] = useState('');
  const [aiImageAttachment, setAiImageAttachment] = useState<{
    url: string;
    caption?: string;
  } | null>(null);
  const [aiPdfAttachment, setAiPdfAttachment] = useState<{
    fileName: string;
    text: string;
    pages: number;
    url?: string;
  } | null>(null);
  const [isLazyshotOpen, setIsLazyshotOpen] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState<'coffee' | 'bug' | null>(null);

  // Pomodoro state (with customizable minutes persisted in localStorage)
  const [pomodoroCustomMinutes, setPomodoroCustomMinutesState] = useState<
    Record<PomodoroPhase, number>
  >(DEFAULT_PHASE_MINUTES);
  const [pomodoroPhase, setPomodoroPhase] = useState<PomodoroPhase>('focus');
  const [pomodoroSeconds, setPomodoroSeconds] = useState<number>(DEFAULT_PHASE_MINUTES.focus * 60);
  const [pomodoroRunning, setPomodoroRunning] = useState(false);
  const [linkedTodoId, setLinkedTodoId] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  // Music & Spotify state (Single Active Audio Owner: Full-Length Stream vs Official Spotify Embed)
  const [spotifyMode, setSpotifyMode] = useState<SpotifySourceMode>('embed');
  const [presetTrackIndex, setPresetTrackIndex] = useState(0);
  const [spotifyEmbedUri, setSpotifyEmbedUri] = useState(SPOTIFY_STUDY_PRESETS[0].uri);
  const embedControllerRef = useRef<SpotifyEmbedController | null>(null);
  const pendingEmbedAutoPlayRef = useRef<boolean>(false);
  const streamRequestIdRef = useRef<number>(0);
  const activeAudioOwnerRef = useRef<'stream' | 'embed'>('stream');

  const [activeTrack, setActiveTrack] = useState<ActiveTrack>(() => ({
    id: SPOTIFY_STUDY_PRESETS[0].id,
    title: SPOTIFY_STUDY_PRESETS[0].title,
    artist: SPOTIFY_STUDY_PRESETS[0].artist,
    album: SPOTIFY_STUDY_PRESETS[0].album,
    coverUrl: SPOTIFY_STUDY_PRESETS[0].coverUrl,
    durationMs: SPOTIFY_STUDY_PRESETS[0].durationMs,
    positionMs: 0,
    isPlaying: false,
    spotifyUri: SPOTIFY_STUDY_PRESETS[0].uri,
    source: 'embed',
    glowColor: SPOTIFY_STUDY_PRESETS[0].glowColor
  }));
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [lyricsLoading, setLyricsLoading] = useState(false);

  // White noise & Mixer
  const [activeNoises, setActiveNoises] = useState<NoiseChannelId[]>([]);
  const [volumes, setVolumes] = useState(() => audioEngine.getVolumes());

  // Screen Time & Reminders
  const [hydrationEnabled, setHydrationEnabled] = useState(true);
  const [stretchEnabled, setStretchEnabled] = useState(true);
  const [hydrationCountdownSec, setHydrationCountdownSec] = useState(60 * 60);
  const [stretchCountdownSec, setStretchCountdownSec] = useState(45 * 60);
  const [prayerCity, setPrayerCityState] = useState('Jakarta');
  const [prayerTimings, setPrayerTimings] = useState<PrayerTimings | null>(null);
  const [activeAlert, setActiveAlert] = useState<ActiveReminderAlert | null>(null);
  const lastInteractionRef = useRef<number>(Date.now());
  const sessionSecondsBufferRef = useRef<number>(0);

  // Lazytype & Hotkeys
  const [isLazytypeActive, setIsLazytypeActive] = useState(false);
  const [lazytypeLang, setLazytypeLang] = useState<'id-ID' | 'en-US'>('id-ID');
  const [hotkeys, setHotkeysState] = useState<HotkeyConfig>({
    commandBar: 'Cmd/Ctrl + K',
    lazytype: 'Alt + Space',
    lazyshot: 'Alt + S'
  });

  // PWA update pill
  const [pwaUpdateAvailable, setPwaUpdateAvailable] = useState(false);
  const waitingSwRef = useRef<ServiceWorker | null>(null);

  const setViewMode = useCallback(
    (mode: 'landing' | 'workspace') => {
      if (mode === 'workspace') {
        const search = typeof window !== 'undefined' ? window.location.search : '';
        router.push(`/app${search}`);
      } else {
        router.push('/');
      }
    },
    [router]
  );

  // Hydrate browser preferences, Dexie seed, public share check & SW registration
  useEffect(() => {
    let mounted = true;
    void syncCloudStatus();

    try {
      const savedTheme = (window.localStorage.getItem('miu_theme') as ThemeMode) || 'light';
      setThemeState(savedTheme);
      const savedPos =
        (window.localStorage.getItem('miu_island_pos') as IslandAnchorPosition) || 'top-center';
      setIslandPositionState(savedPos);
      setIsPageHidden(document.hidden);
      setCurrentUserState(getStoredGoogleUser());

      const savedCity = window.localStorage.getItem('miu_prayer_city') || 'Jakarta';
      setPrayerCityState(savedCity);

      const savedHotkeys = window.localStorage.getItem('miu_hotkeys');
      if (savedHotkeys) setHotkeysState(JSON.parse(savedHotkeys) as HotkeyConfig);

      const savedPomo = window.localStorage.getItem('miu_pomodoro_minutes_v1');
      if (savedPomo) {
        const parsed = JSON.parse(savedPomo);
        const restored = {
          focus: Math.max(1, Math.min(180, Number(parsed.focus) || 25)),
          'short-break': Math.max(1, Math.min(60, Number(parsed['short-break']) || 5)),
          'long-break': Math.max(1, Math.min(90, Number(parsed['long-break']) || 15))
        };
        setPomodoroCustomMinutesState(restored);
        setPomodoroSeconds(restored.focus * 60);
      }
    } catch {
      // ignore storage errors
    }
    setPrefsHydrated(true);

    (async () => {
      const params = new URLSearchParams(window.location.search);
      const sharedIdFromUrl = params.get('share')?.trim() || '';
      const storedUser = getStoredGoogleUser();

      if (sharedIdFromUrl && !window.location.pathname.startsWith('/app')) {
        router.replace(`/app${window.location.search}`);
      }

      if (!storedUser && sharedIdFromUrl) {
        const publicSharedNotes = await fetchSharedNoteByIdFromNeon(sharedIdFromUrl);
        if (publicSharedNotes && publicSharedNotes.length > 0) {
          await db.notes.clear();
          await db.notes.bulkPut(publicSharedNotes);
          if (mounted) {
            setIsPublicShareAccess(true);
            setActiveNoteId(sharedIdFromUrl);
            setIsReady(true);
          }
          return;
        }
      }

      await ensureInitialSeed();
      const firstNote = await db.notes.orderBy('updatedAt').reverse().first();
      if (mounted && firstNote) {
        setActiveNoteId(firstNote.id);
        setActiveCourseId(firstNote.courseId);
        setActiveSemesterId(firstNote.semesterId);
      }
      if (mounted) setIsReady(true);
    })();

    const isLocalhost =
      window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if ('serviceWorker' in navigator && !isLocalhost) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          if (reg.waiting) {
            waitingSwRef.current = reg.waiting;
            setPwaUpdateAvailable(true);
          }
          reg.addEventListener('updatefound', () => {
            const newSw = reg.installing;
            if (!newSw) return;
            newSw.addEventListener('statechange', () => {
              if (newSw.state === 'installed' && navigator.serviceWorker.controller) {
                waitingSwRef.current = newSw;
                setPwaUpdateAvailable(true);
              }
            });
          });
        })
        .catch(() => {});
    }

    return () => {
      mounted = false;
    };
  }, [router]);

  // Sync theme to document root
  useEffect(() => {
    if (!prefsHydrated) return;
    window.localStorage.setItem('miu_theme', theme);
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', theme === 'dark' ? '#161412' : '#EBF5FF');
    }
  }, [theme, prefsHydrated]);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const setTheme = useCallback((t: ThemeMode) => setThemeState(t), []);

  const setIslandPosition = useCallback((pos: IslandAnchorPosition) => {
    setIslandPositionState(pos);
    localStorage.setItem('miu_island_pos', pos);
  }, []);

  // Visibility throttling (`NFR-2`)
  useEffect(() => {
    const onVisChange = () => setIsPageHidden(document.hidden);
    const onActivity = () => {
      lastInteractionRef.current = Date.now();
    };
    document.addEventListener('visibilitychange', onVisChange);
    window.addEventListener('mousemove', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity, { passive: true });
    window.addEventListener('click', onActivity, { passive: true });

    return () => {
      document.removeEventListener('visibilitychange', onVisChange);
      window.removeEventListener('mousemove', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('click', onActivity);
    };
  }, []);

  // Global Hotkeys: Cmd/Ctrl+K, Alt+Space (Lazytype Push-to-Talk), Alt+S (Lazyshot)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setActivePopover((prev) => (prev === 'dock' ? 'none' : 'dock'));
      } else if ((e.altKey && e.code === 'Space') || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'v')) {
        e.preventDefault();
        if (!e.repeat) {
          setIsLazytypeActive(true);
        }
      } else if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        setIsLazyshotOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setActivePopover('none');
        setIsLazyshotOpen(false);
        setIsLazytypeActive(false);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isLazytypeActive) {
        setIsLazytypeActive(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [isLazytypeActive]);

  // Pomodoro Web Worker lifecycle
  useEffect(() => {
    const worker = new Worker('/workers/pomodoroWorker.js');
    workerRef.current = worker;

    worker.onmessage = async (event: MessageEvent) => {
      const { type, remainingSeconds } = event.data as {
        type: string;
        remainingSeconds?: number;
      };
      if (type === 'TICK' && typeof remainingSeconds === 'number') {
        setPomodoroSeconds(remainingSeconds);
      } else if (type === 'COMPLETE') {
        setPomodoroRunning(false);
        audioEngine.playNotificationChime('pomodoro');
        setActiveAlert({
          id: `pomo-${Date.now()}`,
          kind: 'pomodoro',
          title: pomodoroPhase === 'focus' ? 'Sesi Fokus Selesai!' : 'Waktu Istirahat Usai!',
          message:
            pomodoroPhase === 'focus'
              ? 'Hebat! Ambil jeda 5 menit untuk mengistirahatkan mata.'
              : 'Siap kembali ke sesi fokus berikutnya bersama Miu?'
        });

        if (pomodoroPhase === 'focus' && linkedTodoId) {
          const todo = await db.todos.get(linkedTodoId);
          if (todo) {
            await db.todos.update(linkedTodoId, {
              completedPomodoros: todo.completedPomodoros + 1
            });
          }
        }
      }
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [linkedTodoId, pomodoroPhase]);

  const startPomodoro = useCallback(() => {
    setPomodoroRunning(true);
    workerRef.current?.postMessage({ type: 'START', seconds: pomodoroSeconds });
  }, [pomodoroSeconds]);

  const pausePomodoro = useCallback(() => {
    setPomodoroRunning(false);
    workerRef.current?.postMessage({ type: 'PAUSE' });
  }, []);

  const setPomodoroPhaseMinutes = useCallback(
    (phase: PomodoroPhase, minutes: number) => {
      const clamped = Math.max(1, Math.min(180, Math.round(minutes || 1)));
      setPomodoroCustomMinutesState((prev) => {
        const next = { ...prev, [phase]: clamped };
        localStorage.setItem('miu_pomodoro_minutes_v1', JSON.stringify(next));
        return next;
      });
      if (phase === pomodoroPhase) {
        const secs = clamped * 60;
        setPomodoroRunning(false);
        setPomodoroSeconds(secs);
        workerRef.current?.postMessage({ type: 'RESET', seconds: secs });
      }
    },
    [pomodoroPhase]
  );

  const resetPomodoro = useCallback(
    (phase?: PomodoroPhase) => {
      const targetPhase = phase || pomodoroPhase;
      const secs = (pomodoroCustomMinutes[targetPhase] || 25) * 60;
      setPomodoroPhase(targetPhase);
      setPomodoroRunning(false);
      setPomodoroSeconds(secs);
      workerRef.current?.postMessage({ type: 'RESET', seconds: secs });
    },
    [pomodoroPhase, pomodoroCustomMinutes]
  );

  // Screen Time Live Logs via Dexie
  const todayISO = new Date().toISOString().slice(0, 10);
  const todayLogs = useLiveQuery(
    () => db.screenTimeLogs.where('date').equals(todayISO).toArray(),
    [todayISO],
    []
  );

  const todayCourseSeconds = useMemo(
    () => todayLogs.find((l) => l.courseId === activeCourseId)?.activeSeconds || 0,
    [todayLogs, activeCourseId]
  );

  const todayTotalSeconds = useMemo(
    () => todayLogs.reduce((acc, l) => acc + l.activeSeconds, 0),
    [todayLogs]
  );

  // 1-second Screen Time (Anti-AFK 3 minutes) + Reminders countdown
  useEffect(() => {
    const timer = window.setInterval(async () => {
      const now = Date.now();
      const isAFK = now - lastInteractionRef.current > 3 * 60 * 1000;

      if (!document.hidden && !isAFK && viewMode === 'workspace') {
        sessionSecondsBufferRef.current += 1;
        if (sessionSecondsBufferRef.current >= 5) {
          const delta = sessionSecondsBufferRef.current;
          sessionSecondsBufferRef.current = 0;
          const logId = `log-${todayISO}-${activeCourseId}`;
          const existing = await db.screenTimeLogs.get(logId);
          if (existing) {
            await db.screenTimeLogs.update(logId, {
              activeSeconds: existing.activeSeconds + delta
            });
          } else {
            await db.screenTimeLogs.put({
              id: logId,
              date: todayISO,
              courseId: activeCourseId,
              activeSeconds: delta
            });
          }
        }
      }

      if (hydrationEnabled) {
        setHydrationCountdownSec((prev) => {
          if (prev <= 1) {
            audioEngine.playNotificationChime('reminder');
            setActiveAlert({
              id: `hyd-${Date.now()}`,
              kind: 'hydration',
              title: 'Waktunya Minum Air 💧',
              message: 'Sudah 60 menit belajar! Teguk segelas air biar fokus tetap jernih.'
            });
            return 60 * 60;
          }
          return prev - 1;
        });
      }

      if (stretchEnabled) {
        setStretchCountdownSec((prev) => {
          if (prev <= 1) {
            audioEngine.playNotificationChime('reminder');
            setActiveAlert({
              id: `str-${Date.now()}`,
              kind: 'stretch',
              title: 'Peregangan Mata & Bahu 🧘',
              message: '45 menit menatap layar — lihat objek jauh 20 detik & lemaskan bahu.'
            });
            return 45 * 60;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [activeCourseId, hydrationEnabled, stretchEnabled, todayISO, viewMode]);

  // Prayer Schedule loader
  useEffect(() => {
    if (prefsHydrated) {
      window.localStorage.setItem('miu_prayer_city', prayerCity);
    }
    getPrayerTimingsForCity(prayerCity).then(setPrayerTimings).catch(() => {});
  }, [prayerCity, prefsHydrated]);

  const nextPrayer = useMemo(
    () =>
      prayerTimings
        ? getNextPrayerInfo(prayerTimings)
        : { name: 'Isya', time: '19:07', minutesRemaining: 45 },
    [prayerTimings]
  );

  // Load initial synced lyrics for the default Spotify preset
  useEffect(() => {
    fetchSyncedLyricsFromLRCLIB(SPOTIFY_STUDY_PRESETS[0].title, SPOTIFY_STUDY_PRESETS[0].artist)
      .then((lines) => setLyrics(lines))
      .catch(() => {});
  }, []);

  // Local 200ms progress interpolation ONLY when Spotify Embed is the active audio owner
  useEffect(() => {
    if (!activeTrack.isPlaying) return;
    const timer = window.setInterval(() => {
      if (activeAudioOwnerRef.current !== 'embed') return;
      setActiveTrack((prev) => {
        const nextPos = prev.positionMs + 200;
        if (nextPos >= prev.durationMs) {
          return { ...prev, positionMs: 0 };
        }
        return { ...prev, positionMs: Math.min(prev.durationMs, nextPos) };
      });
    }, 200);

    return () => window.clearInterval(timer);
  }, [activeTrack.isPlaying]);

  const activeLyricText = useMemo(() => {
    if (lyrics.length === 0) return `${activeTrack.title} — ${activeTrack.artist}`;
    let matched = lyrics[0].text;
    for (const line of lyrics) {
      if (line.timeMs <= activeTrack.positionMs) {
        matched = line.text;
      } else {
        break;
      }
    }
    return matched;
  }, [lyrics, activeTrack.positionMs, activeTrack.title, activeTrack.artist]);

  const playSpotifyTrackItem = useCallback((item: SpotifyTrackItem) => {
    const reqId = ++streamRequestIdRef.current;
    activeAudioOwnerRef.current = 'stream';
    pendingEmbedAutoPlayRef.current = false;
    setSpotifyMode('embed');

    // Always pause both sources first so audio NEVER overlaps / doubles
    audioEngine.pauseStream();
    if (embedControllerRef.current) {
      try {
        embedControllerRef.current.pause();
      } catch {
        // ignore
      }
    }

    // Sync the Spotify Embed URI for reference without auto-playing the iframe on top of our stream
    if (item.uri) {
      setSpotifyEmbedUri(item.uri);
    }

    if (item.audioUrl) {
      audioEngine.playStreamUrl(item.audioUrl);
    } else {
      resolveDirectAudioStream(item.title, item.artist).then((resolved) => {
        // Ignore stale async response if user already paused or switched tracks
        if (reqId !== streamRequestIdRef.current) return;
        if (resolved?.audioUrl) {
          if (embedControllerRef.current) {
            try {
              embedControllerRef.current.pause();
            } catch {
              // ignore
            }
          }
          audioEngine.playStreamUrl(resolved.audioUrl);
        }
        if (resolved?.coverUrl || resolved?.durationMs) {
          setActiveTrack((prev) => ({
            ...prev,
            coverUrl: resolved.coverUrl || prev.coverUrl,
            durationMs: resolved.durationMs || prev.durationMs
          }));
        }
      });
    }

    void extractDominantGlowColor(item.coverUrl, item.glowColor || '#10B981').then((glowColor) => {
      if (reqId !== streamRequestIdRef.current) return;
      setActiveTrack((prev) => ({ ...prev, glowColor }));
    });

    setActiveTrack({
      id: item.id,
      title: item.title,
      artist: item.artist,
      album: item.album || 'Spotify',
      coverUrl: item.coverUrl,
      durationMs: item.durationMs || 210000,
      positionMs: 0,
      isPlaying: true,
      spotifyUri: item.uri || item.url,
      source: 'embed',
      glowColor: item.glowColor || '#10B981'
    });

    setLyricsLoading(true);
    fetchSyncedLyricsFromLRCLIB(item.title, item.artist, item.durationMs)
      .then((lines) => {
        if (reqId === streamRequestIdRef.current) {
          setLyrics(lines);
        }
      })
      .finally(() => {
        if (reqId === streamRequestIdRef.current) {
          setLyricsLoading(false);
        }
      });
  }, []);

  const loadSpotifyUrlOrPreset = useCallback(
    (
      urlOrUri: string,
      presetMeta?: { title: string; artist: string; coverUrl: string; glowColor: string }
    ) => {
      const parsed = parseSpotifyUri(urlOrUri);
      if (!parsed) return;

      const reqId = ++streamRequestIdRef.current;
      const isPlaylistOrAlbum =
        parsed.startsWith('spotify:playlist:') || parsed.startsWith('spotify:album:');

      // Stop both engines first to prevent any double audio
      audioEngine.pauseStream();
      if (embedControllerRef.current) {
        try {
          embedControllerRef.current.pause();
        } catch {
          // ignore
        }
      }

      setSpotifyMode('embed');
      setSpotifyEmbedUri(parsed);

      if (isPlaylistOrAlbum) {
        // Playlists / Albums play via the Official Spotify Embed controller ONLY
        activeAudioOwnerRef.current = 'embed';
        audioEngine.stopStream();
        pendingEmbedAutoPlayRef.current = true;
        if (embedControllerRef.current) {
          embedControllerRef.current.loadUri(parsed);
          window.setTimeout(() => {
            if (reqId !== streamRequestIdRef.current) return;
            try {
              embedControllerRef.current?.play();
            } catch {
              // ignore
            }
          }, 180);
        }
      } else {
        // Individual tracks resolve full-length audio stream so they are not capped at 30s preview
        activeAudioOwnerRef.current = 'stream';
        pendingEmbedAutoPlayRef.current = false;
      }

      const title = presetMeta?.title || 'Memuat Spotify...';
      const artist = presetMeta?.artist || 'Spotify';
      setActiveTrack((prev) => ({
        ...prev,
        id: parsed,
        title,
        artist,
        album: 'Spotify',
        coverUrl:
          presetMeta?.coverUrl ||
          'https://images.unsplash.com/photo-1614680376593-902f74cf0d41?auto=format&fit=crop&w=200&q=80',
        spotifyUri: parsed,
        source: 'embed',
        positionMs: 0,
        isPlaying: true,
        glowColor: presetMeta?.glowColor || '#10B981'
      }));

      if (presetMeta?.title) {
        if (!isPlaylistOrAlbum) {
          resolveDirectAudioStream(presetMeta.title, presetMeta.artist).then((resolved) => {
            if (reqId !== streamRequestIdRef.current) return;
            if (resolved?.audioUrl) {
              audioEngine.playStreamUrl(resolved.audioUrl);
              setActiveTrack((prev) => ({
                ...prev,
                durationMs: resolved.durationMs || prev.durationMs,
                coverUrl: resolved.coverUrl || prev.coverUrl
              }));
            }
          });
        }
        setLyricsLoading(true);
        fetchSyncedLyricsFromLRCLIB(presetMeta.title, presetMeta.artist)
          .then((lines) => {
            if (reqId === streamRequestIdRef.current) setLyrics(lines);
          })
          .finally(() => {
            if (reqId === streamRequestIdRef.current) setLyricsLoading(false);
          });
      } else {
        fetchSpotifyOEmbedMeta(parsed).then((meta) => {
          if (!meta || reqId !== streamRequestIdRef.current) return;
          setActiveTrack((prev) => ({
            ...prev,
            title: meta.title,
            coverUrl: meta.thumbnailUrl || prev.coverUrl
          }));
          if (!isPlaylistOrAlbum) {
            resolveDirectAudioStream(meta.title, '').then((resolved) => {
              if (reqId !== streamRequestIdRef.current) return;
              if (resolved?.audioUrl) {
                audioEngine.playStreamUrl(resolved.audioUrl);
                setActiveTrack((prev) => ({
                  ...prev,
                  durationMs: resolved.durationMs || prev.durationMs,
                  coverUrl: resolved.coverUrl || prev.coverUrl
                }));
              } else if (embedControllerRef.current) {
                // Fallback to Spotify Embed if no stream found
                activeAudioOwnerRef.current = 'embed';
                embedControllerRef.current.loadUri(parsed);
                try {
                  embedControllerRef.current.play();
                } catch {
                  // ignore
                }
              }
            });
          }
          setLyricsLoading(true);
          fetchSyncedLyricsFromLRCLIB(meta.title, '')
            .then((lines) => {
              if (reqId === streamRequestIdRef.current) setLyrics(lines);
            })
            .finally(() => {
              if (reqId === streamRequestIdRef.current) setLyricsLoading(false);
            });
        });
      }
    },
    []
  );

  const registerEmbedController = useCallback((ctrl: SpotifyEmbedController | null) => {
    embedControllerRef.current = ctrl;
    if (ctrl && pendingEmbedAutoPlayRef.current && activeAudioOwnerRef.current === 'embed') {
      pendingEmbedAutoPlayRef.current = false;
      window.setTimeout(() => {
        try {
          ctrl.play();
        } catch {
          // ignore
        }
      }, 200);
    }
  }, []);

  const updateEmbedPlaybackState = useCallback(
    (positionMs: number, durationMs: number, isPaused: boolean) => {
      if (!isPaused) {
        // User clicked Play inside the Spotify Embed iframe directly -> immediately stop HTML5 stream!
        streamRequestIdRef.current++;
        activeAudioOwnerRef.current = 'embed';
        audioEngine.stopStream();
        setActiveTrack((prev) => ({
          ...prev,
          positionMs,
          durationMs: durationMs || prev.durationMs,
          isPlaying: true
        }));
      } else if (activeAudioOwnerRef.current === 'embed') {
        setActiveTrack((prev) => ({
          ...prev,
          positionMs,
          durationMs: durationMs || prev.durationMs,
          isPlaying: false
        }));
      }
    },
    []
  );

  const togglePlayMusic = useCallback(() => {
    const nextPlaying = !activeTrack.isPlaying;
    if (!nextPlaying) {
      // Pause EVERYTHING immediately and cancel any pending fetch
      streamRequestIdRef.current++;
      audioEngine.pauseStream();
      if (embedControllerRef.current) {
        try {
          embedControllerRef.current.pause();
        } catch {
          // ignore
        }
      }
      setActiveTrack((prev) => ({ ...prev, isPlaying: false }));
      return;
    }

    // Play ONLY the active audio owner (never both!)
    if (activeAudioOwnerRef.current === 'embed') {
      audioEngine.stopStream();
      if (embedControllerRef.current) {
        try {
          embedControllerRef.current.play();
        } catch {
          // ignore
        }
      }
      setActiveTrack((prev) => ({ ...prev, isPlaying: true }));
    } else {
      if (embedControllerRef.current) {
        try {
          embedControllerRef.current.pause();
        } catch {
          // ignore
        }
      }
      const resumed = audioEngine.resumeStream();
      if (!resumed) {
        const reqId = ++streamRequestIdRef.current;
        resolveDirectAudioStream(activeTrack.title, activeTrack.artist).then((resolved) => {
          if (reqId !== streamRequestIdRef.current) return;
          if (resolved?.audioUrl) {
            audioEngine.playStreamUrl(resolved.audioUrl);
            setActiveTrack((prev) => ({
              ...prev,
              durationMs: resolved.durationMs || prev.durationMs,
              coverUrl: resolved.coverUrl || prev.coverUrl
            }));
          }
        });
      }
      setActiveTrack((prev) => ({ ...prev, isPlaying: true }));
    }
  }, [activeTrack.isPlaying, activeTrack.title, activeTrack.artist]);

  const seekMusic = useCallback((positionMs: number) => {
    const clamped = Math.max(0, positionMs);
    setActiveTrack((prev) => ({
      ...prev,
      positionMs: Math.min(prev.durationMs, clamped)
    }));
    if (activeAudioOwnerRef.current === 'embed') {
      try {
        embedControllerRef.current?.seek(Math.floor(clamped / 1000));
      } catch {
        // ignore
      }
    } else {
      audioEngine.seekStream(clamped);
    }
  }, []);

  const switchPresetTrack = useCallback(
    (dir: 1 | -1) => {
      setPresetTrackIndex((prev) => {
        const nextIdx =
          (prev + dir + SPOTIFY_STUDY_PRESETS.length) % SPOTIFY_STUDY_PRESETS.length;
        const nextItem = SPOTIFY_STUDY_PRESETS[nextIdx];
        playSpotifyTrackItem(nextItem);
        return nextIdx;
      });
    },
    [playSpotifyTrackItem]
  );

  // Bind real HTML5 <audio> timeupdate, duration & auto-next on ended
  useEffect(() => {
    audioEngine.onStreamStateChange(({ positionMs, durationMs, isPlaying, ended }) => {
      if (activeAudioOwnerRef.current !== 'stream') return;
      if (ended) {
        switchPresetTrack(1);
        return;
      }
      setActiveTrack((prev) => ({
        ...prev,
        positionMs,
        durationMs: durationMs > 0 ? durationMs : prev.durationMs,
        isPlaying
      }));
    });
    return () => audioEngine.onStreamStateChange(null);
  }, [switchPresetTrack]);

  const nextTrack = useCallback(() => {
    switchPresetTrack(1);
  }, [switchPresetTrack]);

  const prevTrack = useCallback(() => {
    switchPresetTrack(-1);
  }, [switchPresetTrack]);

  const toggleNoiseChannel = useCallback((id: NoiseChannelId) => {
    setActiveNoises((prev) => {
      const exists = prev.includes(id);
      audioEngine.toggleNoise(id, !exists);
      return exists ? prev.filter((item) => item !== id) : [...prev, id];
    });
  }, []);

  const setChannelVolume = useCallback(
    (channel: 'spotify' | 'noise' | 'notif', val: number) => {
      audioEngine.setVolume(channel, val);
      setVolumes(audioEngine.getVolumes());
    },
    []
  );

  // Editor & Cloud Sync helper methods (Strict per-account isolation + Shared notes)
  const syncUserAndNotesWithNeon = useCallback(async (user: GoogleUser) => {
    await upsertUserToNeon(user);
    const cloudNotes = await fetchNotesFromNeon(user.id, user.email);

    // Check if URL has ?share=<noteId>
    const params = new URLSearchParams(window.location.search);
    const sharedIdFromUrl = params.get('share')?.trim() || '';
    const sharedNotesFromUrl = sharedIdFromUrl
      ? await fetchSharedNoteByIdFromNeon(sharedIdFromUrl, user.id, user.email)
      : null;

    if (cloudNotes && cloudNotes.length > 0) {
      const merged = [...cloudNotes];
      if (sharedNotesFromUrl) {
        for (const sn of sharedNotesFromUrl) {
          if (!merged.some((m) => m.id === sn.id)) {
            merged.push(sn);
          }
        }
      }
      await db.notes.clear();
      await db.notes.bulkPut(merged);
      setActiveNoteId(sharedIdFromUrl || merged[0].id);
    } else {
      // Strictly isolate: only migrate local notes that do NOT belong to another user
      const localNotes = (await db.notes.toArray()).filter(
        (n) => !n.ownerId || n.ownerId === user.id
      );
      await db.notes.clear();

      if (localNotes.length === 0) {
        const now = Date.now();
        const freshNote = {
          id: `note-${user.id.slice(-8)}-${now}`,
          ownerId: user.id,
          ownerEmail: user.email,
          ownerName: user.name,
          parentId: null,
          semesterId: 'sem-1',
          courseId: 'course-default',
          title: '',
          icon: '📄',
          isFavorite: false,
          blocks: [{ id: `blk-${now}`, type: 'text' as const, content: '' }],
          createdAt: now,
          updatedAt: now
        };
        await db.notes.put(freshNote);
        await saveNoteToNeon(user.id, freshNote);
        setActiveNoteId(freshNote.id);
      } else {
        for (const n of localNotes) {
          const noteToSave = {
            ...n,
            id: n.id === 'note-default' ? `note-${user.id.slice(-8)}-1` : n.id,
            ownerId: user.id,
            ownerEmail: user.email,
            ownerName: user.name
          };
          await db.notes.put(noteToSave);
          await saveNoteToNeon(user.id, noteToSave);
        }
      }

      if (sharedNotesFromUrl && sharedNotesFromUrl.length > 0) {
        await db.notes.bulkPut(sharedNotesFromUrl);
        setActiveNoteId(sharedIdFromUrl);
      }
    }
  }, []);

  const loginGoogleUser = useCallback(
    async (user: GoogleUser) => {
      setIsPublicShareAccess(false);
      setStoredGoogleUser(user);
      setCurrentUserState(user);
      await syncUserAndNotesWithNeon(user);
    },
    [syncUserAndNotesWithNeon]
  );

  // Also sync automatically on mount / reload when user is already logged in
  useEffect(() => {
    if (!isReady || !currentUser) return;
    void syncUserAndNotesWithNeon(currentUser);
  }, [isReady, currentUser, syncUserAndNotesWithNeon]);

  const logoutGoogleUser = useCallback(() => {
    setStoredGoogleUser(null);
    setCurrentUserState(null);
    setIsPublicShareAccess(false);
    // Clear local notes on logout so another user on the same device never sees private notes
    void (async () => {
      await db.notes.clear();
      await ensureInitialSeed();
    })();
  }, []);

  const insertBlocksIntoActiveNote = useCallback(
    async (blocksData: Array<Omit<NoteBlock, 'id'>>) => {
      if (blocksData.length === 0) return;
      const note = await db.notes.get(activeNoteId);
      if (!note) return;

      // Enforce edit permission when note belongs to another owner
      if (note.ownerId && (!currentUser || note.ownerId !== currentUser.id)) {
        const collabRole = currentUser
          ? note.shareSettings?.collaborators?.find(
              (c) => c.email.toLowerCase() === currentUser.email.toLowerCase()
            )?.role
          : undefined;
        const effective =
          collabRole || (note.shareSettings?.isPublicLink ? note.shareSettings.publicRole : 'view');
        if (effective !== 'edit') {
          return;
        }
      }

      const now = Date.now();
      const newBlocks: NoteBlock[] = blocksData.map((b, idx) => ({
        ...b,
        id: `blk-${now}-${idx}-${Math.random().toString(36).slice(2, 6)}`
      }));

      // Remove trailing empty text block before appending so there is no blank gap
      const baseBlocks =
        note.blocks.length === 1 &&
        note.blocks[0].type === 'text' &&
        !note.blocks[0].content.trim()
          ? []
          : note.blocks;

      const updatedBlocks = [...baseBlocks, ...newBlocks];
      await db.notes.update(activeNoteId, {
        blocks: updatedBlocks,
        updatedAt: now
      });

      const targetOwnerId = note.ownerId || currentUser?.id;
      if (targetOwnerId) {
        void saveNoteToNeon(targetOwnerId, {
          ...note,
          blocks: updatedBlocks,
          updatedAt: now
        });
      }
    },
    [activeNoteId, currentUser]
  );

  const insertBlockIntoActiveNote = useCallback(
    async (blockData: Omit<NoteBlock, 'id'>) => {
      await insertBlocksIntoActiveNote([blockData]);
    },
    [insertBlocksIntoActiveNote]
  );

  const appendDictationToActiveNote = useCallback(
    async (text: string) => {
      await insertBlockIntoActiveNote({ type: 'text', content: text });
    },
    [insertBlockIntoActiveNote]
  );

  const triggerInlineAIExplain = useCallback(
    (
      snippet: string,
      imageAttachment?: { url: string; caption?: string },
      pdfAttachment?: { fileName: string; text: string; pages: number; url?: string }
    ) => {
      if (pdfAttachment) {
        setAiPdfAttachment(pdfAttachment);
        setAiImageAttachment(null);
        setAiExplainDraft(snippet || '');
      } else if (imageAttachment) {
        setAiImageAttachment(imageAttachment);
        setAiPdfAttachment(null);
        setAiExplainDraft(snippet || '');
      } else {
        setAiExplainDraft(snippet);
      }
      setIsAIDrawerOpen(true);
      setViewMode('workspace');
    },
    [setViewMode]
  );

  const setPrayerCity = useCallback((city: string) => setPrayerCityState(city), []);

  const setHotkeys = useCallback((h: HotkeyConfig) => {
    setHotkeysState(h);
    localStorage.setItem('miu_hotkeys', JSON.stringify(h));
  }, []);

  const dismissAlert = useCallback(() => setActiveAlert(null), []);

  const triggerDemoReminder = useCallback((kind: 'hydration' | 'stretch' | 'sholat') => {
    audioEngine.playNotificationChime('reminder');
    if (kind === 'hydration') {
      setActiveAlert({
        id: `demo-${Date.now()}`,
        kind: 'hydration',
        title: 'Pengingat Minum 💧',
        message: 'Miu menyarankan minum segelas air dulu agar konsentrasi kuliah tetap tajam!'
      });
    } else if (kind === 'stretch') {
      setActiveAlert({
        id: `demo-${Date.now()}`,
        kind: 'stretch',
        title: 'Waktunya Peregangan 🧘',
        message: 'Luruskan punggung dan istirahatkan mata sejenak dari layar.'
      });
    } else {
      setActiveAlert({
        id: `demo-${Date.now()}`,
        kind: 'sholat',
        title: 'Mendekati Waktu Sholat 🕌',
        message: 'Persiapkan diri menuju waktu sholat sesuai jadwal kota pilihanmu.'
      });
    }
  }, []);

  const applyPwaUpdate = useCallback(() => {
    if (waitingSwRef.current) {
      waitingSwRef.current.postMessage({ type: 'SKIP_WAITING' });
    }
    setPwaUpdateAvailable(false);
    window.location.reload();
  }, []);

  const mascotMood: MascotMood = useMemo(() => {
    if (isPageHidden) return 'sleep';
    if (isLazytypeActive) return 'lazytype';
    if (activeAlert?.kind === 'hydration') return 'hydration';
    if (activeAlert?.kind === 'stretch') return 'stretch';
    if (activeAlert?.kind === 'sholat') return 'sholat';
    if (pomodoroRunning) return 'focus';
    if (activeTrack.isPlaying || activeNoises.length > 0) return 'music';
    return 'idle';
  }, [
    isPageHidden,
    isLazytypeActive,
    activeAlert,
    pomodoroRunning,
    activeTrack.isPlaying,
    activeNoises.length
  ]);

  const value: MiuContextValue = {
    isReady,
    viewMode,
    setViewMode,
    theme,
    toggleTheme,
    setTheme,
    islandPosition,
    setIslandPosition,
    activePopover,
    setActivePopover,
    isPageHidden,
    mascotMood,
    currentUser,
    isPublicShareAccess,
    loginGoogleUser,
    logoutGoogleUser,
    activeSemesterId,
    setActiveSemesterId,
    activeCourseId,
    setActiveCourseId,
    activeNoteId,
    setActiveNoteId,
    insertBlockIntoActiveNote,
    insertBlocksIntoActiveNote,
    appendDictationToActiveNote,
    isAIDrawerOpen,
    setIsAIDrawerOpen,
    aiExplainDraft,
    aiImageAttachment,
    setAiImageAttachment,
    aiPdfAttachment,
    setAiPdfAttachment,
    triggerInlineAIExplain,
    isLazyshotOpen,
    setIsLazyshotOpen,
    isSupportModalOpen,
    setIsSupportModalOpen,
    pomodoroPhase,
    pomodoroSeconds,
    pomodoroTotalSeconds: (pomodoroCustomMinutes[pomodoroPhase] || 25) * 60,
    pomodoroRunning,
    pomodoroCustomMinutes,
    setPomodoroPhaseMinutes,
    linkedTodoId,
    setLinkedTodoId,
    startPomodoro,
    pausePomodoro,
    resetPomodoro,
    activeTrack,
    lyrics,
    activeLyricText,
    lyricsLoading,
    spotifyMode,
    setSpotifyMode,
    spotifyEmbedUri,
    loadSpotifyUrlOrPreset,
    playSpotifyTrackItem,
    registerEmbedController,
    updateEmbedPlaybackState,
    togglePlayMusic,
    seekMusic,
    nextTrack,
    prevTrack,
    activeNoises,
    toggleNoiseChannel,
    volumes,
    setChannelVolume,
    todayCourseSeconds,
    todayTotalSeconds,
    hydrationEnabled,
    setHydrationEnabled,
    stretchEnabled,
    setStretchEnabled,
    hydrationCountdownSec,
    stretchCountdownSec,
    prayerCity,
    setPrayerCity,
    prayerTimings,
    nextPrayer,
    activeAlert,
    dismissAlert,
    triggerDemoReminder,
    isLazytypeActive,
    setIsLazytypeActive,
    lazytypeLang,
    setLazytypeLang,
    hotkeys,
    setHotkeys,
    pwaUpdateAvailable,
    setPwaUpdateAvailable,
    applyPwaUpdate
  };

  return <MiuContext.Provider value={value}>{children}</MiuContext.Provider>;
};

export function useMiu(): MiuContextValue {
  const ctx = useContext(MiuContext);
  if (!ctx) {
    throw new Error('useMiu must be used within MiuProvider');
  }
  return ctx;
}
