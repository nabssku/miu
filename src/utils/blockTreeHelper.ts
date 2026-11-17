import type { NoteBlock, NoteColumn } from '../types/miu';

export function createBlockId(prefix = 'blk'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export interface BlockLocation {
  block: NoteBlock;
  container: 'root' | 'column';
  columnsBlockId?: string;
  columnId?: string;
  index: number;
}

/**
 * Returns a flat array of all blocks in a note, including blocks nested inside `columns`.
 */
export function flattenBlocks(blocks: NoteBlock[] | undefined): NoteBlock[] {
  if (!blocks || blocks.length === 0) return [];
  const result: NoteBlock[] = [];
  for (const blk of blocks) {
    result.push(blk);
    if (blk.type === 'columns' && Array.isArray(blk.columns)) {
      for (const col of blk.columns) {
        if (Array.isArray(col.blocks)) {
          result.push(...flattenBlocks(col.blocks));
        }
      }
    }
  }
  return result;
}

/**
 * Finds a block by ID anywhere in the note's block tree (top-level or inside columns).
 */
export function findBlockById(
  blocks: NoteBlock[] | undefined,
  blockId: string
): NoteBlock | undefined {
  return findBlockLocation(blocks, blockId)?.block;
}

/**
 * Finds a block along with its container location (`root` or specific `column`).
 */
export function findBlockLocation(
  blocks: NoteBlock[] | undefined,
  blockId: string
): BlockLocation | undefined {
  if (!blocks) return undefined;
  for (let i = 0; i < blocks.length; i += 1) {
    const blk = blocks[i];
    if (blk.id === blockId) {
      return { block: blk, container: 'root', index: i };
    }
    if (blk.type === 'columns' && Array.isArray(blk.columns)) {
      for (const col of blk.columns) {
        const inner = col.blocks || [];
        for (let j = 0; j < inner.length; j += 1) {
          if (inner[j].id === blockId) {
            return {
              block: inner[j],
              container: 'column',
              columnsBlockId: blk.id,
              columnId: col.id,
              index: j
            };
          }
        }
      }
    }
  }
  return undefined;
}

/**
 * Immutably updates a block matching `blockId` anywhere in the block tree.
 */
export function mapBlockDeep(
  blocks: NoteBlock[],
  blockId: string,
  updater: (block: NoteBlock) => NoteBlock
): NoteBlock[] {
  return blocks.map((blk) => {
    if (blk.id === blockId) {
      return updater(blk);
    }
    if (blk.type === 'columns' && Array.isArray(blk.columns)) {
      let changed = false;
      const nextColumns = blk.columns.map((col) => {
        const inner = col.blocks || [];
        if (!inner.some((b) => b.id === blockId)) return col;
        changed = true;
        return {
          ...col,
          blocks: inner.map((b) => (b.id === blockId ? updater(b) : b))
        };
      });
      return changed ? { ...blk, columns: nextColumns } : blk;
    }
    return blk;
  });
}

/**
 * Inserts one or more blocks before or after `targetId` (whether top-level or inside a column).
 */
export function insertBlocksRelativeDeep(
  blocks: NoteBlock[],
  targetId: string,
  position: 'before' | 'after',
  newBlocks: NoteBlock[]
): NoteBlock[] {
  if (newBlocks.length === 0) return blocks;

  const rootIdx = blocks.findIndex((b) => b.id === targetId);
  if (rootIdx !== -1) {
    const copy = [...blocks];
    copy.splice(position === 'before' ? rootIdx : rootIdx + 1, 0, ...newBlocks);
    return copy;
  }

  return blocks.map((blk) => {
    if (blk.type !== 'columns' || !Array.isArray(blk.columns)) return blk;
    let changed = false;
    const nextCols = blk.columns.map((col) => {
      const inner = col.blocks || [];
      const idx = inner.findIndex((b) => b.id === targetId);
      if (idx === -1) return col;
      changed = true;
      const copy = [...inner];
      const safeInsert = newBlocks.filter((nb) => nb.type !== 'columns');
      copy.splice(position === 'before' ? idx : idx + 1, 0, ...safeInsert);
      return { ...col, blocks: copy };
    });
    return changed ? { ...blk, columns: nextCols } : blk;
  });
}

/**
 * Appends a block to the end of a specific column inside a `columns` block.
 */
export function appendBlockToColumn(
  blocks: NoteBlock[],
  columnsBlockId: string,
  columnId: string,
  newBlock: NoteBlock
): NoteBlock[] {
  if (newBlock.type === 'columns') return blocks;
  return mapBlockDeep(blocks, columnsBlockId, (colContainer) => {
    const nextCols = (colContainer.columns || []).map((col) => {
      if (col.id !== columnId) return col;
      const inner = col.blocks || [];
      const base =
        inner.length === 1 && inner[0].type === 'text' && !inner[0].content.trim() ? [] : inner;
      return { ...col, blocks: [...base, newBlock] };
    });
    return { ...colContainer, columns: nextCols };
  });
}

/**
 * Removes a block by ID anywhere in the tree. Keeps at least 1 empty text block in a column or root.
 */
export function removeBlockDeep(
  blocks: NoteBlock[],
  blockId: string
): { blocks: NoteBlock[]; removed?: NoteBlock; prevFocusId?: string } {
  const rootIdx = blocks.findIndex((b) => b.id === blockId);
  if (rootIdx !== -1) {
    const removed = blocks[rootIdx];
    if (blocks.length <= 1) {
      return {
        blocks: [{ id: blocks[0].id, type: 'text', content: '' }],
        removed,
        prevFocusId: blocks[0].id
      };
    }
    const prevBlock = blocks[Math.max(0, rootIdx - 1)];
    return {
      blocks: blocks.filter((b) => b.id !== blockId),
      removed,
      prevFocusId: prevBlock?.id
    };
  }

  let removed: NoteBlock | undefined;
  let prevFocusId: string | undefined;

  const nextBlocks = blocks.map((blk) => {
    if (blk.type !== 'columns' || !Array.isArray(blk.columns)) return blk;
    let changed = false;
    const nextCols = blk.columns.map((col) => {
      const inner = col.blocks || [];
      const idx = inner.findIndex((b) => b.id === blockId);
      if (idx === -1) return col;
      changed = true;
      removed = inner[idx];
      if (inner.length <= 1) {
        const resetId = inner[0]?.id || createBlockId();
        prevFocusId = resetId;
        return { ...col, blocks: [{ id: resetId, type: 'text' as const, content: '' }] };
      }
      prevFocusId = inner[Math.max(0, idx - 1)]?.id;
      return { ...col, blocks: inner.filter((b) => b.id !== blockId) };
    });
    return changed ? { ...blk, columns: nextCols } : blk;
  });

  return { blocks: nextBlocks, removed, prevFocusId };
}

/**
 * Moves a block up (-1) or down (+1) within its containing list (root or column).
 */
export function moveBlockStepDeep(
  blocks: NoteBlock[],
  blockId: string,
  dir: -1 | 1
): NoteBlock[] {
  const rootIdx = blocks.findIndex((b) => b.id === blockId);
  if (rootIdx !== -1) {
    const target = rootIdx + dir;
    if (target < 0 || target >= blocks.length) return blocks;
    const copy = [...blocks];
    const [removed] = copy.splice(rootIdx, 1);
    copy.splice(target, 0, removed);
    return copy;
  }

  return blocks.map((blk) => {
    if (blk.type !== 'columns' || !Array.isArray(blk.columns)) return blk;
    let changed = false;
    const nextCols = blk.columns.map((col) => {
      const inner = col.blocks || [];
      const idx = inner.findIndex((b) => b.id === blockId);
      if (idx === -1) return col;
      const target = idx + dir;
      if (target < 0 || target >= inner.length) return col;
      changed = true;
      const copy = [...inner];
      const [removed] = copy.splice(idx, 1);
      copy.splice(target, 0, removed);
      return { ...col, blocks: copy };
    });
    return changed ? { ...blk, columns: nextCols } : blk;
  });
}

export type BlockDropTarget =
  | { kind: 'block'; blockId: string; position: 'before' | 'after' }
  | { kind: 'column'; columnsBlockId: string; columnId: string };

/**
 * Moves one or more blocks (by ID) to either before/after another block or into a column.
 * Supports moving across columns and between main canvas & columns safely.
 */
export function moveBlocksToTarget(
  blocks: NoteBlock[],
  sourceIds: string[],
  target: BlockDropTarget
): NoteBlock[] {
  const movingSet = new Set(sourceIds);
  if (target.kind === 'block' && movingSet.has(target.blockId)) return blocks;
  if (target.kind === 'column' && movingSet.has(target.columnsBlockId)) return blocks;

  const movingBlocks: NoteBlock[] = [];
  const collectAndStrip = (list: NoteBlock[], isColumnList: boolean): NoteBlock[] => {
    const kept: NoteBlock[] = [];
    for (const blk of list) {
      if (movingSet.has(blk.id)) {
        // Prevent dragging a columns container into another column
        if (target.kind === 'column' && blk.type === 'columns') {
          kept.push(blk);
        } else {
          movingBlocks.push(blk);
        }
        continue;
      }
      if (blk.type === 'columns' && Array.isArray(blk.columns)) {
        const nextCols = blk.columns.map((col) => ({
          ...col,
          blocks: collectAndStrip(col.blocks || [], true)
        }));
        kept.push({ ...blk, columns: nextCols });
      } else {
        kept.push(blk);
      }
    }
    if (isColumnList && kept.length === 0) {
      return [{ id: createBlockId(), type: 'text', content: '' }];
    }
    return kept;
  };

  let stripped = collectAndStrip(blocks, false);
  if (movingBlocks.length === 0) return blocks;

  if (target.kind === 'column') {
    const destLoc = findBlockLocation(stripped, target.columnsBlockId);
    if (!destLoc) return blocks;
    // Strip empty placeholder inside target column before appending
    stripped = mapBlockDeep(stripped, target.columnsBlockId, (colContainer) => {
      const nextCols = (colContainer.columns || []).map((col) => {
        if (col.id !== target.columnId) return col;
        const inner = col.blocks || [];
        const base =
          inner.length === 1 && inner[0].type === 'text' && !inner[0].content.trim() ? [] : inner;
        return {
          ...col,
          blocks: [...base, ...movingBlocks.filter((b) => b.type !== 'columns')]
        };
      });
      return { ...colContainer, columns: nextCols };
    });
    return stripped;
  }

  // Target is relative to an existing block (at root or inside a column)
  const targetLoc = findBlockLocation(stripped, target.blockId);
  if (!targetLoc) return blocks;

  if (targetLoc.container === 'column') {
    const safeMoving = movingBlocks.filter((b) => b.type !== 'columns');
    if (safeMoving.length === 0) return blocks;
    return insertBlocksRelativeDeep(stripped, target.blockId, target.position, safeMoving);
  }

  return insertBlocksRelativeDeep(stripped, target.blockId, target.position, movingBlocks);
}

/**
 * Builds `count` (2..5) columns each seeded with one blank text block.
 */
export function createColumnsBlockData(count: 2 | 3 | 4 | 5): NoteColumn[] {
  return Array.from({ length: count }, (_, idx) => ({
    id: createBlockId(`col-${idx + 1}`),
    blocks: [{ id: createBlockId(), type: 'text', content: '' }]
  }));
}

/**
 * Safely resizes a `columns` block to 2, 3, 4, or 5 columns.
 * When shrinking, any non-empty blocks from dropped trailing columns are merged into the last kept column.
 */
export function resizeColumnsBlock(
  block: NoteBlock,
  targetCount: 2 | 3 | 4 | 5
): NoteBlock {
  const existing = block.columns && block.columns.length > 0 ? block.columns : createColumnsBlockData(2);
  if (existing.length === targetCount) return block;

  if (existing.length < targetCount) {
    const extras = Array.from({ length: targetCount - existing.length }, (_, idx) => ({
      id: createBlockId(`col-${existing.length + idx + 1}`),
      blocks: [{ id: createBlockId(), type: 'text' as const, content: '' }]
    }));
    return {
      ...block,
      columns: [...existing, ...extras]
    };
  }

  // Shrinking: merge non-empty blocks from trailing columns into the last kept column
  const kept = existing.slice(0, targetCount).map((col) => ({
    ...col,
    blocks: [...(col.blocks || [])]
  }));
  const droppedBlocks = existing
    .slice(targetCount)
    .flatMap((col) => col.blocks || [])
    .filter((b) => b.type !== 'text' || b.content.trim().length > 0);

  if (droppedBlocks.length > 0) {
    const lastCol = kept[kept.length - 1];
    const cleanBase = lastCol.blocks.filter(
      (b) => b.type !== 'text' || b.content.trim().length > 0
    );
    lastCol.blocks = [...cleanBase, ...droppedBlocks];
  }

  return {
    ...block,
    columns: kept
  };
}

/**
 * Dissolves a `columns` block back into sequential top-level blocks without losing content.
 */
export function ungroupColumnsBlock(blocks: NoteBlock[], columnsBlockId: string): NoteBlock[] {
  const idx = blocks.findIndex((b) => b.id === columnsBlockId);
  if (idx === -1) return blocks;
  const target = blocks[idx];
  const innerBlocks = (target.columns || [])
    .flatMap((col) => col.blocks || [])
    .filter((b) => b.type !== 'text' || b.content.trim().length > 0);
  const replacement: NoteBlock[] =
    innerBlocks.length > 0 ? innerBlocks : [{ id: createBlockId(), type: 'text', content: '' }];
  const copy = [...blocks];
  copy.splice(idx, 1, ...replacement);
  return copy;
}

/**
 * Deep-clones a block with fresh IDs (safe for duplicating columns, databases, charts, forms, metrics).
 */
export function cloneBlockDeep(block: NoteBlock): NoteBlock {
  const cloned = JSON.parse(JSON.stringify(block)) as NoteBlock;
  cloned.id = createBlockId();
  if (cloned.type === 'columns' && Array.isArray(cloned.columns)) {
    cloned.columns = cloned.columns.map((col, idx) => ({
      id: createBlockId(`col-${idx + 1}`),
      blocks: (col.blocks || []).map((inner) => cloneBlockDeep(inner))
    }));
  }
  return cloned;
}
