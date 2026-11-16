'use client';

import React from 'react';
import { Keyboard, Moon, Sparkles, Sun } from 'lucide-react';
import { useMiu } from '../../../context/MiuContext';
import type { IslandAnchorPosition } from '../../../types/miu';

const ANCHOR_GRID: Array<{
  pos: IslandAnchorPosition | null;
  label: string;
  pillClass: string;
}> = [
  { pos: 'top-left', label: 'Kiri Atas', pillClass: 'top-1.5 left-1.5 w-5 h-1.5' },
  { pos: 'top-center', label: 'Tengah Atas', pillClass: 'top-1.5 left-1/2 -translate-x-1/2 w-6 h-1.5' },
  { pos: 'top-right', label: 'Kanan Atas', pillClass: 'top-1.5 right-1.5 w-5 h-1.5' },
  { pos: 'mid-left', label: 'Kiri Tengah', pillClass: 'top-1/2 -translate-y-1/2 left-1.5 w-1.5 h-5' },
  { pos: null, label: 'Layar', pillClass: '' },
  { pos: 'mid-right', label: 'Kanan Tengah', pillClass: 'top-1/2 -translate-y-1/2 right-1.5 w-1.5 h-5' },
  { pos: 'bottom-left', label: 'Kiri Bawah', pillClass: 'bottom-1.5 left-1.5 w-5 h-1.5' },
  {
    pos: 'bottom-center',
    label: 'Tengah Bawah',
    pillClass: 'bottom-1.5 left-1/2 -translate-x-1/2 w-6 h-1.5'
  },
  { pos: 'bottom-right', label: 'Kanan Bawah', pillClass: 'bottom-1.5 right-1.5 w-5 h-1.5' }
];

export const AnchorSettingsPopover: React.FC = () => {
  const {
    theme,
    setTheme,
    islandPosition,
    setIslandPosition,
    hotkeys,
    setHotkeys,
    pwaUpdateAvailable,
    setPwaUpdateAvailable
  } = useMiu();

  return (
    <div className="w-full p-3.5 space-y-3 text-island-text">
      {/* Dual-Mood Theme Switcher */}
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
          Tema Visual Dual-Mood
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`flex items-center gap-2.5 p-2.5 rounded-2xl border text-left transition ${
              theme === 'light'
                ? 'bg-sky-400/20 border-sky-400 text-sky-100 shadow-sm'
                : 'bg-white/[0.04] border-white/10 text-slate-300 hover:bg-white/10'
            }`}
          >
            <div className="w-7 h-7 rounded-xl bg-[#EBF5FF] border border-[#38BDF8] flex items-center justify-center shrink-0">
              <Sun className="w-4 h-4 text-[#0284C7]" />
            </div>
            <div>
              <p className="text-[11px] font-bold">Sky Blue</p>
              <p className="text-[9px] text-slate-300">Siang &amp; Kuliah</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`flex items-center gap-2.5 p-2.5 rounded-2xl border text-left transition ${
              theme === 'dark'
                ? 'bg-[#F5EFE6]/20 border-[#E6D8C3] text-[#F5EFE6] shadow-sm'
                : 'bg-white/[0.04] border-white/10 text-slate-300 hover:bg-white/10'
            }`}
          >
            <div className="w-7 h-7 rounded-xl bg-[#161412] border border-[#E6D8C3]/60 flex items-center justify-center shrink-0">
              <Moon className="w-4 h-4 text-[#F5EFE6]" />
            </div>
            <div>
              <p className="text-[11px] font-bold">Warm Cream</p>
              <p className="text-[9px] text-slate-300">Fokus Malam</p>
            </div>
          </button>
        </div>
      </div>

      {/* 8-Position Anchor Selector Mini-Map */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Posisi Dynamic Notch (8 Titik)
          </span>
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-sky-400/15 text-sky-300">
            {islandPosition}
          </span>
        </div>

        <div className="bg-black/40 border border-white/15 rounded-2xl p-2 grid grid-cols-3 gap-1.5">
          {ANCHOR_GRID.map((cell, idx) => {
            if (!cell.pos) {
              return (
                <div
                  key={idx}
                  className="h-11 rounded-xl border border-dashed border-white/15 flex items-center justify-center text-[9px] font-mono text-slate-400"
                >
                  Ruang Kerja
                </div>
              );
            }
            const active = islandPosition === cell.pos;
            return (
              <button
                key={cell.pos}
                type="button"
                onClick={() => setIslandPosition(cell.pos!)}
                className={`relative h-11 rounded-xl text-[10px] font-medium transition flex items-center justify-center border ${
                  active
                    ? 'bg-sky-400/20 border-sky-400 text-white shadow-sm'
                    : 'bg-white/[0.05] border-white/[0.08] text-slate-300 hover:bg-white/15'
                }`}
              >
                {/* Miniature visual notch indicator on the edge */}
                <span
                  className={`absolute rounded-full transition-colors ${cell.pillClass} ${
                    active ? 'bg-sky-300 shadow-[0_0_8px_#38BDF8]' : 'bg-white/30'
                  }`}
                />
                <span className="text-[9px] font-mono opacity-85">{cell.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Hotkey Preferences */}
      <div className="miu-island-card rounded-2xl p-2.5 space-y-2">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          <Keyboard className="w-3.5 h-3.5 text-sky-300" />
          <span>Pintasan Keyboard</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 text-[10px]">
          <div className="bg-black/35 border border-white/10 rounded-xl px-2.5 py-1.5 flex items-center justify-between">
            <span className="text-slate-300">Lazytype</span>
            <input
              value={hotkeys.lazytype}
              onChange={(e) => setHotkeys({ ...hotkeys, lazytype: e.target.value })}
              className="w-20 bg-transparent text-right font-mono text-sky-300 focus:outline-none"
            />
          </div>
          <div className="bg-black/35 border border-white/10 rounded-xl px-2.5 py-1.5 flex items-center justify-between">
            <span className="text-slate-300">Lazyshot</span>
            <input
              value={hotkeys.lazyshot}
              onChange={(e) => setHotkeys({ ...hotkeys, lazyshot: e.target.value })}
              className="w-20 bg-transparent text-right font-mono text-sky-300 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Preview PWA Update Pill */}
      <button
        type="button"
        onClick={() => setPwaUpdateAvailable(!pwaUpdateAvailable)}
        className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/15 text-[11px] font-medium text-slate-200 inline-flex items-center justify-center gap-1.5 transition"
      >
        <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
        {pwaUpdateAvailable ? 'Sembunyikan Badge "Update"' : 'Simulasikan Badge PWA "Update"'}
      </button>
    </div>
  );
};
