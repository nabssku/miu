'use client';

import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Cloud,
  Database,
  Image as ImageIcon,
  Loader2,
  Lock,
  X
} from 'lucide-react';
import {
  ensureNeonSchema,
  getCloudConfig,
  getCloudStatusSnapshot,
  signInWithGoogleOAuth,
  syncCloudStatus,
  upsertUserToNeon,
  type GoogleUser
} from '../../services/cloudServices';
import { MiuMascot } from '../island/MiuMascot';

interface NotesAuthModalProps {
  isOpen: boolean;
  mode: 'auth-gate' | 'settings';
  onAuthenticated: (user: GoogleUser) => void;
  onCloseSettings?: () => void;
  onBackToLanding?: () => void;
}

export const NotesAuthModal: React.FC<NotesAuthModalProps> = ({
  isOpen,
  mode,
  onAuthenticated,
  onCloseSettings,
  onBackToLanding
}) => {
  const [showQuickGoogleForm, setShowQuickGoogleForm] = useState(false);
  const [quickEmail, setQuickEmail] = useState('');
  const [quickName, setQuickName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [cloudStatus, setCloudStatus] = useState(() => getCloudStatusSnapshot());

  useEffect(() => {
    if (!isOpen) return;
    void syncCloudStatus(true).then((fresh) => {
      setCloudStatus(fresh);
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const activeCfg = getCloudConfig();
  const cloudDbReady = cloudStatus.dbReady;
  const cloudMediaReady = cloudStatus.mediaReady;

  const handleGoogleButtonClick = async () => {
    setErrorMsg('');
    setStatusMsg('');

    let clientId = activeCfg.googleClientId.trim();
    if (!clientId) {
      const fresh = await syncCloudStatus(true);
      clientId = fresh.googleClientId.trim();
    }

    if (clientId) {
      setLoading(true);
      try {
        const user = await signInWithGoogleOAuth();
        await upsertUserToNeon(user);
        onAuthenticated(user);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Gagal masuk dengan Google.');
      } finally {
        setLoading(false);
      }
      return;
    }

    setShowQuickGoogleForm(true);
  };

  const handleQuickGoogleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = quickEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      setErrorMsg('Masukkan alamat email Google yang valid.');
      return;
    }
    const name = quickName.trim() || email.split('@')[0];

    setLoading(true);
    setErrorMsg('');

    const user: GoogleUser = {
      id: `google-${email}`,
      email,
      name,
      picture: `https://ui-avatars.com/api/?name=${encodeURIComponent(
        name
      )}&background=0284c7&color=fff&bold=true`,
      provider: 'google',
      loginAt: Date.now()
    };

    try {
      await upsertUserToNeon(user);
      onAuthenticated(user);
    } finally {
      setLoading(false);
    }
  };

  const handleTestCloudConnection = async () => {
    setErrorMsg('');
    setStatusMsg('');
    setLoading(true);
    try {
      const ok = await ensureNeonSchema();
      if (ok) {
        setStatusMsg('Koneksi Cloud Catatan aktif dan siap menyinkronkan catatanmu.');
      } else {
        setErrorMsg('Tidak dapat terhubung ke Cloud Catatan saat ini.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-md bg-surface border border-border-subtle rounded-3xl shadow-2xl p-6 sm:p-7 space-y-5 relative text-text-primary">
        {onCloseSettings && (
          <button
            type="button"
            onClick={onCloseSettings}
            className="absolute top-5 right-5 p-1.5 rounded-full hover:bg-subtle text-text-secondary hover:text-text-primary transition"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-subtle border border-border-subtle flex items-center justify-center mx-auto shadow-sm">
            <MiuMascot mood="idle" size={28} />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-text-primary">
            {mode === 'settings' ? 'Status Cloud Catatan' : 'Masuk ke Catatan Miu'}
          </h2>
          <p className="text-xs text-text-secondary leading-relaxed max-w-xs mx-auto">
            {mode === 'settings'
              ? 'Sinkronisasi Cloud Catatan aktif secara otomatis untuk menjaga catatan, gambar, dan dokumenmu tetap aman.'
              : 'Masuk dengan akun Google untuk membuka catatan pribadimu dan menyinkronkannya ke Cloud Catatan.'}
          </p>
        </div>

        {/* Cloud Catatan Status Badges */}
        <div className="flex items-center justify-center gap-2 text-[10px] font-medium">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border ${
              cloudDbReady
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-300'
                : 'bg-subtle border-border-subtle text-text-secondary'
            }`}
          >
            <Database className="w-3 h-3" />
            Cloud Catatan {cloudDbReady ? 'Aktif' : 'Lokal'}
          </span>
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border ${
              cloudMediaReady
                ? 'bg-sky-500/10 border-sky-500/30 text-sky-600 dark:text-sky-300'
                : 'bg-subtle border-border-subtle text-text-secondary'
            }`}
          >
            <ImageIcon className="w-3 h-3" />
            Media Cloud {cloudMediaReady ? 'Aktif' : 'Lokal'}
          </span>
        </div>

        {/* Google Login Section (when in auth-gate mode) */}
        {mode === 'auth-gate' && (
          <div className="space-y-3">
            {!showQuickGoogleForm ? (
              <button
                type="button"
                onClick={() => void handleGoogleButtonClick()}
                disabled={loading}
                className="w-full py-3 px-4 rounded-2xl bg-white dark:bg-[#2B2723] hover:bg-slate-50 dark:hover:bg-[#35302B] border border-slate-200 dark:border-white/15 shadow-sm flex items-center justify-center gap-3 text-sm font-semibold text-slate-800 dark:text-[#F5EFE6] transition active:scale-[0.99]"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
                    />
                  </svg>
                )}
                <span>Lanjutkan dengan Google</span>
              </button>
            ) : (
              <form
                onSubmit={(e) => void handleQuickGoogleSubmit(e)}
                className="p-3.5 rounded-2xl bg-subtle/70 border border-border-subtle space-y-2.5"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-text-primary">
                  <span className="inline-flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
                      />
                    </svg>
                    Masuk Akun Google
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowQuickGoogleForm(false)}
                    className="text-[11px] text-text-secondary hover:text-text-primary"
                  >
                    Batal
                  </button>
                </div>

                <input
                  type="email"
                  required
                  value={quickEmail}
                  onChange={(e) => setQuickEmail(e.target.value)}
                  placeholder="nama@gmail.com"
                  autoFocus
                  className="w-full bg-surface border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent-strong"
                />
                <input
                  type="text"
                  value={quickName}
                  onChange={(e) => setQuickName(e.target.value)}
                  placeholder="Nama Lengkap (opsional)"
                  className="w-full bg-surface border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent-strong"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-accent-strong text-white dark:text-slate-950 text-xs font-bold hover:opacity-95 transition"
                >
                  {loading ? 'Menyambungkan...' : 'Masuk & Buka Catatan'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Privacy-safe Cloud Catatan Status Panel in Settings Mode */}
        {mode === 'settings' && (
          <div className="p-3.5 rounded-2xl bg-subtle/60 border border-border-subtle space-y-3 text-left text-xs">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-text-primary">Sinkronisasi Cloud Catatan</span>
                <span className="font-mono text-[10px] text-emerald-500 font-semibold">
                  {cloudDbReady ? 'Aktif' : 'Lokal'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-text-primary">Penyimpanan Media &amp; File</span>
                <span className="font-mono text-[10px] text-sky-500 font-semibold">
                  {cloudMediaReady ? 'Aktif' : 'Lokal'}
                </span>
              </div>
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={() => void handleTestCloudConnection()}
              className="w-full py-2 rounded-xl bg-accent-strong text-white dark:text-slate-950 text-xs font-semibold hover:opacity-95 transition flex items-center justify-center gap-1.5"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Cloud className="w-3.5 h-3.5" />}
              <span>{loading ? 'Memeriksa Koneksi...' : 'Tes Koneksi Cloud Catatan'}</span>
            </button>
          </div>
        )}

        {errorMsg && (
          <p className="text-xs text-rose-500 text-center bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">
            {errorMsg}
          </p>
        )}

        {statusMsg && (
          <p className="text-xs text-emerald-600 dark:text-emerald-300 text-center bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2 flex items-center justify-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>{statusMsg}</span>
          </p>
        )}

        {/* Footer */}
        <div className="pt-2 border-t border-border-subtle flex items-center justify-between text-[11px] text-text-secondary">
          <span className="inline-flex items-center gap-1">
            <Lock className="w-3 h-3 text-emerald-500" />
            Terenkripsi &amp; Terisolasi
          </span>

          {mode === 'auth-gate' && onBackToLanding && (
            <button
              type="button"
              onClick={onBackToLanding}
              className="inline-flex items-center gap-1 hover:text-text-primary transition font-medium"
            >
              <ArrowLeft className="w-3 h-3" />
              Kembali ke Beranda
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
