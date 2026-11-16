'use client';

import React, { useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Bug,
  Camera,
  ChevronDown,
  ClipboardList,
  Coffee,
  Mic,
  Music2,
  Scissors,
  Settings,
  Timer
} from 'lucide-react';
import { useMiu } from '../../context/MiuContext';
import { MiuMascot } from '../island/MiuMascot';

const QUICK_TRY_FEATURES = [
  { id: 'todo' as const, label: 'Pomodoro & To-do', Icon: Timer },
  { id: 'music' as const, label: 'Musik & White Noise', Icon: Music2 },
  { id: 'board' as const, label: 'Board & Shelf', Icon: ClipboardList },
  { id: 'mirror' as const, label: 'Cermin Cepat', Icon: Camera },
  { id: 'lazytype' as const, label: 'Dikte Offline', Icon: Mic },
  { id: 'screentime' as const, label: 'Screen Time & Sholat', Icon: BarChart3 },
  { id: 'settings' as const, label: '8 Posisi & Tema', Icon: Settings }
];

const FAQ_ITEMS = [
  {
    q: 'Beneran gratis selamanya?',
    a: 'Ya, 100% gratis tanpa iklan dan tanpa wajib login. Fitur AI menggunakan API Key milikmu sendiri (BYOK).'
  },
  {
    q: 'Apakah catatan dan suara saya aman?',
    a: 'Seluruh catatan, To-do, Board, Screen Time, dan dikte suara disimpan dan diproses 100% lokal di browser perangkatmu.'
  },
  {
    q: 'Berat nggak di laptop?',
    a: 'Sangat ringan. Saat tab tidak aktif, animasi otomatis dijeda. Fitur seperti dikte suara dan OCR hanya dimuat saat kamu menyalakannya.'
  },
  {
    q: 'Bisa dipakai tanpa internet?',
    a: 'Bisa. Mencatat, Pomodoro, To-do, Board, White Noise, Lazytype, dan Lazyshot berjalan penuh secara offline.'
  }
];

export const LandingPage: React.FC = () => {
  const {
    setViewMode,
    activePopover,
    setActivePopover,
    startPomodoro,
    togglePlayMusic,
    activeTrack,
    pomodoroRunning,
    setIsLazyshotOpen,
    setIsSupportModalOpen
  } = useMiu();

  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(null);

  const handleTriggerSplitDemo = () => {
    if (!pomodoroRunning) startPomodoro();
    if (!activeTrack.isPlaying) togglePlayMusic();
  };

  return (
    <div className="min-h-screen flex flex-col justify-between pt-28 pb-10 px-4 sm:px-8 max-w-3xl mx-auto">
      {/* Main Centered Minimalist Content */}
      <main className="my-auto space-y-12 text-center py-8">
        {/* Hero */}
        <section className="space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface/80 border border-border-subtle text-xs font-medium text-text-secondary">
            <MiuMascot mood="idle" size={18} />
            <span>Miu • Ruang Fokus Mahasiswa Local-First</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-[-0.03em] leading-[1.12] text-text-primary">
            Satu Notch untuk Mencatat, Fokus, dan Tenang.
          </h1>

          <p className="text-sm sm:text-base text-text-secondary max-w-xl mx-auto leading-relaxed">
            Tanpa sidebar yang memenuhi layar dan tanpa perlu membuat akun. Arahkan kursor ke{' '}
            <strong>Dynamic Island</strong> di atas atau tekan{' '}
            <kbd className="font-mono text-xs px-1.5 py-0.5 rounded bg-surface border border-border-subtle text-text-primary">
              ⌘K
            </kbd>{' '}
            kapan saja.
          </p>

          {/* Primary Actions */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setViewMode('workspace')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-accent-strong text-white dark:text-slate-950 font-bold text-sm shadow-sm hover:opacity-95 transition active:scale-[0.98]"
            >
              Mulai Mencatat
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleTriggerSplitDemo}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-full bg-surface border border-border-subtle text-sm font-medium text-text-primary hover:border-accent-strong transition"
            >
              <Timer className="w-4 h-4 text-rose-500" />
              Simulasi Fokus + Musik
            </button>
          </div>
        </section>

        {/* Interactive Quick-Try Strip (Directly controls the real Dynamic Notch) */}
        <section className="space-y-3">
          <p className="text-xs text-text-secondary">
            Klik fitur di bawah untuk mencobanya langsung di Dynamic Notch:
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {QUICK_TRY_FEATURES.map(({ id, label, Icon }) => {
              const isActive = activePopover === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActivePopover(isActive ? 'none' : id)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium border transition ${
                    isActive
                      ? 'bg-accent-strong text-white dark:text-slate-950 border-accent-strong shadow-sm'
                      : 'bg-surface/80 border-border-subtle text-text-primary hover:border-accent-strong'
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
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium bg-surface/80 border border-border-subtle text-text-primary hover:border-accent-strong transition"
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>Lazyshot OCR</span>
            </button>
          </div>
        </section>

        {/* Simple Minimalist FAQ */}
        <section className="max-w-xl mx-auto text-left pt-4 border-t border-border-subtle">
          <div className="divide-y divide-border-subtle">
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openFaqIdx === idx;
              return (
                <div key={item.q}>
                  <button
                    type="button"
                    onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                    className="w-full py-3.5 flex items-center justify-between text-left text-xs sm:text-sm font-semibold text-text-primary hover:text-accent-strong transition"
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-text-secondary transition-transform ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <p className="pb-3.5 text-xs sm:text-sm text-text-secondary leading-relaxed">
                      {item.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Quiet Minimal Footer */}
      <footer className="pt-6 border-t border-border-subtle flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-text-secondary">
        <span>Miu v2.1 • 100% Lokal &amp; Gratis Selamanya</span>

        <div className="flex items-center gap-4">
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
