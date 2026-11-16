'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, Lock, Mic, Square } from 'lucide-react';
import { useMiu } from '../../../context/MiuContext';
import {
  detectLazytypeCapabilities,
  formatDictationTranscript,
  startLazytypeCapture,
  type LazytypeSession
} from '../../../services/lazytypeEngine';

export const LazytypePill: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const {
    isLazytypeActive,
    setIsLazytypeActive,
    lazytypeLang,
    setLazytypeLang,
    appendDictationToActiveNote,
    setViewMode
  } = useMiu();

  const [capabilities] = useState(() => detectLazytypeCapabilities());
  const [interimText, setInterimText] = useState('');
  const [manualText, setManualText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [bars, setBars] = useState<number[]>(Array(10).fill(0.25));
  const sessionRef = useRef<LazytypeSession | null>(null);

  useEffect(() => {
    if (!isLazytypeActive) {
      sessionRef.current?.stop();
      sessionRef.current = null;
      return;
    }

    let cancelled = false;
    setErrorMsg('');
    setInterimText('');

    startLazytypeCapture({
      lang: lazytypeLang,
      onInterim: (txt) => {
        if (!cancelled) setInterimText(txt);
      },
      onFinal: async (formatted) => {
        if (!cancelled && formatted) {
          setViewMode('workspace');
          await appendDictationToActiveNote(formatted);
        }
      },
      onWaveform: (levels) => {
        if (!cancelled) setBars(levels);
      },
      onError: (msg) => {
        if (!cancelled) setErrorMsg(msg);
      }
    }).then((sess) => {
      if (cancelled) sess.stop();
      else sessionRef.current = sess;
    });

    return () => {
      cancelled = true;
      sessionRef.current?.stop();
      sessionRef.current = null;
    };
  }, [isLazytypeActive, lazytypeLang, appendDictationToActiveNote, setViewMode]);

  const handleManualInsert = async (e: React.FormEvent) => {
    e.preventDefault();
    const formatted = formatDictationTranscript(manualText);
    if (!formatted) return;
    setViewMode('workspace');
    await appendDictationToActiveNote(formatted);
    setManualText('');
    onClose?.();
  };

  return (
    <div className="w-full p-3.5 space-y-3 text-island-text">
      {/* Voice Waveform & Controls Capsule */}
      <div className="flex items-center justify-between gap-2 bg-violet-500/15 border border-violet-400/35 rounded-2xl px-3 py-2">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsLazytypeActive(!isLazytypeActive)}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition shadow ${
              isLazytypeActive
                ? 'bg-violet-500 text-white animate-pulse'
                : 'bg-white/15 text-violet-200 hover:bg-violet-500/40'
            }`}
            title={isLazytypeActive ? 'Stop & Tempel ke Catatan' : 'Mulai Rekam Dikte'}
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
            Offline • {capabilities.backend}
          </span>
          <button
            type="button"
            onClick={() => setLazytypeLang(lazytypeLang === 'id-ID' ? 'en-US' : 'id-ID')}
            className="px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-[10px] font-semibold transition"
            title="Ganti Bahasa Dikte"
          >
            {lazytypeLang === 'id-ID' ? '🇮🇩 ID' : '🇬🇧 EN'}
          </button>
        </div>
      </div>

      {/* Live Transcript Preview Box */}
      <div className="miu-island-card rounded-xl px-3 py-2 text-[11px]">
        {isLazytypeActive ? (
          <p className="text-violet-200 leading-relaxed">
            {interimText ||
              'Mendengarkan suaramu... Lepaskan Alt + Space atau klik Stop untuk menempel ke catatan.'}
          </p>
        ) : (
          <p className="text-slate-300 text-[11px] leading-relaxed">
            Tahan <span className="miu-kbd mx-0.5">Alt + Space</span> di mana saja untuk dikte cepat
            Indo/English langsung ke blok catatan aktif.
          </p>
        )}
        {errorMsg && <p className="text-amber-300 text-[10px] mt-1">{errorMsg}</p>}
      </div>

      {/* Quick Fallback / Clean & Format Text Input */}
      <form onSubmit={handleManualInsert} className="flex gap-1.5">
        <input
          type="text"
          value={manualText}
          onChange={(e) => setManualText(e.target.value)}
          placeholder="Atau ketik cepat untuk auto-format ke catatan..."
          className="flex-1 bg-black/35 border border-white/10 rounded-xl px-3 py-1.5 text-[11px] text-white placeholder:text-slate-400 focus:outline-none focus:border-violet-400"
        />
        <button
          type="submit"
          className="px-3 py-1.5 rounded-xl bg-violet-500 hover:bg-violet-400 text-white text-[11px] font-semibold inline-flex items-center gap-1 transition"
          title="Format & Tempel ke Catatan"
        >
          <Check className="w-3.5 h-3.5" />
          Tempel
        </button>
      </form>
    </div>
  );
};
