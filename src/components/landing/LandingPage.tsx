'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bug,
  Camera,
  Check,
  ChevronDown,
  ClipboardList,
  Coffee,
  ExternalLink,
  FileText,
  Globe,
  Keyboard,
  Mic,
  Moon,
  Music2,
  PanelRight,
  Play,
  Scissors,
  Settings,
  Sparkles,
  Sun,
  Timer
} from 'lucide-react';
import { useMiu } from '../../context/MiuContext';
import { LANDING_FAQ_ITEMS } from '../../lib/seo';
import { MiuMascot } from '../island/MiuMascot';

const TIKTOK_VIDEO_ID = '7709789744741321991';
const TIKTOK_HANDLE = '@lndevtech';
const TIKTOK_VIDEO_URL =
  'https://www.tiktok.com/@lndevtech/video/7709789744741321991';
const TIKTOK_EMBED_SRC = `https://www.tiktok.com/embed/v2/${TIKTOK_VIDEO_ID}?lang=id-ID`;

const QUICK_TRY_FEATURES = [
  { id: 'todo' as const, label: 'Pomodoro & To-do', Icon: Timer },
  { id: 'music' as const, label: 'Musik & White Noise', Icon: Music2 },
  { id: 'board' as const, label: 'Board & Shelf', Icon: ClipboardList },
  { id: 'mirror' as const, label: 'Cermin Cepat', Icon: Camera },
  { id: 'lazytype' as const, label: 'Dikte Offline', Icon: Mic },
  { id: 'screentime' as const, label: 'Screen Time & Sholat', Icon: BarChart3 },
  { id: 'settings' as const, label: '8 Posisi & Tema', Icon: Settings }
];

type PreviewTabId = 'editor' | 'ai' | 'peek';

const PREVIEW_TABS: Array<{ id: PreviewTabId; label: string }> = [
  { id: 'editor', label: 'Editor Blok' },
  { id: 'ai', label: 'Miu AI & Skill' },
  { id: 'peek', label: 'Side Peek & Kanban' }
];

const CORE_PILLARS = [
  {
    index: '01',
    title: 'Editor blok yang cepat & terstruktur',
    description:
      'Ketik / untuk menyisipkan heading, rumus LaTeX, kode, tabel, database, hingga pratinjau PDF. Atur subhalaman lewat drag-and-drop dan buka referensi di Side Peek kanan dengan ⌥Klik.',
    meta: 'Slash Command / • Side Peek ⌥Klik • Pintasan ⌘/'
  },
  {
    index: '02',
    title: 'Asisten Miu AI + Pustaka Skill',
    description:
      'Tersedia 8 model AI gratis yang terhubung ke Web Tool, pembaca PDF, dan aksi langsung ke catatan. Pasang atau buat halaman skill.md sendiri agar AI mengikuti gaya kerjamu.',
    meta: '8 Model Gratis • Web Tool • skill.md Kustom'
  },
  {
    index: '03',
    title: 'Kolaborasi real-time, Kanban & Kalender',
    description:
      'Bagikan catatan lewat tautan publik atau undang kolaborator dengan kursor langsung. Catatan dengan sharing aktif otomatis terdata di bilah sisi Dibagikan, dan blok /deadline masuk ke Kalender.',
    meta: 'Live Presence • Bagian Dibagikan • Sinkron Kalender'
  },
  {
    index: '04',
    title: 'Dynamic Island untuk fokus tanpa gangguan',
    description:
      'Timer Pomodoro Web Worker, pemutar musik & White Noise, pengingat waktu sholat, dikte suara offline, hingga Lazyshot OCR selalu siap di satu notch kecil tanpa memenuhi layar.',
    meta: 'Tekan ⌘K • 8 Posisi Notch • Mode Terang & Gelap'
  }
];

const VIDEO_HIGHLIGHTS = [
  {
    step: '01',
    title: 'Satu layar, nol distraksi',
    body: 'Mulai sesi fokus, putar musik latar, dan catat materi kuliah langsung dari satu workspace ringan.'
  },
  {
    step: '02',
    title: 'Dari PDF langsung jadi halaman ringkasan',
    body: 'Tarik file PDF ke catatan, minta Miu AI menganalisis isinya, lalu buat halaman rangkuman terpisah secara otomatis.'
  },
  {
    step: '03',
    title: 'Tetap kencang meski tanpa internet',
    body: 'Data tersimpan lokal di browser terlebih dahulu dan bisa disinkronkan ke cloud kapan pun kamu butuh kolaborasi.'
  }
];

export const LandingPage: React.FC = () => {
  const {
    theme,
    toggleTheme,
    activePopover,
    setActivePopover,
    startPomodoro,
    togglePlayMusic,
    activeTrack,
    pomodoroRunning,
    setIsLazyshotOpen,
    setIsSupportModalOpen,
    islandPosition
  } = useMiu();

  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);
  const [previewTab, setPreviewTab] = useState<PreviewTabId>('editor');
  const [tiktokLoaded, setTiktokLoaded] = useState(false);

  const hasTopIsland =
    islandPosition === 'top-left' ||
    islandPosition === 'top-center' ||
    islandPosition === 'top-right';

  const handleTriggerSplitDemo = () => {
    if (!pomodoroRunning) startPomodoro();
    if (!activeTrack.isPlaying) togglePlayMusic();
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen flex flex-col text-text-primary selection:bg-sky-500/20">
      {/* Editorial Top Bar — leaves center clean for top-center Dynamic Island */}
      <header
        className={`w-full max-w-6xl mx-auto px-5 sm:px-8 ${
          hasTopIsland ? 'pt-20 sm:pt-16' : 'pt-7'
        } pb-4 flex items-center justify-between gap-4`}
      >
        <Link
          href="/"
          className="inline-flex items-center gap-2.5 group focus:outline-none"
        >
          <span className="w-9 h-9 rounded-xl bg-surface border border-border-subtle shadow-sm flex items-center justify-center group-hover:border-accent-strong/60 transition">
            <MiuMascot mood="idle" size={22} />
          </span>
          <div className="flex flex-col leading-none">
            <span className="text-[15px] font-extrabold tracking-tight text-text-primary">
              Miu
            </span>
            <span className="text-[10.5px] font-medium text-text-secondary mt-0.5">
              Workspace &amp; Fokus
            </span>
          </div>
        </Link>

        <nav
          aria-label="Navigasi utama"
          className="flex items-center gap-1 sm:gap-2"
        >
          <button
            type="button"
            onClick={() => scrollToSection('video-showcase')}
            className="hidden md:inline-flex px-3 py-1.5 rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface/70 transition"
          >
            Video Demo
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('fitur')}
            className="hidden md:inline-flex px-3 py-1.5 rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface/70 transition"
          >
            Fitur
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('faq')}
            className="hidden md:inline-flex px-3 py-1.5 rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface/70 transition"
          >
            FAQ
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-surface/85 border border-border-subtle text-text-secondary hover:text-text-primary hover:border-accent-strong/50 transition"
            title={theme === 'dark' ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
            aria-label="Ganti tema"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>

          <Link
            id="nav-open-workspace"
            href="/app"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-text-primary text-surface text-xs font-semibold hover:opacity-90 transition active:scale-[0.98]"
          >
            <span>Buka Miu</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </nav>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-5 sm:px-8 pt-8 sm:pt-14 pb-20 space-y-24 sm:space-y-32">
        {/* ================================================================= */}
        {/* 1. HERO SECTION — Editorial Copy + Interactive Live App Preview   */}
        {/* ================================================================= */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-6 space-y-6 text-left"
          >
            <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.16em] text-text-secondary">
              Workspace Catatan &amp; Fokus • Local-First
            </p>

            <h1 className="text-4xl sm:text-5xl lg:text-[52px] font-extrabold tracking-[-0.035em] leading-[1.08] text-text-primary">
              Ruang catatan tenang yang menyatu dengan fokus harianmu.
            </h1>

            <p className="text-[15px] sm:text-base text-text-secondary max-w-xl leading-relaxed">
              Tulis catatan blok, analisis PDF dengan 8 model Miu AI gratis, atur
              Kanban &amp; Kalender, lalu jaga ritme belajarmu dari satu{' '}
              <strong className="font-semibold text-text-primary">
                Dynamic Island
              </strong>{' '}
              di atas layar. Tekan{' '}
              <kbd className="font-mono text-[11px] px-1.5 py-0.5 rounded-md bg-surface border border-border-subtle text-text-primary shadow-[0_1px_0_rgba(15,23,42,0.08)]">
                ⌘K
              </kbd>{' '}
              kapan saja.
            </p>

            {/* Primary & Secondary Actions */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                id="hero-start-writing"
                href="/app"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-accent-strong text-white dark:text-slate-950 font-bold text-sm shadow-[0_10px_24px_-8px_rgba(2,132,199,0.45)] dark:shadow-none hover:opacity-95 transition active:scale-[0.98]"
              >
                <span>Mulai Mencatat — Gratis</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <button
                id="hero-simulate-focus"
                type="button"
                onClick={handleTriggerSplitDemo}
                className="inline-flex items-center gap-2 px-4 py-3.5 rounded-xl bg-surface border border-border-subtle text-sm font-semibold text-text-primary hover:border-text-secondary/50 transition active:scale-[0.98]"
              >
                <Timer className="w-4 h-4 text-rose-500" />
                <span>
                  {pomodoroRunning && activeTrack.isPlaying
                    ? 'Fokus & Musik Aktif'
                    : 'Simulasi Fokus + Musik'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => scrollToSection('video-showcase')}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary transition"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Tonton Demo</span>
              </button>
            </div>

            {/* Quiet Factual Proof Strip */}
            <div className="pt-4 border-t border-border-subtle/80 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-text-secondary">
              <span className="inline-flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                Gratis tanpa iklan
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                Offline-ready &amp; Cloud Sync
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                8 Model AI + Web Tool
              </span>
            </div>
          </motion.div>

          {/* Right Column: Interactive Live Workspace Preview */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-6"
          >
            <div className="rounded-2xl bg-surface border border-border-subtle shadow-[0_24px_60px_-24px_rgba(15,23,42,0.18)] dark:shadow-[0_28px_70px_-24px_rgba(0,0,0,0.72)] overflow-hidden">
              {/* Preview Window Top Chrome + Mode Tabs */}
              <div className="px-4 py-2.5 border-b border-border-subtle bg-subtle/60 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-border-subtle" />
                  <span className="w-2.5 h-2.5 rounded-full bg-border-subtle" />
                  <span className="w-2.5 h-2.5 rounded-full bg-border-subtle" />
                </div>

                <div
                  role="tablist"
                  aria-label="Pratinjau mode workspace Miu"
                  className="flex items-center gap-1 bg-surface border border-border-subtle/80 rounded-lg p-0.5"
                >
                  {PREVIEW_TABS.map((tab) => {
                    const active = previewTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setPreviewTab(tab.id)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                          active
                            ? 'bg-text-primary text-surface shadow-sm'
                            : 'text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Interactive Preview Canvas */}
              <div className="min-h-[340px] sm:min-h-[365px] grid grid-cols-12 bg-surface">
                {/* Mini Left Sidebar */}
                <div className="hidden sm:flex col-span-4 border-r border-border-subtle/70 bg-subtle/35 p-3 flex-col justify-between text-[11.5px]">
                  <div className="space-y-3">
                    <div className="px-2 py-1 rounded-md bg-surface border border-border-subtle/80 text-text-secondary flex items-center justify-between text-[11px]">
                      <span>Cari atau tanya</span>
                      <span className="font-mono text-[9.5px]">⌘K</span>
                    </div>

                    <div className="space-y-1">
                      <div className="px-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-secondary/75">
                        Privat
                      </div>
                      <div
                        className={`px-2 py-1 rounded-md flex items-center gap-1.5 font-medium ${
                          previewTab === 'editor'
                            ? 'bg-text-primary/[0.07] text-text-primary'
                            : 'text-text-secondary'
                        }`}
                      >
                        <span>📚</span>
                        <span className="truncate">Struktur Data</span>
                      </div>
                      <div className="ml-3.5 pl-2 border-l border-border-subtle space-y-1">
                        <div className="px-1.5 py-0.5 rounded text-text-secondary flex items-center gap-1.5">
                          <span>📝</span>
                          <span className="truncate">Rangkuman Modul 4</span>
                        </div>
                        <div className="px-1.5 py-0.5 rounded text-text-secondary flex items-center gap-1.5">
                          <span>🎓</span>
                          <span className="truncate">tutor-ujian/skill.md</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="px-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-text-secondary/75">
                        <span>Dibagikan</span>
                        <span className="font-mono text-accent-strong">1</span>
                      </div>
                      <div className="px-2 py-1 rounded-md flex items-center justify-between gap-1 text-text-secondary">
                        <span className="inline-flex items-center gap-1.5 truncate">
                          <span>🚀</span>
                          <span className="truncate">Proyek Kelompok</span>
                        </span>
                        <Globe className="w-3 h-3 text-sky-500 shrink-0" />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border-subtle/70 flex items-center justify-between text-[10.5px] text-text-secondary">
                    <span className="truncate font-medium">Ruang Kerja Miu</span>
                    <Keyboard className="w-3.5 h-3.5 shrink-0" />
                  </div>
                </div>

                {/* Dynamic Preview Content Area */}
                <div className="col-span-12 sm:col-span-8 p-5 flex flex-col justify-between">
                  <AnimatePresence mode="wait">
                    {previewTab === 'editor' && (
                      <motion.div
                        key="tab-editor"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-4 text-left"
                      >
                        <div className="flex items-center justify-between text-[11px] text-text-secondary pb-2 border-b border-border-subtle/60">
                          <span className="inline-flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5" />
                            <span>Struktur Data / Rangkuman Modul 4</span>
                          </span>
                          <span className="font-mono text-[10px]">⌘B • ⌘I • ⌘/</span>
                        </div>

                        <div className="space-y-2.5">
                          <h3 className="text-lg font-bold tracking-tight text-text-primary">
                            📝 Rangkuman Modul 4 — Graf &amp; Pohon
                          </h3>
                          <p className="text-xs text-text-secondary leading-relaxed">
                            Traversal <strong className="text-text-primary">BFS</strong>{' '}
                            menggunakan antrean (<code className="px-1 py-0.5 rounded bg-subtle font-mono text-[11px]">Queue</code>) untuk mencari lintasan terpendek pada graf tak berbobot.
                          </p>
                          <div className="px-3 py-2 rounded-lg bg-subtle/80 border border-border-subtle text-xs text-text-primary flex items-start gap-2">
                            <span>💡</span>
                            <span>
                              Kompleksitas waktu BFS &amp; DFS adalah{' '}
                              <code className="font-mono text-[11px]">O(V + E)</code> dengan
                              adjacency list.
                            </span>
                          </div>
                          <div className="space-y-1.5 pt-1 text-xs">
                            <div className="flex items-center gap-2 text-text-secondary line-through">
                              <span className="w-3.5 h-3.5 rounded bg-emerald-500 text-white flex items-center justify-center">
                                <Check className="w-2.5 h-2.5" />
                              </span>
                              <span>Analisis PDF Modul 4 dengan Miu AI</span>
                            </div>
                            <div className="flex items-center gap-2 text-text-primary">
                              <span className="w-3.5 h-3.5 rounded border border-border-subtle" />
                              <span>Latihan soal Exercise 2 &amp; 3</span>
                              <span className="ml-auto font-mono text-[10px] px-1.5 py-0.5 rounded bg-amber-500/12 text-amber-600 dark:text-amber-300">
                                Besok 23:59
                              </span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {previewTab === 'ai' && (
                      <motion.div
                        key="tab-ai"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-3.5 text-left"
                      >
                        <div className="flex items-center justify-between text-[11px] text-text-secondary pb-2 border-b border-border-subtle/60">
                          <span className="inline-flex items-center gap-1.5 font-semibold text-text-primary">
                            <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                            <span>Miu AI Free • Agent Aktif</span>
                          </span>
                          <span className="font-mono text-[10px]">Web Tool + Skill</span>
                        </div>

                        <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-subtle border border-border-subtle px-3 py-2 text-xs text-text-primary">
                          Buatkan catatan ringkasan terpisah dari PDF Modul 4 di workspace.
                        </div>

                        <div className="space-y-2">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                            <Check className="w-3 h-3" />
                            <span>Membuat catatan &quot;Rangkuman Modul 4&quot; (8 blok)</span>
                          </div>
                          <p className="text-xs text-text-secondary leading-relaxed">
                            Halaman <strong className="text-text-primary">Rangkuman Modul 4</strong>{' '}
                            sudah dibuat dan langsung dibuka di editor lengkap dengan poin
                            konsep, rumus, dan daftar latihan.
                          </p>
                        </div>

                        <div className="pt-2 flex flex-wrap gap-1.5 text-[10.5px]">
                          <span className="px-2 py-1 rounded-md bg-subtle border border-border-subtle text-text-secondary">
                            Web Tool Aktif
                          </span>
                          <span className="px-2 py-1 rounded-md bg-subtle border border-border-subtle text-text-secondary">
                            tutor-ujian/skill.md
                          </span>
                          <span className="px-2 py-1 rounded-md bg-subtle border border-border-subtle text-text-secondary">
                            8 Model Gratis
                          </span>
                        </div>
                      </motion.div>
                    )}

                    {previewTab === 'peek' && (
                      <motion.div
                        key="tab-peek"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-3.5 text-left"
                      >
                        <div className="flex items-center justify-between text-[11px] text-text-secondary pb-2 border-b border-border-subtle/60">
                          <span className="inline-flex items-center gap-1.5 font-semibold text-text-primary">
                            <PanelRight className="w-3.5 h-3.5 text-sky-500" />
                            <span>Side Peek Kanan &amp; Papan Kanban</span>
                          </span>
                          <span className="font-mono text-[10px]">⌥Klik • Tarik ukuran</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                              Sedang Dikerjakan
                            </p>
                            <div className="p-2.5 rounded-lg bg-subtle/70 border border-border-subtle space-y-1">
                              <p className="text-xs font-semibold text-text-primary">
                                📊 Analisis Algoritma
                              </p>
                              <p className="text-[10.5px] text-text-secondary">
                                4 blok • 2 deadline
                              </p>
                            </div>
                            <div className="p-2.5 rounded-lg bg-subtle/70 border border-border-subtle space-y-1">
                              <p className="text-xs font-semibold text-text-primary">
                                🎙️ Voice Note Kuliah
                              </p>
                              <p className="text-[10.5px] text-text-secondary">
                                Transkrip otomatis
                              </p>
                            </div>
                          </div>

                          <div className="pl-3 border-l border-border-subtle space-y-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-accent-strong">
                              Side Peek Aktif
                            </p>
                            <p className="text-xs font-bold text-text-primary">
                              📄 Referensi Rumus
                            </p>
                            <p className="text-[11px] text-text-secondary leading-relaxed">
                              Buka catatan pembanding di sisi kanan tanpa pindah halaman. Lebar
                              panel bisa ditarik bebas.
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="pt-4 mt-4 border-t border-border-subtle/60 flex items-center justify-between text-[11px] text-text-secondary">
                    <span>Tersimpan lokal otomatis • Sinkron cloud opsional</span>
                    <Link
                      href="/app"
                      className="inline-flex items-center gap-1 font-semibold text-accent-strong hover:underline"
                    >
                      <span>Buka penuh</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ================================================================= */}
        {/* 2. LIVE DYNAMIC ISLAND PLAYGROUND                                 */}
        {/* ================================================================= */}
        <section
          aria-label="Coba langsung Dynamic Island"
          className="rounded-2xl bg-surface/85 border border-border-subtle p-5 sm:p-6 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-text-primary">
                Coba langsung Dynamic Island di atas layar
              </h2>
              <p className="text-xs text-text-secondary mt-0.5">
                Klik modul mana saja di bawah ini untuk membukanya secara nyata sekarang juga.
              </p>
            </div>
            <span className="text-[11px] font-mono text-text-secondary shrink-0">
              Pintasan cepat: ⌘K
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {QUICK_TRY_FEATURES.map(({ id, label, Icon }) => {
              const isActive = activePopover === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActivePopover(isActive ? 'none' : id)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium border transition active:scale-[0.98] ${
                    isActive
                      ? 'bg-text-primary text-surface border-text-primary shadow-sm'
                      : 'bg-subtle/50 border-border-subtle text-text-primary hover:border-text-secondary/50 hover:bg-subtle'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setIsLazyshotOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium bg-subtle/50 border border-border-subtle text-text-primary hover:border-text-secondary/50 hover:bg-subtle transition active:scale-[0.98]"
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>Lazyshot OCR</span>
            </button>
          </div>
        </section>

        {/* ================================================================= */}
        {/* 3. TIKTOK VIDEO SHOWCASE (@lndevtech)                             */}
        {/* ================================================================= */}
        <section
          id="video-showcase"
          className="scroll-mt-24 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center"
        >
          {/* Embedded Vertical TikTok Player */}
          <div className="lg:col-span-5 flex flex-col items-center">
            <div className="w-full max-w-[340px] rounded-[26px] bg-slate-950 border border-border-subtle shadow-[0_24px_60px_-20px_rgba(15,23,42,0.32)] dark:shadow-[0_28px_70px_-20px_rgba(0,0,0,0.8)] overflow-hidden relative">
              {!tiktokLoaded && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950 text-slate-300 px-6 text-center pointer-events-none">
                  <div className="w-10 h-10 rounded-full border border-white/15 bg-white/5 flex items-center justify-center">
                    <Play className="w-4 h-4 fill-current text-white" />
                  </div>
                  <p className="text-xs font-medium">Memuat sematan video TikTok...</p>
                </div>
              )}

              <iframe
                src={TIKTOK_EMBED_SRC}
                title={`Video demo TikTok oleh ${TIKTOK_HANDLE}`}
                className="w-full h-[595px] sm:h-[620px] border-0 bg-slate-950 block"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                loading="lazy"
                onLoad={() => setTiktokLoaded(true)}
              />
            </div>

            <a
              id="tiktok-direct-link"
              href={TIKTOK_VIDEO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3.5 inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-text-primary transition"
            >
              <span>Tonton langsung di TikTok ({TIKTOK_HANDLE})</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Editorial Context Beside Video */}
          <div className="lg:col-span-7 space-y-7 text-left">
            <div className="space-y-3">
              <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.16em] text-text-secondary">
                Video Sorotan • {TIKTOK_HANDLE}
              </p>
              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-[-0.03em] leading-[1.14] text-text-primary">
                Lihat bagaimana alur kerja fokus berjalan dalam hitungan detik.
              </h2>
              <p className="text-sm sm:text-[15px] text-text-secondary leading-relaxed max-w-xl">
                Dirancang agar kamu tidak perlu berpindah-pindah antara aplikasi catatan,
                timer belajar, pemutar musik, dan asisten AI. Semuanya hidup rapi di satu
                tab browser.
              </p>
            </div>

            <div className="divide-y divide-border-subtle border-y border-border-subtle">
              {VIDEO_HIGHLIGHTS.map((item) => (
                <div key={item.step} className="py-4 flex items-start gap-4">
                  <span className="font-mono text-xs font-bold text-text-secondary pt-0.5 shrink-0">
                    {item.step}
                  </span>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-text-primary">
                      {item.title}
                    </h3>
                    <p className="text-xs sm:text-[13px] text-text-secondary leading-relaxed">
                      {item.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/app"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-text-primary text-surface text-xs sm:text-sm font-semibold hover:opacity-90 transition active:scale-[0.98]"
              >
                <span>Coba Alur Ini di Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href={TIKTOK_VIDEO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl bg-surface border border-border-subtle text-xs sm:text-sm font-medium text-text-primary hover:border-text-secondary/50 transition"
              >
                <span>Buka Video Asli</span>
                <ArrowUpRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </section>

        {/* ================================================================= */}
        {/* 4. CORE CAPABILITIES — Clean Architectural 2x2 Grid               */}
        {/* ================================================================= */}
        <section id="fitur" className="scroll-mt-24 space-y-8">
          <div className="max-w-2xl space-y-2.5 text-left">
            <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.16em] text-text-secondary">
              Dibangun untuk Produktivitas Nyata
            </p>
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-[-0.03em] leading-[1.14] text-text-primary">
              Semua alat penting di tempatnya, tanpa fitur yang mengganggu.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 border-t border-l border-border-subtle rounded-2xl overflow-hidden bg-surface">
            {CORE_PILLARS.map((pillar) => (
              <article
                key={pillar.index}
                className="p-6 sm:p-8 border-r border-b border-border-subtle flex flex-col justify-between gap-5 text-left hover:bg-subtle/35 transition-colors"
              >
                <div className="space-y-3">
                  <span className="font-mono text-xs font-bold text-text-secondary">
                    {pillar.index}
                  </span>
                  <h3 className="text-lg font-bold tracking-tight text-text-primary">
                    {pillar.title}
                  </h3>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    {pillar.description}
                  </p>
                </div>
                <p className="text-[11px] font-mono text-text-secondary/90 pt-3 border-t border-border-subtle/70">
                  {pillar.meta}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* ================================================================= */}
        {/* 5. FAQ ACCORDION                                                  */}
        {/* ================================================================= */}
        <section
          id="faq"
          className="scroll-mt-24 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start"
        >
          <div className="lg:col-span-4 space-y-2 text-left">
            <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.16em] text-text-secondary">
              Pertanyaan Umum
            </p>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-[-0.03em] text-text-primary">
              Hal yang sering ditanyakan
            </h2>
            <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
              Transparan soal privasi, kecepatan, dan penggunaan offline di perangkatmu.
            </p>
          </div>

          <div className="lg:col-span-8 divide-y divide-border-subtle border-y border-border-subtle text-left">
            {LANDING_FAQ_ITEMS.map((item, idx) => {
              const isOpen = openFaqIdx === idx;
              return (
                <div key={item.q}>
                  <button
                    type="button"
                    onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                    aria-expanded={isOpen}
                    className="w-full py-4 flex items-center justify-between gap-4 text-left text-sm sm:text-[15px] font-semibold text-text-primary hover:text-accent-strong transition"
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-text-secondary shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <p className="pb-4 text-xs sm:text-sm text-text-secondary leading-relaxed pr-6">
                          {item.a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </section>

        {/* ================================================================= */}
        {/* 6. CLOSING INVITATION BAND                                        */}
        {/* ================================================================= */}
        <section className="rounded-2xl bg-surface border border-border-subtle px-6 py-10 sm:px-10 sm:py-12 flex flex-col sm:flex-row sm:items-center justify-between gap-6 text-left">
          <div className="space-y-2 max-w-xl">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-[-0.03em] text-text-primary">
              Siap merapikan catatan dan fokus hari ini?
            </h2>
            <p className="text-sm text-text-secondary">
              Langsung masuk ke ruang kerja Miu—cepat, bersih, dan siap dipakai di browser.
            </p>
          </div>

          <Link
            id="footer-cta-open-workspace"
            href="/app"
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-accent-strong text-white dark:text-slate-950 font-bold text-sm shadow-sm hover:opacity-95 transition active:scale-[0.98] shrink-0"
          >
            <span>Buka Ruang Kerja Miu</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </section>
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="w-full max-w-6xl mx-auto px-5 sm:px-8 py-8 border-t border-border-subtle flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-secondary">
        <div className="flex items-center gap-2">
          <MiuMascot mood="idle" size={16} />
          <span>Miu v3.0 • Local-First &amp; Gratis</span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-5">
          <Link href="/privacy-policy" className="hover:text-text-primary transition">
            Privacy Policy
          </Link>
          <Link href="/terms-of-service" className="hover:text-text-primary transition">
            Terms of Service
          </Link>
          <button
            type="button"
            onClick={() => setIsSupportModalOpen('coffee')}
            className="inline-flex items-center gap-1.5 hover:text-text-primary transition"
          >
            <Coffee className="w-3.5 h-3.5 text-amber-500" />
            <span>Traktir Kopi</span>
          </button>
          <button
            type="button"
            onClick={() => setIsSupportModalOpen('bug')}
            className="inline-flex items-center gap-1.5 hover:text-text-primary transition"
          >
            <Bug className="w-3.5 h-3.5" />
            <span>Lapor Bug</span>
          </button>
        </div>
      </footer>
    </div>
  );
};
