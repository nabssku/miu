# Miu — Dynamic Ambient Workspace

**Miu** adalah ruang kerja belajar dan pencatatan modern berbasis **Next.js 16 (App Router + Turbopack)** & **React 19** yang memadukan **Dynamic Island ambien**, editor catatan bergaya Notion, pemutar musik fokus, timer Pomodoro presisi, dan asisten AI kontekstual.

---

## ✨ Fitur Utama

### 1. Dynamic Island Ambien
- **Maskot Interaktif Miu**: Bereaksi terhadap status fokus, istirahat, musik, mode tidur tab, dan notifikasi.
- **Pomodoro Worker Presisi**: Berjalan di background Web Worker (`public/workers/pomodoroWorker.js`) agar tetap akurat meski tab berpindah, lengkap dengan kustomisasi durasi fokus & jeda.
- **Musik & Ambient Mixer**: Pemutar lagu fokus (*single active audio owner* tanpa suara bertumpuk/dobel), lirik tersinkronisasi (LRCLIB), serta mixer suara ambien berbasis Web Audio API.
- **Produktivitas Cepat**: Todo & Pomodoro terhubung, Quick Mirror, Board Shelf, pengingat minum/peregangan/jadwal sholat, **Lazytype** (dikte suara), dan **Lazyshot** (screenshot clipper + anotasi + OCR lokal lewat Tesseract.js).

### 2. Workspace Catatan Notion-Style (`/app`)
- **Block Editor Lengkap**: Mendukung paragraf, Heading (`H1`, `H2`), bullet & numbered list, checklist To-do, Callout, Code block, rumus matematika **LaTeX / KaTeX**, pemisah, gambar, dokumen **PDF** (dengan pratinjau kanvas & ekstraksi teks), serta **Subhalaman bersarang**.
- **Drag & Drop Fleksibel**: Ubah urutan blok catatan maupun susun ulang hierarki halaman & subhalaman di sidebar dengan drag-and-drop.
- **Isolasi User & Kolaborasi Berjenjang**:
  - Masuk dengan Google OAuth 2.0 untuk mengisolasi catatan pribadi per akun.
  - Bagikan catatan lewat tautan (`/app?share=<id>`) atau undang email kolaborator dengan hak akses **`view`** (hanya lihat), **`comment`** (beri komentar), atau **`edit`** (sunting & kolaborasi).

### 3. Asisten AI Kontekstual
- **Mode Default Server-Side**: Menggunakan proxy aman `/api/ai/chat` (streaming SSE) dengan dukungan analisis teks catatan, gambar (*vision fallback*), dan dokumen PDF.
- **AI Provider Custom (BYOK)**: Dukungan Custom Endpoint (OpenAI-compatible), Google Gemini, Anthropic Claude, OpenRouter, OpenAI, dan Ollama lokal — lengkap dengan perenderan Markdown/tabel/LaTeX rapi, sisipkan langsung ke blok catatan, serta riwayat percakapan per catatan (termasuk hapus *multi-select*).

---

## 🛠 Arsitektur & Teknologi

| Komponen | Teknologi |
| --- | --- |
| Framework | **Next.js 16** (`^16.4.6`, App Router, Turbopack) |
| UI & Animasi | **React 19** (`^19.3.1`), **Tailwind CSS 3**, **Framer Motion** (`^11.18.2`), **Lucide React** (`^1.73.0`) |
| Penyimpanan Lokal | **Dexie.js** (`^4.0.10`) / IndexedDB + PWA Service Worker (`public/sw.js`) |
| Matematika & OCR | **KaTeX** (`^0.16.11`), **Tesseract.js** (`^5.1.1`) |
| Backend Server Routes | Next.js App Router Route Handlers (`/api/cloud/*`, `/api/notes`, `/api/upload`, `/api/ai/chat`) |

Seluruh kredensial **Cloud Catatan**, **Media Cloud**, dan **AI Key default** diproses sepenuhnya di sisi server melalui `src/lib/serverCloud.ts` & `src/app/api/*` sehingga tidak pernah terekspos ke bundel browser.

---

## 📁 Struktur Direktori Utama

```text
├── public/
│   ├── manifest.webmanifest
│   ├── sw.js                         # Service Worker (bypass /api/ & localhost)
│   └── workers/pomodoroWorker.js     # Web Worker timer Pomodoro
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── ai/chat/route.ts      # Proxy AI streaming SSE (server-side)
│   │   │   ├── cloud/auth/route.ts   # Sinkronisasi profil Google user
│   │   │   ├── cloud/status/route.ts # Status Cloud Catatan & inisialisasi skema
│   │   │   ├── notes/route.ts        # CRUD catatan terisolasi & validasi izin share
│   │   │   └── upload/route.ts       # Upload media server-side
│   │   ├── app/page.tsx              # Rute Workspace (/app)
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx                  # Landing Page (/)
│   ├── components/                   # Komponen UI (Dynamic Island, Editor, AI Drawer, dll.)
│   ├── context/MiuContext.tsx        # State global aplikasi
│   ├── db/database.ts                # Skema IndexedDB (Dexie)
│   ├── lib/serverCloud.ts            # Utilitas database, media upload & RBAC server
│   ├── services/                     # Klien API, audio engine, Spotify, lazytype
│   ├── types/miu.ts
│   └── utils/                        # Markdown/KaTeX parser, PDF helper, formatter
├── next.config.ts
├── vercel.json
└── .env.example
```

---

## 🚀 Menjalankan Secara Lokal

### Prasyarat
- **Node.js `>= 20.9.0`**
- **npm**

### Langkah Instalasi

1. **Clone repositori & instal dependensi**
   ```bash
   git clone https://github.com/nabssku/miu.git
   cd miu
   npm install
   ```

2. **Konfigurasi Environment Variables**
   Salin file contoh menjadi `.env`:
   ```bash
   cp .env.example .env
   ```
   Lalu isi nilai pada `.env`:
   ```env
   NEON_DATABASE_URL=postgresql://...
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=...apps.googleusercontent.com
   CLOUDINARY_CLOUD_NAME=...
   CLOUDINARY_API_KEY=...
   CLOUDINARY_API_SECRET=...
   CLOUDINARY_UPLOAD_PRESET=
   GROQ_API_KEY=gsk_...
   GROQ_MODEL=qwen/qwen3.8-27b
   ```

3. **Jalankan server pengembangan**
   ```bash
   npm run dev
   ```
   Buka [http://localhost:3000](http://localhost:3000) untuk landing page atau [http://localhost:3000/app](http://localhost:3000/app) untuk langsung masuk ke Workspace Catatan.

### Skrip yang Tersedia
- `npm run dev` — Menjalankan server dev Next.js (Turbopack)
- `npm run typecheck` — Memeriksa tipe TypeScript (`tsc --noEmit`)
- `npm run build` — Membuat build produksi Next.js
- `npm run start` — Menjalankan hasil build produksi

---

## ☁️ Deploy ke Vercel

1. Hubungkan repositori GitHub ini ke **Vercel** (framework **Next.js** terdeteksi otomatis via `vercel.json`).
2. Pastikan versi **Node.js** di **Project Settings → Build and Deployment** memakai **20.x** atau **22.x**.
3. Masukkan seluruh variabel dari `.env.example` ke **Project Settings → Environment Variables**.
4. Tambahkan URL produksi Vercel Anda (contoh: `https://miu-workspace.vercel.app`) ke daftar **Authorized JavaScript origins** di **Google Cloud Console** untuk tombol Login Google.
