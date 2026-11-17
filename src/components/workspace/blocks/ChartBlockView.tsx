'use client';

import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Database,
  PieChart,
  Plus,
  Settings2,
  Sparkles,
  TrendingUp
} from 'lucide-react';
import type {
  ChartAggregation,
  ChartBlockData,
  ChartKind,
  NoteBlock,
  NoteRecord
} from '../../../types/miu';
import {
  aggregateDatabaseForChart,
  createDefaultChartData,
  findAllDatabaseSources,
  formatDatabaseNumber
} from '../../../utils/databaseHelper';

interface ChartBlockViewProps {
  block: NoteBlock;
  activeNoteId: string;
  allNotes: NoteRecord[];
  canEdit: boolean;
  onUpdateChart: (nextData: ChartBlockData, titleContent: string) => void;
  onCreateStarterDatabase: () => Promise<{ noteId: string; blockId: string } | null>;
  onAskAI: () => void;
}

export const ChartBlockView: React.FC<ChartBlockViewProps> = ({
  block,
  activeNoteId,
  allNotes,
  canEdit,
  onUpdateChart,
  onCreateStarterDatabase,
  onAskAI
}) => {
  const sources = useMemo(() => findAllDatabaseSources(allNotes), [allNotes]);
  const chartData = useMemo<ChartBlockData>(
    () => block.chartData || createDefaultChartData(sources, 'bar'),
    [block.chartData, sources]
  );

  const selectedSource = useMemo(
    () =>
      sources.find(
        (s) =>
          s.noteId === chartData.sourceNoteId && s.blockId === chartData.sourceBlockId
      ) || sources.find((s) => s.blockId === chartData.sourceBlockId),
    [sources, chartData.sourceNoteId, chartData.sourceBlockId]
  );

  const [showConfig, setShowConfig] = useState(!selectedSource && canEdit);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const commit = (patch: Partial<ChartBlockData>) => {
    if (!canEdit) return;
    const next: ChartBlockData = { ...chartData, ...patch };
    onUpdateChart(next, next.title || 'Diagram');
  };

  const aggResult = useMemo(
    () => aggregateDatabaseForChart(selectedSource?.data, chartData),
    [selectedSource?.data, chartData]
  );

  const valueColumn = useMemo(
    () => selectedSource?.columns.find((c) => c.id === chartData.valueColumnId),
    [selectedSource?.columns, chartData.valueColumnId]
  );

  const formatMetric = (val: number) => {
    if (chartData.aggregation === 'count') {
      return val.toLocaleString('id-ID');
    }
    return formatDatabaseNumber(val, valueColumn?.numberFormat);
  };

  const handleSelectSource = (combinedKey: string) => {
    if (!combinedKey) return;
    const [noteId, blockId] = combinedKey.split('::');
    const src = sources.find((s) => s.noteId === noteId && s.blockId === blockId);
    if (!src) return;
    const catCol =
      src.columns.find((c) => c.type === 'select' || c.type === 'multi_select') ||
      src.columns[0];
    const numCol = src.columns.find((c) => c.type === 'number');
    commit({
      sourceNoteId: src.noteId,
      sourceBlockId: src.blockId,
      categoryColumnId: catCol?.id || '',
      valueColumnId: numCol?.id || '',
      aggregation: numCol ? 'sum' : 'count',
      filterColumnId: '',
      filterValue: ''
    });
  };

  const handleQuickCreateDatabase = async () => {
    const created = await onCreateStarterDatabase();
    if (!created) return;
    commit({
      sourceNoteId: created.noteId,
      sourceBlockId: created.blockId,
      categoryColumnId: 'col-category',
      valueColumnId: 'col-value',
      aggregation: 'sum'
    });
    setShowConfig(false);
  };

  const localSources = sources.filter((s) => s.noteId === activeNoteId);
  const crossSources = sources.filter((s) => s.noteId !== activeNoteId);
  const numericCols = (selectedSource?.columns || []).filter((c) => c.type === 'number');

  const renderBarChart = () => {
    const items = aggResult.items;
    const maxVal = Math.max(1, ...items.map((i) => Math.max(0, i.value)));
    const width = 560;
    const height = 228;
    const padLeft = 42;
    const padRight = 16;
    const padTop = 22;
    const padBottom = 42;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;
    const step = plotW / Math.max(1, items.length);
    const barW = Math.min(52, Math.max(18, step * 0.62));

    return (
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto min-w-[320px] select-none"
          role="img"
          aria-label={chartData.title}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padTop + plotH * (1 - ratio);
            const tickVal = Math.round(maxVal * ratio * 10) / 10;
            return (
              <g key={ratio}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity={ratio === 0 ? 0.2 : 0.08}
                  strokeDasharray={ratio === 0 ? undefined : '3 3'}
                  className="text-text-secondary"
                />
                <text
                  x={padLeft - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-text-secondary text-[9px] font-mono"
                >
                  {tickVal >= 1000 ? `${(tickVal / 1000).toFixed(1)}k` : tickVal}
                </text>
              </g>
            );
          })}

          {items.map((item, idx) => {
            const valRatio = Math.max(0, item.value) / maxVal;
            const h = Math.max(3, plotH * valRatio);
            const x = padLeft + idx * step + (step - barW) / 2;
            const y = padTop + plotH - h;
            const isHovered = hoveredIdx === idx;
            const shortLabel =
              item.label.length > 11 ? `${item.label.slice(0, 10)}…` : item.label;

            return (
              <g
                key={`${item.label}-${idx}`}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer"
              >
                <title>{`${item.label}: ${formatMetric(item.value)} (${item.percent}%)`}</title>
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={h}
                  rx={6}
                  fill={item.color}
                  opacity={hoveredIdx !== null && !isHovered ? 0.55 : 0.92}
                  className="transition-all duration-200"
                />
                {(chartData.showValues !== false || isHovered) && (
                  <text
                    x={x + barW / 2}
                    y={y - 6}
                    textAnchor="middle"
                    className="fill-text-primary text-[10px] font-mono font-semibold"
                  >
                    {formatMetric(item.value)}
                  </text>
                )}
                <text
                  x={x + barW / 2}
                  y={height - 18}
                  textAnchor="middle"
                  className="fill-text-secondary text-[10px]"
                >
                  {shortLabel}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  const renderHorizontalBarChart = () => {
    const items = aggResult.items;
    const maxVal = Math.max(1, ...items.map((i) => Math.max(0, i.value)));
    return (
      <div className="space-y-2 py-1">
        {items.map((item, idx) => {
          const pctWidth = Math.max(2, (Math.max(0, item.value) / maxVal) * 100);
          return (
            <div
              key={`${item.label}-${idx}`}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="space-y-1"
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-text-primary truncate">{item.label}</span>
                <span className="font-mono text-[11px] text-text-secondary shrink-0">
                  <strong className="text-text-primary">{formatMetric(item.value)}</strong> (
                  {item.percent}%)
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-subtle overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${pctWidth}%`,
                    backgroundColor: item.color,
                    opacity: hoveredIdx !== null && hoveredIdx !== idx ? 0.6 : 1
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderDonutChart = () => {
    const items = aggResult.items.filter((i) => i.value > 0);
    if (items.length === 0) {
      return (
        <div className="py-8 text-center text-xs text-text-secondary">
          Semua nilai kategori bernilai 0 — tambahkan nilai positif untuk menampilkan Diagram Donat.
        </div>
      );
    }

    const total = items.reduce((acc, i) => acc + i.value, 0);
    const radius = 64;
    const strokeWidth = 26;
    const circumference = 2 * Math.PI * radius;
    let cumulative = 0;

    const hoveredItem = hoveredIdx !== null ? items[hoveredIdx] : null;

    return (
      <div className="flex flex-col sm:flex-row items-center gap-5 py-2">
        <div className="relative w-44 h-44 shrink-0 flex items-center justify-center">
          <svg viewBox="0 0 180 180" className="w-full h-full -rotate-90">
            <circle
              cx="90"
              cy="90"
              r={radius}
              fill="transparent"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              className="text-subtle"
            />
            {items.map((item, idx) => {
              const fraction = item.value / total;
              const segLen = Math.max(0, fraction * circumference - 2);
              const offset = -cumulative * circumference;
              cumulative += fraction;
              const isHovered = hoveredIdx === idx;
              return (
                <circle
                  key={`${item.label}-${idx}`}
                  cx="90"
                  cy="90"
                  r={radius}
                  fill="transparent"
                  stroke={item.color}
                  strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                  strokeDasharray={`${segLen} ${circumference}`}
                  strokeDashoffset={offset}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  opacity={hoveredIdx !== null && !isHovered ? 0.55 : 1}
                  className="cursor-pointer transition-all duration-200"
                >
                  <title>{`${item.label}: ${formatMetric(item.value)} (${item.percent}%)`}</title>
                </circle>
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 pointer-events-none">
            <span className="text-[10px] uppercase tracking-wider text-text-secondary truncate max-w-[95px]">
              {hoveredItem ? hoveredItem.label : 'Total'}
            </span>
            <span className="text-sm font-extrabold font-mono text-text-primary leading-tight">
              {hoveredItem ? formatMetric(hoveredItem.value) : formatMetric(aggResult.totalValue)}
            </span>
            {hoveredItem && (
              <span className="text-[10px] font-mono text-accent-strong">
                {hoveredItem.percent}%
              </span>
            )}
          </div>
        </div>

        {chartData.showLegend !== false && (
          <div className="flex-1 w-full space-y-1.5 min-w-0">
            {items.map((item, idx) => (
              <div
                key={`${item.label}-${idx}`}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                  hoveredIdx === idx ? 'bg-subtle font-semibold' : 'hover:bg-subtle/60'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-text-primary truncate">{item.label}</span>
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px] shrink-0">
                  <span className="text-text-primary font-semibold">
                    {formatMetric(item.value)}
                  </span>
                  <span className="text-text-secondary w-11 text-right">{item.percent}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderLineChart = () => {
    const items = aggResult.items;
    const maxVal = Math.max(1, ...items.map((i) => Math.max(0, i.value)));
    const width = 560;
    const height = 220;
    const padLeft = 42;
    const padRight = 20;
    const padTop = 24;
    const padBottom = 40;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;
    const step = items.length > 1 ? plotW / (items.length - 1) : plotW / 2;

    const points = items.map((item, idx) => {
      const x = items.length === 1 ? padLeft + plotW / 2 : padLeft + idx * step;
      const y = padTop + plotH - (Math.max(0, item.value) / maxVal) * plotH;
      return { x, y, item, idx };
    });

    const polyPoints = points.map((p) => `${p.x},${p.y}`).join(' ');
    const areaPath =
      points.length > 0
        ? `M ${points[0].x},${padTop + plotH} L ${points
            .map((p) => `${p.x},${p.y}`)
            .join(' L ')} L ${points[points.length - 1].x},${padTop + plotH} Z`
        : '';

    const strokeColor = points[0]?.item.color || '#0284c7';

    return (
      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto min-w-[320px]">
          {[0, 0.5, 1].map((r) => {
            const y = padTop + plotH * (1 - r);
            return (
              <line
                key={r}
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke="currentColor"
                strokeOpacity={r === 0 ? 0.2 : 0.08}
                className="text-text-secondary"
              />
            );
          })}
          {areaPath && <path d={areaPath} fill={strokeColor} fillOpacity={0.12} />}
          {points.length > 1 && (
            <polyline
              fill="none"
              stroke={strokeColor}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              points={polyPoints}
            />
          )}
          {points.map(({ x, y, item, idx }) => (
            <g
              key={`${item.label}-${idx}`}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="cursor-pointer"
            >
              <title>{`${item.label}: ${formatMetric(item.value)}`}</title>
              <circle
                cx={x}
                cy={y}
                r={hoveredIdx === idx ? 5.5 : 4}
                fill={strokeColor}
                stroke="var(--bg-surface)"
                strokeWidth={2}
              />
              {(chartData.showValues !== false || hoveredIdx === idx) && (
                <text
                  x={x}
                  y={y - 9}
                  textAnchor="middle"
                  className="fill-text-primary text-[10px] font-mono font-semibold"
                >
                  {formatMetric(item.value)}
                </text>
              )}
              <text
                x={x}
                y={height - 16}
                textAnchor="middle"
                className="fill-text-secondary text-[10px]"
              >
                {item.label.length > 10 ? `${item.label.slice(0, 9)}…` : item.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    );
  };

  return (
    <div className="my-2 rounded-2xl border border-border-subtle bg-surface shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-3.5 py-2.5 bg-subtle/55 border-b border-border-subtle flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-7 h-7 rounded-lg bg-sky-500/15 text-sky-500 flex items-center justify-center shrink-0">
            {chartData.kind === 'donut' ? (
              <PieChart className="w-4 h-4" />
            ) : chartData.kind === 'line' ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <BarChart3 className="w-4 h-4" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <input
              type="text"
              readOnly={!canEdit}
              value={chartData.title}
              onChange={(e) => commit({ title: e.target.value })}
              placeholder="Judul Diagram..."
              className="w-full bg-transparent text-sm font-bold text-text-primary focus:outline-none"
            />
            {selectedSource && (
              <p className="text-[10px] text-text-secondary truncate">
                Sumber: {selectedSource.noteIcon} {selectedSource.noteTitle} →{' '}
                <span className="font-semibold text-text-primary">{selectedSource.title}</span> (
                {aggResult.totalRows} baris)
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1 no-print">
          {canEdit && (
            <div className="inline-flex rounded-lg bg-surface border border-border-subtle p-0.5">
              {(
                [
                  { id: 'bar', label: 'Batang' },
                  { id: 'horizontal_bar', label: 'Horisontal' },
                  { id: 'donut', label: 'Donat' },
                  { id: 'line', label: 'Garis' }
                ] as Array<{ id: ChartKind; label: string }>
              ).map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => commit({ kind: k.id })}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition ${
                    chartData.kind === k.id
                      ? 'bg-accent-strong text-white dark:text-slate-950'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {k.label}
                </button>
              ))}
            </div>
          )}

          {canEdit && (
            <button
              type="button"
              onClick={() => setShowConfig((v) => !v)}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-medium transition ${
                showConfig
                  ? 'bg-accent-strong/15 border-accent-strong text-accent-strong'
                  : 'bg-surface border-border-subtle text-text-secondary hover:text-text-primary'
              }`}
            >
              <Settings2 className="w-3 h-3" />
              <span>Atur Data</span>
            </button>
          )}

          <button
            type="button"
            onClick={onAskAI}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-600/90 hover:bg-indigo-500 text-white text-[11px] font-semibold transition"
            title="Analisis grafik ini dengan AI"
          >
            <Sparkles className="w-3 h-3" />
            <span className="hidden sm:inline">Tanya AI</span>
          </button>
        </div>
      </div>

      {/* Configuration Drawer */}
      {showConfig && canEdit && (
        <div className="p-3 bg-subtle/35 border-b border-border-subtle grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs no-print">
          <div className="space-y-1 sm:col-span-2">
            <label className="text-[10px] font-semibold text-text-secondary">
              Sumber Tabel Database
            </label>
            <div className="flex gap-1.5">
              <select
                value={
                  selectedSource ? `${selectedSource.noteId}::${selectedSource.blockId}` : ''
                }
                onChange={(e) => handleSelectSource(e.target.value)}
                className="flex-1 min-w-0 bg-surface border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent-strong"
              >
                <option value="">-- Pilih Tabel Database --</option>
                {localSources.length > 0 && (
                  <optgroup label="Di Halaman Ini">
                    {localSources.map((s) => (
                      <option key={`${s.noteId}::${s.blockId}`} value={`${s.noteId}::${s.blockId}`}>
                        {s.title} ({s.rowsCount} baris)
                      </option>
                    ))}
                  </optgroup>
                )}
                {crossSources.length > 0 && (
                  <optgroup label="Dari Catatan Lain">
                    {crossSources.map((s) => (
                      <option key={`${s.noteId}::${s.blockId}`} value={`${s.noteId}::${s.blockId}`}>
                        {s.noteTitle} → {s.title} ({s.rowsCount} baris)
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <button
                type="button"
                onClick={() => void handleQuickCreateDatabase()}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-accent-strong text-white dark:text-slate-950 text-[11px] font-semibold shrink-0"
                title="Buat Tabel Database baru yang langsung terhubung ke diagram ini"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tabel Baru</span>
              </button>
            </div>
          </div>

          {selectedSource && (
            <>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-text-secondary">
                  Kolom Kategori (Label)
                </label>
                <select
                  value={chartData.categoryColumnId}
                  onChange={(e) => commit({ categoryColumnId: e.target.value })}
                  className="w-full bg-surface border border-border-subtle rounded-lg px-2 py-1.5 text-xs text-text-primary focus:outline-none"
                >
                  {selectedSource.columns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-text-secondary">
                  Hitung / Agregasi
                </label>
                <select
                  value={chartData.aggregation}
                  onChange={(e) => {
                    const agg = e.target.value as ChartAggregation;
                    commit({
                      aggregation: agg,
                      valueColumnId:
                        agg !== 'count' && !chartData.valueColumnId
                          ? numericCols[0]?.id || ''
                          : chartData.valueColumnId
                    });
                  }}
                  className="w-full bg-surface border border-border-subtle rounded-lg px-2 py-1.5 text-xs text-text-primary focus:outline-none"
                >
                  <option value="count">Jumlah Baris (Count)</option>
                  <option value="sum" disabled={numericCols.length === 0}>
                    Total Nilai (Sum)
                  </option>
                  <option value="avg" disabled={numericCols.length === 0}>
                    Rata-rata (Avg)
                  </option>
                </select>
              </div>

              {chartData.aggregation !== 'count' && numericCols.length > 0 && (
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-text-secondary">
                    Kolom Angka (Nilai Y)
                  </label>
                  <select
                    value={chartData.valueColumnId || numericCols[0]?.id || ''}
                    onChange={(e) => commit({ valueColumnId: e.target.value })}
                    className="w-full bg-surface border border-border-subtle rounded-lg px-2 py-1.5 text-xs text-text-primary focus:outline-none"
                  >
                    {numericCols.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-text-secondary">Urutan</label>
                <select
                  value={chartData.sortOrder || 'value_desc'}
                  onChange={(e) =>
                    commit({
                      sortOrder: e.target.value as ChartBlockData['sortOrder']
                    })
                  }
                  className="w-full bg-surface border border-border-subtle rounded-lg px-2 py-1.5 text-xs text-text-primary focus:outline-none"
                >
                  <option value="value_desc">Nilai Tertinggi</option>
                  <option value="value_asc">Nilai Terendah</option>
                  <option value="label_asc">Label A–Z</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-text-secondary">Palet Warna</label>
                <select
                  value={chartData.palette || 'miu'}
                  onChange={(e) =>
                    commit({ palette: e.target.value as ChartBlockData['palette'] })
                  }
                  className="w-full bg-surface border border-border-subtle rounded-lg px-2 py-1.5 text-xs text-text-primary focus:outline-none"
                >
                  <option value="miu">Miu Default</option>
                  <option value="ocean">Ocean Blue</option>
                  <option value="warm">Warm Sunset</option>
                  <option value="emerald">Emerald</option>
                </select>
              </div>
            </>
          )}
        </div>
      )}

      {/* Chart Canvas */}
      <div className="p-3.5">
        {!selectedSource ? (
          <div className="py-8 px-4 rounded-xl border border-dashed border-border-subtle bg-subtle/30 text-center space-y-2.5">
            <Database className="w-6 h-6 text-accent-strong mx-auto opacity-80" />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-text-primary">
                Belum terhubung ke Tabel Database
              </p>
              <p className="text-[11px] text-text-secondary">
                Pilih tabel yang sudah ada di atas, atau buat Tabel Database baru otomatis.
              </p>
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={() => void handleQuickCreateDatabase()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-strong text-white dark:text-slate-950 text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Buat Tabel Database Terhubung</span>
              </button>
            )}
          </div>
        ) : aggResult.items.length === 0 ? (
          <div className="py-8 text-center text-xs text-text-secondary">
            Tabel <strong>{selectedSource.title}</strong> belum memiliki baris data untuk
            ditampilkan.
          </div>
        ) : chartData.kind === 'donut' ? (
          renderDonutChart()
        ) : chartData.kind === 'horizontal_bar' ? (
          renderHorizontalBarChart()
        ) : chartData.kind === 'line' ? (
          renderLineChart()
        ) : (
          renderBarChart()
        )}
      </div>
    </div>
  );
};
