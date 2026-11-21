'use client';

import React, { useMemo, useRef, useState } from 'react';
import {
  Check,
  Columns3,
  Copy,
  Heading,
  Plus,
  Rows3,
  Sparkles,
  Trash2
} from 'lucide-react';
import type { NoteBlock, SimpleTableData } from '../../../types/miu';
import { renderInlineMarkdown } from '../../../utils/markdown';

export function createDefaultSimpleTableData(): SimpleTableData {
  return {
    hasHeaderRow: true,
    rows: [
      ['Kolom 1', 'Kolom 2', 'Kolom 3'],
      ['', '', ''],
      ['', '', '']
    ]
  };
}

export function normalizeSimpleTableData(raw?: SimpleTableData): SimpleTableData {
  if (!raw || !Array.isArray(raw.rows) || raw.rows.length === 0) {
    return createDefaultSimpleTableData();
  }
  const colCount = Math.max(1, ...raw.rows.map((r) => (Array.isArray(r) ? r.length : 0)));
  const rows = raw.rows.map((r) =>
    Array.from({ length: colCount }, (_, idx) => (Array.isArray(r) && typeof r[idx] === 'string' ? r[idx] : ''))
  );
  return {
    hasHeaderRow: raw.hasHeaderRow !== false,
    rows
  };
}

export function simpleTableToMarkdown(raw?: SimpleTableData): string {
  const table = normalizeSimpleTableData(raw);
  if (table.rows.length === 0) return '';
  const escapeCell = (val: string) => (val || '').replace(/\n+/g, ' ').replace(/\|/g, '\\|').trim();
  const lines: string[] = [];
  table.rows.forEach((row, rIdx) => {
    lines.push(`| ${row.map(escapeCell).join(' | ')} |`);
    if (rIdx === 0) {
      lines.push(`| ${row.map(() => '---').join(' | ')} |`);
    }
  });
  return lines.join('\n');
}

interface SimpleTableBlockViewProps {
  block: NoteBlock;
  canEdit: boolean;
  onUpdateTable: (nextData: SimpleTableData, previewContent: string) => void;
  onAskAI?: (markdownTable: string) => void;
}

export const SimpleTableBlockView: React.FC<SimpleTableBlockViewProps> = ({
  block,
  canEdit,
  onUpdateTable,
  onAskAI
}) => {
  const table = useMemo(() => normalizeSimpleTableData(block.tableData), [block.tableData]);
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
  const [copiedMd, setCopiedMd] = useState(false);
  const cellInputRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const colCount = table.rows[0]?.length || 1;
  const rowCount = table.rows.length;

  const commit = (next: SimpleTableData) => {
    const preview = (next.rows[0] || [])
      .map((c) => c.trim())
      .filter(Boolean)
      .slice(0, 4)
      .join(' | ');
    onUpdateTable(next, preview || 'Tabel Sederhana');
  };

  const focusCell = (r: number, c: number) => {
    setActiveCell({ row: r, col: c });
    window.requestAnimationFrame(() => {
      const el = cellInputRefs.current[`${r}:${c}`];
      if (el) {
        el.focus();
        const len = el.value.length;
        el.setSelectionRange(len, len);
      }
    });
  };

  const handleCellChange = (rIdx: number, cIdx: number, value: string) => {
    if (!canEdit) return;
    const nextRows = table.rows.map((row, r) =>
      r === rIdx ? row.map((cell, c) => (c === cIdx ? value : cell)) : row
    );
    commit({ ...table, rows: nextRows });
  };

  const addRow = (atIndex?: number) => {
    if (!canEdit) return;
    const newRow = Array.from({ length: colCount }, () => '');
    const insertAt = typeof atIndex === 'number' ? atIndex : rowCount;
    const nextRows = [...table.rows];
    nextRows.splice(insertAt, 0, newRow);
    commit({ ...table, rows: nextRows });
    focusCell(insertAt, 0);
  };

  const removeRow = (rIdx: number) => {
    if (!canEdit || rowCount <= 1) return;
    const nextRows = table.rows.filter((_, idx) => idx !== rIdx);
    commit({ ...table, rows: nextRows });
    setActiveCell(null);
  };

  const addColumn = (atIndex?: number) => {
    if (!canEdit) return;
    const insertAt = typeof atIndex === 'number' ? atIndex : colCount;
    const nextRows = table.rows.map((row, rIdx) => {
      const copy = [...row];
      copy.splice(
        insertAt,
        0,
        rIdx === 0 && table.hasHeaderRow ? `Kolom ${colCount + 1}` : ''
      );
      return copy;
    });
    commit({ ...table, rows: nextRows });
    focusCell(0, insertAt);
  };

  const removeColumn = (cIdx: number) => {
    if (!canEdit || colCount <= 1) return;
    const nextRows = table.rows.map((row) => row.filter((_, idx) => idx !== cIdx));
    commit({ ...table, rows: nextRows });
    setActiveCell(null);
  };

  const handleCellKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    rIdx: number,
    cIdx: number
  ) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const total = rowCount * colCount;
      const flatIdx = rIdx * colCount + cIdx + (e.shiftKey ? -1 : 1);
      if (flatIdx >= 0 && flatIdx < total) {
        const nextR = Math.floor(flatIdx / colCount);
        const nextC = flatIdx % colCount;
        focusCell(nextR, nextC);
      } else if (!e.shiftKey && flatIdx === total) {
        addRow();
      }
      return;
    }

    if (e.key === 'Escape') {
      e.currentTarget.blur();
      setActiveCell(null);
    }
  };

  return (
    <div className="my-2 group/simpletable space-y-1.5">
      {/* Compact Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-xl bg-subtle/60 border border-border-subtle/80 text-[11px] no-print">
        <div className="flex items-center gap-1.5 text-text-secondary font-medium">
          <span>Tabel ({rowCount} × {colCount})</span>
          {canEdit && (
            <>
              <button
                type="button"
                onClick={() => addRow()}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface hover:bg-subtle border border-border-subtle text-text-primary transition"
              >
                <Rows3 className="w-3 h-3 text-accent-strong" />
                <span>+ Baris</span>
              </button>
              <button
                type="button"
                onClick={() => addColumn()}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface hover:bg-subtle border border-border-subtle text-text-primary transition"
              >
                <Columns3 className="w-3 h-3 text-accent-strong" />
                <span>+ Kolom</span>
              </button>
              <button
                type="button"
                onClick={() => commit({ ...table, hasHeaderRow: !table.hasHeaderRow })}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border transition ${
                  table.hasHeaderRow
                    ? 'bg-accent-strong/15 border-accent-strong/40 text-accent-strong font-semibold'
                    : 'bg-surface border-border-subtle text-text-secondary hover:text-text-primary'
                }`}
                title="Aktifkan atau matikan baris judul"
              >
                <Heading className="w-3 h-3" />
                <span>Header</span>
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-1">
          {canEdit && activeCell && (
            <div className="flex items-center gap-1 mr-1">
              {rowCount > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(activeCell.row)}
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 transition"
                  title={`Hapus baris ${activeCell.row + 1}`}
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Baris {activeCell.row + 1}</span>
                </button>
              )}
              {colCount > 1 && (
                <button
                  type="button"
                  onClick={() => removeColumn(activeCell.col)}
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 transition"
                  title={`Hapus kolom ${activeCell.col + 1}`}
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Kol {activeCell.col + 1}</span>
                </button>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(simpleTableToMarkdown(table));
              setCopiedMd(true);
              window.setTimeout(() => setCopiedMd(false), 1500);
            }}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface hover:bg-subtle border border-border-subtle text-text-secondary hover:text-text-primary transition"
            title="Salin sebagai tabel Markdown"
          >
            {copiedMd ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
            <span>{copiedMd ? 'Tersalin' : 'Markdown'}</span>
          </button>

          {onAskAI && (
            <button
              type="button"
              onClick={() => onAskAI(simpleTableToMarkdown(table))}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 font-medium transition"
              title="Analisis isi tabel dengan AI"
            >
              <Sparkles className="w-3 h-3" />
              <span>AI</span>
            </button>
          )}
        </div>
      </div>

      {/* Lightweight Editable Table Grid */}
      <div className="overflow-x-auto rounded-xl border border-border-subtle bg-surface">
        <table className="w-full border-collapse text-xs text-left">
          <tbody>
            {table.rows.map((row, rIdx) => {
              const isHeader = Boolean(table.hasHeaderRow && rIdx === 0);
              return (
                <tr
                  key={rIdx}
                  className={
                    isHeader
                      ? 'bg-subtle/75 font-semibold text-text-primary'
                      : 'hover:bg-subtle/25 transition-colors'
                  }
                >
                  {row.map((cell, cIdx) => {
                    const isFocused =
                      canEdit && activeCell?.row === rIdx && activeCell?.col === cIdx;
                    const CellTag = isHeader ? 'th' : 'td';
                    return (
                      <CellTag
                        key={`${rIdx}:${cIdx}`}
                        onClick={() => {
                          if (canEdit && !isFocused) {
                            focusCell(rIdx, cIdx);
                          }
                        }}
                        className={`min-w-[110px] align-top border-b border-r last:border-r-0 border-border-subtle/80 p-0 relative ${
                          rIdx === rowCount - 1 ? 'border-b-0' : ''
                        } ${isFocused ? 'ring-2 ring-inset ring-accent-strong/70 bg-accent-strong/[0.03]' : ''} ${
                          canEdit ? 'cursor-text' : 'cursor-default'
                        }`}
                      >
                        {isFocused ? (
                          <textarea
                            ref={(el) => {
                              cellInputRefs.current[`${rIdx}:${cIdx}`] = el;
                            }}
                            rows={Math.max(1, cell.split('\n').length)}
                            value={cell}
                            onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                            onKeyDown={(e) => handleCellKeyDown(e, rIdx, cIdx)}
                            onBlur={() =>
                              setActiveCell((prev) =>
                                prev?.row === rIdx && prev?.col === cIdx ? null : prev
                              )
                            }
                            placeholder={isHeader ? 'Judul...' : 'Isi sel...'}
                            className={`w-full px-2.5 py-2 bg-transparent text-xs text-text-primary focus:outline-none resize-none leading-relaxed ${
                              isHeader ? 'font-semibold' : 'font-normal'
                            }`}
                          />
                        ) : (
                          <div className="px-2.5 py-2 min-h-[34px] whitespace-pre-wrap break-words leading-relaxed">
                            {cell.trim() ? (
                              renderInlineMarkdown(cell)
                            ) : (
                              <span className="text-text-secondary/35 italic">
                                {canEdit ? (isHeader ? 'Kolom...' : '') : ''}
                              </span>
                            )}
                          </div>
                        )}
                      </CellTag>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <div className="flex items-center justify-end gap-1.5 no-print opacity-0 group-hover/simpletable:opacity-100 transition">
          <button
            type="button"
            onClick={() => addRow()}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] text-text-secondary hover:text-text-primary hover:bg-subtle transition"
          >
            <Plus className="w-3 h-3" />
            <span>Tambah Baris</span>
          </button>
        </div>
      )}
    </div>
  );
};
