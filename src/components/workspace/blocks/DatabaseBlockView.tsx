'use client';

import React, { useMemo, useState } from 'react';
import {
  ArrowDownAZ,
  ArrowUpAZ,
  BarChart3,
  Check,
  ChevronDown,
  ClipboardList,
  Database,
  Download,
  ExternalLink,
  Gauge,
  LayoutGrid,
  PieChart,
  Plus,
  Search,
  Sparkles,
  Table2,
  Trash2,
  X
} from 'lucide-react';
import type {
  DatabaseBadgeColor,
  DatabaseBlockData,
  DatabaseCellValue,
  DatabaseColumn,
  DatabaseColumnType,
  DatabaseRow,
  NoteBlock
} from '../../../types/miu';
import {
  BADGE_COLOR_CLASSES,
  BADGE_COLOR_ORDER,
  computeColumnSummary,
  createDatabaseId,
  createDefaultDatabaseData,
  createSelectOption,
  exportDatabaseToCsv,
  formatDatabaseNumber,
  type DatabaseTemplateId
} from '../../../utils/databaseHelper';
import { parseLinkUrl } from '../../../utils/linkHelper';

interface DatabaseBlockViewProps {
  block: NoteBlock;
  canEdit: boolean;
  onUpdateDatabase: (nextData: DatabaseBlockData, titleContent: string) => void;
  onCreateConnectedBlock: (
    kind: 'bar_chart' | 'donut_chart' | 'form' | 'metric'
  ) => void;
  onAskAI: () => void;
}

const COLUMN_TYPE_LABELS: Array<{ id: DatabaseColumnType; label: string }> = [
  { id: 'text', label: 'Teks' },
  { id: 'number', label: 'Angka' },
  { id: 'select', label: 'Pilihan (Select)' },
  { id: 'multi_select', label: 'Multi-Pilihan' },
  { id: 'checkbox', label: 'Checkbox' },
  { id: 'date', label: 'Tanggal' },
  { id: 'url', label: 'URL Link' }
];

const AGG_LABELS: Array<{
  id: NonNullable<DatabaseColumn['aggregation']>;
  label: string;
}> = [
  { id: 'none', label: 'Tidak ada' },
  { id: 'count', label: 'Jumlah terisi' },
  { id: 'sum', label: 'Total (SUM)' },
  { id: 'avg', label: 'Rata-rata (AVG)' },
  { id: 'min', label: 'Minimum' },
  { id: 'max', label: 'Maksimum' },
  { id: 'checked', label: 'Tercentang (%)' }
];

interface SelectCellEditorProps {
  col: DatabaseColumn;
  value: DatabaseCellValue | undefined;
  canEdit: boolean;
  isMulti: boolean;
  onChange: (nextVal: DatabaseCellValue) => void;
  onAddOption: (label: string) => void;
}

const SelectCellEditor: React.FC<SelectCellEditorProps> = ({
  col,
  value,
  canEdit,
  isMulti,
  onChange,
  onAddOption
}) => {
  const [open, setOpen] = useState(false);
  const [newOpt, setNewOpt] = useState('');

  const selectedLabels: string[] = isMulti
    ? Array.isArray(value)
      ? value
      : typeof value === 'string' && value
        ? [value]
        : []
    : typeof value === 'string' && value
      ? [value]
      : [];

  const options = col.options || [];

  const renderBadge = (label: string) => {
    const opt = options.find((o) => o.label === label);
    const cls = BADGE_COLOR_CLASSES[opt?.color || 'slate'];
    return (
      <span
        key={label}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium ${cls.bg} ${cls.text} ${cls.border}`}
      >
        <span className="truncate max-w-[110px]">{label}</span>
      </span>
    );
  };

  const handlePick = (label: string) => {
    if (!canEdit) return;
    if (isMulti) {
      const exists = selectedLabels.includes(label);
      const next = exists
        ? selectedLabels.filter((l) => l !== label)
        : [...selectedLabels, label];
      onChange(next);
    } else {
      onChange(selectedLabels[0] === label ? '' : label);
      setOpen(false);
    }
  };

  const handleCreateOption = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newOpt.trim();
    if (!trimmed) return;
    if (!options.some((o) => o.label.toLowerCase() === trimmed.toLowerCase())) {
      onAddOption(trimmed);
    }
    if (isMulti) {
      if (!selectedLabels.includes(trimmed)) onChange([...selectedLabels, trimmed]);
    } else {
      onChange(trimmed);
      setOpen(false);
    }
    setNewOpt('');
  };

  return (
    <div className="relative">
      <button
        type="button"
        disabled={!canEdit}
        onClick={() => setOpen((v) => !v)}
        className={`w-full min-h-[28px] px-1.5 py-1 rounded-lg flex flex-wrap items-center gap-1 text-left transition ${
          canEdit ? 'hover:bg-subtle/80 cursor-pointer' : 'cursor-default'
        }`}
      >
        {selectedLabels.length > 0 ? (
          selectedLabels.map((lbl) => renderBadge(lbl))
        ) : (
          <span className="text-[11px] text-text-secondary/50 italic">
            {canEdit ? 'Pilih...' : '—'}
          </span>
        )}
      </button>

      {open && canEdit && (
        <div className="absolute left-0 top-full mt-1 z-30 w-52 miu-card shadow-xl p-2 space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
              {isMulti ? 'Pilih beberapa' : 'Pilih satu'}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-0.5 rounded hover:bg-subtle text-text-secondary"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="max-h-36 overflow-y-auto space-y-1">
            {options.map((opt) => {
              const active = selectedLabels.includes(opt.label);
              const cls = BADGE_COLOR_CLASSES[opt.color];
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handlePick(opt.label)}
                  className={`w-full flex items-center justify-between gap-2 px-2 py-1 rounded-lg text-xs transition ${
                    active ? 'bg-subtle font-semibold' : 'hover:bg-subtle/60'
                  }`}
                >
                  <span
                    className={`px-2 py-0.5 rounded-md border text-[11px] ${cls.bg} ${cls.text} ${cls.border} truncate`}
                  >
                    {opt.label}
                  </span>
                  {active && <Check className="w-3.5 h-3.5 text-accent-strong shrink-0" />}
                </button>
              );
            })}
          </div>
          <form onSubmit={handleCreateOption} className="flex items-center gap-1 pt-1 border-t border-border-subtle">
            <input
              type="text"
              value={newOpt}
              onChange={(e) => setNewOpt(e.target.value)}
              placeholder="+ Opsi baru..."
              className="flex-1 min-w-0 bg-surface border border-border-subtle rounded-md px-2 py-1 text-[11px] text-text-primary focus:outline-none focus:border-accent-strong"
            />
            <button
              type="submit"
              disabled={!newOpt.trim()}
              className="px-2 py-1 rounded-md bg-accent-strong text-white dark:text-slate-950 text-[10px] font-semibold disabled:opacity-40"
            >
              Tambah
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export const DatabaseBlockView: React.FC<DatabaseBlockViewProps> = ({
  block,
  canEdit,
  onUpdateDatabase,
  onCreateConnectedBlock,
  onAskAI
}) => {
  const dbData = useMemo<DatabaseBlockData>(
    () => block.databaseData || createDefaultDatabaseData('blank'),
    [block.databaseData]
  );

  const [searchTerm, setSearchTerm] = useState('');
  const [activeColMenuId, setActiveColMenuId] = useState<string | null>(null);
  const [editingNumberCell, setEditingNumberCell] = useState<string | null>(null);
  const [editingUrlCell, setEditingUrlCell] = useState<string | null>(null);
  const [newOptionDraft, setNewOptionDraft] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);

  const commit = (patch: Partial<DatabaseBlockData>) => {
    if (!canEdit) return;
    const next: DatabaseBlockData = { ...dbData, ...patch };
    onUpdateDatabase(next, next.title || 'Tabel Database');
  };

  const filteredAndSortedRows = useMemo(() => {
    let rows = [...(dbData.rows || [])];

    if (dbData.filterBy?.columnId && dbData.filterBy.query.trim()) {
      const q = dbData.filterBy.query.trim().toLowerCase();
      rows = rows.filter((r) => {
        const val = r.cells[dbData.filterBy!.columnId];
        if (Array.isArray(val)) return val.some((v) => v.toLowerCase().includes(q));
        return String(val ?? '').toLowerCase().includes(q);
      });
    }

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      rows = rows.filter((r) =>
        dbData.columns.some((col) => {
          const val = r.cells[col.id];
          if (Array.isArray(val)) return val.some((v) => v.toLowerCase().includes(q));
          return String(val ?? '').toLowerCase().includes(q);
        })
      );
    }

    if (dbData.sortBy?.columnId) {
      const { columnId, direction } = dbData.sortBy;
      const col = dbData.columns.find((c) => c.id === columnId);
      const mult = direction === 'asc' ? 1 : -1;
      rows.sort((a, b) => {
        const va = a.cells[columnId];
        const vb = b.cells[columnId];
        if (col?.type === 'number') {
          const na = Number(va ?? 0) || 0;
          const nb = Number(vb ?? 0) || 0;
          return (na - nb) * mult;
        }
        if (col?.type === 'checkbox') {
          return ((va ? 1 : 0) - (vb ? 1 : 0)) * mult;
        }
        return String(va ?? '').localeCompare(String(vb ?? ''), 'id') * mult;
      });
    }

    return rows;
  }, [dbData.rows, dbData.columns, dbData.filterBy, dbData.sortBy, searchTerm]);

  const handleCellChange = (
    rowId: string,
    columnId: string,
    value: DatabaseCellValue
  ) => {
    if (!canEdit) return;
    const now = Date.now();
    const nextRows = dbData.rows.map((r) =>
      r.id === rowId
        ? { ...r, cells: { ...r.cells, [columnId]: value }, updatedAt: now }
        : r
    );
    commit({ rows: nextRows });
  };

  const handleAddRow = () => {
    if (!canEdit) return;
    const now = Date.now();
    const initialCells: Record<string, DatabaseCellValue> = {};
    for (const col of dbData.columns) {
      if (col.type === 'checkbox') initialCells[col.id] = false;
      else if (col.type === 'multi_select') initialCells[col.id] = [];
      else initialCells[col.id] = '';
    }
    const newRow: DatabaseRow = {
      id: createDatabaseId('row'),
      cells: initialCells,
      createdAt: now,
      updatedAt: now,
      source: 'manual'
    };
    commit({ rows: [...dbData.rows, newRow] });
  };

  const handleDeleteRow = (rowId: string) => {
    if (!canEdit) return;
    commit({ rows: dbData.rows.filter((r) => r.id !== rowId) });
  };

  const handleAddColumn = () => {
    if (!canEdit) return;
    const newCol: DatabaseColumn = {
      id: createDatabaseId('col'),
      name: `Kolom ${dbData.columns.length + 1}`,
      type: 'text'
    };
    commit({ columns: [...dbData.columns, newCol] });
    setActiveColMenuId(newCol.id);
  };

  const handleUpdateColumn = (colId: string, patch: Partial<DatabaseColumn>) => {
    if (!canEdit) return;
    const nextCols = dbData.columns.map((c) => {
      if (c.id !== colId) return c;
      const merged: DatabaseColumn = { ...c, ...patch };
      if (
        (patch.type === 'select' || patch.type === 'multi_select') &&
        (!merged.options || merged.options.length === 0)
      ) {
        merged.options = [
          createSelectOption('Opsi 1', 0),
          createSelectOption('Opsi 2', 1)
        ];
      }
      return merged;
    });
    commit({ columns: nextCols });
  };

  const handleDeleteColumn = (colId: string) => {
    if (!canEdit || dbData.columns.length <= 1) return;
    const nextCols = dbData.columns.filter((c) => c.id !== colId);
    const nextRows = dbData.rows.map((r) => {
      const cells = { ...r.cells };
      delete cells[colId];
      return { ...r, cells };
    });
    setActiveColMenuId(null);
    commit({ columns: nextCols, rows: nextRows });
  };

  const handleAddSelectOptionToColumn = (colId: string, label: string) => {
    const col = dbData.columns.find((c) => c.id === colId);
    if (!col) return;
    const current = col.options || [];
    const nextOpt = createSelectOption(label, current.length);
    handleUpdateColumn(colId, { options: [...current, nextOpt] });
  };

  const handleExportCsv = () => {
    const csv = exportDatabaseToCsv(dbData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(dbData.title || 'tabel-database').toLowerCase().replace(/\s+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasAnyFooterSummary = dbData.columns.some(
    (col) => col.aggregation && col.aggregation !== 'none'
  );

  const renderCell = (row: DatabaseRow, col: DatabaseColumn) => {
    const val = row.cells[col.id];
    const cellKey = `${row.id}:${col.id}`;

    if (col.type === 'checkbox') {
      const checked = Boolean(val);
      return (
        <div className="flex items-center justify-center py-1">
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => handleCellChange(row.id, col.id, !checked)}
            className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition ${
              checked
                ? 'bg-accent-strong border-accent-strong text-white dark:text-slate-950'
                : 'border-text-secondary/45 hover:border-accent-strong bg-surface'
            }`}
          >
            {checked && <Check className="w-3 h-3 stroke-[3]" />}
          </button>
        </div>
      );
    }

    if (col.type === 'select' || col.type === 'multi_select') {
      return (
        <SelectCellEditor
          col={col}
          value={val}
          canEdit={canEdit}
          isMulti={col.type === 'multi_select'}
          onChange={(nextVal) => handleCellChange(row.id, col.id, nextVal)}
          onAddOption={(lbl) => handleAddSelectOptionToColumn(col.id, lbl)}
        />
      );
    }

    if (col.type === 'number') {
      const isEditing = canEdit && editingNumberCell === cellKey;
      const numericVal =
        typeof val === 'number'
          ? val
          : typeof val === 'string' && val.trim() !== '' && !Number.isNaN(Number(val))
            ? Number(val)
            : null;

      if (isEditing) {
        return (
          <input
            type="number"
            step="any"
            autoFocus
            value={val === undefined || val === null ? '' : String(val)}
            onChange={(e) => {
              const raw = e.target.value;
              handleCellChange(
                row.id,
                col.id,
                raw === '' ? '' : Number.isFinite(Number(raw)) ? Number(raw) : raw
              );
            }}
            onBlur={() => setEditingNumberCell(null)}
            className="w-full bg-surface border border-accent-strong rounded-md px-2 py-1 text-xs font-mono text-right text-text-primary focus:outline-none"
          />
        );
      }

      return (
        <button
          type="button"
          disabled={!canEdit}
          onClick={() => setEditingNumberCell(cellKey)}
          className={`w-full text-right px-2 py-1 rounded-md text-xs font-mono transition ${
            canEdit ? 'hover:bg-subtle/80 cursor-text' : 'cursor-default'
          } ${numericVal === null ? 'text-text-secondary/45' : 'text-text-primary font-medium'}`}
        >
          {numericVal === null ? '0' : formatDatabaseNumber(numericVal, col.numberFormat)}
        </button>
      );
    }

    if (col.type === 'date') {
      return (
        <input
          type="date"
          readOnly={!canEdit}
          value={typeof val === 'string' ? val : ''}
          onChange={(e) => handleCellChange(row.id, col.id, e.target.value)}
          className="w-full bg-transparent px-1.5 py-1 text-xs text-text-primary focus:outline-none rounded-md focus:bg-surface"
        />
      );
    }

    if (col.type === 'url') {
      const strVal = typeof val === 'string' ? val : '';
      const parsed = parseLinkUrl(strVal);
      if (canEdit && (!strVal || editingUrlCell === cellKey)) {
        return (
          <input
            type="text"
            autoFocus={editingUrlCell === cellKey}
            value={strVal}
            onChange={(e) => handleCellChange(row.id, col.id, e.target.value)}
            onBlur={() => setEditingUrlCell(null)}
            placeholder="https://..."
            className="w-full bg-surface border border-border-subtle focus:border-accent-strong rounded-md px-2 py-1 text-xs text-text-primary focus:outline-none"
          />
        );
      }
      return (
        <div className="flex items-center justify-between gap-1 px-1.5 py-1">
          {parsed.isValid ? (
            <a
              href={parsed.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-xs text-accent-strong hover:underline truncate min-w-0"
            >
              <ExternalLink className="w-3 h-3 shrink-0" />
              <span className="truncate">{parsed.hostname}</span>
            </a>
          ) : (
            <span className="text-xs text-text-secondary truncate">{strVal || '—'}</span>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditingUrlCell(cellKey)}
              className="text-[10px] text-text-secondary hover:text-text-primary shrink-0 px-1"
            >
              Edit
            </button>
          )}
        </div>
      );
    }

    // Default: text
    return (
      <input
        type="text"
        readOnly={!canEdit}
        value={val === undefined || val === null ? '' : String(val)}
        onChange={(e) => handleCellChange(row.id, col.id, e.target.value)}
        placeholder={canEdit ? '...' : ''}
        className="w-full bg-transparent px-2 py-1 text-xs text-text-primary placeholder:text-text-secondary/35 focus:outline-none focus:bg-surface rounded-md"
      />
    );
  };

  return (
    <div className="my-2 rounded-2xl border border-border-subtle bg-surface shadow-sm overflow-hidden">
      {/* Database Header & Integration Toolbar */}
      <div className="px-3.5 py-3 bg-subtle/60 border-b border-border-subtle space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-7 h-7 rounded-lg bg-accent-strong/15 text-accent-strong flex items-center justify-center shrink-0">
              <Database className="w-4 h-4" />
            </div>
            <input
              type="text"
              readOnly={!canEdit}
              value={dbData.title}
              onChange={(e) => commit({ title: e.target.value })}
              placeholder="Nama Tabel Database..."
              className="min-w-0 flex-1 bg-transparent text-sm font-bold text-text-primary focus:outline-none"
            />
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface border border-border-subtle text-text-secondary shrink-0">
              {dbData.rows.length} baris
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1 no-print">
            {canEdit && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowTemplates((v) => !v)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-surface hover:bg-subtle border border-border-subtle text-[11px] font-medium text-text-secondary hover:text-text-primary transition"
                  title="Terapkan template tabel cepat"
                >
                  <span>Template</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showTemplates && (
                  <div className="absolute right-0 top-full mt-1 z-30 w-44 miu-card shadow-xl p-1 space-y-0.5 text-xs">
                    {(
                      [
                        { id: 'blank', label: 'Dasar (Kategori + Angka)' },
                        { id: 'budget', label: 'Pelacak Pengeluaran' },
                        { id: 'survey', label: 'Survei & Respon' },
                        { id: 'course', label: 'Tugas Mata Kuliah' }
                      ] as Array<{ id: DatabaseTemplateId; label: string }>
                    ).map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => {
                          const next = createDefaultDatabaseData(tpl.id);
                          onUpdateDatabase(next, next.title);
                          setShowTemplates(false);
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-subtle text-text-primary text-[11px]"
                      >
                        {tpl.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() =>
                commit({ viewMode: dbData.viewMode === 'cards' ? 'table' : 'cards' })
              }
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-surface hover:bg-subtle border border-border-subtle text-[11px] font-medium text-text-secondary hover:text-text-primary transition"
              title="Ubah tampilan Tabel / Kartu"
            >
              {dbData.viewMode === 'cards' ? (
                <>
                  <Table2 className="w-3 h-3" />
                  <span className="hidden sm:inline">Tabel</span>
                </>
              ) : (
                <>
                  <LayoutGrid className="w-3 h-3" />
                  <span className="hidden sm:inline">Kartu</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-surface hover:bg-subtle border border-border-subtle text-[11px] font-medium text-text-secondary hover:text-text-primary transition"
              title="Ekspor data tabel ke CSV"
            >
              <Download className="w-3 h-3" />
              <span className="hidden sm:inline">CSV</span>
            </button>

            <button
              type="button"
              onClick={onAskAI}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-600/90 hover:bg-indigo-500 text-white text-[11px] font-semibold transition"
              title="Analisis isi tabel ini dengan AI"
            >
              <Sparkles className="w-3 h-3" />
              <span>Tanya AI</span>
            </button>
          </div>
        </div>

        {/* Search + 1-Click Connected Block Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 no-print">
          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <Search className="w-3 h-3 text-text-secondary absolute left-2.5 top-2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari data di tabel..."
              className="w-full bg-surface border border-border-subtle rounded-lg pl-7 pr-2.5 py-1 text-[11px] text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent-strong"
            />
          </div>

          {canEdit && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[10px] font-semibold text-text-secondary mr-0.5 hidden md:inline">
                Hubungkan:
              </span>
              <button
                type="button"
                onClick={() => onCreateConnectedBlock('bar_chart')}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-surface hover:border-accent-strong border border-border-subtle text-[11px] font-semibold text-text-primary transition"
                title="Buat Diagram Batang yang terhubung ke tabel ini"
              >
                <BarChart3 className="w-3 h-3 text-sky-500" />
                <span>+ Diagram Batang</span>
              </button>
              <button
                type="button"
                onClick={() => onCreateConnectedBlock('donut_chart')}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-surface hover:border-accent-strong border border-border-subtle text-[11px] font-semibold text-text-primary transition"
                title="Buat Diagram Donat yang terhubung ke tabel ini"
              >
                <PieChart className="w-3 h-3 text-emerald-500" />
                <span>+ Diagram Donat</span>
              </button>
              <button
                type="button"
                onClick={() => onCreateConnectedBlock('form')}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-surface hover:border-accent-strong border border-border-subtle text-[11px] font-semibold text-text-primary transition"
                title="Buat Formulir yang terhubung ke tabel ini"
              >
                <ClipboardList className="w-3 h-3 text-amber-500" />
                <span>+ Formulir</span>
              </button>
              <button
                type="button"
                onClick={() => onCreateConnectedBlock('metric')}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-surface hover:border-accent-strong border border-border-subtle text-[11px] font-semibold text-text-primary transition"
                title="Buat Kartu Metrik KPI dari tabel ini"
              >
                <Gauge className="w-3 h-3 text-violet-500" />
                <span>+ Metrik</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Table or Card View */}
      {dbData.viewMode === 'cards' ? (
        <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {filteredAndSortedRows.length === 0 ? (
            <div className="col-span-full py-6 text-center text-xs text-text-secondary">
              Belum ada baris data yang cocok.
            </div>
          ) : (
            filteredAndSortedRows.map((row) => (
              <div
                key={row.id}
                className="p-3 rounded-xl border border-border-subtle bg-subtle/35 space-y-2 relative group/card"
              >
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => handleDeleteRow(row.id)}
                    className="absolute top-2 right-2 p-1 rounded hover:bg-rose-500/15 text-text-secondary hover:text-rose-500 opacity-0 group-hover/card:opacity-100 transition"
                    title="Hapus baris"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                {dbData.columns.map((col) => (
                  <div key={col.id} className="space-y-0.5">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                      {col.name}
                    </div>
                    <div className="bg-surface/70 rounded-lg border border-border-subtle/70 px-1 py-0.5">
                      {renderCell(row, col)}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left min-w-[480px]">
            <thead>
              <tr className="bg-subtle/40 border-b border-border-subtle text-[11px] font-semibold text-text-secondary">
                {dbData.columns.map((col) => {
                  const isMenuOpen = activeColMenuId === col.id;
                  const isSorted = dbData.sortBy?.columnId === col.id;
                  return (
                    <th
                      key={col.id}
                      className="relative px-2.5 py-2 border-r border-border-subtle/60 min-w-[120px] select-none"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (canEdit) {
                            setActiveColMenuId(isMenuOpen ? null : col.id);
                            setNewOptionDraft('');
                          } else {
                            commit({
                              sortBy: {
                                columnId: col.id,
                                direction:
                                  isSorted && dbData.sortBy?.direction === 'asc'
                                    ? 'desc'
                                    : 'asc'
                              }
                            });
                          }
                        }}
                        className="w-full flex items-center justify-between gap-1.5 text-left hover:text-text-primary transition"
                      >
                        <span className="truncate font-semibold text-text-primary">
                          {col.name}
                        </span>
                        <span className="inline-flex items-center gap-1 shrink-0">
                          {isSorted &&
                            (dbData.sortBy?.direction === 'asc' ? (
                              <ArrowUpAZ className="w-3 h-3 text-accent-strong" />
                            ) : (
                              <ArrowDownAZ className="w-3 h-3 text-accent-strong" />
                            ))}
                          <span className="text-[9px] font-mono uppercase px-1 py-0.5 rounded bg-surface border border-border-subtle text-text-secondary">
                            {col.type === 'multi_select' ? 'multi' : col.type}
                          </span>
                        </span>
                      </button>

                      {/* Column Settings Popover */}
                      {isMenuOpen && canEdit && (
                        <div className="absolute left-0 top-full mt-1 z-40 w-64 miu-card shadow-2xl p-3 space-y-2.5 font-normal text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                              Pengaturan Kolom
                            </span>
                            <button
                              type="button"
                              onClick={() => setActiveColMenuId(null)}
                              className="p-0.5 rounded hover:bg-subtle text-text-secondary"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] text-text-secondary">Nama Kolom</label>
                            <input
                              type="text"
                              value={col.name}
                              onChange={(e) =>
                                handleUpdateColumn(col.id, { name: e.target.value })
                              }
                              className="w-full bg-surface border border-border-subtle rounded-lg px-2.5 py-1 text-xs text-text-primary focus:outline-none focus:border-accent-strong"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] text-text-secondary">Tipe Data</label>
                            <select
                              value={col.type}
                              onChange={(e) =>
                                handleUpdateColumn(col.id, {
                                  type: e.target.value as DatabaseColumnType
                                })
                              }
                              className="w-full bg-surface border border-border-subtle rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none"
                            >
                              {COLUMN_TYPE_LABELS.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {col.type === 'number' && (
                            <div className="space-y-1">
                              <label className="text-[10px] text-text-secondary">Format Angka</label>
                              <select
                                value={col.numberFormat || 'plain'}
                                onChange={(e) =>
                                  handleUpdateColumn(col.id, {
                                    numberFormat: e.target.value as DatabaseColumn['numberFormat']
                                  })
                                }
                                className="w-full bg-surface border border-border-subtle rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none"
                              >
                                <option value="plain">Angka Biasa</option>
                                <option value="currency_idr">Rupiah (Rp)</option>
                                <option value="percent">Persentase (%)</option>
                              </select>
                            </div>
                          )}

                          {(col.type === 'select' || col.type === 'multi_select') && (
                            <div className="space-y-1.5 pt-1 border-t border-border-subtle">
                              <label className="text-[10px] text-text-secondary">
                                Opsi Pilihan ({(col.options || []).length})
                              </label>
                              <div className="max-h-28 overflow-y-auto space-y-1">
                                {(col.options || []).map((opt) => {
                                  const cls = BADGE_COLOR_CLASSES[opt.color];
                                  return (
                                    <div
                                      key={opt.id}
                                      className="flex items-center justify-between gap-1"
                                    >
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const nextColor: DatabaseBadgeColor =
                                            BADGE_COLOR_ORDER[
                                              (BADGE_COLOR_ORDER.indexOf(opt.color) + 1) %
                                                BADGE_COLOR_ORDER.length
                                            ];
                                          handleUpdateColumn(col.id, {
                                            options: (col.options || []).map((o) =>
                                              o.id === opt.id ? { ...o, color: nextColor } : o
                                            )
                                          });
                                        }}
                                        className={`px-2 py-0.5 rounded-md border text-[10px] font-medium truncate ${cls.bg} ${cls.text} ${cls.border}`}
                                        title="Klik untuk ganti warna"
                                      >
                                        {opt.label}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleUpdateColumn(col.id, {
                                            options: (col.options || []).filter(
                                              (o) => o.id !== opt.id
                                            )
                                          })
                                        }
                                        className="p-0.5 rounded hover:bg-rose-500/15 text-text-secondary hover:text-rose-500"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="flex gap-1">
                                <input
                                  type="text"
                                  value={newOptionDraft}
                                  onChange={(e) => setNewOptionDraft(e.target.value)}
                                  placeholder="Tambah opsi..."
                                  className="flex-1 min-w-0 bg-surface border border-border-subtle rounded-md px-2 py-1 text-[11px] text-text-primary focus:outline-none"
                                />
                                <button
                                  type="button"
                                  disabled={!newOptionDraft.trim()}
                                  onClick={() => {
                                    handleAddSelectOptionToColumn(col.id, newOptionDraft);
                                    setNewOptionDraft('');
                                  }}
                                  className="px-2 py-1 rounded-md bg-accent-strong text-white dark:text-slate-950 text-[10px] font-semibold disabled:opacity-40"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          )}

                          <div className="space-y-1">
                            <label className="text-[10px] text-text-secondary">
                              Ringkasan Footer
                            </label>
                            <select
                              value={col.aggregation || 'none'}
                              onChange={(e) =>
                                handleUpdateColumn(col.id, {
                                  aggregation: e.target.value as DatabaseColumn['aggregation']
                                })
                              }
                              className="w-full bg-surface border border-border-subtle rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none"
                            >
                              {AGG_LABELS.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="flex items-center gap-1 pt-1 border-t border-border-subtle">
                            <button
                              type="button"
                              onClick={() => {
                                commit({ sortBy: { columnId: col.id, direction: 'asc' } });
                                setActiveColMenuId(null);
                              }}
                              className="flex-1 py-1 rounded-lg bg-subtle hover:bg-subtle/80 text-[11px] font-medium text-text-primary"
                            >
                              Urut A→Z
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                commit({ sortBy: { columnId: col.id, direction: 'desc' } });
                                setActiveColMenuId(null);
                              }}
                              className="flex-1 py-1 rounded-lg bg-subtle hover:bg-subtle/80 text-[11px] font-medium text-text-primary"
                            >
                              Urut Z→A
                            </button>
                          </div>

                          {dbData.columns.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleDeleteColumn(col.id)}
                              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-[11px] font-semibold transition"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Hapus Kolom</span>
                            </button>
                          )}
                        </div>
                      )}
                    </th>
                  );
                })}
                {canEdit && (
                  <th className="w-10 px-2 py-2 text-center no-print">
                    <button
                      type="button"
                      onClick={handleAddColumn}
                      className="p-1 rounded-md hover:bg-surface text-text-secondary hover:text-text-primary transition"
                      title="Tambah kolom baru"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </th>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-border-subtle/60">
              {filteredAndSortedRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={dbData.columns.length + (canEdit ? 1 : 0)}
                    className="px-4 py-6 text-center text-xs text-text-secondary"
                  >
                    Belum ada baris data.
                  </td>
                </tr>
              ) : (
                filteredAndSortedRows.map((row) => (
                  <tr key={row.id} className="group/row hover:bg-subtle/30 transition">
                    {dbData.columns.map((col) => (
                      <td
                        key={col.id}
                        className="px-1.5 py-1 border-r border-border-subtle/50 align-middle"
                      >
                        {renderCell(row, col)}
                      </td>
                    ))}
                    {canEdit && (
                      <td className="px-1.5 py-1 text-center align-middle no-print">
                        <div className="flex items-center justify-center gap-0.5">
                          {row.source === 'form' && (
                            <span
                              className="text-[9px] font-mono px-1 rounded bg-amber-500/15 text-amber-600 dark:text-amber-300"
                              title="Dikirim melalui Formulir"
                            >
                              F
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(row.id)}
                            className="p-1 rounded hover:bg-rose-500/15 text-text-secondary/50 hover:text-rose-500 opacity-0 group-hover/row:opacity-100 transition"
                            title="Hapus baris"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>

            {hasAnyFooterSummary && (
              <tfoot>
                <tr className="bg-subtle/50 border-t border-border-subtle text-[11px]">
                  {dbData.columns.map((col) => {
                    const summary = computeColumnSummary(filteredAndSortedRows, col);
                    return (
                      <td
                        key={`foot-${col.id}`}
                        className="px-2.5 py-1.5 border-r border-border-subtle/50 font-mono"
                      >
                        {summary ? (
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] text-text-secondary">{summary.label}</span>
                            <span className="font-bold text-text-primary">{summary.value}</span>
                          </div>
                        ) : null}
                      </td>
                    );
                  })}
                  {canEdit && <td className="no-print" />}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* Footer Add Row */}
      {canEdit && (
        <div className="px-3 py-2 border-t border-border-subtle/70 bg-subtle/25 flex items-center justify-between gap-2 no-print">
          <button
            type="button"
            onClick={handleAddRow}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-text-primary transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah baris</span>
          </button>
          {dbData.sortBy && (
            <button
              type="button"
              onClick={() => commit({ sortBy: null })}
              className="text-[10px] text-accent-strong hover:underline"
            >
              Reset urutan
            </button>
          )}
        </div>
      )}
    </div>
  );
};
