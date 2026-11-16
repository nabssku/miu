'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  BarChart3,
  Camera,
  CheckSquare,
  ClipboardList,
  Disc3,
  FileText,
  Home,
  Mic,
  Moon,
  Music2,
  Pause,
  Pin,
  Play,
  Scissors,
  Settings,
  Sparkles,
  Sun,
  Timer,
  X
} from 'lucide-react';
import { db } from '../../db/database';
import { useMiu } from '../../context/MiuContext';
import type { IslandPopoverType } from '../../types/miu';
import {
  formatDurationHM,
  formatTimerMMSS,
  getAnchorContainerClasses
} from '../../utils/formatters';
import { MiuMascot } from './MiuMascot';
import { AnchorSettingsPopover } from './popovers/AnchorSettingsPopover';
import { BoardShelfPopover } from './popovers/BoardShelfPopover';
import { LazytypePill } from './popovers/LazytypePill';
import { MusicMixerPopover } from './popovers/MusicMixerPopover';
import { QuickMirrorPopover } from './popovers/QuickMirrorPopover';
import { RemindersScreenTimePopover } from './popovers/RemindersScreenTimePopover';
import { TodoPomodoroPopover } from './popovers/TodoPomodoroPopover';

const SPRING_CONFIG = {
  type: 'spring' as const,
  stiffness: 420,
  damping: 32,
  mass: 0.8
};

const POPOVER_TITLES: Record<string, { title: string; subtitle: string; badgeColor: string }> = {
  todo: {
    title: 'Fokus & Quick To-do',
    subtitle: 'Pomodoro Web Worker',
    badgeColor: 'text-rose-300 bg-rose-500/15 border-rose-400/30'
  },
  pomodoro: {
    title: 'Fokus & Quick To-do',
    subtitle: 'Pomodoro Web Worker',
    badgeColor: 'text-rose-300 bg-rose-500/15 border-rose-400/30'
  },
  board: {
    title: 'Board & Pinned Shelf',
    subtitle: 'Klip Riset & Rumus',
    badgeColor: 'text-sky-300 bg-sky-500/15 border-sky-400/30'
  },
  music: {
    title: 'Musik, Lirik & Mixer',
    subtitle: 'Spotify + White Noise',
    badgeColor: 'text-emerald-300 bg-emerald-500/15 border-emerald-400/30'
  },
  mirror: {
    title: 'Cermin Cepat',
    subtitle: 'Kamera Lokal • Tanpa Rekam',
    badgeColor: 'text-amber-200 bg-amber-500/15 border-amber-400/30'
  },
  lazytype: {
    title: 'Lazytype Voice-to-Note',
    subtitle: 'Dikte Offline Indo/EN',
    badgeColor: 'text-violet-300 bg-violet-500/15 border-violet-400/30'
  },
  screentime: {
    title: 'Waktu, Kesehatan & Sholat',
    subtitle: 'Analitik 7 Hari & Pengingat',
    badgeColor: 'text-teal-300 bg-teal-500/15 border-teal-400/30'
  },
  settings: {
    title: 'Posisi Notch & Tema',
    subtitle: '8 Titik Jangkar & Pintasan',
    badgeColor: 'text-sky-300 bg-sky-500/15 border-sky-400/30'
  }
};

export const DynamicIsland: React.FC = () => {
  const {
    viewMode,
    setViewMode,
    theme,
    toggleTheme,
    islandPosition,
    activePopover,
    setActivePopover,
    isPageHidden,
    mascotMood,
    activeCourseId,
    setActiveCourseId,
    todayCourseSeconds,
    pomodoroRunning,
    pomodoroSeconds,
    pomodoroTotalSeconds,
    startPomodoro,
    pausePomodoro,
    activeTrack,
    togglePlayMusic,
    activeLyricText,
    activeNoises,
    nextPrayer,
    isAIDrawerOpen,
    setIsAIDrawerOpen,
    setIsLazyshotOpen,
    isLazytypeActive,
    setIsLazytypeActive,
    activeAlert,
    dismissAlert,
    pwaUpdateAvailable,
    applyPwaUpdate
  } = useMiu();

  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const closeTimeoutRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const courses = useLiveQuery(() => db.courses.toArray(), [], []);
  const activeCourse = useMemo(
    () => courses.find((c) => c.id === activeCourseId) || courses[0],
    [courses, activeCourseId]
  );

  const hasAudioPlaying = activeTrack.isPlaying || activeNoises.length > 0;
  const isSplitLive = pomodoroRunning && hasAudioPlaying;
  const hasFeaturePopover =
    (activePopover !== 'none' && activePopover !== 'dock') || isLazytypeActive;
  const isExpandedDock =
    !hasFeaturePopover && (isHovered || activePopover === 'dock');

  const isSideVertical =
    (islandPosition === 'mid-left' || islandPosition === 'mid-right') &&
    !isExpandedDock &&
    !hasFeaturePopover;

  // Close popover or dock when clicking outside (unless pinned)
  useEffect(() => {
    if (activePopover === 'none' && !isLazytypeActive) return;
    if (isPinned && activePopover !== 'dock') return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (containerRef.current && target && !containerRef.current.contains(target)) {
        setActivePopover('none');
        if (isLazytypeActive) setIsLazytypeActive(false);
        setIsHovered(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [activePopover, isLazytypeActive, isPinned, setActivePopover, setIsLazytypeActive]);

  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    closeTimeoutRef.current = window.setTimeout(() => {
      setIsHovered(false);
    }, 260);
  };

  const togglePopover = (type: IslandPopoverType) => {
    if (activePopover === type) {
      setActivePopover('none');
    } else {
      setActivePopover(type);
    }
  };

  const cycleNextCourse = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (courses.length < 2) return;
    const idx = courses.findIndex((c) => c.id === activeCourse?.id);
    const next = courses[(idx + 1) % courses.length];
    if (next) setActiveCourseId(next.id);
  };

  const pomodoroProgressPct = Math.round(
    ((pomodoroTotalSeconds - pomodoroSeconds) / Math.max(1, pomodoroTotalSeconds)) * 100
  );

  const dockItems: Array<{
    id: string;
    shortLabel: string;
    fullLabel: string;
    Icon: React.FC<{ className?: string }>;
    active?: boolean;
    liveDot?: string;
    accentClass?: string;
    onClick: () => void;
  }> = [
    {
      id: 'home',
      shortLabel: viewMode === 'workspace' ? 'Beranda' : 'Catat',
      fullLabel: viewMode === 'workspace' ? 'Halaman Utama (Landing)' : 'Buka Workspace Catatan',
      Icon: viewMode === 'workspace' ? Home : FileText,
      active: viewMode === 'workspace',
      accentClass: 'text-sky-300 bg-sky-500/20 border-sky-400/35',
      onClick: () => {
        setViewMode(viewMode === 'workspace' ? 'landing' : 'workspace');
        setActivePopover('none');
        setIsHovered(false);
      }
    },
    {
      id: 'todo',
      shortLabel: 'Fokus',
      fullLabel: 'Pomodoro & Quick To-do',
      Icon: pomodoroRunning ? Timer : CheckSquare,
      active: activePopover === 'todo' || activePopover === 'pomodoro' || pomodoroRunning,
      liveDot: pomodoroRunning ? 'bg-rose-500 animate-pulse' : undefined,
      accentClass: 'text-rose-300 bg-rose-500/20 border-rose-400/35',
      onClick: () => togglePopover('todo')
    },
    {
      id: 'board',
      shortLabel: 'Board',
      fullLabel: 'Board & Pinned Shelf',
      Icon: ClipboardList,
      active: activePopover === 'board',
      accentClass: 'text-sky-300 bg-sky-500/20 border-sky-400/35',
      onClick: () => togglePopover('board')
    },
    {
      id: 'music',
      shortLabel: 'Musik',
      fullLabel: 'Spotify, Lirik & White Noise Mixer',
      Icon: Music2,
      active: activePopover === 'music' || hasAudioPlaying,
      liveDot: hasAudioPlaying ? 'bg-emerald-400 animate-pulse' : undefined,
      accentClass: 'text-emerald-300 bg-emerald-500/20 border-emerald-400/35',
      onClick: () => togglePopover('music')
    },
    {
      id: 'mirror',
      shortLabel: 'Cermin',
      fullLabel: 'Cermin Kamera Cepat (Zero-Record)',
      Icon: Camera,
      active: activePopover === 'mirror',
      accentClass: 'text-amber-200 bg-amber-500/20 border-amber-400/35',
      onClick: () => togglePopover('mirror')
    },
    {
      id: 'lazytype',
      shortLabel: 'Dikte',
      fullLabel: 'Lazytype Voice-to-Note (Alt+Space)',
      Icon: Mic,
      active: activePopover === 'lazytype' || isLazytypeActive,
      liveDot: isLazytypeActive ? 'bg-violet-400 animate-ping' : undefined,
      accentClass: 'text-violet-300 bg-violet-500/20 border-violet-400/35',
      onClick: () => togglePopover('lazytype')
    },
    {
      id: 'lazyshot',
      shortLabel: 'Clipper',
      fullLabel: 'Lazyshot Anotasi & OCR (Alt+S)',
      Icon: Scissors,
      accentClass: 'text-amber-300 bg-amber-500/20 border-amber-400/35',
      onClick: () => {
        setActivePopover('none');
        setIsHovered(false);
        setIsLazyshotOpen(true);
      }
    },
    {
      id: 'screentime',
      shortLabel: 'Waktu',
      fullLabel: 'Screen Time, Kesehatan & Jadwal Sholat',
      Icon: BarChart3,
      active: activePopover === 'screentime',
      accentClass: 'text-teal-300 bg-teal-500/20 border-teal-400/35',
      onClick: () => togglePopover('screentime')
    },
    {
      id: 'ai',
      shortLabel: 'AI',
      fullLabel: 'External AI Assistant (BYOK)',
      Icon: Sparkles,
      active: isAIDrawerOpen && viewMode === 'workspace',
      liveDot: isAIDrawerOpen && viewMode === 'workspace' ? 'bg-indigo-400' : undefined,
      accentClass: 'text-indigo-300 bg-indigo-500/20 border-indigo-400/35',
      onClick: () => {
        if (viewMode !== 'workspace') {
          setViewMode('workspace');
          setIsAIDrawerOpen(true);
        } else {
          setIsAIDrawerOpen(!isAIDrawerOpen);
        }
        setActivePopover('none');
        setIsHovered(false);
      }
    },
    {
      id: 'settings',
      shortLabel: 'Posisi',
      fullLabel: 'Posisi 8 Jangkar, Tema & Pintasan',
      Icon: Settings,
      active: activePopover === 'settings',
      accentClass: 'text-sky-300 bg-sky-500/20 border-sky-400/35',
      onClick: () => togglePopover('settings')
    }
  ];

  const activePopoverKey = isLazytypeActive ? 'lazytype' : activePopover;
  const activePopoverMeta = POPOVER_TITLES[activePopoverKey] || POPOVER_TITLES.todo;

  return (
    <div
      ref={containerRef}
      className={`fixed z-50 flex gap-2.5 no-print ${getAnchorContainerClasses(islandPosition)}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Main Morphing Dynamic Notch + Optional Split Live Activity Capsule */}
      <div className="flex items-center gap-2.5 max-w-[96vw]">
        <motion.div
          layout
          transition={SPRING_CONFIG}
          className={`miu-glass-island relative overflow-hidden ${
            hasFeaturePopover
              ? `rounded-[26px] p-0 flex flex-col ${
                  activePopover === 'mirror' ? 'w-[336px]' : 'w-[392px]'
                } max-w-[94vw]`
              : isSideVertical
                ? 'flex flex-col items-center py-3 px-2 gap-2.5 rounded-[24px]'
                : isExpandedDock
                  ? 'p-3 rounded-[26px] w-[548px] max-w-[95vw]'
                  : 'px-3 py-1.5 rounded-full flex items-center gap-2 min-h-[42px]'
          }`}
        >
          {/* Ambient Top Edge Glint */}
          <div
            className="pointer-events-none absolute inset-x-6 top-0 h-px opacity-60"
            style={{
              background:
                'linear-gradient(90deg, transparent, rgba(56, 189, 248, 0.55), rgba(245, 239, 230, 0.55), transparent)'
            }}
          />

          {/* ================================================================= */}
          {/* STATE C: INTEGRATED POPOVER SHELL (Stable Header + Active Tool)   */}
          {/* ================================================================= */}
          {hasFeaturePopover ? (
            <div className="flex flex-col w-full">
              {/* Persistent Notch Header + Quick-Switch Tool Strip */}
              <div className="px-3.5 py-2.5 border-b border-white/10 bg-black/20 flex items-center justify-between gap-2 w-full">
                <button
                  type="button"
                  onClick={() => {
                    setActivePopover('dock');
                    if (isLazytypeActive) setIsLazytypeActive(false);
                  }}
                  className="flex items-center gap-2 text-left group focus:outline-none min-w-0 flex-1"
                  title="Kembali ke Dock Navigasi"
                >
                  <div className="w-7 h-7 rounded-full bg-white/[0.08] border border-white/10 flex items-center justify-center shrink-0 group-hover:border-sky-400/50 transition">
                    <MiuMascot mood={mascotMood} isHidden={isPageHidden} size={22} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs font-bold tracking-tight text-white truncate">
                      {activePopoverMeta.title}
                    </span>
                    <p className="text-[10px] text-slate-400 truncate leading-none mt-0.5">
                      {activePopoverMeta.subtitle}
                    </p>
                  </div>
                </button>

                {/* Quick-Switch Mini Icon Strip */}
                <div className="flex items-center gap-0.5 bg-white/[0.05] border border-white/10 rounded-full p-0.5 shrink-0">
                  {dockItems
                    .filter((item) =>
                      ['todo', 'board', 'music', 'mirror', 'lazytype', 'screentime', 'settings'].includes(
                        item.id
                      )
                    )
                    .map(({ id, shortLabel, Icon, active, liveDot, onClick }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={onClick}
                        title={shortLabel}
                        className={`relative w-5 h-5 rounded-full flex items-center justify-center transition ${
                          active
                            ? 'bg-sky-400 text-slate-950 shadow-sm'
                            : 'text-slate-300 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        <Icon className="w-3 h-3" />
                        {liveDot && !active && (
                          <span
                            className={`absolute top-0 right-0 w-1.5 h-1.5 rounded-full ${liveDot}`}
                          />
                        )}
                      </button>
                    ))}
                </div>

                {/* Pin & Close Controls */}
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsPinned((v) => !v)}
                    className={`p-1.5 rounded-full border transition ${
                      isPinned
                        ? 'bg-amber-400/20 border-amber-300/40 text-amber-200'
                        : 'border-transparent text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                    title={
                      isPinned
                        ? 'Disematkan (Tetap terbuka saat mencatat)'
                        : 'Sematkan Popover agar tidak menutup otomatis'
                    }
                    aria-label="Sematkan Popover"
                  >
                    <Pin className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActivePopover('none');
                      if (isLazytypeActive) setIsLazytypeActive(false);
                      setIsHovered(false);
                    }}
                    className="p-1.5 rounded-full hover:bg-white/15 text-slate-300 hover:text-white transition"
                    title="Tutup (Esc)"
                    aria-label="Tutup Popover"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Active Popover Content Body */}
              {activePopover !== 'music' && (
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={activePopoverKey}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.16, ease: 'easeOut' }}
                    className="w-full"
                  >
                    {(activePopover === 'todo' || activePopover === 'pomodoro') && (
                      <TodoPomodoroPopover />
                    )}
                    {activePopover === 'board' && <BoardShelfPopover />}
                    {activePopover === 'mirror' && <QuickMirrorPopover />}
                    {(activePopover === 'lazytype' || isLazytypeActive) && (
                      <LazytypePill
                        onClose={() => {
                          setActivePopover('none');
                          setIsLazytypeActive(false);
                        }}
                      />
                    )}
                    {activePopover === 'screentime' && <RemindersScreenTimePopover />}
                    {activePopover === 'settings' && <AnchorSettingsPopover />}
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          ) : isExpandedDock ? (
            /* ================================================================= */
            /* STATE B: TWO-TIER EXPANDED COMMAND DOCK (Hover or ⌘K)             */
            /* ================================================================= */
            <div className="space-y-2.5">
              {/* Tier 1: Live Telemetry & Context Header */}
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    type="button"
                    onClick={() => setActivePopover('none')}
                    className="w-8 h-8 rounded-full bg-white/[0.08] border border-white/15 flex items-center justify-center shrink-0 hover:border-sky-400/50 transition"
                    title="Ciutkan Dynamic Island"
                  >
                    <MiuMascot mood={mascotMood} isHidden={isPageHidden} size={24} showHalo />
                  </button>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={cycleNextCourse}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-white hover:text-sky-300 transition truncate"
                        title="Klik untuk ganti mata kuliah aktif"
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: activeCourse?.color || '#38BDF8' }}
                        />
                        <span className="truncate max-w-[160px]">
                          {activeCourse?.name || 'Miu Focus'}
                        </span>
                      </button>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-md bg-white/10 text-sky-300 shrink-0">
                        {formatDurationHM(todayCourseSeconds)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                      <span>🕌 {nextPrayer.name} {nextPrayer.time}</span>
                      <span>•</span>
                      <span className="truncate">
                        {pomodoroRunning
                          ? `🍅 Fokus ${formatTimerMMSS(pomodoroSeconds)}`
                          : hasAudioPlaying
                            ? `🎵 ${activeTrack.title}`
                            : 'Hover / ⌘K Navigasi Cepat'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Inline Mini Action Pills (Pomodoro Play/Pause, Music Play/Pause, Theme Toggle) */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Quick Pomodoro Pill */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (pomodoroRunning) pausePomodoro();
                      else startPomodoro();
                    }}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold border transition ${
                      pomodoroRunning
                        ? 'bg-rose-500/20 border-rose-400/40 text-rose-200'
                        : 'bg-white/[0.06] border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                    title={pomodoroRunning ? 'Jeda Pomodoro' : 'Mulai Fokus 25m Cepat'}
                  >
                    {pomodoroRunning ? (
                      <Pause className="w-3 h-3 text-rose-400" />
                    ) : (
                      <Play className="w-3 h-3 text-rose-400" />
                    )}
                    <span>{formatTimerMMSS(pomodoroSeconds)}</span>
                  </button>

                  {/* Quick Music Pill */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePlayMusic();
                    }}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition ${
                      activeTrack.isPlaying
                        ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
                        : 'bg-white/[0.06] border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                    title={activeTrack.isPlaying ? 'Jeda Musik' : 'Putar Musik Fokus'}
                  >
                    <Disc3
                      className={`w-3.5 h-3.5 text-emerald-400 ${
                        activeTrack.isPlaying && !isPageHidden ? 'animate-spin' : ''
                      }`}
                      style={{ animationDuration: '4s' }}
                    />
                    <span className="hidden sm:inline max-w-[72px] truncate">
                      {activeTrack.isPlaying ? 'Playing' : 'Musik'}
                    </span>
                  </button>

                  {/* Quick Theme Switcher */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTheme();
                    }}
                    className="w-7 h-7 rounded-full bg-white/[0.06] hover:bg-white/15 border border-white/10 flex items-center justify-center text-slate-200 transition"
                    title={
                      theme === 'light'
                        ? 'Ganti ke Warm Cream Dark Mode'
                        : 'Ganti ke Sky Blue Light Mode'
                    }
                    aria-label="Ganti Tema"
                  >
                    {theme === 'light' ? (
                      <Moon className="w-3.5 h-3.5 text-amber-300" />
                    ) : (
                      <Sun className="w-3.5 h-3.5 text-sky-300" />
                    )}
                  </button>
                </div>
              </div>

              {/* Tier 2: 10-Item Tactile Squircle Dock */}
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-1">
                {dockItems.map(
                  ({ id, shortLabel, fullLabel, Icon, active, liveDot, accentClass, onClick }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={onClick}
                      title={fullLabel}
                      className={`group relative flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl border transition-all ${
                        active
                          ? accentClass || 'bg-sky-500/20 border-sky-400/40 text-sky-200'
                          : 'border-transparent text-slate-300 hover:bg-white/[0.08] hover:border-white/10 hover:text-white'
                      }`}
                    >
                      <div className="relative flex items-center justify-center w-7 h-7 rounded-xl bg-white/[0.05] group-hover:scale-105 transition-transform">
                        <Icon className="w-3.5 h-3.5" />
                        {liveDot && (
                          <span
                            className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ring-2 ring-slate-950 ${liveDot}`}
                          />
                        )}
                      </div>
                      <span className="text-[10px] mt-1 font-medium tracking-tight leading-none whitespace-nowrap">
                        {shortLabel}
                      </span>
                    </button>
                  )
                )}
              </div>
            </div>
          ) : isSideVertical ? (
            /* ================================================================= */
            /* STATE A (VERTICAL): SIDE EDGE CAPSULE (Mid-Left / Mid-Right)      */
            /* ================================================================= */
            <>
              <button
                type="button"
                onClick={() => setActivePopover('dock')}
                className="w-8 h-8 rounded-full bg-white/[0.08] border border-white/10 flex items-center justify-center focus:outline-none"
                title="Miu Dynamic Island (⌘K)"
              >
                <MiuMascot mood={mascotMood} isHidden={isPageHidden} size={22} />
              </button>

              <button
                type="button"
                onClick={() => togglePopover(pomodoroRunning ? 'todo' : 'screentime')}
                className="flex flex-col items-center gap-1.5 text-[10px] font-mono"
              >
                {pomodoroRunning && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                )}
                {hasAudioPlaying && !pomodoroRunning && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                )}
                <span className="text-sky-300 font-semibold tracking-tighter">
                  {pomodoroRunning
                    ? formatTimerMMSS(pomodoroSeconds)
                    : formatDurationHM(todayCourseSeconds)}
                </span>
                <span className="miu-kbd !text-[9px] !px-1 !py-0.5">⌘K</span>
              </button>
            </>
          ) : (
            /* ================================================================= */
            /* STATE A (HORIZONTAL): SLEEK COMPACT PILL & SPLIT LIVE ACTIVITY    */
            /* ================================================================= */
            <>
              {/* Miu Companion Mascot Button with Ambient Ring */}
              <button
                type="button"
                onClick={() => setActivePopover(activePopover === 'none' ? 'dock' : 'none')}
                className="relative w-7 h-7 rounded-full bg-white/[0.08] border border-white/15 flex items-center justify-center focus:outline-none hover:border-sky-400/50 transition shrink-0"
                title="Miu Dynamic Island (Hover atau tekan ⌘K)"
              >
                <MiuMascot mood={mascotMood} isHidden={isPageHidden} size={22} />
              </button>

              {isSplitLive ? (
                /* 1. Split Live Activity State (Pomodoro + Synced LRCLIB Lyric) */
                <div className="flex items-center gap-2 min-w-0 max-w-[310px]">
                  <button
                    type="button"
                    onClick={() => togglePopover('todo')}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-400/30 shrink-0 hover:bg-rose-500/30 transition"
                    title="Buka Pomodoro & To-do"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                    <span className="font-mono text-xs font-bold tabular-nums text-rose-100">
                      {formatTimerMMSS(pomodoroSeconds)}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => togglePopover('music')}
                    className="flex items-center gap-1.5 min-w-0 text-left hover:opacity-90 transition"
                    title="Buka Musik & Lirik"
                  >
                    {/* Animated 3-bar Equalizer */}
                    <span className="inline-flex items-end gap-[2px] h-3.5 shrink-0">
                      <span
                        className={`w-[2.5px] rounded-full bg-emerald-400 ${
                          !isPageHidden ? 'animate-eq-1' : 'h-2'
                        }`}
                      />
                      <span
                        className={`w-[2.5px] rounded-full bg-emerald-400 ${
                          !isPageHidden ? 'animate-eq-2' : 'h-3'
                        }`}
                      />
                      <span
                        className={`w-[2.5px] rounded-full bg-emerald-400 ${
                          !isPageHidden ? 'animate-eq-3' : 'h-1.5'
                        }`}
                      />
                    </span>
                    <span className="text-[11px] font-medium text-emerald-200 truncate max-w-[165px]">
                      {activeLyricText}
                    </span>
                  </button>
                </div>
              ) : pomodoroRunning ? (
                /* 2. Focus Pomodoro Active State */
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => togglePopover('todo')}
                    className="flex items-center gap-2 hover:opacity-95 transition"
                  >
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-400/30 text-rose-200 font-mono font-bold tabular-nums">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                      {formatTimerMMSS(pomodoroSeconds)}
                    </span>
                    <span className="text-[11px] font-medium text-slate-200 truncate max-w-[120px]">
                      {activeCourse?.name || 'Sesi Fokus'}
                    </span>
                  </button>
                  {/* Mini Progress Bar */}
                  <div className="w-10 h-1.5 rounded-full bg-white/10 overflow-hidden hidden sm:block">
                    <div
                      className="h-full bg-rose-400 transition-all duration-300"
                      style={{ width: `${Math.max(8, pomodoroProgressPct)}%` }}
                    />
                  </div>
                </div>
              ) : hasAudioPlaying ? (
                /* 3. Music or Layered White Noise Active State */
                <button
                  type="button"
                  onClick={() => togglePopover('music')}
                  className="flex items-center gap-2 text-xs min-w-0"
                >
                  <span className="inline-flex items-end gap-[2px] h-3.5 shrink-0">
                    <span
                      className={`w-[2.5px] rounded-full bg-emerald-400 ${
                        !isPageHidden ? 'animate-eq-1' : 'h-2'
                      }`}
                    />
                    <span
                      className={`w-[2.5px] rounded-full bg-emerald-400 ${
                        !isPageHidden ? 'animate-eq-2' : 'h-3'
                      }`}
                    />
                    <span
                      className={`w-[2.5px] rounded-full bg-emerald-400 ${
                        !isPageHidden ? 'animate-eq-3' : 'h-1.5'
                      }`}
                    />
                  </span>
                  <span className="truncate max-w-[145px] text-emerald-200 font-medium">
                    {activeTrack.isPlaying
                      ? activeTrack.title
                      : `Ambient (${activeNoises.length} layer)`}
                  </span>
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-sky-300 shrink-0">
                    {formatDurationHM(todayCourseSeconds)}
                  </span>
                </button>
              ) : (
                /* 4. Default Compact Idle State */
                <button
                  type="button"
                  onClick={() => setActivePopover('dock')}
                  className="flex items-center gap-2 text-xs min-w-0"
                >
                  <span className="inline-flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: activeCourse?.color || '#38BDF8' }}
                    />
                    <span className="font-semibold truncate max-w-[135px] text-slate-100">
                      {activeCourse?.name || 'Miu Focus'}
                    </span>
                  </span>

                  <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-white/[0.09] border border-white/10 text-sky-300 shrink-0">
                    {formatDurationHM(todayCourseSeconds)}
                  </span>

                  <span className="miu-kbd hidden sm:inline-flex">⌘K</span>
                </button>
              )}

              {/* PWA Update Pill (`NFR-3`) */}
              {pwaUpdateAvailable && (
                <button
                  type="button"
                  onClick={applyPwaUpdate}
                  className="ml-0.5 px-2 py-0.5 rounded-full bg-emerald-400 text-slate-950 font-mono text-[10px] font-bold hover:bg-emerald-300 transition shrink-0 shadow-sm"
                  title="Versi baru Miu tersedia. Klik untuk perbarui tanpa kehilangan catatan."
                >
                  Update
                </button>
              )}
            </>
          )}
          {/* Single Persistent MusicMixerPopover instance so Spotify Embed iframe never unmounts when closing the popover */}
          <div className={hasFeaturePopover && activePopover === 'music' ? 'w-full block' : 'hidden'}>
            <MusicMixerPopover />
          </div>
        </motion.div>

        {/* Detached Circular Split Pill (42px x 42px Spinning Vinyl Album Art + Ambient Glow) */}
        <AnimatePresence>
          {isSplitLive && !isExpandedDock && !hasFeaturePopover && (
            <motion.button
              type="button"
              initial={{ scale: 0.4, opacity: 0, x: -12 }}
              animate={{ scale: 1, opacity: 1, x: 0 }}
              exit={{ scale: 0.4, opacity: 0, x: -12 }}
              transition={SPRING_CONFIG}
              onClick={() => togglePopover('music')}
              className="w-[42px] h-[42px] rounded-full p-1 miu-glass-island flex items-center justify-center relative shrink-0 group"
              style={{
                boxShadow: `0 0 22px ${activeTrack.glowColor}88, inset 0 1px 0 rgba(255,255,255,0.2)`
              }}
              title={`${activeTrack.title} — ${activeTrack.artist} (Klik untuk buka Mixer)`}
            >
              <img
                src={activeTrack.coverUrl}
                alt={activeTrack.title}
                className={`w-full h-full rounded-full object-cover ${
                  !isPageHidden ? 'animate-spin' : ''
                }`}
                style={{ animationDuration: '7s' }}
              />
              {/* Vinyl spindle center hole */}
              <span className="absolute w-2.5 h-2.5 rounded-full bg-slate-950 border border-white/40 pointer-events-none" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Gentle Reminder Toast Pill (Hydration, Stretch, Sholat, Pomodoro Complete) */}
      <AnimatePresence>
        {activeAlert && !hasFeaturePopover && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={SPRING_CONFIG}
            className="miu-glass-island rounded-2xl px-3.5 py-2.5 max-w-[340px] flex items-start gap-3 border border-amber-300/30"
          >
            <div className="w-8 h-8 rounded-full bg-amber-400/15 border border-amber-300/30 flex items-center justify-center shrink-0 mt-0.5">
              <MiuMascot mood={mascotMood} size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-amber-200">{activeAlert.title}</p>
              <p className="text-[11px] text-slate-300 leading-snug mt-0.5">
                {activeAlert.message}
              </p>
            </div>
            <button
              type="button"
              onClick={dismissAlert}
              className="p-1 rounded-full hover:bg-white/10 text-slate-400 hover:text-white shrink-0"
              aria-label="Tutup pengingat"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
