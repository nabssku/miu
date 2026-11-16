'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  Clipboard,
  FileText,
  Highlighter,
  ImagePlus,
  Loader2,
  Monitor,
  Pen,
  Square,
  Type,
  X
} from 'lucide-react';
import { db } from '../../db/database';
import { useMiu } from '../../context/MiuContext';
import { uploadImageToCloudinary } from '../../services/cloudServices';

type ToolType = 'pen' | 'highlighter' | 'arrow' | 'rect' | 'text';

export const LazyshotOverlay: React.FC = () => {
  const {
    isLazyshotOpen,
    setIsLazyshotOpen,
    insertBlockIntoActiveNote,
    setViewMode,
    triggerInlineAIExplain
  } = useMiu();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bgImageRef = useRef<HTMLImageElement | null>(null);

  const [tool, setTool] = useState<ToolType>('pen');
  const [strokeColor, setStrokeColor] = useState('#F43F5E');
  const [hasImage, setHasImage] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrText, setOcrText] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  // Drawing state
  const isDrawingRef = useRef(false);
  const startPtRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const snapshotRef = useRef<ImageData | null>(null);

  // Initialize blank slide/scratchpad canvas when opened
  useEffect(() => {
    if (!isLazyshotOpen) return;
    setOcrText('');
    setStatusMsg('');
    setHasImage(false);

    const timer = window.setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = 840;
      canvas.height = 460;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Render a sample lecture slide guide until user captures screen or uploads image
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.setLineDash([6, 6]);
      ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);
      ctx.setLineDash([]);
      ctx.fillStyle = '#E2E8F0';
      ctx.font = '600 18px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('📸 Lazyshot Clipper & Annotator', 48, 76);
      ctx.fillStyle = '#94A3B8';
      ctx.font = '14px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(
        'Klik "Tangkap Layar (Screen API)" atau "Unggah Gambar Slide", lalu coret-coret atau jalankan OCR lokal.',
        48,
        108
      );
      ctx.fillStyle = '#38BDF8';
      ctx.font = '500 14px "JetBrains Mono", monospace';
      ctx.fillText('Contoh Teks OCR: Normalisasi BCNF menghilangkan anomali dependensi transitif.', 48, 170);
    }, 50);

    return () => window.clearTimeout(timer);
  }, [isLazyshotOpen]);

  if (!isLazyshotOpen) return null;

  const drawImageToCanvas = (img: HTMLImageElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const maxW = 900;
    const scale = Math.min(1, maxW / img.width);
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    bgImageRef.current = img;
    setHasImage(true);
  };

  const handleScreenCapture = async () => {
    try {
      setStatusMsg('Memilih area layar...');
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' } as MediaTrackConstraints,
        audio: false
      });
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = video.videoWidth;
      tempCanvas.height = video.videoHeight;
      const tCtx = tempCanvas.getContext('2d');
      tCtx?.drawImage(video, 0, 0);

      stream.getTracks().forEach((t) => t.stop());

      const img = new Image();
      img.onload = () => {
        drawImageToCanvas(img);
        setStatusMsg('Tangkapan layar siap dicoret atau di-OCR!');
      };
      img.src = tempCanvas.toDataURL('image/png');
    } catch {
      setStatusMsg('Tangkapan layar dibatalkan atau izin belum diberikan.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        drawImageToCanvas(img);
        setStatusMsg('Gambar slide dimuat. Siap dianotasi!');
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const getPointerPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pt = getPointerPos(e);

    if (tool === 'text') {
      const label = window.prompt('Masukkan teks anotasi:');
      if (label) {
        ctx.fillStyle = strokeColor;
        ctx.font = 'bold 18px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(label, pt.x, pt.y);
      }
      return;
    }

    isDrawingRef.current = true;
    startPtRef.current = pt;
    snapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);

    if (tool === 'pen' || tool === 'highlighter') {
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pt = getPointerPos(e);

    if (tool === 'pen' || tool === 'highlighter') {
      ctx.strokeStyle = tool === 'highlighter' ? 'rgba(250, 204, 21, 0.42)' : strokeColor;
      ctx.lineWidth = tool === 'highlighter' ? 16 : 3.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
      return;
    }

    if (snapshotRef.current) {
      ctx.putImageData(snapshotRef.current, 0, 0);
    }

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 3;
    const start = startPtRef.current;

    if (tool === 'rect') {
      ctx.strokeRect(start.x, start.y, pt.x - start.x, pt.y - start.y);
    } else if (tool === 'arrow') {
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();

      const angle = Math.atan2(pt.y - start.y, pt.x - start.x);
      const headLen = 14;
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(
        pt.x - headLen * Math.cos(angle - Math.PI / 6),
        pt.y - headLen * Math.sin(angle - Math.PI / 6)
      );
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(
        pt.x - headLen * Math.cos(angle + Math.PI / 6),
        pt.y - headLen * Math.sin(angle + Math.PI / 6)
      );
      ctx.stroke();
    }
  };

  const onPointerUp = () => {
    isDrawingRef.current = false;
    snapshotRef.current = null;
  };

  // On-Demand Local OCR using Tesseract.js (`FR-6.3`, `NFR-2`)
  const handleRunLocalOCR = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setOcrLoading(true);
    setStatusMsg('Memuat mesin OCR lokal (Tesseract WASM)...');
    try {
      const Tesseract = await import('tesseract.js');
      const dataUrl = canvas.toDataURL('image/png');
      const result = await Tesseract.recognize(dataUrl, 'eng+ind');
      const extracted = result.data.text.trim();
      setOcrText(extracted || 'Tidak ditemukan teks terbaca pada area gambar.');
      setStatusMsg('Ekstraksi teks OCR selesai (100% lokal di browser).');
    } catch {
      setStatusMsg('Gagal memuat modul OCR WASM. Coba unggah gambar dengan kontras lebih jelas.');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleSaveToNote = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setStatusMsg('Mengunggah gambar ke Cloud...');
    const dataUrl = canvas.toDataURL('image/png');
    let finalUrl = dataUrl;
    try {
      const uploaded = await uploadImageToCloudinary(dataUrl);
      finalUrl = uploaded.url;
    } catch {
      // fallback to local dataUrl
    }
    setViewMode('workspace');
    await insertBlockIntoActiveNote({
      type: 'image',
      content: finalUrl,
      caption: hasImage ? 'Tangkapan & anotasi Lazyshot' : 'Sketsa catatan Lazyshot'
    });
    if (ocrText) {
      await insertBlockIntoActiveNote({
        type: 'callout',
        calloutIcon: '🔤',
        content: ocrText
      });
    }
    setIsLazyshotOpen(false);
  };

  const handleSaveToBoard = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setStatusMsg('Mengunggah gambar ke Cloud...');
    const dataUrl = canvas.toDataURL('image/png');
    let finalUrl = dataUrl;
    try {
      const uploaded = await uploadImageToCloudinary(dataUrl);
      finalUrl = uploaded.url;
    } catch {
      // fallback
    }
    await db.boardItems.add({
      id: `brd-${Date.now()}`,
      tab: 'shelf',
      contentType: 'image',
      title: `Lazyshot ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`,
      content: finalUrl,
      createdAt: Date.now()
    });
    setStatusMsg('Disimpan ke Pinned Shelf (Cloud)!');
  };

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center p-4 no-print">
      <div className="w-full max-w-5xl bg-slate-900 border border-white/15 rounded-[24px] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Floating Toolbar */}
        <div className="px-4 py-3 border-b border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs text-white">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sky-300">📸 Lazyshot</span>
            <button
              type="button"
              onClick={() => void handleScreenCapture()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-widget bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold transition"
            >
              <Monitor className="w-3.5 h-3.5" />
              Tangkap Layar
            </button>
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-widget bg-white/10 hover:bg-white/15 cursor-pointer transition">
              <ImagePlus className="w-3.5 h-3.5" />
              Unggah Slide
              <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>

          {/* Annotation Tools */}
          <div className="flex items-center gap-1 bg-black/35 p-1 rounded-widget border border-white/10">
            {[
              { id: 'pen' as const, label: 'Pena', Icon: Pen },
              { id: 'highlighter' as const, label: 'Stabilo', Icon: Highlighter },
              { id: 'arrow' as const, label: 'Panah', Icon: ArrowUpRight },
              { id: 'rect' as const, label: 'Kotak', Icon: Square },
              { id: 'text' as const, label: 'Teks', Icon: Type }
            ].map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTool(id)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-[8px] transition ${
                  tool === id ? 'bg-sky-400 text-slate-950 font-semibold' : 'text-slate-300 hover:text-white'
                }`}
                title={label}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{label}</span>
              </button>
            ))}
            <div className="flex items-center gap-1 pl-1.5 border-l border-white/15">
              {['#F43F5E', '#38BDF8', '#10B981', '#F5EFE6'].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setStrokeColor(c)}
                  className={`w-4 h-4 rounded-full border ${
                    strokeColor === c ? 'border-white scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsLazyshotOpen(false)}
            className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white"
            aria-label="Tutup Lazyshot"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Canvas Workspace */}
        <div className="flex-1 overflow-auto p-4 bg-slate-950/60 flex flex-col lg:flex-row gap-4 items-center justify-center">
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="max-w-full max-h-[58vh] rounded-2xl border border-white/15 cursor-crosshair shadow-xl bg-slate-900"
          />

          {/* OCR Result Side Box */}
          {ocrText && (
            <div className="w-full lg:w-72 bg-slate-900 border border-white/10 rounded-2xl p-3 space-y-2 text-xs text-slate-200 self-stretch flex flex-col">
              <div className="flex items-center justify-between font-semibold text-sky-300">
                <span>🔤 Hasil OCR Lokal</span>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(ocrText)}
                  className="text-[11px] text-slate-300 hover:text-white inline-flex items-center gap-1"
                >
                  <Clipboard className="w-3 h-3" /> Salin
                </button>
              </div>
              <textarea
                value={ocrText}
                onChange={(e) => setOcrText(e.target.value)}
                className="flex-1 min-h-[160px] bg-black/30 border border-white/10 rounded-xl p-2 text-[11px] font-mono text-slate-100 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  triggerInlineAIExplain(`Jelaskan teks hasil tangkapan slide ini:\n\n${ocrText}`);
                  setIsLazyshotOpen(false);
                }}
                className="w-full py-1.5 rounded-widget bg-indigo-500 hover:bg-indigo-400 text-white font-medium text-[11px]"
              >
                ✨ Jelaskan via External AI
              </button>
            </div>
          )}
        </div>

        {/* Bottom Action Bar */}
        <div className="px-4 py-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-[11px] text-slate-300">
            {statusMsg || 'Tarik kursor di atas kanvas untuk mencoret atau sorot bagian penting.'}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleRunLocalOCR()}
              disabled={ocrLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-widget bg-amber-400/20 hover:bg-amber-400/30 border border-amber-300/30 text-amber-200 font-medium transition disabled:opacity-60"
            >
              {ocrLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileText className="w-3.5 h-3.5" />
              )}
              Ambil Teks (OCR Lokal)
            </button>
            <button
              type="button"
              onClick={() => void handleSaveToBoard()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-widget bg-white/10 hover:bg-white/15 text-white transition"
            >
              <Clipboard className="w-3.5 h-3.5" />
              Simpan ke Board
            </button>
            <button
              type="button"
              onClick={() => void handleSaveToNote()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-widget bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold transition"
            >
              <Check className="w-3.5 h-3.5" />
              Sisipkan ke Catatan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
