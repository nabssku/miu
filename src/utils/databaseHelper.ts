import type {
  ChartBlockData,
  ChartKind,
  DatabaseBadgeColor,
  DatabaseBlockData,
  DatabaseCellValue,
  DatabaseColumn,
  DatabaseColumnType,
  DatabaseRow,
  DatabaseSelectOption,
  FormBlockData,
  FormFieldConfig,
  MetricBlockData,
  NoteBlock,
  NoteRecord
} from '../types/miu';
import { flattenBlocks } from './blockTreeHelper';
import { parseLinkUrl } from './linkHelper';

export const BADGE_COLOR_CLASSES: Record<
  DatabaseBadgeColor,
  { bg: string; text: string; border: string; dot: string }
> = {
  sky: {
    bg: 'bg-sky-500/15',
    text: 'text-sky-600 dark:text-sky-300',
    border: 'border-sky-500/30',
    dot: '#0ea5e9'
  },
  emerald: {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-600 dark:text-emerald-300',
    border: 'border-emerald-500/30',
    dot: '#10b981'
  },
  amber: {
    bg: 'bg-amber-500/15',
    text: 'text-amber-600 dark:text-amber-300',
    border: 'border-amber-500/30',
    dot: '#f59e0b'
  },
  rose: {
    bg: 'bg-rose-500/15',
    text: 'text-rose-600 dark:text-rose-300',
    border: 'border-rose-500/30',
    dot: '#f43f5e'
  },
  violet: {
    bg: 'bg-violet-500/15',
    text: 'text-violet-600 dark:text-violet-300',
    border: 'border-violet-500/30',
    dot: '#8b5cf6'
  },
  slate: {
    bg: 'bg-slate-500/15',
    text: 'text-slate-600 dark:text-slate-300',
    border: 'border-slate-500/30',
    dot: '#64748b'
  }
};

export const BADGE_COLOR_ORDER: DatabaseBadgeColor[] = [
  'sky',
  'emerald',
  'amber',
  'rose',
  'violet',
  'slate'
];

export const CHART_PALETTES: Record<NonNullable<ChartBlockData['palette']>, string[]> = {
  miu: ['#0284c7', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#06b6d4', '#ec4899'],
  ocean: ['#0369a1', '#0ea5e9', '#14b8a6', '#6366f1', '#38bdf8', '#2563eb', '#0d9488'],
  warm: ['#ea580c', '#f59e0b', '#e11d48', '#d97706', '#f43f5e', '#fb923c', '#be123c'],
  emerald: ['#059669', '#10b981', '#0d9488', '#84cc16', '#0284c7', '#34d399', '#14b8a6']
};

export function createDatabaseId(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export type DatabaseTemplateId = 'blank' | 'budget' | 'survey' | 'course';

export function createDefaultDatabaseData(
  template: DatabaseTemplateId = 'blank'
): DatabaseBlockData {
  const now = Date.now();

  if (template === 'budget') {
    const colItem: DatabaseColumn = { id: 'col-item', name: 'Keperluan', type: 'text' };
    const colCat: DatabaseColumn = {
      id: 'col-cat',
      name: 'Kategori',
      type: 'select',
      options: [
        { id: 'opt-makan', label: 'Konsumsi', color: 'amber' },
        { id: 'opt-kuliah', label: 'Kuliah', color: 'sky' },
        { id: 'opt-trans', label: 'Transportasi', color: 'emerald' },
        { id: 'opt-lain', label: 'Lainnya', color: 'violet' }
      ]
    };
    const colAmount: DatabaseColumn = {
      id: 'col-amount',
      name: 'Nominal',
      type: 'number',
      numberFormat: 'currency_idr',
      aggregation: 'sum'
    };
    const colPaid: DatabaseColumn = {
      id: 'col-paid',
      name: 'Lunas',
      type: 'checkbox',
      aggregation: 'checked'
    };

    return {
      title: 'Pelacak Pengeluaran',
      columns: [colItem, colCat, colAmount, colPaid],
      rows: [
        {
          id: createDatabaseId('row'),
          cells: {
            'col-item': 'Buku Referensi Kuliah',
            'col-cat': 'Kuliah',
            'col-amount': 125000,
            'col-paid': true
          },
          createdAt: now,
          updatedAt: now,
          source: 'manual'
        },
        {
          id: createDatabaseId('row'),
          cells: {
            'col-item': 'Makan Siang Kampus',
            'col-cat': 'Konsumsi',
            'col-amount': 35000,
            'col-paid': true
          },
          createdAt: now + 1,
          updatedAt: now + 1,
          source: 'manual'
        },
        {
          id: createDatabaseId('row'),
          cells: {
            'col-item': 'Kartu Transportasi',
            'col-cat': 'Transportasi',
            'col-amount': 50000,
            'col-paid': false
          },
          createdAt: now + 2,
          updatedAt: now + 2,
          source: 'manual'
        }
      ],
      sortBy: null,
      filterBy: null,
      viewMode: 'table'
    };
  }

  if (template === 'survey') {
    const colName: DatabaseColumn = { id: 'col-name', name: 'Nama Responden', type: 'text' };
    const colRating: DatabaseColumn = {
      id: 'col-rating',
      name: 'Penilaian',
      type: 'select',
      options: [
        { id: 'opt-5', label: 'Sangat Puas', color: 'emerald' },
        { id: 'opt-4', label: 'Puas', color: 'sky' },
        { id: 'opt-3', label: 'Cukup', color: 'amber' },
        { id: 'opt-2', label: 'Kurang', color: 'rose' }
      ]
    };
    const colScore: DatabaseColumn = {
      id: 'col-score',
      name: 'Skor (1-10)',
      type: 'number',
      aggregation: 'avg'
    };
    return {
      title: 'Data Respon Formulir',
      columns: [colName, colRating, colScore],
      rows: [
        {
          id: createDatabaseId('row'),
          cells: { 'col-name': 'Responden 1', 'col-rating': 'Sangat Puas', 'col-score': 9 },
          createdAt: now,
          updatedAt: now,
          source: 'manual'
        },
        {
          id: createDatabaseId('row'),
          cells: { 'col-name': 'Responden 2', 'col-rating': 'Puas', 'col-score': 8 },
          createdAt: now + 1,
          updatedAt: now + 1,
          source: 'manual'
        }
      ],
      sortBy: null,
      filterBy: null,
      viewMode: 'table'
    };
  }

  if (template === 'course') {
    const colTask: DatabaseColumn = { id: 'col-task', name: 'Tugas / Materi', type: 'text' };
    const colStatus: DatabaseColumn = {
      id: 'col-status',
      name: 'Status',
      type: 'select',
      options: [
        { id: 'opt-todo', label: 'Belum Mulai', color: 'slate' },
        { id: 'opt-prog', label: 'Dikerjakan', color: 'amber' },
        { id: 'opt-done', label: 'Selesai', color: 'emerald' }
      ]
    };
    const colScore: DatabaseColumn = {
      id: 'col-score',
      name: 'Bobot / Nilai',
      type: 'number',
      aggregation: 'avg'
    };
    return {
      title: 'Tabel Mata Kuliah',
      columns: [colTask, colStatus, colScore],
      rows: [
        {
          id: createDatabaseId('row'),
          cells: { 'col-task': 'Ringkasan Bab 1', 'col-status': 'Selesai', 'col-score': 92 },
          createdAt: now,
          updatedAt: now,
          source: 'manual'
        },
        {
          id: createDatabaseId('row'),
          cells: { 'col-task': 'Tugas Praktikum 2', 'col-status': 'Dikerjakan', 'col-score': 85 },
          createdAt: now + 1,
          updatedAt: now + 1,
          source: 'manual'
        }
      ],
      sortBy: null,
      filterBy: null,
      viewMode: 'table'
    };
  }

  // Default starter database ready for Bar/Donut charts & Forms
  return {
    title: 'Tabel Database Baru',
    columns: [
      { id: 'col-name', name: 'Item', type: 'text', aggregation: 'count' },
      {
        id: 'col-category',
        name: 'Kategori',
        type: 'select',
        options: [
          { id: 'opt-a', label: 'Kategori A', color: 'sky' },
          { id: 'opt-b', label: 'Kategori B', color: 'emerald' },
          { id: 'opt-c', label: 'Kategori C', color: 'amber' }
        ]
      },
      { id: 'col-value', name: 'Jumlah', type: 'number', aggregation: 'sum' },
      { id: 'col-done', name: 'Selesai', type: 'checkbox', aggregation: 'checked' }
    ],
    rows: [
      {
        id: createDatabaseId('row'),
        cells: { 'col-name': 'Data 1', 'col-category': 'Kategori A', 'col-value': 40, 'col-done': true },
        createdAt: now,
        updatedAt: now,
        source: 'manual'
      },
      {
        id: createDatabaseId('row'),
        cells: { 'col-name': 'Data 2', 'col-category': 'Kategori B', 'col-value': 25, 'col-done': false },
        createdAt: now + 1,
        updatedAt: now + 1,
        source: 'manual'
      },
      {
        id: createDatabaseId('row'),
        cells: { 'col-name': 'Data 3', 'col-category': 'Kategori C', 'col-value': 35, 'col-done': true },
        createdAt: now + 2,
        updatedAt: now + 2,
        source: 'manual'
      }
    ],
    sortBy: null,
    filterBy: null,
    viewMode: 'table'
  };
}

export interface DatabaseSourceDescriptor {
  noteId: string;
  noteTitle: string;
  noteIcon: string;
  blockId: string;
  title: string;
  columns: DatabaseColumn[];
  rowsCount: number;
  data: DatabaseBlockData;
}

/**
 * Discovers all database blocks across all accessible notes (including blocks nested in columns).
 */
export function findAllDatabaseSources(notes: NoteRecord[]): DatabaseSourceDescriptor[] {
  const sources: DatabaseSourceDescriptor[] = [];
  for (const note of notes) {
    const flat = flattenBlocks(note.blocks);
    for (const blk of flat) {
      if (blk.type === 'database' && blk.databaseData) {
        sources.push({
          noteId: note.id,
          noteTitle: note.title || 'Tanpa Judul',
          noteIcon: note.icon || '📄',
          blockId: blk.id,
          title: blk.databaseData.title || blk.content || 'Tabel Database',
          columns: blk.databaseData.columns || [],
          rowsCount: (blk.databaseData.rows || []).length,
          data: blk.databaseData
        });
      }
    }
  }
  return sources;
}

export function createDefaultChartData(
  sources: DatabaseSourceDescriptor[],
  preferredKind: ChartKind = 'bar',
  preferredSource?: { noteId: string; blockId: string }
): ChartBlockData {
  const matched =
    (preferredSource &&
      sources.find(
        (s) => s.noteId === preferredSource.noteId && s.blockId === preferredSource.blockId
      )) ||
    sources[0];

  if (!matched) {
    return {
      title: preferredKind === 'donut' ? 'Diagram Donat' : 'Diagram Batang',
      kind: preferredKind,
      sourceNoteId: '',
      sourceBlockId: '',
      categoryColumnId: '',
      valueColumnId: '',
      aggregation: 'count',
      sortOrder: 'value_desc',
      maxItems: 8,
      showLegend: true,
      showValues: true,
      palette: 'miu'
    };
  }

  const categoryCol =
    matched.columns.find((c) => c.type === 'select' || c.type === 'multi_select') ||
    matched.columns.find((c) => c.type === 'text' || c.type === 'date') ||
    matched.columns[0];
  const numericCol = matched.columns.find((c) => c.type === 'number');

  return {
    title:
      preferredKind === 'donut'
        ? `Proporsi ${matched.title}`
        : `Grafik ${matched.title}`,
    kind: preferredKind,
    sourceNoteId: matched.noteId,
    sourceBlockId: matched.blockId,
    categoryColumnId: categoryCol?.id || '',
    valueColumnId: numericCol?.id || '',
    aggregation: numericCol ? 'sum' : 'count',
    sortOrder: 'value_desc',
    maxItems: 8,
    showLegend: true,
    showValues: true,
    palette: 'miu'
  };
}

export function buildFormFieldsFromColumns(columns: DatabaseColumn[]): FormFieldConfig[] {
  return columns.map((col) => ({
    id: createDatabaseId('fld'),
    columnId: col.id,
    label: col.name,
    placeholder:
      col.type === 'number'
        ? 'Masukkan angka...'
        : col.type === 'url'
          ? 'https://...'
          : col.type === 'date'
            ? ''
            : `Isi ${col.name.toLowerCase()}...`,
    fieldType: col.type,
    options: col.options ? col.options.map((o) => ({ ...o })) : undefined,
    required: col.type !== 'checkbox',
    hidden: false
  }));
}

/**
 * Syncs missing database columns into an existing form's field list while preserving edited labels & order.
 */
export function syncFormFieldsWithDatabase(
  existingFields: FormFieldConfig[],
  columns: DatabaseColumn[]
): FormFieldConfig[] {
  const existingByColId = new Map(existingFields.map((f) => [f.columnId, f]));
  const updated: FormFieldConfig[] = [];

  for (const field of existingFields) {
    const col = columns.find((c) => c.id === field.columnId);
    if (!col) continue;
    updated.push({
      ...field,
      fieldType: col.type,
      options: col.options ? col.options.map((o) => ({ ...o })) : undefined
    });
  }

  for (const col of columns) {
    if (!existingByColId.has(col.id)) {
      updated.push(...buildFormFieldsFromColumns([col]));
    }
  }

  return updated;
}

export function createDefaultFormData(
  sources: DatabaseSourceDescriptor[],
  preferredSource?: { noteId: string; blockId: string }
): FormBlockData {
  const matched =
    (preferredSource &&
      sources.find(
        (s) => s.noteId === preferredSource.noteId && s.blockId === preferredSource.blockId
      )) ||
    sources[0];

  if (!matched) {
    return {
      title: 'Formulir Baru',
      description: 'Isi formulir ini untuk mengirim data otomatis ke Tabel Database.',
      targetNoteId: '',
      targetBlockId: '',
      fields: [],
      submitLabel: 'Kirim Formulir',
      successMessage: 'Terima kasih! Data Anda berhasil ditambahkan ke tabel.',
      responseAccess: 'edit_only',
      submissionCount: 0
    };
  }

  return {
    title: `Formulir ${matched.title}`,
    description: 'Jawaban yang dikirim akan otomatis masuk sebagai baris baru di tabel terhubung.',
    targetNoteId: matched.noteId,
    targetBlockId: matched.blockId,
    fields: buildFormFieldsFromColumns(matched.columns),
    submitLabel: 'Kirim Formulir',
    successMessage: 'Terima kasih! Jawaban Anda berhasil tersimpan ke tabel.',
    responseAccess: 'public',
    submissionCount: 0
  };
}

export function createDefaultMetricData(
  sources: DatabaseSourceDescriptor[],
  preferredSource?: { noteId: string; blockId: string }
): MetricBlockData {
  const matched =
    (preferredSource &&
      sources.find(
        (s) => s.noteId === preferredSource.noteId && s.blockId === preferredSource.blockId
      )) ||
    sources[0];

  if (!matched) {
    return {
      title: 'Progres Tugas Halaman',
      sourceKind: 'page_todos',
      operation: 'completion_rate',
      suffix: '%',
      accentColor: 'emerald'
    };
  }

  const numericCol = matched.columns.find((c) => c.type === 'number');
  return {
    title: numericCol ? `Total ${numericCol.name}` : `Jumlah ${matched.title}`,
    sourceKind: 'database',
    sourceNoteId: matched.noteId,
    sourceBlockId: matched.blockId,
    columnId: numericCol?.id || matched.columns[0]?.id,
    operation: numericCol ? 'sum' : 'count',
    prefix: numericCol?.numberFormat === 'currency_idr' ? 'Rp ' : '',
    suffix: numericCol?.numberFormat === 'percent' ? '%' : '',
    accentColor: 'sky'
  };
}

export interface ChartAggregationDatum {
  label: string;
  value: number;
  count: number;
  percent: number;
  color: string;
}

export interface ChartAggregationResult {
  items: ChartAggregationDatum[];
  totalValue: number;
  totalRows: number;
}

function getBadgeHexForLabel(
  col: DatabaseColumn | undefined,
  label: string
): string | undefined {
  if (!col?.options) return undefined;
  const opt = col.options.find((o) => o.label === label);
  return opt ? BADGE_COLOR_CLASSES[opt.color]?.dot : undefined;
}

function toFiniteNumber(val: DatabaseCellValue | undefined): number | null {
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  if (typeof val === 'string' && val.trim() !== '') {
    const cleaned = val.replace(/,/g, '').trim();
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function aggregateDatabaseForChart(
  dbData: DatabaseBlockData | undefined,
  config: ChartBlockData
): ChartAggregationResult {
  if (!dbData || dbData.columns.length === 0) {
    return { items: [], totalValue: 0, totalRows: 0 };
  }

  const catCol =
    dbData.columns.find((c) => c.id === config.categoryColumnId) || dbData.columns[0];
  const valCol = config.valueColumnId
    ? dbData.columns.find((c) => c.id === config.valueColumnId)
    : undefined;

  let rows = dbData.rows || [];
  if (config.filterColumnId && config.filterValue && config.filterValue !== '__ALL__') {
    const targetLower = config.filterValue.toLowerCase();
    rows = rows.filter((row) => {
      const raw = row.cells[config.filterColumnId!];
      if (Array.isArray(raw)) {
        return raw.some((item) => item.toLowerCase() === targetLower);
      }
      if (typeof raw === 'boolean') {
        return (raw ? 'selesai' : 'belum') === targetLower || String(raw) === targetLower;
      }
      return String(raw ?? '').toLowerCase() === targetLower;
    });
  }

  const groups = new Map<string, { sum: number; count: number; numericCount: number }>();
  const addEntry = (label: string, numVal: number | null) => {
    const existing = groups.get(label) || { sum: 0, count: 0, numericCount: 0 };
    existing.count += 1;
    if (numVal !== null) {
      existing.sum += numVal;
      existing.numericCount += 1;
    }
    groups.set(label, existing);
  };

  for (const row of rows) {
    const rawCat = row.cells[catCol.id];
    const numVal = valCol ? toFiniteNumber(row.cells[valCol.id]) : null;

    if (catCol.type === 'multi_select') {
      const tags = Array.isArray(rawCat)
        ? rawCat.filter(Boolean)
        : typeof rawCat === 'string' && rawCat.trim()
          ? [rawCat.trim()]
          : [];
      if (tags.length === 0) {
        addEntry('Kosong', numVal);
      } else {
        for (const tag of tags) addEntry(tag, numVal);
      }
    } else if (catCol.type === 'checkbox') {
      addEntry(rawCat ? 'Selesai' : 'Belum', numVal);
    } else {
      const label = String(rawCat ?? '').trim() || 'Kosong';
      addEntry(label, numVal);
    }
  }

  const palette = CHART_PALETTES[config.palette || 'miu'] || CHART_PALETTES.miu;
  let items = Array.from(groups.entries()).map(([label, stats], idx) => {
    let value = stats.count;
    if (config.aggregation === 'sum' && valCol) {
      value = stats.sum;
    } else if (config.aggregation === 'avg' && valCol) {
      value = stats.numericCount > 0 ? stats.sum / stats.numericCount : 0;
    }
    const rounded = Math.round(value * 100) / 100;
    const optionHex = getBadgeHexForLabel(catCol, label);
    return {
      label,
      value: rounded,
      count: stats.count,
      percent: 0,
      color: optionHex || palette[idx % palette.length]
    };
  });

  if (config.sortOrder === 'value_asc') {
    items.sort((a, b) => a.value - b.value || a.label.localeCompare(b.label));
  } else if (config.sortOrder === 'label_asc') {
    items.sort((a, b) => a.label.localeCompare(b.label));
  } else {
    items.sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  }

  const maxItems = Math.max(2, config.maxItems || 8);
  if (items.length > maxItems) {
    const head = items.slice(0, maxItems - 1);
    const tail = items.slice(maxItems - 1);
    const tailCount = tail.reduce((acc, item) => acc + item.count, 0);
    const tailValue =
      config.aggregation === 'avg'
        ? Math.round((tail.reduce((acc, item) => acc + item.value, 0) / tail.length) * 100) / 100
        : Math.round(tail.reduce((acc, item) => acc + item.value, 0) * 100) / 100;
    items = [
      ...head,
      {
        label: 'Lainnya',
        value: tailValue,
        count: tailCount,
        percent: 0,
        color: '#94a3b8'
      }
    ];
  }

  // Re-assign fallback palette colors cleanly when options didn't specify colors
  items = items.map((item, idx) => ({
    ...item,
    color: getBadgeHexForLabel(catCol, item.label) || (item.label === 'Lainnya' ? '#94a3b8' : palette[idx % palette.length])
  }));

  const positiveSum = items.reduce((acc, item) => acc + Math.max(0, item.value), 0);
  items = items.map((item) => ({
    ...item,
    percent: positiveSum > 0 ? Math.round((Math.max(0, item.value) / positiveSum) * 1000) / 10 : 0
  }));

  const totalValue =
    config.aggregation === 'avg' && items.length > 0
      ? Math.round((items.reduce((acc, i) => acc + i.value, 0) / items.length) * 100) / 100
      : Math.round(items.reduce((acc, i) => acc + i.value, 0) * 100) / 100;

  return {
    items,
    totalValue,
    totalRows: rows.length
  };
}

export function formatDatabaseNumber(
  num: number,
  format: DatabaseColumn['numberFormat'] = 'plain'
): string {
  if (!Number.isFinite(num)) return '0';
  if (format === 'currency_idr') {
    return `Rp ${num.toLocaleString('id-ID')}`;
  }
  if (format === 'percent') {
    return `${num.toLocaleString('id-ID', { maximumFractionDigits: 2 })}%`;
  }
  return num.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}

export function computeColumnSummary(
  rows: DatabaseRow[],
  col: DatabaseColumn
): { label: string; value: string } | null {
  const agg = col.aggregation || 'none';
  if (agg === 'none') return null;

  if (agg === 'count') {
    const filled = rows.filter((r) => {
      const v = r.cells[col.id];
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === 'boolean') return true;
      return v !== undefined && v !== null && String(v).trim() !== '';
    }).length;
    return { label: 'Jumlah', value: `${filled}` };
  }

  if (agg === 'checked') {
    const checked = rows.filter((r) => Boolean(r.cells[col.id])).length;
    const total = rows.length;
    const pct = total > 0 ? Math.round((checked / total) * 100) : 0;
    return { label: 'Selesai', value: `${checked}/${total} (${pct}%)` };
  }

  const nums = rows
    .map((r) => toFiniteNumber(r.cells[col.id]))
    .filter((n): n is number => n !== null);

  if (nums.length === 0) {
    return { label: agg.toUpperCase(), value: '—' };
  }

  if (agg === 'sum') {
    const sum = nums.reduce((a, b) => a + b, 0);
    return { label: 'Total', value: formatDatabaseNumber(sum, col.numberFormat) };
  }
  if (agg === 'avg') {
    const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
    return { label: 'Rata-rata', value: formatDatabaseNumber(avg, col.numberFormat) };
  }
  if (agg === 'min') {
    return { label: 'Min', value: formatDatabaseNumber(Math.min(...nums), col.numberFormat) };
  }
  if (agg === 'max') {
    return { label: 'Max', value: formatDatabaseNumber(Math.max(...nums), col.numberFormat) };
  }
  return null;
}

export function computeMetricValue(
  dbData: DatabaseBlockData | undefined,
  blocksInNote: NoteBlock[],
  config: MetricBlockData
): { displayValue: string; subtitle: string } {
  if (config.sourceKind === 'page_todos') {
    const flat = flattenBlocks(blocksInNote);
    const todoBlocks = flat.filter((b) => b.type === 'todo' || b.type === 'deadline');
    const total = todoBlocks.length;
    const done = todoBlocks.filter((b) => Boolean(b.checked)).length;
    if (config.operation === 'count') {
      return {
        displayValue: `${config.prefix || ''}${done}/${total}${config.suffix || ''}`,
        subtitle: `${done} dari ${total} tugas selesai`
      };
    }
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return {
      displayValue: `${config.prefix || ''}${pct}${config.suffix ?? '%'}`,
      subtitle: `${done} dari ${total} tugas selesai`
    };
  }

  if (!dbData) {
    return { displayValue: '—', subtitle: 'Sumber tabel belum terhubung' };
  }

  const rows = dbData.rows || [];
  if (config.operation === 'count') {
    return {
      displayValue: `${config.prefix || ''}${rows.length.toLocaleString('id-ID')}${config.suffix || ''}`,
      subtitle: `Total baris di ${dbData.title}`
    };
  }

  const col = dbData.columns.find((c) => c.id === config.columnId) || dbData.columns[0];
  if (!col) {
    return { displayValue: '0', subtitle: dbData.title };
  }

  if (config.operation === 'completion_rate') {
    const done = rows.filter((r) => Boolean(r.cells[col.id])).length;
    const pct = rows.length > 0 ? Math.round((done / rows.length) * 100) : 0;
    return {
      displayValue: `${config.prefix || ''}${pct}${config.suffix ?? '%'}`,
      subtitle: `${done}/${rows.length} tercentang · ${dbData.title}`
    };
  }

  const nums = rows
    .map((r) => toFiniteNumber(r.cells[col.id]))
    .filter((n): n is number => n !== null);

  if (nums.length === 0) {
    return { displayValue: `${config.prefix || ''}0${config.suffix || ''}`, subtitle: `${col.name} · ${dbData.title}` };
  }

  const rawVal =
    config.operation === 'avg'
      ? nums.reduce((a, b) => a + b, 0) / nums.length
      : nums.reduce((a, b) => a + b, 0);

  const formatted = rawVal.toLocaleString('id-ID', { maximumFractionDigits: 2 });
  return {
    displayValue: `${config.prefix || ''}${formatted}${config.suffix || ''}`,
    subtitle: `${config.operation === 'avg' ? 'Rata-rata' : 'Total'} ${col.name} · ${dbData.title}`
  };
}

export interface SanitizedFormResult {
  ok: boolean;
  row?: DatabaseRow;
  errors: Record<string, string>;
}

/**
 * Validates and normalizes submitted form values against form fields and target database columns.
 */
export function sanitizeFormSubmission(
  formData: FormBlockData,
  dbColumns: DatabaseColumn[],
  rawValues: Record<string, unknown>
): SanitizedFormResult {
  const errors: Record<string, string> = {};
  const cells: Record<string, DatabaseCellValue> = {};
  const colMap = new Map(dbColumns.map((c) => [c.id, c]));

  for (const field of formData.fields) {
    if (field.hidden) continue;
    const col = colMap.get(field.columnId);
    if (!col) continue;

    const raw = rawValues[field.columnId];
    const fieldType: DatabaseColumnType = col.type || field.fieldType;

    if (fieldType === 'checkbox') {
      const boolVal = raw === true || raw === 'true' || raw === 'on' || raw === 1;
      if (field.required && !boolVal) {
        errors[field.columnId] = 'Wajib dicentang.';
      } else {
        cells[field.columnId] = boolVal;
      }
      continue;
    }

    if (fieldType === 'multi_select') {
      const arr = Array.isArray(raw)
        ? raw.map((item) => String(item).trim()).filter(Boolean)
        : typeof raw === 'string' && raw.trim()
          ? raw
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : [];
      if (field.required && arr.length === 0) {
        errors[field.columnId] = 'Pilih minimal satu opsi.';
      } else {
        cells[field.columnId] = arr;
      }
      continue;
    }

    const strVal = raw === undefined || raw === null ? '' : String(raw).trim();
    if (field.required && !strVal) {
      errors[field.columnId] = 'Pertanyaan ini wajib diisi.';
      continue;
    }

    if (!strVal) {
      cells[field.columnId] = '';
      continue;
    }

    if (fieldType === 'number') {
      const num = toFiniteNumber(strVal);
      if (num === null) {
        errors[field.columnId] = 'Masukkan angka yang valid.';
      } else {
        cells[field.columnId] = num;
      }
      continue;
    }

    if (fieldType === 'url') {
      const parsed = parseLinkUrl(strVal);
      if (!parsed.isValid) {
        errors[field.columnId] = parsed.errorLabel || 'URL tidak valid.';
      } else {
        cells[field.columnId] = parsed.url;
      }
      continue;
    }

    cells[field.columnId] = strVal;
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  const now = Date.now();
  return {
    ok: true,
    errors: {},
    row: {
      id: createDatabaseId('row'),
      cells,
      createdAt: now,
      updatedAt: now,
      source: 'form'
    }
  };
}

export function formatDatabaseCellDisplay(
  value: DatabaseCellValue | undefined,
  col: DatabaseColumn
): string {
  if (value === undefined || value === null) return '';
  if (col.type === 'checkbox') return value ? '✓' : '—';
  if (Array.isArray(value)) return value.join(', ');
  if (col.type === 'number') {
    const n = toFiniteNumber(value);
    return n !== null ? formatDatabaseNumber(n, col.numberFormat) : '';
  }
  return String(value);
}

function escapeCsvCell(val: string): string {
  if (/[",\n\r]/.test(val)) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export function exportDatabaseToCsv(dbData: DatabaseBlockData): string {
  const headers = dbData.columns.map((c) => escapeCsvCell(c.name));
  const lines = [headers.join(',')];
  for (const row of dbData.rows || []) {
    const cells = dbData.columns.map((col) =>
      escapeCsvCell(formatDatabaseCellDisplay(row.cells[col.id], col))
    );
    lines.push(cells.join(','));
  }
  return lines.join('\n');
}

export function databaseToMarkdownTable(
  dbData: DatabaseBlockData,
  maxRows = 50
): string {
  if (!dbData.columns || dbData.columns.length === 0) return '';
  const sanitizeMd = (text: string) => text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
  const header = `| ${dbData.columns.map((c) => sanitizeMd(c.name)).join(' | ')} |`;
  const sep = `| ${dbData.columns.map(() => '---').join(' | ')} |`;
  const rows = (dbData.rows || []).slice(0, maxRows).map((row) => {
    const vals = dbData.columns.map((col) =>
      sanitizeMd(formatDatabaseCellDisplay(row.cells[col.id], col))
    );
    return `| ${vals.join(' | ')} |`;
  });
  const lines = [header, sep, ...rows];
  if ((dbData.rows || []).length > maxRows) {
    lines.push(`_(Menampilkan ${maxRows} dari ${dbData.rows.length} baris)_`);
  }
  return lines.join('\n');
}

export function createSelectOption(
  label: string,
  indexHint = 0
): DatabaseSelectOption {
  return {
    id: createDatabaseId('opt'),
    label: label.trim(),
    color: BADGE_COLOR_ORDER[indexHint % BADGE_COLOR_ORDER.length]
  };
}
