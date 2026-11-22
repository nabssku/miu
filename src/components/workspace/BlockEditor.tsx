'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import katex from 'katex';
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  CalendarDays,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Cloud,
  Columns3,
  Copy,
  Database,
  Download,
  ExternalLink,
  Eye,
  FilePlus2,
  FileText,
  Globe,
  GripVertical,
  HelpCircle,
  Home,
  Info,
  Keyboard,
  LayoutGrid,
  Link2,
  ListTree,
  Loader2,
  Lock,
  LogOut,
  Maximize2,
  MessageCircle,
  MessageSquare,
  Minimize2,
  PanelLeft,
  Pencil,
  Plus,
  Printer,
  Search,
  Send,
  Settings,
  Share2,
  SlidersHorizontal,
  Sparkles,
  SquarePen,
  Star,
  Trash2,
  Ungroup,
  UploadCloud,
  Video
} from 'lucide-react';
import { db } from '../../db/database';
import { useMiu } from '../../context/MiuContext';
import { useNotePresence } from '../../context/NotePresenceContext';
import { normalizePointerCoordinate } from '../../lib/presenceHelper';
import type { CollaboratorPresence } from '../../lib/realtimeShared';
import {
  deleteNoteFromNeon,
  getCloudStatusSnapshot,
  isNeonConfigured,
  saveNoteCommentsToNeon,
  saveNoteToNeon,
  submitFormResponseToNeon,
  syncCloudStatus,
  uploadImageToCloudinary,
  uploadMediaToCloud
} from '../../services/cloudServices';
import type {
  BlockType,
  DatabaseBlockData,
  DatabaseColumn,
  FormBlockData,
  FormResponseAccess,
  MetricBlockData,
  NoteBlock,
  NoteBlockBase,
  NoteComment,
  NoteFontStyle,
  NoteKanbanStatus,
  NoteRecord,
  NoteShareSettings,
  SharePermission,
  SimpleTableData,
  VoiceBlockData,
  ChartBlockData
} from '../../types/miu';
import {
  appendBlockToColumn,
  cloneBlockDeep,
  createBlockId,
  createColumnsBlockData,
  findBlockById,
  findBlockLocation,
  flattenBlocks,
  insertBlocksRelativeDeep,
  mapBlockDeep,
  moveBlockStepDeep,
  moveBlocksToTarget,
  removeBlockDeep,
  resizeColumnsBlock,
  ungroupColumnsBlock
} from '../../utils/blockTreeHelper';
import {
  aggregateDatabaseForChart,
  createDefaultChartData,
  createDefaultDatabaseData,
  createDefaultFormData,
  createDefaultMetricData,
  databaseToMarkdownTable,
  findAllDatabaseSources,
  sanitizeFormSubmission
} from '../../utils/databaseHelper';
import {
  applyInlineMarkdownShortcut,
  isEditableElement,
  resolveBlockConvertShortcut
} from '../../utils/editorShortcuts';
import { parseMarkdownToNotionBlocks, renderInlineMarkdown } from '../../utils/markdown';
import {
  extractTextFromPdfSource,
  PdfDocumentPreview,
  processAndUploadPdf
} from '../../utils/pdfHelper';
import { parseLinkUrl } from '../../utils/linkHelper';
import {
  filterSlashOptions,
  SLASH_OPTIONS,
  type SlashPreset
} from '../../utils/slashOptions';
import { parseVideoEmbedUrl } from '../../utils/videoHelper';
import { formatLocalYYYYMMDD } from '../../services/googleCalendarService';
import { CalendarBoardView } from './CalendarBoardView';
import {
  BlockCollaboratorBadges,
  BlockCollaboratorPointers,
  CollaboratorCaretOverlay,
  CollaboratorsHeaderStrip
} from './CollaboratorOverlays';
import { extractTocHeadings, FloatingTocOutline } from './FloatingTocOutline';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { NotesAuthModal } from './NotesAuthModal';
import { ShareNoteModal } from './ShareNoteModal';
import { ChartBlockView } from './blocks/ChartBlockView';
import { DatabaseBlockView } from './blocks/DatabaseBlockView';
import { FormBlockView } from './blocks/FormBlockView';
import { DEFAULT_MERMAID_CODE, MermaidBlockView } from './blocks/MermaidBlockView';
import { MetricBlockView } from './blocks/MetricBlockView';
import {
  createDefaultSimpleTableData,
  SimpleTableBlockView,
  simpleTableToMarkdown
} from './blocks/SimpleTableBlockView';
import { VoiceBlockView } from './blocks/VoiceBlockView';
import {
  KANBAN_COLUMNS,
  KanbanBoardView,
  renderKanbanStatusIcon
} from './KanbanBoardView';
import { PageActionsMenu } from './PageActionsMenu';
import {
  AddSidebarSectionPopover,
  DEFAULT_SIDEBAR_SECTIONS,
  loadSidebarSections,
  renderSidebarSectionIcon,
  saveSidebarSections,
  SIDEBAR_SECTION_CATALOG,
  SidebarInboxSlideDrawer,
  SidebarInboxTriggerButton,
  SidebarQuickLauncherPopover,
  SidebarWhatsNewButton,
  type SidebarSectionId
} from './SidebarInboxPopover';
import {
  SidebarNoteActionButtons,
  SidebarNoteContextMenu,
  type SidebarNoteMenuTarget
} from './SidebarNoteContextMenu';
import { SidePeekPanel } from './SidePeekPanel';
import { PustakaPageView, type PustakaSkillSubTab } from './PustakaPageView';
import {
  loadActiveSkillNoteIds,
  saveActiveSkillNoteIds
} from '../../services/aiAgentTools';

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
    theme,
    toggleTheme,
    currentUser,
    isPublicShareAccess,
    loginGoogleUser,
    logoutGoogleUser,
    setViewMode,
    activeSemesterId,
    activeCourseId,
    activeNoteId,
    setActiveNoteId,
    activeBlockTarget,
    setActiveBlockTarget,
    updateActiveBlockSelection,
    lastDictationEvent,
    activePopover,
    setActivePopover,
    isLazytypeActive,
    isAIDrawerOpen,
    setIsAIDrawerOpen,
    triggerInlineAIExplain,
    islandPosition
  } = useMiu();
  const hasTopIsland =
    islandPosition === 'top-left' ||
    islandPosition === 'top-center' ||
    islandPosition === 'top-right';

  const { remoteCollaborators, reportLocalCursor, reportLocalPointer } = useNotePresence();

  const allNotes = useLiveQuery(
    async () => {
      const list = await db.notes.toArray();
      return list.sort(
        (a, b) => (a.sortOrder ?? a.createdAt) - (b.sortOrder ?? b.createdAt)
      );
    },
    [],
    []
  );
  const queriedNote = useLiveQuery(() => db.notes.get(activeNoteId), [activeNoteId]);
  const activeNote = queriedNote || allNotes[0];

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(248);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isCustomizeSidebar, setIsCustomizeSidebar] = useState(false);
  const [showAddSidebarSection, setShowAddSidebarSection] = useState(false);
  const [sidebarSections, setSidebarSections] = useState<SidebarSectionId[]>(
    () => loadSidebarSections()
  );
  const [draggedSidebarSection, setDraggedSidebarSection] =
    useState<SidebarSectionId | null>(null);
  const [dropTargetPosition, setDropTargetPosition] = useState<
    'before' | 'inside' | 'after'
  >('inside');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isInboxOpen, setIsInboxOpen] = useState(false);
  const [sidebarNoteMenuTarget, setSidebarNoteMenuTarget] =
    useState<SidebarNoteMenuTarget | null>(null);
  const [sidePeekNoteId, setSidePeekNoteId] = useState<string | null>(null);
  const sidePeekNote = useMemo(
    () => (sidePeekNoteId ? allNotes.find((n) => n.id === sidePeekNoteId) || null : null),
    [allNotes, sidePeekNoteId]
  );
  const [pustakaSubTab, setPustakaSubTab] = useState<PustakaSkillSubTab>('active');
  const [activeSkillIdsState, setActiveSkillIdsState] = useState<string[]>(() =>
    loadActiveSkillNoteIds()
  );
  const [quickLinkCopied, setQuickLinkCopied] = useState(false);
  const [copiedMetaField, setCopiedMetaField] = useState<string | null>(null);
  const [showMetadataFooter, setShowMetadataFooter] = useState(true);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [shortcutToast, setShortcutToast] = useState<string | null>(null);
  const shortcutToastTimerRef = useRef<number | null>(null);
  const sidebarSearchInputRef = useRef<HTMLInputElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const blockUndoStackRef = useRef<Record<string, NoteBlock[][]>>({});
  const blockRedoStackRef = useRef<Record<string, NoteBlock[][]>>({});
  const lastBlockUndoPushAtRef = useRef<Record<string, number>>({});
  const lastBlockEditStructuralRef = useRef(false);
  const globalShortcutHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {});

  const showShortcutFeedback = (message: string) => {
    setShortcutToast(message);
    if (shortcutToastTimerRef.current) {
      window.clearTimeout(shortcutToastTimerRef.current);
    }
    shortcutToastTimerRef.current = window.setTimeout(() => {
      shortcutToastTimerRef.current = null;
      setShortcutToast((prev) => (prev === message ? null : prev));
    }, 2200);
  };

  const [showTocOutline, setShowTocOutline] = useState(true);
  useEffect(() => {
    try {
      const savedW = Number(window.localStorage.getItem('miu_sidebar_width'));
      if (Number.isFinite(savedW) && savedW >= 210 && savedW <= 440) {
        setSidebarWidth(savedW);
      }
      const savedFooter = window.localStorage.getItem('miu_show_metadata_footer');
      if (savedFooter === 'false') {
        setShowMetadataFooter(false);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!isSidebarOpen) {
      setIsInboxOpen(false);
    }
  }, [isSidebarOpen]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      globalShortcutHandlerRef.current(e);
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const handleToggleSidebarSection = (id: SidebarSectionId) => {
    setSidebarSections((prev) => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter((s) => s !== id) : [...prev, id];
      const safeNext = next.length > 0 ? next : ['private' as SidebarSectionId];
      saveSidebarSections(safeNext);
      return safeNext;
    });
  };

  const handleReorderSidebarSection = (
    sourceId: SidebarSectionId,
    targetId: SidebarSectionId
  ) => {
    if (sourceId === targetId) return;
    setSidebarSections((prev) => {
      const next = prev.filter((s) => s !== sourceId);
      const targetIdx = next.indexOf(targetId);
      if (targetIdx === -1) return prev;
      next.splice(targetIdx, 0, sourceId);
      saveSidebarSections(next);
      return next;
    });
  };

  const handleStartSidebarResize = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    let didDrag = false;
    let latestWidth = startWidth;
    setIsResizingSidebar(true);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      if (Math.abs(delta) > 3) {
        didDrag = true;
      }
      if (didDrag) {
        latestWidth = Math.max(210, Math.min(440, startWidth + delta));
        setSidebarWidth(latestWidth);
      }
    };

    const onMouseUp = () => {
      setIsResizingSidebar(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (!didDrag) {
        setIsSidebarOpen(false);
      } else {
        try {
          window.localStorage.setItem('miu_sidebar_width', String(latestWidth));
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const [mainViewMode, setMainViewMode] = useState<
    'document' | 'kanban' | 'calendar' | 'pustaka'
  >('document');

  useEffect(() => {
    const handleOpenPustaka = (e: Event) => {
      const custom = e as CustomEvent<{ subTab?: PustakaSkillSubTab }>;
      setPustakaSubTab(custom.detail?.subTab || 'active');
      setActiveSkillIdsState(loadActiveSkillNoteIds());
      setMainViewMode('pustaka');
    };
    const handleOpenDocumentNote = (e: Event) => {
      const custom = e as CustomEvent<{ noteId?: string }>;
      if (custom.detail?.noteId) {
        setActiveNoteId(custom.detail.noteId);
        setMainViewMode('document');
      }
    };
    window.addEventListener('miu:open-pustaka-page', handleOpenPustaka);
    window.addEventListener('miu:open-document-note', handleOpenDocumentNote);
    return () => {
      window.removeEventListener('miu:open-pustaka-page', handleOpenPustaka);
      window.removeEventListener('miu:open-document-note', handleOpenDocumentNote);
    };
  }, [setActiveNoteId]);
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
  const [pdfProgressByBlockId, setPdfProgressByBlockId] = useState<Record<string, string>>({});
  const [reExtractingBlockId, setReExtractingBlockId] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);

  const [slashState, setSlashState] = useState<{
    blockId: string;
    query: string;
    selectedIndex: number;
  } | null>(null);
  const [menuBlockId, setMenuBlockId] = useState<string | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editingMathId, setEditingMathId] = useState<string | null>(null);
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [videoUrlDrafts, setVideoUrlDrafts] = useState<Record<string, string>>({});
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [linkDrafts, setLinkDrafts] = useState<Record<string, { url: string; caption: string }>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pendingFocusBlockId, setPendingFocusBlockId] = useState<string | null>(null);
  const [justDictatedBlockId, setJustDictatedBlockId] = useState<string | null>(null);
  const [jumpHighlightBlockId, setJumpHighlightBlockId] = useState<string | null>(null);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
  const [lastSelectedBlockId, setLastSelectedBlockId] = useState<string | null>(null);
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const [dropTargetBlock, setDropTargetBlock] = useState<{
    blockId: string;
    position: 'before' | 'after';
  } | null>(null);
  const [dropTargetColumn, setDropTargetColumn] = useState<{
    columnsBlockId: string;
    columnId: string;
  } | null>(null);
  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null);
  const [dropTargetNoteId, setDropTargetNoteId] = useState<string | null>(null);
  const [isFileDragOverEditor, setIsFileDragOverEditor] = useState(false);

  const blockRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({});
  const toggleBodyRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const caretHostRefs = useRef<Record<string, HTMLElement | null>>({});
  const activeBlockTargetRef = useRef(activeBlockTarget);
  activeBlockTargetRef.current = activeBlockTarget;
  const lastHandledFlashAtRef = useRef<number>(0);
  const lastHandledCaretAtRef = useRef<number>(0);
  const dictationFlashTimerRef = useRef<number | null>(null);
  const jumpFlashTimerRef = useRef<number | null>(null);
  const neonDebounceMapRef = useRef<Record<string, number>>({});
  const neonDebounceStartMapRef = useRef<Record<string, number>>({});

  const setCaretHostRef = (
    blockId: string,
    field: 'content' | 'toggleBody' | 'title',
    el: HTMLElement | null
  ) => {
    caretHostRefs.current[`${blockId}:${field}`] = el;
  };

  const collaboratorsByBlockId = useMemo(() => {
    const grouped: Record<string, CollaboratorPresence[]> = {};
    for (const collab of remoteCollaborators) {
      if (!collab.blockId) continue;
      if (!grouped[collab.blockId]) grouped[collab.blockId] = [];
      grouped[collab.blockId].push(collab);
    }
    return grouped;
  }, [remoteCollaborators]);

  const pointersByBlockId = useMemo(() => {
    const grouped: Record<string, CollaboratorPresence[]> = {};
    for (const collab of remoteCollaborators) {
      if (!collab.pointerBlockId || collab.pointerX === null || collab.pointerY === null) {
        continue;
      }
      if (!grouped[collab.pointerBlockId]) grouped[collab.pointerBlockId] = [];
      grouped[collab.pointerBlockId].push(collab);
    }
    return grouped;
  }, [remoteCollaborators]);

  const openDocumentNote = (noteId: string) => {
    setActiveNoteId(noteId);
    setMainViewMode('document');
  };

  // Clear active cursor & pointer when leaving document view
  useEffect(() => {
    if (mainViewMode !== 'document' && activeNote) {
      reportLocalCursor({
        noteId: activeNote.id,
        blockId: '',
        field: 'content',
        selectionStart: 0,
        selectionEnd: 0,
        isEditing: false,
        immediate: true
      });
      reportLocalPointer({
        noteId: activeNote.id,
        pointerBlockId: null,
        pointerX: null,
        pointerY: null
      });
    }
  }, [mainViewMode, activeNote, reportLocalCursor, reportLocalPointer]);

  // Clear block selection when switching notes
  useEffect(() => {
    setSelectedBlockIds([]);
    setLastSelectedBlockId(null);
    setIsSelectMode(false);
    setEditingLinkId(null);
    setEditingVideoId(null);
    if (activeBlockTargetRef.current && activeBlockTargetRef.current.noteId !== activeNoteId) {
      setActiveBlockTarget(null);
    }
  }, [activeNoteId, setActiveBlockTarget]);

  // Brief emerald flash highlight on the block that just received dictation
  useEffect(() => {
    if (!lastDictationEvent || !activeNote || lastDictationEvent.noteId !== activeNote.id) {
      return;
    }
    if (lastDictationEvent.at <= lastHandledFlashAtRef.current) return;
    lastHandledFlashAtRef.current = lastDictationEvent.at;

    setJustDictatedBlockId(lastDictationEvent.blockId);
    if (dictationFlashTimerRef.current) {
      window.clearTimeout(dictationFlashTimerRef.current);
    }
    const eventBlockId = lastDictationEvent.blockId;
    dictationFlashTimerRef.current = window.setTimeout(() => {
      dictationFlashTimerRef.current = null;
      setJustDictatedBlockId((prev) => (prev === eventBlockId ? null : prev));
    }, 1600);
  }, [lastDictationEvent, activeNote?.id]);

  useEffect(() => {
    if (!menuBlockId) return;
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-miu-block-menu]') || target?.closest('[data-miu-block-gutter]')) {
        return;
      }
      setMenuBlockId(null);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuBlockId(null);
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuBlockId]);

  useEffect(() => {
    return () => {
      if (dictationFlashTimerRef.current) {
        window.clearTimeout(dictationFlashTimerRef.current);
      }
      if (jumpFlashTimerRef.current) {
        window.clearTimeout(jumpFlashTimerRef.current);
      }
    };
  }, []);

  // Restore caret position after Dexie useLiveQuery renders the updated block content
  useEffect(() => {
    if (!lastDictationEvent || !activeNote || lastDictationEvent.noteId !== activeNote.id) {
      return;
    }
    if (lastDictationEvent.at <= lastHandledCaretAtRef.current) return;
    if ((activeNote.updatedAt || 0) < lastDictationEvent.at) return;

    lastHandledCaretAtRef.current = lastDictationEvent.at;
    const { blockId, field, caret } = lastDictationEvent;
    const rafId = window.requestAnimationFrame(() => {
      const el =
        field === 'toggleBody' ? toggleBodyRefs.current[blockId] : blockRefs.current[blockId];
      if (el && document.activeElement === el && 'setSelectionRange' in el) {
        const pos = Math.max(0, Math.min(el.value.length, caret));
        el.setSelectionRange(pos, pos);
      }
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [lastDictationEvent, activeNote]);

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

  const reportBlockTarget = (
    blk: NoteBlockBase,
    field: 'content' | 'toggleBody' = 'content',
    selectionStart?: number,
    selectionEnd?: number,
    source: 'focus' | 'selection' = 'focus'
  ) => {
    if (!activeNote) return;
    const rawContent = field === 'toggleBody' ? blk.toggleBody || '' : blk.content || '';
    const start =
      typeof selectionStart === 'number' ? selectionStart : rawContent.length;
    const end = typeof selectionEnd === 'number' ? selectionEnd : start;
    setActiveBlockTarget({
      noteId: activeNote.id,
      blockId: blk.id,
      field,
      blockType: blk.type,
      preview: rawContent,
      selectionStart: start,
      selectionEnd: end,
      source,
      updatedAt: Date.now()
    });
    reportLocalCursor({
      noteId: activeNote.id,
      blockId: blk.id,
      field,
      selectionStart: start,
      selectionEnd: end,
      isEditing: canEdit,
      immediate: true
    });
  };

  const handleJumpToCollaborator = (collab: CollaboratorPresence) => {
    const targetId = collab.blockId || collab.pointerBlockId;
    if (!targetId) return;
    setMainViewMode('document');

    if (collab.field === 'toggleBody' && targetId !== '__title__' && !canEdit) {
      setLocalToggleOverrides((prev) => ({ ...prev, [targetId]: true }));
    }

    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        const selector =
          targetId === '__title__'
            ? '[data-miu-title-wrap="true"]'
            : `[data-miu-block-id="${targetId.replace(/"/g, '\\"')}"]`;
        const targetEl = document.querySelector<HTMLElement>(selector);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        setJumpHighlightBlockId(targetId);
        if (jumpFlashTimerRef.current) {
          window.clearTimeout(jumpFlashTimerRef.current);
        }
        jumpFlashTimerRef.current = window.setTimeout(() => {
          jumpFlashTimerRef.current = null;
          setJumpHighlightBlockId((prev) => (prev === targetId ? null : prev));
        }, 1800);
      }, 40);
    });
  };

  const scrollToBlockById = (targetId: string) => {
    setMainViewMode('document');
    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        const selector = `[data-miu-block-id="${targetId.replace(/"/g, '\\"')}"]`;
        const targetEl = document.querySelector<HTMLElement>(selector);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        setJumpHighlightBlockId(targetId);
        if (jumpFlashTimerRef.current) {
          window.clearTimeout(jumpFlashTimerRef.current);
        }
        jumpFlashTimerRef.current = window.setTimeout(() => {
          jumpFlashTimerRef.current = null;
          setJumpHighlightBlockId((prev) => (prev === targetId ? null : prev));
        }, 1500);
      }, 20);
    });
  };

  const focusPreviewBlock = (blk: NoteBlockBase) => {
    if (!canEdit) return;
    reportBlockTarget(
      blk,
      'content',
      blk.content.length,
      blk.content.length,
      'focus'
    );
    setPendingFocusBlockId(blk.id);
  };

  const syncCursorPresence = (
    blk: NoteBlockBase,
    field: 'content' | 'toggleBody',
    el: HTMLInputElement | HTMLTextAreaElement,
    isEditing: boolean,
    immediate = false
  ) => {
    if (!activeNote) return;
    const start = typeof el.selectionStart === 'number' ? el.selectionStart : el.value.length;
    const end = typeof el.selectionEnd === 'number' ? el.selectionEnd : start;
    reportLocalCursor({
      noteId: activeNote.id,
      blockId: blk.id,
      field,
      selectionStart: start,
      selectionEnd: end,
      isEditing,
      immediate
    });
  };

  const getEditableBlockAttrs = (
    blk: NoteBlockBase,
    field: 'content' | 'toggleBody' = 'content'
  ) => ({
    'data-miu-note-id': activeNote?.id || '',
    'data-miu-block-id': blk.id,
    'data-miu-block-field': field,
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const el = e.currentTarget;
      if (!canEdit) {
        syncCursorPresence(blk, field, el, false, true);
        return;
      }
      setEditingBlockId(blk.id);
      reportBlockTarget(
        blk,
        field,
        typeof el.selectionStart === 'number' ? el.selectionStart : el.value.length,
        typeof el.selectionEnd === 'number' ? el.selectionEnd : el.value.length,
        'focus'
      );
    },
    onInput: (e: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (!activeNote) return;
      const el = e.currentTarget;
      syncCursorPresence(blk, field, el, canEdit, false);
    },
    onClick: (e: React.MouseEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (!activeNote) return;
      const el = e.currentTarget;
      syncCursorPresence(blk, field, el, canEdit, false);
      if (!canEdit) return;
      updateActiveBlockSelection(
        activeNote.id,
        blk.id,
        field,
        typeof el.selectionStart === 'number' ? el.selectionStart : el.value.length,
        typeof el.selectionEnd === 'number' ? el.selectionEnd : el.value.length,
        el.value
      );
    },
    onKeyUp: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (!activeNote) return;
      const el = e.currentTarget;
      syncCursorPresence(blk, field, el, canEdit, false);
      if (!canEdit) return;
      updateActiveBlockSelection(
        activeNote.id,
        blk.id,
        field,
        typeof el.selectionStart === 'number' ? el.selectionStart : el.value.length,
        typeof el.selectionEnd === 'number' ? el.selectionEnd : el.value.length,
        el.value
      );
    },
    onSelect: (e: React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (!activeNote) return;
      const el = e.currentTarget;
      syncCursorPresence(blk, field, el, canEdit, false);
      if (!canEdit) return;
      updateActiveBlockSelection(
        activeNote.id,
        blk.id,
        field,
        typeof el.selectionStart === 'number' ? el.selectionStart : el.value.length,
        typeof el.selectionEnd === 'number' ? el.selectionEnd : el.value.length,
        el.value
      );
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const el = e.currentTarget;
      if (activeNote) {
        syncCursorPresence(blk, field, el, false, false);
      }
      if (activeNote && canEdit) {
        updateActiveBlockSelection(
          activeNote.id,
          blk.id,
          field,
          typeof el.selectionStart === 'number' ? el.selectionStart : el.value.length,
          typeof el.selectionEnd === 'number' ? el.selectionEnd : el.value.length,
          el.value,
          true
        );
      }
      setEditingBlockId((prev) => (prev === blk.id ? null : prev));
    }
  });

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
        flattenBlocks(n.blocks).some(
          (b) =>
            b.content.toLowerCase().includes(q) ||
            Boolean(b.caption && b.caption.toLowerCase().includes(q)) ||
            Boolean(
              b.voiceData?.transcript &&
                b.voiceData.transcript.toLowerCase().includes(q)
            ) ||
            Boolean(
              b.tableData?.rows?.some((row) =>
                row.some((cell) => cell.toLowerCase().includes(q))
              )
            )
        )
    );
  }, [myNotes, allNotes, searchQuery]);

  // Effective permission role helper for any note (inherits from ancestor shared page if subpage)
  const resolveNotePermission = (targetNote: NoteRecord): 'owner' | SharePermission => {
    if (currentUser && (!targetNote.ownerId || targetNote.ownerId === currentUser.id)) {
      return 'owner';
    }
    if (!currentUser && !targetNote.ownerId) {
      return 'owner';
    }
    let curr: NoteRecord | undefined = targetNote;
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
  };

  // Effective permission role for active note (inherits from ancestor shared page if subpage)
  const effectiveRole: 'owner' | SharePermission = useMemo(() => {
    if (!activeNote) return 'owner';
    return resolveNotePermission(activeNote);
  }, [activeNote, allNotes, currentUser]);

  const isOwner = effectiveRole === 'owner';
  const hasEditPermission = effectiveRole === 'owner' || effectiveRole === 'edit';
  const isPageLocked = Boolean(
    activeNote?.isLocked ?? activeNote?.shareSettings?.isLocked
  );
  const canEdit = hasEditPermission && !isPageLocked;
  const canComment =
    effectiveRole === 'owner' || effectiveRole === 'edit' || effectiveRole === 'comment';

  const activeFontStyle: NoteFontStyle =
    activeNote?.fontStyle || activeNote?.shareSettings?.fontStyle || 'default';
  const isSmallText = Boolean(
    activeNote?.isSmallText ?? activeNote?.shareSettings?.isSmallText
  );
  const noteFontFamily =
    activeFontStyle === 'serif'
      ? 'Lyon-Text, Georgia, YuMincho, "Yu Mincho", "Hiragino Mincho ProN", Cambria, "Times New Roman", Times, serif'
      : activeFontStyle === 'mono'
        ? "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
        : "'Plus Jakarta Sans', Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif";

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

  const isSlashInsideColumn = useMemo(() => {
    if (!slashState || !activeNote) return false;
    return findBlockLocation(activeNote.blocks, slashState.blockId)?.container === 'column';
  }, [slashState, activeNote]);

  const filteredSlashOptions = useMemo(() => {
    if (!slashState) return SLASH_OPTIONS;
    return filterSlashOptions(slashState.query, isSlashInsideColumn);
  }, [slashState, isSlashInsideColumn]);

  // Debounced Neon Postgres Sync helper with bounded maxWait (180ms idle / 450ms ceiling)
  const scheduleNeonSave = (noteToSave: NoteRecord) => {
    const targetOwner = noteToSave.ownerId || currentUser?.id;
    if (!targetOwner || !isNeonConfigured()) return;
    setSyncStatus('syncing');
    const now = Date.now();
    if (!neonDebounceStartMapRef.current[noteToSave.id]) {
      neonDebounceStartMapRef.current[noteToSave.id] = now;
    }
    const prevTimer = neonDebounceMapRef.current[noteToSave.id];
    if (prevTimer) {
      window.clearTimeout(prevTimer);
    }
    const elapsed = now - neonDebounceStartMapRef.current[noteToSave.id];
    const remainingMaxWait = Math.max(0, 450 - elapsed);
    const waitMs = Math.min(180, remainingMaxWait);
    neonDebounceMapRef.current[noteToSave.id] = window.setTimeout(async () => {
      delete neonDebounceMapRef.current[noteToSave.id];
      delete neonDebounceStartMapRef.current[noteToSave.id];
      const latestToSave = (await db.notes.get(noteToSave.id)) || noteToSave;
      const ok = await saveNoteToNeon(targetOwner, latestToSave);
      setSyncStatus(ok ? 'synced' : 'idle');
    }, waitMs);
  };

  const updateNote = async (patch: Partial<NoteRecord>) => {
    if (!activeNote || !hasEditPermission) return;
    const fresh = (await db.notes.get(activeNote.id)) || activeNote;
    const updatedAt = Date.now();

    const baseShare: NoteShareSettings = patch.shareSettings ||
      fresh.shareSettings || {
        isPublicLink: false,
        publicRole: 'view',
        collaborators: []
      };

    const syncedShareSettings: NoteShareSettings = {
      ...baseShare,
      ...(patch.fontStyle !== undefined ? { fontStyle: patch.fontStyle } : {}),
      ...(patch.isSmallText !== undefined ? { isSmallText: patch.isSmallText } : {}),
      ...(patch.isLocked !== undefined ? { isLocked: patch.isLocked } : {})
    };

    const finalPatch: Partial<NoteRecord> = {
      ...patch,
      shareSettings: syncedShareSettings,
      updatedAt
    };

    const nextNote: NoteRecord = {
      ...fresh,
      ...finalPatch
    };
    await db.notes.update(activeNote.id, finalPatch);
    scheduleNeonSave(nextNote);
  };

  const handleUpdateShareSettings = async (settings: NoteShareSettings) => {
    if (!activeNote || !isOwner) return;
    const updatedAt = Date.now();
    const mergedSettings: NoteShareSettings = {
      fontStyle: activeFontStyle,
      isSmallText,
      isLocked: isPageLocked,
      ...settings
    };
    const nextNote: NoteRecord = {
      ...activeNote,
      shareSettings: mergedSettings,
      updatedAt
    };
    await db.notes.update(activeNote.id, {
      shareSettings: mergedSettings,
      updatedAt
    });
    scheduleNeonSave(nextNote);
  };

  const handleCopyActiveShareLink = async () => {
    if (!activeNote) return;
    const currentSettings: NoteShareSettings = activeNote.shareSettings || {
      isPublicLink: false,
      publicRole: 'view',
      collaborators: []
    };
    if (!currentSettings.isPublicLink && isOwner) {
      await handleUpdateShareSettings({
        ...currentSettings,
        isPublicLink: true
      });
    }
    const shareUrl = `${window.location.origin}/app?share=${encodeURIComponent(activeNote.id)}`;
    await navigator.clipboard.writeText(shareUrl);
    setQuickLinkCopied(true);
    window.setTimeout(() => setQuickLinkCopied(false), 2000);
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

  const updateNoteBlocks = async (
    nextBlocks: NoteBlock[],
    options?: { skipHistory?: boolean; structural?: boolean }
  ) => {
    if (!canEdit || !activeNote) return;
    if (!options?.skipHistory) {
      const noteId = activeNote.id;
      const now = Date.now();
      const isStructural = options?.structural !== false;
      const prevPushAt = lastBlockUndoPushAtRef.current[noteId] || 0;
      const shouldPush = isStructural || now - prevPushAt > 700;
      if (shouldPush) {
        const currentSnapshot = activeNote.blocks.map((b) => ({
          ...b,
          ...(b.columns
            ? { columns: b.columns.map((c) => ({ ...c, blocks: c.blocks.map((cb) => ({ ...cb })) })) }
            : {})
        }));
        const stack = blockUndoStackRef.current[noteId] || [];
        stack.push(currentSnapshot);
        if (stack.length > 40) stack.shift();
        blockUndoStackRef.current[noteId] = stack;
        blockRedoStackRef.current[noteId] = [];
        lastBlockUndoPushAtRef.current[noteId] = now;
      }
      lastBlockEditStructuralRef.current = isStructural;
    }
    await updateNote({ blocks: nextBlocks });
  };

  const handleUndoBlocks = async () => {
    if (!activeNote || !canEdit) return;
    const noteId = activeNote.id;
    const stack = blockUndoStackRef.current[noteId];
    if (!stack || stack.length === 0) return;
    const previous = stack.pop();
    if (!previous) return;
    const redoStack = blockRedoStackRef.current[noteId] || [];
    redoStack.push(activeNote.blocks.map((b) => ({ ...b })));
    if (redoStack.length > 40) redoStack.shift();
    blockRedoStackRef.current[noteId] = redoStack;
    lastBlockEditStructuralRef.current = true;
    await updateNoteBlocks(previous, { skipHistory: true });
    showShortcutFeedback('Undo diterapkan (⌘Z)');
  };

  const handleRedoBlocks = async () => {
    if (!activeNote || !canEdit) return;
    const noteId = activeNote.id;
    const redoStack = blockRedoStackRef.current[noteId];
    if (!redoStack || redoStack.length === 0) return;
    const nextSnapshot = redoStack.pop();
    if (!nextSnapshot) return;
    const undoStack = blockUndoStackRef.current[noteId] || [];
    undoStack.push(activeNote.blocks.map((b) => ({ ...b })));
    if (undoStack.length > 40) undoStack.shift();
    blockUndoStackRef.current[noteId] = undoStack;
    lastBlockEditStructuralRef.current = true;
    await updateNoteBlocks(nextSnapshot, { skipHistory: true });
    showShortcutFeedback('Redo diterapkan (⌘⇧Z)');
  };

  // Create a clean blank Notion page (root or nested subpage) & sync to Neon
  const handleCreateNote = async (
    parentId: string | null = null,
    switchToNew = true,
    kanbanStatus: NoteKanbanStatus = 'todo',
    dueDate = ''
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
      icon: parentId ? '📑' : dueDate ? '📅' : '📄',
      isFavorite: false,
      kanbanStatus,
      dueDate: '',
      dueTime: '',
      createdAt: now,
      updatedAt: now,
      blocks: [
        dueDate
          ? {
              id: firstBlockId,
              type: 'deadline',
              content: '',
              checked: false,
              dueDate
            }
          : {
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
      setMainViewMode('document');
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
    if (sidePeekNoteId && idsToDelete.has(sidePeekNoteId)) {
      setSidePeekNoteId(null);
    }
  };

  const handleUpdateSpecificNote = async (
    targetNoteId: string,
    patch: Partial<NoteRecord>
  ) => {
    const fresh = await db.notes.get(targetNoteId);
    if (!fresh) return;
    const updatedAt = patch.updatedAt || Date.now();
    const nextNote: NoteRecord = { ...fresh, ...patch, updatedAt };
    await db.notes.update(targetNoteId, { ...patch, updatedAt });
    scheduleNeonSave(nextNote);
  };

  const handleCopySpecificNoteLink = (targetNote: NoteRecord) => {
    const nextShare: NoteShareSettings = {
      ...(targetNote.shareSettings || {
        isPublicLink: true,
        publicRole: 'view',
        collaborators: []
      }),
      isPublicLink: true,
      publicRole: targetNote.shareSettings?.publicRole || 'view'
    };
    void handleUpdateSpecificNote(targetNote.id, { shareSettings: nextShare });
    const url = `${window.location.origin}/app?share=${encodeURIComponent(targetNote.id)}`;
    void navigator.clipboard.writeText(url);
  };

  const handleToggleWikiOnNote = async (targetNote: NoteRecord) => {
    const hasWikiBanner = targetNote.blocks.some(
      (b) => b.type === 'callout' && b.content.includes('Halaman Wiki Terverifikasi')
    );
    const nextBlocks: NoteBlock[] = hasWikiBanner
      ? targetNote.blocks.filter(
          (b) =>
            !(b.type === 'callout' && b.content.includes('Halaman Wiki Terverifikasi'))
        )
      : [
          {
            id: `blk-wiki-${Date.now()}`,
            type: 'callout',
            calloutIcon: '🏛️',
            content: `Halaman Wiki Terverifikasi • Pemilik: ${
              targetNote.ownerName || currentUser?.name || 'Pengguna Miu'
            }`
          },
          ...targetNote.blocks
        ];
    await handleUpdateSpecificNote(targetNote.id, {
      blocks:
        nextBlocks.length > 0
          ? nextBlocks
          : [{ id: `blk-${Date.now()}`, type: 'text', content: '' }]
    });
  };

  const handleOpenNoteInNewTab = (targetNote: NoteRecord) => {
    const url = `${window.location.origin}/app?share=${encodeURIComponent(targetNote.id)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const patchBlockByIdInDb = async (
    noteId: string,
    blockId: string,
    patch: Partial<NoteBlock>
  ) => {
    const freshNote = await db.notes.get(noteId);
    if (!freshNote) return;
    const updatedAt = Date.now();
    const nextBlocks = mapBlockDeep(freshNote.blocks, blockId, (b) => ({ ...b, ...patch }));
    await db.notes.update(noteId, { blocks: nextBlocks, updatedAt });
    scheduleNeonSave({ ...freshNote, blocks: nextBlocks, updatedAt });
  };

  const patchBlockInAnyNote = async (
    targetNoteId: string,
    targetBlockId: string,
    updater: (blk: NoteBlock) => NoteBlock
  ) => {
    const freshNote = await db.notes.get(targetNoteId);
    if (!freshNote) return;
    const perm = resolveNotePermission(freshNote);
    if (perm !== 'owner' && perm !== 'edit') return;
    const updatedAt = Date.now();
    const nextBlocks = mapBlockDeep(freshNote.blocks, targetBlockId, updater);
    await db.notes.update(targetNoteId, { blocks: nextBlocks, updatedAt });
    scheduleNeonSave({ ...freshNote, blocks: nextBlocks, updatedAt });
  };

  const handleSyncColumnInDatabase = async (
    targetNoteId: string,
    targetBlockId: string,
    column: DatabaseColumn
  ) => {
    await patchBlockInAnyNote(targetNoteId, targetBlockId, (blk) => {
      if (blk.type !== 'database' || !blk.databaseData) return blk;
      const cols = blk.databaseData.columns || [];
      const exists = cols.some((c) => c.id === column.id);
      const nextCols = exists
        ? cols.map((c) => (c.id === column.id ? { ...c, ...column } : c))
        : [...cols, column];
      return {
        ...blk,
        databaseData: { ...blk.databaseData, columns: nextCols }
      };
    });
  };

  const handleCreateStarterDatabaseForBlock = async (
    afterBlockId: string
  ): Promise<{ noteId: string; blockId: string } | null> => {
    if (!activeNote || !canEdit) return null;
    const freshNote = (await db.notes.get(activeNote.id)) || activeNote;
    const dbData = createDefaultDatabaseData('blank');
    const newDbId = createBlockId('blk-db');
    const newDbBlock: NoteBlock = {
      id: newDbId,
      type: 'database',
      content: dbData.title,
      databaseData: dbData
    };
    const nextBlocks = insertBlocksRelativeDeep(
      freshNote.blocks,
      afterBlockId,
      'after',
      [newDbBlock]
    );
    await updateNoteBlocks(nextBlocks);
    return { noteId: freshNote.id, blockId: newDbId };
  };

  const handleCreateConnectedBlockFromDatabase = async (
    dbBlockId: string,
    kind: 'bar_chart' | 'donut_chart' | 'form' | 'metric'
  ) => {
    if (!activeNote || !canEdit) return;
    const freshNote = (await db.notes.get(activeNote.id)) || activeNote;
    const sources = findAllDatabaseSources([freshNote]);
    const preferred = { noteId: freshNote.id, blockId: dbBlockId };
    let newBlock: NoteBlock;

    if (kind === 'bar_chart' || kind === 'donut_chart') {
      const chartData = createDefaultChartData(
        sources,
        kind === 'donut_chart' ? 'donut' : 'bar',
        preferred
      );
      newBlock = {
        id: createBlockId('blk-chart'),
        type: 'chart',
        content: chartData.title,
        chartData
      };
    } else if (kind === 'form') {
      const formData = createDefaultFormData(sources, preferred);
      newBlock = {
        id: createBlockId('blk-form'),
        type: 'form',
        content: formData.title,
        formData
      };
    } else {
      const metricData = createDefaultMetricData(sources, preferred);
      newBlock = {
        id: createBlockId('blk-metric'),
        type: 'metric',
        content: metricData.title,
        metricData
      };
    }

    const nextBlocks = insertBlocksRelativeDeep(
      freshNote.blocks,
      dbBlockId,
      'after',
      [newBlock]
    );
    await updateNoteBlocks(nextBlocks);
  };

  const handleSubmitForm = async (payload: {
    formBlockId: string;
    targetNoteId: string;
    targetBlockId: string;
    values: Record<string, unknown>;
    responseAccess: FormResponseAccess;
  }): Promise<{ ok: boolean; error?: string }> => {
    if (!activeNote) return { ok: false, error: 'Catatan tidak ditemukan.' };

    if (isNeonConfigured()) {
      const serverRes = await submitFormResponseToNeon({
        sourceNoteId: activeNote.id,
        formBlockId: payload.formBlockId,
        targetNoteId: payload.targetNoteId,
        targetBlockId: payload.targetBlockId,
        values: payload.values
      });

      if (!serverRes.cloudDisabled) {
        if (!serverRes.ok || !serverRes.row) {
          return { ok: false, error: serverRes.error || 'Gagal mengirim formulir.' };
        }

        const targetNote = await db.notes.get(payload.targetNoteId);
        if (targetNote) {
          let nextTargetBlocks = mapBlockDeep(
            targetNote.blocks,
            payload.targetBlockId,
            (blk) => ({
              ...blk,
              databaseData: blk.databaseData
                ? {
                    ...blk.databaseData,
                    rows: [...(blk.databaseData.rows || []), serverRes.row!]
                  }
                : blk.databaseData
            })
          );
          if (payload.targetNoteId === activeNote.id) {
            nextTargetBlocks = mapBlockDeep(nextTargetBlocks, payload.formBlockId, (blk) => ({
              ...blk,
              formData: blk.formData
                ? {
                    ...blk.formData,
                    submissionCount:
                      serverRes.submissionCount ?? (blk.formData.submissionCount || 0) + 1
                  }
                : blk.formData
            }));
          }
          await db.notes.update(payload.targetNoteId, {
            blocks: nextTargetBlocks,
            updatedAt: Date.now()
          });
        }

        if (payload.targetNoteId !== activeNote.id) {
          const freshSource = await db.notes.get(activeNote.id);
          if (freshSource) {
            const nextSourceBlocks = mapBlockDeep(
              freshSource.blocks,
              payload.formBlockId,
              (blk) => ({
                ...blk,
                formData: blk.formData
                  ? {
                      ...blk.formData,
                      submissionCount:
                        serverRes.submissionCount ?? (blk.formData.submissionCount || 0) + 1
                    }
                  : blk.formData
              })
            );
            await db.notes.update(activeNote.id, {
              blocks: nextSourceBlocks,
              updatedAt: Date.now()
            });
          }
        }

        return { ok: true };
      }
    }

    if (payload.responseAccess === 'closed') {
      return { ok: false, error: 'Formulir ini sedang ditutup oleh pemiliknya.' };
    }
    const targetNote = await db.notes.get(payload.targetNoteId);
    if (!targetNote) {
      return { ok: false, error: 'Catatan tabel database tujuan tidak ditemukan.' };
    }
    const targetPerm = resolveNotePermission(targetNote);
    if (
      payload.responseAccess === 'edit_only' &&
      targetPerm !== 'owner' &&
      targetPerm !== 'edit'
    ) {
      return {
        ok: false,
        error: 'Hanya pemilik atau kolaborator Edit yang bisa mengisi formulir ini.'
      };
    }

    const formBlock = findBlockById(activeNote.blocks, payload.formBlockId);
    const dbBlock = findBlockById(targetNote.blocks, payload.targetBlockId);
    if (!formBlock?.formData || !dbBlock?.databaseData) {
      return { ok: false, error: 'Formulir atau Tabel Database tidak ditemukan.' };
    }

    const sanitized = sanitizeFormSubmission(
      formBlock.formData,
      dbBlock.databaseData.columns,
      payload.values
    );
    if (!sanitized.ok || !sanitized.row) {
      return {
        ok: false,
        error: Object.values(sanitized.errors)[0] || 'Data formulir tidak valid.'
      };
    }

    const now = Date.now();
    const nextCount = (formBlock.formData.submissionCount || 0) + 1;
    let nextTargetBlocks = mapBlockDeep(targetNote.blocks, payload.targetBlockId, (blk) => ({
      ...blk,
      databaseData: blk.databaseData
        ? {
            ...blk.databaseData,
            rows: [...(blk.databaseData.rows || []), sanitized.row!]
          }
        : blk.databaseData
    }));

    if (payload.targetNoteId === activeNote.id) {
      nextTargetBlocks = mapBlockDeep(nextTargetBlocks, payload.formBlockId, (blk) => ({
        ...blk,
        formData: blk.formData
          ? { ...blk.formData, submissionCount: nextCount }
          : blk.formData
      }));
      await db.notes.update(payload.targetNoteId, {
        blocks: nextTargetBlocks,
        updatedAt: now
      });
    } else {
      await db.notes.update(payload.targetNoteId, {
        blocks: nextTargetBlocks,
        updatedAt: now
      });
      const freshSource = await db.notes.get(activeNote.id);
      if (freshSource) {
        const nextSourceBlocks = mapBlockDeep(freshSource.blocks, payload.formBlockId, (blk) => ({
          ...blk,
          formData: blk.formData
            ? { ...blk.formData, submissionCount: nextCount }
            : blk.formData
        }));
        await db.notes.update(activeNote.id, {
          blocks: nextSourceBlocks,
          updatedAt: now
        });
      }
    }

    return { ok: true };
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

  // Upload audio file to Cloud Catatan for a Voice Note block
  const handleUploadAudioForBlock = async (blockId: string, file: File) => {
    if (!activeNote || !canEdit) return;
    const targetNoteId = activeNote.id;
    setUploadingBlockId(blockId);
    try {
      const { url } = await uploadMediaToCloud(file);
      await patchBlockByIdInDb(targetNoteId, blockId, {
        type: 'voice',
        content: url,
        caption: file.name.replace(/\.[^/.]+$/, '') || 'Voice Note',
        voiceData: {
          audioUrl: url,
          language: 'id-ID',
          transcript: '',
          createdAt: Date.now()
        }
      });
    } catch (err) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : 'Gagal mengunggah audio.';
      try {
        await patchBlockByIdInDb(targetNoteId, blockId, {
          type: 'voice',
          caption: msg,
          voiceData: {
            audioUrl: '',
            language: 'id-ID',
            transcript: '',
            createdAt: Date.now()
          }
        });
      } catch {
        // ignore secondary persistence error
      }
    } finally {
      setUploadingBlockId(null);
    }
  };

  // Upload PDF file to Cloudinary & extract text for AI reading
  const handleUploadPdfForBlock = async (blockId: string, file: File) => {
    if (!activeNote || !canEdit) return;
    const targetNoteId = activeNote.id;
    setUploadingBlockId(blockId);
    setPdfProgressByBlockId((prev) => ({ ...prev, [blockId]: 'Membaca file PDF...' }));
    try {
      const { url, fileName, text, pages } = await processAndUploadPdf(file, (msg) =>
        setPdfProgressByBlockId((prev) => ({ ...prev, [blockId]: msg }))
      );
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
      setPdfProgressByBlockId((prev) => {
        const next = { ...prev };
        delete next[blockId];
        return next;
      });
    }
  };

  // Re-extract PDF text from stored URL/DataURL (also used for legacy blocks uploaded with old extractor)
  const handleReExtractPdfBlock = async (
    block: NoteBlockBase
  ): Promise<{ text: string; pages: number } | null> => {
    if (!activeNote || !block.content) return null;
    const targetNoteId = activeNote.id;
    const docName = block.fileName || block.caption || 'Dokumen.pdf';
    setReExtractingBlockId(block.id);
    setPdfProgressByBlockId((prev) => ({
      ...prev,
      [block.id]: 'Mengekstrak ulang teks PDF...'
    }));
    try {
      const { text, pages } = await extractTextFromPdfSource(
        block.content,
        docName,
        (msg) => setPdfProgressByBlockId((prev) => ({ ...prev, [block.id]: msg }))
      );
      if (canEdit) {
        await patchBlockByIdInDb(targetNoteId, block.id, {
          pdfText: text,
          pdfPages: pages
        });
      }
      return { text, pages };
    } catch {
      return null;
    } finally {
      setReExtractingBlockId(null);
      setPdfProgressByBlockId((prev) => {
        const next = { ...prev };
        delete next[block.id];
        return next;
      });
    }
  };

  const handleAskAiForPdfBlock = async (block: NoteBlockBase) => {
    const fileName = block.fileName || block.caption || 'Dokumen.pdf';
    const currentText = (block.pdfText || '').trim();
    const isFallbackOrEmpty =
      !currentText ||
      currentText.startsWith('Dokumen PDF "') ||
      currentText.startsWith('Tidak ada teks');

    if (isFallbackOrEmpty && block.content) {
      const fresh = await handleReExtractPdfBlock(block);
      triggerInlineAIExplain('', undefined, {
        fileName,
        text: fresh?.text || block.pdfText || '',
        pages: fresh?.pages || block.pdfPages || 1,
        url: block.content
      });
      return;
    }

    triggerInlineAIExplain('', undefined, {
      fileName,
      text: block.pdfText || '',
      pages: block.pdfPages || 1,
      url: block.content
    });
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
    const freshNote = (await db.notes.get(activeNote.id)) || activeNote;
    const currentBlk = findBlockById(freshNote.blocks, id);
    const isPlainTextBlock = !currentBlk || currentBlk.type === 'text';

    if (typeof patch.content === 'string') {
      const val = patch.content;

      if (isPlainTextBlock && val === '```mermaid ') {
        const next = mapBlockDeep(freshNote.blocks, id, (b) => ({
          ...b,
          type: 'mermaid' as BlockType,
          caption: b.caption || 'Diagram Mermaid',
          content: DEFAULT_MERMAID_CODE
        }));
        setSlashState(null);
        await updateNoteBlocks(next, { structural: true });
        return;
      }

      if (isPlainTextBlock) {
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
          { prefix: '" ', type: 'quote' },
          { prefix: '>> ', type: 'toggle', extra: { toggleOpen: true, toggleBody: '' } },
          { prefix: '! ', type: 'callout', extra: { calloutIcon: '💡' } },
          { prefix: '``` ', type: 'code', extra: { language: 'javascript' } },
          { prefix: '$$ ', type: 'math' }
        ];

        for (const trig of mdTriggers) {
          if (val.startsWith(trig.prefix)) {
            const stripped = val.slice(trig.prefix.length);
            const next = mapBlockDeep(freshNote.blocks, id, (b) => ({
              ...b,
              type: trig.type,
              content: stripped,
              ...(trig.extra || {})
            }));
            const updatedTargetBlk = findBlockById(next, id);
            setSlashState(null);
            await updateNoteBlocks(next, { structural: true });
            if (updatedTargetBlk) {
              reportBlockTarget(
                updatedTargetBlk,
                'content',
                stripped.length,
                stripped.length,
                'focus'
              );
            }
            setPendingFocusBlockId(id);
            return;
          }
        }

        if (val === '---') {
          const newTextId = createBlockId();
          const newTextBlk: NoteBlock = { id: newTextId, type: 'text', content: '' };
          let next = mapBlockDeep(freshNote.blocks, id, (b) => ({
            ...b,
            type: 'divider',
            content: ''
          }));
          next = insertBlocksRelativeDeep(next, id, 'after', [newTextBlk]);
          setSlashState(null);
          await updateNoteBlocks(next, { structural: true });
          reportBlockTarget(newTextBlk, 'content', 0, 0, 'focus');
          setPendingFocusBlockId(newTextId);
          return;
        }
      }

      if (isPlainTextBlock && val.startsWith('/') && !val.includes(' ')) {
        setSlashState({
          blockId: id,
          query: val.slice(1),
          selectedIndex: 0
        });
      } else if (slashState?.blockId === id) {
        setSlashState(null);
      }
    }

    const next = mapBlockDeep(freshNote.blocks, id, (b) => ({ ...b, ...patch }));
    await updateNoteBlocks(next, {
      structural: patch.type !== undefined
    });
  };

  const applySlashCommand = async (
    blockId: string,
    type: BlockType,
    preset?: SlashPreset
  ) => {
    if (!activeNote || !canEdit) return;
    setSlashState(null);
    const freshNote = (await db.notes.get(activeNote.id)) || activeNote;
    const loc = findBlockLocation(freshNote.blocks, blockId);

    if (type === 'columns' && loc?.container === 'column') {
      return;
    }

    if (type === 'subpage') {
      const newSubId = await handleCreateNote(freshNote.id, false);
      if (newSubId) {
        const next = mapBlockDeep(freshNote.blocks, blockId, (b) => ({
          ...b,
          type: 'subpage' as BlockType,
          subpageId: newSubId,
          subpageIcon: '📑',
          content: ''
        }));
        await updateNoteBlocks(next);
        setActiveNoteId(newSubId);
      }
      return;
    }

    if (type === 'divider') {
      const nextTextId = createBlockId();
      const nextTextBlk: NoteBlock = { id: nextTextId, type: 'text', content: '' };
      let next = mapBlockDeep(freshNote.blocks, blockId, (b) => ({
        ...b,
        type: 'divider',
        content: ''
      }));
      next = insertBlocksRelativeDeep(next, blockId, 'after', [nextTextBlk]);
      await updateNoteBlocks(next);
      reportBlockTarget(nextTextBlk, 'content', 0, 0, 'focus');
      setPendingFocusBlockId(nextTextId);
      return;
    }

    const prioritizedNotes = [
      freshNote,
      ...allNotes.filter((n) => n.id !== freshNote.id)
    ];
    const dbSources = findAllDatabaseSources(prioritizedNotes);

    let firstColFocusId: string | null = null;
    const next = mapBlockDeep(freshNote.blocks, blockId, (b) => {
      const cleanContent = b.content.startsWith('/') ? '' : b.content;

      if (type === 'columns') {
        const count = preset?.columnCount || 2;
        const cols = createColumnsBlockData(count);
        firstColFocusId = cols[0]?.blocks[0]?.id || null;
        return {
          ...b,
          type: 'columns',
          content: `${count} Kolom`,
          columns: cols
        };
      }

      if (type === 'table') {
        const tableData = b.tableData || createDefaultSimpleTableData();
        return {
          ...b,
          type: 'table',
          content:
            (tableData.rows[0] || []).filter(Boolean).slice(0, 4).join(' | ') ||
            'Tabel Sederhana',
          tableData
        };
      }

      if (type === 'mermaid') {
        return {
          ...b,
          type: 'mermaid',
          caption: b.caption || 'Diagram Mermaid',
          content: cleanContent.trim() || DEFAULT_MERMAID_CODE
        };
      }

      if (type === 'voice') {
        return {
          ...b,
          type: 'voice',
          caption: b.caption || cleanContent.trim() || '',
          content: b.voiceData?.audioUrl || '',
          voiceData: b.voiceData || {
            audioUrl: '',
            language: 'id-ID',
            transcript: ''
          }
        };
      }

      if (type === 'database') {
        const dbData = b.databaseData || createDefaultDatabaseData('blank');
        return {
          ...b,
          type: 'database',
          content: dbData.title,
          databaseData: dbData
        };
      }

      if (type === 'chart') {
        const chartData =
          b.chartData || createDefaultChartData(dbSources, preset?.chartKind || 'bar');
        return {
          ...b,
          type: 'chart',
          content: chartData.title,
          chartData
        };
      }

      if (type === 'form') {
        const formData = b.formData || createDefaultFormData(dbSources);
        return {
          ...b,
          type: 'form',
          content: formData.title,
          formData
        };
      }

      if (type === 'metric') {
        const metricData = b.metricData || createDefaultMetricData(dbSources);
        return {
          ...b,
          type: 'metric',
          content: metricData.title,
          metricData
        };
      }

      if (type === 'link') {
        const parsedExisting = cleanContent ? parseLinkUrl(cleanContent) : null;
        if (parsedExisting?.isValid) {
          setLinkDrafts((prev) => ({
            ...prev,
            [blockId]: { url: parsedExisting.url, caption: b.caption || '' }
          }));
          return {
            ...b,
            type: 'link' as BlockType,
            content: parsedExisting.url
          };
        }

        const initialCaption = b.caption || cleanContent.trim();
        setLinkDrafts((prev) => ({
          ...prev,
          [blockId]: { url: '', caption: initialCaption }
        }));
        return {
          ...b,
          type: 'link' as BlockType,
          content: '',
          ...(initialCaption ? { caption: initialCaption } : {})
        };
      }

      return {
        ...b,
        type,
        content: type === 'image' || type === 'pdf' || type === 'video' ? '' : cleanContent,
        ...(type === 'todo' ? { checked: Boolean(b.checked) } : {}),
        ...(type === 'deadline'
          ? {
              checked: Boolean(b.checked),
              dueDate: b.dueDate || formatLocalYYYYMMDD(new Date())
            }
          : {}),
        ...(type === 'callout' ? { calloutIcon: b.calloutIcon || '💡' } : {}),
        ...(type === 'code' ? { language: b.language || 'javascript' } : {}),
        ...(type === 'toggle' ? { toggleOpen: true, toggleBody: b.toggleBody || '' } : {})
      };
    });

    await updateNoteBlocks(next);
    if (type === 'columns' && firstColFocusId) {
      const colFocusBlk = findBlockById(next, firstColFocusId);
      if (colFocusBlk) reportBlockTarget(colFocusBlk, 'content', 0, 0, 'focus');
      setPendingFocusBlockId(firstColFocusId);
    } else if (type === 'video') {
      const updatedBlock = findBlockById(next, blockId);
      if (updatedBlock) reportBlockTarget(updatedBlock, 'content', 0, 0, 'focus');
      setEditingVideoId(blockId);
    } else if (type === 'link') {
      const updatedBlock = findBlockById(next, blockId);
      if (updatedBlock) {
        reportBlockTarget(
          updatedBlock,
          'content',
          updatedBlock.content.length,
          updatedBlock.content.length,
          'focus'
        );
      }
      if (!updatedBlock?.content) {
        setEditingLinkId(blockId);
      }
    } else if (
      type !== 'image' &&
      type !== 'pdf' &&
      type !== 'database' &&
      type !== 'chart' &&
      type !== 'form' &&
      type !== 'metric' &&
      type !== 'table' &&
      type !== 'mermaid' &&
      type !== 'voice'
    ) {
      const updatedBlock = findBlockById(next, blockId);
      if (updatedBlock) {
        reportBlockTarget(
          updatedBlock,
          'content',
          updatedBlock.content.length,
          updatedBlock.content.length,
          'focus'
        );
      }
      setPendingFocusBlockId(blockId);
    } else {
      const updatedBlock = findBlockById(next, blockId);
      if (updatedBlock) reportBlockTarget(updatedBlock, 'content', 0, 0, 'focus');
    }
  };

  const handleAddBlockAfter = async (afterId?: string, type: BlockType = 'text') => {
    if (!activeNote || !canEdit) return;
    const freshNote = (await db.notes.get(activeNote.id)) || activeNote;
    const newId = createBlockId();
    const newBlock: NoteBlock = {
      id: newId,
      type,
      content: type === 'mermaid' ? DEFAULT_MERMAID_CODE : type === 'table' ? 'Tabel Sederhana' : '',
      ...(type === 'todo' ? { checked: false } : {}),
      ...(type === 'deadline'
        ? { checked: false, dueDate: formatLocalYYYYMMDD(new Date()) }
        : {}),
      ...(type === 'callout' ? { calloutIcon: '💡' } : {}),
      ...(type === 'code' ? { language: 'javascript' } : {}),
      ...(type === 'toggle' ? { toggleOpen: true, toggleBody: '' } : {}),
      ...(type === 'table' ? { tableData: createDefaultSimpleTableData() } : {}),
      ...(type === 'mermaid' ? { caption: 'Diagram Mermaid' } : {}),
      ...(type === 'voice'
        ? {
            voiceData: {
              audioUrl: '',
              language: 'id-ID',
              transcript: ''
            }
          }
        : {})
    };
    const nextBlocks = afterId
      ? insertBlocksRelativeDeep(freshNote.blocks, afterId, 'after', [newBlock])
      : [...freshNote.blocks, newBlock];
    await updateNoteBlocks(nextBlocks);
    reportBlockTarget(newBlock, 'content', 0, 0, 'focus');
    if (type === 'link') {
      setEditingLinkId(newId);
    } else if (type === 'video') {
      setEditingVideoId(newId);
    } else if (
      type !== 'table' &&
      type !== 'mermaid' &&
      type !== 'voice' &&
      type !== 'database' &&
      type !== 'chart' &&
      type !== 'form' &&
      type !== 'metric'
    ) {
      setPendingFocusBlockId(newId);
    }
  };

  const handleAddBlockToColumn = async (columnsBlockId: string, columnId: string) => {
    if (!activeNote || !canEdit) return;
    const freshNote = (await db.notes.get(activeNote.id)) || activeNote;
    const newId = createBlockId();
    const newColBlock: NoteBlockBase = {
      id: newId,
      type: 'text',
      content: ''
    };
    const nextBlocks = appendBlockToColumn(
      freshNote.blocks,
      columnsBlockId,
      columnId,
      newColBlock
    );
    await updateNoteBlocks(nextBlocks);
    reportBlockTarget(newColBlock, 'content', 0, 0, 'focus');
    setPendingFocusBlockId(newId);
  };

  const handleResizeColumns = async (columnsBlockId: string, count: 2 | 3 | 4 | 5) => {
    if (!activeNote || !canEdit) return;
    const freshNote = (await db.notes.get(activeNote.id)) || activeNote;
    const nextBlocks = mapBlockDeep(freshNote.blocks, columnsBlockId, (blk) => ({
      ...resizeColumnsBlock(blk, count),
      content: `${count} Kolom`
    }));
    await updateNoteBlocks(nextBlocks);
  };

  const handleUngroupColumns = async (columnsBlockId: string) => {
    if (!activeNote || !canEdit) return;
    const freshNote = (await db.notes.get(activeNote.id)) || activeNote;
    const nextBlocks = ungroupColumnsBlock(freshNote.blocks, columnsBlockId);
    await updateNoteBlocks(nextBlocks);
  };

  const handleDuplicateBlock = async (block: NoteBlock) => {
    if (!activeNote || !canEdit) return;
    const freshNote = (await db.notes.get(activeNote.id)) || activeNote;
    const cloned = cloneBlockDeep(block);
    const nextBlocks = insertBlocksRelativeDeep(
      freshNote.blocks,
      block.id,
      'after',
      [cloned]
    );
    setMenuBlockId(null);
    await updateNoteBlocks(nextBlocks);
    reportBlockTarget(
      cloned,
      'content',
      cloned.content.length,
      cloned.content.length,
      'focus'
    );
    setPendingFocusBlockId(cloned.id);
  };

  const handleDeleteBlock = async (id: string) => {
    if (!activeNote || !canEdit) return;
    const freshNote = (await db.notes.get(activeNote.id)) || activeNote;
    setMenuBlockId(null);
    const { blocks: nextBlocks, prevFocusId } = removeBlockDeep(freshNote.blocks, id);
    await updateNoteBlocks(nextBlocks);
    if (prevFocusId) {
      const prevBlk = findBlockById(nextBlocks, prevFocusId);
      if (prevBlk) {
        reportBlockTarget(
          prevBlk,
          'content',
          prevBlk.content.length,
          prevBlk.content.length,
          'focus'
        );
      }
      setPendingFocusBlockId(prevFocusId);
    } else if (activeBlockTargetRef.current?.blockId === id) {
      setActiveBlockTarget(null);
    }
  };

  const toggleSelectBlock = (blockId: string, shiftKey = false) => {
    if (!activeNote || !canEdit) return;
    if (shiftKey && lastSelectedBlockId && lastSelectedBlockId !== blockId) {
      const startIdx = activeNote.blocks.findIndex((b) => b.id === lastSelectedBlockId);
      const endIdx = activeNote.blocks.findIndex((b) => b.id === blockId);
      if (startIdx !== -1 && endIdx !== -1) {
        const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
        const rangeIds = activeNote.blocks.slice(from, to + 1).map((b) => b.id);
        const nextIds = Array.from(new Set([...selectedBlockIds, ...rangeIds]));
        setSelectedBlockIds(nextIds);
        setLastSelectedBlockId(blockId);
        const targetBlk = activeNote.blocks[endIdx];
        if (targetBlk) {
          reportBlockTarget(
            targetBlk,
            'content',
            targetBlk.content.length,
            targetBlk.content.length,
            'selection'
          );
        }
        return;
      }
    }

    const isRemoving = selectedBlockIds.includes(blockId);
    const nextIds = isRemoving
      ? selectedBlockIds.filter((id) => id !== blockId)
      : [...selectedBlockIds, blockId];
    setSelectedBlockIds(nextIds);
    setLastSelectedBlockId(blockId);

    if (!isRemoving) {
      const targetBlk = findBlockById(activeNote.blocks, blockId);
      if (targetBlk) {
        reportBlockTarget(
          targetBlk,
          'content',
          targetBlk.content.length,
          targetBlk.content.length,
          'selection'
        );
      }
    } else if (nextIds.length > 0) {
      const fallbackBlk = findBlockById(activeNote.blocks, nextIds[nextIds.length - 1]);
      if (fallbackBlk) {
        reportBlockTarget(
          fallbackBlk,
          'content',
          fallbackBlk.content.length,
          fallbackBlk.content.length,
          'selection'
        );
      }
    } else if (
      activeBlockTargetRef.current?.blockId === blockId &&
      activeBlockTargetRef.current?.source === 'selection'
    ) {
      setActiveBlockTarget(null);
    }
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
    const targetBlk = activeNote.blocks[startIdx];
    if (targetBlk) {
      reportBlockTarget(
        targetBlk,
        'content',
        targetBlk.content.length,
        targetBlk.content.length,
        'selection'
      );
    }
  };

  const handleSelectAllBlocks = () => {
    if (!activeNote || !canEdit) return;
    if (selectedBlockIds.length === activeNote.blocks.length) {
      setSelectedBlockIds([]);
      if (activeBlockTargetRef.current?.source === 'selection') {
        setActiveBlockTarget(null);
      }
    } else {
      const allIds = activeNote.blocks.map((b) => b.id);
      setSelectedBlockIds(allIds);
      const lastBlk = activeNote.blocks[activeNote.blocks.length - 1];
      if (lastBlk) {
        reportBlockTarget(
          lastBlk,
          'content',
          lastBlk.content.length,
          lastBlk.content.length,
          'selection'
        );
      }
    }
  };

  const handleDeleteSelectedBlocks = async () => {
    if (!activeNote || !canEdit || selectedBlockIds.length === 0) return;
    const selectedSet = new Set(selectedBlockIds);
    const remaining = activeNote.blocks.filter((b) => !selectedSet.has(b.id));
    const nextBlocks: NoteBlock[] =
      remaining.length > 0
        ? remaining
        : [{ id: createBlockId(), type: 'text', content: '' }];
    await updateNoteBlocks(nextBlocks);
    if (
      activeBlockTargetRef.current &&
      selectedSet.has(activeBlockTargetRef.current.blockId)
    ) {
      setActiveBlockTarget(null);
    }
    setSelectedBlockIds([]);
    setLastSelectedBlockId(null);
    setIsSelectMode(false);
  };

  const handleDuplicateSelectedBlocks = async () => {
    if (!activeNote || !canEdit || selectedBlockIds.length === 0) return;
    const freshNote = (await db.notes.get(activeNote.id)) || activeNote;
    const selectedSet = new Set(selectedBlockIds);
    const nextBlocks: NoteBlock[] = [];
    let duplicatedCount = 0;
    for (const blk of freshNote.blocks) {
      nextBlocks.push(blk);
      if (selectedSet.has(blk.id)) {
        nextBlocks.push(cloneBlockDeep(blk));
        duplicatedCount++;
      }
    }
    if (duplicatedCount > 0) {
      await updateNoteBlocks(nextBlocks, { structural: true });
      showShortcutFeedback(`${duplicatedCount} blok diduplikatkan (⌘D)`);
    }
  };

  const handleMoveBlock = async (id: string, dir: -1 | 1) => {
    if (!activeNote || !canEdit) return;
    const freshNote = (await db.notes.get(activeNote.id)) || activeNote;
    setMenuBlockId(null);
    await updateNoteBlocks(moveBlockStepDeep(freshNote.blocks, id, dir), {
      structural: true
    });
  };

  const focusAdjacentEditableBlock = (currentBlockId: string, dir: -1 | 1) => {
    if (!activeNote) return;
    const editableTypes = new Set<BlockType>([
      'text',
      'h1',
      'h2',
      'h3',
      'bullet',
      'numbered',
      'todo',
      'deadline',
      'toggle',
      'quote',
      'callout',
      'code',
      'math'
    ]);
    const flat = flattenBlocks(activeNote.blocks).filter((b) =>
      editableTypes.has(b.type)
    );
    const idx = flat.findIndex((b) => b.id === currentBlockId);
    if (idx === -1) return;
    const targetIdx = idx + dir;
    if (targetIdx < 0) {
      titleInputRef.current?.focus();
      return;
    }
    const nextBlk = flat[targetIdx];
    if (!nextBlk) return;
    setEditingBlockId(nextBlk.id);
    setPendingFocusBlockId(nextBlk.id);
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
        if (chosen) void applySlashCommand(block.id, chosen.type, chosen.preset);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSlashState(null);
        return;
      }
    }

    const mod = e.metaKey || e.ctrlKey;
    const key = e.key.toLowerCase();
    const el = e.currentTarget;

    // 1. Inline Markdown Formatting Shortcuts (Cmd/Ctrl + B / I / U / E / Shift+S / Shift+H)
    if (
      canEdit &&
      mod &&
      !e.altKey &&
      block.type !== 'code' &&
      block.type !== 'math' &&
      block.type !== 'mermaid'
    ) {
      let openMarker: string | null = null;
      let closeMarker: string | null = null;

      if (!e.shiftKey && key === 'b') {
        openMarker = '**';
        closeMarker = '**';
      } else if (!e.shiftKey && key === 'i') {
        openMarker = '*';
        closeMarker = '*';
      } else if (!e.shiftKey && key === 'u') {
        openMarker = '<u>';
        closeMarker = '</u>';
      } else if (!e.shiftKey && key === 'e') {
        openMarker = '`';
        closeMarker = '`';
      } else if (e.shiftKey && key === 's') {
        openMarker = '~~';
        closeMarker = '~~';
      } else if (e.shiftKey && key === 'h') {
        openMarker = '==';
        closeMarker = '==';
      }

      if (openMarker && closeMarker) {
        e.preventDefault();
        e.stopPropagation();
        const start = typeof el.selectionStart === 'number' ? el.selectionStart : el.value.length;
        const end = typeof el.selectionEnd === 'number' ? el.selectionEnd : start;
        const formatted = applyInlineMarkdownShortcut(
          el.value,
          start,
          end,
          openMarker,
          closeMarker
        );
        void handleBlockChange(block.id, { content: formatted.nextValue });
        window.requestAnimationFrame(() => {
          const host = blockRefs.current[block.id];
          if (host && 'setSelectionRange' in host) {
            host.focus();
            host.setSelectionRange(
              formatted.nextSelectionStart,
              formatted.nextSelectionEnd
            );
          }
        });
        return;
      }
    }

    // 2. Quick Block Type Conversion (Cmd/Ctrl + Alt + 0..9)
    if (canEdit) {
      const convertType = resolveBlockConvertShortcut(e);
      if (convertType) {
        e.preventDefault();
        e.stopPropagation();
        void applySlashCommand(block.id, convertType);
        return;
      }
    }

    // 3. Reorder Block Up/Down (Cmd/Ctrl+Shift+Up/Down or Alt+Up/Down)
    if (
      canEdit &&
      (e.key === 'ArrowUp' || e.key === 'ArrowDown') &&
      ((mod && e.shiftKey && !e.altKey) || (!mod && e.altKey && !e.shiftKey))
    ) {
      e.preventDefault();
      e.stopPropagation();
      const dir: -1 | 1 = e.key === 'ArrowUp' ? -1 : 1;
      void handleMoveBlock(block.id, dir).then(() => {
        setPendingFocusBlockId(block.id);
      });
      return;
    }

    // 4. Duplicate Current Block (Cmd/Ctrl+Shift+D)
    if (canEdit && mod && e.shiftKey && !e.altKey && key === 'd') {
      e.preventDefault();
      e.stopPropagation();
      void handleDuplicateBlock(block);
      showShortcutFeedback('Blok diduplikatkan (⌘⇧D)');
      return;
    }

    // 5. Smart Cmd/Ctrl+Enter (toggle todo/deadline/toggle or exit code/callout/math block)
    if (canEdit && mod && !e.shiftKey && !e.altKey && e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (block.type === 'todo' || block.type === 'deadline') {
        void handleBlockChange(block.id, { checked: !block.checked });
      } else if (block.type === 'toggle') {
        void handleBlockChange(block.id, { toggleOpen: !block.toggleOpen });
      } else {
        void handleAddBlockAfter(block.id, 'text');
      }
      return;
    }

    // 6. Tab indentation inside code blocks
    if (canEdit && e.key === 'Tab' && !mod && !e.altKey && block.type === 'code') {
      e.preventDefault();
      const start = typeof el.selectionStart === 'number' ? el.selectionStart : el.value.length;
      const end = typeof el.selectionEnd === 'number' ? el.selectionEnd : start;
      const nextVal = `${el.value.slice(0, start)}  ${el.value.slice(end)}`;
      void handleBlockChange(block.id, { content: nextVal });
      window.requestAnimationFrame(() => {
        const host = blockRefs.current[block.id];
        if (host && 'setSelectionRange' in host) {
          host.setSelectionRange(start + 2, start + 2);
        }
      });
      return;
    }

    // 7. Smooth ArrowUp / ArrowDown navigation across blocks
    if (!mod && !e.altKey && !e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      const start = typeof el.selectionStart === 'number' ? el.selectionStart : 0;
      const end = typeof el.selectionEnd === 'number' ? el.selectionEnd : start;
      const isTextarea = el.tagName.toLowerCase() === 'textarea';
      if (e.key === 'ArrowUp') {
        const onFirstLine = !isTextarea || !el.value.slice(0, start).includes('\n');
        if (onFirstLine) {
          e.preventDefault();
          focusAdjacentEditableBlock(block.id, -1);
          return;
        }
      } else if (e.key === 'ArrowDown') {
        const onLastLine = !isTextarea || !el.value.slice(end).includes('\n');
        if (onLastLine) {
          e.preventDefault();
          focusAdjacentEditableBlock(block.id, 1);
          return;
        }
      }
    }

    // 8. Enter creates next block (except multiline code/callout/math blocks)
    if (
      e.key === 'Enter' &&
      !e.shiftKey &&
      !mod &&
      block.type !== 'code' &&
      block.type !== 'callout' &&
      block.type !== 'math'
    ) {
      e.preventDefault();
      if (
        !block.content.trim() &&
        ['bullet', 'numbered', 'todo', 'deadline', 'quote'].includes(block.type)
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

    // 9. Backspace at start of block converts non-text block back to text, or deletes empty text block
    if (e.key === 'Backspace' && !mod && !e.altKey) {
      const start = typeof el.selectionStart === 'number' ? el.selectionStart : 0;
      const end = typeof el.selectionEnd === 'number' ? el.selectionEnd : start;
      if (start === 0 && end === 0) {
        if (block.type !== 'text') {
          e.preventDefault();
          void handleBlockChange(block.id, { type: 'text' });
          return;
        }
        if (block.content === '') {
          e.preventDefault();
          void handleDeleteBlock(block.id);
        }
      }
    }
  };

  // Keep global note shortcut handler always synced with latest React state/closures
  globalShortcutHandlerRef.current = (e: KeyboardEvent) => {
    // Let SidebarNoteContextMenu handle shortcuts while its menu is open
    if (sidebarNoteMenuTarget) return;

    const mod = e.metaKey || e.ctrlKey;
    const key = e.key.toLowerCase();
    const editingInput = isEditableElement(e.target);

    // 1. Toggle Sidebar (Cmd/Ctrl + \)
    if (mod && !e.shiftKey && !e.altKey && (e.key === '\\' || e.code === 'Backslash')) {
      e.preventDefault();
      setIsSidebarOpen((v) => !v);
      return;
    }

    // 2. Close Side Peek (Cmd/Ctrl + Shift + \)
    if (mod && e.shiftKey && !e.altKey && (e.key === '\\' || e.key === '|' || e.code === 'Backslash')) {
      if (sidePeekNoteId) {
        e.preventDefault();
        setSidePeekNoteId(null);
      }
      return;
    }

    // 3. Focus Sidebar Search "Cari atau tanya" (Cmd/Ctrl + K)
    if (mod && !e.shiftKey && !e.altKey && (key === 'k' || e.code === 'KeyK')) {
      e.preventDefault();
      if (document.activeElement === sidebarSearchInputRef.current && !searchQuery) {
        setActivePopover(activePopover === 'dock' ? 'none' : 'dock');
        return;
      }
      setIsSidebarOpen(true);
      window.setTimeout(() => {
        sidebarSearchInputRef.current?.focus();
        sidebarSearchInputRef.current?.select();
      }, 20);
      return;
    }

    // 4. Toggle Miu AI Assistant Drawer (Cmd/Ctrl + J)
    if (mod && !e.shiftKey && !e.altKey && (key === 'j' || e.code === 'KeyJ')) {
      e.preventDefault();
      setIsAIDrawerOpen(!isAIDrawerOpen);
      return;
    }

    // 5. Open / Close Keyboard Shortcuts Guide Modal (Cmd/Ctrl + /)
    if (mod && !e.shiftKey && !e.altKey && (e.key === '/' || e.code === 'Slash')) {
      e.preventDefault();
      setShowShortcutsModal((v) => !v);
      return;
    }

    // 6. Toggle Bottom Metadata Footer Strip (Cmd/Ctrl + Shift + .)
    if (mod && e.shiftKey && !e.altKey && (e.code === 'Period' || e.key === '.' || e.key === '>')) {
      e.preventDefault();
      setShowMetadataFooter((prev) => {
        const next = !prev;
        try {
          window.localStorage.setItem('miu_show_metadata_footer', String(next));
        } catch {
          // ignore
        }
        showShortcutFeedback(
          next
            ? 'Bilah info bawah ditampilkan (⌘⇧.)'
            : 'Bilah info bawah disembunyikan (tekan ⌘⇧. untuk menampilkan)'
        );
        return next;
      });
      return;
    }

    // 7. Toggle Dark / Light Theme (Cmd/Ctrl + Shift + L)
    if (mod && e.shiftKey && !e.altKey && (key === 'l' || e.code === 'KeyL')) {
      e.preventDefault();
      toggleTheme();
      showShortcutFeedback(theme === 'dark' ? 'Mode Terang aktif (⌘⇧L)' : 'Mode Gelap aktif (⌘⇧L)');
      return;
    }

    // 8. Copy Active Page Link (Cmd/Ctrl + Alt + L)
    if (mod && e.altKey && !e.shiftKey && (key === 'l' || e.code === 'KeyL')) {
      if (activeNote) {
        e.preventDefault();
        void handleCopyActiveShareLink().then(() => {
          showShortcutFeedback('Tautan halaman aktif & disalin (⌘⌥L)');
        });
      }
      return;
    }

    // 9. Duplicate Selected Blocks or Active Note (Cmd/Ctrl + D)
    if (mod && !e.shiftKey && !e.altKey && (key === 'd' || e.code === 'KeyD')) {
      e.preventDefault();
      if (selectedBlockIds.length > 0 && canEdit) {
        void handleDuplicateSelectedBlocks();
      } else if (activeNote && isOwner) {
        const fakeEvent = { stopPropagation: () => {} } as React.MouseEvent;
        void handleDuplicateNote(activeNote, fakeEvent).then(() => {
          showShortcutFeedback('Halaman diduplikatkan (⌘D)');
        });
      }
      return;
    }

    // 10. Rename Active Note (Cmd/Ctrl + Shift + R)
    if (mod && e.shiftKey && !e.altKey && (key === 'r' || e.code === 'KeyR')) {
      if (activeNote && canEdit) {
        e.preventDefault();
        setMainViewMode('document');
        window.setTimeout(() => {
          titleInputRef.current?.focus();
          titleInputRef.current?.select();
        }, 30);
        showShortcutFeedback('Ganti nama halaman aktif (⌘⇧R)');
      }
      return;
    }

    // 11. Move Active Note To Another Parent (Cmd/Ctrl + Shift + P)
    if (mod && e.shiftKey && !e.altKey && (key === 'p' || e.code === 'KeyP')) {
      if (activeNote && isOwner) {
        e.preventDefault();
        setMainViewMode('document');
        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent('miu:open-page-actions', { detail: { subView: 'move' } })
          );
        }, 20);
      }
      return;
    }

    // 12. Open Active Note in New Tab (Cmd/Ctrl + Shift + Enter)
    if (mod && e.shiftKey && !e.altKey && e.key === 'Enter') {
      if (activeNote) {
        e.preventDefault();
        handleOpenNoteInNewTab(activeNote);
      }
      return;
    }

    // 13. Create New Page (Alt + N or Cmd/Ctrl + Alt + N)
    if (e.altKey && !e.shiftKey && (e.code === 'KeyN' || key === 'n')) {
      if (currentUser) {
        e.preventDefault();
        void handleCreateNote(null, true).then(() => {
          showShortcutFeedback('Halaman baru dibuat (Alt+N)');
        });
      }
      return;
    }

    // 14. Block Undo (Cmd/Ctrl + Z)
    if (mod && !e.shiftKey && !e.altKey && (key === 'z' || e.code === 'KeyZ')) {
      const hasUndo =
        Boolean(activeNote) &&
        (blockUndoStackRef.current[activeNote?.id || '']?.length || 0) > 0;
      if (hasUndo && (!editingInput || lastBlockEditStructuralRef.current)) {
        e.preventDefault();
        void handleUndoBlocks();
      }
      return;
    }

    // 15. Block Redo (Cmd/Ctrl + Shift + Z or Ctrl + Y)
    if (
      (mod && e.shiftKey && !e.altKey && (key === 'z' || e.code === 'KeyZ')) ||
      (e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && (key === 'y' || e.code === 'KeyY'))
    ) {
      const hasRedo =
        Boolean(activeNote) &&
        (blockRedoStackRef.current[activeNote?.id || '']?.length || 0) > 0;
      if (hasRedo && (!editingInput || lastBlockEditStructuralRef.current)) {
        e.preventDefault();
        void handleRedoBlocks();
      }
      return;
    }

    // 16. Delete Selected Blocks (Delete / Backspace outside editable input)
    if (
      !editingInput &&
      !mod &&
      !e.altKey &&
      (e.key === 'Delete' || e.key === 'Backspace') &&
      selectedBlockIds.length > 0 &&
      canEdit
    ) {
      e.preventDefault();
      const count = selectedBlockIds.length;
      void handleDeleteSelectedBlocks().then(() => {
        showShortcutFeedback(`${count} blok dihapus`);
      });
      return;
    }

    // 17. Select All Blocks (Cmd/Ctrl + A outside editable input)
    if (
      !editingInput &&
      mod &&
      !e.shiftKey &&
      !e.altKey &&
      (key === 'a' || e.code === 'KeyA') &&
      mainViewMode === 'document' &&
      activeNote &&
      canEdit
    ) {
      e.preventDefault();
      handleSelectAllBlocks();
      return;
    }

    // 18. Layered Escape Dismiss
    if (e.key === 'Escape') {
      if (showShortcutsModal) {
        setShowShortcutsModal(false);
        return;
      }
      if (slashState) {
        setSlashState(null);
        return;
      }
      if (selectedBlockIds.length > 0 || isSelectMode) {
        setSelectedBlockIds([]);
        setLastSelectedBlockId(null);
        setIsSelectMode(false);
        return;
      }
      if (menuBlockId) {
        setMenuBlockId(null);
        return;
      }
      if (showIconPicker || showCoverPicker || showShareModal || isInboxOpen || showUserMenu) {
        setShowIconPicker(false);
        setShowCoverPicker(false);
        setShowShareModal(false);
        setIsInboxOpen(false);
        setShowUserMenu(false);
        return;
      }
      if (sidePeekNoteId) {
        setSidePeekNoteId(null);
      }
    }
  };

  const buildActiveNoteMarkdown = (): string => {
    if (!activeNote) return '';
    const mdLines = [`# ${activeNote.title || 'Tanpa Judul'}\n`];

    const appendBlocksMd = (blocks: Array<NoteBlock | NoteBlockBase>) => {
      for (const b of blocks) {
        if (b.type === 'h1') mdLines.push(`# ${b.content}\n`);
        else if (b.type === 'h2') mdLines.push(`## ${b.content}\n`);
        else if (b.type === 'h3') mdLines.push(`### ${b.content}\n`);
        else if (b.type === 'bullet') mdLines.push(`- ${b.content}`);
        else if (b.type === 'numbered') mdLines.push(`1. ${b.content}`);
        else if (b.type === 'todo') {
          mdLines.push(`- [${b.checked ? 'x' : ' '}] ${b.content}`);
        } else if (b.type === 'deadline') {
          const dStr = b.dueDate ? ` (Deadline: ${b.dueDate}${b.dueTime ? ` ${b.dueTime}` : ''})` : '';
          mdLines.push(`- [${b.checked ? 'x' : ' '}] ${b.content}${dStr}`);
        } else if (b.type === 'toggle')
          mdLines.push(`<details><summary>${b.content}</summary>\n\n${b.toggleBody || ''}\n</details>\n`);
        else if (b.type === 'callout') mdLines.push(`> ${b.calloutIcon || '💡'} ${b.content}\n`);
        else if (b.type === 'quote') mdLines.push(`> ${b.content}\n`);
        else if (b.type === 'divider') mdLines.push(`---\n`);
        else if (b.type === 'code') mdLines.push(`\`\`\`${b.language || ''}\n${b.content}\n\`\`\`\n`);
        else if (b.type === 'math') mdLines.push(`$$\n${b.content}\n$$\n`);
        else if (b.type === 'image') mdLines.push(`![${b.caption || 'Image'}](${b.content})\n`);
        else if (b.type === 'video') mdLines.push(`[${b.caption || 'Video'}](${b.content})\n`);
        else if (b.type === 'link') {
          if (b.content) mdLines.push(`[${b.caption || b.content}](${b.content})\n`);
        } else if (b.type === 'database' && b.databaseData) {
          mdLines.push(
            `### ${b.databaseData.title}\n\n${databaseToMarkdownTable(b.databaseData, 200)}\n`
          );
        } else if (b.type === 'chart' && b.chartData) {
          mdLines.push(`**Diagram (${b.chartData.kind})**: ${b.chartData.title}\n`);
        } else if (b.type === 'form' && b.formData) {
          const fList = b.formData.fields
            .filter((f) => !f.hidden)
            .map((f) => `- ${f.label}`)
            .join('\n');
          mdLines.push(`### Formulir: ${b.formData.title}\n${fList}\n`);
        } else if (b.type === 'metric' && b.metricData) {
          mdLines.push(`**Metrik**: ${b.metricData.title}\n`);
        } else if (b.type === 'table' && b.tableData) {
          mdLines.push(`${simpleTableToMarkdown(b.tableData)}\n`);
        } else if (b.type === 'mermaid') {
          if (b.caption?.trim()) {
            mdLines.push(`**${b.caption.trim()}**`);
          }
          mdLines.push(`\`\`\`mermaid\n${b.content}\n\`\`\`\n`);
        } else if (b.type === 'voice') {
          const voiceUrl = b.voiceData?.audioUrl || b.content;
          const voiceTitle = b.caption || 'Voice Note';
          if (voiceUrl) {
            mdLines.push(`[🎙️ ${voiceTitle}](${voiceUrl})\n`);
          } else {
            mdLines.push(`**🎙️ ${voiceTitle}**\n`);
          }
          if (b.voiceData?.transcript?.trim()) {
            mdLines.push(`> **Transkrip**: ${b.voiceData.transcript.trim()}\n`);
          }
        } else if ('columns' in b && b.type === 'columns' && Array.isArray(b.columns)) {
          b.columns.forEach((col, colIdx) => {
            mdLines.push(`<!-- Kolom ${colIdx + 1} -->`);
            appendBlocksMd(col.blocks || []);
          });
        } else mdLines.push(`${b.content}\n`);
      }
    };

    appendBlocksMd(activeNote.blocks);
    return mdLines.join('\n');
  };

  const handleExportMarkdown = () => {
    if (!activeNote) return;
    const mdText = buildActiveNoteMarkdown();
    const blob = new Blob([mdText], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(activeNote.title || 'catatan').toLowerCase().replace(/\s+/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyPageContent = async () => {
    if (!activeNote) return;
    const mdText = buildActiveNoteMarkdown();
    await navigator.clipboard.writeText(mdText);
  };

  // Reorder single block or selected group via Drag & Drop (supports root & inside columns)
  const handleReorderBlocks = async (
    sourceId: string,
    targetId: string,
    position: 'before' | 'after'
  ) => {
    if (!activeNote || !canEdit || sourceId === targetId) return;
    const freshNote = (await db.notes.get(activeNote.id)) || activeNote;
    const movingIds = selectedBlockIds.includes(sourceId)
      ? selectedBlockIds
      : [sourceId];
    const nextBlocks = moveBlocksToTarget(freshNote.blocks, movingIds, {
      kind: 'block',
      blockId: targetId,
      position
    });
    await updateNoteBlocks(nextBlocks);
  };

  const handleDropIntoColumn = async (
    e: React.DragEvent<HTMLDivElement>,
    columnsBlockId: string,
    columnId: string
  ) => {
    setDropTargetColumn(null);
    setDropTargetBlock(null);
    setDraggedBlockId(null);
    if (!activeNote || !canEdit) return;
    const internalBlockId =
      e.dataTransfer.getData('application/miu-block-id') || draggedBlockId;
    if (!internalBlockId || internalBlockId === columnsBlockId) return;
    e.preventDefault();
    e.stopPropagation();

    const freshNote = (await db.notes.get(activeNote.id)) || activeNote;
    const movingIds = selectedBlockIds.includes(internalBlockId)
      ? selectedBlockIds
      : [internalBlockId];
    const nextBlocks = moveBlocksToTarget(freshNote.blocks, movingIds, {
      kind: 'column',
      columnsBlockId,
      columnId
    });
    await updateNoteBlocks(nextBlocks);
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

  // Move a note between Kanban columns in the sidebar
  const handleMoveNoteKanbanStatus = async (
    noteId: string,
    targetStatus: NoteKanbanStatus
  ) => {
    const targetNote = allNotes.find((n) => n.id === noteId);
    if (!targetNote) return;
    const perm = resolveNotePermission(targetNote);
    if (perm !== 'owner' && perm !== 'edit') return;
    if ((targetNote.kanbanStatus || 'todo') === targetStatus) return;

    const updatedAt = Date.now();
    await db.notes.update(noteId, { kanbanStatus: targetStatus, updatedAt });
    scheduleNeonSave({ ...targetNote, kanbanStatus: targetStatus, updatedAt });
  };

  const handleToggleTodoDeadlineFromCalendar = async (
    noteId: string,
    blockId: string,
    nextChecked: boolean
  ) => {
    const targetNote = allNotes.find((n) => n.id === noteId);
    if (!targetNote) return;
    const perm = resolveNotePermission(targetNote);
    if (perm !== 'owner' && perm !== 'edit') return;

    const updatedAt = Date.now();
    const nextBlocks = mapBlockDeep(targetNote.blocks, blockId, (b) => ({
      ...b,
      checked: nextChecked
    }));
    await db.notes.update(noteId, { blocks: nextBlocks, updatedAt });
    scheduleNeonSave({ ...targetNote, blocks: nextBlocks, updatedAt });
  };

  const handleSaveGoogleSyncIdFromCalendar = async ({
    noteId,
    blockId,
    googleEventId
  }: {
    noteId: string;
    blockId?: string;
    googleEventId: string;
  }) => {
    const targetNote = await db.notes.get(noteId);
    if (!targetNote) return;
    const updatedAt = Date.now();

    if (blockId) {
      const nextBlocks = mapBlockDeep(targetNote.blocks, blockId, (b) => ({
        ...b,
        googleEventId
      }));
      await db.notes.update(noteId, { blocks: nextBlocks, updatedAt });
      scheduleNeonSave({ ...targetNote, blocks: nextBlocks, updatedAt });
    } else {
      await db.notes.update(noteId, { googleEventId, updatedAt });
      scheduleNeonSave({ ...targetNote, googleEventId, updatedAt });
    }
  };

  const computeNoteDropPosition = (
    e: React.DragEvent<HTMLElement>,
    allowInside = true
  ): 'before' | 'inside' | 'after' => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const ratio = rect.height > 0 ? relY / rect.height : 0.5;
    if (!allowInside) {
      return ratio < 0.5 ? 'before' : 'after';
    }
    if (ratio < 0.28) return 'before';
    if (ratio > 0.72) return 'after';
    return 'inside';
  };

  const handleSidebarNoteDrop = async (
    sourceId: string,
    targetNote: NoteRecord,
    position: 'before' | 'inside' | 'after',
    extraPatch?: Partial<NoteRecord>
  ) => {
    if (!sourceId || sourceId === targetNote.id) return;
    const sourceNote = allNotes.find((n) => n.id === sourceId);
    if (!sourceNote) return;

    if (position === 'inside') {
      if (extraPatch && Object.keys(extraPatch).length > 0) {
        await handleUpdateSpecificNote(sourceId, extraPatch);
      }
      await handleMoveNoteParent(sourceId, targetNote.id);
      return;
    }

    // Reordering 'before' or 'after' targetNote at the same parentId level
    const nextParentId = targetNote.parentId ?? null;
    if (nextParentId) {
      let ancestorId: string | null | undefined = nextParentId;
      const visited = new Set<string>();
      while (ancestorId && !visited.has(ancestorId)) {
        if (ancestorId === sourceId) return;
        visited.add(ancestorId);
        ancestorId = allNotes.find((n) => n.id === ancestorId)?.parentId;
      }
    }

    const siblings = allNotes
      .filter(
        (n) =>
          (n.parentId ?? null) === nextParentId &&
          n.id !== sourceId
      )
      .sort((a, b) => (a.sortOrder ?? a.createdAt) - (b.sortOrder ?? b.createdAt));

    const targetIndex = siblings.findIndex((n) => n.id === targetNote.id);
    const insertIndex =
      targetIndex === -1
        ? siblings.length
        : position === 'before'
          ? targetIndex
          : targetIndex + 1;

    const reordered = [...siblings];
    reordered.splice(insertIndex, 0, sourceNote);

    const baseOrder = 1000000;
    const now = Date.now();
    for (let i = 0; i < reordered.length; i++) {
      const item = reordered[i];
      const nextOrder = baseOrder + i * 1000;
      const isMovedItem = item.id === sourceId;
      if (
        isMovedItem ||
        item.sortOrder !== nextOrder
      ) {
        const patch: Partial<NoteRecord> = {
          sortOrder: nextOrder,
          ...(isMovedItem
            ? {
                parentId: nextParentId,
                updatedAt: now,
                ...(extraPatch || {})
              }
            : {})
        };
        await db.notes.update(item.id, patch);
        scheduleNeonSave({ ...item, ...patch });
      }
    }
  };

  const scheduledDeadlineCount = useMemo(() => {
    let count = 0;
    for (const n of [...myNotes, ...sharedWithMeNotes]) {
      if (n.dueDate) count += 1;
      for (const b of flattenBlocks(n.blocks)) {
        if (b.dueDate) count += 1;
      }
    }
    return count;
  }, [myNotes, sharedWithMeNotes]);

  // Insert one or more blocks at a specific drop position (or at end of active note)
  const insertBlocksAtDropPoint = async (
    newBlocks: NoteBlock[],
    targetBlockId?: string,
    position: 'before' | 'after' = 'after'
  ) => {
    if (!activeNote || newBlocks.length === 0) return;
    const freshNote = (await db.notes.get(activeNote.id)) || activeNote;
    if (targetBlockId) {
      const nextBlocks = insertBlocksRelativeDeep(
        freshNote.blocks,
        targetBlockId,
        position,
        newBlocks
      );
      await updateNoteBlocks(nextBlocks);
      return;
    }
    const copy = [...freshNote.blocks];
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
    setDropTargetColumn(null);

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
          file.type.startsWith('audio/') ||
          /\.(mp3|wav|m4a|webm|ogg|aac)$/i.test(file.name)
        ) {
          const tempId = `blk-voice-${stamp}`;
          await insertBlocksAtDropPoint(
            [
              {
                id: tempId,
                type: 'voice',
                content: '',
                caption: file.name.replace(/\.[^/.]+$/, '') || 'Voice Note',
                voiceData: {
                  audioUrl: '',
                  language: 'id-ID',
                  transcript: ''
                }
              }
            ],
            targetBlockId,
            position
          );
          await handleUploadAudioForBlock(tempId, file);
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

    // 4. Plain Text or External URL Dropped from External Window / Browser
    const uriList = e.dataTransfer.getData('text/uri-list');
    const firstUri = uriList
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith('#'));
    const plainText = e.dataTransfer.getData('text/plain');
    const trimmedPlain = plainText.trim();
    const singleHttpCandidate =
      firstUri ||
      (/^https?:\/\/[^\s]+$/i.test(trimmedPlain) && !trimmedPlain.includes('\n')
        ? trimmedPlain
        : '');

    if (singleHttpCandidate && !e.dataTransfer.types.includes('application/miu-note-id')) {
      const parsedLink = parseLinkUrl(singleHttpCandidate);
      if (parsedLink.isValid) {
        e.preventDefault();
        e.stopPropagation();
        await insertBlocksAtDropPoint(
          [{ id: `blk-link-${Date.now()}`, type: 'link', content: parsedLink.url }],
          targetBlockId,
          position
        );
        return;
      }
    }

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
        <div key={note.id} className="space-y-0.5 relative">
          {isPageDropTarget && dropTargetPosition === 'before' && (
            <div className="h-[2px] bg-[#2383E2] rounded-full mx-1.5 pointer-events-none" />
          )}
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
              const pos = computeNoteDropPosition(e, true);
              setDropTargetNoteId(note.id);
              setDropTargetPosition(pos);
            }}
            onDragLeave={() => {
              if (dropTargetNoteId === note.id) setDropTargetNoteId(null);
            }}
            onDrop={(e) => {
              const sourceId = e.dataTransfer.getData('application/miu-note-id') || draggedNoteId;
              const pos = computeNoteDropPosition(e, true);
              setDraggedNoteId(null);
              setDropTargetNoteId(null);
              if (!sourceId || sourceId === note.id || isSharedSection || !isNoteOwner) return;
              e.preventDefault();
              e.stopPropagation();
              void handleSidebarNoteDrop(sourceId, note, pos);
            }}
            onClick={(e) => {
              if (e.altKey) {
                setSidePeekNoteId(note.id);
              } else {
                openDocumentNote(note.id);
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSidebarNoteMenuTarget({
                note,
                x: e.clientX,
                y: e.clientY
              });
            }}
            className={`group flex items-center justify-between gap-1 pl-1.5 pr-1.5 py-1 rounded-md text-[13.5px] cursor-pointer transition ${
              isPageDropTarget && dropTargetPosition === 'inside'
                ? 'bg-[#2383E2]/15 ring-1 ring-[#2383E2] text-text-primary'
                : isSelected && mainViewMode === 'document'
                  ? 'bg-text-primary/[0.06] dark:bg-white/[0.08] font-medium text-text-primary'
                  : 'text-text-secondary hover:bg-text-primary/[0.04] dark:hover:bg-white/[0.05] hover:text-text-primary'
            } ${draggedNoteId === note.id ? 'opacity-45' : ''}`}
          >
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              {hasChildren ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCollapsedParents((prev) => ({ ...prev, [note.id]: !prev[note.id] }));
                  }}
                  className="w-4 h-4 flex items-center justify-center rounded hover:bg-text-primary/[0.08] dark:hover:bg-white/[0.1] text-text-secondary hover:text-text-primary shrink-0 transition"
                  title={isCollapsed ? 'Tampilkan subhalaman' : 'Sembunyikan subhalaman'}
                >
                  {isCollapsed ? (
                    <ChevronRight className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              ) : (
                <span className="w-4 h-4 shrink-0 flex items-center justify-center">
                  <span className="w-1 h-1 rounded-full bg-text-secondary/25 opacity-0 group-hover:opacity-100 transition" />
                </span>
              )}
              <span className="text-[15px] leading-none shrink-0">{note.icon || '📄'}</span>
              <span className="truncate">{note.title || 'Tanpa Judul'}</span>
            </div>

            <SidebarNoteActionButtons
              note={note}
              canAddSubpage={Boolean(canAddChildHere)}
              onOpenMenu={(target) => setSidebarNoteMenuTarget(target)}
              onCreateSubpage={(pId) => void handleCreateNote(pId, true)}
            />
          </div>
          {isPageDropTarget && dropTargetPosition === 'after' && (
            <div className="h-[2px] bg-[#2383E2] rounded-full mx-1.5 pointer-events-none" />
          )}

          {hasChildren && !isCollapsed && (
            <div className="ml-3.5 pl-2 border-l border-border-subtle/75 space-y-0.5 mt-0.5">
              {renderSidebarPageTree(pool, note.id, depth + 1, isSharedSection)}
            </div>
          )}
        </div>
      );
    });
  };

  const renderBlockRow = (
    block: NoteBlock,
    currentNumber: number,
    columnCtx?: { columnsBlockId: string; columnId: string }
  ): React.ReactNode => {
    const isInsideColumn = Boolean(columnCtx);
    const isSlashOpen = slashState?.blockId === block.id;
    const isBlockMenuOpen = menuBlockId === block.id;
    const isBlockSelected = !isInsideColumn && selectedBlockIds.includes(block.id);
    const isDictationHighlighted = justDictatedBlockId === block.id;
    const isLiveDictationTarget =
      (activePopover === 'lazytype' || isLazytypeActive) &&
      activeBlockTarget?.blockId === block.id;
    const isBeingDragged = draggedBlockId === block.id;
    const isDropBefore =
      dropTargetBlock?.blockId === block.id && dropTargetBlock.position === 'before';
    const isDropAfter =
      dropTargetBlock?.blockId === block.id && dropTargetBlock.position === 'after';

    const blockCollaborators = collaboratorsByBlockId[block.id] || [];
    const blockPointers = pointersByBlockId[block.id] || [];
    const primaryCollab = blockCollaborators[0];
    const isJumpHighlighted = jumpHighlightBlockId === block.id;

    return (
      <div
        key={block.id}
        data-miu-block-id={block.id}
        onMouseDownCapture={(e) => {
          if (!activeNote) return;
          const targetEl = e.target as Element | null;
          if (!targetEl || typeof targetEl.closest !== 'function') return;
          const nearestBlockEl = targetEl.closest('[data-miu-block-id]');
          if (nearestBlockEl?.getAttribute('data-miu-block-id') !== block.id) return;
          if (
            targetEl.closest('[data-miu-block-gutter]') ||
            targetEl.closest('[data-miu-block-menu]')
          ) {
            return;
          }
          if (targetEl.closest('[data-miu-block-field]')) {
            return;
          }
          if (canEdit) {
            reportBlockTarget(
              block,
              'content',
              block.content.length,
              block.content.length,
              'focus'
            );
          } else {
            reportLocalCursor({
              noteId: activeNote.id,
              blockId: block.id,
              field: 'content',
              selectionStart: 0,
              selectionEnd: 0,
              isEditing: false,
              immediate: true
            });
          }
        }}
        onMouseMove={(e) => {
          if (!activeNote || mainViewMode !== 'document') return;
          const targetEl = e.target as Element | null;
          const nearestBlockId = targetEl
            ?.closest('[data-miu-block-id]')
            ?.getAttribute('data-miu-block-id');
          if (nearestBlockId !== block.id) return;
          const rect = e.currentTarget.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) return;
          const px = normalizePointerCoordinate((e.clientX - rect.left) / rect.width);
          const py = normalizePointerCoordinate((e.clientY - rect.top) / rect.height);
          reportLocalPointer({
            noteId: activeNote.id,
            pointerBlockId: block.id,
            pointerX: px,
            pointerY: py
          });
        }}
        onDragOver={(e) => {
          if (!canEdit || draggedNoteId || draggedBlockId === block.id) return;
          e.preventDefault();
          e.stopPropagation();
          const rect = e.currentTarget.getBoundingClientRect();
          const position: 'before' | 'after' =
            e.clientY - rect.top < rect.height / 2 ? 'before' : 'after';
          setIsFileDragOverEditor(false);
          setDropTargetColumn(null);
          setDropTargetBlock((prev) =>
            prev?.blockId === block.id && prev.position === position
              ? prev
              : { blockId: block.id, position }
          );
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setDropTargetBlock((prev) => (prev?.blockId === block.id ? null : prev));
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
          if (isSelectMode && !isInsideColumn) {
            e.stopPropagation();
            toggleSelectBlock(block.id, e.shiftKey);
          }
        }}
        style={
          primaryCollab
            ? {
                boxShadow: isJumpHighlighted
                  ? `inset 4px 0 0 ${primaryCollab.color}, 0 0 0 2px ${primaryCollab.color}88`
                  : `inset 3px 0 0 ${primaryCollab.color}, 0 0 0 1px ${primaryCollab.color}36`,
                backgroundColor: `${primaryCollab.color}0D`
              }
            : isJumpHighlighted
              ? {
                  boxShadow: '0 0 0 2px rgba(56, 189, 248, 0.7)'
                }
              : undefined
        }
        className={`${hasTopIsland ? 'scroll-mt-28' : 'scroll-mt-20'} ${
          isInsideColumn
            ? 'group/colblk relative flex items-start gap-1 py-0.5 rounded-lg transition'
            : 'group relative flex items-start gap-1.5 sm:-ml-[64px] sm:pl-[64px] py-0.5 rounded-lg transition'
        } ${
          isDictationHighlighted
            ? 'bg-emerald-500/10 ring-1 ring-emerald-400/50'
            : isBlockSelected && isLiveDictationTarget
              ? 'bg-rose-500/10 ring-2 ring-violet-400/60'
              : isBlockSelected
                ? 'bg-rose-500/10 ring-1 ring-rose-400/40'
                : isLiveDictationTarget
                  ? 'bg-violet-500/[0.07] ring-1 ring-violet-400/45'
                  : isSelectMode && !isInsideColumn
                    ? 'hover:bg-subtle/60 cursor-pointer'
                    : ''
        } ${isBeingDragged ? 'opacity-40' : ''} ${
          isDropBefore ? 'border-t-2 border-accent-strong' : ''
        } ${isDropAfter ? 'border-b-2 border-accent-strong' : ''}`}
      >
        {/* Block Controls: Left Gutter on Root vs Compact Floating Pill inside Columns */}
        {canEdit &&
          (isInsideColumn ? (
            <div
              data-miu-block-gutter="true"
              className={`absolute right-1 top-0.5 z-20 flex items-center gap-0.5 rounded-md bg-surface/95 backdrop-blur-sm border border-border-subtle shadow-sm px-0.5 py-0.5 transition no-print ${
                isBlockMenuOpen
                  ? 'opacity-100'
                  : 'opacity-0 group-hover/colblk:opacity-100'
              }`}
            >
              <button
                type="button"
                onClick={() => void handleAddBlockAfter(block.id, 'text')}
                className="p-0.5 rounded hover:bg-subtle text-text-secondary hover:text-text-primary"
                title="Tambah blok di bawah"
              >
                <Plus className="w-3 h-3" />
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
                  setDropTargetColumn(null);
                }}
                onClick={() => setMenuBlockId(isBlockMenuOpen ? null : block.id)}
                className="p-0.5 rounded hover:bg-subtle text-text-secondary hover:text-text-primary cursor-grab active:cursor-grabbing"
                title="Tarik untuk pindahkan blok, atau klik untuk Menu blok"
              >
                <GripVertical className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div
              data-miu-block-gutter="true"
              className={`sm:absolute sm:left-0.5 top-1.5 flex items-center gap-0.5 transition no-print shrink-0 ${
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
                className={`w-3.5 h-3.5 mr-0.5 rounded-[4px] border flex items-center justify-center transition ${
                  isBlockSelected
                    ? 'bg-rose-500 border-rose-500 text-white'
                    : 'border-text-secondary/40 hover:border-rose-400 bg-surface'
                }`}
                title="Pilih blok ini (Shift+Klik untuk pilih rentang)"
              >
                {isBlockSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
              </button>
              <button
                type="button"
                onClick={() => void handleAddBlockAfter(block.id, 'text')}
                className="p-0.5 rounded hover:bg-subtle text-text-secondary/75 hover:text-text-primary"
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
                  setDropTargetColumn(null);
                }}
                onClick={() => setMenuBlockId(isBlockMenuOpen ? null : block.id)}
                className="p-0.5 rounded hover:bg-subtle text-text-secondary/75 hover:text-text-primary cursor-grab active:cursor-grabbing"
                title="Tarik untuk geser posisi blok, atau klik untuk Menu blok"
              >
                <GripVertical className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

        {/* Block Context Menu */}
        {isBlockMenuOpen && (
          <div
            data-miu-block-menu="true"
            className={`absolute ${
              isInsideColumn ? 'right-0 top-7' : 'left-0 sm:left-1 top-8'
            } z-40 w-56 miu-card shadow-xl p-1.5 space-y-1 text-xs no-print`}
          >
            <div className="grid grid-cols-2 gap-0.5">
              {SLASH_OPTIONS.filter((opt) =>
                [
                  'text',
                  'h1',
                  'h2',
                  'h3',
                  'todo',
                  'deadline',
                  'bullet',
                  'toggle',
                  'table',
                  'mermaid',
                  'voice',
                  'image'
                ].includes(opt.id)
              ).map(({ id: optId, type, label, Icon, preset }) => (
                <button
                  key={optId}
                  type="button"
                  onClick={() => {
                    setMenuBlockId(null);
                    void applySlashCommand(block.id, type, preset);
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
                    void handleAskAiForPdfBlock(block);
                  } else if (block.type === 'video') {
                    triggerInlineAIExplain(
                      `Video (${block.caption || 'Tautan Video'}): ${block.content}`
                    );
                  } else if (block.type === 'link') {
                    triggerInlineAIExplain(
                      `Tautan URL (${block.caption || 'Link'}): ${block.content}`
                    );
                  } else if (block.type === 'database' && block.databaseData) {
                    triggerInlineAIExplain(
                      `Analisis Tabel Database "${block.databaseData.title}":\n${databaseToMarkdownTable(block.databaseData, 50)}`
                    );
                  } else if (block.type === 'chart' && block.chartData && activeNote) {
                    const srcNote = allNotes.find(
                      (n) => n.id === block.chartData?.sourceNoteId
                    );
                    const srcBlock = findBlockById(
                      srcNote?.blocks || activeNote.blocks,
                      block.chartData.sourceBlockId
                    );
                    const agg = aggregateDatabaseForChart(
                      srcBlock?.databaseData,
                      block.chartData
                    );
                    const summary = agg.items
                      .map((i) => `${i.label}: ${i.value} (${i.percent}%)`)
                      .join(', ');
                    triggerInlineAIExplain(
                      `Analisis Diagram "${block.chartData.title}" (${block.chartData.kind}): ${summary}`
                    );
                  } else if (block.type === 'table' && block.tableData) {
                    triggerInlineAIExplain(
                      `Analisis Tabel Sederhana:\n${simpleTableToMarkdown(block.tableData)}`
                    );
                  } else if (block.type === 'mermaid') {
                    triggerInlineAIExplain(
                      `Jelaskan atau bantu perbaiki diagram Mermaid berikut:\n\`\`\`mermaid\n${block.content}\n\`\`\``
                    );
                  } else if (block.type === 'voice') {
                    const transcript = block.voiceData?.transcript?.trim();
                    triggerInlineAIExplain(
                      transcript
                        ? `Rangkum dan buat poin penting dari Voice Note "${block.caption || 'Voice Note'}":\n${transcript}`
                        : `Voice Note "${block.caption || 'Voice Note'}" (belum ada transkrip)`
                    );
                  } else if (block.type === 'columns' && block.columns) {
                    const combined = block.columns
                      .flatMap((c) => c.blocks || [])
                      .map((b) => b.content)
                      .filter(Boolean)
                      .join('\n');
                    triggerInlineAIExplain(combined);
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
              {!isInsideColumn && (
                <button
                  type="button"
                  onClick={() => selectBlocksFromHereToEnd(block.id)}
                  className="w-full flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-subtle text-text-primary"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-rose-500" />
                  <span>Pilih sampai bawah</span>
                </button>
              )}
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
          {blockCollaborators.length > 0 && (
            <BlockCollaboratorBadges
              collaborators={blockCollaborators}
              contentText={block.content}
              toggleBodyText={block.toggleBody || ''}
              compact={isInsideColumn}
            />
          )}
          {blockPointers.length > 0 && (
            <BlockCollaboratorPointers pointers={blockPointers} />
          )}

          {block.type === 'h1' && (() => {
            const isEditingH1 = canEdit && (editingBlockId === block.id || !block.content.trim());
            const h1Size = isSmallText ? 'text-[22px] leading-[1.3]' : 'text-[26px] leading-[1.3]';
            return (
              <div className="relative w-full">
                {isEditingH1 ? (
                  <input
                    ref={(el) => {
                      blockRefs.current[block.id] = el;
                      setCaretHostRef(block.id, 'content', el);
                    }}
                    value={block.content}
                    {...getEditableBlockAttrs(block, 'content')}
                    onChange={(e) =>
                      void handleBlockChange(block.id, { content: e.target.value })
                    }
                    onKeyDown={(e) => handleBlockKeyDown(e, block)}
                    placeholder="Heading 1"
                    className={`w-full bg-transparent ${h1Size} font-bold tracking-tight text-text-primary focus:outline-none pt-3 pb-1`}
                  />
                ) : (
                  <div
                    ref={(el) => setCaretHostRef(block.id, 'content', el)}
                    onClick={() => focusPreviewBlock(block)}
                    className={`w-full min-h-[2.3rem] ${h1Size} font-bold tracking-tight text-text-primary pt-3 pb-1 whitespace-pre-wrap break-words ${
                      canEdit ? 'cursor-text' : 'cursor-default'
                    }`}
                  >
                    {renderInlineMarkdown(block.content)}
                  </div>
                )}
                {blockCollaborators.length > 0 && (
                  <CollaboratorCaretOverlay
                    hostRefs={caretHostRefs}
                    hostKey={`${block.id}:content`}
                    layoutKey={isEditingH1 ? 'edit' : 'view'}
                    text={block.content}
                    field="content"
                    collaborators={blockCollaborators}
                  />
                )}
              </div>
            );
          })()}

          {block.type === 'h2' && (() => {
            const isEditingH2 = canEdit && (editingBlockId === block.id || !block.content.trim());
            const h2Size = isSmallText ? 'text-[18.5px] leading-[1.35]' : 'text-[21px] leading-[1.35]';
            return (
              <div className="relative w-full">
                {isEditingH2 ? (
                  <input
                    ref={(el) => {
                      blockRefs.current[block.id] = el;
                      setCaretHostRef(block.id, 'content', el);
                    }}
                    value={block.content}
                    {...getEditableBlockAttrs(block, 'content')}
                    onChange={(e) =>
                      void handleBlockChange(block.id, { content: e.target.value })
                    }
                    onKeyDown={(e) => handleBlockKeyDown(e, block)}
                    placeholder="Heading 2"
                    className={`w-full bg-transparent ${h2Size} font-bold tracking-tight text-text-primary focus:outline-none pt-2.5 pb-0.5`}
                  />
                ) : (
                  <div
                    ref={(el) => setCaretHostRef(block.id, 'content', el)}
                    onClick={() => focusPreviewBlock(block)}
                    className={`w-full min-h-[2rem] ${h2Size} font-bold tracking-tight text-text-primary pt-2.5 pb-0.5 whitespace-pre-wrap break-words ${
                      canEdit ? 'cursor-text' : 'cursor-default'
                    }`}
                  >
                    {renderInlineMarkdown(block.content)}
                  </div>
                )}
                {blockCollaborators.length > 0 && (
                  <CollaboratorCaretOverlay
                    hostRefs={caretHostRefs}
                    hostKey={`${block.id}:content`}
                    layoutKey={isEditingH2 ? 'edit' : 'view'}
                    text={block.content}
                    field="content"
                    collaborators={blockCollaborators}
                  />
                )}
              </div>
            );
          })()}

          {block.type === 'h3' && (() => {
            const isEditingH3 = canEdit && (editingBlockId === block.id || !block.content.trim());
            const h3Size = isSmallText ? 'text-[15.5px] leading-[1.4]' : 'text-[17.5px] leading-[1.4]';
            return (
              <div className="relative w-full">
                {isEditingH3 ? (
                  <input
                    ref={(el) => {
                      blockRefs.current[block.id] = el;
                      setCaretHostRef(block.id, 'content', el);
                    }}
                    value={block.content}
                    {...getEditableBlockAttrs(block, 'content')}
                    onChange={(e) =>
                      void handleBlockChange(block.id, { content: e.target.value })
                    }
                    onKeyDown={(e) => handleBlockKeyDown(e, block)}
                    placeholder="Heading 3"
                    className={`w-full bg-transparent ${h3Size} font-semibold text-text-primary focus:outline-none pt-1.5 pb-0.5`}
                  />
                ) : (
                  <div
                    ref={(el) => setCaretHostRef(block.id, 'content', el)}
                    onClick={() => focusPreviewBlock(block)}
                    className={`w-full min-h-[1.75rem] ${h3Size} font-semibold text-text-primary pt-1.5 pb-0.5 whitespace-pre-wrap break-words ${
                      canEdit ? 'cursor-text' : 'cursor-default'
                    }`}
                  >
                    {renderInlineMarkdown(block.content)}
                  </div>
                )}
                {blockCollaborators.length > 0 && (
                  <CollaboratorCaretOverlay
                    hostRefs={caretHostRefs}
                    hostKey={`${block.id}:content`}
                    layoutKey={isEditingH3 ? 'edit' : 'view'}
                    text={block.content}
                    field="content"
                    collaborators={blockCollaborators}
                  />
                )}
              </div>
            );
          })()}

          {block.type === 'text' && (() => {
            const isEditingText =
              canEdit &&
              (editingBlockId === block.id ||
                !block.content.trim() ||
                block.content.startsWith('/'));
            const bodySize = isSmallText
              ? 'text-[13.5px] leading-[1.6]'
              : 'text-[15px] leading-[1.65]';
            return (
              <div className="relative w-full">
                {isEditingText ? (
                  <textarea
                    ref={(el) => {
                      blockRefs.current[block.id] = el;
                      setCaretHostRef(block.id, 'content', el);
                    }}
                    rows={Math.max(
                      1,
                      Math.max(
                        block.content.split('\n').length,
                        Math.ceil(block.content.length / (isInsideColumn ? 28 : 72))
                      )
                    )}
                    value={block.content}
                    {...getEditableBlockAttrs(block, 'content')}
                    onChange={(e) =>
                      void handleBlockChange(block.id, { content: e.target.value })
                    }
                    onKeyDown={(e) => handleBlockKeyDown(e, block)}
                    placeholder="Tekan / untuk menyisipkan blok"
                    className={`w-full bg-transparent ${bodySize} text-text-primary placeholder:text-text-secondary/40 focus:outline-none resize-none py-0.5`}
                  />
                ) : (
                  <div
                    ref={(el) => setCaretHostRef(block.id, 'content', el)}
                    onClick={() => focusPreviewBlock(block)}
                    className={`w-full min-h-[1.65rem] ${bodySize} text-text-primary py-0.5 whitespace-pre-wrap break-words ${
                      canEdit ? 'cursor-text' : 'cursor-default'
                    }`}
                  >
                    {renderInlineMarkdown(block.content)}
                  </div>
                )}
                {blockCollaborators.length > 0 && (
                  <CollaboratorCaretOverlay
                    hostRefs={caretHostRefs}
                    hostKey={`${block.id}:content`}
                    layoutKey={isEditingText ? 'edit' : 'view'}
                    text={block.content}
                    field="content"
                    collaborators={blockCollaborators}
                  />
                )}
              </div>
            );
          })()}

          {block.type === 'bullet' && (() => {
            const isEditingBullet = canEdit && (editingBlockId === block.id || !block.content.trim());
            const bodySize = isSmallText
              ? 'text-[13.5px] leading-[1.58]'
              : 'text-[15px] leading-[1.62]';
            return (
              <div className="flex items-start gap-2.5 py-0.5">
                <span className="text-text-primary font-bold select-none pt-0.5">•</span>
                <div className="relative flex-1 min-w-0">
                  {isEditingBullet ? (
                    <textarea
                      ref={(el) => {
                        blockRefs.current[block.id] = el;
                        setCaretHostRef(block.id, 'content', el);
                      }}
                      rows={Math.max(
                        1,
                        Math.max(
                          block.content.split('\n').length,
                          Math.ceil(block.content.length / (isInsideColumn ? 26 : 68))
                        )
                      )}
                      value={block.content}
                      {...getEditableBlockAttrs(block, 'content')}
                      onChange={(e) =>
                        void handleBlockChange(block.id, { content: e.target.value })
                      }
                      onKeyDown={(e) => handleBlockKeyDown(e, block)}
                      placeholder="Daftar poin"
                      className={`w-full bg-transparent ${bodySize} text-text-primary focus:outline-none resize-none`}
                    />
                  ) : (
                    <div
                      ref={(el) => setCaretHostRef(block.id, 'content', el)}
                      onClick={() => focusPreviewBlock(block)}
                      className={`w-full min-h-[1.55rem] ${bodySize} text-text-primary whitespace-pre-wrap break-words ${
                        canEdit ? 'cursor-text' : 'cursor-default'
                      }`}
                    >
                      {renderInlineMarkdown(block.content)}
                    </div>
                  )}
                  {blockCollaborators.length > 0 && (
                    <CollaboratorCaretOverlay
                      hostRefs={caretHostRefs}
                      hostKey={`${block.id}:content`}
                      layoutKey={isEditingBullet ? 'edit' : 'view'}
                      text={block.content}
                      field="content"
                      collaborators={blockCollaborators}
                    />
                  )}
                </div>
              </div>
            );
          })()}

          {block.type === 'numbered' && (() => {
            const isEditingNum = canEdit && (editingBlockId === block.id || !block.content.trim());
            const bodySize = isSmallText
              ? 'text-[13.5px] leading-[1.58]'
              : 'text-[15px] leading-[1.62]';
            return (
              <div className="flex items-start gap-2 py-0.5">
                <span className="text-sm text-text-secondary select-none pt-0.5 min-w-[20px]">
                  {currentNumber}.
                </span>
                <div className="relative flex-1 min-w-0">
                  {isEditingNum ? (
                    <textarea
                      ref={(el) => {
                        blockRefs.current[block.id] = el;
                        setCaretHostRef(block.id, 'content', el);
                      }}
                      rows={Math.max(
                        1,
                        Math.max(
                          block.content.split('\n').length,
                          Math.ceil(block.content.length / (isInsideColumn ? 26 : 68))
                        )
                      )}
                      value={block.content}
                      {...getEditableBlockAttrs(block, 'content')}
                      onChange={(e) =>
                        void handleBlockChange(block.id, { content: e.target.value })
                      }
                      onKeyDown={(e) => handleBlockKeyDown(e, block)}
                      placeholder="Daftar bernomor"
                      className={`w-full bg-transparent ${bodySize} text-text-primary focus:outline-none resize-none`}
                    />
                  ) : (
                    <div
                      ref={(el) => setCaretHostRef(block.id, 'content', el)}
                      onClick={() => focusPreviewBlock(block)}
                      className={`w-full min-h-[1.55rem] ${bodySize} text-text-primary whitespace-pre-wrap break-words ${
                        canEdit ? 'cursor-text' : 'cursor-default'
                      }`}
                    >
                      {renderInlineMarkdown(block.content)}
                    </div>
                  )}
                  {blockCollaborators.length > 0 && (
                    <CollaboratorCaretOverlay
                      hostRefs={caretHostRefs}
                      hostKey={`${block.id}:content`}
                      layoutKey={isEditingNum ? 'edit' : 'view'}
                      text={block.content}
                      field="content"
                      collaborators={blockCollaborators}
                    />
                  )}
                </div>
              </div>
            );
          })()}

          {block.type === 'todo' && (() => {
            const isEditingTodo = canEdit && (editingBlockId === block.id || !block.content.trim());
            const bodySize = isSmallText
              ? 'text-[13.5px] leading-[1.58]'
              : 'text-[15px] leading-[1.62]';
            return (
              <div className="flex items-start gap-2.5 py-0.5">
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() =>
                    void handleBlockChange(block.id, { checked: !block.checked })
                  }
                  className={`mt-1 w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0 transition ${
                    block.checked
                      ? 'bg-sky-600 border-sky-600 text-white'
                      : 'border-text-secondary/50 hover:border-sky-600'
                  }`}
                >
                  {block.checked && <Check className="w-3 h-3 stroke-[3]" />}
                </button>
                <div className="relative flex-1 min-w-0">
                  {isEditingTodo ? (
                    <textarea
                      ref={(el) => {
                        blockRefs.current[block.id] = el;
                        setCaretHostRef(block.id, 'content', el);
                      }}
                      rows={Math.max(1, Math.ceil(block.content.length / (isInsideColumn ? 26 : 68)))}
                      value={block.content}
                      {...getEditableBlockAttrs(block, 'content')}
                      onChange={(e) =>
                        void handleBlockChange(block.id, { content: e.target.value })
                      }
                      onKeyDown={(e) => handleBlockKeyDown(e, block)}
                      placeholder="To-do"
                      className={`w-full bg-transparent ${bodySize} focus:outline-none resize-none ${
                        block.checked
                          ? 'line-through text-text-secondary'
                          : 'text-text-primary'
                      }`}
                    />
                  ) : (
                    <div
                      ref={(el) => setCaretHostRef(block.id, 'content', el)}
                      onClick={() => focusPreviewBlock(block)}
                      className={`w-full min-h-[1.55rem] ${bodySize} whitespace-pre-wrap break-words ${
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
                  {blockCollaborators.length > 0 && (
                    <CollaboratorCaretOverlay
                      hostRefs={caretHostRefs}
                      hostKey={`${block.id}:content`}
                      layoutKey={isEditingTodo ? 'edit' : 'view'}
                      text={block.content}
                      field="content"
                      collaborators={blockCollaborators}
                    />
                  )}
                </div>
              </div>
            );
          })()}

          {/* Slash Command Deadline Block (`/deadline` -> Auto-syncs to Calendar) */}
          {block.type === 'deadline' && (
            <div className="my-1 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-start sm:items-center gap-2.5 flex-1 min-w-0">
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() =>
                    void handleBlockChange(block.id, { checked: !block.checked })
                  }
                  className={`mt-0.5 sm:mt-0 w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0 transition ${
                    block.checked
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : 'border-amber-600/60 dark:border-amber-300/60 bg-surface'
                  }`}
                >
                  {block.checked && <Check className="w-3 h-3 stroke-[3]" />}
                </button>

                <div className="relative flex-1 min-w-0">
                  {canEdit ? (
                    <input
                      ref={(el) => {
                        blockRefs.current[block.id] = el;
                        setCaretHostRef(block.id, 'content', el);
                      }}
                      type="text"
                      value={block.content}
                      {...getEditableBlockAttrs(block, 'content')}
                      onChange={(e) =>
                        void handleBlockChange(block.id, { content: e.target.value })
                      }
                      onKeyDown={(e) => handleBlockKeyDown(e, block)}
                      placeholder="Ketik nama tugas / deadline..."
                      className={`w-full min-w-0 bg-transparent text-sm font-semibold focus:outline-none ${
                        block.checked
                          ? 'line-through text-text-secondary'
                          : 'text-text-primary'
                      }`}
                    />
                  ) : (
                    <span
                      ref={(el) => setCaretHostRef(block.id, 'content', el)}
                      className={`block w-full min-w-0 text-sm font-semibold ${
                        block.checked
                          ? 'line-through text-text-secondary'
                          : 'text-text-primary'
                      }`}
                    >
                      {block.content || 'Deadline tanpa judul'}
                    </span>
                  )}
                  {blockCollaborators.length > 0 && (
                    <CollaboratorCaretOverlay
                      hostRefs={caretHostRefs}
                      hostKey={`${block.id}:content`}
                      layoutKey={canEdit ? 'edit' : 'view'}
                      text={block.content}
                      field="content"
                      collaborators={blockCollaborators}
                    />
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 shrink-0 no-print">
                {canEdit ? (
                  <>
                    <div className="inline-flex items-center gap-1 rounded-lg bg-surface border border-border-subtle px-2 py-1">
                      <CalendarDays className="w-3.5 h-3.5 text-amber-500" />
                      <input
                        type="date"
                        value={block.dueDate || ''}
                        onChange={(e) =>
                          void handleBlockChange(block.id, {
                            dueDate: e.target.value
                          })
                        }
                        className="bg-transparent text-[11px] font-medium text-text-primary focus:outline-none"
                      />
                    </div>
                    <input
                      type="time"
                      value={block.dueTime || ''}
                      onChange={(e) =>
                        void handleBlockChange(block.id, {
                          dueTime: e.target.value
                        })
                      }
                      title="Jam deadline (opsional)"
                      className="rounded-lg bg-surface border border-border-subtle px-2 py-1 text-[11px] text-text-primary focus:outline-none"
                    />
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-surface border border-border-subtle text-[11px] font-semibold text-text-primary">
                    <CalendarDays className="w-3.5 h-3.5 text-amber-500" />
                    <span>
                      {block.dueDate || 'Tanpa Tanggal'}
                      {block.dueTime ? ` · ${block.dueTime}` : ''}
                    </span>
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => setMainViewMode('calendar')}
                  className="px-2 py-1 rounded-lg bg-surface hover:bg-subtle border border-border-subtle text-[10px] font-bold text-accent-strong transition"
                  title="Buka tampilan Kalender"
                >
                  Kalender →
                </button>
              </div>
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
                  <div className="relative flex-1 min-w-0">
                    <input
                      ref={(el) => {
                        blockRefs.current[block.id] = el;
                        setCaretHostRef(block.id, 'content', el);
                      }}
                      readOnly={!canEdit}
                      value={block.content}
                      {...getEditableBlockAttrs(block, 'content')}
                      onChange={(e) =>
                        void handleBlockChange(block.id, { content: e.target.value })
                      }
                      onKeyDown={(e) => handleBlockKeyDown(e, block)}
                      placeholder="Toggle"
                      className="w-full bg-transparent text-[15px] sm:text-base font-medium text-text-primary focus:outline-none"
                    />
                    {blockCollaborators.length > 0 && (
                      <CollaboratorCaretOverlay
                        hostRefs={caretHostRefs}
                        hostKey={`${block.id}:content`}
                        layoutKey="input"
                        text={block.content}
                        field="content"
                        collaborators={blockCollaborators}
                      />
                    )}
                  </div>
                </div>
                {isOpen && (
                  <div className="pl-6 border-l border-border-subtle ml-2">
                    <div className="relative w-full">
                      <textarea
                        ref={(el) => {
                          toggleBodyRefs.current[block.id] = el;
                          setCaretHostRef(block.id, 'toggleBody', el);
                        }}
                        readOnly={!canEdit}
                        rows={Math.max(2, (block.toggleBody || '').split('\n').length)}
                        value={block.toggleBody || ''}
                        {...getEditableBlockAttrs(block, 'toggleBody')}
                        onChange={(e) =>
                          void handleBlockChange(block.id, {
                            toggleBody: e.target.value
                          })
                        }
                        onKeyDown={(e) => {
                          const mod = e.metaKey || e.ctrlKey;
                          const key = e.key.toLowerCase();
                          if (canEdit && mod && !e.altKey) {
                            let openM: string | null = null;
                            let closeM: string | null = null;
                            if (!e.shiftKey && key === 'b') { openM = '**'; closeM = '**'; }
                            else if (!e.shiftKey && key === 'i') { openM = '*'; closeM = '*'; }
                            else if (!e.shiftKey && key === 'u') { openM = '<u>'; closeM = '</u>'; }
                            else if (!e.shiftKey && key === 'e') { openM = '`'; closeM = '`'; }
                            else if (e.shiftKey && key === 's') { openM = '~~'; closeM = '~~'; }
                            else if (e.shiftKey && key === 'h') { openM = '=='; closeM = '=='; }
                            if (openM && closeM) {
                              e.preventDefault();
                              e.stopPropagation();
                              const el = e.currentTarget;
                              const start = typeof el.selectionStart === 'number' ? el.selectionStart : el.value.length;
                              const end = typeof el.selectionEnd === 'number' ? el.selectionEnd : start;
                              const formatted = applyInlineMarkdownShortcut(el.value, start, end, openM, closeM);
                              void handleBlockChange(block.id, { toggleBody: formatted.nextValue });
                              window.requestAnimationFrame(() => {
                                const host = toggleBodyRefs.current[block.id];
                                if (host) {
                                  host.focus();
                                  host.setSelectionRange(formatted.nextSelectionStart, formatted.nextSelectionEnd);
                                }
                              });
                            }
                          }
                        }}
                        placeholder={canEdit ? 'Ketik isi di dalam toggle...' : ''}
                        className="w-full bg-transparent text-sm text-text-primary focus:outline-none resize-none"
                      />
                      {blockCollaborators.length > 0 && (
                        <CollaboratorCaretOverlay
                          hostRefs={caretHostRefs}
                          hostKey={`${block.id}:toggleBody`}
                          layoutKey="input"
                          text={block.toggleBody || ''}
                          field="toggleBody"
                          collaborators={blockCollaborators}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {block.type === 'callout' && (() => {
            const isEditingCallout = canEdit && (editingBlockId === block.id || !block.content.trim());
            return (
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
                <div className="relative flex-1 min-w-0">
                  {isEditingCallout ? (
                    <textarea
                      ref={(el) => {
                        blockRefs.current[block.id] = el;
                        setCaretHostRef(block.id, 'content', el);
                      }}
                      rows={Math.max(2, Math.ceil(block.content.length / 72))}
                      value={block.content}
                      {...getEditableBlockAttrs(block, 'content')}
                      onChange={(e) =>
                        void handleBlockChange(block.id, { content: e.target.value })
                      }
                      onKeyDown={(e) => handleBlockKeyDown(e, block)}
                      placeholder="Ketik isi callout..."
                      className="w-full bg-transparent text-sm leading-relaxed text-text-primary focus:outline-none resize-none"
                    />
                  ) : (
                    <div
                      ref={(el) => setCaretHostRef(block.id, 'content', el)}
                      onClick={() => focusPreviewBlock(block)}
                      className={`w-full min-h-[1.5rem] text-sm leading-relaxed text-text-primary whitespace-pre-wrap break-words ${
                        canEdit ? 'cursor-text' : 'cursor-default'
                      }`}
                    >
                      {renderInlineMarkdown(block.content)}
                    </div>
                  )}
                  {blockCollaborators.length > 0 && (
                    <CollaboratorCaretOverlay
                      hostRefs={caretHostRefs}
                      hostKey={`${block.id}:content`}
                      layoutKey={isEditingCallout ? 'edit' : 'view'}
                      text={block.content}
                      field="content"
                      collaborators={blockCollaborators}
                    />
                  )}
                </div>
              </div>
            );
          })()}

          {block.type === 'quote' && (() => {
            const isEditingQuote = canEdit && (editingBlockId === block.id || !block.content.trim());
            return (
              <blockquote className="border-l-[3px] border-text-primary/70 pl-4 py-1 my-1 italic text-text-primary/90">
                <div className="relative w-full">
                  {isEditingQuote ? (
                    <textarea
                      ref={(el) => {
                        blockRefs.current[block.id] = el;
                        setCaretHostRef(block.id, 'content', el);
                      }}
                      rows={Math.max(1, Math.ceil(block.content.length / 75))}
                      value={block.content}
                      {...getEditableBlockAttrs(block, 'content')}
                      onChange={(e) =>
                        void handleBlockChange(block.id, { content: e.target.value })
                      }
                      onKeyDown={(e) => handleBlockKeyDown(e, block)}
                      placeholder="Kutipan..."
                      className="w-full bg-transparent text-[15px] leading-relaxed focus:outline-none resize-none"
                    />
                  ) : (
                    <div
                      ref={(el) => setCaretHostRef(block.id, 'content', el)}
                      onClick={() => focusPreviewBlock(block)}
                      className={`w-full min-h-[1.5rem] text-[15px] leading-relaxed whitespace-pre-wrap break-words ${
                        canEdit ? 'cursor-text' : 'cursor-default'
                      }`}
                    >
                      {renderInlineMarkdown(block.content)}
                    </div>
                  )}
                  {blockCollaborators.length > 0 && (
                    <CollaboratorCaretOverlay
                      hostRefs={caretHostRefs}
                      hostKey={`${block.id}:content`}
                      layoutKey={isEditingQuote ? 'edit' : 'view'}
                      text={block.content}
                      field="content"
                      collaborators={blockCollaborators}
                    />
                  )}
                </div>
              </blockquote>
            );
          })()}

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
            <div className="rounded-xl border border-border-subtle bg-slate-950 text-slate-100 my-1.5">
              <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 rounded-t-[11px] border-b border-white/10 text-[11px] font-mono">
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
              <div className="relative w-full">
                <textarea
                  ref={(el) => {
                    blockRefs.current[block.id] = el;
                    setCaretHostRef(block.id, 'content', el);
                  }}
                  readOnly={!canEdit}
                  rows={Math.max(3, block.content.split('\n').length)}
                  value={block.content}
                  {...getEditableBlockAttrs(block, 'content')}
                  onChange={(e) =>
                    void handleBlockChange(block.id, { content: e.target.value })
                  }
                  onKeyDown={(e) => handleBlockKeyDown(e, block)}
                  placeholder="Ketik kode..."
                  className="w-full p-3 bg-transparent font-mono text-xs leading-relaxed text-slate-100 focus:outline-none resize-y rounded-b-[11px]"
                />
                {blockCollaborators.length > 0 && (
                  <CollaboratorCaretOverlay
                    hostRefs={caretHostRefs}
                    hostKey={`${block.id}:content`}
                    layoutKey="input"
                    text={block.content}
                    field="content"
                    collaborators={blockCollaborators}
                  />
                )}
              </div>
            </div>
          )}

          {block.type === 'math' && (() => {
            const isMathInputOpen = canEdit && (editingMathId === block.id || !block.content);
            return (
              <div className="bg-subtle/60 border border-border-subtle rounded-xl p-3 my-1 space-y-2">
                <div
                  ref={
                    !isMathInputOpen
                      ? (el) => setCaretHostRef(block.id, 'content', el)
                      : undefined
                  }
                  onClick={() => {
                    if (canEdit) {
                      const opening = editingMathId !== block.id;
                      setEditingMathId(opening ? block.id : null);
                      reportBlockTarget(
                        block,
                        'content',
                        block.content.length,
                        block.content.length,
                        'focus'
                      );
                      if (opening) {
                        setPendingFocusBlockId(block.id);
                      }
                    }
                  }}
                  className={`relative ${canEdit ? 'cursor-pointer' : ''} text-text-primary`}
                >
                  <MathPreview tex={block.content} />
                  {!isMathInputOpen && blockCollaborators.length > 0 && (
                    <CollaboratorCaretOverlay
                      hostRefs={caretHostRefs}
                      hostKey={`${block.id}:content`}
                      layoutKey="preview"
                      text={block.content}
                      field="content"
                      collaborators={blockCollaborators}
                    />
                  )}
                </div>
                {isMathInputOpen && (
                  <div className="relative w-full">
                    <input
                      ref={(el) => {
                        blockRefs.current[block.id] = el;
                        setCaretHostRef(block.id, 'content', el);
                      }}
                      value={block.content}
                      {...getEditableBlockAttrs(block, 'content')}
                      onChange={(e) =>
                        void handleBlockChange(block.id, { content: e.target.value })
                      }
                      onKeyDown={(e) => handleBlockKeyDown(e, block)}
                      placeholder="Rumus LaTeX (mis. E = mc^2)"
                      className="w-full bg-surface border border-border-subtle rounded-lg px-2.5 py-1.5 font-mono text-xs text-text-primary focus:outline-none"
                    />
                    {blockCollaborators.length > 0 && (
                      <CollaboratorCaretOverlay
                        hostRefs={caretHostRefs}
                        hostKey={`${block.id}:content`}
                        layoutKey="input"
                        text={block.content}
                        field="content"
                        collaborators={blockCollaborators}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })()}

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

          {/* Notion Embedded YouTube / Video URL Block */}
          {block.type === 'video' && (() => {
            const draftUrl = videoUrlDrafts[block.id] ?? block.content;
            const isEditingUrl =
              canEdit && (!block.content || editingVideoId === block.id);
            const parsedEmbed = parseVideoEmbedUrl(
              isEditingUrl ? draftUrl : block.content
            );

            return (
              <div className="my-1.5">
                {isEditingUrl ? (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (parsedEmbed.kind === 'invalid') return;
                      await handleBlockChange(block.id, {
                        content: parsedEmbed.originalUrl
                      });
                      setEditingVideoId(null);
                    }}
                    className="p-4 rounded-xl border border-dashed border-border-subtle bg-subtle/45 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-text-primary">
                        <Video className="w-4 h-4 text-rose-500" />
                        <span>Sematkan YouTube atau URL Video</span>
                      </span>
                      {draftUrl.trim() && (
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                            parsedEmbed.kind === 'invalid'
                              ? 'bg-rose-500/15 text-rose-500'
                              : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                          }`}
                        >
                          {parsedEmbed.kind === 'invalid'
                            ? parsedEmbed.providerLabel
                            : `✓ ${parsedEmbed.providerLabel} terdeteksi`}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        autoFocus={editingVideoId === block.id || !block.content}
                        value={draftUrl}
                        onChange={(e) =>
                          setVideoUrlDrafts((prev) => ({
                            ...prev,
                            [block.id]: e.target.value
                          }))
                        }
                        placeholder="Tempel link YouTube (youtube.com / youtu.be), Vimeo, Drive, atau .mp4..."
                        className="flex-1 bg-surface border border-border-subtle rounded-lg px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent-strong"
                      />
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="submit"
                          disabled={parsedEmbed.kind === 'invalid'}
                          className="px-3.5 py-1.5 rounded-lg bg-accent-strong text-white dark:text-slate-950 text-xs font-semibold hover:opacity-95 disabled:opacity-45 transition"
                        >
                          Sematkan
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingVideoId(null);
                            if (!block.content) {
                              void handleBlockChange(block.id, {
                                type: 'text',
                                content: ''
                              });
                            } else {
                              setVideoUrlDrafts((prev) => ({
                                ...prev,
                                [block.id]: block.content
                              }));
                            }
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-surface border border-border-subtle text-xs text-text-secondary hover:text-text-primary transition"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  </form>
                ) : parsedEmbed.kind !== 'invalid' ? (
                  <figure className="bg-subtle/40 border border-border-subtle rounded-xl p-2.5 space-y-2 group/vid">
                    <div className="flex items-center justify-between gap-2 px-1">
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-semibold text-text-secondary">
                        <Video className="w-3.5 h-3.5 text-rose-500" />
                        <span>{parsedEmbed.providerLabel}</span>
                      </span>

                      <div className="flex items-center gap-1.5">
                        <a
                          href={parsedEmbed.originalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface border border-border-subtle text-[10px] font-medium text-text-secondary hover:text-text-primary transition"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Buka Link</span>
                        </a>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => {
                              setVideoUrlDrafts((prev) => ({
                                ...prev,
                                [block.id]: block.content
                              }));
                              setEditingVideoId(block.id);
                            }}
                            className="px-2 py-0.5 rounded-md bg-surface border border-border-subtle text-[10px] font-medium text-text-secondary hover:text-text-primary transition"
                          >
                            Ubah URL
                          </button>
                        )}
                      </div>
                    </div>

                    {parsedEmbed.kind === 'video' ? (
                      <video
                        src={parsedEmbed.embedUrl}
                        controls
                        playsInline
                        preload="metadata"
                        className="w-full max-h-[460px] rounded-lg bg-black"
                      />
                    ) : (
                      <div className="w-full aspect-video rounded-lg overflow-hidden bg-slate-950 border border-border-subtle">
                        <iframe
                          src={parsedEmbed.embedUrl}
                          title={block.caption || `${parsedEmbed.providerLabel} Video`}
                          className="w-full h-full border-0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          referrerPolicy="strict-origin-when-cross-origin"
                          allowFullScreen
                        />
                      </div>
                    )}

                    <input
                      readOnly={!canEdit}
                      value={block.caption || ''}
                      onChange={(e) =>
                        void handleBlockChange(block.id, { caption: e.target.value })
                      }
                      placeholder={
                        canEdit
                          ? 'Tambahkan keterangan atau catatan timestamp video...'
                          : ''
                      }
                      className="w-full text-center bg-transparent text-xs text-text-secondary focus:outline-none"
                    />
                  </figure>
                ) : (
                  <div className="p-3 rounded-xl border border-rose-400/30 bg-rose-500/10 text-xs text-rose-500 flex items-center justify-between gap-2">
                    <span>URL video tidak valid: {block.content}</span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setEditingVideoId(block.id)}
                        className="px-2.5 py-1 rounded-md bg-surface text-text-primary font-semibold"
                      >
                        Perbaiki URL
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Notion URL Link / Bookmark Block (`/link` or `/url`) */}
          {block.type === 'link' && (() => {
            const draft = linkDrafts[block.id] ?? {
              url: block.content,
              caption: block.caption || ''
            };
            const parsedDraft = parseLinkUrl(draft.url);
            const parsedSaved = parseLinkUrl(block.content);
            const isEditingLink =
              canEdit && (!block.content || editingLinkId === block.id);

            const cancelLinkEdit = () => {
              setEditingLinkId(null);
              if (!block.content) {
                void handleBlockChange(block.id, {
                  type: 'text',
                  content: ''
                });
                setPendingFocusBlockId(block.id);
              } else {
                setLinkDrafts((prev) => ({
                  ...prev,
                  [block.id]: {
                    url: block.content,
                    caption: block.caption || ''
                  }
                }));
              }
            };

            return (
              <div className="my-1.5">
                {isEditingLink ? (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!parsedDraft.isValid) return;
                      await handleBlockChange(block.id, {
                        content: parsedDraft.url,
                        caption: draft.caption.trim()
                      });
                      setEditingLinkId(null);
                    }}
                    className="p-4 rounded-xl border border-dashed border-border-subtle bg-subtle/45 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-text-primary">
                        <Link2 className="w-4 h-4 text-accent-strong" />
                        <span>
                          {block.content ? 'Ubah URL Link' : 'Tambahkan URL Link'}
                        </span>
                      </span>
                      {draft.url.trim() && (
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                            parsedDraft.isValid
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                              : 'bg-rose-500/15 text-rose-500'
                          }`}
                        >
                          {parsedDraft.isValid
                            ? `✓ ${parsedDraft.hostname}`
                            : parsedDraft.errorLabel}
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      <input
                        type="text"
                        autoFocus={editingLinkId === block.id || !block.content}
                        value={draft.url}
                        onChange={(e) =>
                          setLinkDrafts((prev) => ({
                            ...prev,
                            [block.id]: {
                              url: e.target.value,
                              caption: draft.caption
                            }
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            cancelLinkEdit();
                          }
                        }}
                        placeholder="Tempel atau ketik URL (mis. https://example.com)..."
                        className="w-full bg-surface border border-border-subtle rounded-lg px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent-strong"
                      />
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={draft.caption}
                          onChange={(e) =>
                            setLinkDrafts((prev) => ({
                              ...prev,
                              [block.id]: {
                                url: draft.url,
                                caption: e.target.value
                              }
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              e.preventDefault();
                              cancelLinkEdit();
                            }
                          }}
                          placeholder="Judul / label link (opsional, mis. Referensi Kuliah)..."
                          className="flex-1 bg-surface border border-border-subtle rounded-lg px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent-strong"
                        />
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="submit"
                            disabled={!parsedDraft.isValid}
                            className="px-3.5 py-1.5 rounded-lg bg-accent-strong text-white dark:text-slate-950 text-xs font-semibold hover:opacity-95 disabled:opacity-45 transition"
                          >
                            Simpan Link
                          </button>
                          <button
                            type="button"
                            onClick={cancelLinkEdit}
                            className="px-2.5 py-1.5 rounded-lg bg-surface border border-border-subtle text-xs text-text-secondary hover:text-text-primary transition"
                          >
                            Batal
                          </button>
                        </div>
                      </div>
                    </div>
                  </form>
                ) : parsedSaved.isValid ? (
                  <div className="rounded-xl border border-border-subtle bg-subtle/50 hover:bg-subtle/80 hover:border-accent-strong/60 transition p-3 flex items-center justify-between gap-3 group/link">
                    <a
                      href={parsedSaved.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        if (isSelectMode) e.preventDefault();
                      }}
                      className="flex items-center gap-3 min-w-0 flex-1"
                    >
                      <div className="w-9 h-9 rounded-lg bg-accent-strong/10 border border-accent-strong/25 text-accent-strong flex items-center justify-center shrink-0">
                        <Globe className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="text-sm font-semibold text-text-primary group-hover/link:text-accent-strong truncate transition">
                            {block.caption?.trim() || parsedSaved.hostname}
                          </p>
                          {block.caption?.trim() && (
                            <span className="hidden sm:inline-block px-1.5 py-0.5 rounded-md bg-surface border border-border-subtle text-[10px] font-mono text-text-secondary shrink-0">
                              {parsedSaved.hostname}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-mono text-text-secondary truncate">
                          {parsedSaved.url}
                        </p>
                      </div>
                    </a>

                    <div className="flex items-center gap-1 shrink-0 no-print">
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard.writeText(parsedSaved.url);
                          setCopiedId(block.id);
                          window.setTimeout(() => setCopiedId(null), 1500);
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-surface border border-border-subtle text-[10px] font-medium text-text-secondary hover:text-text-primary transition"
                        title="Salin URL"
                      >
                        <Copy className="w-3 h-3" />
                        <span className="hidden sm:inline">
                          {copiedId === block.id ? 'Tersalin' : 'Salin'}
                        </span>
                      </button>

                      <a
                        href={parsedSaved.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => {
                          if (isSelectMode) e.preventDefault();
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-surface border border-border-subtle text-[10px] font-medium text-text-secondary hover:text-text-primary transition"
                        title="Buka URL di tab baru"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span className="hidden sm:inline">Buka</span>
                      </a>

                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => {
                            setLinkDrafts((prev) => ({
                              ...prev,
                              [block.id]: {
                                url: block.content,
                                caption: block.caption || ''
                              }
                            }));
                            setEditingLinkId(block.id);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-surface border border-border-subtle text-[10px] font-medium text-text-secondary hover:text-text-primary transition"
                          title="Ubah URL atau label"
                        >
                          <Pencil className="w-3 h-3" />
                          <span className="hidden sm:inline">Ubah</span>
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl border border-rose-400/30 bg-rose-500/10 text-xs text-rose-500 flex items-center justify-between gap-2">
                    <span className="truncate">URL link tidak valid: {block.content}</span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          setLinkDrafts((prev) => ({
                            ...prev,
                            [block.id]: {
                              url: block.content,
                              caption: block.caption || ''
                            }
                          }));
                          setEditingLinkId(block.id);
                        }}
                        className="px-2.5 py-1 rounded-md bg-surface text-text-primary font-semibold shrink-0"
                      >
                        Perbaiki URL
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

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
                            {pdfProgressByBlockId[block.id]
                              ? pdfProgressByBlockId[block.id]
                              : `${block.pdfPages || 1} halaman • Teks siap dibaca AI`}
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
                          disabled={reExtractingBlockId === block.id}
                          onClick={() => void handleAskAiForPdfBlock(block)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-[11px] font-semibold inline-flex items-center gap-1 shadow-sm transition"
                        >
                          {reExtractingBlockId === block.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Sparkles className="w-3 h-3" />
                          )}
                          {reExtractingBlockId === block.id ? 'Membaca...' : 'Tanya AI'}
                        </button>
                      </div>
                    </div>

                    {isPdfPreviewOpen && (
                      <div className="pt-1">
                        <PdfDocumentPreview
                          src={block.content}
                          pdfText={block.pdfText}
                          totalPages={block.pdfPages || 1}
                          onReExtractText={
                            canEdit
                              ? async () => {
                                  await handleReExtractPdfBlock(block);
                                }
                              : undefined
                          }
                          reExtracting={reExtractingBlockId === block.id}
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
                          {pdfProgressByBlockId[block.id] ||
                            'Mengekstrak teks PDF & mengunggah ke Cloud Catatan...'}
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
                        e.target.value = '';
                        if (f) void handleUploadPdfForBlock(block.id, f);
                      }}
                    />
                  </label>
                ) : null}
              </div>
            );
          })()}

          {/* Integrated Database Table Block (`/database` / `/tabel`) */}
          {block.type === 'database' && (
            <DatabaseBlockView
              block={block}
              canEdit={canEdit}
              onUpdateDatabase={(nextData: DatabaseBlockData, titleContent: string) =>
                void handleBlockChange(block.id, {
                  databaseData: nextData,
                  content: titleContent
                })
              }
              onCreateConnectedBlock={(kind) =>
                void handleCreateConnectedBlockFromDatabase(block.id, kind)
              }
              onAskAI={() => {
                const dbData = block.databaseData || createDefaultDatabaseData('blank');
                triggerInlineAIExplain(
                  `Analisis Tabel Database "${dbData.title}":\n${databaseToMarkdownTable(dbData, 50)}`
                );
                setIsAIDrawerOpen(true);
              }}
            />
          )}

          {/* Connected Bar / Donut / Line Chart Block (`/batang` / `/donat` / `/chart`) */}
          {block.type === 'chart' && activeNote && (
            <ChartBlockView
              block={block}
              activeNoteId={activeNote.id}
              allNotes={allNotes}
              canEdit={canEdit}
              onUpdateChart={(nextData: ChartBlockData, titleContent: string) =>
                void handleBlockChange(block.id, {
                  chartData: nextData,
                  content: titleContent
                })
              }
              onCreateStarterDatabase={() => handleCreateStarterDatabaseForBlock(block.id)}
              onAskAI={() => {
                const cData = block.chartData;
                if (!cData) return;
                const srcNote = allNotes.find((n) => n.id === cData.sourceNoteId);
                const srcBlock = findBlockById(
                  srcNote?.blocks || activeNote.blocks,
                  cData.sourceBlockId
                );
                const agg = aggregateDatabaseForChart(srcBlock?.databaseData, cData);
                const summary = agg.items
                  .map((i) => `${i.label}: ${i.value} (${i.percent}%)`)
                  .join(', ');
                triggerInlineAIExplain(
                  `Analisis Diagram "${cData.title}" (${cData.kind}): ${summary}`
                );
                setIsAIDrawerOpen(true);
              }}
            />
          )}

          {/* Editable Connected Form Block (`/form` / `/formulir`) */}
          {block.type === 'form' && activeNote && (
            <FormBlockView
              block={block}
              activeNoteId={activeNote.id}
              allNotes={allNotes}
              canEdit={canEdit}
              onUpdateForm={(nextData: FormBlockData, titleContent: string) =>
                handleBlockChange(block.id, {
                  formData: nextData,
                  content: titleContent
                })
              }
              onSyncColumnInDatabase={(targetNoteId, targetBlockId, col) =>
                handleSyncColumnInDatabase(targetNoteId, targetBlockId, col)
              }
              onCreateStarterDatabase={() => handleCreateStarterDatabaseForBlock(block.id)}
              onSubmitForm={(payload) => handleSubmitForm(payload)}
            />
          )}

          {/* Live Metric / KPI Block (`/metric` / `/kpi`) */}
          {block.type === 'metric' && activeNote && (
            <MetricBlockView
              block={block}
              activeNoteId={activeNote.id}
              activeNoteBlocks={activeNote.blocks}
              allNotes={allNotes}
              canEdit={canEdit}
              onUpdateMetric={(nextData: MetricBlockData, titleContent: string) =>
                void handleBlockChange(block.id, {
                  metricData: nextData,
                  content: titleContent
                })
              }
            />
          )}

          {/* Lightweight Simple Text Table Block (`/table`) */}
          {block.type === 'table' && activeNote && (
            <SimpleTableBlockView
              block={block}
              canEdit={canEdit}
              onUpdateTable={(nextData: SimpleTableData, previewContent: string) =>
                void handleBlockChange(block.id, {
                  tableData: nextData,
                  content: previewContent
                })
              }
              onAskAI={(markdownTable) => {
                triggerInlineAIExplain(`Analisis Tabel Sederhana:\n${markdownTable}`);
                setIsAIDrawerOpen(true);
              }}
            />
          )}

          {/* Mermaid Diagram Block (`/mermaid`) */}
          {block.type === 'mermaid' && activeNote && (
            <MermaidBlockView
              block={block}
              theme={theme}
              canEdit={canEdit}
              onChangeCode={(nextCode) =>
                void handleBlockChange(block.id, { content: nextCode })
              }
              onChangeCaption={(nextCaption) =>
                void handleBlockChange(block.id, { caption: nextCaption })
              }
              onAskAI={(code) => {
                triggerInlineAIExplain(
                  `Jelaskan atau bantu perbaiki diagram Mermaid berikut:\n\`\`\`mermaid\n${code}\n\`\`\``
                );
                setIsAIDrawerOpen(true);
              }}
            />
          )}

          {/* Voice Note Recorder / Player / AI Transcript Block (`/voice`) */}
          {block.type === 'voice' && activeNote && (
            <VoiceBlockView
              block={block}
              canEdit={canEdit}
              onUpdateVoice={(patch: {
                voiceData: VoiceBlockData;
                content: string;
                caption?: string;
              }) => void handleBlockChange(block.id, patch)}
              onInsertTranscriptAsBlock={(transcript) => {
                const clean = transcript.trim();
                if (!clean || !activeNote || !canEdit) return;
                void (async () => {
                  const freshNote = (await db.notes.get(activeNote.id)) || activeNote;
                  const newBlk: NoteBlock = {
                    id: createBlockId(),
                    type: 'text',
                    content: clean
                  };
                  const nextBlocks = insertBlocksRelativeDeep(
                    freshNote.blocks,
                    block.id,
                    'after',
                    [newBlk]
                  );
                  await updateNoteBlocks(nextBlocks);
                  setPendingFocusBlockId(newBlk.id);
                })();
              }}
              onAskAI={(transcript, title) => {
                triggerInlineAIExplain(
                  `Rangkum dan buat poin penting dari Voice Note "${title}":\n${transcript}`
                );
                setIsAIDrawerOpen(true);
              }}
            />
          )}

          {/* Notion-Style Multi-Column Layout Container (2, 3, 4, or 5 Columns) */}
          {block.type === 'columns' && !isInsideColumn && (() => {
            const cols = block.columns || [];
            const colCount = cols.length || 2;
            const gridColsClass =
              colCount === 5
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5'
                : colCount === 4
                  ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
                  : colCount === 3
                    ? 'grid-cols-1 md:grid-cols-3'
                    : 'grid-cols-1 md:grid-cols-2';

            return (
              <div className="my-2 space-y-1.5 group/colwrap">
                {canEdit && (
                  <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1 rounded-xl bg-subtle/60 border border-border-subtle/70 text-[11px] opacity-80 group-hover/colwrap:opacity-100 transition no-print">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary mr-1">
                        Kolom:
                      </span>
                      {([2, 3, 4, 5] as const).map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => void handleResizeColumns(block.id, n)}
                          className={`px-2 py-0.5 rounded-md font-mono font-semibold transition ${
                            colCount === n
                              ? 'bg-accent-strong text-white dark:text-slate-950'
                              : 'bg-surface hover:bg-subtle text-text-secondary hover:text-text-primary border border-border-subtle'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleUngroupColumns(block.id)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface hover:bg-subtle border border-border-subtle text-[10px] font-medium text-text-secondary hover:text-text-primary transition"
                      title="Bongkar kolom menjadi blok biasa berurutan"
                    >
                      <Ungroup className="w-3 h-3" />
                      <span>Bongkar Kolom</span>
                    </button>
                  </div>
                )}

                <div className={`grid ${gridColsClass} gap-3 items-start`}>
                  {cols.map((col, colIdx) => {
                    const isColDropTarget =
                      dropTargetColumn?.columnsBlockId === block.id &&
                      dropTargetColumn.columnId === col.id;
                    let colNumber = 0;

                    return (
                      <div
                        key={col.id}
                        onDragOver={(e) => {
                          if (!canEdit || draggedNoteId || draggedBlockId === block.id) return;
                          e.preventDefault();
                          e.stopPropagation();
                          setIsFileDragOverEditor(false);
                          setDropTargetBlock(null);
                          setDropTargetColumn((prev) =>
                            prev?.columnsBlockId === block.id && prev.columnId === col.id
                              ? prev
                              : { columnsBlockId: block.id, columnId: col.id }
                          );
                        }}
                        onDragLeave={(e) => {
                          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                            setDropTargetColumn((prev) =>
                              prev?.columnsBlockId === block.id && prev.columnId === col.id
                                ? null
                                : prev
                            );
                          }
                        }}
                        onDrop={(e) => {
                          if (!canEdit || draggedNoteId) return;
                          void handleDropIntoColumn(e, block.id, col.id);
                        }}
                        className={`min-w-0 rounded-xl border p-2.5 space-y-1 transition ${
                          isColDropTarget
                            ? 'border-accent-strong bg-accent-strong/5 ring-2 ring-accent-strong/30'
                            : 'border-border-subtle/60 bg-subtle/20 hover:border-border-subtle'
                        }`}
                      >
                        {(col.blocks || []).map((innerBlk) => {
                          if (innerBlk.type === 'numbered') colNumber += 1;
                          else colNumber = 0;
                          return renderBlockRow(innerBlk, colNumber, {
                            columnsBlockId: block.id,
                            columnId: col.id
                          });
                        })}

                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => void handleAddBlockToColumn(block.id, col.id)}
                            className="w-full py-1 px-2 rounded-lg text-[11px] text-text-secondary/60 hover:text-text-primary hover:bg-subtle/70 flex items-center gap-1 transition no-print"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Kolom {colIdx + 1}</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Notion Slash Command Menu (`/`) */}
          {isSlashOpen && (
            <div className="absolute left-0 top-full mt-1 z-30 w-64 sm:w-72 max-w-[calc(100vw-2rem)] max-h-72 overflow-y-auto miu-card shadow-xl p-1.5 space-y-0.5 no-print">
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
                      key={opt.id}
                      type="button"
                      onClick={() => void applySlashCommand(block.id, opt.type, opt.preset)}
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
                  Mendukung Gambar, Audio/Voice Note, Dokumen PDF (AI Reader), dan Teks/Markdown
                </p>
              </div>
            </div>
          </div>
        )}
        {/* =================================================================== */}
        {/* LEFT SIDEBAR: RESIZABLE + CUSTOMIZABLE NOTION SIDEBAR + INBOX       */}
        {/* =================================================================== */}
        {isSidebarOpen && (
          <aside
            style={{ width: `${sidebarWidth}px` }}
            className="h-screen sticky top-0 z-20 shrink-0 border-r border-border-subtle bg-[#F7F7F5] dark:bg-subtle/75 flex flex-col justify-between select-none no-print relative"
          >
            {/* Right-Edge Drag-to-Resize & Click-to-Close Handle with Tooltip (image_4) */}
            <div
              onMouseDown={handleStartSidebarResize}
              className={`group/resizer absolute top-0 -right-1 w-2 h-full cursor-col-resize z-30 flex items-center ${
                isResizingSidebar ? 'bg-sky-500/40' : 'hover:bg-sky-500/25'
              } transition-colors`}
            >
              <div
                style={{ left: `${sidebarWidth + 8}px`, top: '48%' }}
                className="opacity-0 group-hover/resizer:opacity-100 pointer-events-none fixed z-50 px-2.5 py-1.5 rounded-lg bg-slate-900/95 text-white text-[11px] leading-snug shadow-xl whitespace-nowrap transition-opacity duration-150"
              >
                <div>
                  <span className="font-semibold text-white">Tutup</span>{' '}
                  <span className="text-slate-300">Klik atau ⌘\</span>
                </div>
                <div>
                  <span className="font-semibold text-white">Ubah ukuran</span>{' '}
                  <span className="text-slate-300">Tarik</span>
                </div>
              </div>
            </div>

            <div
              className={`px-2.5 pt-2.5 pb-2 ${
                islandPosition === 'top-left' ? 'pt-14' : ''
              } flex flex-col gap-2 overflow-y-auto overflow-x-hidden flex-1`}
            >
              {/* Top Bar: Sidebar Collapse (Left) + Inbox & New Page (Right) */}
              <div className="flex items-center justify-between gap-1 px-0.5">
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-1.5 rounded-md hover:bg-text-primary/[0.06] dark:hover:bg-white/[0.06] text-text-secondary hover:text-text-primary transition"
                  title="Tutup bilah sisi (⌘\)"
                  aria-label="Tutup bilah sisi"
                >
                  <PanelLeft className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-0.5">
                  <SidebarInboxTriggerButton
                    isOpen={isInboxOpen}
                    onToggle={() => setIsInboxOpen((v) => !v)}
                    allNotes={allNotes}
                    sharedWithMeNotes={sharedWithMeNotes}
                  />
                  <button
                    type="button"
                    onClick={() => void handleCreateNote(null, true)}
                    className="p-1.5 rounded-md hover:bg-text-primary/[0.06] dark:hover:bg-white/[0.06] text-text-secondary hover:text-text-primary transition"
                    title="Buat halaman baru"
                    aria-label="Buat halaman baru"
                  >
                    <SquarePen className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Search Input ("Cari atau tanya" + ⌘K badge) */}
              <div className="px-0.5">
                <div className="relative flex items-center bg-surface/90 dark:bg-surface border border-border-subtle/90 rounded-lg px-2.5 py-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] focus-within:border-sky-500">
                  <input
                    ref={sidebarSearchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        if (searchQuery) {
                          setSearchQuery('');
                        } else {
                          e.currentTarget.blur();
                        }
                      }
                    }}
                    placeholder="Cari atau tanya"
                    className="w-full bg-transparent text-[13px] text-text-primary placeholder:text-text-secondary/65 focus:outline-none pr-8"
                  />
                  {searchQuery ? (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="text-[11px] text-text-secondary hover:text-text-primary"
                    >
                      ✕
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        sidebarSearchInputRef.current?.focus();
                        sidebarSearchInputRef.current?.select();
                      }}
                      title="Cari atau tanya (⌘K)"
                      className="px-1.5 py-0.5 rounded bg-subtle hover:bg-text-primary/10 border border-border-subtle/80 text-[10px] font-mono font-medium text-text-secondary shrink-0 transition"
                    >
                      ⌘K
                    </button>
                  )}
                </div>
              </div>

              {/* Top Shortcut Pills Row: [🏠 Beranda] 💬 📅 + */}
              <div className="flex items-center gap-1 px-0.5">
                <button
                  type="button"
                  onClick={() => setMainViewMode('document')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[13px] font-medium transition ${
                    mainViewMode === 'document'
                      ? 'bg-text-primary/[0.07] dark:bg-white/[0.09] text-text-primary font-semibold'
                      : 'text-text-secondary hover:bg-text-primary/[0.04] hover:text-text-primary'
                  }`}
                >
                  <Home className="w-3.5 h-3.5 shrink-0" />
                  <span>Beranda</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsAIDrawerOpen(!isAIDrawerOpen)}
                  className={`p-1.5 rounded-md transition ${
                    isAIDrawerOpen
                      ? 'bg-text-primary/[0.07] dark:bg-white/[0.09] text-text-primary'
                      : 'text-text-secondary hover:bg-text-primary/[0.04] hover:text-text-primary'
                  }`}
                  title="Obrolan & Asisten AI"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setMainViewMode((prev) =>
                      prev === 'calendar' ? 'document' : 'calendar'
                    )
                  }
                  className={`p-1.5 rounded-md transition relative ${
                    mainViewMode === 'calendar'
                      ? 'bg-text-primary/[0.07] dark:bg-white/[0.09] text-text-primary'
                      : 'text-text-secondary hover:bg-text-primary/[0.04] hover:text-text-primary'
                  }`}
                  title="Kalender & Deadline"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  {scheduledDeadlineCount > 0 && (
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-500" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (isCustomizeSidebar) {
                      setShowAddSidebarSection((v) => !v);
                    } else {
                      setMainViewMode((prev) =>
                        prev === 'kanban' ? 'document' : 'kanban'
                      );
                    }
                  }}
                  className={`p-1.5 rounded-md transition ${
                    mainViewMode === 'kanban' && !isCustomizeSidebar
                      ? 'bg-text-primary/[0.07] dark:bg-white/[0.09] text-text-primary'
                      : 'text-text-secondary hover:bg-text-primary/[0.04] hover:text-text-primary'
                  }`}
                  title={
                    isCustomizeSidebar
                      ? 'Tambahkan pintasan'
                      : 'Papan Kanban & Tampilan Database'
                  }
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {isCustomizeSidebar ? (
                /* ============================================================= */
                /* IMAGE_5 & IMAGE_6: SESUAIKAN BILAH SISI (CUSTOMIZE SIDEBAR)   */
                /* ============================================================= */
                <div className="space-y-2 pt-1 flex-1">
                  <button
                    type="button"
                    onClick={() => setShowAddSidebarSection((v) => !v)}
                    className="w-full flex items-center gap-2 px-2 py-1 rounded-md text-[13px] text-text-secondary hover:text-text-primary hover:bg-text-primary/[0.04] transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambahkan pintasan</span>
                  </button>

                  <div className="h-px bg-border-subtle my-1.5" />

                  <div className="space-y-0.5">
                    {sidebarSections.map((secId) => {
                      const meta = SIDEBAR_SECTION_CATALOG.find((s) => s.id === secId);
                      if (!meta) return null;
                      return (
                        <div
                          key={secId}
                          draggable
                          onDragStart={() => setDraggedSidebarSection(secId)}
                          onDragEnd={() => setDraggedSidebarSection(null)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => {
                            if (draggedSidebarSection) {
                              handleReorderSidebarSection(draggedSidebarSection, secId);
                            }
                            setDraggedSidebarSection(null);
                          }}
                          className={`group flex items-center justify-between gap-2 px-1.5 py-1.5 rounded-md text-[13.5px] text-text-primary hover:bg-text-primary/[0.04] cursor-grab active:cursor-grabbing transition ${
                            draggedSidebarSection === secId ? 'opacity-45' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <GripVertical className="w-3.5 h-3.5 text-text-secondary/70 shrink-0" />
                            {renderSidebarSectionIcon(
                              secId,
                              'w-4 h-4 text-text-secondary shrink-0'
                            )}
                            <span className="truncate font-medium">{meta.label}</span>
                          </div>
                          {sidebarSections.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleToggleSidebarSection(secId)}
                              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-rose-500/15 text-text-secondary hover:text-rose-500 text-xs transition"
                              title="Sembunyikan bagian ini"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="relative pt-0.5">
                    <button
                      type="button"
                      onClick={() => setShowAddSidebarSection((v) => !v)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] text-text-secondary hover:text-text-primary hover:bg-text-primary/[0.04] transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambahkan bagian</span>
                    </button>

                    {showAddSidebarSection && (
                      <div className="mt-1.5">
                        <AddSidebarSectionPopover
                          activeSections={sidebarSections}
                          onToggleSection={handleToggleSidebarSection}
                          onClose={() => setShowAddSidebarSection(false)}
                        />
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setSidebarSections(DEFAULT_SIDEBAR_SECTIONS);
                        saveSidebarSections(DEFAULT_SIDEBAR_SECTIONS);
                      }}
                      className="w-full mt-1 flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 transition"
                    >
                      <span>Kembalikan semua bagian default</span>
                    </button>
                  </div>
                </div>
              ) : searchQuery.trim() ? (
                /* Search Results in Sidebar */
                <div className="space-y-0.5 pt-1">
                  <div className="px-2 pb-1 text-[11px] font-medium text-text-secondary">
                    Hasil Pencarian ({visibleNotes.length})
                  </div>
                  {visibleNotes.map((note) => {
                    const isSelected =
                      note.id === activeNoteId && mainViewMode === 'document';
                    return (
                      <div
                        key={note.id}
                        onClick={(e) => {
                          if (e.altKey) {
                            setSidePeekNoteId(note.id);
                          } else {
                            openDocumentNote(note.id);
                          }
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSidebarNoteMenuTarget({
                            note,
                            x: e.clientX,
                            y: e.clientY
                          });
                        }}
                        className={`group w-full flex items-center justify-between gap-1.5 px-2 py-1 rounded-md text-[13.5px] cursor-pointer transition ${
                          isSelected
                            ? 'bg-text-primary/[0.06] dark:bg-white/[0.08] font-medium text-text-primary'
                            : 'text-text-secondary hover:bg-text-primary/[0.04] hover:text-text-primary'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="text-[15px] leading-none shrink-0">
                            {note.icon || '📄'}
                          </span>
                          <span className="truncate">{note.title || 'Tanpa Judul'}</span>
                        </div>
                        <SidebarNoteActionButtons
                          note={note}
                          onOpenMenu={(target) => setSidebarNoteMenuTarget(target)}
                          onCreateSubpage={(pId) => void handleCreateNote(pId, true)}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Normal Sidebar Sections in User-Customized Order */
                <div className="space-y-3 pt-1">
                  {sidebarSections.map((secId) => {
                    if (secId === 'favorites') {
                      if (favoriteNotes.length === 0 && !draggedNoteId) return null;
                      return (
                        <div key="sec-favorites" className="space-y-0.5">
                          <div
                            onDragOver={(e) => {
                              if (!draggedNoteId) return;
                              e.preventDefault();
                              setDropTargetNoteId('FAVORITES_ROOT');
                            }}
                            onDragLeave={() => {
                              if (dropTargetNoteId === 'FAVORITES_ROOT') {
                                setDropTargetNoteId(null);
                              }
                            }}
                            onDrop={(e) => {
                              const sourceId =
                                e.dataTransfer.getData('application/miu-note-id') ||
                                draggedNoteId;
                              setDraggedNoteId(null);
                              setDropTargetNoteId(null);
                              if (!sourceId) return;
                              e.preventDefault();
                              e.stopPropagation();
                              void handleUpdateSpecificNote(sourceId, { isFavorite: true });
                            }}
                            className={`px-2 py-0.5 rounded-md text-[11.5px] font-medium text-text-secondary transition ${
                              dropTargetNoteId === 'FAVORITES_ROOT'
                                ? 'bg-[#2383E2]/15 ring-1 ring-[#2383E2] text-text-primary'
                                : ''
                            }`}
                          >
                            {dropTargetNoteId === 'FAVORITES_ROOT'
                              ? 'Lepas ke Favorit'
                              : 'Favorit'}
                          </div>
                          {favoriteNotes.map((note) => {
                            const isDropTarget = dropTargetNoteId === `fav-${note.id}`;
                            const favChildren = allNotes.filter((c) => c.parentId === note.id);
                            const hasFavChildren = favChildren.length > 0;
                            const isFavCollapsed = Boolean(collapsedParents[note.id]);
                            return (
                              <div key={`fav-${note.id}`} className="space-y-0.5 relative">
                                {isDropTarget && dropTargetPosition === 'before' && (
                                  <div className="h-[2px] bg-[#2383E2] rounded-full mx-1.5 pointer-events-none" />
                                )}
                                <div
                                  draggable
                                  onDragStart={(e) => {
                                    e.dataTransfer.setData('application/miu-note-id', note.id);
                                    e.dataTransfer.effectAllowed = 'move';
                                    setDraggedNoteId(note.id);
                                  }}
                                  onDragEnd={() => {
                                    setDraggedNoteId(null);
                                    setDropTargetNoteId(null);
                                  }}
                                  onDragOver={(e) => {
                                    if (!draggedNoteId || draggedNoteId === note.id) return;
                                    e.preventDefault();
                                    const pos = computeNoteDropPosition(e, true);
                                    setDropTargetNoteId(`fav-${note.id}`);
                                    setDropTargetPosition(pos);
                                  }}
                                  onDragLeave={() => {
                                    if (dropTargetNoteId === `fav-${note.id}`) {
                                      setDropTargetNoteId(null);
                                    }
                                  }}
                                  onDrop={(e) => {
                                    const sourceId =
                                      e.dataTransfer.getData('application/miu-note-id') ||
                                      draggedNoteId;
                                    const pos = computeNoteDropPosition(e, true);
                                    setDraggedNoteId(null);
                                    setDropTargetNoteId(null);
                                    if (!sourceId || sourceId === note.id) return;
                                    e.preventDefault();
                                    e.stopPropagation();
                                    void handleSidebarNoteDrop(sourceId, note, pos, {
                                      isFavorite: true
                                    });
                                  }}
                                  onClick={(e) => {
                                    if (e.altKey) {
                                      setSidePeekNoteId(note.id);
                                    } else {
                                      openDocumentNote(note.id);
                                    }
                                  }}
                                  onContextMenu={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setSidebarNoteMenuTarget({
                                      note,
                                      x: e.clientX,
                                      y: e.clientY
                                    });
                                  }}
                                  className={`group w-full flex items-center justify-between gap-1 pl-1.5 pr-1.5 py-1 rounded-md text-[13.5px] cursor-pointer transition ${
                                    isDropTarget && dropTargetPosition === 'inside'
                                      ? 'bg-[#2383E2]/15 ring-1 ring-[#2383E2] text-text-primary'
                                      : note.id === activeNoteId && mainViewMode === 'document'
                                        ? 'bg-text-primary/[0.06] dark:bg-white/[0.08] font-medium text-text-primary'
                                        : 'text-text-secondary hover:bg-text-primary/[0.04] hover:text-text-primary'
                                  } ${draggedNoteId === note.id ? 'opacity-45' : ''}`}
                                >
                                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                    {hasFavChildren ? (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setCollapsedParents((prev) => ({
                                            ...prev,
                                            [note.id]: !prev[note.id]
                                          }));
                                        }}
                                        className="w-4 h-4 flex items-center justify-center rounded hover:bg-text-primary/[0.08] dark:hover:bg-white/[0.1] text-text-secondary hover:text-text-primary shrink-0 transition"
                                        title={
                                          isFavCollapsed
                                            ? 'Tampilkan subhalaman'
                                            : 'Sembunyikan subhalaman'
                                        }
                                      >
                                        {isFavCollapsed ? (
                                          <ChevronRight className="w-3.5 h-3.5" />
                                        ) : (
                                          <ChevronDown className="w-3.5 h-3.5" />
                                        )}
                                      </button>
                                    ) : (
                                      <span className="w-4 h-4 shrink-0" />
                                    )}
                                    <span className="text-[15px] leading-none shrink-0">
                                      {note.icon || '📄'}
                                    </span>
                                    <span className="truncate flex-1">
                                      {note.title || 'Tanpa Judul'}
                                    </span>
                                  </div>
                                  <SidebarNoteActionButtons
                                    note={note}
                                    onOpenMenu={(target) => setSidebarNoteMenuTarget(target)}
                                    onCreateSubpage={(pId) => void handleCreateNote(pId, true)}
                                  />
                                </div>
                                {isDropTarget && dropTargetPosition === 'after' && (
                                  <div className="h-[2px] bg-[#2383E2] rounded-full mx-1.5 pointer-events-none" />
                                )}
                                {hasFavChildren && !isFavCollapsed && (
                                  <div className="ml-3.5 pl-2 border-l border-border-subtle/75 space-y-0.5 mt-0.5">
                                    {renderSidebarPageTree(allNotes, note.id, 1, false)}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    }

                    if (secId === 'recent') {
                      const combinedPool = [...myNotes, ...sharedWithMeNotes];
                      const recentList = combinedPool
                        .filter(
                          (n) => !n.parentId || !combinedPool.some((p) => p.id === n.parentId)
                        )
                        .sort(
                          (a, b) =>
                            (a.sortOrder ?? -a.updatedAt) -
                            (b.sortOrder ?? -b.updatedAt)
                        )
                        .slice(0, 6);
                      return (
                        <div key="sec-recent" className="space-y-0.5">
                          <div className="px-2 py-0.5 text-[11.5px] font-medium text-text-secondary">
                            Terbaru
                          </div>
                          {recentList.map((note) => {
                            const isDropTarget = dropTargetNoteId === `rec-${note.id}`;
                            const recChildren = combinedPool.filter(
                              (c) => c.parentId === note.id
                            );
                            const hasRecChildren = recChildren.length > 0;
                            const isRecCollapsed = Boolean(collapsedParents[note.id]);
                            return (
                              <div key={`rec-${note.id}`} className="space-y-0.5 relative">
                                {isDropTarget && dropTargetPosition === 'before' && (
                                  <div className="h-[2px] bg-[#2383E2] rounded-full mx-1.5 pointer-events-none" />
                                )}
                                <div
                                  draggable
                                  onDragStart={(e) => {
                                    e.dataTransfer.setData('application/miu-note-id', note.id);
                                    e.dataTransfer.effectAllowed = 'move';
                                    setDraggedNoteId(note.id);
                                  }}
                                  onDragEnd={() => {
                                    setDraggedNoteId(null);
                                    setDropTargetNoteId(null);
                                  }}
                                  onDragOver={(e) => {
                                    if (!draggedNoteId || draggedNoteId === note.id) return;
                                    e.preventDefault();
                                    const pos = computeNoteDropPosition(e, true);
                                    setDropTargetNoteId(`rec-${note.id}`);
                                    setDropTargetPosition(pos);
                                  }}
                                  onDragLeave={() => {
                                    if (dropTargetNoteId === `rec-${note.id}`) {
                                      setDropTargetNoteId(null);
                                    }
                                  }}
                                  onDrop={(e) => {
                                    const sourceId =
                                      e.dataTransfer.getData('application/miu-note-id') ||
                                      draggedNoteId;
                                    const pos = computeNoteDropPosition(e, true);
                                    setDraggedNoteId(null);
                                    setDropTargetNoteId(null);
                                    if (!sourceId || sourceId === note.id) return;
                                    e.preventDefault();
                                    e.stopPropagation();
                                    void handleSidebarNoteDrop(sourceId, note, pos);
                                  }}
                                  onClick={(e) => {
                                    if (e.altKey) {
                                      setSidePeekNoteId(note.id);
                                    } else {
                                      openDocumentNote(note.id);
                                    }
                                  }}
                                  onContextMenu={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setSidebarNoteMenuTarget({
                                      note,
                                      x: e.clientX,
                                      y: e.clientY
                                    });
                                  }}
                                  className={`group w-full flex items-center justify-between gap-1 pl-1.5 pr-1.5 py-1 rounded-md text-[13.5px] cursor-pointer transition ${
                                    isDropTarget && dropTargetPosition === 'inside'
                                      ? 'bg-[#2383E2]/15 ring-1 ring-[#2383E2] text-text-primary'
                                      : note.id === activeNoteId && mainViewMode === 'document'
                                        ? 'bg-text-primary/[0.06] dark:bg-white/[0.08] font-medium text-text-primary'
                                        : 'text-text-secondary hover:bg-text-primary/[0.04] hover:text-text-primary'
                                  } ${draggedNoteId === note.id ? 'opacity-45' : ''}`}
                                >
                                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                    {hasRecChildren ? (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setCollapsedParents((prev) => ({
                                            ...prev,
                                            [note.id]: !prev[note.id]
                                          }));
                                        }}
                                        className="w-4 h-4 flex items-center justify-center rounded hover:bg-text-primary/[0.08] dark:hover:bg-white/[0.1] text-text-secondary hover:text-text-primary shrink-0 transition"
                                        title={
                                          isRecCollapsed
                                            ? 'Tampilkan subhalaman'
                                            : 'Sembunyikan subhalaman'
                                        }
                                      >
                                        {isRecCollapsed ? (
                                          <ChevronRight className="w-3.5 h-3.5" />
                                        ) : (
                                          <ChevronDown className="w-3.5 h-3.5" />
                                        )}
                                      </button>
                                    ) : (
                                      <span className="w-4 h-4 shrink-0" />
                                    )}
                                    <span className="text-[15px] leading-none shrink-0">
                                      {note.icon || '📄'}
                                    </span>
                                    <span className="truncate flex-1">
                                      {note.title || 'Tanpa Judul'}
                                    </span>
                                  </div>
                                  <SidebarNoteActionButtons
                                    note={note}
                                    onOpenMenu={(target) => setSidebarNoteMenuTarget(target)}
                                    onCreateSubpage={(pId) => void handleCreateNote(pId, true)}
                                  />
                                </div>
                                {isDropTarget && dropTargetPosition === 'after' && (
                                  <div className="h-[2px] bg-[#2383E2] rounded-full mx-1.5 pointer-events-none" />
                                )}
                                {hasRecChildren && !isRecCollapsed && (
                                  <div className="ml-3.5 pl-2 border-l border-border-subtle/75 space-y-0.5 mt-0.5">
                                    {renderSidebarPageTree(combinedPool, note.id, 1, false)}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    }

                    if (secId === 'database_views') {
                      return (
                        <div key="sec-db-views" className="space-y-0.5">
                          <div className="px-2 py-0.5 text-[11.5px] font-medium text-text-secondary">
                            Tampilan database
                          </div>
                          <button
                            type="button"
                            onClick={() => setMainViewMode('kanban')}
                            className={`w-full flex items-center justify-between gap-2 px-2 py-1 rounded-md text-[13.5px] transition ${
                              mainViewMode === 'kanban'
                                ? 'bg-text-primary/[0.06] dark:bg-white/[0.08] font-medium text-text-primary'
                                : 'text-text-secondary hover:bg-text-primary/[0.04] hover:text-text-primary'
                            }`}
                          >
                            <span className="inline-flex items-center gap-2 min-w-0">
                              <Columns3 className="w-4 h-4 shrink-0" />
                              <span className="truncate">Papan Kanban</span>
                            </span>
                            <span className="text-[11px] font-mono text-text-secondary/80">
                              {myNotes.length + sharedWithMeNotes.length}
                            </span>
                          </button>
                        </div>
                      );
                    }

                    if (secId === 'pinned') {
                      const pinnedNotes = favoriteNotes.length > 0 ? favoriteNotes : myNotes.slice(0, 2);
                      return (
                        <div key="sec-pinned" className="space-y-0.5">
                          <div className="px-2 py-0.5 text-[11.5px] font-medium text-text-secondary">
                            Disematkan
                          </div>
                          {pinnedNotes.map((note) => {
                            const isDropTarget = dropTargetNoteId === `pin-${note.id}`;
                            return (
                              <div key={`pin-${note.id}`} className="relative">
                                {isDropTarget && dropTargetPosition === 'before' && (
                                  <div className="h-[2px] bg-[#2383E2] rounded-full mx-2 pointer-events-none" />
                                )}
                                <div
                                  draggable
                                  onDragStart={(e) => {
                                    e.dataTransfer.setData('application/miu-note-id', note.id);
                                    e.dataTransfer.effectAllowed = 'move';
                                    setDraggedNoteId(note.id);
                                  }}
                                  onDragEnd={() => {
                                    setDraggedNoteId(null);
                                    setDropTargetNoteId(null);
                                  }}
                                  onDragOver={(e) => {
                                    if (!draggedNoteId || draggedNoteId === note.id) return;
                                    e.preventDefault();
                                    const pos = computeNoteDropPosition(e, true);
                                    setDropTargetNoteId(`pin-${note.id}`);
                                    setDropTargetPosition(pos);
                                  }}
                                  onDragLeave={() => {
                                    if (dropTargetNoteId === `pin-${note.id}`) {
                                      setDropTargetNoteId(null);
                                    }
                                  }}
                                  onDrop={(e) => {
                                    const sourceId =
                                      e.dataTransfer.getData('application/miu-note-id') ||
                                      draggedNoteId;
                                    const pos = computeNoteDropPosition(e, true);
                                    setDraggedNoteId(null);
                                    setDropTargetNoteId(null);
                                    if (!sourceId || sourceId === note.id) return;
                                    e.preventDefault();
                                    e.stopPropagation();
                                    void handleSidebarNoteDrop(sourceId, note, pos);
                                  }}
                                  onClick={(e) => {
                                    if (e.altKey) {
                                      setSidePeekNoteId(note.id);
                                    } else {
                                      openDocumentNote(note.id);
                                    }
                                  }}
                                  onContextMenu={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setSidebarNoteMenuTarget({
                                      note,
                                      x: e.clientX,
                                      y: e.clientY
                                    });
                                  }}
                                  className={`group w-full flex items-center justify-between gap-1.5 px-2 py-1 rounded-md text-[13.5px] cursor-pointer transition ${
                                    isDropTarget && dropTargetPosition === 'inside'
                                      ? 'bg-[#2383E2]/15 ring-1 ring-[#2383E2] text-text-primary'
                                      : 'text-text-secondary hover:bg-text-primary/[0.04] hover:text-text-primary'
                                  } ${draggedNoteId === note.id ? 'opacity-45' : ''}`}
                                >
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <span className="text-[15px] leading-none shrink-0">
                                      {note.icon || '📌'}
                                    </span>
                                    <span className="truncate">{note.title || 'Tanpa Judul'}</span>
                                  </div>
                                  <SidebarNoteActionButtons
                                    note={note}
                                    onOpenMenu={(target) => setSidebarNoteMenuTarget(target)}
                                    onCreateSubpage={(pId) => void handleCreateNote(pId, true)}
                                  />
                                </div>
                                {isDropTarget && dropTargetPosition === 'after' && (
                                  <div className="h-[2px] bg-[#2383E2] rounded-full mx-2 pointer-events-none" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    }

                    if (secId === 'chats' || secId === 'agent') {
                      return (
                        <div key={`sec-${secId}`} className="space-y-0.5">
                          <div className="px-2 py-0.5 text-[11.5px] font-medium text-text-secondary">
                            {secId === 'agent' ? 'Agent' : 'Obrolan'}
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsAIDrawerOpen(true)}
                            className="w-full flex items-center gap-2 px-2 py-1 rounded-md text-[13.5px] text-text-secondary hover:bg-text-primary/[0.04] hover:text-text-primary text-left transition"
                          >
                            {renderSidebarSectionIcon(secId, 'w-4 h-4 shrink-0')}
                            <span className="truncate">
                              {secId === 'agent' ? 'Miu AI Agent' : 'Obrolan AI & Diskusi'}
                            </span>
                          </button>
                        </div>
                      );
                    }

                    if (secId === 'upcoming_events') {
                      return (
                        <div key="sec-events" className="space-y-0.5">
                          <div className="px-2 py-0.5 text-[11.5px] font-medium text-text-secondary">
                            Acara mendatang
                          </div>
                          <button
                            type="button"
                            onClick={() => setMainViewMode('calendar')}
                            className="w-full flex items-center justify-between gap-2 px-2 py-1 rounded-md text-[13.5px] text-text-secondary hover:bg-text-primary/[0.04] hover:text-text-primary text-left transition"
                          >
                            <span className="inline-flex items-center gap-2 truncate">
                              <Calendar className="w-4 h-4 shrink-0" />
                              <span className="truncate">Jadwal &amp; Deadline</span>
                            </span>
                            {scheduledDeadlineCount > 0 && (
                              <span className="text-[11px] font-mono">
                                {scheduledDeadlineCount}
                              </span>
                            )}
                          </button>
                        </div>
                      );
                    }

                    if (secId === 'ai_meeting_notes') {
                      const voiceNotes = myNotes.filter((n) =>
                        flattenBlocks(n.blocks).some((b) => b.type === 'voice')
                      );
                      return (
                        <div key="sec-meeting" className="space-y-0.5">
                          <div className="px-2 py-0.5 text-[11.5px] font-medium text-text-secondary">
                            Catatan Rapat AI
                          </div>
                          {voiceNotes.map((vn) => (
                            <div
                              key={`vn-${vn.id}`}
                              onClick={(e) => {
                                if (e.altKey) {
                                  setSidePeekNoteId(vn.id);
                                } else {
                                  openDocumentNote(vn.id);
                                }
                              }}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setSidebarNoteMenuTarget({
                                  note: vn,
                                  x: e.clientX,
                                  y: e.clientY
                                });
                              }}
                              className="group w-full flex items-center justify-between gap-1.5 px-2 py-1 rounded-md text-[13.5px] text-text-secondary hover:bg-text-primary/[0.04] hover:text-text-primary cursor-pointer transition"
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span className="text-[15px] leading-none shrink-0">
                                  {vn.icon || '🎙️'}
                                </span>
                                <span className="truncate">{vn.title || 'Catatan Rapat'}</span>
                              </div>
                              <SidebarNoteActionButtons
                                note={vn}
                                onOpenMenu={(target) => setSidebarNoteMenuTarget(target)}
                                onCreateSubpage={(pId) => void handleCreateNote(pId, true)}
                              />
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => void handleCreateNote(null, true)}
                            className="w-full flex items-center gap-2 px-2 py-1 rounded-md text-[13px] text-text-secondary/80 hover:text-text-primary hover:bg-text-primary/[0.04] text-left transition"
                          >
                            <Plus className="w-3.5 h-3.5 shrink-0" />
                            <span>Rekam rapat baru</span>
                          </button>
                        </div>
                      );
                    }

                    if (secId === 'private') {
                      return (
                        <div key="sec-private" className="space-y-0.5">
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
                              const sourceId =
                                e.dataTransfer.getData('application/miu-note-id') ||
                                draggedNoteId;
                              setDraggedNoteId(null);
                              setDropTargetNoteId(null);
                              if (!sourceId) return;
                              e.preventDefault();
                              e.stopPropagation();
                              void handleMoveNoteParent(sourceId, null);
                            }}
                            className={`group/priv flex items-center justify-between px-2 py-0.5 rounded-md transition ${
                              dropTargetNoteId === 'ROOT'
                                ? 'bg-accent-strong/15 ring-1 ring-accent-strong'
                                : ''
                            }`}
                          >
                            <span className="text-[11.5px] font-medium text-text-secondary">
                              {dropTargetNoteId === 'ROOT'
                                ? 'Lepas ke Privat'
                                : 'Privat'}
                            </span>
                            {currentUser && (
                              <button
                                type="button"
                                onClick={() => void handleCreateNote(null, true)}
                                className="opacity-0 group-hover/priv:opacity-100 p-0.5 rounded hover:bg-text-primary/[0.06] text-text-secondary hover:text-text-primary transition"
                                title="Tambah halaman baru"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {renderSidebarPageTree(myNotes, null, 0, false)}

                          <button
                            type="button"
                            onClick={() => void handleCreateNote(null, true)}
                            className="w-full flex items-center gap-2 px-2 py-1 rounded-md text-[13.5px] text-text-secondary/80 hover:bg-text-primary/[0.04] hover:text-text-primary transition"
                          >
                            <Plus className="w-4 h-4 shrink-0" />
                            <span className="truncate">Tambah baru</span>
                          </button>
                        </div>
                      );
                    }

                    if (secId === 'shared') {
                      return (
                        <div key="sec-shared" className="space-y-0.5">
                          <div className="px-2 py-0.5 text-[11.5px] font-medium text-text-secondary">
                            Dibagikan
                          </div>
                          {sharedWithMeNotes.length > 0 &&
                            renderSidebarPageTree(sharedWithMeNotes, null, 0, true)}
                          <button
                            type="button"
                            onClick={() => setShowShareModal(true)}
                            className="w-full flex items-center gap-2 px-2 py-1 rounded-md text-[13.5px] text-text-secondary/85 hover:bg-text-primary/[0.04] hover:text-text-primary transition"
                          >
                            <Plus className="w-4 h-4 shrink-0" />
                            <span className="truncate">Mulai berkolaborasi</span>
                          </button>
                        </div>
                      );
                    }

                    if (secId === 'apps') {
                      return (
                        <div key="sec-apps" className="space-y-0.5">
                          <div className="px-2 py-0.5 text-[11.5px] font-medium text-text-secondary">
                            Aplikasi Miu
                          </div>
                          <button
                            type="button"
                            onClick={() => setMainViewMode('calendar')}
                            className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-[13.5px] transition ${
                              mainViewMode === 'calendar'
                                ? 'bg-text-primary/[0.06] dark:bg-white/[0.08] font-medium text-text-primary'
                                : 'text-text-secondary hover:bg-text-primary/[0.04] hover:text-text-primary'
                            }`}
                          >
                            <span className="w-4 h-4 rounded-[4px] border border-border-subtle bg-surface flex items-center justify-center text-[9px] font-bold text-text-secondary shrink-0">
                              27
                            </span>
                            <span className="truncate">Miu Calendar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setMainViewMode('document')}
                            className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-[13.5px] transition ${
                              mainViewMode === 'document'
                                ? 'bg-text-primary/[0.06] dark:bg-white/[0.08] font-medium text-text-primary'
                                : 'text-text-secondary hover:bg-text-primary/[0.04] hover:text-text-primary'
                            }`}
                          >
                            <span className="w-4 h-4 rounded-[4px] border border-border-subtle bg-surface flex items-center justify-center text-[9px] font-bold text-text-secondary shrink-0">
                              M
                            </span>
                            <span className="truncate">Miu Desktop</span>
                          </button>
                        </div>
                      );
                    }

                    if (secId === 'developer') {
                      return (
                        <div key="sec-developer" className="space-y-0.5">
                          <button
                            type="button"
                            onClick={() => setShowCloudSettingsModal(true)}
                            className="w-full flex items-center justify-between px-2 py-0.5 rounded-md text-[11.5px] font-medium text-text-secondary hover:text-text-primary transition text-left"
                            title="Konfigurasi Cloud Catatan & Developer API"
                          >
                            <span>Developer</span>
                          </button>
                        </div>
                      );
                    }

                    return null;
                  })}
                </div>
              )}
            </div>

            {/* Sidebar Bottom Area: "Sesuaikan bilah sisi" / "Selesai" + User Profile Bar */}
            <div className="px-2.5 pt-1.5 pb-2 space-y-1.5 border-t border-border-subtle/70 bg-[#F7F7F5] dark:bg-subtle/75">
              {isCustomizeSidebar ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomizeSidebar(false);
                    setShowAddSidebarSection(false);
                  }}
                  className="w-full py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-[13px] font-semibold shadow-sm transition"
                >
                  Selesai
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsCustomizeSidebar(true)}
                  className="w-full flex items-center gap-2 px-2 py-1 rounded-md text-[12.5px] text-text-secondary hover:text-text-primary hover:bg-text-primary/[0.04] transition"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Sesuaikan bilah sisi</span>
                </button>
              )}

              {/* Bottom User Profile & Quick Icons Bar */}
              <div className="relative flex items-center justify-between gap-1 pt-1 border-t border-border-subtle/60">
                <button
                  type="button"
                  onClick={() => setShowUserMenu((v) => !v)}
                  className="flex items-center gap-1.5 px-1.5 py-1 rounded-md hover:bg-text-primary/[0.05] text-left min-w-0 flex-1 transition"
                >
                  {currentUser?.picture ? (
                    <img
                      src={currentUser.picture}
                      alt={currentUser.name}
                      className="w-5 h-5 rounded-md object-cover shrink-0 border border-border-subtle"
                    />
                  ) : (
                    <span className="text-sm leading-none shrink-0">🏠</span>
                  )}
                  <span className="text-[12.5px] font-medium text-text-primary truncate">
                    {currentUser?.name || 'Catatan Pribadi'}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-text-secondary shrink-0" />
                </button>

                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowShortcutsModal(true)}
                    className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-text-primary/[0.06] transition"
                    title="Pintasan keyboard (⌘/)"
                    aria-label="Pintasan keyboard"
                  >
                    <Keyboard className="w-3.5 h-3.5" />
                  </button>
                  <SidebarWhatsNewButton />
                  <SidebarQuickLauncherPopover
                    onOpenSkillLibrary={() => {
                      setPustakaSubTab('active');
                      setActiveSkillIdsState(loadActiveSkillNoteIds());
                      setMainViewMode('pustaka');
                    }}
                    onOpenKanban={() =>
                      setMainViewMode((prev) =>
                        prev === 'kanban' ? 'document' : 'kanban'
                      )
                    }
                    isKanbanActive={mainViewMode === 'kanban'}
                  />
                </div>

                {showUserMenu && (
                  <div className="absolute left-0 bottom-full mb-1.5 w-56 rounded-xl bg-surface border border-border-subtle shadow-2xl p-2 z-50 space-y-1 text-xs">
                    {currentUser && (
                      <div className="px-2 py-1 border-b border-border-subtle">
                        <p className="font-semibold text-text-primary truncate">
                          {currentUser.name}
                        </p>
                        <p className="text-[11px] text-text-secondary truncate">
                          {currentUser.email}
                        </p>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        setShowShortcutsModal(true);
                      }}
                      className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-subtle text-text-primary transition text-left"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Keyboard className="w-3.5 h-3.5 text-text-secondary" />
                        <span>Pintasan Keyboard</span>
                      </span>
                      <span className="text-[10px] font-mono text-text-secondary">⌘/</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        setShowCloudSettingsModal(true);
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-subtle text-text-primary transition text-left"
                    >
                      <Settings className="w-3.5 h-3.5 text-text-secondary" />
                      <span>
                        {neonActive ? 'Cloud Catatan (Aktif)' : 'Pengaturan Cloud'}
                      </span>
                    </button>
                    {currentUser && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowUserMenu(false);
                          logoutGoogleUser();
                        }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-rose-500/10 text-rose-500 transition text-left"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Keluar dari Google</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </aside>
        )}

        {/* Sliding Inbox Drawer attached to Left Sidebar (slides right to open, slides left to close, same width as sidebar) */}
        <SidebarInboxSlideDrawer
          isOpen={isInboxOpen && isSidebarOpen}
          onClose={() => setIsInboxOpen(false)}
          sidebarWidth={sidebarWidth}
          allNotes={allNotes}
          sharedWithMeNotes={sharedWithMeNotes}
          onSelectNote={(targetNoteId, openComments) => {
            openDocumentNote(targetNoteId);
            if (openComments) {
              setShowCommentsPanel(true);
            }
          }}
        />

        {/* =================================================================== */}
        {/* MAIN PANEL: CLEAN TOP NAVBAR + PUBLIC BANNER + DOCUMENT / PUSTAKA   */}
        {/* =================================================================== */}
        <div className="flex-1 min-w-0 min-h-screen flex flex-col bg-surface">
          {/* Minimal Sticky Top Navbar */}
          <header
            className={`sticky top-0 z-20 px-3 sm:px-4 ${
              hasTopIsland ? 'pt-[52px] pb-2' : 'h-11'
            } bg-surface/95 backdrop-blur-md border-b border-border-subtle/50 flex items-center justify-between gap-2 no-print`}
          >
            {/* Left: Sidebar Open Button + Breadcrumbs */}
            <div className="flex items-center gap-1 text-[13.5px] text-text-primary min-w-0 flex-1 overflow-x-auto">
              {!isSidebarOpen && (
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(true)}
                  className="p-1.5 rounded-md hover:bg-subtle text-text-secondary hover:text-text-primary transition shrink-0"
                  title="Buka bilah sisi (⌘\)"
                >
                  <PanelLeft className="w-4 h-4" />
                </button>
              )}

              {mainViewMode === 'kanban' ? (
                <div className="inline-flex items-center gap-1.5 font-medium text-text-primary px-1.5 py-0.5">
                  <Columns3 className="w-4 h-4 text-text-secondary" />
                  <span>Papan Kanban</span>
                </div>
              ) : mainViewMode === 'calendar' ? (
                <div className="inline-flex items-center gap-1.5 font-medium text-text-primary px-1.5 py-0.5">
                  <Calendar className="w-4 h-4 text-text-secondary" />
                  <span>Kalender &amp; Deadline</span>
                </div>
              ) : mainViewMode === 'pustaka' ? (
                <div className="inline-flex items-center gap-1.5 font-medium text-text-primary px-1.5 py-0.5">
                  <span>Pustaka</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-0.5 min-w-0">
                    {breadcrumbPath.map((crumb, idx) => {
                      const isLast = idx === breadcrumbPath.length - 1;
                      return (
                        <React.Fragment key={crumb.id}>
                          {idx > 0 && (
                            <span className="text-text-secondary/45 px-0.5 select-none">
                              /
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => openDocumentNote(crumb.id)}
                            className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-md truncate max-w-[180px] sm:max-w-[230px] transition ${
                              isLast
                                ? 'font-medium text-text-primary'
                                : 'text-text-secondary hover:bg-subtle hover:text-text-primary'
                            }`}
                          >
                            <span className="text-sm leading-none shrink-0">
                              {crumb.icon || '📄'}
                            </span>
                            <span className="truncate">
                              {crumb.title || 'Tanpa Judul'}
                            </span>
                          </button>
                        </React.Fragment>
                      );
                    })}
                  </div>

                  {isPageLocked && (
                    <button
                      type="button"
                      disabled={!hasEditPermission}
                      onClick={() => void updateNote({ isLocked: false })}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-500/12 text-amber-600 dark:text-amber-300 hover:bg-amber-500/20 shrink-0 transition"
                      title={
                        hasEditPermission
                          ? 'Halaman dikunci — Klik untuk membuka kunci'
                          : 'Halaman dikunci'
                      }
                    >
                      <Lock className="w-3 h-3" />
                      <span>Terkunci</span>
                    </button>
                  )}

                  {!isOwner && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-sky-500/12 text-sky-600 dark:text-sky-300 shrink-0">
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
                </>
              )}
            </div>

            {/* Right: Collaborators + Bagikan + Copy Active Link + Star + Corner Actions Menu */}
            <div className="flex items-center justify-end gap-0.5 sm:gap-1 text-[13.5px] shrink-0">
              {activeNote && (
                <CollaboratorsHeaderStrip
                  collaborators={remoteCollaborators}
                  onJumpToCollaborator={handleJumpToCollaborator}
                />
              )}

              {mainViewMode === 'document' && activeNote && (
                <>
                  {/* Bagikan Button (Also controls Comments, Download & Print) */}
                  <button
                    type="button"
                    onClick={() => setShowShareModal(true)}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[13.5px] font-medium text-text-primary hover:bg-subtle transition"
                    title="Bagikan halaman, aktifkan komentar, unduh & cetak"
                  >
                    <Globe className="w-4 h-4 text-text-primary" />
                    <span>Bagikan</span>
                  </button>

                  {/* Instant Active Link Copy Button (🔗) */}
                  <button
                    type="button"
                    onClick={() => void handleCopyActiveShareLink()}
                    className="p-1.5 rounded-md text-text-secondary hover:bg-subtle hover:text-text-primary transition"
                    title="Salin tautan (otomatis aktifkan tautan publik)"
                    aria-label="Salin tautan aktif"
                  >
                    {quickLinkCopied ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Link2 className="w-4 h-4" />
                    )}
                  </button>

                  {/* Favorite Star Button (☆) */}
                  {hasEditPermission && (
                    <button
                      type="button"
                      onClick={() =>
                        void updateNote({ isFavorite: !activeNote.isFavorite })
                      }
                      className={`p-1.5 rounded-md transition ${
                        activeNote.isFavorite
                          ? 'text-amber-500'
                          : 'text-text-secondary hover:bg-subtle hover:text-text-primary'
                      }`}
                      title={
                        activeNote.isFavorite
                          ? 'Hapus dari Favorit'
                          : 'Tambahkan ke Favorit'
                      }
                      aria-label="Favorit"
                    >
                      <Star
                        className={`w-4 h-4 ${
                          activeNote.isFavorite ? 'fill-current' : ''
                        }`}
                      />
                    </button>
                  )}

                  {/* Top-Right Corner Hamburger / More Actions Menu (image_2 & image_3) */}
                  <PageActionsMenu
                    note={activeNote}
                    allNotes={myNotes}
                    canEdit={hasEditPermission}
                    isOwner={isOwner}
                    fontStyle={activeFontStyle}
                    isSmallText={isSmallText}
                    isFullWidth={Boolean(activeNote.isFullWidth)}
                    showTocOutline={showTocOutline}
                    showCommentsPanel={showCommentsPanel}
                    isLocked={isPageLocked}
                    onCopyActiveShareLink={handleCopyActiveShareLink}
                    onCopyPageContent={handleCopyPageContent}
                    onDuplicateNote={() => {
                      const fakeEvent = {
                        stopPropagation: () => {}
                      } as React.MouseEvent;
                      void handleDuplicateNote(activeNote, fakeEvent);
                    }}
                    onMoveNoteToParent={(targetParentId) =>
                      void handleMoveNoteParent(activeNote.id, targetParentId)
                    }
                    onChangeFontStyle={(nextStyle) =>
                      void updateNote({ fontStyle: nextStyle })
                    }
                    onToggleSmallText={() =>
                      void updateNote({ isSmallText: !isSmallText })
                    }
                    onToggleFullWidth={() => {
                      const autoWide = activeNote.blocks.some(
                        (b) => b.type === 'columns' && (b.columns?.length || 0) >= 4
                      );
                      const currentlyWide =
                        activeNote.isFullWidth !== undefined
                          ? activeNote.isFullWidth
                          : autoWide;
                      void updateNote({ isFullWidth: !currentlyWide });
                    }}
                    onToggleTocOutline={() => setShowTocOutline((v) => !v)}
                    onToggleCommentsPanel={() => setShowCommentsPanel((v) => !v)}
                    onToggleLockPage={() =>
                      void updateNote({ isLocked: !isPageLocked })
                    }
                    onOpenAIDrawer={() => setIsAIDrawerOpen(true)}
                    onDeleteNote={() => {
                      const fakeEvent = {
                        stopPropagation: () => {}
                      } as React.MouseEvent;
                      void handleDeleteNote(activeNote, fakeEvent);
                    }}
                    onExportMarkdown={handleExportMarkdown}
                    onPrintPdf={() => window.print()}
                  />
                </>
              )}
            </div>
          </header>

          {/* Public Link Active Info Banner below Navbar (image.png & image_4.png) */}
          {mainViewMode === 'document' &&
            activeNote?.shareSettings?.isPublicLink && (
              <div
                onClick={() => setShowShareModal(true)}
                className="w-full bg-sky-500/10 dark:bg-sky-500/15 border-b border-sky-500/20 py-1.5 px-4 text-center text-[12.5px] font-medium text-sky-600 dark:text-sky-300 flex items-center justify-center gap-1.5 cursor-pointer hover:bg-sky-500/15 transition no-print"
              >
                <span>
                  Halaman ini dapat dilihat oleh siapa pun yang memiliki tautan.
                </span>
                <Info className="w-3.5 h-3.5 shrink-0" />
              </div>
            )}

          {mainViewMode === 'kanban' ? (
            <KanbanBoardView
              notes={
                searchQuery.trim()
                  ? visibleNotes
                  : [...myNotes, ...sharedWithMeNotes]
              }
              allNotes={allNotes}
              activeNoteId={activeNoteId}
              canCreateRoot={Boolean(currentUser)}
              canMoveNote={(n) => {
                const perm = resolveNotePermission(n);
                return perm === 'owner' || perm === 'edit';
              }}
              isOwnerNote={(n) =>
                !n.ownerId || Boolean(currentUser && n.ownerId === currentUser.id)
              }
              onOpenNote={(id) => openDocumentNote(id)}
              onCreateNoteInStatus={(status) => void handleCreateNote(null, true, status)}
              onMoveNoteStatus={(id, status) =>
                void handleMoveNoteKanbanStatus(id, status)
              }
              onDuplicateNote={(n, e) => void handleDuplicateNote(n, e)}
              onDeleteNote={(n, e) => void handleDeleteNote(n, e)}
              onToggleFavorite={(n, e) => {
                e.stopPropagation();
                const perm = resolveNotePermission(n);
                if (perm !== 'owner' && perm !== 'edit') return;
                const updatedAt = Date.now();
                void db.notes.update(n.id, { isFavorite: !n.isFavorite, updatedAt });
                scheduleNeonSave({ ...n, isFavorite: !n.isFavorite, updatedAt });
              }}
            />
          ) : mainViewMode === 'calendar' ? (
            <CalendarBoardView
              notes={
                searchQuery.trim()
                  ? visibleNotes
                  : [...myNotes, ...sharedWithMeNotes]
              }
              canCreateRoot={Boolean(currentUser)}
              canEditNote={(n) => {
                const perm = resolveNotePermission(n);
                return perm === 'owner' || perm === 'edit';
              }}
              onOpenNote={(id) => openDocumentNote(id)}
              onCreateNoteOnDate={(dueDate) =>
                void handleCreateNote(null, true, 'todo', dueDate)
              }
              onToggleTodoDeadline={(noteId, blockId, nextChecked) =>
                void handleToggleTodoDeadlineFromCalendar(noteId, blockId, nextChecked)
              }
              onSaveGoogleSyncId={(params) => handleSaveGoogleSyncIdFromCalendar(params)}
            />
          ) : mainViewMode === 'pustaka' ? (
            <PustakaPageView
              allNotes={allNotes}
              myNotes={myNotes}
              sharedWithMeNotes={sharedWithMeNotes}
              favoriteNotes={favoriteNotes}
              activeSkillIds={activeSkillIdsState}
              onToggleSkillActive={(skillNoteId) => {
                setActiveSkillIdsState((prev) => {
                  const next = prev.includes(skillNoteId)
                    ? prev.filter((id) => id !== skillNoteId)
                    : [...prev, skillNoteId];
                  saveActiveSkillNoteIds(next);
                  return next;
                });
              }}
              onSkillInstalled={(installedNote) => {
                setActiveSkillIdsState((prev) => {
                  const next = prev.includes(installedNote.id)
                    ? prev
                    : [...prev, installedNote.id];
                  saveActiveSkillNoteIds(next);
                  return next;
                });
                openDocumentNote(installedNote.id);
              }}
              onOpenNote={(noteId) => openDocumentNote(noteId)}
              onOpenAIDrawer={() => setIsAIDrawerOpen(true)}
              initialSubTab={pustakaSubTab}
              ownerId={currentUser?.id}
              ownerEmail={currentUser?.email}
              ownerName={currentUser?.name}
              semesterId={activeNote?.semesterId || activeSemesterId || 'sem-1'}
              courseId={activeNote?.courseId || activeCourseId || 'course-default'}
            />
          ) : activeNote ? (
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

              {/* Clean Blank Notion Page Container + Right-Center Floating TOC */}
              <div className="flex-1 flex items-start relative">
                <div
                  style={{ fontFamily: noteFontFamily }}
                  className={`w-full mx-auto pt-8 sm:pt-12 pb-24 flex-1 flex flex-col transition-all ${
                    activeNote.isFullWidth
                      ? 'max-w-6xl pl-4 pr-4 sm:pl-20 sm:pr-12'
                      : activeNote.isFullWidth === undefined &&
                          activeNote.blocks.some(
                            (b) => b.type === 'columns' && (b.columns?.length || 0) >= 4
                          )
                        ? 'max-w-5xl pl-4 pr-4 sm:pl-20 sm:pr-12'
                        : 'max-w-3xl pl-5 pr-5 sm:pl-20 sm:pr-16'
                  }`}
                >
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

                  {/* Page Icon + Subtle Hover Actions (Tambah sampul / Tambah komentar) + Title */}
                  <div className="group relative mb-2">
                    <div className="flex flex-col items-start gap-1.5 mb-2">
                      <div className="relative">
                        <button
                          type="button"
                          disabled={!canEdit}
                          onClick={() => setShowIconPicker((v) => !v)}
                          className={`text-5xl sm:text-6xl leading-none p-1 -ml-1 rounded-xl transition select-none ${
                            canEdit ? 'hover:bg-subtle cursor-pointer' : 'cursor-default'
                          } ${activeNote.cover ? '-mt-12 bg-surface shadow-sm' : ''}`}
                          title={canEdit ? 'Ganti ikon halaman' : undefined}
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

                      {/* Subtle Page Controls Row (matching image.png: Add cover / Add comment) */}
                      <div className="opacity-0 group-hover:opacity-100 transition flex items-center gap-2 text-xs text-text-secondary/80 no-print">
                        {canEdit && !activeNote.cover && (
                          <button
                            type="button"
                            onClick={() => void updateNote({ cover: COVER_PRESETS[0].css })}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-subtle hover:text-text-primary transition"
                          >
                            <span>🖼️</span>
                            <span>Tambah sampul</span>
                          </button>
                        )}
                        {canComment && (
                          <button
                            type="button"
                            onClick={() => setShowCommentsPanel(true)}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-subtle hover:text-text-primary transition"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Tambah komentar</span>
                          </button>
                        )}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => void handleCreateNote(activeNote.id, true)}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-subtle hover:text-text-primary transition"
                          >
                            <FilePlus2 className="w-3.5 h-3.5" />
                            <span>Tambah subhalaman</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Notion Page Title */}
                    {(() => {
                      const titleCollaborators = collaboratorsByBlockId['__title__'] || [];
                      const titlePointers = pointersByBlockId['__title__'] || [];
                      const primaryTitleCollab = titleCollaborators[0];
                      const isTitleJumpHighlighted = jumpHighlightBlockId === '__title__';
                      const titleSizeClass = isSmallText
                        ? 'text-[28px] sm:text-[32px] leading-[1.2]'
                        : 'text-[32px] sm:text-[40px] leading-[1.18]';

                      const reportTitleCursor = (
                        el: HTMLInputElement,
                        isEditing: boolean,
                        immediate = false
                      ) => {
                        const start =
                          typeof el.selectionStart === 'number'
                            ? el.selectionStart
                            : el.value.length;
                        const end =
                          typeof el.selectionEnd === 'number' ? el.selectionEnd : start;
                        reportLocalCursor({
                          noteId: activeNote.id,
                          blockId: '__title__',
                          field: 'title',
                          selectionStart: start,
                          selectionEnd: end,
                          isEditing,
                          immediate
                        });
                      };

                      return (
                        <div
                          data-miu-title-wrap="true"
                          onMouseMove={(e) => {
                            if (mainViewMode !== 'document') return;
                            const rect = e.currentTarget.getBoundingClientRect();
                            if (rect.width <= 0 || rect.height <= 0) return;
                            reportLocalPointer({
                              noteId: activeNote.id,
                              pointerBlockId: '__title__',
                              pointerX: normalizePointerCoordinate(
                                (e.clientX - rect.left) / rect.width
                              ),
                              pointerY: normalizePointerCoordinate(
                                (e.clientY - rect.top) / rect.height
                              )
                            });
                          }}
                          onMouseLeave={() =>
                            reportLocalPointer({
                              noteId: activeNote.id,
                              pointerBlockId: null,
                              pointerX: null,
                              pointerY: null
                            })
                          }
                          style={
                            primaryTitleCollab
                              ? {
                                  boxShadow: isTitleJumpHighlighted
                                    ? `inset 4px 0 0 ${primaryTitleCollab.color}, 0 0 0 2px ${primaryTitleCollab.color}88`
                                    : `inset 3px 0 0 ${primaryTitleCollab.color}, 0 0 0 1px ${primaryTitleCollab.color}36`,
                                  backgroundColor: `${primaryTitleCollab.color}0D`
                                }
                              : isTitleJumpHighlighted
                                ? {
                                    boxShadow: '0 0 0 2px rgba(56, 189, 248, 0.7)'
                                  }
                                : undefined
                          }
                          className="relative rounded-xl px-1 -mx-1 py-0.5 transition"
                        >
                          {titleCollaborators.length > 0 && (
                            <BlockCollaboratorBadges
                              collaborators={titleCollaborators}
                              contentText={activeNote.title}
                            />
                          )}
                          {titlePointers.length > 0 && (
                            <BlockCollaboratorPointers pointers={titlePointers} />
                          )}
                          <input
                            ref={(el) => {
                              titleInputRef.current = el;
                              setCaretHostRef('__title__', 'title', el);
                            }}
                            type="text"
                            readOnly={!canEdit}
                            value={activeNote.title}
                            onFocus={(e) => reportTitleCursor(e.currentTarget, canEdit, true)}
                            onInput={(e) => reportTitleCursor(e.currentTarget, canEdit, false)}
                            onClick={(e) => reportTitleCursor(e.currentTarget, canEdit, false)}
                            onKeyUp={(e) => reportTitleCursor(e.currentTarget, canEdit, false)}
                            onSelect={(e) => reportTitleCursor(e.currentTarget, canEdit, false)}
                            onBlur={(e) => reportTitleCursor(e.currentTarget, false, false)}
                            onChange={(e) => void updateNote({ title: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && canEdit) {
                                e.preventDefault();
                                if (activeNote.blocks[0]) {
                                  setPendingFocusBlockId(activeNote.blocks[0].id);
                                } else {
                                  void handleAddBlockAfter(undefined, 'text');
                                }
                              } else if (e.key === 'ArrowDown' && activeNote.blocks[0]) {
                                e.preventDefault();
                                setPendingFocusBlockId(activeNote.blocks[0].id);
                              }
                            }}
                            placeholder="Tanpa Judul"
                            className={`w-full bg-transparent ${titleSizeClass} font-bold tracking-tight text-text-primary placeholder:text-text-secondary/30 focus:outline-none`}
                          />
                          {titleCollaborators.length > 0 && (
                            <CollaboratorCaretOverlay
                              hostRefs={caretHostRefs}
                              hostKey="__title__:title"
                              layoutKey="title"
                              text={activeNote.title}
                              field="title"
                              collaborators={titleCollaborators}
                            />
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Multi-Select Action Bar when blocks are selected via gutter checkboxes */}
                  {(isSelectMode || selectedBlockIds.length > 0) && (
                    <div
                      className={`sticky ${
                        hasTopIsland ? 'top-[96px]' : 'top-14'
                      } z-20 mb-3 p-2.5 rounded-2xl bg-surface/95 backdrop-blur-md border border-rose-400/40 shadow-lg flex flex-wrap items-center justify-between gap-2 no-print`}
                    >
                      <div className="flex items-center gap-2 text-xs">
                        <span className="px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-600 dark:text-rose-300 font-bold font-mono">
                          {selectedBlockIds.length} dipilih
                        </span>
                        <span className="text-[11px] text-text-secondary hidden sm:inline">
                          Klik kotak centang blok, atau tahan <strong>Shift + Klik</strong> untuk memilih rentang.
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
                  <div
                    className="space-y-1 mt-3 flex-1"
                    onMouseLeave={() =>
                      reportLocalPointer({
                        noteId: activeNote.id,
                        pointerBlockId: null,
                        pointerX: null,
                        pointerY: null
                      })
                    }
                  >
                    {(() => {
                      let rootNumber = 0;
                      return activeNote.blocks.map((block) => {
                        if (block.type === 'numbered') rootNumber += 1;
                        else rootNumber = 0;
                        return renderBlockRow(block, rootNumber);
                      });
                    })()}

                    {/* Clickable Blank Area Below Blocks */}
                    {canEdit && (
                      <div
                        onClick={() => void handleAddBlockAfter(undefined, 'text')}
                        className="flex-1 min-h-[120px] cursor-text"
                      />
                    )}
                  </div>

                  {/* Child Subpages Summary Section inside Current Page */}
                  {childSubpages.length > 0 && (
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

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {childSubpages.map((sub) => (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => setActiveNoteId(sub.id)}
                            className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-subtle/55 hover:bg-subtle border border-border-subtle hover:border-accent-strong/60 text-left transition group/subcard"
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
                    </div>
                  )}

                  {/* Comments Section (Enabled via Bagikan or Tampilan & tata letak) */}
                  {(showCommentsPanel ||
                    effectiveRole === 'comment' ||
                    (activeNote.comments && activeNote.comments.length > 0)) && (
                    <div className="mt-6 pt-5 border-t border-border-subtle space-y-3 no-print">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-text-primary">
                          <MessageSquare className="w-4 h-4 text-amber-500" />
                          <span>Diskusi &amp; Komentar Halaman ({activeNote.comments?.length || 0})</span>
                        </span>
                        {showCommentsPanel && (
                          <button
                            type="button"
                            onClick={() => setShowCommentsPanel(false)}
                            className="text-[11px] text-text-secondary hover:text-text-primary"
                          >
                            Sembunyikan
                          </button>
                        )}
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
                            placeholder="Tambahkan komentar di halaman ini..."
                            className="flex-1 bg-subtle border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent-strong"
                          />
                          <button
                            type="submit"
                            disabled={!newCommentText.trim()}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold disabled:opacity-40 transition shrink-0"
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

                {/* Right-Center Floating Daftar Isi List (kanan tengah) */}
                <FloatingTocOutline
                  blocks={activeNote.blocks}
                  noteTitle={activeNote.title}
                  isOpen={showTocOutline}
                  hasTopIsland={hasTopIsland}
                  isAIDrawerOpen={isAIDrawerOpen}
                  onToggleOpen={() => setShowTocOutline((v) => !v)}
                  onSelectBlock={(blkId) => scrollToBlockById(blkId)}
                />
              </div>

              {/* Bottom Metadata Strip (toggleable via ⌘⇧.) */}
              {showMetadataFooter && (
                <footer className="sticky bottom-0 z-10 px-4 py-1 bg-surface/95 backdrop-blur-sm border-t border-border-subtle/60 flex items-center justify-between gap-3 text-[10px] font-mono text-text-secondary/80 overflow-x-auto no-print">
                  <div className="flex items-center gap-4 min-w-0">
                    {(
                      [
                        {
                          key: 'user',
                          label: 'PENGGUNA',
                          val: currentUser?.id || 'local-guest'
                        },
                        {
                          key: 'workspace',
                          label: 'RUANG KERJA',
                          val: activeCourseId || 'workspace-main'
                        },
                        {
                          key: 'page',
                          label: 'HALAMAN',
                          val: activeNote.id
                        },
                        {
                          key: 'block',
                          label: 'BLOK',
                          val:
                            activeBlockTarget?.blockId ||
                            activeNote.blocks[0]?.id ||
                            'blk-root'
                        }
                      ] as const
                    ).map((meta) => (
                      <button
                        key={meta.key}
                        type="button"
                        onClick={() => {
                          void navigator.clipboard.writeText(meta.val);
                          setCopiedMetaField(meta.key);
                          window.setTimeout(
                            () =>
                              setCopiedMetaField((prev) =>
                                prev === meta.key ? null : prev
                              ),
                            1500
                          );
                        }}
                        className="inline-flex items-center gap-1 hover:text-text-primary transition shrink-0"
                        title={`Salin ID ${meta.label}: ${meta.val}`}
                      >
                        <span className="font-semibold text-text-secondary/65">
                          {meta.label}
                        </span>
                        <span className="truncate max-w-[110px]">{meta.val}</span>
                        {copiedMetaField === meta.key ? (
                          <Check className="w-2.5 h-2.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-2.5 h-2.5 opacity-60" />
                        )}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMetadataFooter(false);
                      try {
                        window.localStorage.setItem('miu_show_metadata_footer', 'false');
                      } catch {
                        // ignore
                      }
                      showShortcutFeedback(
                        'Bilah info bawah disembunyikan (tekan ⌘⇧. untuk menampilkan)'
                      );
                    }}
                    title="Sembunyikan bilah info bawah (⌘⇧.)"
                    className="text-[10px] text-text-secondary/70 hover:text-text-primary px-1.5 py-0.5 rounded hover:bg-subtle shrink-0 transition"
                  >
                    ⌘⇧.
                  </button>
                </footer>
              )}
            </div>
          ) : (
            <div className="py-20 text-center space-y-3 my-auto">
              <FileText className="w-7 h-7 text-text-secondary mx-auto opacity-50" />
              <button
                type="button"
                onClick={() => void handleCreateNote(null, true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 text-white text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                Halaman Baru
              </button>
            </div>
          )}
        </div>

        {/* Right Side Peek Panel (resizable width on left edge, matches image_3.png & image_4.png) */}
        <SidePeekPanel
          note={sidePeekNote}
          allNotes={allNotes}
          onClose={() => setSidePeekNoteId(null)}
          onExpandToFullPage={(nId) => openDocumentNote(nId)}
          onOpenNoteInSidePeek={(nId) => setSidePeekNoteId(nId)}
          onUpdateSidePeekNote={handleUpdateSpecificNote}
          onCopyLink={handleCopySpecificNoteLink}
          onDuplicate={(targetNote) => {
            const fakeEvent = { stopPropagation: () => {} } as React.MouseEvent;
            void handleDuplicateNote(targetNote, fakeEvent);
          }}
          onDelete={(targetNote) => {
            const fakeEvent = { stopPropagation: () => {} } as React.MouseEvent;
            void handleDeleteNote(targetNote, fakeEvent);
          }}
        />
      </div>

      {/* Sidebar Note ••• / Right-Click Context Menu (matches image_2.png) */}
      <SidebarNoteContextMenu
        target={sidebarNoteMenuTarget}
        allNotes={allNotes}
        currentUserName={currentUser?.name}
        onClose={() => setSidebarNoteMenuTarget(null)}
        onToggleFavorite={(targetNote) => {
          void handleUpdateSpecificNote(targetNote.id, {
            isFavorite: !targetNote.isFavorite
          });
        }}
        onCopyLink={handleCopySpecificNoteLink}
        onDuplicate={(targetNote) => {
          const fakeEvent = { stopPropagation: () => {} } as React.MouseEvent;
          void handleDuplicateNote(targetNote, fakeEvent);
        }}
        onRename={(targetNote, newTitle, newIcon) => {
          void handleUpdateSpecificNote(targetNote.id, {
            title: newTitle,
            ...(newIcon ? { icon: newIcon } : {})
          });
        }}
        onMoveToParent={(noteId, newParentId) => {
          void handleMoveNoteParent(noteId, newParentId);
        }}
        onDelete={(targetNote) => {
          const fakeEvent = { stopPropagation: () => {} } as React.MouseEvent;
          void handleDeleteNote(targetNote, fakeEvent);
        }}
        onToggleWiki={(targetNote) => {
          void handleToggleWikiOnNote(targetNote);
        }}
        onOpenInNewTab={handleOpenNoteInNewTab}
        onOpenInSidePeek={(targetNote) => {
          setSidePeekNoteId(targetNote.id);
        }}
      />

      {/* Share, Comments & Export Modal */}
      {showShareModal && activeNote && (
        <ShareNoteModal
          note={activeNote}
          isOwner={isOwner}
          showCommentsPanel={showCommentsPanel}
          onToggleCommentsPanel={() => setShowCommentsPanel((v) => !v)}
          onExportMarkdown={handleExportMarkdown}
          onPrintPdf={() => window.print()}
          onUpdateShareSettings={handleUpdateShareSettings}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {/* Keyboard Shortcuts Reference Modal (⌘/) */}
      <KeyboardShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />

      {/* Floating Shortcut Feedback Toast */}
      {shortcutToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[130] px-3.5 py-2 rounded-xl bg-slate-900/95 dark:bg-slate-800/95 text-white text-xs font-medium shadow-2xl border border-white/10 flex items-center gap-2 pointer-events-none no-print"
        >
          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{shortcutToast}</span>
        </div>
      )}
    </>
  );
};
