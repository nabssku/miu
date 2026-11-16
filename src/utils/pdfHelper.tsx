'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, FileText, Loader2, ZoomIn, ZoomOut } from 'lucide-react';
import { uploadImageToCloudinary } from '../services/cloudServices';

interface PdfPageProxy {
  getViewport: (opts: { scale: number }) => { width: number; height: number };
  render: (opts: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
  }) => { promise: Promise<void> };
  getTextContent: () => Promise<{
    items: Array<{ str?: string }>;
  }>;
}

interface PdfDocumentProxy {
  numPages: number;
  getPage: (pageNum: number) => Promise<PdfPageProxy>;
}

declare global {
  interface Window {
    pdfjsLib?: {
      GlobalWorkerOptions: { workerSrc: string };
      getDocument: (src: { data: Uint8Array | ArrayBuffer } | string) => {
        promise: Promise<PdfDocumentProxy>;
      };
    };
  }
}

let pdfJsLoadPromise: Promise<void> | null = null;

export function ensurePdfJsLoaded(): Promise<void> {
  if (window.pdfjsLib) return Promise.resolve();
  if (pdfJsLoadPromise) return pdfJsLoadPromise;

  pdfJsLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.async = true;
    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve();
      } else {
        reject(new Error('PDF.js gagal diinisialisasi.'));
      }
    };
    script.onerror = () => {
      pdfJsLoadPromise = null;
      reject(new Error('Gagal memuat pustaka pembaca PDF.'));
    };
    document.head.appendChild(script);
  });

  return pdfJsLoadPromise;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Gagal membaca file PDF.'));
    reader.readAsDataURL(file);
  });
}

function base64DataUrlToUint8Array(dataUrl: string): Uint8Array | null {
  try {
    const base64Idx = dataUrl.indexOf(';base64,');
    if (base64Idx === -1) return null;
    const base64 = dataUrl.slice(base64Idx + 8);
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

/**
 * Extracts readable text and page count from a PDF File in the browser
 */
export async function extractTextFromPdfFile(
  file: File
): Promise<{ text: string; pages: number }> {
  const arrayBuffer = await file.arrayBuffer();

  try {
    await ensurePdfJsLoaded();
    const pdf = await window.pdfjsLib!.getDocument({ data: arrayBuffer }).promise;
    const totalPages = pdf.numPages;
    const maxPagesToRead = Math.min(totalPages, 35);
    const pageTexts: string[] = [];

    for (let p = 1; p <= maxPagesToRead; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const strings = content.items
        .map((item) => item.str || '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (strings) {
        pageTexts.push(`[Halaman ${p}]\n${strings}`);
      }
    }

    const fullText = pageTexts.join('\n\n').slice(0, 28000);
    return {
      text: fullText || `Dokumen PDF "${file.name}" (${totalPages} halaman).`,
      pages: totalPages
    };
  } catch {
    return {
      text: `Dokumen PDF "${file.name}" terlampir.`,
      pages: 1
    };
  }
}

/**
 * Processes a PDF file: extracts text for AI + stores reliable local DataURL for instant Canvas Preview
 * (avoids Cloudinary Free Tier 401 restriction on raw PDF delivery in iframes)
 */
export async function processAndUploadPdf(file: File): Promise<{
  url: string;
  fileName: string;
  text: string;
  pages: number;
}> {
  const [{ text, pages }, localDataUrl] = await Promise.all([
    extractTextFromPdfFile(file),
    fileToDataUrl(file)
  ]);

  // Keep localDataUrl for PDFs <= 6MB so PDF.js Canvas Preview works 100% offline & without CORS/401 blocks
  if (file.size <= 6 * 1024 * 1024) {
    return {
      url: localDataUrl,
      fileName: file.name,
      text,
      pages
    };
  }

  try {
    const uploaded = await uploadImageToCloudinary(file);
    return {
      url: uploaded.url,
      fileName: file.name,
      text,
      pages
    };
  } catch {
    return {
      url: localDataUrl,
      fileName: file.name,
      text,
      pages
    };
  }
}

/**
 * Interactive PDF.js Canvas & Extracted Text Viewer Component (No broken browser iframe)
 */
export const PdfDocumentPreview: React.FC<{
  src: string;
  pdfText?: string;
  totalPages?: number;
}> = ({ src, pdfText, totalPages = 1 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfDocRef = useRef<PdfDocumentProxy | null>(null);

  const [viewMode, setViewMode] = useState<'canvas' | 'text'>('canvas');
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(totalPages);
  const [scale, setScale] = useState(1.25);
  const [loading, setLoading] = useState(true);
  const [renderFailed, setRenderFailed] = useState(false);

  // Load PDF document via PDF.js
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setRenderFailed(false);

    (async () => {
      try {
        await ensurePdfJsLoaded();
        if (cancelled || !window.pdfjsLib) return;

        let docSource: { data: Uint8Array | ArrayBuffer } | string = src;
        if (src.startsWith('data:application/pdf')) {
          const bytes = base64DataUrlToUint8Array(src);
          if (bytes) docSource = { data: bytes };
        } else if (src.startsWith('http')) {
          const resp = await fetch(src);
          if (!resp.ok) throw new Error('HTTP fetch failed');
          const buf = await resp.arrayBuffer();
          docSource = { data: buf };
        }

        const pdfDoc = await window.pdfjsLib.getDocument(docSource).promise;
        if (cancelled) return;
        pdfDocRef.current = pdfDoc;
        setNumPages(pdfDoc.numPages);
        setPageNum(1);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setRenderFailed(true);
          setViewMode('text');
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [src]);

  // Render active page onto HTML5 <canvas>
  useEffect(() => {
    if (viewMode !== 'canvas' || loading || renderFailed || !pdfDocRef.current) return;
    let cancelled = false;

    (async () => {
      try {
        const page = await pdfDocRef.current!.getPage(pageNum);
        if (cancelled || !canvasRef.current) return;
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: ctx, viewport }).promise;
      } catch {
        if (!cancelled) {
          setRenderFailed(true);
          setViewMode('text');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [viewMode, pageNum, scale, loading, renderFailed]);

  return (
    <div className="rounded-xl border border-border-subtle bg-surface overflow-hidden">
      {/* Top Viewer Toolbar */}
      <div className="px-3 py-2 bg-subtle border-b border-border-subtle flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1 bg-surface border border-border-subtle p-0.5 rounded-lg">
          {!renderFailed && (
            <button
              type="button"
              onClick={() => setViewMode('canvas')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                viewMode === 'canvas'
                  ? 'bg-accent-strong text-white dark:text-slate-950'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Halaman Visual
            </button>
          )}
          <button
            type="button"
            onClick={() => setViewMode('text')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
              viewMode === 'text'
                ? 'bg-accent-strong text-white dark:text-slate-950'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Teks Isi PDF (Terbaca AI)
          </button>
        </div>

        {viewMode === 'canvas' && !renderFailed && (
          <div className="flex items-center gap-2">
            {/* Page Stepper */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={pageNum <= 1}
                onClick={() => setPageNum((p) => Math.max(1, p - 1))}
                className="p-1 rounded hover:bg-surface disabled:opacity-40 text-text-primary"
                title="Halaman Sebelumnya"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-[11px] text-text-primary">
                Hal {pageNum} / {numPages}
              </span>
              <button
                type="button"
                disabled={pageNum >= numPages}
                onClick={() => setPageNum((p) => Math.min(numPages, p + 1))}
                className="p-1 rounded hover:bg-surface disabled:opacity-40 text-text-primary"
                title="Halaman Berikutnya"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 border-l border-border-subtle pl-2">
              <button
                type="button"
                onClick={() => setScale((s) => Math.max(0.75, Number((s - 0.2).toFixed(2))))}
                className="p-1 rounded hover:bg-surface text-text-secondary hover:text-text-primary"
                title="Perkecil"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setScale((s) => Math.min(2.2, Number((s + 0.2).toFixed(2))))}
                className="p-1 rounded hover:bg-surface text-text-secondary hover:text-text-primary"
                title="Perbesar"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Viewer Body */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-text-secondary">
          <Loader2 className="w-5 h-5 animate-spin text-accent-strong" />
          <span>Memuat pratinjau halaman PDF...</span>
        </div>
      ) : viewMode === 'canvas' && !renderFailed ? (
        <div className="p-3 bg-slate-900/10 dark:bg-black/30 max-h-[480px] overflow-auto flex justify-center">
          <canvas
            ref={canvasRef}
            className="max-w-full h-auto rounded-lg shadow-md bg-white"
          />
        </div>
      ) : (
        <div className="p-4 max-h-80 overflow-y-auto space-y-2 text-xs leading-relaxed text-text-primary whitespace-pre-wrap font-sans">
          {pdfText ? (
            pdfText
          ) : (
            <div className="text-center py-6 text-text-secondary flex flex-col items-center gap-1.5">
              <FileText className="w-5 h-5 opacity-50" />
              <span>Tidak ada teks terbaca di dalam dokumen PDF ini.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
