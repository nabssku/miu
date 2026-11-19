'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  RefreshCw,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { uploadImageToCloudinary } from '../services/cloudServices';

const PDFJS_VERSION = '3.11.174';
const PDFJS_CDN_BASE = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;
const PDFJS_CMAP_URL = `${PDFJS_CDN_BASE}/cmaps/`;
const PDFJS_STANDARD_FONT_URL = `${PDFJS_CDN_BASE}/standard_fonts/`;

const MAX_PAGES_TO_READ = 120;
const MAX_EXTRACTED_CHARS = 150000;
const MAX_OCR_PAGES = 15;

interface PdfTextContentItem {
  str?: string;
  dir?: string;
  width?: number;
  height?: number;
  transform?: number[];
  fontName?: string;
  hasEOL?: boolean;
}

interface PdfPageViewport {
  width: number;
  height: number;
  transform?: number[];
}

interface PdfPageProxy {
  getViewport: (opts: { scale: number }) => PdfPageViewport;
  render: (opts: {
    canvasContext: CanvasRenderingContext2D;
    viewport: PdfPageViewport;
  }) => { promise: Promise<void> };
  getTextContent: (opts?: { includeMarkedContent?: boolean }) => Promise<{
    items: PdfTextContentItem[];
  }>;
}

interface PdfDocumentProxy {
  numPages: number;
  getPage: (pageNum: number) => Promise<PdfPageProxy>;
  destroy?: () => Promise<void> | void;
}

interface PdfDocumentSource {
  data?: Uint8Array | ArrayBuffer;
  url?: string;
  cMapUrl?: string;
  cMapPacked?: boolean;
  standardFontDataUrl?: string;
  verbosity?: number;
}

declare global {
  interface Window {
    pdfjsLib?: {
      GlobalWorkerOptions: { workerSrc: string };
      getDocument: (src: PdfDocumentSource | string) => {
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
    const existing = document.querySelector(
      `script[src="${PDFJS_CDN_BASE}/pdf.min.js"]`
    ) as HTMLScriptElement | null;

    if (existing && window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN_BASE}/pdf.worker.min.js`;
      resolve();
      return;
    }

    const script = existing || document.createElement('script');
    if (!existing) {
      script.src = `${PDFJS_CDN_BASE}/pdf.min.js`;
      script.async = true;
    }

    const handleLoad = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN_BASE}/pdf.worker.min.js`;
        resolve();
      } else {
        pdfJsLoadPromise = null;
        reject(new Error('PDF.js gagal diinisialisasi.'));
      }
    };

    const handleError = () => {
      pdfJsLoadPromise = null;
      reject(new Error('Gagal memuat pustaka pembaca PDF.'));
    };

    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });

    if (!existing) {
      document.head.appendChild(script);
    }
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

function normalizePdfString(raw: string): string {
  return raw
    .replace(/\uFB00/g, 'ff')
    .replace(/\uFB01/g, 'fi')
    .replace(/\uFB02/g, 'fl')
    .replace(/\uFB03/g, 'ffi')
    .replace(/\uFB04/g, 'ffl')
    .replace(/\uFB05/g, 'ft')
    .replace(/\uFB06/g, 'st')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '');
}

function multiplyTransform(m1: number[], m2: number[]): number[] {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5]
  ];
}

interface PositionedToken {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isSpace: boolean;
}

interface VisualLine {
  y: number;
  height: number;
  minX: number;
  maxX: number;
  tokens: PositionedToken[];
}

function buildVisualLines(tokens: PositionedToken[]): VisualLine[] {
  if (tokens.length === 0) return [];
  const sorted = [...tokens].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: VisualLine[] = [];

  for (const tok of sorted) {
    const tol = Math.max(2.5, tok.height * 0.45);
    let targetLine: VisualLine | null = null;
    let bestDist = Infinity;

    // Search recent lines first for baseline match
    for (let i = lines.length - 1; i >= Math.max(0, lines.length - 12); i--) {
      const dist = Math.abs(lines[i].y - tok.y);
      if (dist <= Math.max(tol, lines[i].height * 0.45) && dist < bestDist) {
        bestDist = dist;
        targetLine = lines[i];
      }
    }

    const tokRight = tok.x + Math.max(0, tok.width);
    if (targetLine) {
      targetLine.tokens.push(tok);
      targetLine.minX = Math.min(targetLine.minX, tok.x);
      targetLine.maxX = Math.max(targetLine.maxX, tokRight);
      targetLine.height = Math.max(targetLine.height, tok.height);
    } else {
      lines.push({
        y: tok.y,
        height: tok.height,
        minX: tok.x,
        maxX: tokRight,
        tokens: [tok]
      });
    }
  }

  lines.sort((a, b) => a.y - b.y);
  for (const line of lines) {
    line.tokens.sort((a, b) => a.x - b.x);
  }
  return lines;
}

function joinLineTokens(tokens: PositionedToken[]): string {
  const nonEmpty: PositionedToken[] = [];
  let pendingSpaceBeforeNext = false;
  const spaceAfterIndex = new Set<number>();

  for (const tok of tokens) {
    if (tok.isSpace) {
      if (nonEmpty.length > 0) {
        pendingSpaceBeforeNext = true;
      }
      continue;
    }
    if (pendingSpaceBeforeNext && nonEmpty.length > 0) {
      spaceAfterIndex.add(nonEmpty.length - 1);
      pendingSpaceBeforeNext = false;
    }
    nonEmpty.push(tok);
  }

  if (nonEmpty.length === 0) return '';

  let out = nonEmpty[0].str;
  for (let i = 1; i < nonEmpty.length; i++) {
    const prev = nonEmpty[i - 1];
    const curr = nonEmpty[i];
    const refSize = Math.max(6, Math.min(prev.height, curr.height));
    const prevWidth =
      prev.width > 0 ? prev.width : Math.max(0, prev.str.length * refSize * 0.48);
    const gap = curr.x - (prev.x + prevWidth);

    const prevEndsSpace = /\s$/.test(out);
    const currStartsSpace = /^\s/.test(curr.str);

    if (gap > refSize * 1.85) {
      out = out.replace(/\s+$/, '') + '   ' + curr.str.replace(/^\s+/, '');
    } else if (
      spaceAfterIndex.has(i - 1) ||
      gap >= refSize * 0.16 ||
      prevEndsSpace ||
      currStartsSpace
    ) {
      const cleanedCurr = curr.str.replace(/^\s+/, '');
      if (!prevEndsSpace) {
        out += ' ';
      }
      out += cleanedCurr;
    } else {
      // Negative or tiny kerning gap inside a single word/token
      out += curr.str;
    }
  }

  return out.replace(/[ \t]+$/g, '').trim();
}

function linesToParagraphText(lines: VisualLine[]): string {
  const parts: Array<{ text: string; y: number; height: number }> = [];

  for (const line of lines) {
    const lineText = joinLineTokens(line.tokens);
    if (!lineText) continue;
    parts.push({ text: lineText, y: line.y, height: line.height });
  }

  if (parts.length === 0) return '';

  let result = parts[0].text;
  for (let i = 1; i < parts.length; i++) {
    const prev = parts[i - 1];
    const curr = parts[i];
    const dy = curr.y - prev.y;
    const refHeight = Math.max(prev.height, curr.height, 10);

    if (dy > refHeight * 1.65) {
      result += '\n\n' + curr.text;
    } else {
      result += '\n' + curr.text;
    }
  }

  return result.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Reconstructs accurate reading order (lines, paragraphs, columns, word boundaries)
 * using PDF.js item transforms & viewport geometry instead of naive `.join(' ')`.
 */
export function reconstructPageText(
  items: PdfTextContentItem[],
  viewport: PdfPageViewport
): string {
  const vpTransform = viewport.transform || [1, 0, 0, -1, 0, viewport.height];
  const tokens: PositionedToken[] = [];

  for (const item of items) {
    if (typeof item.str !== 'string' || item.str.length === 0) continue;
    const normalized = normalizePdfString(item.str);
    if (!normalized) continue;

    const rawTransform =
      Array.isArray(item.transform) && item.transform.length >= 6
        ? item.transform
        : [1, 0, 0, 1, 0, 0];
    const m = multiplyTransform(vpTransform, rawTransform);
    const x = m[4];
    const y = m[5];
    const height = Math.max(
      6,
      item.height || Math.hypot(m[0], m[1]) || Math.hypot(m[2], m[3]) || 10
    );
    const width = Math.max(0, item.width || 0);
    const isSpace = normalized.trim().length === 0;

    tokens.push({ str: normalized, x, y, width, height, isSpace });
  }

  if (tokens.length === 0) return '';

  // Check whether page body has a clean 2-column academic/paper split
  const pageWidth = viewport.width || 600;
  const pageHeight = viewport.height || 800;
  const midX = pageWidth * 0.5;
  const gutterHalf = Math.max(8, pageWidth * 0.025);

  const nonSpaceTokens = tokens.filter((t) => !t.isSpace);
  const bodyTokens = nonSpaceTokens.filter(
    (t) => t.y > pageHeight * 0.09 && t.y < pageHeight * 0.91
  );

  let leftSideCount = 0;
  let rightSideCount = 0;
  let crossingCount = 0;

  for (const t of bodyTokens) {
    const right = t.x + t.width;
    if (right < midX - gutterHalf) {
      leftSideCount++;
    } else if (t.x > midX + gutterHalf) {
      rightSideCount++;
    } else if (t.x < midX - gutterHalf && right > midX + gutterHalf && t.str.length > 6) {
      crossingCount++;
    }
  }

  const bodyLines = buildVisualLines(bodyTokens);
  const splitRows = bodyLines.filter((line) => {
    const hasLeft = line.tokens.some((t) => t.x + t.width < midX - gutterHalf);
    const hasRight = line.tokens.some((t) => t.x > midX + gutterHalf);
    const crossesMiddle = line.tokens.some(
      (t) => t.x < midX - gutterHalf && t.x + t.width > midX + gutterHalf && t.str.length > 6
    );
    return hasLeft && hasRight && !crossesMiddle;
  });

  const isTwoColumn =
    leftSideCount >= 12 &&
    rightSideCount >= 12 &&
    splitRows.length >= 5 &&
    crossingCount <= Math.max(2, Math.floor(bodyTokens.length * 0.05));

  if (isTwoColumn) {
    const splitTopY = splitRows[0].y - 6;
    const splitBottomY = splitRows[splitRows.length - 1].y + splitRows[splitRows.length - 1].height + 6;

    const topTokens = tokens.filter((t) => t.y < splitTopY);
    const bottomTokens = tokens.filter((t) => t.y > splitBottomY);
    const colLeftTokens = tokens.filter(
      (t) => t.y >= splitTopY && t.y <= splitBottomY && t.x + t.width * 0.5 <= midX
    );
    const colRightTokens = tokens.filter(
      (t) => t.y >= splitTopY && t.y <= splitBottomY && t.x + t.width * 0.5 > midX
    );

    const sections = [
      linesToParagraphText(buildVisualLines(topTokens)),
      linesToParagraphText(buildVisualLines(colLeftTokens)),
      linesToParagraphText(buildVisualLines(colRightTokens)),
      linesToParagraphText(buildVisualLines(bottomTokens))
    ].filter(Boolean);

    return sections.join('\n\n');
  }

  return linesToParagraphText(buildVisualLines(tokens));
}

async function renderPageForOcr(page: PdfPageProxy): Promise<HTMLCanvasElement | null> {
  const baseVp = page.getViewport({ scale: 1 });
  const maxDim = Math.max(baseVp.width, baseVp.height, 1);
  const scale = Math.min(2.2, Math.max(1.35, 1800 / maxDim));
  const vp = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(vp.width));
  canvas.height = Math.max(1, Math.round(vp.height));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  return canvas;
}

interface TesseractWorkerLike {
  recognize: (image: HTMLCanvasElement | string) => Promise<{ data?: { text?: string } }>;
  terminate: () => Promise<void>;
}

/**
 * Extracts accurate structured text & page count from a PDF File or binary/URL source.
 * Includes coordinate-aware line/column reconstruction + CMap font support + Tesseract OCR fallback for scanned pages.
 */
export async function extractTextFromPdfSource(
  source: File | Uint8Array | ArrayBuffer | string,
  fileName = 'Dokumen.pdf',
  onProgress?: (status: string) => void
): Promise<{ text: string; pages: number; ocrPagesUsed: number }> {
  let docSource: PdfDocumentSource;

  if (typeof source === 'string') {
    if (source.startsWith('data:application/pdf')) {
      const bytes = base64DataUrlToUint8Array(source);
      if (!bytes) {
        return { text: `Dokumen PDF "${fileName}" terlampir.`, pages: 1, ocrPagesUsed: 0 };
      }
      docSource = {
        data: bytes,
        cMapUrl: PDFJS_CMAP_URL,
        cMapPacked: true,
        standardFontDataUrl: PDFJS_STANDARD_FONT_URL,
        verbosity: 0
      };
    } else if (source.startsWith('http')) {
      const resp = await fetch(source);
      if (!resp.ok) {
        throw new Error(`HTTP fetch PDF failed (${resp.status})`);
      }
      const buf = new Uint8Array(await resp.arrayBuffer());
      docSource = {
        data: buf,
        cMapUrl: PDFJS_CMAP_URL,
        cMapPacked: true,
        standardFontDataUrl: PDFJS_STANDARD_FONT_URL,
        verbosity: 0
      };
    } else {
      docSource = {
        url: source,
        cMapUrl: PDFJS_CMAP_URL,
        cMapPacked: true,
        standardFontDataUrl: PDFJS_STANDARD_FONT_URL,
        verbosity: 0
      };
    }
  } else if (source instanceof File) {
    const buf = new Uint8Array(await source.arrayBuffer());
    docSource = {
      data: buf,
      cMapUrl: PDFJS_CMAP_URL,
      cMapPacked: true,
      standardFontDataUrl: PDFJS_STANDARD_FONT_URL,
      verbosity: 0
    };
  } else if (source instanceof Uint8Array) {
    docSource = {
      data: new Uint8Array(source),
      cMapUrl: PDFJS_CMAP_URL,
      cMapPacked: true,
      standardFontDataUrl: PDFJS_STANDARD_FONT_URL,
      verbosity: 0
    };
  } else {
    docSource = {
      data: new Uint8Array(source),
      cMapUrl: PDFJS_CMAP_URL,
      cMapPacked: true,
      standardFontDataUrl: PDFJS_STANDARD_FONT_URL,
      verbosity: 0
    };
  }

  let ocrWorker: TesseractWorkerLike | null = null;
  let pdfDoc: PdfDocumentProxy | null = null;

  try {
    onProgress?.('Memuat pustaka pembaca PDF...');
    await ensurePdfJsLoaded();
    pdfDoc = await window.pdfjsLib!.getDocument(docSource).promise;

    const totalPages = pdfDoc.numPages;
    const maxPagesToRead = Math.min(totalPages, MAX_PAGES_TO_READ);
    const pageTexts: string[] = [];
    let totalChars = 0;
    let ocrPagesUsed = 0;

    for (let p = 1; p <= maxPagesToRead; p++) {
      onProgress?.(`Membaca halaman ${p}/${maxPagesToRead}...`);
      const page = await pdfDoc.getPage(p);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent({ includeMarkedContent: false });
      let pageText = reconstructPageText(content.items || [], viewport);

      const compactLength = pageText.replace(/\s+/g, '').length;
      if (compactLength < 25 && ocrPagesUsed < MAX_OCR_PAGES) {
        try {
          onProgress?.(`Halaman ${p} berupa gambar/scan — menjalankan OCR lokal...`);
          const canvas = await renderPageForOcr(page);
          if (canvas) {
            if (!ocrWorker) {
              const Tesseract = await import('tesseract.js');
              ocrWorker = (await Tesseract.createWorker('eng+ind')) as unknown as TesseractWorkerLike;
            }
            const ocrRes = await ocrWorker.recognize(canvas);
            const ocrText = (ocrRes.data?.text || '')
              .replace(/\r\n/g, '\n')
              .replace(/\n{3,}/g, '\n\n')
              .trim();
            if (ocrText.replace(/\s+/g, '').length > compactLength) {
              pageText = ocrText;
              ocrPagesUsed++;
            }
          }
        } catch {
          // Keep original text if OCR fails offline
        }
      }

      if (pageText) {
        const prefix =
          compactLength < 25 && ocrPagesUsed > 0
            ? `[Halaman ${p} (OCR)]`
            : `[Halaman ${p}]`;
        const entry = `${prefix}\n${pageText}`;
        if (totalChars + entry.length > MAX_EXTRACTED_CHARS) {
          const remaining = MAX_EXTRACTED_CHARS - totalChars;
          if (remaining > 200) {
            pageTexts.push(entry.slice(0, remaining));
          }
          pageTexts.push(
            `[Catatan: Dokumen dipotong di halaman ${p} dari ${totalPages} halaman karena batas ukuran teks.]`
          );
          break;
        }
        pageTexts.push(entry);
        totalChars += entry.length + 2;
      }
    }

    if (totalPages > maxPagesToRead) {
      pageTexts.push(
        `[Catatan: Dibaca ${maxPagesToRead} dari total ${totalPages} halaman.]`
      );
    }

    const fullText = pageTexts.join('\n\n');
    return {
      text: fullText || `Dokumen PDF "${fileName}" (${totalPages} halaman, tidak ada teks terbaca).`,
      pages: totalPages,
      ocrPagesUsed
    };
  } catch {
    return {
      text: `Dokumen PDF "${fileName}" terlampir.`,
      pages: 1,
      ocrPagesUsed: 0
    };
  } finally {
    if (ocrWorker) {
      try {
        await ocrWorker.terminate();
      } catch {
        // ignore
      }
    }
    if (pdfDoc?.destroy) {
      try {
        await pdfDoc.destroy();
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Extracts readable text and page count from a PDF File in the browser
 */
export async function extractTextFromPdfFile(
  file: File,
  onProgress?: (status: string) => void
): Promise<{ text: string; pages: number }> {
  const res = await extractTextFromPdfSource(file, file.name, onProgress);
  return { text: res.text, pages: res.pages };
}

/**
 * Processes a PDF file: extracts text for AI + stores reliable local DataURL for instant Canvas Preview
 * (avoids Cloudinary Free Tier 401 restriction on raw PDF delivery in iframes)
 */
export async function processAndUploadPdf(
  file: File,
  onProgress?: (status: string) => void
): Promise<{
  url: string;
  fileName: string;
  text: string;
  pages: number;
}> {
  const [{ text, pages }, localDataUrl] = await Promise.all([
    extractTextFromPdfFile(file, onProgress),
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
    onProgress?.('Mengunggah PDF ke Cloud...');
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
  onReExtractText?: () => Promise<void>;
  reExtracting?: boolean;
}> = ({ src, pdfText, totalPages = 1, onReExtractText, reExtracting = false }) => {
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

        let docSource: PdfDocumentSource = {
          url: src,
          cMapUrl: PDFJS_CMAP_URL,
          cMapPacked: true,
          standardFontDataUrl: PDFJS_STANDARD_FONT_URL,
          verbosity: 0
        };

        if (src.startsWith('data:application/pdf')) {
          const bytes = base64DataUrlToUint8Array(src);
          if (bytes) {
            docSource = {
              data: bytes,
              cMapUrl: PDFJS_CMAP_URL,
              cMapPacked: true,
              standardFontDataUrl: PDFJS_STANDARD_FONT_URL,
              verbosity: 0
            };
          }
        } else if (src.startsWith('http')) {
          const resp = await fetch(src);
          if (!resp.ok) throw new Error('HTTP fetch failed');
          const buf = new Uint8Array(await resp.arrayBuffer());
          docSource = {
            data: buf,
            cMapUrl: PDFJS_CMAP_URL,
            cMapPacked: true,
            standardFontDataUrl: PDFJS_STANDARD_FONT_URL,
            verbosity: 0
          };
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

  // Render active page onto HTML5 <canvas> with HiDPI sharpness
  useEffect(() => {
    if (viewMode !== 'canvas' || loading || renderFailed || !pdfDocRef.current) return;
    let cancelled = false;

    (async () => {
      try {
        const page = await pdfDocRef.current!.getPage(pageNum);
        if (cancelled || !canvasRef.current) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const cssViewport = page.getViewport({ scale });
        const renderViewport = page.getViewport({ scale: scale * dpr });
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = Math.max(1, Math.round(renderViewport.width));
        canvas.height = Math.max(1, Math.round(renderViewport.height));
        canvas.style.width = `${Math.round(cssViewport.width)}px`;
        canvas.style.height = `${Math.round(cssViewport.height)}px`;
        await page.render({ canvasContext: ctx, viewport: renderViewport }).promise;
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

        <div className="flex items-center gap-2">
          {onReExtractText && (
            <button
              type="button"
              disabled={reExtracting}
              onClick={() => void onReExtractText()}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-surface border border-border-subtle hover:border-accent-strong text-[11px] font-medium text-text-secondary hover:text-text-primary disabled:opacity-50 transition"
              title="Ekstrak ulang teks PDF dengan akurasi layout & OCR"
            >
              {reExtracting ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
              <span>{reExtracting ? 'Membaca...' : 'Baca Ulang Teks'}</span>
            </button>
          )}

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
