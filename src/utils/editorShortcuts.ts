import type { BlockType } from '../types/miu';

export interface InlineFormatResult {
  nextValue: string;
  nextSelectionStart: number;
  nextSelectionEnd: number;
}

/**
 * Toggles inline Markdown markers around the current selection (or inserts empty markers
 * with the caret placed inside when selection is collapsed).
 */
export function applyInlineMarkdownShortcut(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  openMarker: string,
  closeMarker: string = openMarker
): InlineFormatResult {
  const safeStart = Math.max(0, Math.min(value.length, selectionStart));
  const safeEnd = Math.max(safeStart, Math.min(value.length, selectionEnd));
  const selected = value.slice(safeStart, safeEnd);

  // Case 1: Selected text itself starts & ends with markers -> unwrap
  if (
    selected.length >= openMarker.length + closeMarker.length &&
    selected.startsWith(openMarker) &&
    selected.endsWith(closeMarker)
  ) {
    const inner = selected.slice(openMarker.length, selected.length - closeMarker.length);
    const nextValue = value.slice(0, safeStart) + inner + value.slice(safeEnd);
    return {
      nextValue,
      nextSelectionStart: safeStart,
      nextSelectionEnd: safeStart + inner.length
    };
  }

  // Case 2: Markers sit immediately outside the selection -> unwrap
  const before = value.slice(0, safeStart);
  const after = value.slice(safeEnd);
  if (before.endsWith(openMarker) && after.startsWith(closeMarker)) {
    const nextValue =
      before.slice(0, before.length - openMarker.length) +
      selected +
      after.slice(closeMarker.length);
    const unwrappedStart = safeStart - openMarker.length;
    return {
      nextValue,
      nextSelectionStart: unwrappedStart,
      nextSelectionEnd: unwrappedStart + selected.length
    };
  }

  // Case 3: Wrap selection (or place cursor between empty markers)
  const nextValue = before + openMarker + selected + closeMarker + after;
  const nextStart = safeStart + openMarker.length;
  return {
    nextValue,
    nextSelectionStart: nextStart,
    nextSelectionEnd: nextStart + selected.length
  };
}

/**
 * Resolves standard Notion-style block conversion shortcuts: Cmd/Ctrl + Alt + 0..9.
 * Uses KeyboardEvent.code (Digit0..Digit9) so macOS Option+digit characters work reliably.
 */
export function resolveBlockConvertShortcut(e: {
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  code: string;
  key: string;
}): BlockType | null {
  if (!(e.metaKey || e.ctrlKey) || !e.altKey || e.shiftKey) return null;

  const digitMap: Record<string, BlockType> = {
    Digit0: 'text',
    Digit1: 'h1',
    Digit2: 'h2',
    Digit3: 'h3',
    Digit4: 'todo',
    Digit5: 'bullet',
    Digit6: 'numbered',
    Digit7: 'toggle',
    Digit8: 'code',
    Digit9: 'callout',
    '0': 'text',
    '1': 'h1',
    '2': 'h2',
    '3': 'h3',
    '4': 'todo',
    '5': 'bullet',
    '6': 'numbered',
    '7': 'toggle',
    '8': 'code',
    '9': 'callout'
  };

  return digitMap[e.code] || digitMap[e.key] || null;
}

export function isEditableElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  return Boolean(target.isContentEditable);
}

export interface ShortcutGuideItem {
  keys: string;
  label: string;
  description?: string;
}

export interface ShortcutGuideGroup {
  title: string;
  items: ShortcutGuideItem[];
}

export const NOTE_SHORTCUT_GROUPS: ShortcutGuideGroup[] = [
  {
    title: 'Navigasi & Halaman',
    items: [
      { keys: '⌘K / Ctrl+K', label: 'Cari atau tanya di sidebar' },
      { keys: '⌘\\ / Ctrl+\\', label: 'Buka / tutup bilah sisi kiri' },
      { keys: '⌘J / Ctrl+J', label: 'Buka / tutup Asisten Miu AI' },
      { keys: 'Alt+N', label: 'Buat halaman catatan baru' },
      { keys: '⌘D / Ctrl+D', label: 'Duplikatkan halaman (atau blok terpilih)' },
      { keys: '⌘⇧R / Ctrl+Shift+R', label: 'Ganti nama halaman aktif' },
      { keys: '⌘⇧P / Ctrl+Shift+P', label: 'Pindahkan halaman ke induk lain' },
      { keys: '⌘⌥L / Ctrl+Alt+L', label: 'Salin tautan halaman aktif' },
      { keys: '⌘⇧↵ / Ctrl+Shift+Enter', label: 'Buka halaman di tab baru' },
      { keys: '⌥Klik / Alt+Klik', label: 'Buka halaman di Side Peek kanan' },
      { keys: '⌘⇧. / Ctrl+Shift+.', label: 'Tampilkan / sembunyikan bilah info bawah' },
      { keys: '⌘⇧L / Ctrl+Shift+L', label: 'Ganti tema Terang / Gelap' },
      { keys: '⌘/ / Ctrl+/', label: 'Buka / tutup daftar pintasan ini' }
    ]
  },
  {
    title: 'Format Teks di Dalam Blok',
    items: [
      { keys: '⌘B / Ctrl+B', label: 'Tebal (**bold**)' },
      { keys: '⌘I / Ctrl+I', label: 'Miring (*italic*)' },
      { keys: '⌘U / Ctrl+U', label: 'Garis bawah (<u>underline</u>)' },
      { keys: '⌘E / Ctrl+E', label: 'Kode inline (`code`)' },
      { keys: '⌘⇧S / Ctrl+Shift+S', label: 'Coret (~~strikethrough~~)' },
      { keys: '⌘⇧H / Ctrl+Shift+H', label: 'Sorot (==highlight==)' }
    ]
  },
  {
    title: 'Edit, Navigasi & Susun Blok',
    items: [
      { keys: '/', label: 'Buka menu blok Slash Command' },
      { keys: '⌘⌥0 – ⌘⌥9', label: 'Ubah tipe blok (0: Teks, 1-3: Heading, 4: To-do, 5: Poin, 6: Nomor, 7: Toggle, 8: Kode, 9: Callout)' },
      { keys: '⌘⇧↑ / ⌘⇧↓ atau Alt+↑/↓', label: 'Pindahkan blok ke atas / bawah' },
      { keys: '⌘⇧D / Ctrl+Shift+D', label: 'Duplikatkan blok aktif' },
      { keys: '⌘↵ / Ctrl+Enter', label: 'Centang to-do, buka/tutup toggle, atau tambah blok di bawah kode' },
      { keys: '↑ / ↓', label: 'Pindah fokus antar blok di atas / bawah' },
      { keys: 'Tab (di Blok Kode)', label: 'Sisipkan indentasi 2 spasi' },
      { keys: 'Backspace (awal blok)', label: 'Ubah blok kembali ke teks atau hapus blok kosong' },
      { keys: '⌘Z / ⌘⇧Z', label: 'Undo / Redo perubahan struktur blok' },
      { keys: 'Esc', label: 'Tutup menu, batalkan pilihan blok, atau tutup Side Peek' }
    ]
  },
  {
    title: 'Pintasan Markdown Otomatis (Awal Baris)',
    items: [
      { keys: '# / ## / ### + Spasi', label: 'Heading 1 / 2 / 3' },
      { keys: '- atau * + Spasi', label: 'Daftar poin (Bullet list)' },
      { keys: '1. + Spasi', label: 'Daftar bernomor (Numbered list)' },
      { keys: '[] atau [x] + Spasi', label: 'Daftar tugas (To-do)' },
      { keys: '> atau " + Spasi', label: 'Kutipan (Quote)' },
      { keys: '>> + Spasi', label: 'Daftar Toggle' },
      { keys: '! + Spasi', label: 'Blok Callout' },
      { keys: '---', label: 'Garis pemisah (Divider)' },
      { keys: '``` + Spasi', label: 'Blok Kode (atau ```mermaid + Spasi)' },
      { keys: '$$ + Spasi', label: 'Blok Rumus Matematika (LaTeX)' }
    ]
  }
];
