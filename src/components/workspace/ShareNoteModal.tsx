'use client';

import React, { useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Eye,
  Globe,
  Lock,
  MailPlus,
  MessageSquare,
  Pencil,
  Printer,
  Share2,
  Trash2,
  UserPlus,
  X
} from 'lucide-react';
import type { NoteRecord, NoteShareSettings, SharePermission } from '../../types/miu';

interface ShareNoteModalProps {
  note: NoteRecord;
  isOwner: boolean;
  showCommentsPanel?: boolean;
  onToggleCommentsPanel?: () => void;
  onExportMarkdown?: () => void;
  onPrintPdf?: () => void;
  onUpdateShareSettings: (settings: NoteShareSettings) => Promise<void>;
  onClose: () => void;
}

const ROLE_OPTIONS: Array<{
  id: SharePermission;
  label: string;
  desc: string;
  Icon: React.FC<{ className?: string }>;
}> = [
  {
    id: 'view',
    label: 'Hanya Lihat',
    desc: 'Hanya dapat membaca catatan tanpa mengubah isi',
    Icon: Eye
  },
  {
    id: 'comment',
    label: 'Pemberi Komentar',
    desc: 'Dapat membaca dan menulis komentar pada catatan',
    Icon: MessageSquare
  },
  {
    id: 'edit',
    label: 'Bisa Diedit',
    desc: 'Dapat mengedit isi blok, subhalaman, dan memberi komentar',
    Icon: Pencil
  }
];

export const ShareNoteModal: React.FC<ShareNoteModalProps> = ({
  note,
  isOwner,
  showCommentsPanel = false,
  onToggleCommentsPanel,
  onExportMarkdown,
  onPrintPdf,
  onUpdateShareSettings,
  onClose
}) => {
  const currentSettings: NoteShareSettings = note.shareSettings || {
    isPublicLink: false,
    publicRole: 'view',
    collaborators: []
  };

  const [emailInput, setEmailInput] = useState('');
  const [inviteRole, setInviteRole] = useState<SharePermission>('view');
  const [copiedLink, setCopiedLink] = useState(false);

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/app?share=${encodeURIComponent(note.id)}`
      : `/app?share=${encodeURIComponent(note.id)}`;

  const handleTogglePublicLink = async () => {
    if (!isOwner) return;
    await onUpdateShareSettings({
      ...currentSettings,
      isPublicLink: !currentSettings.isPublicLink
    });
  };

  const handleChangePublicRole = async (role: SharePermission) => {
    if (!isOwner) return;
    await onUpdateShareSettings({
      ...currentSettings,
      publicRole: role
    });
  };

  const handleInviteEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) return;
    const email = emailInput.trim().toLowerCase();
    if (!email || !email.includes('@')) return;

    const existingIdx = currentSettings.collaborators.findIndex(
      (c) => c.email.toLowerCase() === email
    );
    const nextCollaborators = [...currentSettings.collaborators];
    if (existingIdx >= 0) {
      nextCollaborators[existingIdx] = {
        ...nextCollaborators[existingIdx],
        role: inviteRole
      };
    } else {
      nextCollaborators.push({
        email,
        role: inviteRole,
        addedAt: Date.now()
      });
    }

    await onUpdateShareSettings({
      ...currentSettings,
      collaborators: nextCollaborators
    });
    setEmailInput('');
  };

  const handleChangeCollaboratorRole = async (email: string, role: SharePermission) => {
    if (!isOwner) return;
    const nextCollaborators = currentSettings.collaborators.map((c) =>
      c.email.toLowerCase() === email.toLowerCase() ? { ...c, role } : c
    );
    await onUpdateShareSettings({
      ...currentSettings,
      collaborators: nextCollaborators
    });
  };

  const handleRemoveCollaborator = async (email: string) => {
    if (!isOwner) return;
    const nextCollaborators = currentSettings.collaborators.filter(
      (c) => c.email.toLowerCase() !== email.toLowerCase()
    );
    await onUpdateShareSettings({
      ...currentSettings,
      collaborators: nextCollaborators
    });
  };

  const handleCopyShareLink = async () => {
    if (!currentSettings.isPublicLink && isOwner) {
      await onUpdateShareSettings({
        ...currentSettings,
        isPublicLink: true
      });
    }
    await navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    window.setTimeout(() => setCopiedLink(false), 2200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 no-print">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-surface border border-border-subtle shadow-2xl p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-text-primary leading-tight">
                Bagikan, Komentar &amp; Ekspor
              </h3>
              <p className="text-xs text-text-secondary truncate max-w-[300px] mt-0.5">
                {note.icon || '📄'} {note.title || 'Tanpa Judul'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-subtle text-text-secondary hover:text-text-primary transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 1. Invite by Email with Role Selector */}
        {isOwner && (
          <form onSubmit={(e) => void handleInviteEmail(e)} className="space-y-1.5">
            <label className="block text-xs font-medium text-text-secondary">
              Undang kolaborator via email
            </label>
            <div className="flex flex-col sm:flex-row gap-1.5">
              <div className="relative flex-1">
                <MailPlus className="w-3.5 h-3.5 text-text-secondary absolute left-3 top-2.5" />
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="nama@gmail.com"
                  className="w-full bg-subtle/70 border border-border-subtle rounded-lg pl-8 pr-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent-strong"
                />
              </div>

              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as SharePermission)}
                className="bg-subtle/70 border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-primary focus:outline-none focus:border-accent-strong"
              >
                <option value="view">Hanya Lihat</option>
                <option value="comment">Pemberi Komentar</option>
                <option value="edit">Bisa Diedit</option>
              </select>

              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold transition shrink-0"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Undang</span>
              </button>
            </div>
          </form>
        )}

        {/* Collaborator List */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-medium text-text-secondary">
            Akses pengguna
          </div>

          <div className="max-h-36 overflow-y-auto space-y-1 pr-0.5">
            {/* Owner Row */}
            <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-subtle/50 border border-border-subtle text-xs">
              <div className="min-w-0">
                <p className="font-medium text-text-primary truncate">
                  {note.ownerName || 'Pemilik Catatan'}{' '}
                  <span className="text-[11px] font-normal text-text-secondary">
                    ({note.ownerEmail || 'Akun Utama'})
                  </span>
                </p>
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 text-[10px] font-semibold shrink-0">
                Pemilik
              </span>
            </div>

            {currentSettings.collaborators.map((collab) => (
              <div
                key={collab.email}
                className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-surface border border-border-subtle text-xs"
              >
                <span className="font-medium text-text-primary truncate flex-1">
                  {collab.email}
                </span>

                {isOwner ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <select
                      value={collab.role}
                      onChange={(e) =>
                        void handleChangeCollaboratorRole(
                          collab.email,
                          e.target.value as SharePermission
                        )
                      }
                      className="bg-subtle border border-border-subtle rounded-md px-2 py-1 text-[11px] font-medium text-text-primary focus:outline-none"
                    >
                      <option value="view">Hanya Lihat</option>
                      <option value="comment">Pemberi Komentar</option>
                      <option value="edit">Bisa Diedit</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => void handleRemoveCollaborator(collab.email)}
                      className="p-1 rounded-md hover:bg-rose-500/15 text-text-secondary hover:text-rose-500 transition"
                      title="Hapus akses"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <span className="text-[11px] font-medium text-text-secondary">
                    {collab.role === 'edit'
                      ? 'Bisa Diedit'
                      : collab.role === 'comment'
                        ? 'Pemberi Komentar'
                        : 'Hanya Lihat'}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 2. Public Link Access & Permission Level */}
        <div className="rounded-xl bg-subtle/50 border border-border-subtle p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  currentSettings.isPublicLink
                    ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
                    : 'bg-subtle text-text-secondary'
                }`}
              >
                {currentSettings.isPublicLink ? (
                  <Globe className="w-4 h-4" />
                ) : (
                  <Lock className="w-4 h-4" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-text-primary truncate">
                  {currentSettings.isPublicLink
                    ? 'Siapa pun yang memiliki tautan dapat melihat'
                    : 'Akses terbatas (Pribadi & Undangan)'}
                </p>
                <p className="text-[11px] text-text-secondary truncate">
                  {currentSettings.isPublicLink
                    ? 'Atur hak akses publik & komentar di bawah'
                    : 'Aktifkan tautan agar dapat diakses publik'}
                </p>
              </div>
            </div>

            {isOwner && (
              <button
                type="button"
                role="switch"
                aria-checked={currentSettings.isPublicLink}
                onClick={() => void handleTogglePublicLink()}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  currentSettings.isPublicLink ? 'bg-sky-600' : 'bg-text-secondary/30'
                }`}
                title={currentSettings.isPublicLink ? 'Nonaktifkan tautan publik' : 'Aktifkan tautan publik'}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    currentSettings.isPublicLink ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            )}
          </div>

          {currentSettings.isPublicLink && (
            <div className="space-y-2 pt-2 border-t border-border-subtle">
              <div className="text-[11px] font-medium text-text-secondary">
                Izin akses tautan:
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {ROLE_OPTIONS.map(({ id, label, desc, Icon }) => {
                  const active = currentSettings.publicRole === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      disabled={!isOwner}
                      onClick={() => void handleChangePublicRole(id)}
                      className={`p-2 rounded-lg border text-left transition ${
                        active
                          ? 'bg-sky-500/12 border-sky-500 text-sky-600 dark:text-sky-300'
                          : 'bg-surface border-border-subtle text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-semibold">
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{label}</span>
                      </div>
                      <p className="text-[10px] opacity-80 leading-tight mt-1 line-clamp-2">
                        {desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Copy Share Link Bar */}
          <div className="flex items-center gap-1.5 pt-1">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 bg-surface border border-border-subtle rounded-lg px-2.5 py-1.5 font-mono text-[11px] text-text-secondary focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void handleCopyShareLink()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold transition shrink-0"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin tautan</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 3. Page Comments / Discussion Toggle (Activated via Bagikan menu) */}
        {onToggleCommentsPanel && (
          <div className="rounded-xl bg-subtle/50 border border-border-subtle p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-text-primary">
                  Komentar &amp; Diskusi Halaman ({note.comments?.length || 0})
                </p>
                <p className="text-[11px] text-text-secondary truncate">
                  Tampilkan panel komentar dan masukan pada halaman ini
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                role="switch"
                aria-checked={showCommentsPanel}
                onClick={onToggleCommentsPanel}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  showCommentsPanel ? 'bg-sky-600' : 'bg-text-secondary/30'
                }`}
                title="Aktifkan diskusi halaman"
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    showCommentsPanel ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        )}

        {/* 4. Download Markdown & Print PDF (Inside Bagikan menu) */}
        {(onExportMarkdown || onPrintPdf) && (
          <div className="pt-1 border-t border-border-subtle space-y-1.5">
            <div className="text-[11px] font-medium text-text-secondary">
              Unduh &amp; Cetak Halaman
            </div>
            <div className="grid grid-cols-2 gap-2">
              {onExportMarkdown && (
                <button
                  type="button"
                  onClick={() => {
                    onExportMarkdown();
                    onClose();
                  }}
                  className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-subtle hover:bg-subtle/80 border border-border-subtle text-xs font-medium text-text-primary transition"
                >
                  <Download className="w-3.5 h-3.5 text-text-secondary" />
                  <span>Unduh Markdown (.md)</span>
                </button>
              )}
              {onPrintPdf && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    window.setTimeout(() => onPrintPdf(), 80);
                  }}
                  className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-subtle hover:bg-subtle/80 border border-border-subtle text-xs font-medium text-text-primary transition"
                >
                  <Printer className="w-3.5 h-3.5 text-text-secondary" />
                  <span>Cetak / Simpan PDF</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
