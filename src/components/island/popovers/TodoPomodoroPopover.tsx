'use client';

import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Check,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Target,
  Timer,
  Trash2
} from 'lucide-react';
import { db } from '../../../db/database';
import { useMiu, type PomodoroPhase } from '../../../context/MiuContext';
import { formatTimerMMSS } from '../../../utils/formatters';

export const TodoPomodoroPopover: React.FC = () => {
  const {
    activeCourseId,
    activeNoteId,
    pomodoroPhase,
    pomodoroSeconds,
    pomodoroTotalSeconds,
    pomodoroRunning,
    pomodoroCustomMinutes,
    setPomodoroPhaseMinutes,
    linkedTodoId,
    setLinkedTodoId,
    startPomodoro,
    pausePomodoro,
    resetPomodoro
  } = useMiu();

  const [newTodoText, setNewTodoText] = useState('');
  const [targetPomos, setTargetPomos] = useState(2);
  const [showCustomTime, setShowCustomTime] = useState(false);

  const todos = useLiveQuery(() => db.todos.orderBy('createdAt').reverse().toArray(), [], []);
  const linkedTodo = todos.find((t) => t.id === linkedTodoId);

  const progressPct = Math.round(
    ((pomodoroTotalSeconds - pomodoroSeconds) / Math.max(1, pomodoroTotalSeconds)) * 100
  );

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoText.trim()) return;
    const id = `todo-${Date.now()}`;
    await db.todos.add({
      id,
      courseId: activeCourseId,
      noteId: activeNoteId,
      text: newTodoText.trim(),
      completed: false,
      targetPomodoros: targetPomos,
      completedPomodoros: 0,
      createdAt: Date.now()
    });
    setNewTodoText('');
    setLinkedTodoId(id);
  };

  const toggleTodo = async (id: string, completed: boolean) => {
    await db.todos.update(id, { completed: !completed });
  };

  const deleteTodo = async (id: string) => {
    await db.todos.delete(id);
    if (linkedTodoId === id) setLinkedTodoId(null);
  };

  const phases: Array<{ id: PomodoroPhase; label: string }> = [
    { id: 'focus', label: `Fokus ${pomodoroCustomMinutes.focus}m` },
    { id: 'short-break', label: `Jeda ${pomodoroCustomMinutes['short-break']}m` },
    { id: 'long-break', label: `Istirahat ${pomodoroCustomMinutes['long-break']}m` }
  ];

  const adjustCurrentPhaseMinutes = (delta: number) => {
    const currentMins = pomodoroCustomMinutes[pomodoroPhase] || 25;
    setPomodoroPhaseMinutes(pomodoroPhase, currentMins + delta);
  };

  return (
    <div className="w-full p-3.5 space-y-3 text-island-text">
      {/* Phase Switcher Segmented Control */}
      <div className="flex items-center justify-between gap-1 bg-black/30 border border-white/10 p-1 rounded-xl">
        {phases.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => resetPomodoro(p.id)}
            className={`flex-1 py-1.5 text-[11px] font-semibold rounded-lg transition-all ${
              pomodoroPhase === p.id
                ? 'bg-rose-500 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Countdown & Controls Card */}
      <div
        className="miu-island-card rounded-2xl p-3.5 space-y-2.5"
        style={{
          background: pomodoroRunning
            ? 'radial-gradient(circle at top right, rgba(244, 63, 94, 0.16), rgba(255, 255, 255, 0.04))'
            : undefined
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-rose-300 uppercase tracking-wider">
              <Timer className="w-3 h-3" />
              <span>{pomodoroRunning ? 'Timer Berjalan' : 'Klik Waktu untuk Ubah'}</span>
            </div>

            <div className="flex items-center gap-2 mt-0.5">
              <button
                type="button"
                onClick={() => setShowCustomTime((v) => !v)}
                className="font-mono text-3xl font-bold tracking-tight tabular-nums text-white hover:text-rose-300 transition text-left"
                title="Klik untuk kustomisasi durasi waktu Pomodoro"
              >
                {formatTimerMMSS(pomodoroSeconds)}
              </button>

              {/* Quick -5m / +5m Stepper */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => adjustCurrentPhaseMinutes(-5)}
                  className="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 flex items-center justify-center text-[10px] font-mono transition"
                  title="Kurangi 5 menit"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => adjustCurrentPhaseMinutes(5)}
                  className="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 flex items-center justify-center text-[10px] font-mono transition"
                  title="Tambah 5 menit"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={pomodoroRunning ? pausePomodoro : startPomodoro}
              className="w-11 h-11 rounded-full bg-rose-500 hover:bg-rose-400 text-white flex items-center justify-center shadow-[0_0_20px_rgba(244,63,94,0.4)] transition-transform active:scale-95"
              aria-label={pomodoroRunning ? 'Pause Pomodoro' : 'Start Pomodoro'}
            >
              {pomodoroRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>
            <button
              type="button"
              onClick={() => resetPomodoro()}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-200 flex items-center justify-center transition"
              aria-label="Reset Pomodoro"
              title="Reset Timer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setShowCustomTime((v) => !v)}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition ${
                showCustomTime
                  ? 'bg-rose-500/25 border border-rose-400/50 text-rose-200'
                  : 'bg-white/10 hover:bg-white/20 text-slate-200'
              }`}
              title="Kustomisasi Durasi Pomodoro (Menit)"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Custom Minutes Editor (Fokus, Jeda Pendek, Istirahat Panjang) */}
        {showCustomTime && (
          <div className="pt-2 border-t border-white/10 grid grid-cols-3 gap-2">
            {[
              { id: 'focus' as PomodoroPhase, label: 'Fokus (m)' },
              { id: 'short-break' as PomodoroPhase, label: 'Jeda (m)' },
              { id: 'long-break' as PomodoroPhase, label: 'Istirahat (m)' }
            ].map((item) => (
              <div key={item.id} className="bg-black/35 border border-white/10 rounded-xl p-2">
                <label className="block text-[9px] uppercase tracking-wider text-slate-400 mb-1">
                  {item.label}
                </label>
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={pomodoroCustomMinutes[item.id]}
                  onChange={(e) => setPomodoroPhaseMinutes(item.id, Number(e.target.value))}
                  className="w-full bg-transparent font-mono text-xs font-bold text-white focus:outline-none"
                />
              </div>
            ))}
          </div>
        )}

        {/* Progress Bar + Active Linked Task Pill */}
        <div className="space-y-1.5">
          <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-rose-500 to-amber-400 transition-all duration-300"
              style={{ width: `${Math.max(4, progressPct)}%` }}
            />
          </div>

          {linkedTodo && (
            <div className="flex items-center justify-between text-[11px] text-slate-300 pt-0.5">
              <span className="inline-flex items-center gap-1.5 truncate">
                <Target className="w-3 h-3 text-rose-400 shrink-0" />
                <span className="truncate">{linkedTodo.text}</span>
              </span>
              <span className="font-mono text-[10px] text-amber-300 shrink-0 ml-2">
                {linkedTodo.completedPomodoros}/{linkedTodo.targetPomodoros} 🍅
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Quick To-do Checklist */}
      <div>
        <div className="flex items-center justify-between text-[11px] text-slate-300 mb-2">
          <span className="font-semibold uppercase tracking-wider text-[10px] text-slate-400">
            Daftar Tugas &amp; Target Fokus
          </span>
          <span className="font-mono text-[10px] text-sky-300">
            {todos.filter((t) => !t.completed).length} aktif
          </span>
        </div>

        <form onSubmit={handleAddTodo} className="flex items-center gap-1.5 mb-2.5">
          <input
            type="text"
            value={newTodoText}
            onChange={(e) => setNewTodoText(e.target.value)}
            placeholder="Tambah target belajar..."
            className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-sky-400"
          />
          <select
            value={targetPomos}
            onChange={(e) => setTargetPomos(Number(e.target.value))}
            className="bg-black/30 border border-white/10 rounded-xl px-2 py-1.5 text-[11px] font-mono text-amber-200 focus:outline-none"
            title="Estimasi Sesi Pomodoro"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n} className="bg-slate-900">
                {n}🍅
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="p-1.5 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 font-bold transition shrink-0"
            aria-label="Tambah To-do"
          >
            <Plus className="w-4 h-4" />
          </button>
        </form>

        <div className="max-h-36 overflow-y-auto space-y-1.5 pr-0.5">
          {todos.map((todo) => {
            const isLinked = linkedTodoId === todo.id;
            return (
              <div
                key={todo.id}
                onClick={() => setLinkedTodoId(todo.id)}
                className={`group flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs cursor-pointer transition border ${
                  isLinked
                    ? 'bg-rose-500/15 border-rose-400/40'
                    : 'bg-white/[0.04] border-white/[0.06] hover:bg-white/[0.09]'
                }`}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void toggleTodo(todo.id, todo.completed);
                  }}
                  className={`w-4 h-4 rounded-[5px] flex items-center justify-center shrink-0 border transition ${
                    todo.completed
                      ? 'bg-emerald-400 border-emerald-400 text-slate-950'
                      : 'border-slate-400 hover:border-white'
                  }`}
                >
                  {todo.completed && <Check className="w-3 h-3 stroke-[3]" />}
                </button>
                <span
                  className={`flex-1 truncate ${
                    todo.completed ? 'line-through text-slate-400' : 'text-slate-100 font-medium'
                  }`}
                >
                  {todo.text}
                </span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/30 text-amber-300 shrink-0">
                  {todo.completedPomodoros}/{todo.targetPomodoros}🍅
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void deleteTodo(todo.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-400 transition"
                  aria-label="Hapus To-do"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
