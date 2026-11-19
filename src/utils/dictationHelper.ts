import type {
  ActiveBlockTarget,
  BlockType,
  NoteBlock,
  NoteRecord,
  SharePermission
} from '../types/miu';
import {
  appendBlockToColumn,
  createBlockId,
  findBlockLocation,
  insertBlocksRelativeDeep,
  mapBlockDeep
} from './blockTreeHelper';

export const TEXT_EDITABLE_BLOCK_TYPES = new Set<BlockType>([
  'text',
  'h1',
  'h2',
  'h3',
  'bullet',
  'numbered',
  'todo',
  'deadline',
  'toggle',
  'callout',
  'code',
  'math',
  'quote'
]);

export function isTextEditableBlockType(type: BlockType): boolean {
  return TEXT_EDITABLE_BLOCK_TYPES.has(type);
}

export function getBlockTypeLabel(type?: BlockType): string {
  switch (type) {
    case 'h1':
      return 'Heading 1';
    case 'h2':
      return 'Heading 2';
    case 'h3':
      return 'Heading 3';
    case 'bullet':
      return 'Bullet List';
    case 'numbered':
      return 'Numbered List';
    case 'todo':
      return 'To-do';
    case 'deadline':
      return 'Deadline';
    case 'toggle':
      return 'Toggle';
    case 'callout':
      return 'Callout';
    case 'code':
      return 'Kode';
    case 'math':
      return 'Rumus';
    case 'quote':
      return 'Kutipan';
    case 'columns':
      return 'Kolom';
    case 'image':
      return 'Gambar';
    case 'video':
      return 'Video';
    case 'link':
      return 'Tautan';
    case 'pdf':
      return 'PDF';
    case 'subpage':
      return 'Subhalaman';
    case 'database':
      return 'Database';
    case 'chart':
      return 'Diagram';
    case 'form':
      return 'Formulir';
    case 'metric':
      return 'Metrik';
    case 'divider':
      return 'Pemisah';
    default:
      return 'Paragraf';
  }
}

/**
 * Splices dictated text into existing block content at the specified caret / selection range,
 * preserving natural whitespace around the insertion point.
 */
export function spliceDictationText(
  existing: string,
  incoming: string,
  selectionStart?: number,
  selectionEnd?: number
): { content: string; caret: number } {
  const cleanIncoming = incoming.trim();
  if (!cleanIncoming) {
    return { content: existing, caret: existing.length };
  }

  if (!existing.trim()) {
    return { content: cleanIncoming, caret: cleanIncoming.length };
  }

  const hasStart = typeof selectionStart === 'number' && Number.isFinite(selectionStart);
  const start = hasStart
    ? Math.max(0, Math.min(existing.length, Math.floor(selectionStart)))
    : existing.length;
  const hasEnd = typeof selectionEnd === 'number' && Number.isFinite(selectionEnd);
  const end = hasEnd
    ? Math.max(start, Math.min(existing.length, Math.floor(selectionEnd)))
    : start;

  const before = existing.slice(0, start);
  const after = existing.slice(end);

  const needsLeadingSpace =
    before.length > 0 &&
    !/[\s(\["'“‘\n/-]$/.test(before) &&
    !/^[,.;:!?)\]"'”’\s]/.test(cleanIncoming);

  const needsTrailingSpace =
    after.length > 0 &&
    !/^[\s,.;:!?)\]"'”’\n]/.test(after) &&
    !/\s$/.test(cleanIncoming);

  const leading = needsLeadingSpace ? ' ' : '';
  const trailing = needsTrailingSpace ? ' ' : '';
  const nextText = `${before}${leading}${cleanIncoming}${trailing}${after}`;
  const nextCaret = before.length + leading.length + cleanIncoming.length;

  return { content: nextText, caret: nextCaret };
}

export interface DictationApplyResult {
  blocks: NoteBlock[];
  targetBlockId: string;
  field: 'content' | 'toggleBody';
  caret: number;
  mode: 'updated' | 'inserted_after' | 'appended';
}

/**
 * Applies dictated text into the currently targeted/selected block (including inside columns
 * or toggle body), inserts right after a selected non-text block, or falls back to filling an
 * initial blank block / appending at the end when no block is targeted.
 */
export function applyDictationToBlocks(
  blocks: NoteBlock[],
  dictatedText: string,
  target?: Pick<ActiveBlockTarget, 'blockId' | 'field' | 'selectionStart' | 'selectionEnd'> | null
): DictationApplyResult {
  const cleanText = dictatedText.trim();
  const loc = target?.blockId ? findBlockLocation(blocks, target.blockId) : undefined;

  if (loc) {
    if (isTextEditableBlockType(loc.block.type)) {
      if (loc.block.type === 'toggle' && target?.field === 'toggleBody') {
        const { content, caret } = spliceDictationText(
          loc.block.toggleBody || '',
          cleanText,
          target.selectionStart,
          target.selectionEnd
        );
        const updatedBlocks = mapBlockDeep(blocks, loc.block.id, (b) => ({
          ...b,
          toggleOpen: true,
          toggleBody: content
        }));
        return {
          blocks: updatedBlocks,
          targetBlockId: loc.block.id,
          field: 'toggleBody',
          caret,
          mode: 'updated'
        };
      }

      const { content, caret } = spliceDictationText(
        loc.block.content || '',
        cleanText,
        target?.selectionStart,
        target?.selectionEnd
      );
      const updatedBlocks = mapBlockDeep(blocks, loc.block.id, (b) => ({
        ...b,
        content
      }));
      return {
        blocks: updatedBlocks,
        targetBlockId: loc.block.id,
        field: 'content',
        caret,
        mode: 'updated'
      };
    }

    if (loc.block.type === 'columns' && Array.isArray(loc.block.columns) && loc.block.columns.length > 0) {
      const firstCol = loc.block.columns[0];
      const inner = firstCol.blocks || [];
      const lastInner = inner[inner.length - 1];
      if (lastInner && lastInner.type === 'text' && !lastInner.content.trim()) {
        const updatedBlocks = mapBlockDeep(blocks, lastInner.id, (b) => ({
          ...b,
          content: cleanText
        }));
        return {
          blocks: updatedBlocks,
          targetBlockId: lastInner.id,
          field: 'content',
          caret: cleanText.length,
          mode: 'updated'
        };
      }

      const newBlock: NoteBlock = {
        id: createBlockId(),
        type: 'text',
        content: cleanText
      };
      const updatedBlocks = appendBlockToColumn(blocks, loc.block.id, firstCol.id, newBlock);
      return {
        blocks: updatedBlocks,
        targetBlockId: newBlock.id,
        field: 'content',
        caret: cleanText.length,
        mode: 'inserted_after'
      };
    }

    const newBlock: NoteBlock = {
      id: createBlockId(),
      type: 'text',
      content: cleanText
    };
    const updatedBlocks = insertBlocksRelativeDeep(blocks, loc.block.id, 'after', [newBlock]);
    return {
      blocks: updatedBlocks,
      targetBlockId: newBlock.id,
      field: 'content',
      caret: cleanText.length,
      mode: 'inserted_after'
    };
  }

  // Fallback when no block was selected/focused
  if (blocks.length === 1 && blocks[0].type === 'text' && !blocks[0].content.trim()) {
    const updatedBlocks = mapBlockDeep(blocks, blocks[0].id, (b) => ({
      ...b,
      content: cleanText
    }));
    return {
      blocks: updatedBlocks,
      targetBlockId: blocks[0].id,
      field: 'content',
      caret: cleanText.length,
      mode: 'updated'
    };
  }

  const newBlock: NoteBlock = {
    id: createBlockId(),
    type: 'text',
    content: cleanText
  };
  return {
    blocks: [...blocks, newBlock],
    targetBlockId: newBlock.id,
    field: 'content',
    caret: cleanText.length,
    mode: 'appended'
  };
}

/**
 * Resolves effective permission (matching BlockEditor's ancestor-inherited permission model).
 */
export function resolveNoteEffectivePermission(
  targetNote: NoteRecord,
  allNotes: NoteRecord[],
  currentUser: { id: string; email: string } | null
): 'owner' | SharePermission {
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
}
