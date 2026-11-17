import type React from 'react';
import {
  BarChart3,
  CalendarDays,
  CheckSquare,
  ChevronRight,
  ClipboardList,
  Code2,
  Columns2,
  Columns3,
  Columns4,
  Database,
  FilePlus2,
  FileText,
  Gauge,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  LayoutGrid,
  Lightbulb,
  Link2,
  List,
  ListOrdered,
  Minus,
  PieChart,
  Quote,
  Sigma,
  Type,
  Video
} from 'lucide-react';
import type { BlockType, ChartKind } from '../types/miu';

export interface SlashPreset {
  chartKind?: ChartKind;
  columnCount?: 2 | 3 | 4 | 5;
}

export interface SlashOptionItem {
  id: string;
  type: BlockType;
  label: string;
  shortcut: string;
  keywords: string[];
  desc: string;
  category: 'basic' | 'media' | 'data' | 'layout';
  Icon: React.FC<{ className?: string }>;
  preset?: SlashPreset;
}

export const SLASH_OPTIONS: SlashOptionItem[] = [
  {
    id: 'text',
    type: 'text',
    label: 'Teks',
    shortcut: 'p',
    keywords: ['text', 'paragraf'],
    desc: 'Paragraf teks biasa',
    category: 'basic',
    Icon: Type
  },
  {
    id: 'h1',
    type: 'h1',
    label: 'Heading 1',
    shortcut: '#',
    keywords: ['h1', 'judul'],
    desc: 'Judul bagian besar',
    category: 'basic',
    Icon: Heading1
  },
  {
    id: 'h2',
    type: 'h2',
    label: 'Heading 2',
    shortcut: '##',
    keywords: ['h2', 'subjudul'],
    desc: 'Judul bagian sedang',
    category: 'basic',
    Icon: Heading2
  },
  {
    id: 'h3',
    type: 'h3',
    label: 'Heading 3',
    shortcut: '###',
    keywords: ['h3'],
    desc: 'Judul bagian kecil',
    category: 'basic',
    Icon: Heading3
  },
  {
    id: 'todo',
    type: 'todo',
    label: 'To-do List',
    shortcut: '[]',
    keywords: ['todo', 'checklist', 'tugas'],
    desc: 'Checklist tugas',
    category: 'basic',
    Icon: CheckSquare
  },
  {
    id: 'deadline',
    type: 'deadline',
    label: 'Deadline Tugas',
    shortcut: 'deadline',
    keywords: ['deadline', 'jadwal', 'kalender'],
    desc: 'Blok deadline tugas yang otomatis masuk ke Kalender',
    category: 'basic',
    Icon: CalendarDays
  },
  {
    id: 'bullet',
    type: 'bullet',
    label: 'Bulleted List',
    shortcut: '-',
    keywords: ['bullet', 'list', 'poin'],
    desc: 'Daftar poin bullet',
    category: 'basic',
    Icon: List
  },
  {
    id: 'numbered',
    type: 'numbered',
    label: 'Numbered List',
    shortcut: '1.',
    keywords: ['numbered', 'angka', 'nomor'],
    desc: 'Daftar poin bernomor',
    category: 'basic',
    Icon: ListOrdered
  },
  {
    id: 'toggle',
    type: 'toggle',
    label: 'Toggle List',
    shortcut: '>',
    keywords: ['toggle', 'lipat'],
    desc: 'Lipatan materi buka-tutup',
    category: 'basic',
    Icon: ChevronRight
  },
  {
    id: 'image',
    type: 'image',
    label: 'Gambar',
    shortcut: 'img',
    keywords: ['image', 'foto', 'gambar'],
    desc: 'Unggah gambar ke Cloud Catatan',
    category: 'media',
    Icon: ImageIcon
  },
  {
    id: 'database',
    type: 'database',
    label: 'Tabel Database',
    shortcut: 'tabel',
    keywords: ['database', 'table', 'tabel', 'db', 'spreadsheet'],
    desc: 'Tabel database terstruktur yang bisa terhubung ke diagram & formulir',
    category: 'data',
    Icon: Database
  },
  {
    id: 'chart-bar',
    type: 'chart',
    label: 'Diagram Batang',
    shortcut: 'batang',
    keywords: ['bar', 'chart', 'diagram', 'grafik', 'batang'],
    desc: 'Diagram batang live terhubung ke Tabel Database',
    category: 'data',
    Icon: BarChart3,
    preset: { chartKind: 'bar' }
  },
  {
    id: 'chart-donut',
    type: 'chart',
    label: 'Diagram Donat',
    shortcut: 'donat',
    keywords: ['donut', 'donat', 'pie', 'chart', 'diagram', 'grafik'],
    desc: 'Diagram donat proporsi live terhubung ke Tabel Database',
    category: 'data',
    Icon: PieChart,
    preset: { chartKind: 'donut' }
  },
  {
    id: 'form',
    type: 'form',
    label: 'Formulir',
    shortcut: 'form',
    keywords: ['form', 'formulir', 'survei', 'kuesioner', 'input'],
    desc: 'Formulir yang bisa diedit & langsung mengisi Tabel Database',
    category: 'data',
    Icon: ClipboardList
  },
  {
    id: 'metric',
    type: 'metric',
    label: 'Kartu Metrik / KPI',
    shortcut: 'metric',
    keywords: ['metric', 'kpi', 'progress', 'ringkasan', 'statistik'],
    desc: 'Ringkasan angka & progres otomatis dari Database atau To-do',
    category: 'data',
    Icon: Gauge
  },
  {
    id: 'columns-2',
    type: 'columns',
    label: '2 Kolom',
    shortcut: '2kolom',
    keywords: ['2', '2k', '2kolom', '2col', 'kolom', 'columns'],
    desc: 'Tata letak 2 kolom berdampingan (2 columns)',
    category: 'layout',
    Icon: Columns2,
    preset: { columnCount: 2 }
  },
  {
    id: 'columns-3',
    type: 'columns',
    label: '3 Kolom',
    shortcut: '3kolom',
    keywords: ['3', '3k', '3kolom', '3col', 'kolom', 'columns'],
    desc: 'Tata letak 3 kolom berdampingan (3 columns)',
    category: 'layout',
    Icon: Columns3,
    preset: { columnCount: 3 }
  },
  {
    id: 'columns-4',
    type: 'columns',
    label: '4 Kolom',
    shortcut: '4kolom',
    keywords: ['4', '4k', '4kolom', '4col', 'kolom', 'columns'],
    desc: 'Tata letak 4 kolom berdampingan (4 columns)',
    category: 'layout',
    Icon: Columns4,
    preset: { columnCount: 4 }
  },
  {
    id: 'columns-5',
    type: 'columns',
    label: '5 Kolom',
    shortcut: '5kolom',
    keywords: ['5', '5k', '5kolom', '5col', 'kolom', 'columns'],
    desc: 'Tata letak 5 kolom berdampingan (5 columns)',
    category: 'layout',
    Icon: LayoutGrid,
    preset: { columnCount: 5 }
  },
  {
    id: 'video',
    type: 'video',
    label: 'Video / YouTube',
    shortcut: 'yt',
    keywords: ['video', 'youtube', 'yt', 'mp4'],
    desc: 'Sematkan YouTube atau URL video (.mp4)',
    category: 'media',
    Icon: Video
  },
  {
    id: 'link',
    type: 'link',
    label: 'URL Link',
    shortcut: 'link',
    keywords: ['link', 'url', 'tautan', 'bookmark', 'web'],
    desc: 'Tambahkan tautan URL web atau bookmark',
    category: 'media',
    Icon: Link2
  },
  {
    id: 'pdf',
    type: 'pdf',
    label: 'Dokumen PDF',
    shortcut: 'pdf',
    keywords: ['pdf', 'dokumen', 'file'],
    desc: 'Unggah file PDF & ekstrak teks untuk AI',
    category: 'media',
    Icon: FileText
  },
  {
    id: 'subpage',
    type: 'subpage',
    label: 'Subhalaman Baru',
    shortcut: 'sub',
    keywords: ['subpage', 'sub', 'halaman'],
    desc: 'Buat subhalaman di dalam halaman ini',
    category: 'basic',
    Icon: FilePlus2
  },
  {
    id: 'callout',
    type: 'callout',
    label: 'Callout',
    shortcut: '!',
    keywords: ['callout', 'catatan', 'sorotan'],
    desc: 'Kotak sorotan penting',
    category: 'basic',
    Icon: Lightbulb
  },
  {
    id: 'quote',
    type: 'quote',
    label: 'Quote',
    shortcut: '"',
    keywords: ['quote', 'kutipan'],
    desc: 'Kutipan teks',
    category: 'basic',
    Icon: Quote
  },
  {
    id: 'divider',
    type: 'divider',
    label: 'Divider',
    shortcut: '---',
    keywords: ['divider', 'garis', 'hr'],
    desc: 'Garis pemisah',
    category: 'basic',
    Icon: Minus
  },
  {
    id: 'code',
    type: 'code',
    label: 'Code Block',
    shortcut: '```',
    keywords: ['code', 'kode', 'program'],
    desc: 'Blok kode program',
    category: 'basic',
    Icon: Code2
  },
  {
    id: 'math',
    type: 'math',
    label: 'Rumus LaTeX',
    shortcut: '$$',
    keywords: ['math', 'latex', 'rumus', 'katex'],
    desc: 'Persamaan matematika KaTeX',
    category: 'basic',
    Icon: Sigma
  }
];

export function filterSlashOptions(
  query: string,
  insideColumn = false
): SlashOptionItem[] {
  const pool = insideColumn
    ? SLASH_OPTIONS.filter((opt) => opt.type !== 'columns')
    : SLASH_OPTIONS;

  const q = query.trim().toLowerCase();
  if (!q) return pool;

  const getRank = (opt: SlashOptionItem): number => {
    const label = opt.label.toLowerCase();
    const type = opt.type.toLowerCase();
    const shortcut = opt.shortcut.toLowerCase();
    const desc = opt.desc.toLowerCase();
    const keywords = opt.keywords.map((k) => k.toLowerCase());

    if (
      opt.id.toLowerCase() === q ||
      type === q ||
      shortcut === q ||
      label === q ||
      keywords.includes(q)
    ) {
      return 0;
    }
    if (
      type.startsWith(q) ||
      shortcut.startsWith(q) ||
      label.startsWith(q) ||
      keywords.some((k) => k.startsWith(q))
    ) {
      return 1;
    }
    if (
      type.includes(q) ||
      shortcut.includes(q) ||
      label.includes(q) ||
      keywords.some((k) => k.includes(q))
    ) {
      return 2;
    }
    if (desc.includes(q)) {
      return 3;
    }
    return -1;
  };

  return pool
    .map((opt, idx) => ({ opt, idx, rank: getRank(opt) }))
    .filter((entry) => entry.rank !== -1)
    .sort((a, b) => a.rank - b.rank || a.idx - b.idx)
    .map((entry) => entry.opt);
}
