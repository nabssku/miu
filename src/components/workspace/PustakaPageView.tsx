'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  CloudUpload,
  Download,
  ExternalLink,
  FileCode2,
  ListFilter,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Tag,
  Trash2,
  User,
  Users,
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
import {
  createEditableSkillNote,
  installSkillFromLibraryItem,
  isSkillNote
} from '@/services/aiAgentTools';

export type PustakaTopTab = 'recent' | 'favorites' | 'shared' | 'private' | 'skill' | 'all';
export type PustakaSkillSubTab = 'active' | 'discover' | 'upload';

interface PustakaPageViewProps {
  allNotes: NoteRecord[];
  myNotes: NoteRecord[];
  sharedWithMeNotes: NoteRecord[];
  favoriteNotes: NoteRecord[];
  activeSkillIds: string[];
  onToggleSkillActive: (skillNoteId: string) => void;
  onSkillInstalled: (installedNote: NoteRecord) => void;
  onOpenNote: (noteId: string) => void;
  onOpenAIDrawer: () => void;
  initialSubTab?: PustakaSkillSubTab;
  ownerId?: string;
  ownerEmail?: string;
  ownerName?: string;
  semesterId?: string;
  courseId?: string;
}

const SkillOutlinePageIcon: React.FC<{ className?: string }> = ({
  className = 'w-4 h-4'
}) => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M5 3.5h7.5L16 7v9.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-12a1 1 0 0 1 1-1Z" />
    <path d="M12 3.5V7h3.5" />
    <path d="M7.2 12.8 9.4 10l1.6 1.8 2-2.3" />
  </svg>
);

export const PustakaPageView: React.FC<PustakaPageViewProps> = ({
  allNotes,
  myNotes,
  sharedWithMeNotes,
  favoriteNotes,
  activeSkillIds,
  onToggleSkillActive,
  onSkillInstalled,
  onOpenNote,
  onOpenAIDrawer,
  initialSubTab = 'active',
  ownerId,
  ownerEmail,
  ownerName,
  semesterId,
  courseId
}) => {
  const [topTab, setTopTab] = useState<PustakaTopTab>('skill');
  const [skillSubTab, setSkillSubTab] = useState<PustakaSkillSubTab>(initialSubTab);
  const [showAgentBanner, setShowAgentBanner] = useState(true);
  const [showNewSkillDropdown, setShowNewSkillDropdown] = useState(false);
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [sortOrder, setSortOrder] = useState<'popular' | 'newest'>('popular');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<SkillLibraryCategory | 'all'>(
    'all'
  );

  const [skills, setSkills] = useState<SkillLibraryItem[]>(() =>
    mergeSkillLibraryItems(OFFICIAL_SKILL_LIBRARY, loadLocalCommunitySkills())
  );
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSkillId, setExpandedSkillId] = useState<string | null>(null);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [creatingSkillNote, setCreatingSkillNote] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Upload form state
  const [selectedSourceNoteId, setSelectedSourceNoteId] = useState<string>('');
  const [uploadName, setUploadName] = useState('');
  const [uploadSlug, setUploadSlug] = useState('');
  const [uploadIcon, setUploadIcon] = useState('🧩');
  const [uploadCategory, setUploadCategory] =
    useState<SkillLibraryCategory>('Produktivitas & Rapat');
  const [uploadSummary, setUploadSummary] = useState('');
  const [uploadFunctionDesc, setUploadFunctionDesc] = useState('');
  const [uploadUseCasesText, setUploadUseCasesText] = useState('');
  const [uploadTagsText, setUploadTagsText] = useState('');
  const [uploadConnectionUrl, setUploadConnectionUrl] = useState('');
  const [uploadInstructions, setUploadInstructions] = useState(
    '## Instruksi Utama\n- Jelaskan langkah demi langkah bagaimana AI harus menjalankan skill ini.\n- Gunakan bahasa yang terstruktur dan jelas.'
  );
  const [isPublishing, setIsPublishing] = useState(false);

  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setSkillSubTab(initialSubTab);
  }, [initialSubTab]);

  useEffect(() => {
    if (!showNewSkillDropdown) return;
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (target && dropdownRef.current?.contains(target)) return;
      setShowNewSkillDropdown(false);
    };
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [showNewSkillDropdown]);

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
          skills?: SkillLibraryItem[];
        };
        if (Array.isArray(data.skills)) {
          setSkills(mergeSkillLibraryItems(baseMerged, data.skills));
        }
      }
    } catch {
      // fallback to local + official catalog
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchSkillsFromLibrary();
  }, []);

  const workspaceSkillNotes = useMemo(
    () => allNotes.filter(isSkillNote),
    [allNotes]
  );

  const allWorkspaceNotesForUpload = useMemo(() => {
    const explicitSkills = allNotes.filter(isSkillNote);
    const others = allNotes.filter((n) => !isSkillNote(n));
    return [...explicitSkills, ...others];
  }, [allNotes]);

  const handleSelectSourceNote = (noteId: string) => {
    setSelectedSourceNoteId(noteId);
    if (!noteId) return;
    const note = allNotes.find((n) => n.id === noteId);
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

  const handleCreateBlankSkillInNotes = async () => {
    setCreatingSkillNote(true);
    try {
      const created = await createEditableSkillNote({
        skillName: 'skill-baru/skill.md',
        ownerId,
        ownerEmail,
        ownerName,
        semesterId: semesterId || 'sem-1',
        courseId: courseId || 'course-default'
      });
      onSkillInstalled(created);
    } finally {
      setCreatingSkillNote(false);
    }
  };

  const filteredCatalogSkills = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = skills.filter((item) => {
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
      if (!q) return true;
      const haystack = `${item.name} ${item.slug} ${item.summary} ${item.functionDescription} ${item.authorName} ${item.tags.join(' ')}`.toLowerCase();
      return haystack.includes(q);
    });
    return [...list].sort((a, b) =>
      sortOrder === 'newest'
        ? (b.updatedAt || 0) - (a.updatedAt || 0)
        : (b.installCount || 0) - (a.installCount || 0)
    );
  }, [skills, searchQuery, selectedCategory, sortOrder]);

  const filteredWorkspaceSkills = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return workspaceSkillNotes;
    return workspaceSkillNotes.filter((n) =>
      `${n.title || ''} ${(n.blocks || []).map((b) => b.content).join(' ')}`
        .toLowerCase()
        .includes(q)
    );
  }, [workspaceSkillNotes, searchQuery]);

  const findInstalledNoteForSkill = (item: SkillLibraryItem): NoteRecord | undefined => {
    const slugLower = item.slug.trim().toLowerCase();
    const nameLower = item.name.trim().toLowerCase();
    return allNotes.find((n) => {
      const t = (n.title || '').trim().toLowerCase();
      return t === slugLower || t === `${nameLower}/skill.md`;
    });
  };

  const handleInstallSkill = async (item: SkillLibraryItem, openInEditor = false) => {
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

      setSkills((prev) =>
        prev.map((s) =>
          s.id === item.id ? { ...s, installCount: (s.installCount || 0) + 1 } : s
        )
      );

      if (openInEditor) {
        onSkillInstalled(installedNote);
      } else {
        if (!activeSkillIds.includes(installedNote.id)) {
          onToggleSkillActive(installedNote.id);
        }
        setStatusBanner({
          type: 'success',
          message: `Skill "${item.name}" berhasil dipasang sebagai "${installedNote.title}" dan diaktifkan di tab Aktif.`
        });
      }
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
        message:
          'Mohon isi penjelasan fungsi skill (minimal 10 karakter) agar pengguna lain paham kegunaannya.'
      });
      return;
    }

    setIsPublishing(true);
    try {
      const useCases = uploadUseCasesText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      const tags = uploadTagsText
        .split(',')
        .map((s) => s.trim())
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
          ...currentLocal.filter((s) => s.id !== publishedSkill!.id)
        ];
        saveLocalCommunitySkills(nextLocal);
        setSkills((prev) => mergeSkillLibraryItems([publishedSkill!], prev));
      }

      setStatusBanner({
        type: 'success',
        message: `Skill "${uploadName.trim()}" berhasil diunggah ke Pustaka! Pengguna lain kini dapat melihat penjelasan fungsi & menginstalnya.`
      });
      setSkillSubTab('discover');
    } catch (err) {
      setStatusBanner({
        type: 'error',
        message: err instanceof Error ? err.message : 'Gagal mengunggah skill.'
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDeleteCommunitySkill = async (item: SkillLibraryItem) => {
    if (item.isOfficial) return;
    const currentLocal = loadLocalCommunitySkills().filter((s) => s.id !== item.id);
    saveLocalCommunitySkills(currentLocal);
    setSkills((prev) => prev.filter((s) => s.id !== item.id));

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
      // ignore
    }
    setStatusBanner({
      type: 'info',
      message: `Skill "${item.name}" telah dihapus dari Pustaka.`
    });
  };

  // Notes list when user selects Terbaru, Favorit, Bersama, Privat, or Semua
  const notesForCurrentTopTab = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let base: NoteRecord[] = [];
    if (topTab === 'recent') {
      base = [...myNotes, ...sharedWithMeNotes].sort((a, b) => b.updatedAt - a.updatedAt);
    } else if (topTab === 'favorites') {
      base = favoriteNotes;
    } else if (topTab === 'shared') {
      base = sharedWithMeNotes;
    } else if (topTab === 'private') {
      base = myNotes;
    } else {
      base = allNotes;
    }
    if (!q) return base;
    return base.filter((n) => (n.title || '').toLowerCase().includes(q));
  }, [topTab, myNotes, sharedWithMeNotes, favoriteNotes, allNotes, searchQuery]);

  return (
    <div className="flex-1 w-full bg-surface text-text-primary min-h-[calc(100vh-44px)] px-6 sm:px-14 lg:px-24 py-8 sm:py-11 overflow-y-auto select-none">
      <div className="max-w-5xl mx-auto">
        {/* ================================================================= */}
        {/* ROW 1: "Pustaka" Heading + Blue "Skill baru | v" Split Button      */}
        {/* ================================================================= */}
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-[28px] sm:text-[32px] font-bold tracking-tight text-text-primary leading-tight">
            Pustaka
          </h1>

          <div ref={dropdownRef} className="relative flex items-center">
            <div className="inline-flex items-center rounded-lg bg-[#2383E2] text-white shadow-sm overflow-hidden">
              <button
                type="button"
                disabled={creatingSkillNote}
                onClick={() => void handleCreateBlankSkillInNotes()}
                className="px-3.5 py-1.5 text-[13.5px] font-medium hover:bg-[#1B6EC2] transition flex items-center gap-1.5"
              >
                {creatingSkillNote && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Skill baru</span>
              </button>
              <div className="w-px h-5 bg-white/25" />
              <button
                type="button"
                onClick={() => setShowNewSkillDropdown((v) => !v)}
                className="px-2 py-1.5 hover:bg-[#1B6EC2] transition flex items-center justify-center"
                title="Opsi Skill baru"
                aria-label="Opsi Skill baru"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            {showNewSkillDropdown && (
              <div className="absolute right-0 top-full mt-1.5 w-60 rounded-xl bg-surface border border-border-subtle shadow-xl p-1.5 z-40 space-y-0.5 text-[13px] text-text-primary">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewSkillDropdown(false);
                    void handleCreateBlankSkillInNotes();
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-subtle text-left transition"
                >
                  <Plus className="w-4 h-4 text-text-secondary shrink-0" />
                  <div>
                    <div className="font-medium">Buat skill.md di Catatan</div>
                    <div className="text-[11px] text-text-secondary">
                      Buka editor halaman skill.md baru
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewSkillDropdown(false);
                    setTopTab('skill');
                    setSkillSubTab('upload');
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-subtle text-left transition"
                >
                  <CloudUpload className="w-4 h-4 text-[#2383E2] shrink-0" />
                  <div>
                    <div className="font-medium">Unggah Skill ke Pustaka</div>
                    <div className="text-[11px] text-text-secondary">
                      Bagikan skill &amp; penjelasan fungsinya
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewSkillDropdown(false);
                    setTopTab('skill');
                    setSkillSubTab('discover');
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-subtle text-left transition"
                >
                  <Download className="w-4 h-4 text-text-secondary shrink-0" />
                  <div>
                    <div className="font-medium">Temukan Skill Komunitas</div>
                    <div className="text-[11px] text-text-secondary">
                      Instal skill dari katalog Pustaka
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ================================================================= */}
        {/* ROW 2: Primary Filter Tabs (Terbaru, Favorit, Bersama, Privat, Skill) */}
        {/* ================================================================= */}
        <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap text-[13.5px]">
            <button
              type="button"
              onClick={() => setTopTab('recent')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition ${
                topTab === 'recent'
                  ? 'bg-text-primary/[0.07] dark:bg-white/[0.1] text-text-primary font-semibold'
                  : 'text-text-secondary hover:bg-text-primary/[0.04] hover:text-text-primary'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Terbaru</span>
            </button>

            <button
              type="button"
              onClick={() => setTopTab('favorites')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition ${
                topTab === 'favorites'
                  ? 'bg-text-primary/[0.07] dark:bg-white/[0.1] text-text-primary font-semibold'
                  : 'text-text-secondary hover:bg-text-primary/[0.04] hover:text-text-primary'
              }`}
            >
              <Star className="w-3.5 h-3.5" />
              <span>Favorit</span>
            </button>

            <button
              type="button"
              onClick={() => setTopTab('shared')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition ${
                topTab === 'shared'
                  ? 'bg-text-primary/[0.07] dark:bg-white/[0.1] text-text-primary font-semibold'
                  : 'text-text-secondary hover:bg-text-primary/[0.04] hover:text-text-primary'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Bersama</span>
            </button>

            <button
              type="button"
              onClick={() => setTopTab('private')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition ${
                topTab === 'private'
                  ? 'bg-text-primary/[0.07] dark:bg-white/[0.1] text-text-primary font-semibold'
                  : 'text-text-secondary hover:bg-text-primary/[0.04] hover:text-text-primary'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Privat</span>
            </button>

            <button
              type="button"
              onClick={() => setTopTab('skill')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full transition ${
                topTab === 'skill'
                  ? 'bg-text-primary/[0.07] dark:bg-white/[0.1] text-text-primary font-semibold'
                  : 'text-text-secondary hover:bg-text-primary/[0.04] hover:text-text-primary'
              }`}
            >
              <SkillOutlinePageIcon className="w-4 h-4" />
              <span>Skill</span>
            </button>

            <button
              type="button"
              onClick={() => setTopTab('all')}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full transition text-[13px] ${
                topTab === 'all'
                  ? 'bg-text-primary/[0.07] dark:bg-white/[0.1] text-text-primary font-semibold'
                  : 'text-text-secondary hover:bg-text-primary/[0.04] hover:text-text-primary'
              }`}
            >
              <span>1 lagi...</span>
            </button>
          </div>

          {/* Right Filter & Search Icons */}
          <div className="flex items-center gap-1 text-text-secondary">
            <button
              type="button"
              onClick={() =>
                setSortOrder((prev) => (prev === 'popular' ? 'newest' : 'popular'))
              }
              className="p-1.5 rounded-md hover:bg-text-primary/[0.05] hover:text-text-primary transition"
              title={
                sortOrder === 'popular'
                  ? 'Urutan: Terpopuler (Klik untuk Terbaru)'
                  : 'Urutan: Terbaru (Klik untuk Terpopuler)'
              }
            >
              <ListFilter className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setShowSearchBar((v) => !v);
                window.setTimeout(() => searchInputRef.current?.focus(), 40);
              }}
              className={`p-1.5 rounded-md transition ${
                showSearchBar || searchQuery
                  ? 'bg-text-primary/[0.07] text-text-primary'
                  : 'hover:bg-text-primary/[0.05] hover:text-text-primary'
              }`}
              title="Cari di Pustaka"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Expandable Inline Search Bar */}
        {(showSearchBar || searchQuery) && (
          <div className="mt-3 relative">
            <Search className="w-4 h-4 text-text-secondary absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari skill, fungsi, tag, atau judul halaman di Pustaka..."
              className="w-full pl-9 pr-9 py-2 rounded-xl bg-subtle/60 border border-border-subtle text-[13.5px] text-text-primary placeholder:text-text-secondary/65 focus:outline-none focus:border-[#2383E2]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Status Notification Banner */}
        {statusBanner && (
          <div
            className={`mt-4 flex items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-[13px] border ${
              statusBanner.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                : statusBanner.type === 'error'
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
                  : 'bg-sky-500/10 border-sky-500/30 text-sky-700 dark:text-sky-300'
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

        {/* ================================================================= */}
        {/* MAIN CONTENT FOR "SKILL" TAB (image_4.png)                        */}
        {/* ================================================================= */}
        {topTab === 'skill' ? (
          <>
            {/* ROW 3: Sub-tabs ("Aktif" | "Temukan" | "Unggah") + Agent Banner Pill */}
            <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-[13px]">
                <button
                  type="button"
                  onClick={() => setSkillSubTab('active')}
                  className={`px-3 py-1 rounded-full transition ${
                    skillSubTab === 'active'
                      ? 'bg-text-primary/[0.07] dark:bg-white/[0.1] text-text-primary font-semibold'
                      : 'text-text-secondary hover:bg-text-primary/[0.04] hover:text-text-primary font-medium'
                  }`}
                >
                  Aktif
                  {workspaceSkillNotes.length > 0 && (
                    <span className="ml-1.5 text-[11px] opacity-75">
                      ({workspaceSkillNotes.length})
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setSkillSubTab('discover')}
                  className={`px-3 py-1 rounded-full transition ${
                    skillSubTab === 'discover'
                      ? 'bg-text-primary/[0.07] dark:bg-white/[0.1] text-text-primary font-semibold'
                      : 'text-text-secondary hover:bg-text-primary/[0.04] hover:text-text-primary font-medium'
                  }`}
                >
                  Temukan
                  <span className="ml-1.5 text-[11px] opacity-75">({skills.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSkillSubTab('upload')}
                  className={`px-3 py-1 rounded-full transition ${
                    skillSubTab === 'upload'
                      ? 'bg-text-primary/[0.07] dark:bg-white/[0.1] text-text-primary font-semibold'
                      : 'text-text-secondary hover:bg-text-primary/[0.04] hover:text-text-primary font-medium'
                  }`}
                >
                  Unggah ke Pustaka
                </button>
              </div>

              {showAgentBanner && (
                <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-text-primary/[0.035] dark:bg-white/[0.05] border border-border-subtle/70 text-[12.5px]">
                  <div className="flex items-center -space-x-1">
                    <span className="w-5 h-5 rounded-full bg-surface border border-border-subtle flex items-center justify-center text-[11px] shadow-xs">
                      🤖
                    </span>
                    <span className="w-5 h-5 rounded-full bg-surface border border-border-subtle flex items-center justify-center text-[11px] text-amber-600 shadow-xs">
                      ✴️
                    </span>
                  </div>
                  <span className="text-text-secondary">
                    Gunakan skill Anda dengan agent yang terhubung?
                  </span>
                  <button
                    type="button"
                    onClick={onOpenAIDrawer}
                    className="font-medium text-[#2383E2] hover:underline"
                  >
                    Siapkan
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAgentBanner(false)}
                    className="text-text-secondary/70 hover:text-text-primary p-0.5"
                    aria-label="Tutup banner"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* SUB-TAB 1: AKTIF (Matches image_4.png empty state + active skills list) */}
            {skillSubTab === 'active' && (
              <div className="mt-6">
                {filteredWorkspaceSkills.length === 0 ? (
                  <div className="py-24 sm:py-32 flex flex-col items-center justify-center text-center max-w-xl mx-auto">
                    <div className="text-text-secondary/55 mb-4">
                      <SkillOutlinePageIcon className="w-9 h-9 mx-auto stroke-[1.4]" />
                    </div>
                    <p className="text-[13.5px] leading-relaxed text-text-secondary">
                      Gunakan skill yang diaktifkan dengan mengetik &lsquo;/&rsquo; dalam
                      obrolan atau biarkan Agen menggunakannya secara otomatis saat
                      relevan. Mulailah dengan membuat skill pertama Anda atau{' '}
                      <button
                        type="button"
                        onClick={() => setSkillSubTab('discover')}
                        className="underline hover:text-text-primary transition"
                      >
                        temukan skill yang telah dibuat orang lain di tab Temukan
                      </button>
                      .
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleCreateBlankSkillInNotes()}
                      className="mt-4 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-[#2383E2] hover:underline"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Skill baru</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[12px] text-text-secondary pb-1 border-b border-border-subtle/70">
                      <span>
                        Daftar halaman <code className="font-mono">skill.md</code> di
                        workspace Anda ({filteredWorkspaceSkills.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => setSkillSubTab('discover')}
                        className="text-[#2383E2] hover:underline font-medium"
                      >
                        + Instal dari tab Temukan
                      </button>
                    </div>

                    <div className="divide-y divide-border-subtle/70 border border-border-subtle rounded-2xl bg-surface overflow-hidden">
                      {filteredWorkspaceSkills.map((sn) => {
                        const isActive = activeSkillIds.includes(sn.id);
                        const meta = extractSkillMetadataFromNote(sn);
                        return (
                          <div
                            key={sn.id}
                            className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-subtle/40 transition"
                          >
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              <span className="text-2xl leading-none mt-0.5 shrink-0">
                                {sn.icon || '🧩'}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => onOpenNote(sn.id)}
                                    className="text-[14.5px] font-semibold text-text-primary hover:text-[#2383E2] truncate text-left"
                                  >
                                    {sn.title || 'skill.md'}
                                  </button>
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                                      isActive
                                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25'
                                        : 'bg-subtle text-text-secondary border border-border-subtle'
                                    }`}
                                  >
                                    {isActive ? 'Aktif di Agent' : 'Nonaktif'}
                                  </span>
                                </div>
                                <p className="text-[12.5px] text-text-secondary mt-1 line-clamp-2">
                                  {meta.functionDescription || meta.summary}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => onToggleSkillActive(sn.id)}
                                className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition ${
                                  isActive
                                    ? 'bg-subtle border-border-subtle text-text-primary'
                                    : 'bg-[#2383E2] border-[#2383E2] text-white'
                                }`}
                              >
                                {isActive ? 'Nonaktifkan' : 'Aktifkan'}
                              </button>
                              <button
                                type="button"
                                onClick={() => onOpenNote(sn.id)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-medium border border-border-subtle hover:bg-subtle text-text-primary transition"
                              >
                                <span>Edit di Catatan</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  handleSelectSourceNote(sn.id);
                                  setSkillSubTab('upload');
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-medium border border-border-subtle hover:bg-subtle text-text-secondary hover:text-text-primary transition"
                                title="Unggah skill ini ke Pustaka Komunitas"
                              >
                                <CloudUpload className="w-3.5 h-3.5" />
                                <span className="hidden md:inline">Unggah</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SUB-TAB 2: TEMUKAN (In-page Community & Official Skill Library) */}
            {skillSubTab === 'discover' && (
              <div className="mt-6 space-y-5">
                {/* Category Filter Pills + Refresh */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    <button
                      type="button"
                      onClick={() => setSelectedCategory('all')}
                      className={`px-3 py-1 rounded-full text-[12.5px] font-medium whitespace-nowrap transition ${
                        selectedCategory === 'all'
                          ? 'bg-text-primary text-surface'
                          : 'bg-subtle/70 text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      Semua ({skills.length})
                    </button>
                    {SKILL_LIBRARY_CATEGORIES.map((cat) => {
                      const count = skills.filter((s) => s.category === cat).length;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setSelectedCategory(cat)}
                          className={`px-3 py-1 rounded-full text-[12.5px] font-medium whitespace-nowrap transition ${
                            selectedCategory === cat
                              ? 'bg-[#2383E2] text-white'
                              : 'bg-subtle/70 text-text-secondary hover:text-text-primary'
                          }`}
                        >
                          {cat} ({count})
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => void fetchSkillsFromLibrary()}
                    disabled={isLoading}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] text-text-secondary hover:text-text-primary hover:bg-subtle transition"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`}
                    />
                    <span>Segarkan</span>
                  </button>
                </div>

                {/* Skills List / Grid directly in page */}
                {filteredCatalogSkills.length === 0 ? (
                  <div className="py-16 text-center rounded-2xl border border-dashed border-border-subtle">
                    <Sparkles className="w-7 h-7 mx-auto text-text-secondary/50 mb-2" />
                    <p className="text-[14px] font-medium text-text-primary">
                      Tidak ada skill yang cocok dengan pencarian Anda
                    </p>
                    <button
                      type="button"
                      onClick={() => setSkillSubTab('upload')}
                      className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#2383E2] text-white text-[12.5px] font-medium"
                    >
                      <CloudUpload className="w-4 h-4" />
                      <span>Unggah Skill Baru ke Pustaka</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredCatalogSkills.map((item) => {
                      const installedNote = findInstalledNoteForSkill(item);
                      const isInstalled = Boolean(installedNote);
                      const isExpanded = expandedSkillId === item.id;

                      return (
                        <div
                          key={item.id}
                          className="flex flex-col justify-between rounded-2xl border border-border-subtle bg-surface p-4 hover:border-text-secondary/40 transition shadow-[0_1px_3px_rgba(15,23,42,0.03)]"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-subtle border border-border-subtle flex items-center justify-center text-xl shrink-0">
                                  {item.icon || '🧩'}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <h3 className="text-[14.5px] font-semibold text-text-primary truncate">
                                      {item.name}
                                    </h3>
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[10.5px] font-medium ${
                                        item.isOfficial
                                          ? 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20'
                                          : 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20'
                                      }`}
                                    >
                                      {item.isOfficial ? 'Resmi' : 'Komunitas'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5 text-[11.5px] text-text-secondary">
                                    <span className="inline-flex items-center gap-1">
                                      <User className="w-3 h-3" />
                                      {item.authorName}
                                    </span>
                                    <span>•</span>
                                    <span>{item.category}</span>
                                    <span>•</span>
                                    <span>{item.installCount || 1}x dipasang</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <p className="mt-2.5 text-[13px] font-medium text-text-primary">
                              {item.summary}
                            </p>

                            {/* Detailed Function Explanation ("penjelasan skill ini fungsinya apa dll") */}
                            <div className="mt-2.5 rounded-xl bg-subtle/45 border border-border-subtle/80 p-3">
                              <div className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-1">
                                Fungsi &amp; Kegunaan Skill
                              </div>
                              <p className="text-[12.5px] leading-relaxed text-text-primary/90">
                                {item.functionDescription}
                              </p>

                              {item.useCases && item.useCases.length > 0 && (
                                <ul className="mt-2 pt-2 border-t border-border-subtle/70 space-y-1">
                                  {item.useCases
                                    .slice(0, isExpanded ? 10 : 2)
                                    .map((uc, idx) => (
                                      <li
                                        key={idx}
                                        className="text-[11.5px] text-text-secondary flex items-start gap-1.5"
                                      >
                                        <span className="text-[#2383E2] mt-0.5">•</span>
                                        <span>{uc}</span>
                                      </li>
                                    ))}
                                </ul>
                              )}
                            </div>

                            <div className="mt-2.5 flex items-center flex-wrap gap-1.5">
                              <span className="inline-flex items-center gap-1 rounded-md bg-subtle px-2 py-0.5 font-mono text-[10.5px] text-text-secondary">
                                <FileCode2 className="w-3 h-3" />
                                {item.slug}
                              </span>
                              {item.tags.slice(0, 4).map((tag) => (
                                <span
                                  key={tag}
                                  className="inline-flex items-center gap-0.5 rounded-md bg-subtle/80 px-1.5 py-0.5 text-[10.5px] text-text-secondary"
                                >
                                  <Tag className="w-2.5 h-2.5" />
                                  {tag}
                                </span>
                              ))}
                            </div>

                            {isExpanded && (
                              <div className="mt-3 rounded-xl bg-subtle border border-border-subtle p-3 text-[11.5px] font-mono overflow-x-auto max-h-48 overflow-y-auto">
                                <div className="text-[10.5px] font-sans font-semibold text-text-secondary mb-1">
                                  Isi Instruksi ({item.slug}):
                                </div>
                                <pre className="whitespace-pre-wrap break-words text-text-primary">
                                  {item.instructionsMarkdown}
                                </pre>
                              </div>
                            )}
                          </div>

                          <div className="mt-3.5 pt-2.5 border-t border-border-subtle/70 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedSkillId(isExpanded ? null : item.id)
                                }
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11.5px] font-medium text-text-secondary hover:text-text-primary hover:bg-subtle transition"
                              >
                                {isExpanded ? (
                                  <>
                                    <ChevronUp className="w-3.5 h-3.5" />
                                    <span>Tutup</span>
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="w-3.5 h-3.5" />
                                    <span>Detail skill.md</span>
                                  </>
                                )}
                              </button>

                              {!item.isOfficial && (
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteCommunitySkill(item)}
                                  className="p-1 rounded-lg text-text-secondary hover:text-rose-600 hover:bg-rose-500/10 transition"
                                  title="Hapus skill komunitas"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              {isInstalled && installedNote ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => onOpenNote(installedNote.id)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium bg-subtle hover:bg-border-subtle/60 text-text-primary transition"
                                  >
                                    <span>Buka di Catatan</span>
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </button>
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Terpasang</span>
                                  </span>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  disabled={installingId === item.id}
                                  onClick={() => void handleInstallSkill(item, false)}
                                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12.5px] font-medium bg-[#2383E2] hover:bg-[#1B6EC2] text-white disabled:opacity-50 transition shadow-xs"
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
            )}

            {/* SUB-TAB 3: UNGGAH KE PUSTAKA (In-page form to publish user skills) */}
            {skillSubTab === 'upload' && (
              <form
                onSubmit={handlePublishSkill}
                className="mt-6 max-w-2xl space-y-4 rounded-2xl border border-border-subtle bg-surface p-5"
              >
                <div>
                  <h2 className="text-[16px] font-semibold text-text-primary">
                    Unggah Skill Anda ke Pustaka
                  </h2>
                  <p className="text-[12.5px] text-text-secondary mt-0.5">
                    Pilih halaman <code className="font-mono">skill.md</code> dari
                    catatan Anda atau tulis di bawah, lalu jelaskan{' '}
                    <strong>skill ini fungsinya apa</strong> agar pengguna lain dapat
                    memahami dan menginstalnya.
                  </p>
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-text-primary mb-1">
                    Ambil dari Halaman Catatan / skill.md di Workspace (Opsional)
                  </label>
                  <select
                    value={selectedSourceNoteId}
                    onChange={(e) => handleSelectSourceNote(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-[13px] bg-subtle/60 border border-border-subtle text-text-primary focus:outline-none focus:border-[#2383E2]"
                  >
                    <option value="">
                      -- Tulis manual atau pilih halaman dari catatan Anda --
                    </option>
                    {allWorkspaceNotesForUpload.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.icon || '📄'} {n.title || 'Tanpa Judul'}
                        {isSkillNote(n) ? ' (skill.md)' : ''}
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
                      onChange={(e) => setUploadIcon(e.target.value)}
                      maxLength={4}
                      className="w-full px-3 py-2 text-center text-lg rounded-xl bg-subtle/60 border border-border-subtle"
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
                      onChange={(e) => setUploadName(e.target.value)}
                      placeholder="Contoh: Asisten Analisis Jurnal & Sitasi"
                      className="w-full px-3 py-2 rounded-xl text-[13px] bg-subtle/60 border border-border-subtle"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <label className="block text-[12px] font-semibold mb-1">
                      Kategori
                    </label>
                    <select
                      value={uploadCategory}
                      onChange={(e) =>
                        setUploadCategory(e.target.value as SkillLibraryCategory)
                      }
                      className="w-full px-3 py-2 rounded-xl text-[13px] bg-subtle/60 border border-border-subtle"
                    >
                      {SKILL_LIBRARY_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-semibold mb-1">
                    Ringkasan Singkat (1 Kalimat)
                  </label>
                  <input
                    type="text"
                    value={uploadSummary}
                    onChange={(e) => setUploadSummary(e.target.value)}
                    placeholder="Contoh: Merangkum paper akademik, mencari referensi via Web Tool, dan menyusun sitasi."
                    className="w-full px-3 py-2 rounded-xl text-[13px] bg-subtle/60 border border-border-subtle"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-semibold mb-1">
                    Penjelasan Fungsi Skill (Skill ini fungsinya apa, cara kerjanya, &amp;
                    kapan digunakan) <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={uploadFunctionDesc}
                    onChange={(e) => setUploadFunctionDesc(e.target.value)}
                    placeholder="Jelaskan secara lengkap fungsi skill ini, masalah apa yang diselesaikan, dan hasil akhir yang diberikan..."
                    className="w-full px-3 py-2 rounded-xl text-[13px] bg-subtle/60 border border-border-subtle"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-semibold mb-1">
                    Contoh Kegunaan / Skenario Pemakaian (Satu baris per poin)
                  </label>
                  <textarea
                    rows={3}
                    value={uploadUseCasesText}
                    onChange={(e) => setUploadUseCasesText(e.target.value)}
                    placeholder={`Mencari referensi terbaru tentang topik riset\nMerapikan catatan kuliah menjadi tabel ringkasan`}
                    className="w-full px-3 py-2 rounded-xl text-[12.5px] bg-subtle/60 border border-border-subtle"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-semibold mb-1">
                    Isi Instruksi <code className="font-mono">skill.md</code>
                  </label>
                  <textarea
                    rows={5}
                    value={uploadInstructions}
                    onChange={(e) => setUploadInstructions(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-[12.5px] font-mono bg-subtle/60 border border-border-subtle"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] font-semibold mb-1">
                      Tag (Pisahkan dengan koma)
                    </label>
                    <input
                      type="text"
                      value={uploadTagsText}
                      onChange={(e) => setUploadTagsText(e.target.value)}
                      placeholder="riset, jurnal, iot, diagram"
                      className="w-full px-3 py-2 rounded-xl text-[12.5px] bg-subtle/60 border border-border-subtle"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold mb-1">
                      URL Koneksi / Webhook API (Opsional)
                    </label>
                    <input
                      type="url"
                      value={uploadConnectionUrl}
                      onChange={(e) => setUploadConnectionUrl(e.target.value)}
                      placeholder="https://api.example.com/webhook"
                      className="w-full px-3 py-2 rounded-xl text-[12.5px] font-mono bg-subtle/60 border border-border-subtle"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setSkillSubTab('discover')}
                    className="px-4 py-2 rounded-lg text-[13px] font-medium text-text-secondary hover:bg-subtle transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isPublishing}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-[13px] font-medium bg-[#2383E2] hover:bg-[#1B6EC2] text-white disabled:opacity-50 transition"
                  >
                    {isPublishing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CloudUpload className="w-4 h-4" />
                    )}
                    <span>Unggah ke Pustaka</span>
                  </button>
                </div>
              </form>
            )}
          </>
        ) : (
          /* =============================================================== */
          /* OTHER TOP TABS: TERBARU, FAVORIT, BERSAMA, PRIVAT, SEMUA        */
          /* =============================================================== */
          <div className="mt-6">
            {notesForCurrentTopTab.length === 0 ? (
              <div className="py-20 text-center text-text-secondary text-[13.5px]">
                Belum ada halaman catatan di bagian ini.
              </div>
            ) : (
              <div className="divide-y divide-border-subtle/70 border border-border-subtle rounded-2xl bg-surface overflow-hidden">
                {notesForCurrentTopTab.map((note) => (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() => onOpenNote(note.id)}
                    className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-subtle/50 transition text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-lg leading-none shrink-0">
                        {note.icon || '📄'}
                      </span>
                      <span className="text-[14px] font-medium text-text-primary truncate">
                        {note.title || 'Tanpa Judul'}
                      </span>
                      {isSkillNote(note) && (
                        <span className="px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-sky-500/10 text-sky-700 dark:text-sky-300">
                          Skill
                        </span>
                      )}
                    </div>
                    <span className="text-[12px] text-text-secondary shrink-0">
                      {new Date(note.updatedAt).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short'
                      })}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
