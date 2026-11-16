'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import katex from 'katex';
import {
  ArrowDown,
  ArrowUp,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Cloud,
  Code2,
  Copy,
  Database,
  Download,
  Eye,
  FilePlus2,
  FileText,
  Globe,
  GripVertical,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Lightbulb,
  List,
  ListOrdered,
  Loader2,
  Lock,
  LogOut,
  MessageSquare,
  Minus,
  PanelLeft,
  Pencil,
  Plus,
  Printer,
  Quote,
  Search,
  Send,
  Settings,
  Share2,
  Sigma,
  Sparkles,
  Star,
  Trash2,
  Type,
  UploadCloud
} from 'lucide-react';
import { db } from '../../db/database';
import { useMiu } from '../../context/MiuContext';
import {
  deleteNoteFromNeon,
  getCloudStatusSnapshot,
  isNeonConfigured,
  saveNoteCommentsToNeon,
  saveNoteToNeon,
  syncCloudStatus,
  uploadImageToCloudinary
} from '../../services/cloudServices';
import type {
  BlockType,
  NoteBlock,
  NoteComment,
  NoteRecord,
  NoteShareSettings,
  SharePermission
} from '../../types/miu';
import { parseMarkdownToNotionBlocks, renderInlineMarkdown } from '../../utils/markdown';
import { PdfDocumentPreview, processAndUploadPdf } from '../../utils/pdfHelper';
import { NotesAuthModal } from './NotesAuthModal';
import { ShareNoteModal } from './ShareNoteModal';

const PAGE_ICONS = [
  '📄', '📝', '📘', '💡', '⚡', '🧠', '🎓', '🧪',
  '📊', '💻', '🚀', '🔬', '📐', '🗂️', '🎯', '✨'
];

const COVER_PRESETS = [
  { id: 'sky', label: 'Sky Blue', css: 'linear-gradient(120deg, #0ea5e9 0%, #6366f1 100%)' },
  { id: 'emerald', label: 'Emerald Mint', css: 'linear-gradient(120deg, #10b981 0%, #0ea5e9 100%)' },
  { id: 'sunset', label: 'Warm Sunset', css: 'linear-gradient(120deg, #f59e0b 0%, #ec4899 100%)' },
  { id: 'violet', label: 'Deep Violet', css: 'linear-gradient(120deg, #8b5cf6 0%, #ec4899 100%)' },
  { id: 'espresso', label: 'Warm Espresso', css: 'linear-gradient(120deg, #44403c 0%, #78716c 100%)' },
  { id: 'ocean', label: 'Nordic Ocean', css: 'linear-gradient(120deg, #1e293b 0%, #0284c7 100%)' }
];

const SLASH_OPTIONS: Array<{
  type: BlockType;
  label: string;
  shortcut: string;
  desc: string;
  Icon: React.FC<{ className?: string }>;
}> = [
  { type: 'text', label: 'Teks', shortcut: 'p', desc: 'Paragraf teks biasa', Icon: Type },
  { type: 'h1', label: 'Heading 1', shortcut: '#', desc: 'Judul bagian besar', Icon: Heading1 },
  { type: 'h2', label: 'Heading 2', shortcut: '##', desc: 'Judul bagian sedang', Icon: Heading2 },
  { type: 'h3', label: 'Heading 3', shortcut: '###', desc: 'Judul bagian kecil', Icon: Heading3 },
  { type: 'todo', label: 'To-do List', shortcut: '[]', desc: 'Checklist tugas', Icon: CheckSquare },
  { type: 'bullet', label: 'Bulleted List', shortcut: '-', desc: 'Daftar poin bullet', Icon: List },
  { type: 'numbered', label: 'Numbered List', shortcut: '1.', desc: 'Daftar poin bernomor', Icon: ListOrdered },
  { type: 'toggle', label: 'Toggle List', shortcut: '>', desc: 'Lipatan materi buka-tutup', Icon: ChevronRight },
  { type: 'image', label: 'Gambar', shortcut: 'img', desc: 'Unggah gambar ke Cloud Catatan', Icon: ImageIcon },
  { type: 'pdf', label: 'Dokumen PDF', shortcut: 'pdf', desc: 'Unggah file PDF & ekstrak teks untuk AI', Icon: FileText },
  { type: 'subpage', label: 'Subhalaman Baru', shortcut: 'sub', desc: 'Buat subhalaman di dalam halaman ini', Icon: FilePlus2 },
  { type: 'callout', label: 'Callout', shortcut: '!', desc: 'Kotak sorotan penting', Icon: Lightbulb },
  { type: 'quote', label: 'Quote', shortcut: '"', desc: 'Kutipan teks', Icon: Quote },
  { type: 'divider', label: 'Divider', shortcut: '---', desc: 'Garis pemisah', Icon: Minus },
  { type: 'code', label: 'Code Block', shortcut: '```', desc: 'Blok kode program', Icon: Code2 },
  { type: 'math', label: 'Rumus LaTeX', shortcut: '$$', desc: 'Persamaan matematika KaTeX', Icon: Sigma }
];

const MathPreview: React.FC<{ tex: string }> = ({ tex }) => {
  const html = useMemo(() => {
    try {
      return katex.renderToString(tex || '\\text{Klik untuk mengetik rumus LaTeX...}', {
        throwOnError: false,
        displayMode: true
      });
    } catch {
      return tex;
    }
  }, [tex]);

  return <div dangerouslySetInnerHTML={{ __html: html }} className="py-1 overflow-x-auto" />;
};

export const BlockEditor: React.FC = () => {
  const {
    currentUser,
    isPublicShareAccess,
    loginGoogleUser,
    logoutGoogleUser,
    setViewMode,
    activeSemesterId,
    activeCourseId,
    activeNoteId,
    setActiveNoteId,
    isAIDrawerOpen,
    setIsAIDrawerOpen,
    triggerInlineAIExplain
  } = useMiu();

  const allNotes = useLiveQuery(
    async () => {
      const list = await db.notes.toArray();
      return list.sort((a, b) => a.createdAt - b.createdAt);
    },
    [],
    []
  );
  const queriedNote = useLiveQuery(() => db.notes.get(activeNoteId), [activeNoteId]);
  const activeNote = queriedNote || allNotes[0];

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const [showCloudSettingsModal, setShowCloudSettingsModal] = useState(false);
  const [showLoginModalForGuest, setShowLoginModalForGuest] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showCommentsPanel, setShowCommentsPanel] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [collapsedParents, setCollapsedParents] = useState<Record<string, boolean>>({});
  const [localToggleOverrides, setLocalToggleOverrides] = useState<Record<string, boolean>>({});
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced'>('idle');
  const [uploadingBlockId, setUploadingBlockId] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);

  const [slashState, setSlashState] = useState<{
    blockId: string;
    query: string;
    selectedIndex: number;
  } | null>(null);
  const [menuBlockId, setMenuBlockId] = useState<string | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editingMathId, setEditingMathId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pendingFocusBlockId, setPendingFocusBlockId] = useState<string | null>(null);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
  const [lastSelectedBlockId, setLastSelectedBlockId] = useState<string | null>(null);
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const [dropTargetBlock, setDropTargetBlock] = useState<{
    blockId: string;
    position: 'before' | 'after';
  } | null>(null);
  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null);
  const [dropTargetNoteId, setDropTargetNoteId] = useState<string | null>(null);
  const [isFileDragOverEditor, setIsFileDragOverEditor] = useState(false);

  const blockRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({});
  const neonDebounceRef = useRef<number | null>(null);

  // Clear block selection when switching notes
  useEffect(() => {
    setSelectedBlockIds([]);
    setLastSelectedBlockId(null);
    setIsSelectMode(false);
  }, [activeNoteId]);

  useEffect(() => {
    if (!pendingFocusBlockId) return;
    setEditingBlockId(pendingFocusBlockId);
    const timer = window.setTimeout(() => {
      const el = blockRefs.current[pendingFocusBlockId];
      if (el) {
        el.focus();
        if ('setSelectionRange' in el) {
          const len = el.value.length;
          el.setSelectionRange(len, len);
        }
      }
      setPendingFocusBlockId(null);
    }, 20);
    return () => window.clearTimeout(timer);
  }, [pendingFocusBlockId, activeNote?.blocks]);

  // Strict per-account isolation: My Notes vs Notes Shared With Me
  const myNotes = useMemo(
    () =>
      allNotes.filter((n) => {
        if (currentUser) {
          return !n.ownerId || n.ownerId === currentUser.id;
        }
        return !n.ownerId;
      }),
    [allNotes, currentUser]
  );

  const sharedWithMeNotes = useMemo(
    () =>
      allNotes.filter((n) => {
        if (currentUser) {
          return Boolean(n.ownerId && n.ownerId !== currentUser.id);
        }
        return Boolean(n.ownerId);
      }),
    [allNotes, currentUser]
  );

  const favoriteNotes = useMemo(() => myNotes.filter((n) => n.isFavorite), [myNotes]);

  const visibleNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return myNotes;
    return allNotes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.blocks.some((b) => b.content.toLowerCase().includes(q))
    );
  }, [myNotes, allNotes, searchQuery]);

  // Effective permission role for active note (inherits from ancestor shared page if subpage)
  const effectiveRole: 'owner' | SharePermission = useMemo(() => {
    if (!activeNote) return 'owner';
    if (currentUser && (!activeNote.ownerId || activeNote.ownerId === currentUser.id)) {
      return 'owner';
    }
    if (!currentUser && !activeNote.ownerId) {
      return 'owner';
    }

    // Walk from activeNote up to root ancestor to resolve collaborator/public share permission
    let curr: NoteRecord | undefined = activeNote;
    const visited = new Set<string>();
    while (curr && !visited.has(curr.id)) {
      visited.add(curr.id);
      if (currentUser && curr.shareSettings?.collaborators) {
        const collabMatch = curr.shareSettings.collaborators.find(
          (c) => c.email.toLowerCase() === currentUser.email.toLowerCase()
        );
        if (collabMatch) return collabMatch.role;
      }
      if (curr.shareSettings?.isPublicLink) {
        return curr.shareSettings.publicRole;
      }
      curr = curr.parentId ? allNotes.find((n) => n.id === curr?.parentId) : undefined;
    }
    return 'view';
  }, [activeNote, allNotes, currentUser]);

  const isOwner = effectiveRole === 'owner';
  const canEdit = effectiveRole === 'owner' || effectiveRole === 'edit';
  const canComment =
    effectiveRole === 'owner' || effectiveRole === 'edit' || effectiveRole === 'comment';

  const childSubpages = useMemo(
    () => (activeNote ? allNotes.filter((n) => n.parentId === activeNote.id) : []),
    [allNotes, activeNote]
  );

  const breadcrumbPath = useMemo(() => {
    if (!activeNote) return [];
    const chain: NoteRecord[] = [];
    const visited = new Set<string>();
    let curr: NoteRecord | undefined = activeNote;
    while (curr && !visited.has(curr.id)) {
      visited.add(curr.id);
      chain.unshift(curr);
      curr = curr.parentId ? allNotes.find((n) => n.id === curr?.parentId) : undefined;
    }
    return chain;
  }, [activeNote, allNotes]);

  const filteredSlashOptions = useMemo(() => {
    if (!slashState) return SLASH_OPTIONS;
    const q = slashState.query.toLowerCase();
    if (!q) return SLASH_OPTIONS;
    return SLASH_OPTIONS.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.type.toLowerCase().includes(q) ||
        opt.shortcut.toLowerCase().includes(q) ||
        opt.desc.toLowerCase().includes(q)
    );
  }, [slashState]);

  // Debounced Neon Postgres Sync helper
  const scheduleNeonSave = (noteToSave: NoteRecord) => {
    const targetOwner = noteToSave.ownerId || currentUser?.id;
    if (!targetOwner || !isNeonConfigured()) return;
    setSyncStatus('syncing');
    if (neonDebounceRef.current) {
      window.clearTimeout(neonDebounceRef.current);
    }
    neonDebounceRef.current = window.setTimeout(async () => {
      const ok = await saveNoteToNeon(targetOwner, noteToSave);
      setSyncStatus(ok ? 'synced' : 'idle');
    }, 450);
  };

  const updateNote = async (patch: Partial<NoteRecord>) => {
    if (!activeNote || !canEdit) return;
    const updatedAt = Date.now();
    const nextNote: NoteRecord = {
      ...activeNote,
      ...patch,
      updatedAt
    };
    await db.notes.update(activeNote.id, {
      ...patch,
      updatedAt
    });
    scheduleNeonSave(nextNote);
  };

  const handleUpdateShareSettings = async (settings: NoteShareSettings) => {
    if (!activeNote || !isOwner) return;
    const updatedAt = Date.now();
    const nextNote: NoteRecord = {
      ...activeNote,
      shareSettings: settings,
      updatedAt
    };
    await db.notes.update(activeNote.id, {
      shareSettings: settings,
      updatedAt
    });
    scheduleNeonSave(nextNote);
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeNote || !canComment || !newCommentText.trim()) return;
    const comment: NoteComment = {
      id: `cmt-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      authorId: currentUser?.id || 'guest',
      authorName: currentUser?.name || 'Pengguna Tamu',
      authorEmail: currentUser?.email || '',
      authorPicture: currentUser?.picture,
      content: newCommentText.trim(),
      createdAt: Date.now()
    };
    const nextComments = [...(activeNote.comments || []), comment];
    const updatedAt = Date.now();
    setNewCommentText('');
    await db.notes.update(activeNote.id, { comments: nextComments, updatedAt });
    if (canEdit) {
      scheduleNeonSave({ ...activeNote, comments: nextComments, updatedAt });
    } else {
      await saveNoteCommentsToNeon(activeNote.id, nextComments);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!activeNote) return;
    const target = (activeNote.comments || []).find((c) => c.id === commentId);
    const isCommentAuthor = Boolean(currentUser && target?.authorId === currentUser.id);
    if (!isOwner && !isCommentAuthor) return;

    const nextComments = (activeNote.comments || []).filter((c) => c.id !== commentId);
    const updatedAt = Date.now();
    await db.notes.update(activeNote.id, { comments: nextComments, updatedAt });
    if (canEdit) {
      scheduleNeonSave({ ...activeNote, comments: nextComments, updatedAt });
    } else {
      await saveNoteCommentsToNeon(activeNote.id, nextComments);
    }
  };

  const updateNoteBlocks = async (nextBlocks: NoteBlock[]) => {
    if (!canEdit) return;
    await updateNote({ blocks: nextBlocks });
  };

  // Create a clean blank Notion page (root or nested subpage) & sync to Neon
  const handleCreateNote = async (
    parentId: string | null = null,
    switchToNew = true
  ): Promise<string | null> => {
    if (!parentId && !currentUser) return null;
    if (parentId && !canEdit) return null;

    const parentNote = parentId ? await db.notes.get(parentId) : undefined;
    const firstBlockId = `blk-${Date.now()}-1`;
    const newId = `note-${Date.now()}`;
    const now = Date.now();

    const newNote: NoteRecord = {
      id: newId,
      ownerId: parentNote?.ownerId || currentUser?.id,
      ownerEmail: parentNote?.ownerEmail || currentUser?.email || '',
      ownerName: parentNote?.ownerName || currentUser?.name || '',
      parentId,
      semesterId: activeSemesterId || 'sem-1',
      courseId: activeCourseId || 'course-default',
      title: '',
      icon: parentId ? '📑' : '📄',
      isFavorite: false,
      createdAt: now,
      updatedAt: now,
      blocks: [
        {
          id: firstBlockId,
          type: 'text',
          content: ''
        }
      ]
    };

    await db.notes.add(newNote);
    scheduleNeonSave(newNote);

    if (parentId) {
      // Expand parent in sidebar automatically so new subpage is visible
      setCollapsedParents((prev) => ({ ...prev, [parentId]: false }));
      if (parentNote && switchToNew) {
        const hasSubBlock = parentNote.blocks.some((b) => b.subpageId === newId);
        if (!hasSubBlock) {
          const nextParentBlocks: NoteBlock[] = [
            ...parentNote.blocks,
            {
              id: `blk-sub-${now}`,
              type: 'subpage',
              subpageId: newId,
              subpageIcon: '📑',
              content: 'Subhalaman Baru'
            }
          ];
          await db.notes.update(parentId, { blocks: nextParentBlocks, updatedAt: now });
          scheduleNeonSave({ ...parentNote, blocks: nextParentBlocks, updatedAt: now });
        }
      }
    }

    if (switchToNew) {
      setActiveNoteId(newId);
    }
    setSlashState(null);
    setMenuBlockId(null);
    return newId;
  };

  const handleDuplicateNote = async (note: NoteRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    const isNoteOwner = !note.ownerId || (currentUser && note.ownerId === currentUser.id);
    if (!isNoteOwner) return;

    const newId = `note-${Date.now()}`;
    const now = Date.now();
    const duplicated: NoteRecord = {
      ...note,
      id: newId,
      ownerId: currentUser?.id || note.ownerId,
      ownerEmail: currentUser?.email || note.ownerEmail || '',
      ownerName: currentUser?.name || note.ownerName || '',
      title: note.title ? `${note.title} (Salinan)` : '',
      createdAt: now,
      updatedAt: now,
      blocks: note.blocks.map((b, i) => ({
        ...b,
        id: `blk-${now}-${i}`
      }))
    };
    await db.notes.add(duplicated);
    setActiveNoteId(newId);
    scheduleNeonSave(duplicated);
  };

  const handleDeleteNote = async (note: NoteRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    const isNoteOwner = !note.ownerId || (currentUser && note.ownerId === currentUser.id);
    if (!isNoteOwner) return;

    // Gather target note and all nested subpage descendants
    const idsToDelete = new Set<string>([note.id]);
    let added = true;
    while (added) {
      added = false;
      for (const candidate of allNotes) {
        if (candidate.parentId && idsToDelete.has(candidate.parentId) && !idsToDelete.has(candidate.id)) {
          idsToDelete.add(candidate.id);
          added = true;
        }
      }
    }

    if (myNotes.length <= idsToDelete.size) {
      // Keep one clean root page
      for (const delId of idsToDelete) {
        if (delId !== note.id) {
          await db.notes.delete(delId);
          if (currentUser) void deleteNoteFromNeon(currentUser.id, delId);
        }
      }
      const resetNote: NoteRecord = {
        ...note,
        parentId: null,
        title: '',
        icon: '📄',
        cover: '',
        isFavorite: false,
        updatedAt: Date.now(),
        blocks: [{ id: `blk-${Date.now()}`, type: 'text', content: '' }]
      };
      await db.notes.put(resetNote);
      scheduleNeonSave(resetNote);
      setActiveNoteId(resetNote.id);
      return;
    }

    for (const delId of idsToDelete) {
      await db.notes.delete(delId);
      if (currentUser) {
        void deleteNoteFromNeon(currentUser.id, delId);
      }
    }

    if (idsToDelete.has(activeNoteId)) {
      const remaining = myNotes.filter((n) => !idsToDelete.has(n.id));
      if (remaining[0]) setActiveNoteId(remaining[0].id);
    }
  };

  const patchBlockByIdInDb = async (
    noteId: string,
    blockId: string,
    patch: Partial<NoteBlock>
  ) => {
    const freshNote = await db.notes.get(noteId);
    if (!freshNote) return;
    const updatedAt = Date.now();
    const nextBlocks = freshNote.blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b));
    await db.notes.update(noteId, { blocks: nextBlocks, updatedAt });
    scheduleNeonSave({ ...freshNote, blocks: nextBlocks, updatedAt });
  };

  // Upload image file to Cloudinary for a specific block
  const handleUploadImageForBlock = async (blockId: string, file: File) => {
    if (!activeNote || !canEdit) return;
    const targetNoteId = activeNote.id;
    setUploadingBlockId(blockId);
    try {
      const { url } = await uploadImageToCloudinary(file);
      await patchBlockByIdInDb(targetNoteId, blockId, {
        type: 'image',
        content: url,
        caption: file.name.replace(/\.[^/.]+$/, '')
      });
    } catch {
      // ignore
    } finally {
      setUploadingBlockId(null);
    }
  };

  // Upload PDF file to Cloudinary & extract text for AI reading
  const handleUploadPdfForBlock = async (blockId: string, file: File) => {
    if (!activeNote || !canEdit) return;
    const targetNoteId = activeNote.id;
    setUploadingBlockId(blockId);
    try {
      const { url, fileName, text, pages } = await processAndUploadPdf(file);
      await patchBlockByIdInDb(targetNoteId, blockId, {
        type: 'pdf',
        content: url,
        fileName,
        pdfText: text,
        pdfPages: pages,
        caption: fileName,
        toggleOpen: true
      });
    } catch {
      // ignore
    } finally {
      setUploadingBlockId(null);
    }
  };

  // Upload custom cover image to Cloudinary
  const handleUploadCoverImage = async (file: File) => {
    if (!canEdit) return;
    setUploadingCover(true);
    try {
      const { url } = await uploadImageToCloudinary(file);
      await updateNote({ cover: `url(${url}) center/cover no-repeat` });
      setShowCoverPicker(false);
    } catch {
      // ignore
    } finally {
      setUploadingCover(false);
    }
  };

  const handleBlockChange = async (id: string, patch: Partial<NoteBlock>) => {
    if (!activeNote || !canEdit) return;

    if (typeof patch.content === 'string') {
      const val = patch.content;

      const mdTriggers: Array<{ prefix: string; type: BlockType; extra?: Partial<NoteBlock> }> = [
        { prefix: '# ', type: 'h1' },
        { prefix: '## ', type: 'h2' },
        { prefix: '### ', type: 'h3' },
        { prefix: '- ', type: 'bullet' },
        { prefix: '* ', type: 'bullet' },
        { prefix: '1. ', type: 'numbered' },
        { prefix: '[] ', type: 'todo', extra: { checked: false } },
        { prefix: '[ ] ', type: 'todo', extra: { checked: false } },
        { prefix: '[x] ', type: 'todo', extra: { checked: true } },
        { prefix: '> ', type: 'quote' },
        { prefix: '>> ', type: 'toggle', extra: { toggleOpen: true, toggleBody: '' } }
      ];

      for (const trig of mdTriggers) {
        if (val.startsWith(trig.prefix)) {
          const stripped = val.slice(trig.prefix.length);
          const next = activeNote.blocks.map((b) =>
            b.id === id ? { ...b, type: trig.type, content: stripped, ...(trig.extra || {}) } : b
          );
          setSlashState(null);
          await updateNoteBlocks(next);
          setPendingFocusBlockId(id);
          return;
        }
      }

      if (val === '---') {
        const newTextId = `blk-${Date.now()}`;
        const idx = activeNote.blocks.findIndex((b) => b.id === id);
        const copy = [...activeNote.blocks];
        copy[idx] = { ...copy[idx], type: 'divider', content: '' };
        copy.splice(idx + 1, 0, { id: newTextId, type: 'text', content: '' });
        setSlashState(null);
        await updateNoteBlocks(copy);
        setPendingFocusBlockId(newTextId);
        return;
      }

      if (val.startsWith('/') && !val.includes(' ')) {
        setSlashState({
          blockId: id,
          query: val.slice(1),
          selectedIndex: 0
        });
      } else if (slashState?.blockId === id) {
        setSlashState(null);
      }
    }

    const next = activeNote.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b));
    await updateNoteBlocks(next);
  };

  const applySlashCommand = async (blockId: string, type: BlockType) => {
    if (!activeNote || !canEdit) return;
    setSlashState(null);

    if (type === 'subpage') {
      const newSubId = await handleCreateNote(activeNote.id, false);
      if (newSubId) {
        const next = activeNote.blocks.map((b) =>
          b.id === blockId
            ? {
                ...b,
                type: 'subpage' as BlockType,
                subpageId: newSubId,
                subpageIcon: '📑',
                content: ''
              }
            : b
        );
        await updateNoteBlocks(next);
        setActiveNoteId(newSubId);
      }
      return;
    }

    if (type === 'divider') {
      const nextTextId = `blk-${Date.now()}`;
      const idx = activeNote.blocks.findIndex((b) => b.id === blockId);
      const copy = [...activeNote.blocks];
      copy[idx] = { id: blockId, type: 'divider', content: '' };
      copy.splice(idx + 1, 0, { id: nextTextId, type: 'text', content: '' });
      await updateNoteBlocks(copy);
      setPendingFocusBlockId(nextTextId);
      return;
    }

    const next = activeNote.blocks.map((b) => {
      if (b.id !== blockId) return b;
      const cleanContent = b.content.startsWith('/') ? '' : b.content;
      return {
        ...b,
        type,
        content: type === 'image' || type === 'pdf' ? '' : cleanContent,
        ...(type === 'todo' ? { checked: Boolean(b.checked) } : {}),
        ...(type === 'callout' ? { calloutIcon: b.calloutIcon || '💡' } : {}),
        ...(type === 'code' ? { language: b.language || 'javascript' } : {}),
        ...(type === 'toggle' ? { toggleOpen: true, toggleBody: b.toggleBody || '' } : {})
      };
    });

    await updateNoteBlocks(next);
    if (type !== 'image' && type !== 'pdf') {
      setPendingFocusBlockId(blockId);
    }
  };

  const handleAddBlockAfter = async (afterId?: string, type: BlockType = 'text') => {
    if (!activeNote || !canEdit) return;
    const newId = `blk-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    const newBlock: NoteBlock = {
      id: newId,
      type,
      content: '',
      ...(type === 'todo' ? { checked: false } : {}),
      ...(type === 'callout' ? { calloutIcon: '💡' } : {}),
      ...(type === 'code' ? { language: 'javascript' } : {}),
      ...(type === 'toggle' ? { toggleOpen: true, toggleBody: '' } : {})
    };
    const blocks = [...activeNote.blocks];
    if (!afterId) {
      blocks.push(newBlock);
    } else {
      const idx = blocks.findIndex((b) => b.id === afterId);
      blocks.splice(idx + 1, 0, newBlock);
    }
    await updateNoteBlocks(blocks);
    setPendingFocusBlockId(newId);
  };

  const handleDuplicateBlock = async (block: NoteBlock) => {
    if (!activeNote || !canEdit) return;
    const newId = `blk-${Date.now()}`;
    const idx = activeNote.blocks.findIndex((b) => b.id === block.id);
    const copy = [...activeNote.blocks];
    copy.splice(idx + 1, 0, { ...block, id: newId });
    setMenuBlockId(null);
    await updateNoteBlocks(copy);
    setPendingFocusBlockId(newId);
  };

  const handleDeleteBlock = async (id: string) => {
    if (!activeNote || !canEdit) return;
    setMenuBlockId(null);
    if (activeNote.blocks.length <= 1) {
      await updateNoteBlocks([{ id: activeNote.blocks[0].id, type: 'text', content: '' }]);
      return;
    }
    const idx = activeNote.blocks.findIndex((b) => b.id === id);
    const prevBlock = activeNote.blocks[Math.max(0, idx - 1)];
    await updateNoteBlocks(activeNote.blocks.filter((b) => b.id !== id));
    if (prevBlock) setPendingFocusBlockId(prevBlock.id);
  };

  const toggleSelectBlock = (blockId: string, shiftKey = false) => {
    if (!activeNote || !canEdit) return;
    if (shiftKey && lastSelectedBlockId && lastSelectedBlockId !== blockId) {
      const startIdx = activeNote.blocks.findIndex((b) => b.id === lastSelectedBlockId);
      const endIdx = activeNote.blocks.findIndex((b) => b.id === blockId);
      if (startIdx !== -1 && endIdx !== -1) {
        const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
        const rangeIds = activeNote.blocks.slice(from, to + 1).map((b) => b.id);
        setSelectedBlockIds((prev) => Array.from(new Set([...prev, ...rangeIds])));
        setLastSelectedBlockId(blockId);
        return;
      }
    }

    setSelectedBlockIds((prev) =>
      prev.includes(blockId) ? prev.filter((id) => id !== blockId) : [...prev, blockId]
    );
    setLastSelectedBlockId(blockId);
  };

  const selectBlocksFromHereToEnd = (blockId: string) => {
    if (!activeNote || !canEdit) return;
    const startIdx = activeNote.blocks.findIndex((b) => b.id === blockId);
    if (startIdx === -1) return;
    const rangeIds = activeNote.blocks.slice(startIdx).map((b) => b.id);
    setIsSelectMode(true);
    setSelectedBlockIds(rangeIds);
    setLastSelectedBlockId(blockId);
    setMenuBlockId(null);
  };

  const handleSelectAllBlocks = () => {
    if (!activeNote || !canEdit) return;
    if (selectedBlockIds.length === activeNote.blocks.length) {
      setSelectedBlockIds([]);
    } else {
      setSelectedBlockIds(activeNote.blocks.map((b) => b.id));
    }
  };

  const handleDeleteSelectedBlocks = async () => {
    if (!activeNote || !canEdit || selectedBlockIds.length === 0) return;
    const selectedSet = new Set(selectedBlockIds);
    const remaining = activeNote.blocks.filter((b) => !selectedSet.has(b.id));
    const nextBlocks: NoteBlock[] =
      remaining.length > 0
        ? remaining
        : [{ id: `blk-${Date.now()}`, type: 'text', content: '' }];
    await updateNoteBlocks(nextBlocks);
    setSelectedBlockIds([]);
    setLastSelectedBlockId(null);
    setIsSelectMode(false);
  };

  const handleMoveBlock = async (id: string, dir: -1 | 1) => {
    if (!activeNote || !canEdit) return;
    const currentIdx = activeNote.blocks.findIndex((b) => b.id === id);
    const target = currentIdx + dir;
    if (currentIdx < 0 || target < 0 || target >= activeNote.blocks.length) return;
    const copy = [...activeNote.blocks];
    const [removed] = copy.splice(currentIdx, 1);
    copy.splice(target, 0, removed);
    setMenuBlockId(null);
    await updateNoteBlocks(copy);
  };

  const handleBlockKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    block: NoteBlock
  ) => {
    if (slashState && slashState.blockId === block.id && filteredSlashOptions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashState((prev) =>
          prev
            ? { ...prev, selectedIndex: (prev.selectedIndex + 1) % filteredSlashOptions.length }
            : null
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashState((prev) =>
          prev
            ? {
                ...prev,
                selectedIndex:
                  (prev.selectedIndex - 1 + filteredSlashOptions.length) %
                  filteredSlashOptions.length
              }
            : null
        );
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const chosen = filteredSlashOptions[slashState.selectedIndex] || filteredSlashOptions[0];
        if (chosen) void applySlashCommand(block.id, chosen.type);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSlashState(null);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey && block.type !== 'code' && block.type !== 'callout') {
      e.preventDefault();
      if (
        !block.content.trim() &&
        ['bullet', 'numbered', 'todo', 'quote'].includes(block.type)
      ) {
        void handleBlockChange(block.id, { type: 'text' });
        return;
      }
      const nextType: BlockType = ['bullet', 'numbered', 'todo'].includes(block.type)
        ? block.type
        : 'text';
      void handleAddBlockAfter(block.id, nextType);
      return;
    }

    if (e.key === 'Backspace' && block.content === '') {
      e.preventDefault();
      if (block.type !== 'text') {
        void handleBlockChange(block.id, { type: 'text' });
      } else {
        void handleDeleteBlock(block.id);
      }
    }
  };

  const handleExportMarkdown = () => {
    if (!activeNote) return;
    const mdLines = [`# ${activeNote.title || 'Tanpa Judul'}\n`];
    for (const b of activeNote.blocks) {
      if (b.type === 'h1') mdLines.push(`# ${b.content}\n`);
      else if (b.type === 'h2') mdLines.push(`## ${b.content}\n`);
      else if (b.type === 'h3') mdLines.push(`### ${b.content}\n`);
      else if (b.type === 'bullet') mdLines.push(`- ${b.content}`);
      else if (b.type === 'numbered') mdLines.push(`1. ${b.content}`);
      else if (b.type === 'todo') mdLines.push(`- [${b.checked ? 'x' : ' '}] ${b.content}`);
      else if (b.type === 'toggle')
        mdLines.push(`<details><summary>${b.content}</summary>\n\n${b.toggleBody || ''}\n</details>\n`);
      else if (b.type === 'callout') mdLines.push(`> ${b.calloutIcon || '💡'} ${b.content}\n`);
      else if (b.type === 'quote') mdLines.push(`> ${b.content}\n`);
      else if (b.type === 'divider') mdLines.push(`---\n`);
      else if (b.type === 'code') mdLines.push(`\`\`\`${b.language || ''}\n${b.content}\n\`\`\`\n`);
      else if (b.type === 'math') mdLines.push(`$$\n${b.content}\n$$\n`);
      else if (b.type === 'image') mdLines.push(`![${b.caption || 'Image'}](${b.content})\n`);
      else mdLines.push(`${b.content}\n`);
    }
    const blob = new Blob([mdLines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(activeNote.title || 'catatan').toLowerCase().replace(/\s+/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Reorder single block or selected group via Drag & Drop
  const handleReorderBlocks = async (
    sourceId: string,
    targetId: string,
    position: 'before' | 'after'
  ) => {
    if (!activeNote || !canEdit || sourceId === targetId) return;

    const movingIds = selectedBlockIds.includes(sourceId)
      ? selectedBlockIds
      : [sourceId];
    const movingSet = new Set(movingIds);
    if (movingSet.has(targetId)) return;

    const movingBlocks = activeNote.blocks.filter((b) => movingSet.has(b.id));
    const remainingBlocks = activeNote.blocks.filter((b) => !movingSet.has(b.id));
    const targetIdx = remainingBlocks.findIndex((b) => b.id === targetId);
    if (targetIdx === -1) return;

    const insertIdx = position === 'before' ? targetIdx : targetIdx + 1;
    remainingBlocks.splice(insertIdx, 0, ...movingBlocks);
    await updateNoteBlocks(remainingBlocks);
  };

  // Move a page in the sidebar to become a subpage (or back to root if targetParentId is null)
  const handleMoveNoteParent = async (sourceId: string, targetParentId: string | null) => {
    if (!sourceId || sourceId === targetParentId) return;
    const sourceNote = allNotes.find((n) => n.id === sourceId);
    if (!sourceNote) return;
    const isSourceOwner =
      !sourceNote.ownerId || (currentUser && sourceNote.ownerId === currentUser.id);
    if (!isSourceOwner) return;

    // Prevent circular hierarchy (cannot move a parent into its own descendant)
    if (targetParentId) {
      let ancestorId: string | null | undefined = targetParentId;
      const visited = new Set<string>();
      while (ancestorId && !visited.has(ancestorId)) {
        if (ancestorId === sourceId) return;
        visited.add(ancestorId);
        ancestorId = allNotes.find((n) => n.id === ancestorId)?.parentId;
      }
      setCollapsedParents((prev) => ({ ...prev, [targetParentId]: false }));
    }

    const updatedAt = Date.now();
    await db.notes.update(sourceId, { parentId: targetParentId, updatedAt });
    scheduleNeonSave({ ...sourceNote, parentId: targetParentId, updatedAt });
  };

  // Insert one or more blocks at a specific drop position (or at end of active note)
  const insertBlocksAtDropPoint = async (
    newBlocks: NoteBlock[],
    targetBlockId?: string,
    position: 'before' | 'after' = 'after'
  ) => {
    if (!activeNote || newBlocks.length === 0) return;
    const freshNote = (await db.notes.get(activeNote.id)) || activeNote;
    const copy = [...freshNote.blocks];
    if (targetBlockId) {
      const idx = copy.findIndex((b) => b.id === targetBlockId);
      if (idx !== -1) {
        copy.splice(position === 'before' ? idx : idx + 1, 0, ...newBlocks);
        await updateNoteBlocks(copy);
        return;
      }
    }
    const base =
      copy.length === 1 && copy[0].type === 'text' && !copy[0].content.trim() ? [] : copy;
    await updateNoteBlocks([...base, ...newBlocks]);
  };

  // Unified Drag & Drop Handler: Block reorder, Multiple Images/PDF/MD/TXT Files, Board Clip, or Plain Text
  const handleDropOnEditor = async (
    e: React.DragEvent<HTMLDivElement>,
    targetBlockId?: string,
    position: 'before' | 'after' = 'after'
  ) => {
    setIsFileDragOverEditor(false);
    setDraggedBlockId(null);
    setDropTargetBlock(null);

    if (!activeNote || !canEdit) return;

    // 1. Internal Block Reordering
    const internalBlockId =
      e.dataTransfer.getData('application/miu-block-id') || draggedBlockId;
    if (internalBlockId) {
      e.preventDefault();
      e.stopPropagation();
      if (targetBlockId) {
        await handleReorderBlocks(internalBlockId, targetBlockId, position);
      } else {
        const last = activeNote.blocks[activeNote.blocks.length - 1];
        if (last) await handleReorderBlocks(internalBlockId, last.id, 'after');
      }
      return;
    }

    // 2. Desktop / External Files (Supports multiple Images, PDFs, and Markdown/Text files)
    const droppedFiles = Array.from(e.dataTransfer.files || []);
    if (droppedFiles.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      for (const file of droppedFiles) {
        const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        if (file.type.startsWith('image/')) {
          const tempId = `blk-img-${stamp}`;
          await insertBlocksAtDropPoint(
            [{ id: tempId, type: 'image', content: '', caption: 'Mengunggah gambar ke Cloud Catatan...' }],
            targetBlockId,
            position
          );
          await handleUploadImageForBlock(tempId, file);
        } else if (
          file.type === 'application/pdf' ||
          file.name.toLowerCase().endsWith('.pdf')
        ) {
          const tempId = `blk-pdf-${stamp}`;
          await insertBlocksAtDropPoint(
            [
              {
                id: tempId,
                type: 'pdf',
                content: '',
                fileName: file.name,
                caption: 'Mengekstrak teks PDF & mengunggah...'
              }
            ],
            targetBlockId,
            position
          );
          await handleUploadPdfForBlock(tempId, file);
        } else if (
          file.type.startsWith('text/') ||
          /\.(md|markdown|txt)$/i.test(file.name)
        ) {
          try {
            const rawText = await file.text();
            const parsed = parseMarkdownToNotionBlocks(rawText).map((b, i) => ({
              ...b,
              id: `blk-md-${stamp}-${i}`
            }));
            await insertBlocksAtDropPoint(parsed, targetBlockId, position);
          } catch {
            // ignore
          }
        }
      }
      return;
    }

    // 3. Board & Shelf Drag Item
    const rawBoard = e.dataTransfer.getData('application/miu-board-item');
    if (rawBoard) {
      e.preventDefault();
      e.stopPropagation();
      try {
        const item = JSON.parse(rawBoard) as {
          contentType: 'text' | 'math' | 'image';
          content: string;
          title: string;
        };
        const blockType: BlockType =
          item.contentType === 'math' ? 'math' : item.contentType === 'image' ? 'image' : 'text';
        await insertBlocksAtDropPoint(
          [
            {
              id: `blk-${Date.now()}`,
              type: blockType,
              content: item.content,
              caption: item.title
            }
          ],
          targetBlockId,
          position
        );
      } catch {
        // ignore
      }
      return;
    }

    // 4. Plain Text Dropped from External Window / Browser
    const plainText = e.dataTransfer.getData('text/plain');
    if (
      plainText &&
      plainText.trim() &&
      !e.dataTransfer.types.includes('application/miu-note-id')
    ) {
      e.preventDefault();
      e.stopPropagation();
      const parsed = parseMarkdownToNotionBlocks(plainText).map((b, i) => ({
        ...b,
        id: `blk-txt-${Date.now()}-${i}`
      }));
      await insertBlocksAtDropPoint(parsed, targetBlockId, position);
    }
  };

  const [cloudStatus, setCloudStatus] = useState(() => getCloudStatusSnapshot());
  useEffect(() => {
    void syncCloudStatus().then((s) => setCloudStatus(s));
  }, []);

  const isLockedByAuth = !currentUser && !isPublicShareAccess;
  const neonActive = cloudStatus.dbReady;
  const cloudinaryActive = cloudStatus.mediaReady;
  let numberedCounter = 0;

  const renderSidebarPageTree = (
    pool: NoteRecord[],
    parentId: string | null,
    depth: number,
    isSharedSection: boolean
  ): React.ReactNode => {
    const items = pool.filter((n) => {
      if (parentId === null) {
        return !n.parentId || !pool.some((p) => p.id === n.parentId);
      }
      return n.parentId === parentId;
    });

    return items.map((note) => {
      const children = pool.filter((c) => c.parentId === note.id);
      const hasChildren = children.length > 0;
      const isCollapsed = Boolean(collapsedParents[note.id]);
      const isSelected = note.id === activeNoteId;
      const isNoteOwner = !note.ownerId || (currentUser && note.ownerId === currentUser.id);
      const canAddChildHere = isNoteOwner || (isSelected && canEdit);
      const isPageDropTarget = dropTargetNoteId === note.id;

      return (
        <div key={note.id} className="space-y-0.5">
          <div
            draggable={Boolean(isNoteOwner && !isSharedSection)}
            onDragStart={(e) => {
              if (!isNoteOwner || isSharedSection) return;
              e.dataTransfer.setData('application/miu-note-id', note.id);
              e.dataTransfer.effectAllowed = 'move';
              setDraggedNoteId(note.id);
            }}
            onDragEnd={() => {
              setDraggedNoteId(null);
              setDropTargetNoteId(null);
            }}
            onDragOver={(e) => {
              if (!draggedNoteId || draggedNoteId === note.id || isSharedSection || !isNoteOwner) {
                return;
              }
              e.preventDefault();
              setDropTargetNoteId(note.id);
            }}
            onDragLeave={() => {
              if (dropTargetNoteId === note.id) setDropTargetNoteId(null);
            }}
            onDrop={(e) => {
              const sourceId = e.dataTransfer.getData('application/miu-note-id') || draggedNoteId;
              setDraggedNoteId(null);
              setDropTargetNoteId(null);
              if (!sourceId || sourceId === note.id || isSharedSection || !isNoteOwner) return;
              e.preventDefault();
              e.stopPropagation();
              void handleMoveNoteParent(sourceId, note.id);
            }}
            onClick={() => setActiveNoteId(note.id)}
            style={{ paddingLeft: `${8 + depth * 14}px` }}
            className={`group flex items-center justify-between gap-1 pr-1.5 py-1.5 rounded-lg text-xs cursor-pointer transition ${
              isPageDropTarget
                ? 'bg-accent-strong/15 ring-1 ring-accent-strong text-text-primary'
                : isSelected
                  ? 'bg-surface font-semibold text-text-primary shadow-sm'
                  : 'text-text-secondary hover:bg-surface/60 hover:text-text-primary'
            } ${draggedNoteId === note.id ? 'opacity-50' : ''}`}
          >
            <div className="flex items-center gap-1 min-w-0 flex-1">
              {hasChildren ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCollapsedParents((prev) => ({ ...prev, [note.id]: !prev[note.id] }));
                  }}
                  className="p-0.5 rounded hover:bg-subtle text-text-secondary shrink-0"
                  title={isCollapsed ? 'Tampilkan subhalaman' : 'Sembunyikan subhalaman'}
                >
                  {isCollapsed ? (
                    <ChevronRight className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </button>
              ) : (
                <span className="w-4 shrink-0" />
              )}
              <span className="text-sm leading-none shrink-0">{note.icon || '📄'}</span>
              <span className="truncate">{note.title || 'Tanpa Judul'}</span>
            </div>

            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0">
              {canAddChildHere && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleCreateNote(note.id, true);
                  }}
                  className="p-0.5 rounded hover:bg-subtle text-text-secondary hover:text-accent-strong"
                  title="Tambah Subhalaman di dalam halaman ini"
                >
                  <Plus className="w-3 h-3" />
                </button>
              )}
              {!isSharedSection && isNoteOwner && (
                <>
                  <button
                    type="button"
                    onClick={(e) => void handleDuplicateNote(note, e)}
                    className="p-0.5 rounded hover:bg-subtle text-text-secondary hover:text-text-primary"
                    title="Duplikat"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => void handleDeleteNote(note, e)}
                    className="p-0.5 rounded hover:bg-subtle text-text-secondary hover:text-rose-500"
                    title="Hapus"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </>
              )}
            </div>
          </div>

          {hasChildren && !isCollapsed && (
            <div>{renderSidebarPageTree(pool, note.id, depth + 1, isSharedSection)}</div>
          )}
        </div>
      );
    });
  };

  return (
    <>
      {/* Google Auth Popup with Blurred Background when user is not logged in */}
      <NotesAuthModal
        isOpen={isLockedByAuth || showCloudSettingsModal || showLoginModalForGuest}
        mode={isLockedByAuth || showLoginModalForGuest ? 'auth-gate' : 'settings'}
        onAuthenticated={(user) => {
          void loginGoogleUser(user);
          setShowCloudSettingsModal(false);
          setShowLoginModalForGuest(false);
        }}
        onCloseSettings={
          !isLockedByAuth
            ? () => {
                setShowCloudSettingsModal(false);
                setShowLoginModalForGuest(false);
              }
            : undefined
        }
        onBackToLanding={() => setViewMode('landing')}
      />

      <div
        className={`w-full min-h-screen flex bg-surface transition-all relative ${
          isLockedByAuth ? 'blur-[3px] pointer-events-none select-none' : ''
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          const hasFiles = Array.from(e.dataTransfer.types || []).includes('Files');
          if (hasFiles && canEdit && !draggedBlockId && !draggedNoteId) {
            setIsFileDragOverEditor(true);
          }
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
            setIsFileDragOverEditor(false);
          }
        }}
        onDrop={(e) => void handleDropOnEditor(e)}
      >
        {/* Visual Dropzone Overlay for Desktop Files (Images, PDFs, Markdown) */}
        {isFileDragOverEditor && canEdit && (
          <div className="fixed inset-0 z-40 pointer-events-none flex items-center justify-center bg-sky-500/10 backdrop-blur-[2px] border-4 border-dashed border-accent-strong/70 m-3 rounded-3xl">
            <div className="px-6 py-4 rounded-2xl bg-surface/95 shadow-2xl border border-border-subtle flex items-center gap-3">
              <UploadCloud className="w-6 h-6 text-accent-strong animate-bounce" />
              <div className="text-left">
                <p className="text-sm font-bold text-text-primary">
                  Lepaskan untuk Menyisipkan ke Catatan
                </p>
                <p className="text-xs text-text-secondary">
                  Mendukung Gambar, Dokumen PDF (AI Reader), dan Teks/Markdown
                </p>
              </div>
            </div>
          </div>
        )}
        {/* =================================================================== */}
        {/* LEFT SIDEBAR: FULL-HEIGHT NOTION PAGE LIST + GOOGLE USER PROFILE    */}
        {/* =================================================================== */}
        {isSidebarOpen && (
          <aside className="w-60 sm:w-64 h-screen sticky top-0 shrink-0 border-r border-border-subtle bg-subtle/55 flex flex-col justify-between select-none no-print">
            <div className="p-3 space-y-3 overflow-y-auto flex-1">
              {/* Logged-in Google User Workspace Switcher */}
              <div className="flex items-center justify-between gap-1.5 px-1 pb-2 border-b border-border-subtle">
                {currentUser ? (
                  <div className="flex items-center gap-2 min-w-0">
                    <img
                      src={currentUser.picture}
                      alt={currentUser.name}
                      className="w-6 h-6 rounded-full object-cover shrink-0 border border-border-subtle"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-text-primary truncate leading-tight">
                        {currentUser.name}
                      </p>
                      <p className="text-[10px] text-text-secondary truncate leading-tight">
                        {currentUser.email}
                      </p>
                    </div>
                  </div>
                ) : (
                  <span className="text-xs font-bold text-text-primary">Catatan Miu</span>
                )}

                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => void handleCreateNote()}
                    className="p-1.5 rounded-lg hover:bg-surface text-text-secondary hover:text-text-primary transition"
                    title="Halaman Baru"
                  >
                    <FilePlus2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSidebarOpen(false)}
                    className="p-1.5 rounded-lg hover:bg-surface text-text-secondary hover:text-text-primary transition"
                    title="Tutup Sidebar"
                  >
                    <PanelLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-text-secondary absolute left-2.5 top-2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari halaman..."
                  className="w-full bg-surface/75 border border-border-subtle rounded-lg pl-8 pr-2.5 py-1 text-xs text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:border-accent-strong"
                />
              </div>

              {/* New Page Button */}
              <button
                type="button"
                onClick={() => void handleCreateNote()}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface text-xs font-medium text-text-secondary hover:text-text-primary transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Halaman baru</span>
              </button>

              {/* Favorites */}
              {favoriteNotes.length > 0 && !searchQuery && (
                <div className="space-y-0.5 pt-1">
                  <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-text-secondary/75">
                    Favorit
                  </div>
                  {favoriteNotes.map((note) => (
                    <button
                      key={`fav-${note.id}`}
                      type="button"
                      onClick={() => setActiveNoteId(note.id)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-left transition ${
                        note.id === activeNoteId
                          ? 'bg-surface font-semibold text-text-primary shadow-sm'
                          : 'text-text-secondary hover:bg-surface/60 hover:text-text-primary'
                      }`}
                    >
                      <span className="text-sm shrink-0">{note.icon || '📄'}</span>
                      <span className="truncate flex-1">{note.title || 'Tanpa Judul'}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* All Pages List (Nested Tree for My Notes) */}
              <div className="space-y-0.5 pt-1">
                <div
                  onDragOver={(e) => {
                    if (!draggedNoteId) return;
                    e.preventDefault();
                    setDropTargetNoteId('ROOT');
                  }}
                  onDragLeave={() => {
                    if (dropTargetNoteId === 'ROOT') setDropTargetNoteId(null);
                  }}
                  onDrop={(e) => {
                    const sourceId = e.dataTransfer.getData('application/miu-note-id') || draggedNoteId;
                    setDraggedNoteId(null);
                    setDropTargetNoteId(null);
                    if (!sourceId) return;
                    e.preventDefault();
                    e.stopPropagation();
                    void handleMoveNoteParent(sourceId, null);
                  }}
                  className={`flex items-center justify-between px-2 py-1 rounded-lg transition ${
                    dropTargetNoteId === 'ROOT'
                      ? 'bg-accent-strong/15 ring-1 ring-accent-strong'
                      : ''
                  }`}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary/75">
                    {searchQuery.trim()
                      ? 'Hasil Pencarian'
                      : dropTargetNoteId === 'ROOT'
                        ? 'Lepas ke Halaman Utama'
                        : 'Halaman Saya'}
                  </span>
                  {currentUser && (
                    <button
                      type="button"
                      onClick={() => void handleCreateNote(null, true)}
                      className="p-0.5 rounded hover:bg-surface text-text-secondary hover:text-text-primary"
                      title="Tambah Halaman"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {searchQuery.trim() ? (
                  visibleNotes.map((note) => {
                    const isSelected = note.id === activeNoteId;
                    return (
                      <div
                        key={note.id}
                        onClick={() => setActiveNoteId(note.id)}
                        className={`group flex items-center justify-between gap-1 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition ${
                          isSelected
                            ? 'bg-surface font-semibold text-text-primary shadow-sm'
                            : 'text-text-secondary hover:bg-surface/60 hover:text-text-primary'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="text-sm leading-none shrink-0">{note.icon || '📄'}</span>
                          <span className="truncate">{note.title || 'Tanpa Judul'}</span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  renderSidebarPageTree(myNotes, null, 0, false)
                )}
              </div>

              {/* Shared With Me Notes (Isolated Section) */}
              {sharedWithMeNotes.length > 0 && !searchQuery.trim() && (
                <div className="space-y-0.5 pt-2 border-t border-border-subtle/60">
                  <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sky-500">
                    Dibagikan ke Saya
                  </div>
                  {renderSidebarPageTree(sharedWithMeNotes, null, 0, true)}
                </div>
              )}
            </div>

            {/* Sidebar Footer: Cloud Status (Neon & Cloudinary) + Logout */}
            <div className="p-3 border-t border-border-subtle space-y-2 text-[11px] text-text-secondary">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowCloudSettingsModal(true)}
                  className="inline-flex items-center gap-1.5 hover:text-text-primary transition"
                  title="Status Cloud Catatan"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>{neonActive ? 'Cloud Catatan' : 'Penyimpanan Lokal'}</span>
                </button>

                {currentUser && (
                  <button
                    type="button"
                    onClick={logoutGoogleUser}
                    className="inline-flex items-center gap-1 text-rose-500 hover:underline"
                    title="Keluar dari akun Google"
                  >
                    <LogOut className="w-3 h-3" />
                    <span>Keluar</span>
                  </button>
                )}
              </div>
            </div>
          </aside>
        )}

        {/* =================================================================== */}
        {/* MAIN PANEL: CLEAN FULL-SCREEN NOTION DOCUMENT                       */}
        {/* =================================================================== */}
        <div className="flex-1 min-w-0 min-h-screen flex flex-col bg-surface">
          {/* Minimal Sticky Notion Top Bar */}
          <header className="sticky top-0 z-20 px-4 sm:px-6 py-3 bg-surface/85 backdrop-blur-md border-b border-border-subtle/60 flex items-center justify-between gap-2 no-print">
            <div className="flex items-center gap-1.5 text-xs text-text-primary min-w-0 overflow-x-auto">
              {!isSidebarOpen && (
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(true)}
                  className="p-1.5 rounded-lg hover:bg-subtle text-text-secondary hover:text-text-primary transition shrink-0"
                  title="Buka Sidebar"
                >
                  <PanelLeft className="w-4 h-4" />
                </button>
              )}

              {/* Breadcrumbs Navigation across Subpages */}
              <div className="flex items-center gap-1 min-w-0">
                {breadcrumbPath.map((crumb, idx) => {
                  const isLast = idx === breadcrumbPath.length - 1;
                  return (
                    <React.Fragment key={crumb.id}>
                      {idx > 0 && <span className="text-text-secondary/50 select-none">/</span>}
                      <button
                        type="button"
                        onClick={() => setActiveNoteId(crumb.id)}
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md truncate max-w-[160px] transition ${
                          isLast
                            ? 'font-semibold text-text-primary'
                            : 'text-text-secondary hover:bg-subtle hover:text-text-primary'
                        }`}
                      >
                        <span className="shrink-0">{crumb.icon || '📄'}</span>
                        <span className="truncate">{crumb.title || 'Tanpa Judul'}</span>
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>

              {!isOwner && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/15 text-sky-600 dark:text-sky-300 shrink-0">
                  {effectiveRole === 'edit' ? (
                    <>
                      <Pencil className="w-2.5 h-2.5" />
                      <span>Bisa Edit</span>
                    </>
                  ) : effectiveRole === 'comment' ? (
                    <>
                      <MessageSquare className="w-2.5 h-2.5" />
                      <span>Komentar</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-2.5 h-2.5" />
                      <span>Hanya Lihat</span>
                    </>
                  )}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-xs shrink-0">
              {/* Cloud Catatan Sync Status Indicator */}
              <button
                type="button"
                onClick={() => setShowCloudSettingsModal(true)}
                className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-text-secondary hover:bg-subtle transition"
                title="Status Cloud Catatan"
              >
                <Database
                  className={`w-3 h-3 ${
                    neonActive ? 'text-emerald-500' : 'text-text-secondary'
                  }`}
                />
                <span>
                  {syncStatus === 'syncing'
                    ? 'Menyimpan ke Cloud...'
                    : neonActive
                      ? 'Cloud Catatan'
                      : 'Tersimpan'}
                </span>
              </button>

              {/* Share & Access Control Button */}
              {activeNote && (
                <button
                  type="button"
                  onClick={() => setShowShareModal(true)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                    activeNote.shareSettings?.isPublicLink ||
                    (activeNote.shareSettings?.collaborators?.length || 0) > 0
                      ? 'bg-sky-500/15 text-sky-600 dark:text-sky-300 border border-sky-400/30'
                      : 'text-text-secondary hover:bg-subtle hover:text-text-primary'
                  }`}
                  title="Bagikan catatan & atur hak akses (Edit / Lihat / Komentar)"
                >
                  {activeNote.shareSettings?.isPublicLink ? (
                    <Globe className="w-3.5 h-3.5" />
                  ) : (
                    <Share2 className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline">Bagikan</span>
                </button>
              )}

              {/* Comments Toggle */}
              {activeNote && (
                <button
                  type="button"
                  onClick={() => setShowCommentsPanel((v) => !v)}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition ${
                    showCommentsPanel
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300'
                      : 'text-text-secondary hover:bg-subtle hover:text-text-primary'
                  }`}
                  title="Lihat & tambah komentar catatan"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  {(activeNote.comments?.length || 0) > 0 && (
                    <span className="font-mono text-[10px]">
                      {activeNote.comments?.length}
                    </span>
                  )}
                </button>
              )}

              {activeNote && canEdit && (
                <button
                  type="button"
                  onClick={() => void updateNote({ isFavorite: !activeNote.isFavorite })}
                  className={`p-1.5 rounded-lg transition ${
                    activeNote.isFavorite
                      ? 'text-amber-500'
                      : 'text-text-secondary hover:bg-subtle hover:text-text-primary'
                  }`}
                  title="Favorit"
                >
                  <Star className={`w-4 h-4 ${activeNote.isFavorite ? 'fill-current' : ''}`} />
                </button>
              )}

              {canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    const next = !isSelectMode;
                    setIsSelectMode(next);
                    if (!next) {
                      setSelectedBlockIds([]);
                    }
                  }}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                    isSelectMode || selectedBlockIds.length > 0
                      ? 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-400/30'
                      : 'text-text-secondary hover:bg-subtle hover:text-text-primary'
                  }`}
                  title="Pilih beberapa blok / percakapan untuk dihapus sekaligus"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">
                    {selectedBlockIds.length > 0
                      ? `Pilih (${selectedBlockIds.length})`
                      : 'Pilih & Hapus'}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={handleExportMarkdown}
                className="p-1.5 rounded-lg text-text-secondary hover:bg-subtle hover:text-text-primary transition"
                title="Ekspor Markdown (.md)"
              >
                <Download className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="p-1.5 rounded-lg text-text-secondary hover:bg-subtle hover:text-text-primary transition"
                title="Cetak PDF"
              >
                <Printer className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setIsAIDrawerOpen(!isAIDrawerOpen)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                  isAIDrawerOpen
                    ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300'
                    : 'text-text-secondary hover:bg-subtle hover:text-text-primary'
                }`}
                title="Buka Asisten AI"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI</span>
              </button>
            </div>
          </header>

          {activeNote ? (
            <div className="flex-1 flex flex-col">
              {/* Optional Cover Banner (supports Gradient or Cloudinary Image) */}
              {activeNote.cover && (
                <div
                  className="group relative h-36 sm:h-44 w-full"
                  style={{ background: activeNote.cover }}
                >
                  {canEdit && (
                    <div className="opacity-0 group-hover:opacity-100 transition absolute bottom-2.5 right-4 flex items-center gap-1.5 no-print">
                      <button
                        type="button"
                        onClick={() => setShowCoverPicker((v) => !v)}
                        className="px-2.5 py-1 rounded-md bg-black/55 text-white text-[11px] hover:bg-black/75"
                      >
                        Ubah sampul
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCoverPicker(false);
                          void updateNote({ cover: '' });
                        }}
                        className="px-2 py-1 rounded-md bg-black/55 text-white/80 text-[11px] hover:bg-black/75"
                      >
                        Hapus
                      </button>
                    </div>
                  )}

                  {showCoverPicker && canEdit && (
                    <div className="absolute right-4 top-full mt-2 z-30 miu-card shadow-xl p-3 w-64 space-y-2.5 no-print">
                      <div className="grid grid-cols-3 gap-1.5">
                        {COVER_PRESETS.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              void updateNote({ cover: c.css });
                              setShowCoverPicker(false);
                            }}
                            className="h-8 rounded-lg border border-white/20"
                            style={{ background: c.css }}
                            title={c.label}
                          />
                        ))}
                      </div>

                      <label className="w-full py-1.5 px-2.5 rounded-lg bg-subtle hover:bg-subtle/80 border border-border-subtle flex items-center justify-center gap-1.5 text-[11px] font-medium text-text-primary cursor-pointer transition">
                        {uploadingCover ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <UploadCloud className="w-3.5 h-3.5 text-accent-strong" />
                        )}
                        <span>Unggah Sampul Gambar</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void handleUploadCoverImage(f);
                          }}
                        />
                      </label>
                    </div>
                  )}
                </div>
              )}

              {/* Clean Blank Notion Page Container */}
              <div className="max-w-3xl w-full mx-auto px-6 sm:px-16 pt-12 pb-28 flex-1 flex flex-col">
                {/* Shared Note Permission Banner */}
                {!isOwner && (
                  <div className="mb-4 px-3.5 py-2 rounded-xl bg-subtle/80 border border-border-subtle flex items-center justify-between gap-2 text-xs text-text-secondary no-print">
                    <div className="flex items-center gap-2 min-w-0">
                      {effectiveRole === 'edit' ? (
                        <Pencil className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      ) : effectiveRole === 'comment' ? (
                        <MessageSquare className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      ) : (
                        <Lock className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                      )}
                      <span className="truncate">
                        {effectiveRole === 'edit'
                          ? `Catatan bersama (${activeNote.ownerName || 'Kolaborasi'}) • Anda dapat mengedit isi halaman.`
                          : effectiveRole === 'comment'
                            ? `Catatan bersama (${activeNote.ownerName || 'Pemilik'}) • Hak Akses: Pemberi Komentar.`
                            : `Catatan bersama (${activeNote.ownerName || 'Pemilik'}) • Hak Akses: Hanya Lihat.`}
                      </span>
                    </div>
                    {!currentUser && (
                      <button
                        type="button"
                        onClick={() => setShowLoginModalForGuest(true)}
                        className="px-2.5 py-1 rounded-lg bg-surface border border-border-subtle text-[11px] font-semibold text-text-primary hover:border-accent-strong shrink-0"
                      >
                        Masuk Google
                      </button>
                    )}
                  </div>
                )}

                {/* Hover controls for Icon & Cover + Page Icon + Add Subpage */}
                <div className="group relative mb-2">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <div className="relative">
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() => setShowIconPicker((v) => !v)}
                        className={`text-4xl leading-none p-1 rounded-xl transition select-none ${
                          canEdit ? 'hover:bg-subtle cursor-pointer' : 'cursor-default'
                        } ${activeNote.cover ? '-mt-12 bg-surface shadow-sm' : ''}`}
                        title={canEdit ? 'Ganti ikon' : undefined}
                      >
                        {activeNote.icon || '📄'}
                      </button>

                      {showIconPicker && canEdit && (
                        <div className="absolute left-0 top-full mt-1.5 z-30 miu-card shadow-xl p-2 w-56 no-print">
                          <div className="grid grid-cols-8 gap-1">
                            {PAGE_ICONS.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => {
                                  void updateNote({ icon: emoji });
                                  setShowIconPicker(false);
                                }}
                                className="w-6 h-6 rounded hover:bg-subtle flex items-center justify-center text-sm"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {canEdit && (
                      <div className="opacity-0 group-hover:opacity-100 transition flex items-center gap-1 no-print">
                        {!activeNote.cover && (
                          <button
                            type="button"
                            onClick={() => void updateNote({ cover: COVER_PRESETS[0].css })}
                            className="text-xs text-text-secondary hover:text-text-primary px-2 py-1 rounded hover:bg-subtle"
                          >
                            + Tambah sampul
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void handleCreateNote(activeNote.id, true)}
                          className="text-xs text-text-secondary hover:text-text-primary px-2 py-1 rounded hover:bg-subtle inline-flex items-center gap-1"
                        >
                          <FilePlus2 className="w-3.5 h-3.5" />
                          <span>+ Tambah subhalaman</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Notion Page Title */}
                  <input
                    type="text"
                    readOnly={!canEdit}
                    value={activeNote.title}
                    onChange={(e) => void updateNote({ title: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && canEdit) {
                        e.preventDefault();
                        if (activeNote.blocks[0]) {
                          setPendingFocusBlockId(activeNote.blocks[0].id);
                        } else {
                          void handleAddBlockAfter(undefined, 'text');
                        }
                      }
                    }}
                    placeholder={canEdit ? 'Tanpa Judul' : 'Tanpa Judul'}
                    className="w-full bg-transparent text-3xl sm:text-4xl font-bold tracking-tight text-text-primary placeholder:text-text-secondary/30 focus:outline-none"
                  />
                </div>

                {/* Multi-Select Action Bar for Deleting Selected Blocks / Conversations */}
                {(isSelectMode || selectedBlockIds.length > 0) && (
                  <div className="sticky top-14 z-20 mb-3 p-2.5 rounded-2xl bg-surface/95 backdrop-blur-md border border-rose-400/40 shadow-lg flex flex-wrap items-center justify-between gap-2 no-print">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-600 dark:text-rose-300 font-bold font-mono">
                        {selectedBlockIds.length} dipilih
                      </span>
                      <span className="text-[11px] text-text-secondary hidden sm:inline">
                        Klik blok untuk memilih, atau tahan <strong>Shift + Klik</strong> untuk pilih rentang percakapan.
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleSelectAllBlocks}
                        className="px-2.5 py-1 rounded-lg bg-subtle hover:bg-subtle/80 text-xs font-medium text-text-primary transition"
                      >
                        {selectedBlockIds.length === activeNote.blocks.length
                          ? 'Batal Pilih Semua'
                          : 'Pilih Semua'}
                      </button>

                      <button
                        type="button"
                        disabled={selectedBlockIds.length === 0}
                        onClick={() => void handleDeleteSelectedBlocks()}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-rose-500 hover:bg-rose-600 disabled:opacity-40 text-white text-xs font-semibold shadow-sm transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus ({selectedBlockIds.length})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsSelectMode(false);
                          setSelectedBlockIds([]);
                        }}
                        className="px-2 py-1 rounded-lg hover:bg-subtle text-xs text-text-secondary hover:text-text-primary transition"
                      >
                        Selesai
                      </button>
                    </div>
                  </div>
                )}

                {/* Notion Blocks */}
                <div className="space-y-1 mt-4 flex-1">
                  {activeNote.blocks.map((block) => {
                    if (block.type === 'numbered') {
                      numberedCounter += 1;
                    } else {
                      numberedCounter = 0;
                    }
                    const currentNumber = numberedCounter;
                    const isSlashOpen = slashState?.blockId === block.id;
                    const isBlockMenuOpen = menuBlockId === block.id;
                    const isBlockSelected = selectedBlockIds.includes(block.id);
                    const isBeingDragged = draggedBlockId === block.id;
                    const isDropBefore =
                      dropTargetBlock?.blockId === block.id && dropTargetBlock.position === 'before';
                    const isDropAfter =
                      dropTargetBlock?.blockId === block.id && dropTargetBlock.position === 'after';

                    return (
                      <div
                        key={block.id}
                        onDragOver={(e) => {
                          if (!canEdit || draggedNoteId) return;
                          e.preventDefault();
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          const position: 'before' | 'after' =
                            e.clientY - rect.top < rect.height / 2 ? 'before' : 'after';
                          setIsFileDragOverEditor(false);
                          setDropTargetBlock((prev) =>
                            prev?.blockId === block.id && prev.position === position
                              ? prev
                              : { blockId: block.id, position }
                          );
                        }}
                        onDragLeave={(e) => {
                          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                            setDropTargetBlock((prev) =>
                              prev?.blockId === block.id ? null : prev
                            );
                          }
                        }}
                        onDrop={(e) => {
                          if (!canEdit || draggedNoteId) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          const position: 'before' | 'after' =
                            e.clientY - rect.top < rect.height / 2 ? 'before' : 'after';
                          void handleDropOnEditor(e, block.id, position);
                        }}
                        onClick={(e) => {
                          if (isSelectMode) {
                            e.stopPropagation();
                            toggleSelectBlock(block.id, e.shiftKey);
                          }
                        }}
                        className={`group relative flex items-start gap-1.5 -ml-2 sm:-ml-16 pl-2 sm:pl-16 py-0.5 rounded-lg transition ${
                          isBlockSelected
                            ? 'bg-rose-500/10 ring-1 ring-rose-400/40'
                            : isSelectMode
                              ? 'hover:bg-subtle/60 cursor-pointer'
                              : ''
                        } ${isBeingDragged ? 'opacity-40' : ''} ${
                          isDropBefore ? 'border-t-2 border-accent-strong' : ''
                        } ${isDropAfter ? 'border-b-2 border-accent-strong' : ''}`}
                      >
                        {/* Notion Left Gutter (Checkbox + `+` and Draggable `⋮⋮`) */}
                        {canEdit && (
                          <div
                            className={`sm:absolute sm:left-1 top-1 flex items-center gap-0.5 transition no-print shrink-0 ${
                              isBlockMenuOpen || isSelectMode || isBlockSelected
                                ? 'opacity-100'
                                : 'opacity-0 group-hover:opacity-100'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSelectBlock(block.id, e.shiftKey);
                              }}
                              className={`w-4 h-4 mr-0.5 rounded-[4px] border flex items-center justify-center transition ${
                                isBlockSelected
                                  ? 'bg-rose-500 border-rose-500 text-white'
                                  : 'border-text-secondary/40 hover:border-rose-400 bg-surface'
                              }`}
                              title="Pilih blok ini (Shift+Klik untuk pilih rentang)"
                            >
                              {isBlockSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleAddBlockAfter(block.id, 'text')}
                              className="p-1 rounded hover:bg-subtle text-text-secondary/70 hover:text-text-primary"
                              title="Tambah blok"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              draggable={canEdit}
                              onDragStart={(e) => {
                                e.stopPropagation();
                                e.dataTransfer.setData('application/miu-block-id', block.id);
                                e.dataTransfer.effectAllowed = 'move';
                                setDraggedBlockId(block.id);
                                setMenuBlockId(null);
                              }}
                              onDragEnd={() => {
                                setDraggedBlockId(null);
                                setDropTargetBlock(null);
                              }}
                              onClick={() => setMenuBlockId(isBlockMenuOpen ? null : block.id)}
                              className="p-1 rounded hover:bg-subtle text-text-secondary/70 hover:text-text-primary cursor-grab active:cursor-grabbing"
                              title="Tarik untuk geser posisi blok, atau klik untuk Menu blok"
                            >
                              <GripVertical className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        {/* Block Context Menu */}
                        {isBlockMenuOpen && (
                          <div className="absolute left-0 top-8 z-30 w-52 miu-card shadow-xl p-1.5 space-y-1 text-xs no-print">
                            <div className="grid grid-cols-2 gap-0.5">
                              {SLASH_OPTIONS.slice(0, 10).map(({ type, label, Icon }) => (
                                <button
                                  key={type}
                                  type="button"
                                  onClick={() => {
                                    setMenuBlockId(null);
                                    void applySlashCommand(block.id, type);
                                  }}
                                  className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-left text-[11px] transition ${
                                    block.type === type
                                      ? 'bg-accent-strong/15 text-accent-strong font-semibold'
                                      : 'hover:bg-subtle text-text-primary'
                                  }`}
                                >
                                  <Icon className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{label.split(' ')[0]}</span>
                                </button>
                              ))}
                            </div>

                            <div className="border-t border-border-subtle pt-1 space-y-0.5">
                              <button
                                type="button"
                                onClick={() => void handleMoveBlock(block.id, -1)}
                                className="w-full flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-subtle text-text-primary"
                              >
                                <ArrowUp className="w-3.5 h-3.5 text-text-secondary" />
                                <span>Geser ke atas</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleMoveBlock(block.id, 1)}
                                className="w-full flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-subtle text-text-primary"
                              >
                                <ArrowDown className="w-3.5 h-3.5 text-text-secondary" />
                                <span>Geser ke bawah</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDuplicateBlock(block)}
                                className="w-full flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-subtle text-text-primary"
                              >
                                <Copy className="w-3.5 h-3.5 text-text-secondary" />
                                <span>Duplikat</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setMenuBlockId(null);
                                  if (block.type === 'image') {
                                    triggerInlineAIExplain('', {
                                      url: block.content,
                                      caption: block.caption || 'Gambar Catatan'
                                    });
                                  } else if (block.type === 'pdf') {
                                    triggerInlineAIExplain('', undefined, {
                                      fileName: block.fileName || block.caption || 'Dokumen.pdf',
                                      text: block.pdfText || '',
                                      pages: block.pdfPages || 1,
                                      url: block.content
                                    });
                                  } else {
                                    triggerInlineAIExplain(block.content);
                                  }
                                  setIsAIDrawerOpen(true);
                                }}
                                className="w-full flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-subtle text-indigo-500"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>Tanya AI</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => selectBlocksFromHereToEnd(block.id)}
                                className="w-full flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-subtle text-text-primary"
                              >
                                <CheckSquare className="w-3.5 h-3.5 text-rose-500" />
                                <span>Pilih sampai bawah</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteBlock(block.id)}
                                className="w-full flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-rose-500/10 text-rose-500"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Hapus</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Block Renderer */}
                        <div className="flex-1 min-w-0 relative">
                          {block.type === 'h1' &&
                            (canEdit && (editingBlockId === block.id || !block.content.trim()) ? (
                              <input
                                ref={(el) => {
                                  blockRefs.current[block.id] = el;
                                }}
                                value={block.content}
                                onFocus={() => setEditingBlockId(block.id)}
                                onBlur={() =>
                                  setEditingBlockId((prev) => (prev === block.id ? null : prev))
                                }
                                onChange={(e) =>
                                  void handleBlockChange(block.id, { content: e.target.value })
                                }
                                onKeyDown={(e) => handleBlockKeyDown(e, block)}
                                placeholder="Heading 1"
                                className="w-full bg-transparent text-2xl font-bold text-text-primary focus:outline-none pt-3 pb-1"
                              />
                            ) : (
                              <div
                                onClick={() => {
                                  if (canEdit) setPendingFocusBlockId(block.id);
                                }}
                                className={`w-full text-2xl font-bold text-text-primary pt-3 pb-1 break-words ${
                                  canEdit ? 'cursor-text' : 'cursor-default'
                                }`}
                              >
                                {renderInlineMarkdown(block.content)}
                              </div>
                            ))}

                          {block.type === 'h2' &&
                            (canEdit && (editingBlockId === block.id || !block.content.trim()) ? (
                              <input
                                ref={(el) => {
                                  blockRefs.current[block.id] = el;
                                }}
                                value={block.content}
                                onFocus={() => setEditingBlockId(block.id)}
                                onBlur={() =>
                                  setEditingBlockId((prev) => (prev === block.id ? null : prev))
                                }
                                onChange={(e) =>
                                  void handleBlockChange(block.id, { content: e.target.value })
                                }
                                onKeyDown={(e) => handleBlockKeyDown(e, block)}
                                placeholder="Heading 2"
                                className="w-full bg-transparent text-xl font-bold text-text-primary focus:outline-none pt-2 pb-0.5"
                              />
                            ) : (
                              <div
                                onClick={() => {
                                  if (canEdit) setPendingFocusBlockId(block.id);
                                }}
                                className={`w-full text-xl font-bold text-text-primary pt-2 pb-0.5 break-words ${
                                  canEdit ? 'cursor-text' : 'cursor-default'
                                }`}
                              >
                                {renderInlineMarkdown(block.content)}
                              </div>
                            ))}

                          {block.type === 'h3' &&
                            (canEdit && (editingBlockId === block.id || !block.content.trim()) ? (
                              <input
                                ref={(el) => {
                                  blockRefs.current[block.id] = el;
                                }}
                                value={block.content}
                                onFocus={() => setEditingBlockId(block.id)}
                                onBlur={() =>
                                  setEditingBlockId((prev) => (prev === block.id ? null : prev))
                                }
                                onChange={(e) =>
                                  void handleBlockChange(block.id, { content: e.target.value })
                                }
                                onKeyDown={(e) => handleBlockKeyDown(e, block)}
                                placeholder="Heading 3"
                                className="w-full bg-transparent text-base font-bold text-text-primary focus:outline-none pt-1.5 pb-0.5"
                              />
                            ) : (
                              <div
                                onClick={() => {
                                  if (canEdit) setPendingFocusBlockId(block.id);
                                }}
                                className={`w-full text-base font-bold text-text-primary pt-1.5 pb-0.5 break-words ${
                                  canEdit ? 'cursor-text' : 'cursor-default'
                                }`}
                              >
                                {renderInlineMarkdown(block.content)}
                              </div>
                            ))}

                          {block.type === 'text' &&
                            (canEdit &&
                            (editingBlockId === block.id ||
                              !block.content.trim() ||
                              block.content.startsWith('/')) ? (
                              <textarea
                                ref={(el) => {
                                  blockRefs.current[block.id] = el;
                                }}
                                rows={Math.max(
                                  1,
                                  Math.max(
                                    block.content.split('\n').length,
                                    Math.ceil(block.content.length / 72)
                                  )
                                )}
                                value={block.content}
                                onFocus={() => setEditingBlockId(block.id)}
                                onBlur={() =>
                                  setEditingBlockId((prev) => (prev === block.id ? null : prev))
                                }
                                onChange={(e) =>
                                  void handleBlockChange(block.id, { content: e.target.value })
                                }
                                onKeyDown={(e) => handleBlockKeyDown(e, block)}
                                placeholder="Ketik '/' untuk perintah, atau mulai menulis..."
                                className="w-full bg-transparent text-[15px] sm:text-base leading-[1.68] text-text-primary placeholder:text-text-secondary/35 focus:outline-none resize-none py-0.5"
                              />
                            ) : (
                              <div
                                onClick={() => {
                                  if (canEdit) setPendingFocusBlockId(block.id);
                                }}
                                className={`w-full text-[15px] sm:text-base leading-[1.68] text-text-primary py-0.5 whitespace-pre-wrap break-words ${
                                  canEdit ? 'cursor-text' : 'cursor-default'
                                }`}
                              >
                                {renderInlineMarkdown(block.content)}
                              </div>
                            ))}

                          {block.type === 'bullet' && (
                            <div className="flex items-start gap-2.5 py-0.5">
                              <span className="text-text-primary font-bold select-none pt-0.5">•</span>
                              {canEdit && (editingBlockId === block.id || !block.content.trim()) ? (
                                <textarea
                                  ref={(el) => {
                                    blockRefs.current[block.id] = el;
                                  }}
                                  rows={Math.max(
                                    1,
                                    Math.max(
                                      block.content.split('\n').length,
                                      Math.ceil(block.content.length / 68)
                                    )
                                  )}
                                  value={block.content}
                                  onFocus={() => setEditingBlockId(block.id)}
                                  onBlur={() =>
                                    setEditingBlockId((prev) => (prev === block.id ? null : prev))
                                  }
                                  onChange={(e) =>
                                    void handleBlockChange(block.id, { content: e.target.value })
                                  }
                                  onKeyDown={(e) => handleBlockKeyDown(e, block)}
                                  placeholder="List"
                                  className="flex-1 bg-transparent text-[15px] sm:text-base leading-[1.6] text-text-primary focus:outline-none resize-none"
                                />
                              ) : (
                                <div
                                  onClick={() => {
                                    if (canEdit) setPendingFocusBlockId(block.id);
                                  }}
                                  className={`flex-1 text-[15px] sm:text-base leading-[1.6] text-text-primary break-words ${
                                    canEdit ? 'cursor-text' : 'cursor-default'
                                  }`}
                                >
                                  {renderInlineMarkdown(block.content)}
                                </div>
                              )}
                            </div>
                          )}

                          {block.type === 'numbered' && (
                            <div className="flex items-start gap-2 py-0.5">
                              <span className="font-mono text-sm text-text-secondary select-none pt-0.5 min-w-[20px]">
                                {currentNumber}.
                              </span>
                              {canEdit && (editingBlockId === block.id || !block.content.trim()) ? (
                                <textarea
                                  ref={(el) => {
                                    blockRefs.current[block.id] = el;
                                  }}
                                  rows={Math.max(
                                    1,
                                    Math.max(
                                      block.content.split('\n').length,
                                      Math.ceil(block.content.length / 68)
                                    )
                                  )}
                                  value={block.content}
                                  onFocus={() => setEditingBlockId(block.id)}
                                  onBlur={() =>
                                    setEditingBlockId((prev) => (prev === block.id ? null : prev))
                                  }
                                  onChange={(e) =>
                                    void handleBlockChange(block.id, { content: e.target.value })
                                  }
                                  onKeyDown={(e) => handleBlockKeyDown(e, block)}
                                  placeholder="List"
                                  className="flex-1 bg-transparent text-[15px] sm:text-base leading-[1.6] text-text-primary focus:outline-none resize-none"
                                />
                              ) : (
                                <div
                                  onClick={() => {
                                    if (canEdit) setPendingFocusBlockId(block.id);
                                  }}
                                  className={`flex-1 text-[15px] sm:text-base leading-[1.6] text-text-primary break-words ${
                                    canEdit ? 'cursor-text' : 'cursor-default'
                                  }`}
                                >
                                  {renderInlineMarkdown(block.content)}
                                </div>
                              )}
                            </div>
                          )}

                          {block.type === 'todo' && (
                            <div className="flex items-start gap-2.5 py-0.5">
                              <button
                                type="button"
                                disabled={!canEdit}
                                onClick={() =>
                                  void handleBlockChange(block.id, { checked: !block.checked })
                                }
                                className={`mt-1 w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0 transition ${
                                  block.checked
                                    ? 'bg-accent-strong border-accent-strong text-white dark:text-slate-950'
                                    : 'border-text-secondary/50 hover:border-accent-strong'
                                }`}
                              >
                                {block.checked && <Check className="w-3 h-3 stroke-[3]" />}
                              </button>
                              {canEdit && (editingBlockId === block.id || !block.content.trim()) ? (
                                <textarea
                                  ref={(el) => {
                                    blockRefs.current[block.id] = el;
                                  }}
                                  rows={Math.max(1, Math.ceil(block.content.length / 68))}
                                  value={block.content}
                                  onFocus={() => setEditingBlockId(block.id)}
                                  onBlur={() =>
                                    setEditingBlockId((prev) => (prev === block.id ? null : prev))
                                  }
                                  onChange={(e) =>
                                    void handleBlockChange(block.id, { content: e.target.value })
                                  }
                                  onKeyDown={(e) => handleBlockKeyDown(e, block)}
                                  placeholder="To-do"
                                  className={`flex-1 bg-transparent text-[15px] sm:text-base leading-[1.6] focus:outline-none resize-none ${
                                    block.checked
                                      ? 'line-through text-text-secondary'
                                      : 'text-text-primary'
                                  }`}
                                />
                              ) : (
                                <div
                                  onClick={() => {
                                    if (canEdit) setPendingFocusBlockId(block.id);
                                  }}
                                  className={`flex-1 text-[15px] sm:text-base leading-[1.6] break-words ${
                                    canEdit ? 'cursor-text' : 'cursor-default'
                                  } ${
                                    block.checked
                                      ? 'line-through text-text-secondary'
                                      : 'text-text-primary'
                                  }`}
                                >
                                  {renderInlineMarkdown(block.content)}
                                </div>
                              )}
                            </div>
                          )}

                          {block.type === 'toggle' && (() => {
                            const isOpen = canEdit
                              ? block.toggleOpen
                              : (localToggleOverrides[block.id] ?? block.toggleOpen);
                            return (
                              <div className="py-0.5 space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (canEdit) {
                                        void handleBlockChange(block.id, {
                                          toggleOpen: !block.toggleOpen
                                        });
                                      } else {
                                        setLocalToggleOverrides((prev) => ({
                                          ...prev,
                                          [block.id]: !isOpen
                                        }));
                                      }
                                    }}
                                    className="p-0.5 rounded hover:bg-subtle text-text-secondary"
                                  >
                                    <ChevronRight
                                      className={`w-4 h-4 transition-transform ${
                                        isOpen ? 'rotate-90' : ''
                                      }`}
                                    />
                                  </button>
                                  <input
                                    ref={(el) => {
                                      blockRefs.current[block.id] = el;
                                    }}
                                    readOnly={!canEdit}
                                    value={block.content}
                                    onChange={(e) =>
                                      void handleBlockChange(block.id, { content: e.target.value })
                                    }
                                    onKeyDown={(e) => handleBlockKeyDown(e, block)}
                                    placeholder="Toggle"
                                    className="flex-1 bg-transparent text-[15px] sm:text-base font-medium text-text-primary focus:outline-none"
                                  />
                                </div>
                                {isOpen && (
                                  <div className="pl-6 border-l border-border-subtle ml-2">
                                    <textarea
                                      readOnly={!canEdit}
                                      rows={Math.max(2, (block.toggleBody || '').split('\n').length)}
                                      value={block.toggleBody || ''}
                                      onChange={(e) =>
                                        void handleBlockChange(block.id, {
                                          toggleBody: e.target.value
                                        })
                                      }
                                      placeholder={canEdit ? 'Ketik isi di dalam toggle...' : ''}
                                      className="w-full bg-transparent text-sm text-text-primary focus:outline-none resize-none"
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {block.type === 'callout' && (
                            <div className="flex items-start gap-3 bg-subtle/80 border border-border-subtle rounded-xl p-3.5 my-1">
                              <button
                                type="button"
                                disabled={!canEdit}
                                onClick={() => {
                                  const icons = ['💡', '⚡', '📌', '🔥', '🎓', '⚠️', '✅'];
                                  const nextIcon =
                                    icons[
                                      (icons.indexOf(block.calloutIcon || '💡') + 1) % icons.length
                                    ];
                                  void handleBlockChange(block.id, { calloutIcon: nextIcon });
                                }}
                                className="text-lg leading-none pt-0.5"
                              >
                                {block.calloutIcon || '💡'}
                              </button>
                              {canEdit && (editingBlockId === block.id || !block.content.trim()) ? (
                                <textarea
                                  ref={(el) => {
                                    blockRefs.current[block.id] = el;
                                  }}
                                  rows={Math.max(2, Math.ceil(block.content.length / 72))}
                                  value={block.content}
                                  onFocus={() => setEditingBlockId(block.id)}
                                  onBlur={() =>
                                    setEditingBlockId((prev) => (prev === block.id ? null : prev))
                                  }
                                  onChange={(e) =>
                                    void handleBlockChange(block.id, { content: e.target.value })
                                  }
                                  placeholder="Ketik isi callout..."
                                  className="flex-1 bg-transparent text-sm leading-relaxed text-text-primary focus:outline-none resize-none"
                                />
                              ) : (
                                <div
                                  onClick={() => {
                                    if (canEdit) setPendingFocusBlockId(block.id);
                                  }}
                                  className={`flex-1 text-sm leading-relaxed text-text-primary whitespace-pre-wrap break-words ${
                                    canEdit ? 'cursor-text' : 'cursor-default'
                                  }`}
                                >
                                  {renderInlineMarkdown(block.content)}
                                </div>
                              )}
                            </div>
                          )}

                          {block.type === 'quote' && (
                            <blockquote className="border-l-[3px] border-text-primary/70 pl-4 py-1 my-1 italic text-text-primary/90">
                              {canEdit && (editingBlockId === block.id || !block.content.trim()) ? (
                                <textarea
                                  ref={(el) => {
                                    blockRefs.current[block.id] = el;
                                  }}
                                  rows={Math.max(1, Math.ceil(block.content.length / 75))}
                                  value={block.content}
                                  onFocus={() => setEditingBlockId(block.id)}
                                  onBlur={() =>
                                    setEditingBlockId((prev) => (prev === block.id ? null : prev))
                                  }
                                  onChange={(e) =>
                                    void handleBlockChange(block.id, { content: e.target.value })
                                  }
                                  onKeyDown={(e) => handleBlockKeyDown(e, block)}
                                  placeholder="Kutipan..."
                                  className="w-full bg-transparent text-[15px] leading-relaxed focus:outline-none resize-none"
                                />
                              ) : (
                                <div
                                  onClick={() => {
                                    if (canEdit) setPendingFocusBlockId(block.id);
                                  }}
                                  className={`w-full text-[15px] leading-relaxed whitespace-pre-wrap break-words ${
                                    canEdit ? 'cursor-text' : 'cursor-default'
                                  }`}
                                >
                                  {renderInlineMarkdown(block.content)}
                                </div>
                              )}
                            </blockquote>
                          )}

                          {block.type === 'divider' && (
                            <div className="py-3">
                              <hr className="border-border-subtle" />
                            </div>
                          )}

                          {/* Notion Embedded Subpage Card */}
                          {block.type === 'subpage' && (() => {
                            const linkedPage = allNotes.find((n) => n.id === block.subpageId);
                            return (
                              <button
                                type="button"
                                onClick={() => {
                                  if (linkedPage) setActiveNoteId(linkedPage.id);
                                }}
                                className="w-full my-1 px-3.5 py-2.5 rounded-xl bg-subtle/60 hover:bg-subtle border border-border-subtle hover:border-accent-strong/60 flex items-center justify-between gap-2 text-left transition group/sub"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span className="text-lg leading-none shrink-0">
                                    {linkedPage?.icon || block.subpageIcon || '📑'}
                                  </span>
                                  <span className="text-sm font-semibold text-text-primary underline decoration-border-subtle underline-offset-4 group-hover/sub:decoration-accent-strong truncate">
                                    {linkedPage?.title || block.content || 'Subhalaman Baru'}
                                  </span>
                                </div>
                                <span className="text-[11px] font-mono text-text-secondary shrink-0">
                                  Buka Subhalaman →
                                </span>
                              </button>
                            );
                          })()}

                          {block.type === 'code' && (
                            <div className="rounded-xl overflow-hidden border border-border-subtle bg-slate-950 text-slate-100 my-1.5">
                              <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-white/10 text-[11px] font-mono">
                                <select
                                  disabled={!canEdit}
                                  value={block.language || 'javascript'}
                                  onChange={(e) =>
                                    void handleBlockChange(block.id, { language: e.target.value })
                                  }
                                  className="bg-transparent text-sky-300 focus:outline-none cursor-pointer"
                                >
                                  {[
                                    'javascript',
                                    'typescript',
                                    'python',
                                    'sql',
                                    'bash',
                                    'cpp',
                                    'html'
                                  ].map((lang) => (
                                    <option key={lang} value={lang} className="bg-slate-900">
                                      {lang}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => {
                                    void navigator.clipboard.writeText(block.content);
                                    setCopiedId(block.id);
                                    window.setTimeout(() => setCopiedId(null), 1500);
                                  }}
                                  className="inline-flex items-center gap-1 text-slate-300 hover:text-white"
                                >
                                  <Copy className="w-3 h-3" />
                                  {copiedId === block.id ? 'Tersalin' : 'Salin'}
                                </button>
                              </div>
                              <textarea
                                ref={(el) => {
                                  blockRefs.current[block.id] = el;
                                }}
                                readOnly={!canEdit}
                                rows={Math.max(3, block.content.split('\n').length)}
                                value={block.content}
                                onChange={(e) =>
                                  void handleBlockChange(block.id, { content: e.target.value })
                                }
                                placeholder="Ketik kode..."
                                className="w-full p-3 bg-transparent font-mono text-xs leading-relaxed text-slate-100 focus:outline-none resize-y"
                              />
                            </div>
                          )}

                          {block.type === 'math' && (
                            <div className="bg-subtle/60 border border-border-subtle rounded-xl p-3 my-1 space-y-2">
                              <div
                                onClick={() => {
                                  if (canEdit) {
                                    setEditingMathId(editingMathId === block.id ? null : block.id);
                                  }
                                }}
                                className={`${canEdit ? 'cursor-pointer' : ''} text-text-primary`}
                              >
                                <MathPreview tex={block.content} />
                              </div>
                              {canEdit && (editingMathId === block.id || !block.content) && (
                                <input
                                  ref={(el) => {
                                    blockRefs.current[block.id] = el;
                                  }}
                                  value={block.content}
                                  onChange={(e) =>
                                    void handleBlockChange(block.id, { content: e.target.value })
                                  }
                                  onKeyDown={(e) => handleBlockKeyDown(e, block)}
                                  placeholder="Rumus LaTeX (mis. E = mc^2)"
                                  className="w-full bg-surface border border-border-subtle rounded-lg px-2.5 py-1.5 font-mono text-xs text-text-primary focus:outline-none"
                                />
                              )}
                            </div>
                          )}

                          {/* Notion Image Block with Cloudinary Upload & Direct Ask AI */}
                          {block.type === 'image' && (
                            <div className="my-1.5">
                              {block.content ? (
                                <figure className="bg-subtle/40 border border-border-subtle rounded-xl p-2 space-y-1.5 relative group/img">
                                  <img
                                    src={block.content}
                                    alt={block.caption || 'Gambar'}
                                    className="max-h-96 w-auto mx-auto rounded-lg object-contain"
                                  />
                                  <div className="absolute top-3 right-3 flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        triggerInlineAIExplain('', {
                                          url: block.content,
                                          caption: block.caption || 'Gambar Catatan'
                                        });
                                      }}
                                      className="px-2.5 py-1 rounded-full bg-indigo-600/90 hover:bg-indigo-500 text-white text-[10px] font-semibold inline-flex items-center gap-1 shadow-md transition"
                                      title="Jadikan gambar ini referensi untuk ditanyakan ke AI"
                                    >
                                      <Sparkles className="w-3 h-3" />
                                      Tanya AI
                                    </button>
                                    {block.content.includes('cloudinary.com') && (
                                      <span className="px-2 py-1 rounded-full bg-black/60 text-sky-300 font-mono text-[9px] inline-flex items-center gap-1">
                                        <Cloud className="w-2.5 h-2.5" />
                                        Cloud
                                      </span>
                                    )}
                                  </div>
                                  <input
                                    readOnly={!canEdit}
                                    value={block.caption || ''}
                                    onChange={(e) =>
                                      void handleBlockChange(block.id, { caption: e.target.value })
                                    }
                                    placeholder={canEdit ? 'Tambahkan keterangan gambar...' : ''}
                                    className="w-full text-center bg-transparent text-xs text-text-secondary focus:outline-none"
                                  />
                                </figure>
                              ) : canEdit ? (
                                <label className="flex flex-col items-center justify-center gap-2 py-6 px-4 rounded-xl border border-dashed border-border-subtle bg-subtle/40 hover:bg-subtle/75 cursor-pointer transition text-center">
                                  {uploadingBlockId === block.id ? (
                                    <>
                                      <Loader2 className="w-5 h-5 text-accent-strong animate-spin" />
                                      <span className="text-xs font-medium text-text-primary">
                                        Mengunggah gambar ke Cloud Catatan...
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <UploadCloud className="w-5 h-5 text-accent-strong" />
                                      <div className="space-y-0.5">
                                        <p className="text-xs font-semibold text-text-primary">
                                          Klik untuk unggah gambar
                                        </p>
                                        <p className="text-[11px] text-text-secondary">
                                          {cloudinaryActive
                                            ? 'Tersimpan otomatis di Cloud Catatan'
                                            : 'Atau tarik file gambar langsung ke halaman ini'}
                                        </p>
                                      </div>
                                    </>
                                  )}
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      const f = e.target.files?.[0];
                                      if (f) void handleUploadImageForBlock(block.id, f);
                                    }}
                                  />
                                </label>
                              ) : null}
                            </div>
                          )}

                          {/* Notion PDF Document Block with Text Extraction & AI Reader */}
                          {block.type === 'pdf' && (() => {
                            const isPdfPreviewOpen = canEdit
                              ? block.toggleOpen
                              : (localToggleOverrides[block.id] ?? block.toggleOpen);
                            return (
                              <div className="my-1.5">
                                {block.content ? (
                                  <div className="bg-subtle/60 border border-border-subtle rounded-xl p-3 space-y-2.5">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-9 h-9 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-500 flex items-center justify-center shrink-0">
                                          <FileText className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0">
                                          <p className="text-xs font-bold text-text-primary truncate">
                                            {block.fileName || block.caption || 'Dokumen.pdf'}
                                          </p>
                                          <p className="text-[10px] text-text-secondary">
                                            {block.pdfPages || 1} halaman • Teks siap dibaca AI
                                          </p>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (canEdit) {
                                              void handleBlockChange(block.id, {
                                                toggleOpen: !block.toggleOpen
                                              });
                                            } else {
                                              setLocalToggleOverrides((prev) => ({
                                                ...prev,
                                                [block.id]: !isPdfPreviewOpen
                                              }));
                                            }
                                          }}
                                          className="px-2.5 py-1 rounded-lg bg-surface border border-border-subtle text-[11px] font-medium text-text-primary hover:border-accent-strong transition"
                                        >
                                          {isPdfPreviewOpen ? 'Tutup Pratinjau' : 'Pratinjau PDF'}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            triggerInlineAIExplain('', undefined, {
                                              fileName:
                                                block.fileName || block.caption || 'Dokumen.pdf',
                                              text: block.pdfText || '',
                                              pages: block.pdfPages || 1,
                                              url: block.content
                                            });
                                          }}
                                          className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold inline-flex items-center gap-1 shadow-sm transition"
                                        >
                                          <Sparkles className="w-3 h-3" />
                                          Tanya AI
                                        </button>
                                      </div>
                                    </div>

                                    {isPdfPreviewOpen && (
                                      <div className="pt-1">
                                        <PdfDocumentPreview
                                          src={block.content}
                                          pdfText={block.pdfText}
                                          totalPages={block.pdfPages || 1}
                                        />
                                      </div>
                                    )}
                                  </div>
                                ) : canEdit ? (
                                  <label className="flex flex-col items-center justify-center gap-2 py-6 px-4 rounded-xl border border-dashed border-border-subtle bg-subtle/40 hover:bg-subtle/75 cursor-pointer transition text-center">
                                    {uploadingBlockId === block.id ? (
                                      <>
                                        <Loader2 className="w-5 h-5 text-accent-strong animate-spin" />
                                        <span className="text-xs font-medium text-text-primary">
                                          Mengekstrak teks PDF &amp; mengunggah ke Cloud Catatan...
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        <FileText className="w-5 h-5 text-rose-500" />
                                        <div className="space-y-0.5">
                                          <p className="text-xs font-semibold text-text-primary">
                                            Klik untuk unggah dokumen PDF
                                          </p>
                                          <p className="text-[11px] text-text-secondary">
                                            Isi halaman PDF otomatis diekstrak agar bisa dirangkum &amp; ditanyakan ke AI
                                          </p>
                                        </div>
                                      </>
                                    )}
                                    <input
                                      type="file"
                                      accept=".pdf,application/pdf"
                                      className="hidden"
                                      onChange={(e) => {
                                        const f = e.target.files?.[0];
                                        if (f) void handleUploadPdfForBlock(block.id, f);
                                      }}
                                    />
                                  </label>
                                ) : null}
                              </div>
                            );
                          })()}

                          {/* Notion Slash Command Menu (`/`) */}
                          {isSlashOpen && (
                            <div className="absolute left-0 top-full mt-1 z-30 w-68 max-h-72 overflow-y-auto miu-card shadow-xl p-1.5 space-y-0.5 no-print">
                              {filteredSlashOptions.length === 0 ? (
                                <div className="px-3 py-3 text-xs text-text-secondary text-center">
                                  Tidak ada hasil
                                </div>
                              ) : (
                                filteredSlashOptions.map((opt, i) => {
                                  const isActive = i === slashState.selectedIndex;
                                  const Icon = opt.Icon;
                                  return (
                                    <button
                                      key={opt.type}
                                      type="button"
                                      onClick={() => void applySlashCommand(block.id, opt.type)}
                                      className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-1.5 rounded-xl text-left transition ${
                                        isActive ? 'bg-subtle' : 'hover:bg-subtle/60'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-7 h-7 rounded-lg bg-surface border border-border-subtle flex items-center justify-center text-text-primary shrink-0">
                                          <Icon className="w-3.5 h-3.5" />
                                        </div>
                                        <div className="min-w-0">
                                          <p className="text-xs font-semibold text-text-primary truncate">
                                            {opt.label}
                                          </p>
                                          <p className="text-[10px] text-text-secondary truncate">
                                            {opt.desc}
                                          </p>
                                        </div>
                                      </div>
                                      <span className="font-mono text-[10px] text-text-secondary shrink-0">
                                        {opt.shortcut}
                                      </span>
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Clickable Blank Area Below Blocks */}
                  {canEdit && (
                    <div
                      onClick={() => void handleAddBlockAfter(undefined, 'text')}
                      className="flex-1 min-h-[120px] cursor-text"
                    />
                  )}
                </div>

                {/* Child Subpages Summary Section inside Current Page */}
                {(childSubpages.length > 0 || canEdit) && (
                  <div className="mt-8 pt-4 border-t border-border-subtle/70 space-y-2.5 no-print">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                        Subhalaman ({childSubpages.length})
                      </span>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => void handleCreateNote(activeNote.id, true)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-subtle hover:bg-subtle/80 text-xs font-medium text-text-primary transition"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Buat Subhalaman</span>
                        </button>
                      )}
                    </div>

                    {childSubpages.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {childSubpages.map((sub) => (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => setActiveNoteId(sub.id)}
                            className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-subtle/55 hover:bg-subtle border border-border-subtle hover:border-accent-strong/60 text-left transition group/subcard"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-base shrink-0">{sub.icon || '📑'}</span>
                              <span className="text-xs font-semibold text-text-primary truncate">
                                {sub.title || 'Subhalaman Tanpa Judul'}
                              </span>
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-text-secondary group-hover/subcard:translate-x-0.5 transition shrink-0" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Comments Section (Active when Commenter, Editor, Owner opens it or comments exist) */}
                {(showCommentsPanel ||
                  effectiveRole === 'comment' ||
                  (activeNote.comments && activeNote.comments.length > 0)) && (
                  <div className="mt-6 pt-5 border-t border-border-subtle space-y-3 no-print">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-text-primary">
                        <MessageSquare className="w-4 h-4 text-amber-500" />
                        <span>Komentar Catatan ({activeNote.comments?.length || 0})</span>
                      </span>
                    </div>

                    {(activeNote.comments || []).length > 0 && (
                      <div className="space-y-2">
                        {(activeNote.comments || []).map((cmt) => {
                          const canDeleteComment =
                            isOwner || (currentUser && cmt.authorId === currentUser.id);
                          return (
                            <div
                              key={cmt.id}
                              className="flex items-start justify-between gap-2 p-3 rounded-xl bg-subtle/55 border border-border-subtle text-xs"
                            >
                              <div className="min-w-0 space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-text-primary">
                                    {cmt.authorName}
                                  </span>
                                  <span className="text-[10px] text-text-secondary">
                                    {new Date(cmt.createdAt).toLocaleString('id-ID', {
                                      day: '2-digit',
                                      month: 'short',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </span>
                                </div>
                                <p className="text-text-primary leading-relaxed whitespace-pre-wrap">
                                  {cmt.content}
                                </p>
                              </div>
                              {canDeleteComment && (
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteComment(cmt.id)}
                                  className="p-1 rounded hover:bg-rose-500/15 text-text-secondary hover:text-rose-500 shrink-0"
                                  title="Hapus komentar"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {canComment ? (
                      <form onSubmit={(e) => void handleAddComment(e)} className="flex gap-2">
                        <input
                          type="text"
                          value={newCommentText}
                          onChange={(e) => setNewCommentText(e.target.value)}
                          placeholder="Tulis komentar atau masukan untuk catatan ini..."
                          className="flex-1 bg-subtle border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent-strong"
                        />
                        <button
                          type="submit"
                          disabled={!newCommentText.trim()}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-accent-strong text-white dark:text-slate-950 text-xs font-semibold hover:opacity-95 disabled:opacity-40 transition shrink-0"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Kirim</span>
                        </button>
                      </form>
                    ) : (
                      <p className="text-[11px] text-text-secondary italic">
                        Hak akses Hanya Lihat — Anda tidak dapat menambahkan komentar pada catatan ini.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="py-20 text-center space-y-3 my-auto">
              <FileText className="w-7 h-7 text-text-secondary mx-auto opacity-50" />
              <button
                type="button"
                onClick={() => void handleCreateNote(null, true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent-strong text-white dark:text-slate-950 text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                Halaman Baru
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Share & Access Control Modal */}
      {showShareModal && activeNote && (
        <ShareNoteModal
          note={activeNote}
          isOwner={isOwner}
          onUpdateShareSettings={handleUpdateShareSettings}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </>
  );
};
