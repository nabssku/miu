'use client';

import React, { useMemo, useState } from 'react';
import { Gauge, Settings2 } from 'lucide-react';
import type {
  DatabaseBadgeColor,
  MetricBlockData,
  NoteBlock,
  NoteRecord
} from '../../../types/miu';
import {
  BADGE_COLOR_CLASSES,
  BADGE_COLOR_ORDER,
  computeMetricValue,
  createDefaultMetricData,
  findAllDatabaseSources
} from '../../../utils/databaseHelper';

interface MetricBlockViewProps {
  block: NoteBlock;
  activeNoteId: string;
  activeNoteBlocks: NoteBlock[];
  allNotes: NoteRecord[];
  canEdit: boolean;
  onUpdateMetric: (nextData: MetricBlockData, titleContent: string) => void;
}

export const MetricBlockView: React.FC<MetricBlockViewProps> = ({
  block,
  activeNoteId,
  activeNoteBlocks,
  allNotes,
  canEdit,
  onUpdateMetric
}) => {
  const sources = useMemo(() => findAllDatabaseSources(allNotes), [allNotes]);
  const metricData = useMemo<MetricBlockData>(
    () => block.metricData || createDefaultMetricData(sources),
    [block.metricData, sources]
  );

  const selectedSource = useMemo(
    () =>
      sources.find(
        (s) =>
          s.noteId === metricData.sourceNoteId && s.blockId === metricData.sourceBlockId
      ) || sources.find((s) => s.blockId === metricData.sourceBlockId),
    [sources, metricData.sourceNoteId, metricData.sourceBlockId]
  );

  const [editingConfig, setEditingConfig] = useState(false);

  const computed = useMemo(
    () => computeMetricValue(selectedSource?.data, activeNoteBlocks, metricData),
    [selectedSource?.data, activeNoteBlocks, metricData]
  );

  const commit = (patch: Partial<MetricBlockData>) => {
    if (!canEdit) return;
    const next: MetricBlockData = { ...metricData, ...patch };
    onUpdateMetric(next, next.title || 'Metrik');
  };

  const accent = BADGE_COLOR_CLASSES[metricData.accentColor || 'sky'];

  return (
    <div className="my-1.5 rounded-2xl border border-border-subtle bg-subtle/45 p-3.5 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div
            className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${accent.bg} ${accent.text} ${accent.border}`}
          >
            <Gauge className="w-3.5 h-3.5" />
          </div>
          <input
            type="text"
            readOnly={!canEdit}
            value={metricData.title}
            onChange={(e) => commit({ title: e.target.value })}
            placeholder="Judul Metrik..."
            className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-text-secondary focus:outline-none focus:text-text-primary"
          />
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditingConfig((v) => !v)}
            className={`p-1 rounded-lg border text-[11px] transition no-print ${
              editingConfig
                ? 'bg-accent-strong/15 border-accent-strong text-accent-strong'
                : 'bg-surface border-border-subtle text-text-secondary hover:text-text-primary'
            }`}
            title="Atur sumber metrik"
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="space-y-0.5">
        <div className="text-2xl font-extrabold font-mono tracking-tight text-text-primary truncate">
          {computed.displayValue}
        </div>
        <p className="text-[11px] text-text-secondary truncate">{computed.subtitle}</p>
      </div>

      {editingConfig && canEdit && (
        <div className="pt-2.5 border-t border-border-subtle grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs no-print">
          <div className="space-y-1">
            <label className="text-[10px] text-text-secondary">Sumber Data</label>
            <select
              value={
                metricData.sourceKind === 'page_todos'
                  ? '__PAGE_TODOS__'
                  : selectedSource
                    ? `${selectedSource.noteId}::${selectedSource.blockId}`
                    : ''
              }
              onChange={(e) => {
                const v = e.target.value;
                if (v === '__PAGE_TODOS__') {
                  commit({
                    sourceKind: 'page_todos',
                    operation: 'completion_rate',
                    prefix: '',
                    suffix: '%'
                  });
                  return;
                }
                const [noteId, blockId] = v.split('::');
                const src = sources.find((s) => s.noteId === noteId && s.blockId === blockId);
                if (!src) return;
                const numCol = src.columns.find((c) => c.type === 'number');
                commit({
                  sourceKind: 'database',
                  sourceNoteId: src.noteId,
                  sourceBlockId: src.blockId,
                  columnId: numCol?.id || src.columns[0]?.id,
                  operation: numCol ? 'sum' : 'count',
                  prefix: numCol?.numberFormat === 'currency_idr' ? 'Rp ' : '',
                  suffix: numCol?.numberFormat === 'percent' ? '%' : ''
                });
              }}
              className="w-full bg-surface border border-border-subtle rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none"
            >
              <option value="__PAGE_TODOS__">Progres To-do Halaman Ini</option>
              {sources.map((s) => (
                <option key={`${s.noteId}::${s.blockId}`} value={`${s.noteId}::${s.blockId}`}>
                  {s.noteId === activeNoteId ? s.title : `${s.noteTitle} → ${s.title}`}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-text-secondary">Operasi Hitung</label>
            <select
              value={metricData.operation}
              onChange={(e) =>
                commit({ operation: e.target.value as MetricBlockData['operation'] })
              }
              className="w-full bg-surface border border-border-subtle rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none"
            >
              <option value="count">Jumlah Baris / Selesai</option>
              {metricData.sourceKind === 'database' && (
                <>
                  <option value="sum">Total Nilai (Sum)</option>
                  <option value="avg">Rata-rata (Avg)</option>
                  <option value="completion_rate">Persentase Checkbox (%)</option>
                </>
              )}
              {metricData.sourceKind === 'page_todos' && (
                <option value="completion_rate">Persentase Selesai (%)</option>
              )}
            </select>
          </div>

          {metricData.sourceKind === 'database' &&
            selectedSource &&
            metricData.operation !== 'count' && (
              <div className="space-y-1">
                <label className="text-[10px] text-text-secondary">Kolom Target</label>
                <select
                  value={metricData.columnId || ''}
                  onChange={(e) => commit({ columnId: e.target.value })}
                  className="w-full bg-surface border border-border-subtle rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none"
                >
                  {selectedSource.columns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

          <div className="flex items-end gap-1.5">
            <div className="flex-1 space-y-1">
              <label className="text-[10px] text-text-secondary">Prefix</label>
              <input
                type="text"
                value={metricData.prefix || ''}
                onChange={(e) => commit({ prefix: e.target.value })}
                placeholder="Rp "
                className="w-full bg-surface border border-border-subtle rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none"
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-[10px] text-text-secondary">Suffix</label>
              <input
                type="text"
                value={metricData.suffix || ''}
                onChange={(e) => commit({ suffix: e.target.value })}
                placeholder="%"
                className="w-full bg-surface border border-border-subtle rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1 pb-1">
              {BADGE_COLOR_ORDER.map((clr) => (
                <button
                  key={clr}
                  type="button"
                  onClick={() => commit({ accentColor: clr as DatabaseBadgeColor })}
                  className={`w-4 h-4 rounded-full border ${
                    metricData.accentColor === clr
                      ? 'ring-2 ring-accent-strong scale-110'
                      : 'opacity-70'
                  }`}
                  style={{ backgroundColor: BADGE_COLOR_CLASSES[clr].dot }}
                  title={clr}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
