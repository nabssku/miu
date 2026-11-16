'use client';

import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Bug, Coffee, Droplets, Moon, PersonStanding } from 'lucide-react';
import { db } from '../../../db/database';
import { useMiu } from '../../../context/MiuContext';
import { INDONESIA_CITIES } from '../../../services/externalApis';
import { formatDurationHM, formatTimerMMSS } from '../../../utils/formatters';

export const RemindersScreenTimePopover: React.FC = () => {
  const {
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
    triggerDemoReminder,
    setIsSupportModalOpen
  } = useMiu();

  const courses = useLiveQuery(() => db.courses.toArray(), [], []);
  const logs = useLiveQuery(() => db.screenTimeLogs.toArray(), [], []);

  // Build 7-day chart summary
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const iso = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('id-ID', { weekday: 'short' }).slice(0, 3);
    const dayLogs = logs.filter((l) => l.date === iso);
    const totalSeconds = dayLogs.reduce((acc, l) => acc + l.activeSeconds, 0);
    return { iso, label, totalSeconds, isToday: i === 6 };
  });

  const maxSec = Math.max(3600, ...days.map((d) => d.totalSeconds));

  const perCourseTotals = courses.map((course) => {
    const secs = logs
      .filter((l) => l.courseId === course.id)
      .reduce((acc, l) => acc + l.activeSeconds, 0);
    return { ...course, secs };
  });

  return (
    <div className="w-full p-3.5 space-y-3 text-island-text">
      {/* Screen Time 7-Day Bar Chart */}
      <div className="miu-island-card rounded-2xl p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-white">Analitik Belajar 7 Hari</span>
          <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-sky-400/15 text-sky-300">
            Total: {formatDurationHM(days.reduce((a, b) => a + b.totalSeconds, 0))}
          </span>
        </div>

        <div className="flex items-end justify-between gap-2 h-20 pt-2">
          {days.map((d) => {
            const pct = Math.max(12, Math.round((d.totalSeconds / maxSec) * 100));
            return (
              <div key={d.iso} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end justify-center h-14 bg-black/25 rounded-lg p-1">
                  <div
                    className={`w-full rounded-md transition-all ${
                      d.isToday
                        ? 'bg-gradient-to-t from-sky-500 to-cyan-300 shadow-[0_0_10px_rgba(56,189,248,0.4)]'
                        : 'bg-sky-400/55'
                    }`}
                    style={{ height: `${pct}%` }}
                    title={`${d.label}: ${formatDurationHM(d.totalSeconds)}`}
                  />
                </div>
                <span
                  className={`text-[10px] font-mono ${
                    d.isToday ? 'text-sky-300 font-bold' : 'text-slate-400'
                  }`}
                >
                  {d.label}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-white/10">
          {perCourseTotals.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full bg-black/30 border border-white/10 text-slate-200"
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
              <span>{c.code}</span>
              <span className="font-mono text-sky-300">{formatDurationHM(c.secs)}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Health Reminders: Custom Toggle Switches for Minum & Gerak */}
      <div className="grid grid-cols-2 gap-2">
        <div className="miu-island-card rounded-2xl p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-sky-300">
              <Droplets className="w-3.5 h-3.5" />
              Minum (60m)
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={hydrationEnabled}
              onClick={() => setHydrationEnabled(!hydrationEnabled)}
              className={`w-8 h-4.5 rounded-full p-0.5 transition-colors flex items-center ${
                hydrationEnabled ? 'bg-sky-400 justify-end' : 'bg-white/15 justify-start'
              }`}
            >
              <span className="w-3.5 h-3.5 rounded-full bg-slate-950 shadow" />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-semibold text-slate-200 tabular-nums">
              {formatTimerMMSS(hydrationCountdownSec)}
            </span>
            <button
              type="button"
              onClick={() => triggerDemoReminder('hydration')}
              className="text-[10px] px-1.5 py-0.5 rounded bg-sky-400/15 text-sky-300 hover:bg-sky-400/25 transition"
            >
              Tes Notif
            </button>
          </div>
        </div>

        <div className="miu-island-card rounded-2xl p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-teal-300">
              <PersonStanding className="w-3.5 h-3.5" />
              Gerak (45m)
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={stretchEnabled}
              onClick={() => setStretchEnabled(!stretchEnabled)}
              className={`w-8 h-4.5 rounded-full p-0.5 transition-colors flex items-center ${
                stretchEnabled ? 'bg-teal-400 justify-end' : 'bg-white/15 justify-start'
              }`}
            >
              <span className="w-3.5 h-3.5 rounded-full bg-slate-950 shadow" />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-semibold text-slate-200 tabular-nums">
              {formatTimerMMSS(stretchCountdownSec)}
            </span>
            <button
              type="button"
              onClick={() => triggerDemoReminder('stretch')}
              className="text-[10px] px-1.5 py-0.5 rounded bg-teal-400/15 text-teal-300 hover:bg-teal-400/25 transition"
            >
              Tes Notif
            </button>
          </div>
        </div>
      </div>

      {/* Prayer Times (Kemenag / Aladhan + Offline Monthly Cache) */}
      <div className="bg-amber-500/10 border border-amber-400/25 rounded-2xl p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-200">
            <Moon className="w-3.5 h-3.5 text-amber-300" />
            <span>
              Berikutnya: <strong>{nextPrayer.name}</strong> ({nextPrayer.time})
            </span>
          </div>
          <select
            value={prayerCity}
            onChange={(e) => setPrayerCity(e.target.value)}
            className="bg-black/35 border border-white/10 rounded-lg px-2 py-0.5 text-[10px] font-medium text-amber-100 focus:outline-none"
          >
            {INDONESIA_CITIES.map((c) => (
              <option key={c} value={c} className="bg-slate-900">
                {c}
              </option>
            ))}
          </select>
        </div>
        {prayerTimings && (
          <div className="grid grid-cols-5 gap-1 pt-0.5">
            {[
              { label: 'Subuh', time: prayerTimings.Fajr },
              { label: 'Dzuhur', time: prayerTimings.Dhuhr },
              { label: 'Ashar', time: prayerTimings.Asr },
              { label: 'Maghrib', time: prayerTimings.Maghrib },
              { label: 'Isya', time: prayerTimings.Isha }
            ].map((p) => {
              const isNext = nextPrayer.name === p.label;
              return (
                <div
                  key={p.label}
                  className={`rounded-lg py-1 px-1 text-center font-mono ${
                    isNext
                      ? 'bg-amber-400 text-slate-950 font-bold'
                      : 'bg-black/25 text-slate-300'
                  }`}
                >
                  <div className="text-[9px] font-sans opacity-80">{p.label}</div>
                  <div className="text-[10px]">{p.time}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Community Actions: Traktir Kopi & Lapor Bug */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsSupportModalOpen('coffee')}
          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 border border-amber-300/30 text-amber-200 text-[11px] font-semibold transition"
        >
          <Coffee className="w-3.5 h-3.5" />
          Traktir Kopi Miu
        </button>
        <button
          type="button"
          onClick={() => setIsSupportModalOpen('bug')}
          className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-[11px] font-medium inline-flex items-center gap-1.5 transition"
        >
          <Bug className="w-3.5 h-3.5" />
          Lapor Bug
        </button>
      </div>
    </div>
  );
};
