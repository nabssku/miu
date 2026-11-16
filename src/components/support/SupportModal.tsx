'use client';

import React, { useState } from 'react';
import { Bug, Coffee, ExternalLink, Heart, Send, X } from 'lucide-react';
import { useMiu } from '../../context/MiuContext';

const SAWERIA_URL = 'https://saweria.co/Nabssku';

export const SupportModal: React.FC = () => {
  const { isSupportModalOpen, setIsSupportModalOpen } = useMiu();
  const [bugDesc, setBugDesc] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!isSupportModalOpen) return null;

  const isCoffee = isSupportModalOpen === 'coffee';

  const handleSubmitBug = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bugDesc.trim()) return;
    setSubmitted(true);
    window.setTimeout(() => {
      setSubmitted(false);
      setBugDesc('');
      setIsSupportModalOpen(null);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 no-print">
      <div className="w-full max-w-md miu-card shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isCoffee ? (
              <Coffee className="w-5 h-5 text-amber-500" />
            ) : (
              <Bug className="w-5 h-5 text-rose-500" />
            )}
            <h3 className="text-base font-bold text-text-primary">
              {isCoffee ? '☕ Traktir Kopi biar Miu Makin Rajin' : '🐞 Lapor Bug Miu'}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setIsSupportModalOpen(null)}
            className="p-1.5 rounded-full hover:bg-subtle text-text-secondary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isCoffee ? (
          <div className="space-y-3 text-sm text-text-secondary leading-relaxed">
            <p>
              <strong>Miu 100% gratis selamanya</strong>—tanpa iklan, tanpa paywall, dan tanpa wajib login. Jika Miu membantu produktivitasmu, kamu bisa mendukung pengembangan secara sukarela lewat Saweria!
            </p>
            <a
              href={SAWERIA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-subtle hover:border-amber-500/60 border border-border-subtle rounded-2xl p-4 flex items-center justify-between transition"
            >
              <div>
                <p className="text-xs font-bold text-text-primary">1 Gelas Kopi Susu · Saweria</p>
                <p className="text-[11px] font-mono text-text-secondary">saweria.co/Nabssku</p>
              </div>
              <span className="font-mono font-bold text-amber-500">Rp 15.000</span>
            </a>
            <a
              href={SAWERIA_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setIsSupportModalOpen(null)}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold inline-flex items-center justify-center gap-2 transition"
            >
              <Heart className="w-4 h-4" />
              <span>Traktir Kopi di Saweria</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        ) : submitted ? (
          <div className="py-6 text-center text-sm font-medium text-emerald-500">
            ✓ Laporan tersimpan lokal! Terima kasih sudah membantu menyempurnakan Miu.
          </div>
        ) : (
          <form onSubmit={handleSubmitBug} className="space-y-3">
            <p className="text-xs text-text-secondary">
              Ceritakan kendala yang kamu temui (browser, posisi Dynamic Island, atau fitur terkait):
            </p>
            <textarea
              rows={4}
              value={bugDesc}
              onChange={(e) => setBugDesc(e.target.value)}
              placeholder="Contoh: Saat posisi Dynamic Island di Bottom-Right..."
              className="w-full bg-subtle border border-border-subtle rounded-xl p-3 text-xs text-text-primary focus:outline-none"
            />
            <button
              type="submit"
              className="w-full py-2 rounded-xl bg-accent-strong text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              Kirim Laporan
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
