'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  CloudUpload,
  Download,
  ExternalLink,
  FileCode2,
  Globe,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Tag,
  Trash2,
  User,
  X
} from 'lucide-react';
import type { NoteRecord } from '@/types/miu';
import {
  extractSkillMetadataFromNote,
  loadLocalCommunitySkills,
  mergeSkillLibraryItems,
  OFFICIAL_SKILL_LIBRARY,
  saveLocalCommunitySkills,
  SKILL_LIBRARY_CATEGORIES,
  type SkillLibraryCategory,
  type SkillLibraryItem
} from '@/utils/skillLibraryCatalog';
import { installSkillFromLibraryItem, isSkillNote } from '@/services/aiAgentTools';

interface SkillLibraryModalProps {
  isOpen: boolean;
  initialTab?: 'browse' | 'upload';
  onClose: () => void;
  workspaceNotes: NoteRecord[];
  activeSkillIds: string[];
  onSkillInstalled: (installedNote: NoteRecord) => void;
  onOpenNote?: (note: NoteRecord) => void;
  ownerId?: string;
  ownerEmail?: string;
  ownerName?: string;
  semesterId?: string;
  courseId?: string;
}

export const SkillLibraryModal: React.FC<SkillLibraryModalProps> = ({
  isOpen,
  initialTab = 'browse',
  onClose,
  workspaceNotes,
  activeSkillIds,
  onSkillInstalled,
  onOpenNote,
  ownerId,
  ownerEmail,
  ownerName,
  semesterId,
  courseId
}) => {
  const [activeTab, setActiveTab] = useState<'browse' | 'upload'>(initialTab);
  const [skills, setSkills] = useState<SkillLibraryItem[]>(() =>
    mergeSkillLibraryItems(OFFICIAL_SKILL_LIBRARY, loadLocalCommunitySkills())
  );
  const [isLoading, setIsLoading] = useState(false);
  const [cloudSynced, setCloudSynced] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<SkillLibraryCategory | 'all'>('all');
  const [expandedSkillId, setExpandedSkillId] = useState<string | null>(null);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Upload form state
  const [selectedSourceNoteId, setSelectedSourceNoteId] = useState<string>('');
  const [uploadName, setUploadName] = useState('');
  const [uploadSlug, setUploadSlug] = useState('');
  const [uploadIcon, setUploadIcon] = useState('🧩');
  const [uploadCategory, setUploadCategory] = useState<SkillLibraryCategory>('Produktivitas & Rapat');
  const [uploadSummary, setUploadSummary] = useState('');
  const [uploadFunctionDesc, setUploadFunctionDesc] = useState('');
  const [uploadUseCasesText, setUploadUseCasesText] = useState('');
  const [uploadTagsText, setUploadTagsText] = useState('');
  const [uploadConnectionUrl, setUploadConnectionUrl] = useState('');
  const [uploadInstructions, setUploadInstructions] = useState(
    '## Instruksi Utama\n- Jelaskan langkah demi langkah bagaimana AI harus menjalankan skill ini.\n- Gunakan bahasa yang terstruktur dan jelas.'
  );
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, isOpen]);

  const fetchSkillsFromLibrary = async () => {
    setIsLoading(true);
    try {
      const localCommunity = loadLocalCommunitySkills();
      const baseMerged = mergeSkillLibraryItems(OFFICIAL_SKILL_LIBRARY, localCommunity);
      setSkills(baseMerged);

      const resp = await fetch('/api/ai/skills', { method: 'GET' });
      if (resp.ok) {
        const data = (await resp.json()) as {
          ok?: boolean;
          cloudSynced?: boolean;
          skills?: SkillLibraryItem[];
        };
        if (Array.isArray(data.skills)) {
          setSkills(mergeSkillLibraryItems(baseMerged, data.skills));
        }
        setCloudSynced(Boolean(data.cloudSynced));
      }
    } catch {
      // Fallback to local & official catalog
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void fetchSkillsFromLibrary();
    }
  }, [isOpen]);

  const skillWorkspaceNotes = useMemo(() => {
    const explicitSkills = workspaceNotes.filter(isSkillNote);
    const others = workspaceNotes.filter(n => !isSkillNote(n));
    return [...explicitSkills, ...others];
  }, [workspaceNotes]);

  const handleSelectSourceNote = (noteId: string) => {
    setSelectedSourceNoteId(noteId);
    if (!noteId) return;
    const note = workspaceNotes.find(n => n.id === noteId);
    if (!note) return;

    const extracted = extractSkillMetadataFromNote(note);
    setUploadName(extracted.name);
    setUploadSlug(extracted.slug);
    setUploadIcon(extracted.icon || '🧩');
    setUploadSummary(extracted.summary);
    setUploadFunctionDesc(extracted.functionDescription);
    setUploadUseCasesText(extracted.useCases.join('\n'));
    setUploadTagsText(extracted.tags.join(', '));
    setUploadConnectionUrl(extracted.connectionUrl);
    setUploadInstructions(extracted.instructionsMarkdown);
  };

  // Auto-select first skill.md note when opening upload tab if empty
  useEffect(() => {
    if (isOpen && activeTab === 'upload' && !selectedSourceNoteId && !uploadName) {
      const firstSkillNote = workspaceNotes.find(isSkillNote);
      if (firstSkillNote) {
        handleSelectSourceNote(firstSkillNote.id);
      }
    }
  }, [isOpen, activeTab, workspaceNotes]);

  const filteredSkills = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return skills.filter(item => {
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
      if (!q) return true;
      const haystack = `${item.name} ${item.slug} ${item.summary} ${item.functionDescription} ${item.authorName} ${item.tags.join(' ')}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [skills, searchQuery, selectedCategory]);

  const findInstalledNoteForSkill = (item: SkillLibraryItem): NoteRecord | undefined => {
    const slugLower = item.slug.trim().toLowerCase();
    const nameLower = item.name.trim().toLowerCase();
    return workspaceNotes.find(n => {
      const t = (n.title || '').trim().toLowerCase();
      return t === slugLower || t === `${nameLower}/skill.md`;
    });
  };

  const handleInstallSkill = async (item: SkillLibraryItem) => {
    setInstallingId(item.id);
    setStatusBanner(null);
    try {
      const installedNote = await installSkillFromLibraryItem(item, {
        ownerId,
        ownerEmail,
        ownerName,
        semesterId,
        courseId
      });

      setSkills(prev =>
        prev.map(s => (s.id === item.id ? { ...s, installCount: (s.installCount || 0) + 1 } : s))
      );

      onSkillInstalled(installedNote);
      setStatusBanner({
        type: 'success',
        message: `Skill "${item.name}" berhasil diinstal ke catatan sebagai "${installedNote.title}" dan langsung diaktifkan!`
      });
    } catch (err) {
      setStatusBanner({
        type: 'error',
        message: err instanceof Error ? err.message : 'Gagal menginstal skill.'
      });
    } finally {
      setInstallingId(null);
    }
  };

  const handlePublishSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusBanner(null);

    if (!uploadName.trim()) {
      setStatusBanner({ type: 'error', message: 'Nama skill wajib diisi.' });
      return;
    }
    if (!uploadFunctionDesc.trim() || uploadFunctionDesc.trim().length < 10) {
      setStatusBanner({
        type: 'error',
        message: 'Mohon isi penjelasan fungsi skill (minimal 10 karakter) agar pengguna lain paham kegunaannya.'
      });
      return;
    }

    setIsPublishing(true);
    try {
      const useCases = uploadUseCasesText
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);
      const tags = uploadTagsText
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      const payload = {
        action: 'publish',
        name: uploadName.trim(),
        slug: uploadSlug.trim() || undefined,
        icon: uploadIcon.trim() || '🧩',
        category: uploadCategory,
        summary: uploadSummary.trim() || uploadFunctionDesc.trim().slice(0, 140),
        functionDescription: uploadFunctionDesc.trim(),
        useCases,
        instructionsMarkdown: uploadInstructions.trim(),
        connectionUrl: uploadConnectionUrl.trim() || undefined,
        tags,
        authorName: ownerName || ownerEmail?.split('@')[0] || 'Kreator Miu',
        authorEmail: ownerEmail || ''
      };

      let publishedSkill: SkillLibraryItem | null = null;
      try {
        const resp = await fetch('/api/ai/skills', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = (await resp.json()) as {
          ok?: boolean;
          error?: string;
          skill?: SkillLibraryItem;
        };
        if (!resp.ok || !data.ok) {
          throw new Error(data.error || 'Gagal mengunggah skill ke server.');
        }
        publishedSkill = data.skill || null;
      } catch {
        // Offline / local fallback
        const now = Date.now();
        publishedSkill = {
          id: `community-local-${now}`,
          name: payload.name,
          slug:
            payload.slug ||
            `${payload.name.toLowerCase().replace(/[^a-z0-9-_]+/g, '-')}/skill.md`,
          icon: payload.icon,
          category: payload.category,
          summary: payload.summary,
          functionDescription: payload.functionDescription,
          useCases: payload.useCases,
          instructionsMarkdown: payload.instructionsMarkdown,
          connectionUrl: payload.connectionUrl,
          tags: payload.tags.length > 0 ? payload.tags : [payload.category, 'community'],
          authorName: payload.authorName,
          authorId: ownerId || payload.authorEmail,
          isOfficial: false,
          installCount: 1,
          createdAt: now,
          updatedAt: now
        };
      }

      if (publishedSkill) {
        const currentLocal = loadLocalCommunitySkills();
        const nextLocal = [
          publishedSkill,
          ...currentLocal.filter(s => s.id !== publishedSkill!.id)
        ];
        saveLocalCommunitySkills(nextLocal);
        setSkills(prev => mergeSkillLibraryItems([publishedSkill!], prev));
      }

      setStatusBanner({
        type: 'success',
        message: `Skill "${uploadName.trim()}" berhasil diunggah ke Pustaka Skill! Orang lain kini dapat melihat penjelasan fungsi & menginstal skill ini.`
      });
      setActiveTab('browse');
    } catch (err) {
      setStatusBanner({
        type: 'error',
        message: err instanceof Error ? err.message : 'Gagal mengunggah skill ke pustaka.'
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDeleteCommunitySkill = async (item: SkillLibraryItem) => {
    if (item.isOfficial) return;
    const currentLocal = loadLocalCommunitySkills().filter(s => s.id !== item.id);
    saveLocalCommunitySkills(currentLocal);
    setSkills(prev => prev.filter(s => s.id !== item.id));

    try {
      await fetch('/api/ai/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          id: item.id,
          authorEmail: ownerEmail || ''
        })
      });
    } catch {
      // ignore network error
    }
    setStatusBanner({
      type: 'info',
      message: `Skill "${item.name}" telah dihapus dari Pustaka.`
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-3 sm:p-5"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col w-full max-w-4xl max-h-[88vh] rounded-2xl bg-[var(--bg-elevated,#ffffff)] dark:bg-[#1e1e1e] border border-[var(--border-subtle,#e5e5e3)] dark:border-neutral-800 shadow-2xl overflow-hidden text-[var(--text-primary,#1f1f1f)] dark:text-neutral-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle,#e5e5e3)] dark:border-neutral-800 bg-[var(--bg-secondary,#f9f9f8)] dark:bg-neutral-900/70">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[16px] font-semibold tracking-tight">
                  Pustaka Skill Miu AI
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <Globe className="w-3 h-3" />
                  {cloudSynced ? 'Cloud & Komunitas Aktif' : 'Katalog Publik'}
                </span>
              </div>
              <p className="text-[12px] text-[var(--text-secondary,#6b6b6b)] dark:text-neutral-400">
                Instal <code className="font-mono text-[11px] px-1 py-0.5 rounded bg-black/5 dark:bg-white/10">skill.md</code> siap pakai ke catatan Anda, atau unggah skill buatan Anda beserta penjelasan fungsinya.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-200/70 dark:hover:bg-neutral-800 transition-colors"
            title="Tutup Pustaka Skill"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between px-5 pt-2.5 pb-2 border-b border-[var(--border-subtle,#e5e5e3)] dark:border-neutral-800 bg-[var(--bg-elevated,#ffffff)] dark:bg-[#1e1e1e]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('browse')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] font-medium transition-all ${
                activeTab === 'browse'
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Jelajahi & Instal Skill</span>
              <span className="ml-1 rounded-full bg-white/20 dark:bg-black/15 px-1.5 py-0.2 text-[11px]">
                {skills.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] font-medium transition-all ${
                activeTab === 'upload'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <CloudUpload className="w-4 h-4" />
              <span>Unggah Skill ke Pustaka</span>
            </button>
          </div>

          {activeTab === 'browse' && (
            <button
              type="button"
              onClick={() => void fetchSkillsFromLibrary()}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              title="Muat ulang pustaka terbaru"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Segarkan</span>
            </button>
          )}
        </div>

        {/* Status Banner */}
        {statusBanner && (
          <div
            className={`mx-5 mt-3 flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-[12.5px] border ${
              statusBanner.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                : statusBanner.type === 'error'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
                : 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300'
            }`}
          >
            <span>{statusBanner.message}</span>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="opacity-70 hover:opacity-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'browse' ? (
            <div className="space-y-4">
              {/* Search & Category Filter */}
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Cari skill berdasarkan nama, fungsi, kegunaan, atau tag (mis: riset, esp32, mermaid, rapat)..."
                    className="w-full pl-9 pr-4 py-2 rounded-xl text-[13px] bg-neutral-100/80 dark:bg-neutral-800/80 border border-neutral-200/80 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                </div>
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === 'all'
                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70'
                  }`}
                >
                  Semua Kategori ({skills.length})
                </button>
                {SKILL_LIBRARY_CATEGORIES.map(cat => {
                  const count = skills.filter(s => s.category === cat).length;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors ${
                        selectedCategory === cat
                          ? 'bg-amber-600 text-white'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70'
                      }`}
                    >
                      <span>{cat}</span>
                      <span className="opacity-75 text-[11px]">({count})</span>
                    </button>
                  );
                })}
              </div>

              {/* Skills Grid */}
              {filteredSkills.length === 0 ? (
                <div className="text-center py-12 rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-700">
                  <Sparkles className="w-8 h-8 mx-auto text-neutral-400 mb-2" />
                  <p className="text-[14px] font-medium text-neutral-700 dark:text-neutral-200">
                    Tidak ada skill yang cocok dengan pencarian Anda
                  </p>
                  <p className="text-[12px] text-neutral-500 mt-1">
                    Coba kata kunci lain atau unggah skill buatan Anda sendiri ke Pustaka.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('upload')}
                    className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 text-white text-[12.5px] font-medium hover:bg-amber-700 transition-colors"
                  >
                    <CloudUpload className="w-4 h-4" />
                    <span>Unggah Skill Pertama Anda</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {filteredSkills.map(item => {
                    const installedNote = findInstalledNoteForSkill(item);
                    const isInstalled = Boolean(installedNote);
                    const isActiveInChat =
                      installedNote && activeSkillIds.includes(installedNote.id);
                    const isExpanded = expandedSkillId === item.id;

                    return (
                      <div
                        key={item.id}
                        className="flex flex-col justify-between rounded-2xl border border-neutral-200/90 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 p-4 shadow-sm hover:border-amber-500/40 transition-all"
                      >
                        <div>
                          {/* Card Top Row */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-800 text-2xl border border-neutral-200/60 dark:border-neutral-700">
                                {item.icon || '🧩'}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h3 className="text-[14.5px] font-semibold leading-snug truncate">
                                    {item.name}
                                  </h3>
                                  {item.isOfficial ? (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10.5px] font-medium text-amber-700 dark:text-amber-300 border border-amber-500/25">
                                      Resmi
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-purple-500/15 px-1.5 py-0.5 text-[10.5px] font-medium text-purple-700 dark:text-purple-300 border border-purple-500/25">
                                      Komunitas
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 text-[11.5px] text-neutral-500 dark:text-neutral-400">
                                  <span className="inline-flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    {item.authorName}
                                  </span>
                                  <span>•</span>
                                  <span>{item.category}</span>
                                  <span>•</span>
                                  <span>{item.installCount || 1}x diinstal</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Short Summary */}
                          <p className="mt-2.5 text-[12.5px] font-medium text-neutral-800 dark:text-neutral-200">
                            {item.summary}
                          </p>

                          {/* Detailed Function Explanation Box ("penjelasan skill ini fungsinya apa dll") */}
                          <div className="mt-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/70 dark:border-neutral-700/70 p-2.5">
                            <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-1">
                              Penjelasan Fungsi & Kegunaan Skill:
                            </div>
                            <p className="text-[12px] leading-relaxed text-neutral-700 dark:text-neutral-300">
                              {item.functionDescription}
                            </p>

                            {item.useCases && item.useCases.length > 0 && (
                              <ul className="mt-2 space-y-1 border-t border-neutral-200/60 dark:border-neutral-700/60 pt-1.5">
                                {item.useCases.slice(0, isExpanded ? 10 : 2).map((uc, idx) => (
                                  <li
                                    key={idx}
                                    className="text-[11.5px] text-neutral-600 dark:text-neutral-400 flex items-start gap-1.5"
                                  >
                                    <span className="text-amber-500 mt-0.5">•</span>
                                    <span>{uc}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>

                          {/* Tags & Slug */}
                          <div className="mt-2.5 flex items-center flex-wrap gap-1.5">
                            <span className="inline-flex items-center gap-1 rounded-md bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 font-mono text-[10.5px] text-neutral-600 dark:text-neutral-300">
                              <FileCode2 className="w-3 h-3" />
                              {item.slug}
                            </span>
                            {item.tags.slice(0, 4).map(tag => (
                              <span
                                key={tag}
                                className="inline-flex items-center gap-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800/90 px-1.5 py-0.5 text-[10.5px] text-neutral-500 dark:text-neutral-400"
                              >
                                <Tag className="w-2.5 h-2.5" />
                                {tag}
                              </span>
                            ))}
                          </div>

                          {/* Expandable Markdown Preview */}
                          {isExpanded && (
                            <div className="mt-3 rounded-xl bg-neutral-900 text-neutral-100 p-3 text-[11.5px] font-mono overflow-x-auto max-h-48 overflow-y-auto">
                              <div className="text-[10.5px] text-amber-400 mb-1 font-sans font-semibold">
                                Preview Instruksi ({item.slug}):
                              </div>
                              <pre className="whitespace-pre-wrap break-words">
                                {item.instructionsMarkdown}
                              </pre>
                              {item.connectionUrl && (
                                <div className="mt-2 pt-2 border-t border-neutral-700 text-[11px] text-emerald-400">
                                  Endpoint Koneksi: {item.connectionUrl}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Actions Footer */}
                        <div className="mt-3.5 pt-2.5 border-t border-neutral-200/70 dark:border-neutral-800 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedSkillId(isExpanded ? null : item.id)
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11.5px] font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="w-3.5 h-3.5" />
                                  <span>Tutup Preview</span>
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="w-3.5 h-3.5" />
                                  <span>Lihat Isi skill.md</span>
                                </>
                              )}
                            </button>

                            {!item.isOfficial && (
                              <button
                                type="button"
                                onClick={() => void handleDeleteCommunitySkill(item)}
                                className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-rose-500/10 transition-colors"
                                title="Hapus skill komunitas ini"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            {isInstalled && installedNote ? (
                              <>
                                {onOpenNote && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onOpenNote(installedNote);
                                      onClose();
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11.5px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                                    title="Buka halaman skill.md ini di editor catatan"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    <span>Edit di Catatan</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => void handleInstallSkill(item)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11.5px] font-medium bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                                  title="Sudah terpasang di workspace (klik untuk instal salinan baru)"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>{isActiveInChat ? 'Terpasang & Aktif' : 'Terpasang'}</span>
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                disabled={installingId === item.id}
                                onClick={() => void handleInstallSkill(item)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[12px] font-medium bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:opacity-90 disabled:opacity-50 transition-all shadow-sm"
                              >
                                {installingId === item.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Download className="w-3.5 h-3.5" />
                                )}
                                <span>Instal Skill</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* UPLOAD TAB */
            <form onSubmit={handlePublishSkill} className="space-y-4 max-w-2xl mx-auto">
              <div className="rounded-2xl bg-amber-500/10 border border-amber-500/25 p-3.5 text-[12.5px] text-amber-900 dark:text-amber-200">
                <div className="font-semibold flex items-center gap-1.5 mb-0.5">
                  <CloudUpload className="w-4 h-4" />
                  <span>Bagikan Skill Anda ke Pustaka Miu AI</span>
                </div>
                <p className="opacity-90">
                  Anda dapat memilih halaman <code className="font-mono">skill.md</code> yang sudah Anda edit di catatan atau menulis baru di bawah, lalu jelaskan <strong>skill ini fungsinya apa</strong> agar pengguna lain dapat menemukan dan menginstalnya.
                </p>
              </div>

              {/* Pick from existing workspace note */}
              <div>
                <label className="block text-[12px] font-semibold mb-1.5">
                  Ambil Otomatis dari Catatan / Skill.md di Workspace (Opsional)
                </label>
                <select
                  value={selectedSourceNoteId}
                  onChange={e => handleSelectSourceNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-[13px] bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                >
                  <option value="">-- Tulis manual atau pilih dari halaman catatan Anda --</option>
                  {skillWorkspaceNotes.map(n => (
                    <option key={n.id} value={n.id}>
                      {n.icon || '📄'} {n.title || 'Tanpa Judul'}
                      {isSkillNote(n) ? ' (SKILL.MD)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[12px] font-semibold mb-1">Ikon</label>
                  <input
                    type="text"
                    value={uploadIcon}
                    onChange={e => setUploadIcon(e.target.value)}
                    maxLength={4}
                    className="w-full px-3 py-2 text-center text-lg rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700"
                  />
                </div>

                <div className="sm:col-span-6">
                  <label className="block text-[12px] font-semibold mb-1">
                    Nama Skill <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={uploadName}
                    onChange={e => setUploadName(e.target.value)}
                    placeholder="Contoh: Asisten Analisis Jurnal & Sitasi"
                    className="w-full px-3 py-2 rounded-xl text-[13px] bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700"
                  />
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-[12px] font-semibold mb-1">Kategori</label>
                  <select
                    value={uploadCategory}
                    onChange={e =>
                      setUploadCategory(e.target.value as SkillLibraryCategory)
                    }
                    className="w-full px-3 py-2 rounded-xl text-[13px] bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700"
                  >
                    {SKILL_LIBRARY_CATEGORIES.map(c => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Ringkasan Singkat */}
              <div>
                <label className="block text-[12px] font-semibold mb-1">
                  Ringkasan Singkat (1 KalimatHeadline)
                </label>
                <input
                  type="text"
                  value={uploadSummary}
                  onChange={e => setUploadSummary(e.target.value)}
                  placeholder="Contoh: Merangkum paper akademik, mencari referensi via Web Tool, dan menyusun daftar pustaka APA."
                  className="w-full px-3 py-2 rounded-xl text-[13px] bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700"
                />
              </div>

              {/* Detailed Function Explanation */}
              <div>
                <label className="block text-[12px] font-semibold mb-1">
                  Penjelasan Fungsi Skill (Skill ini fungsinya apa, cara kerjanya, & kapan digunakan){' '}
                  <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={uploadFunctionDesc}
                  onChange={e => setUploadFunctionDesc(e.target.value)}
                  placeholder="Jelaskan secara lengkap fungsi skill ini, masalah apa yang diselesaikan, tool apa yang dipakai (misal web search atau update catatan), dan hasil akhir yang diberikan..."
                  className="w-full px-3 py-2 rounded-xl text-[13px] bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700"
                />
              </div>

              {/* Use Cases */}
              <div>
                <label className="block text-[12px] font-semibold mb-1">
                  Contoh Kegunaan / Skenario Pemakaian (Satu baris per poin)
                </label>
                <textarea
                  rows={3}
                  value={uploadUseCasesText}
                  onChange={e => setUploadUseCasesText(e.target.value)}
                  placeholder={`Mencari 5 referensi jurnal terbaru tentang topik skripsi\nMerapikan catatan kuliah menjadi tabel ringkasan`}
                  className="w-full px-3 py-2 rounded-xl text-[12.5px] bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700"
                />
              </div>

              {/* Instructions Markdown */}
              <div>
                <label className="block text-[12px] font-semibold mb-1">
                  Isi Instruksi <code className="font-mono">skill.md</code> (Aturan & Prompt Sistem untuk AI)
                </label>
                <textarea
                  rows={6}
                  value={uploadInstructions}
                  onChange={e => setUploadInstructions(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-[12.5px] font-mono bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold mb-1">
                    Tag Pencarian (Pisahkan dengan koma)
                  </label>
                  <input
                    type="text"
                    value={uploadTagsText}
                    onChange={e => setUploadTagsText(e.target.value)}
                    placeholder="riset, jurnal, skripsi, iot, diagram"
                    className="w-full px-3 py-2 rounded-xl text-[12.5px] bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-semibold mb-1">
                    URL Koneksi / Webhook API (Opsional)
                  </label>
                  <input
                    type="url"
                    value={uploadConnectionUrl}
                    onChange={e => setUploadConnectionUrl(e.target.value)}
                    placeholder="https://api.example.com/webhook"
                    className="w-full px-3 py-2 rounded-xl text-[12.5px] font-mono bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setActiveTab('browse')}
                  className="px-4 py-2 rounded-xl text-[13px] font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPublishing}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-[13px] font-semibold bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 transition-all shadow-sm"
                >
                  {isPublishing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CloudUpload className="w-4 h-4" />
                  )}
                  <span>Unggah Skill ke Pustaka</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
