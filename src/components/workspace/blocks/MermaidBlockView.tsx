'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Code2,
  Copy,
  Download,
  Eye,
  Sparkles,
  Workflow,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import type { NoteBlock, ThemeMode } from '../../../types/miu';

export const MERMAID_TEMPLATES: Record<
  string,
  { label: string; code: string }
> = {
  flowchart: {
    label: 'Flowchart',
    code: `flowchart TD
  A[Mulai] --> B{Kondisi Terpenuhi?}
  B -->|Ya| C[Jalankan Proses]
  B -->|Tidak| D[Perbaiki Input]
  C --> E[Selesai]`
  },
  mindmap: {
    label: 'Mindmap',
    code: `mindmap
  root((Topik Utama))
    Konsep Dasar
      Definisi
      Contoh Kasus
    Implementasi
      Langkah 1
      Langkah 2
    Evaluasi`
  },
  sequence: {
    label: 'Sequence',
    code: `sequenceDiagram
  actor User
  participant App as Miu App
  participant DB as Neon Postgres
  User->>App: Edit Catatan
  App->>DB: Simpan Blok
  DB-->>App: Realtime Sync`
  },
  er: {
    label: 'ER Diagram',
    code: `erDiagram
  COURSE ||--o{ NOTE : has
  NOTE ||--o{ COMMENT : receives
  USER ||--o{ NOTE : owns`
  },
  timeline: {
    label: 'Timeline',
    code: `timeline
  title Rencana Belajar Semester
  Minggu 1-3 : Pengenalan Materi
  Minggu 4-7 : Praktikum & Latihan
  Minggu 8   : UTS`
  }
};

export const DEFAULT_MERMAID_CODE = MERMAID_TEMPLATES.flowchart.code;

let mermaidModulePromise: Promise<typeof import('mermaid')['default']> | null = null;
function loadMermaid() {
  if (!mermaidModulePromise) {
    mermaidModulePromise = import('mermaid').then((mod) => mod.default);
  }
  return mermaidModulePromise;
}

interface MermaidBlockViewProps {
  block: NoteBlock;
  theme: ThemeMode;
  canEdit: boolean;
  onChangeCode: (code: string) => void;
  onChangeCaption: (caption: string) => void;
  onAskAI?: (code: string) => void;
}

export const MermaidBlockView: React.FC<MermaidBlockViewProps> = ({
  block,
  theme,
  canEdit,
  onChangeCode,
  onChangeCaption,
  onAskAI
}) => {
  const reactId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const code = block.content || '';
  const [showEditor, setShowEditor] = useState<boolean>(canEdit && !code.trim());
  const [svgMarkup, setSvgMarkup] = useState<string>('');
  const [renderError, setRenderError] = useState<string>('');
  const [zoom, setZoom] = useState<number>(1);
  const [copied, setCopied] = useState(false);

  const renderSeqRef = useRef(0);
  const sandboxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const trimmed = code.trim();
    if (!trimmed) {
      setSvgMarkup('');
      setRenderError('');
      return;
    }

    let cancelled = false;
    const seq = ++renderSeqRef.current;

    const timer = window.setTimeout(async () => {
      try {
        const mermaid = await loadMermaid();
        if (cancelled) return;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: theme === 'dark' ? 'dark' : 'default',
          fontFamily: 'inherit'
        });
        const renderId = `miu-mmd-${reactId}-${seq}`;
        const { svg } = await mermaid.render(
          renderId,
          trimmed,
          sandboxRef.current || undefined
        );
        if (!cancelled && seq === renderSeqRef.current) {
          setSvgMarkup(svg);
          setRenderError('');
        }
      } catch (err) {
        if (!cancelled && seq === renderSeqRef.current) {
          const msg =
            err instanceof Error ? err.message : 'Sintaks Mermaid belum valid.';
          setRenderError(msg.split('\n')[0] || 'Sintaks Mermaid belum valid.');
        }
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [code, theme, reactId]);

  const handleDownloadSvg = () => {
    if (!svgMarkup) return;
    const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(block.caption || 'diagram-mermaid')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="my-2 rounded-2xl border border-border-subtle bg-subtle/45 overflow-hidden">
      {/* Offscreen container for mermaid temporary DOM */}
      <div ref={sandboxRef} className="hidden" aria-hidden="true" />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-subtle/80 border-b border-border-subtle/80 text-xs">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Workflow className="w-4 h-4 text-accent-strong shrink-0" />
          {canEdit ? (
            <input
              type="text"
              value={block.caption || ''}
              onChange={(e) => onChangeCaption(e.target.value)}
              placeholder="Judul Diagram Mermaid..."
              className="bg-transparent font-semibold text-text-primary placeholder:text-text-secondary/50 focus:outline-none min-w-0 flex-1 text-xs"
            />
          ) : (
            <span className="font-semibold text-text-primary truncate">
              {block.caption || 'Diagram Mermaid'}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1 no-print">
          {canEdit && showEditor && (
            <select
              aria-label="Template Diagram Mermaid"
              value=""
              onChange={(e) => {
                const key = e.target.value;
                if (key && MERMAID_TEMPLATES[key]) {
                  onChangeCode(MERMAID_TEMPLATES[key].code);
                }
              }}
              className="px-2 py-1 rounded-lg bg-surface border border-border-subtle text-[11px] text-text-primary focus:outline-none cursor-pointer"
            >
              <option value="">Template...</option>
              {Object.entries(MERMAID_TEMPLATES).map(([k, item]) => (
                <option key={k} value={k}>
                  {item.label}
                </option>
              ))}
            </select>
          )}

          {svgMarkup && (
            <>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.15).toFixed(2)))}
                className="p-1 rounded-lg bg-surface border border-border-subtle text-text-secondary hover:text-text-primary transition"
                title="Perkecil diagram"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setZoom(1)}
                className="px-1.5 py-0.5 rounded-lg bg-surface border border-border-subtle text-[10px] font-mono text-text-secondary hover:text-text-primary transition"
                title="Reset zoom"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(1.8, +(z + 0.15).toFixed(2)))}
                className="p-1 rounded-lg bg-surface border border-border-subtle text-text-secondary hover:text-text-primary transition"
                title="Perbesar diagram"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleDownloadSvg}
                className="p-1 rounded-lg bg-surface border border-border-subtle text-text-secondary hover:text-text-primary transition"
                title="Unduh SVG"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(code);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-surface border border-border-subtle text-[11px] text-text-secondary hover:text-text-primary transition"
            title="Salin kode Mermaid"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
            <span className="hidden sm:inline">{copied ? 'Tersalin' : 'Kode'}</span>
          </button>

          {onAskAI && code.trim() && (
            <button
              type="button"
              onClick={() => onAskAI(code)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 text-[11px] font-medium transition"
              title="Minta AI jelaskan atau perbaiki diagram"
            >
              <Sparkles className="w-3 h-3" />
              <span>AI</span>
            </button>
          )}

          {canEdit && (
            <button
              type="button"
              onClick={() => setShowEditor((v) => !v)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition ${
                showEditor
                  ? 'bg-accent-strong text-white dark:text-slate-950 border-accent-strong'
                  : 'bg-surface border-border-subtle text-text-primary hover:bg-subtle'
              }`}
            >
              {showEditor ? <Eye className="w-3 h-3" /> : <Code2 className="w-3 h-3" />}
              <span>{showEditor ? 'Sembunyikan Kode' : 'Edit Kode'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Rendered SVG Diagram */}
      <div className="p-4 bg-surface/80 overflow-x-auto flex flex-col items-center justify-center min-h-[120px]">
        {renderError && (
          <div className="w-full mb-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-600 dark:text-amber-300 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{renderError}</span>
          </div>
        )}

        {svgMarkup ? (
          <div
            style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
            className={`transition-transform max-w-full ${renderError ? 'opacity-60' : ''}`}
            dangerouslySetInnerHTML={{ __html: svgMarkup }}
          />
        ) : !renderError ? (
          <p className="text-xs text-text-secondary italic py-4">
            Klik &ldquo;Edit Kode&rdquo; atau pilih Template untuk membuat diagram Mermaid.
          </p>
        ) : null}
      </div>

      {/* Code Editor Drawer */}
      {canEdit && showEditor && (
        <div className="border-t border-border-subtle bg-slate-950 text-slate-100 p-3 space-y-1.5 no-print">
          <textarea
            rows={Math.max(5, Math.min(16, code.split('\n').length + 1))}
            value={code}
            onChange={(e) => onChangeCode(e.target.value)}
            placeholder="flowchart TD&#10;  A[Mulai] --> B[Selesai]"
            spellCheck={false}
            className="w-full bg-transparent font-mono text-xs leading-relaxed text-slate-100 focus:outline-none resize-y"
          />
        </div>
      )}
    </div>
  );
};
