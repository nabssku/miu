'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, Lock, Mic, Square, Target, X } from 'lucide-react';
import { useMiu } from '../../../context/MiuContext';
import { db } from '../../../db/database';
import {
  detectLazytypeCapabilities,
  formatDictationTranscript,
  startLazytypeCapture,
  type LazytypeSession
} from '../../../services/lazytypeEngine';
import { findBlockLocation } from '../../../utils/blockTreeHelper';
import { getBlockTypeLabel, isTextEditableBlockType } from '../../../utils/dictationHelper';

export const LazytypePill: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const {
    isLazytypeActive,
    setIsLazytypeActive,
    lazytypeLang,
    setLazytypeLang,
    appendDictationToActiveNote,
    activeBlockTarget,
    setActiveBlockTarget,
    viewMode,
    setViewMode
  } = useMiu();

  const [capabilities] = useState(() => detectLazytypeCapabilities());
  const [interimText, setInterimText] = useState('');
  const [manualText, setManualText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [bars, setBars] = useState<number[]>(Array(10).fill(0.25));

  const sessionRef = useRef<LazytypeSession | null>(null);
  const isMountedRef = useRef(true);
  const appendDictationRef = useRef(appendDictationToActiveNote);
  appendDictationRef.current = appendDictationToActiveNote;
  const viewModeRef = useRef(viewMode);
  viewModeRef.current = viewMode;
  const setViewModeRef = useRef(setViewMode);
  setViewModeRef.current = setViewMode;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const targetNote = useLiveQuery(
    () => (activeBlockTarget?.noteId ? db.notes.get(activeBlockTarget.noteId) : undefined),
    [activeBlockTarget?.noteId]
  );

  const liveTargetMeta = useMemo(() => {
    if (!activeBlockTarget || !targetNote) return null;
    const loc = findBlockLocation(targetNote.blocks, activeBlockTarget.blockId);
    if (!loc) return null;
    const rawPreview =
      activeBlockTarget.field === 'toggleBody'
        ? loc.block.toggleBody || ''
        : loc.block.content || '';
    const trimmed = rawPreview.trim();
    const snippet = trimmed
      ? trimmed.length > 34
        ? `${trimmed.slice(0, 34)}...`
        : trimmed
      : 'blok kosong';
    const isEditable = isTextEditableBlockType(loc.block.type);
    const label = getBlockTypeLabel(loc.block.type);
    return {
      blockId: loc.block.id,
      label:
        loc.block.type === 'toggle' && activeBlockTarget.field === 'toggleBody'
          ? 'Isi Toggle'
          : label,
      snippet,
      isEditable,
      inColumn: loc.container === 'column'
    };
  }, [activeBlockTarget, targetNote]);

  useEffect(() => {
    if (!isLazytypeActive) {
      if (sessionRef.current) {
        sessionRef.current.stop();
        sessionRef.current = null;
      }
      return;
    }

    setErrorMsg('');
    setStatusMsg('');
    setInterimText('');

    const sess = startLazytypeCapture({
      lang: lazytypeLang,
      onInterim: (txt) => {
        if (isMountedRef.current) {
          setInterimText(txt);
        }
      },
      onFinal: (formatted) => {
        if (!formatted) return;
        void (async () => {
          const result = await appendDictationRef.current(formatted);
          if (isMountedRef.current) {
            if (!result.ok && result.error) {
              setErrorMsg(result.error);
            } else if (result.ok) {
              setStatusMsg(
                result.mode === 'updated'
                  ? '✓ Dikirim ke blok yang dipilih'
                  : result.mode === 'inserted_after'
                    ? '✓ Ditambahkan tepat setelah blok terpilih'
                    : '✓ Ditambahkan sebagai blok baru'
              );
            }
            setInterimText('');
          }
          if (result.ok && viewModeRef.current !== 'workspace') {
            setViewModeRef.current('workspace');
          }
        })();
      },
      onEmpty: () => {
        if (isMountedRef.current) {
          setErrorMsg('Tidak ada suara terdeteksi. Pastikan mikrofon aktif lalu coba lagi.');
          setInterimText('');
        }
      },
      onWaveform: (levels) => {
        if (isMountedRef.current) {
          setBars(levels);
        }
      },
      onError: (msg) => {
        if (isMountedRef.current) {
          setErrorMsg(msg);
        }
      }
    });

    sessionRef.current = sess;

    return () => {
      sess.stop();
      if (sessionRef.current === sess) {
        sessionRef.current = null;
      }
    };
  }, [isLazytypeActive, lazytypeLang]);

  const handleManualInsert = async (e: React.FormEvent) => {
    e.preventDefault();
    const formatted = formatDictationTranscript(manualText);
    if (!formatted) return;
    setErrorMsg('');
    const result = await appendDictationToActiveNote(formatted);
    if (!result.ok) {
      setErrorMsg(result.error || 'Gagal mengirim dikte ke catatan.');
      return;
    }
    if (viewMode !== 'workspace') {
      setViewMode('workspace');
    }
    setManualText('');
    onClose?.();
  };

  return (
    <div className="w-full p-3.5 space-y-2.5 text-island-text">
      {/* Voice Waveform & Controls Capsule */}
      <div className="flex items-center justify-between gap-2 bg-violet-500/15 border border-violet-400/35 rounded-2xl px-3 py-2">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setIsLazytypeActive(!isLazytypeActive)}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition shadow ${
              isLazytypeActive
                ? 'bg-violet-500 text-white animate-pulse'
                : 'bg-white/15 text-violet-200 hover:bg-violet-500/40'
            }`}
            title={isLazytypeActive ? 'Stop & Tempel ke Blok' : 'Mulai Rekam Dikte'}
          >
            {isLazytypeActive ? <Square className="w-3.5 h-3.5" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Real-time Audio Waveform Bars */}
          <div className="flex items-center gap-[3px] h-5">
            {bars.map((level, i) => (
              <span
                key={i}
                className="w-[3px] rounded-full bg-violet-400 transition-all duration-75"
                style={{
                  height: `${Math.round((isLazytypeActive ? level : 0.22) * 18) + 3}px`
                }}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/35 border border-white/10 text-[10px] font-mono text-emerald-300">
            <Lock className="w-2.5 h-2.5" />
            {capabilities.hasSpeechApi ? `Speech • ${capabilities.backend}` : 'Ketik Cepat'}
          </span>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setLazytypeLang(lazytypeLang === 'id-ID' ? 'en-US' : 'id-ID')}
            className="px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-[10px] font-semibold transition"
            title="Ganti Bahasa Dikte"
          >
            {lazytypeLang === 'id-ID' ? '🇮🇩 ID' : '🇬🇧 EN'}
          </button>
        </div>
      </div>

      {/* Active Target Block Badge */}
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-white/[0.06] border border-white/10 text-[10px]">
        <div className="flex items-center gap-1.5 min-w-0">
          <Target
            className={`w-3 h-3 shrink-0 ${
              liveTargetMeta ? 'text-violet-300' : 'text-slate-400'
            }`}
          />
          {liveTargetMeta ? (
            <span className="truncate text-violet-100">
              Target: <strong>{liveTargetMeta.label}</strong>
              {liveTargetMeta.inColumn ? ' (Kolom)' : ''} —{' '}
              <span className="text-slate-300">&quot;{liveTargetMeta.snippet}&quot;</span>
            </span>
          ) : (
            <span className="truncate text-slate-300">
              Target: <strong>Akhir catatan</strong> (klik blok dulu untuk isi langsung)
            </span>
          )}
        </div>
        {liveTargetMeta && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setActiveBlockTarget(null)}
            className="p-0.5 rounded hover:bg-white/15 text-slate-300 hover:text-white shrink-0"
            title="Reset target ke akhir catatan"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Live Transcript Preview Box */}
      <div className="miu-island-card rounded-xl px-3 py-2 text-[11px]">
        {isLazytypeActive ? (
          <p className="text-violet-200 leading-relaxed">
            {interimText ||
              'Mendengarkan suaramu... Lepaskan Alt + Space atau klik Stop untuk menempel ke blok terpilih.'}
          </p>
        ) : (
          <p className="text-slate-300 text-[11px] leading-relaxed">
            Tahan <span className="miu-kbd mx-0.5">Alt + Space</span> di blok mana saja untuk dikte
            cepat langsung ke blok yang sedang dipilih.
          </p>
        )}
        {statusMsg && !errorMsg && (
          <p className="text-emerald-300 text-[10px] mt-1 font-medium">{statusMsg}</p>
        )}
        {errorMsg && <p className="text-amber-300 text-[10px] mt-1">{errorMsg}</p>}
      </div>

      {/* Quick Fallback / Clean & Format Text Input */}
      <form onSubmit={handleManualInsert} className="flex gap-1.5">
        <input
          type="text"
          value={manualText}
          onChange={(e) => setManualText(e.target.value)}
          placeholder="Atau ketik cepat untuk tempel ke blok terpilih..."
          className="flex-1 bg-black/35 border border-white/10 rounded-xl px-3 py-1.5 text-[11px] text-white placeholder:text-slate-400 focus:outline-none focus:border-violet-400"
        />
        <button
          type="submit"
          className="px-3 py-1.5 rounded-xl bg-violet-500 hover:bg-violet-400 text-white text-[11px] font-semibold inline-flex items-center gap-1 transition"
          title="Format & Tempel ke Blok Terpilih"
        >
          <Check className="w-3.5 h-3.5" />
          Tempel
        </button>
      </form>
    </div>
  );
};
