'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CameraOff, FlipHorizontal, ShieldCheck, Sun } from 'lucide-react';

export const QuickMirrorPopover: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [ringLight, setRingLight] = useState(true);
  const [mirrored, setMirrored] = useState(true);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let active = true;

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setErrorMsg('Browser tidak mendukung akses kamera lokal.');
          return;
        }
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch {
        if (active) {
          setErrorMsg('Izin kamera belum diberikan. Cek pengaturan izin kamera di browsermu.');
        }
      }
    })();

    // Zero-Recording Guarantee: immediately stop hardware tracks when popover closes
    return () => {
      active = false;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className="w-full p-3.5 space-y-3 text-island-text">
      {/* Squircle preview with optional warm screen ring-light */}
      <div
        className={`relative w-full h-[196px] rounded-[22px] overflow-hidden bg-slate-950 flex items-center justify-center transition-all ${
          ringLight
            ? 'ring-[5px] ring-[#F5EFE6]/95 shadow-[0_0_28px_rgba(245,239,230,0.45)]'
            : 'border border-white/15'
        }`}
      >
        {/* Top Live Privacy Pill */}
        <span className="absolute top-2.5 left-2.5 z-10 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/55 backdrop-blur-md border border-white/15 text-[10px] font-medium text-emerald-300">
          <ShieldCheck className="w-3 h-3" />
          Lokal • Zero-Record
        </span>

        {errorMsg ? (
          <div className="p-4 text-center space-y-2 max-w-[230px]">
            <CameraOff className="w-6 h-6 text-slate-400 mx-auto" />
            <p className="text-[11px] text-slate-300 leading-relaxed">{errorMsg}</p>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${mirrored ? '-scale-x-100' : ''}`}
          />
        )}
      </div>

      {/* Mirror Controls */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setRingLight((v) => !v)}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-semibold transition ${
            ringLight
              ? 'bg-amber-200 text-slate-950 shadow-sm'
              : 'bg-white/10 text-slate-200 hover:bg-white/15'
          }`}
        >
          <Sun className="w-3.5 h-3.5" />
          {ringLight ? 'Ring Light Aktif' : 'Nyalakan Ring Light'}
        </button>
        <button
          type="button"
          onClick={() => setMirrored((v) => !v)}
          className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-[11px] font-medium text-slate-200 inline-flex items-center gap-1.5 transition"
          title="Balik Cermin Horizontal"
        >
          <FlipHorizontal className="w-3.5 h-3.5" />
          Flip
        </button>
      </div>
    </div>
  );
};
