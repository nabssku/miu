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
  cleanTrackMetaForLyrics,
  extractDominantGlowColor,
  fetchSpotifyOEmbedMeta,
  parseSpotifyUri,
  reportTrackPlayed,
  resolveDirectAudioStream,
  searchMusicCatalog,
  SPOTIFY_STUDY_PRESETS,
  type SpotifyEmbedController,
  type SpotifyTrackItem,
  type YouTubePlayerController
} from '../services/spotifyService';
import type {
  ActiveBlockTarget,
  ActiveTrack,
  BlockType,
  DictationInsertResult,
  HotkeyConfig,
  IslandAnchorPosition,
  IslandPopoverType,
  LastDictationEvent,
  LyricLine,
  MascotMood,
  NoiseChannelId,
  NoteBlock,
  PrayerTimings,
  SpotifySourceMode,
  ThemeMode
} from '../types/miu';
import { findBlockLocation } from '../utils/blockTreeHelper';
import {
  applyDictationToBlocks,
  resolveNoteEffectivePermission
} from '../utils/dictationHelper';

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
  activeBlockTarget: ActiveBlockTarget | null;
  setActiveBlockTarget: (target: ActiveBlockTarget | null) => void;
  updateActiveBlockSelection: (
    noteId: string,
    blockId: string,
    field: 'content' | 'toggleBody',
    selectionStart?: number,
    selectionEnd?: number,
    preview?: string,
    onlyIfCurrent?: boolean
  ) => void;
  lastDictationEvent: LastDictationEvent | null;
  insertBlockIntoActiveNote: (block: Omit<NoteBlock, 'id'>) => Promise<void>;
  insertBlocksIntoActiveNote: (blocks: Array<Omit<NoteBlock, 'id'>>) => Promise<void>;
  appendDictationToActiveNote: (text: string) => Promise<DictationInsertResult>;

  // Right Drawer & Overlays
  isAIDrawerOpen: boolean;
  setIsAIDrawerOpen: (v: boolean) => void;
  aiExplainDraft: string;
  setAiExplainDraft: (draft: string) => void;
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

  // Music Search, Hidden YouTube Player, Spotify Embed & LRCLIB
  activeTrack: ActiveTrack;
  lyrics: LyricLine[];
  activeLyricText: string;
  lyricsLoading: boolean;
  musicError: string;
  clearMusicError: () => void;
  spotifyMode: SpotifySourceMode;
  setSpotifyMode: (mode: SpotifySourceMode) => void;
  spotifyEmbedUri: string;
  loadSpotifyUrlOrPreset: (
    urlOrUri: string,
    presetMeta?: { title: string; artist: string; coverUrl: string; glowColor: string }
  ) => void;
  playSpotifyTrackItem: (
    item: SpotifyTrackItem,
    queue?: SpotifyTrackItem[],
    sourceQuery?: string
  ) => void;
  registerEmbedController: (ctrl: SpotifyEmbedController | null) => void;
  updateEmbedPlaybackState: (positionMs: number, durationMs: number, isPaused: boolean) => void;
  registerYouTubeController: (ctrl: YouTubePlayerController | null) => void;
  updateYouTubePlaybackState: (stateCode: number, positionMs: number, durationMs: number) => void;
  handleYouTubeError: (errorCode: number) => void;
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
  const activeNoteIdRef = useRef(activeNoteId);
  activeNoteIdRef.current = activeNoteId;
  const [activeBlockTarget, setActiveBlockTargetState] = useState<ActiveBlockTarget | null>(null);
  const activeBlockTargetRef = useRef<ActiveBlockTarget | null>(null);
  const [lastDictationEvent, setLastDictationEvent] = useState<LastDictationEvent | null>(null);

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

  // Music state (Single Active Audio Owner: Hidden YouTube IFrame vs Full-Length Stream vs Spotify Embed)
  const [spotifyMode, setSpotifyMode] = useState<SpotifySourceMode>('youtube');
  const [presetTrackIndex, setPresetTrackIndex] = useState(0);
  const [spotifyEmbedUri, setSpotifyEmbedUri] = useState(SPOTIFY_STUDY_PRESETS[0].uri);
  const embedControllerRef = useRef<SpotifyEmbedController | null>(null);
  const youtubeControllerRef = useRef<YouTubePlayerController | null>(null);
  const pendingEmbedAutoPlayRef = useRef<boolean>(false);
  const pendingYouTubeVideoRef = useRef<{ videoId: string; volumePercent: number } | null>(null);
  const lastYouTubeLoadAtRef = useRef<number>(0);
  const streamRequestIdRef = useRef<number>(0);
  const activeAudioOwnerRef = useRef<'youtube' | 'stream' | 'embed'>('youtube');
  const musicQueueRef = useRef<SpotifyTrackItem[]>(SPOTIFY_STUDY_PRESETS);
  const nextTrackRef = useRef<() => void>(() => {});
  const [musicError, setMusicError] = useState<string>('');

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
    source: 'youtube',
    glowColor: SPOTIFY_STUDY_PRESETS[0].glowColor
  }));
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [lyricsLoading, setLyricsLoading] = useState(false);

  // White noise & Mixer
  const [activeNoises, setActiveNoises] = useState<NoiseChannelId[]>([]);
  const [volumes, setVolumes] = useState(() => audioEngine.getVolumes());
  const volumesRef = useRef(volumes);

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

  const setActiveBlockTarget = useCallback((target: ActiveBlockTarget | null) => {
    activeBlockTargetRef.current = target;
    setActiveBlockTargetState((prev) => {
      if (!target && !prev) return prev;
      if (
        prev &&
        target &&
        prev.noteId === target.noteId &&
        prev.blockId === target.blockId &&
        prev.field === target.field &&
        prev.blockType === target.blockType &&
        prev.source === target.source &&
        prev.preview === target.preview
      ) {
        return prev;
      }
      return target;
    });
  }, []);

  const updateActiveBlockSelection = useCallback(
    (
      noteId: string,
      blockId: string,
      field: 'content' | 'toggleBody',
      selectionStart?: number,
      selectionEnd?: number,
      preview?: string,
      onlyIfCurrent?: boolean
    ) => {
      const prev = activeBlockTargetRef.current;
      if (
        prev &&
        prev.noteId === noteId &&
        prev.blockId === blockId &&
        (prev.field || 'content') === field
      ) {
        activeBlockTargetRef.current = {
          ...prev,
          selectionStart,
          selectionEnd,
          ...(preview !== undefined ? { preview } : {}),
          updatedAt: Date.now()
        };
      } else if (!onlyIfCurrent) {
        setActiveBlockTarget({
          noteId,
          blockId,
          field,
          preview,
          selectionStart,
          selectionEnd,
          source: 'focus',
          updatedAt: Date.now()
        });
      }
    },
    [setActiveBlockTarget]
  );

  const readFocusedBlockTargetFromDom = useCallback((): ActiveBlockTarget | null => {
    if (typeof document === 'undefined') return null;
    const el = document.activeElement;
    if (
      el &&
      (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) &&
      el.dataset.miuBlockId
    ) {
      const blockId = el.dataset.miuBlockId;
      const field =
        el.dataset.miuBlockField === 'toggleBody' ? 'toggleBody' : 'content';
      const prevTarget = activeBlockTargetRef.current;
      return {
        noteId: el.dataset.miuNoteId || prevTarget?.noteId || activeNoteIdRef.current,
        blockId,
        field,
        blockType: prevTarget?.blockId === blockId ? prevTarget.blockType : undefined,
        preview: el.value,
        selectionStart:
          typeof el.selectionStart === 'number' ? el.selectionStart : el.value.length,
        selectionEnd:
          typeof el.selectionEnd === 'number' ? el.selectionEnd : el.value.length,
        source: 'focus',
        updatedAt: Date.now()
      };
    }
    return null;
  }, []);

  // Clear stale block target when active note changes
  useEffect(() => {
    if (activeBlockTargetRef.current && activeBlockTargetRef.current.noteId !== activeNoteId) {
      setActiveBlockTarget(null);
    }
  }, [activeNoteId, setActiveBlockTarget]);

  const isLazytypeActiveRef = useRef(isLazytypeActive);
  isLazytypeActiveRef.current = isLazytypeActive;
  const lazytypeHotkeyModeRef = useRef<'alt-space' | 'ctrl-shift-v' | null>(null);
  useEffect(() => {
    if (!isLazytypeActive) {
      lazytypeHotkeyModeRef.current = null;
    }
  }, [isLazytypeActive]);

  // Global Hotkeys: Cmd/Ctrl+K, Alt+Space (Lazytype Push-to-Talk), Alt+S (Lazyshot)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        const isWorkspaceApp =
          typeof window !== 'undefined' && window.location.pathname.startsWith('/app');
        if (!isWorkspaceApp || e.shiftKey) {
          e.preventDefault();
          setActivePopover((prev) => (prev === 'dock' ? 'none' : 'dock'));
        }
      } else if (e.altKey && e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) {
          const domTarget = readFocusedBlockTargetFromDom();
          if (domTarget) setActiveBlockTarget(domTarget);
          lazytypeHotkeyModeRef.current = 'alt-space';
          setIsLazytypeActive(true);
        }
      } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        if (!e.repeat) {
          const domTarget = readFocusedBlockTargetFromDom();
          if (domTarget) setActiveBlockTarget(domTarget);
          setIsLazytypeActive((prev) => {
            const next = !prev;
            lazytypeHotkeyModeRef.current = next ? 'ctrl-shift-v' : null;
            return next;
          });
        }
      } else if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        setIsLazyshotOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        lazytypeHotkeyModeRef.current = null;
        setActivePopover('none');
        setIsLazyshotOpen(false);
        setIsLazytypeActive(false);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (
        lazytypeHotkeyModeRef.current === 'alt-space' &&
        (e.code === 'Space' || e.key === 'Alt') &&
        isLazytypeActiveRef.current
      ) {
        e.preventDefault();
        lazytypeHotkeyModeRef.current = null;
        setIsLazytypeActive(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [readFocusedBlockTargetFromDom, setActiveBlockTarget]);

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

  const presetTrackIndexRef = useRef<number>(0);
  useEffect(() => {
    presetTrackIndexRef.current = presetTrackIndex;
  }, [presetTrackIndex]);

  const clearMusicError = useCallback(() => setMusicError(''), []);

  // Load initial synced lyrics for the default preset
  useEffect(() => {
    const cleaned = cleanTrackMetaForLyrics(
      SPOTIFY_STUDY_PRESETS[0].title,
      SPOTIFY_STUDY_PRESETS[0].artist
    );
    fetchSyncedLyricsFromLRCLIB(cleaned.title, cleaned.artist)
      .then((lines) => setLyrics(lines))
      .catch(() => {});
  }, []);

  // Live 250ms playback progress polling for YouTube IFrame (real time) and Spotify Embed (interpolated)
  useEffect(() => {
    if (!activeTrack.isPlaying) return;
    const timer = window.setInterval(() => {
      if (activeAudioOwnerRef.current === 'embed') {
        setActiveTrack((prev) => {
          const nextPos = prev.positionMs + 250;
          if (nextPos >= prev.durationMs) {
            return { ...prev, positionMs: 0 };
          }
          return { ...prev, positionMs: Math.min(prev.durationMs, nextPos) };
        });
      } else if (activeAudioOwnerRef.current === 'youtube') {
        const yt = youtubeControllerRef.current;
        if (!yt) return;
        try {
          const playerState = yt.getPlayerState?.();
          if (playerState === 1) {
            const curSec = Number(yt.getCurrentTime?.() || 0);
            const durSec = Number(yt.getDuration?.() || 0);
            setActiveTrack((prev) => ({
              ...prev,
              positionMs: Math.max(0, Math.round(curSec * 1000)),
              durationMs: durSec > 0 ? Math.round(durSec * 1000) : prev.durationMs
            }));
          }
        } catch {
          // ignore transient YouTube player read
        }
      }
    }, 250);

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

  const startYouTubeVideo = useCallback((videoId: string) => {
    const volPercent = Math.round((volumesRef.current.spotify ?? 0.8) * 100);
    lastYouTubeLoadAtRef.current = Date.now();
    if (youtubeControllerRef.current) {
      try {
        youtubeControllerRef.current.setVolume(volPercent);
        youtubeControllerRef.current.unMute?.();
        youtubeControllerRef.current.loadVideoById(videoId);
        pendingYouTubeVideoRef.current = null;
      } catch {
        pendingYouTubeVideoRef.current = { videoId, volumePercent: volPercent };
      }
    } else {
      pendingYouTubeVideoRef.current = { videoId, volumePercent: volPercent };
    }
  }, []);

  const fetchLyricsForTrack = useCallback(
    (title: string, artist: string, durationMs: number | undefined, reqId: number) => {
      const cleaned = cleanTrackMetaForLyrics(title, artist);
      setLyricsLoading(true);
      fetchSyncedLyricsFromLRCLIB(cleaned.title, cleaned.artist, durationMs)
        .then((lines) => {
          if (reqId === streamRequestIdRef.current) {
            setLyrics(lines);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (reqId === streamRequestIdRef.current) {
            setLyricsLoading(false);
          }
        });
    },
    []
  );

  const playSpotifyTrackItem = useCallback(
    (item: SpotifyTrackItem, queue?: SpotifyTrackItem[], sourceQuery?: string) => {
      const reqId = ++streamRequestIdRef.current;
      if (Array.isArray(queue) && queue.length > 0) {
        musicQueueRef.current = queue;
      }

      setMusicError('');
      pendingEmbedAutoPlayRef.current = false;

      // Always pause HTML5 stream & Spotify Embed first so audio NEVER overlaps
      audioEngine.pauseStream();
      if (embedControllerRef.current) {
        try {
          embedControllerRef.current.pause();
        } catch {
          // ignore
        }
      }

      if (item.uri) {
        setSpotifyEmbedUri(item.uri);
      }

      if (item.youtubeId) {
        // Primary path: Play via hidden YouTube IFrame and notify /api/played
        activeAudioOwnerRef.current = 'youtube';
        setSpotifyMode('youtube');
        const effectiveQuery = (sourceQuery || item.searchQuery || item.title).trim();

        void reportTrackPlayed(item, effectiveQuery);
        startYouTubeVideo(item.youtubeId);

        setActiveTrack({
          id: item.id,
          title: item.title,
          artist: item.artist,
          album: item.album || 'YouTube Music',
          coverUrl: item.coverUrl,
          durationMs: item.durationMs || 180000,
          positionMs: 0,
          isPlaying: true,
          spotifyUri: item.uri || undefined,
          youtubeId: item.youtubeId,
          sourceQuery: effectiveQuery,
          source: 'youtube',
          glowColor: item.glowColor || '#EF4444'
        });

        void extractDominantGlowColor(item.coverUrl, item.glowColor || '#EF4444').then(
          (glowColor) => {
            if (reqId !== streamRequestIdRef.current) return;
            setActiveTrack((prev) => ({ ...prev, glowColor }));
          }
        );

        fetchLyricsForTrack(item.title, item.artist, item.durationMs, reqId);
        return;
      }

      // Preset / track without youtubeId: resolve dynamically through /api/music/search first
      try {
        youtubeControllerRef.current?.pauseVideo();
      } catch {
        // ignore
      }

      activeAudioOwnerRef.current = 'youtube';
      setSpotifyMode('youtube');

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
        youtubeId: undefined,
        sourceQuery: `${item.title} ${item.artist}`.trim(),
        source: 'youtube',
        glowColor: item.glowColor || '#10B981'
      });

      void extractDominantGlowColor(item.coverUrl, item.glowColor || '#10B981').then(
        (glowColor) => {
          if (reqId !== streamRequestIdRef.current) return;
          setActiveTrack((prev) => ({ ...prev, glowColor }));
        }
      );

      fetchLyricsForTrack(item.title, item.artist, item.durationMs, reqId);

      const lookupQuery = `${item.title} ${item.artist}`.trim();
      void searchMusicCatalog(lookupQuery).then((res) => {
        if (reqId !== streamRequestIdRef.current) return;
        const ytMatch = res.results.find((r) => Boolean(r.youtubeId));
        if (ytMatch?.youtubeId) {
          activeAudioOwnerRef.current = 'youtube';
          setSpotifyMode('youtube');
          void reportTrackPlayed(ytMatch, lookupQuery);
          startYouTubeVideo(ytMatch.youtubeId);
          setActiveTrack((prev) => ({
            ...prev,
            youtubeId: ytMatch.youtubeId,
            sourceQuery: lookupQuery,
            durationMs: ytMatch.durationMs || prev.durationMs,
            coverUrl: ytMatch.coverUrl || prev.coverUrl,
            source: 'youtube',
            isPlaying: true
          }));
          return;
        }

        // Fallback if search endpoint returned nothing
        activeAudioOwnerRef.current = 'stream';
        if (item.audioUrl) {
          setSpotifyMode('embed');
          audioEngine.playStreamUrl(item.audioUrl);
          return;
        }
        resolveDirectAudioStream(item.title, item.artist).then((resolved) => {
          if (reqId !== streamRequestIdRef.current) return;
          if (resolved?.audioUrl) {
            setSpotifyMode('embed');
            audioEngine.playStreamUrl(resolved.audioUrl);
            setActiveTrack((prev) => ({
              ...prev,
              source: 'embed',
              coverUrl: resolved.coverUrl || prev.coverUrl,
              durationMs: resolved.durationMs || prev.durationMs
            }));
          } else if (item.uri && embedControllerRef.current) {
            activeAudioOwnerRef.current = 'embed';
            setSpotifyMode('embed');
            embedControllerRef.current.loadUri(item.uri);
            try {
              embedControllerRef.current.play();
            } catch {
              // ignore
            }
            setActiveTrack((prev) => ({ ...prev, source: 'embed' }));
          } else if (res.error) {
            setMusicError(res.error);
            setActiveTrack((prev) => ({ ...prev, isPlaying: false }));
          }
        });
      });
    },
    [fetchLyricsForTrack, startYouTubeVideo]
  );

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

      setMusicError('');
      // Stop all engines first to prevent double audio
      audioEngine.pauseStream();
      if (embedControllerRef.current) {
        try {
          embedControllerRef.current.pause();
        } catch {
          // ignore
        }
      }
      if (youtubeControllerRef.current) {
        try {
          youtubeControllerRef.current.pauseVideo();
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
        // Individual Spotify track URLs also try stream / fallback embed
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
        youtubeId: undefined,
        sourceQuery: undefined,
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
        fetchLyricsForTrack(presetMeta.title, presetMeta.artist, undefined, reqId);
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
          fetchLyricsForTrack(meta.title, '', undefined, reqId);
        });
      }
    },
    [fetchLyricsForTrack]
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
        // User clicked Play inside the Spotify Embed iframe directly -> stop HTML5 stream & YouTube!
        streamRequestIdRef.current++;
        activeAudioOwnerRef.current = 'embed';
        audioEngine.stopStream();
        try {
          youtubeControllerRef.current?.pauseVideo();
        } catch {
          // ignore
        }
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

  const registerYouTubeController = useCallback((ctrl: YouTubePlayerController | null) => {
    youtubeControllerRef.current = ctrl;
    if (ctrl) {
      const volPercent = Math.round((volumesRef.current.spotify ?? 0.8) * 100);
      try {
        ctrl.setVolume(volPercent);
      } catch {
        // ignore
      }
      if (pendingYouTubeVideoRef.current && activeAudioOwnerRef.current === 'youtube') {
        const pending = pendingYouTubeVideoRef.current;
        pendingYouTubeVideoRef.current = null;
        lastYouTubeLoadAtRef.current = Date.now();
        try {
          ctrl.setVolume(pending.volumePercent);
          ctrl.unMute?.();
          ctrl.loadVideoById(pending.videoId);
        } catch {
          // ignore
        }
      }
    }
  }, []);

  const updateYouTubePlaybackState = useCallback(
    (stateCode: number, positionMs: number, durationMs: number) => {
      if (activeAudioOwnerRef.current !== 'youtube') return;

      // 0: ENDED
      if (stateCode === 0) {
        nextTrackRef.current();
        return;
      }

      // 1: PLAYING
      if (stateCode === 1) {
        setMusicError('');
        setActiveTrack((prev) => ({
          ...prev,
          positionMs: Math.max(0, positionMs),
          durationMs: durationMs > 0 ? durationMs : prev.durationMs,
          isPlaying: true
        }));
        return;
      }

      // 2: PAUSED (ignore transient PAUSED events raised during initial loadVideoById transition)
      if (stateCode === 2 && Date.now() - lastYouTubeLoadAtRef.current > 1000) {
        setActiveTrack((prev) => ({
          ...prev,
          positionMs: Math.max(0, positionMs),
          durationMs: durationMs > 0 ? durationMs : prev.durationMs,
          isPlaying: false
        }));
      }
    },
    []
  );

  const handleYouTubeError = useCallback((errorCode: number) => {
    if (activeAudioOwnerRef.current !== 'youtube') return;
    let msg = 'Gagal memutar audio dari YouTube.';
    if (errorCode === 101 || errorCode === 150) {
      msg =
        'Video YouTube ini dibatasi untuk diputar di embed. Silakan pilih lagu/versi lain dari pencarian.';
    } else if (errorCode === 100) {
      msg = 'Video YouTube tidak ditemukan atau bersifat privat.';
    } else if (errorCode === 2 || errorCode === 5) {
      msg = 'ID atau pemutar video YouTube bermasalah. Coba pilih lagu lain.';
    }
    setMusicError(msg);
    setActiveTrack((prev) => ({ ...prev, isPlaying: false }));
  }, []);

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
      if (youtubeControllerRef.current) {
        try {
          youtubeControllerRef.current.pauseVideo();
        } catch {
          // ignore
        }
      }
      setActiveTrack((prev) => ({ ...prev, isPlaying: false }));
      return;
    }

    // Play ONLY the active audio owner
    if (activeAudioOwnerRef.current === 'embed') {
      audioEngine.stopStream();
      try {
        youtubeControllerRef.current?.pauseVideo();
      } catch {
        // ignore
      }
      if (embedControllerRef.current) {
        try {
          embedControllerRef.current.play();
        } catch {
          // ignore
        }
      }
      setActiveTrack((prev) => ({ ...prev, isPlaying: true }));
      return;
    }

    if (activeTrack.youtubeId) {
      activeAudioOwnerRef.current = 'youtube';
      setSpotifyMode('youtube');
      setMusicError('');
      audioEngine.pauseStream();
      if (embedControllerRef.current) {
        try {
          embedControllerRef.current.pause();
        } catch {
          // ignore
        }
      }

      const yt = youtubeControllerRef.current;
      const volPercent = Math.round((volumesRef.current.spotify ?? 0.8) * 100);
      if (yt) {
        try {
          yt.setVolume(volPercent);
          yt.unMute?.();
          const state = yt.getPlayerState?.();
          if (state === undefined || state === -1 || state === 5) {
            lastYouTubeLoadAtRef.current = Date.now();
            yt.loadVideoById(activeTrack.youtubeId);
          } else {
            yt.playVideo();
          }
        } catch {
          lastYouTubeLoadAtRef.current = Date.now();
          yt.loadVideoById(activeTrack.youtubeId);
        }
      } else {
        pendingYouTubeVideoRef.current = {
          videoId: activeTrack.youtubeId,
          volumePercent: volPercent
        };
      }
      setActiveTrack((prev) => ({ ...prev, isPlaying: true }));
      return;
    }

    // Default initial track has not been resolved to YouTube yet -> resolve via search API
    const activePreset =
      SPOTIFY_STUDY_PRESETS[presetTrackIndexRef.current] || SPOTIFY_STUDY_PRESETS[0];
    playSpotifyTrackItem(activePreset);
  }, [activeTrack.isPlaying, activeTrack.youtubeId, playSpotifyTrackItem]);

  const seekMusic = useCallback((positionMs: number) => {
    const clamped = Math.max(0, positionMs);
    setActiveTrack((prev) => ({
      ...prev,
      positionMs: Math.min(prev.durationMs, clamped)
    }));
    if (activeAudioOwnerRef.current === 'youtube') {
      try {
        youtubeControllerRef.current?.seekTo(clamped / 1000, true);
      } catch {
        // ignore
      }
    } else if (activeAudioOwnerRef.current === 'embed') {
      try {
        embedControllerRef.current?.seek(Math.floor(clamped / 1000));
      } catch {
        // ignore
      }
    } else {
      audioEngine.seekStream(clamped);
    }
  }, []);

  const switchQueueTrack = useCallback(
    (dir: 1 | -1) => {
      const queue = musicQueueRef.current;
      if (queue.length > 0) {
        const curIdx = queue.findIndex(
          (item) =>
            (activeTrack.youtubeId && item.youtubeId === activeTrack.youtubeId) ||
            item.id === activeTrack.id
        );
        const nextIdx =
          curIdx === -1
            ? dir === 1
              ? 0
              : queue.length - 1
            : (curIdx + dir + queue.length) % queue.length;
        const nextItem = queue[nextIdx];
        if (queue === SPOTIFY_STUDY_PRESETS) {
          setPresetTrackIndex(nextIdx);
        }
        playSpotifyTrackItem(nextItem, queue, activeTrack.sourceQuery || nextItem.searchQuery);
        return;
      }

      const nextPresetIdx =
        (presetTrackIndexRef.current + dir + SPOTIFY_STUDY_PRESETS.length) %
        SPOTIFY_STUDY_PRESETS.length;
      setPresetTrackIndex(nextPresetIdx);
      playSpotifyTrackItem(SPOTIFY_STUDY_PRESETS[nextPresetIdx]);
    },
    [activeTrack.id, activeTrack.youtubeId, activeTrack.sourceQuery, playSpotifyTrackItem]
  );

  // Bind real HTML5 <audio> timeupdate, duration & auto-next on ended
  useEffect(() => {
    audioEngine.onStreamStateChange(({ positionMs, durationMs, isPlaying, ended }) => {
      if (activeAudioOwnerRef.current !== 'stream') return;
      if (ended) {
        nextTrackRef.current();
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
  }, []);

  const nextTrack = useCallback(() => {
    switchQueueTrack(1);
  }, [switchQueueTrack]);

  const prevTrack = useCallback(() => {
    switchQueueTrack(-1);
  }, [switchQueueTrack]);

  useEffect(() => {
    nextTrackRef.current = nextTrack;
  }, [nextTrack]);

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
      const nextVolumes = audioEngine.getVolumes();
      volumesRef.current = nextVolumes;
      setVolumes(nextVolumes);
      if (channel === 'spotify' && youtubeControllerRef.current) {
        try {
          youtubeControllerRef.current.setVolume(Math.round(val * 100));
        } catch {
          // ignore
        }
      }
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
        let migratedFirstId = '';
        for (const n of localNotes) {
          const noteToSave = {
            ...n,
            id: n.id === 'note-default' ? `note-${user.id.slice(-8)}-1` : n.id,
            ownerId: user.id,
            ownerEmail: user.email,
            ownerName: user.name
          };
          if (!migratedFirstId) migratedFirstId = noteToSave.id;
          await db.notes.put(noteToSave);
          await saveNoteToNeon(user.id, noteToSave);
        }
        if (migratedFirstId && !sharedIdFromUrl) {
          setActiveNoteId(migratedFirstId);
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
      const allNotes = await db.notes.toArray();
      allNotes.sort((a, b) => a.createdAt - b.createdAt);
      const note = allNotes.find((n) => n.id === activeNoteId) || allNotes[0];
      if (!note) return;

      const perm = resolveNoteEffectivePermission(note, allNotes, currentUser);
      if (perm !== 'owner' && perm !== 'edit') {
        return;
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
      await db.notes.update(note.id, {
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
    async (text: string): Promise<DictationInsertResult> => {
      const clean = text.trim();
      if (!clean) {
        return { ok: false, error: 'Teks dikte kosong.' };
      }

      const domTarget = readFocusedBlockTargetFromDom();
      const candidateTarget = domTarget || activeBlockTargetRef.current;

      const allNotes = await db.notes.toArray();
      allNotes.sort((a, b) => a.createdAt - b.createdAt);

      let note =
        (candidateTarget?.noteId
          ? allNotes.find((n) => n.id === candidateTarget.noteId)
          : undefined) ||
        allNotes.find((n) => n.id === activeNoteIdRef.current) ||
        allNotes[0];

      if (!note) {
        return { ok: false, error: 'Catatan aktif tidak ditemukan.' };
      }

      const perm = resolveNoteEffectivePermission(note, allNotes, currentUser);
      if (perm !== 'owner' && perm !== 'edit') {
        return {
          ok: false,
          error: 'Catatan ini hanya dapat dilihat/dikomentari dan tidak bisa menerima dikte.'
        };
      }

      const applicableTarget =
        candidateTarget && candidateTarget.noteId === note.id ? candidateTarget : null;

      const applied = applyDictationToBlocks(note.blocks, clean, applicableTarget);
      const now = Date.now();

      await db.notes.update(note.id, {
        blocks: applied.blocks,
        updatedAt: now
      });

      const updatedLoc = findBlockLocation(applied.blocks, applied.targetBlockId);
      const updatedPreview =
        applied.field === 'toggleBody'
          ? updatedLoc?.block.toggleBody || ''
          : updatedLoc?.block.content || '';

      setActiveBlockTarget({
        noteId: note.id,
        blockId: applied.targetBlockId,
        field: applied.field,
        blockType: updatedLoc?.block.type,
        preview: updatedPreview,
        selectionStart: applied.caret,
        selectionEnd: applied.caret,
        source: applicableTarget?.source || 'focus',
        updatedAt: now
      });

      setLastDictationEvent({
        noteId: note.id,
        blockId: applied.targetBlockId,
        field: applied.field,
        caret: applied.caret,
        at: now
      });

      const targetOwnerId = note.ownerId || currentUser?.id;
      if (targetOwnerId) {
        void saveNoteToNeon(targetOwnerId, {
          ...note,
          blocks: applied.blocks,
          updatedAt: now
        });
      }

      return {
        ok: true,
        noteId: note.id,
        targetBlockId: applied.targetBlockId,
        field: applied.field,
        caret: applied.caret,
        mode: applied.mode
      };
    },
    [currentUser, readFocusedBlockTargetFromDom, setActiveBlockTarget]
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
    activeBlockTarget,
    setActiveBlockTarget,
    updateActiveBlockSelection,
    lastDictationEvent,
    insertBlockIntoActiveNote,
    insertBlocksIntoActiveNote,
    appendDictationToActiveNote,
    isAIDrawerOpen,
    setIsAIDrawerOpen,
    aiExplainDraft,
    setAiExplainDraft,
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
    musicError,
    clearMusicError,
    spotifyMode,
    setSpotifyMode,
    spotifyEmbedUri,
    loadSpotifyUrlOrPreset,
    playSpotifyTrackItem,
    registerEmbedController,
    updateEmbedPlaybackState,
    registerYouTubeController,
    updateYouTubePlaybackState,
    handleYouTubeError,
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
