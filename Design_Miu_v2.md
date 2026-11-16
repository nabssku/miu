# Design System & UI/UX Specification — Miu

**Nama Produk:** Miu *(Student Focus Workspace)*  
**Versi Dokumen:** 2.1  
**Referensi Interaksi:** [iamlayzee.com](https://iamlayzee.com/) (*Hover-to-Open Dynanotch & Companion Mascot*)  

---

## 1. Product Vision & Visual Philosophy

**Miu** dirancang sebagai ruang kerja mahasiswa yang tenang, ringan, dan bebas distraksi (*distraction-free*), memadukan struktur catatan fleksibel ala **Notion**, **Contextual Pomodoro**, **Spotify + Lirik Live**, **Layered White Noise Mixer**, **Screen Time**, utilitas cepat (*Cermin*, *Lazytype*, *Lazyshot*, *Board & Shelf*), serta asisten **External AI (BYOK)**.

* **One Notch, Zero Clutter:** Tidak ada *sidebar* permanen maupun *navbar* penuh yang memakan ruang layar. Seluruh navigasi dan kontrol utilitas melayang dalam kapsul **Dynamic Island** yang terbuka secara organik saat kursor mendekat (*hover*) dan menyusut kembali saat kursor menjauh.
* **Mascot-Driven Micro-Interactions ("Miu"):** Maskot mungil **Miu** bertengger di tepi kapsul sebagai pendamping belajar yang memberikan umpan balik visual tanpa mengganggu fokus (mengenakan *headphone* saat musik diputar, berkacamata saat sesi Pomodoro aktif, atau membawa gelas air saat pengingat hidrasi muncul).
* **Dual-Mood Visual System:**
  * **Light Mode (*Sky Blue & Cloud White*):** Nuansa biru langit lembut dan putih awan yang segar dan jernih untuk sesi kuliah serta mencatat di siang hari.
  * **Dark Mode (*Warm Cream & Deep Charcoal*):** Nuansa krem hangat di atas latar arang gelap yang meminimalkan cahaya biru (*low blue-light*) agar mata tetap nyaman saat menyusun tugas atau skripsi hingga larut malam.

---

## 2. Color Palette & Design Tokens

### A. Light Mode — *Sky Blue & Cloud White*

| Token Role | Name | Hex / RGBA | Penggunaan |
| :--- | :--- | :--- | :--- |
| `--bg-canvas` | Airy Sky Blue | `#EBF5FF` | Latar belakang utama halaman (gradasi halus ke `#F8FBFF`) |
| `--bg-surface` | Cloud White | `#FFFFFF` | Kartu editor catatan utama, *pop-over*, & panel *drawer* |
| `--bg-subtle` | Mist Blue | `#F0F7FF` | Latar *callout block*, *hover state*, & *input field* |
| `--border-subtle` | Sky Tint Border | `#D4E6F8` | Garis tepi kartu dan pemisah antar blok catatan |
| `--accent-primary` | Clear Sky Blue | `#38BDF8` | Tombol utama, indikator aktif, dan sorotan elemen |
| `--accent-strong` | Deep Azure | `#0284C7` | Tautan aktif, ikon terpilih, dan *focus ring* |
| `--text-primary` | Deep Slate Navy | `#0F172A` | Judul halaman, isi catatan utama, dan teks kontras tinggi |
| `--text-secondary` | Cool Slate | `#475569` | Subjudul, metadata mata kuliah, dan label sekunder |
| `--island-bg` | Obsidian Sky Glass | `rgba(15, 23, 42, 0.90)` | Latar kapsul Dynamic Island (*frosted dark glass*) |

### B. Dark Mode — *Warm Cream & Deep Charcoal*

| Token Role | Name | Hex / RGBA | Penggunaan |
| :--- | :--- | :--- | :--- |
| `--bg-canvas` | Deep Espresso | `#161412` | Latar belakang utama halaman malam hari |
| `--bg-surface` | Warm Dark Taupe | `#211E1B` | Kartu editor catatan dan panel samping |
| `--bg-subtle` | Roasted Cocoa | `#2B2723` | Latar *callout block*, *hover state*, dan *card* sekunder |
| `--border-subtle` | Cream Glass Border | `rgba(245, 239, 230, 0.12)` | Garis tepi halus bernuansa krem hangat |
| `--accent-primary` | Warm Cream | `#F5EFE6` | Sorotan utama, tombol aktif, dan teks primer |
| `--accent-strong` | Toasted Almond | `#E6D8C3` | Aksen sekunder, *badge* aktif, dan indikator fokus |
| `--text-primary` | Soft Warm Cream | `#F5EFE6` | Judul dan isi catatan (bebas silau putih murni) |
| `--text-secondary` | Warm Sand Gray | `#A89F91` | Metadata, *timestamp*, dan label pendukung |
| `--island-bg` | Smoked Obsidian | `rgba(28, 25, 22, 0.94)` | Latar kapsul Dynamic Island dengan *border glow* `#F5EFE6/20` |

### C. Semantic & Feature Accents

* **Pomodoro Focus:** Coral Red (`#F43F5E` di Light Mode / `#D99B66` Terracotta di Dark Mode)
* **Spotify & Audio Live:** Emerald / Sage (`#10B981` di Light Mode / `#8AB17D` di Dark Mode)
* **External AI Glow:** Indigo-Sky Gradient (`#6366F1` → `#38BDF8`)
* **Lazytype Voice Active:** Violet Pulse (`#8B5CF6`)
* **Reminders (Minum, Gerak, Sholat):** Warm Amber (`#F59E0B`) & Soft Teal (`#14B8A6`)

### D. CSS Variables (`globals.css`)

```css
:root {
  --bg-canvas: #EBF5FF;
  --bg-canvas-end: #F8FBFF;
  --bg-surface: #FFFFFF;
  --bg-subtle: #F0F7FF;
  --border-subtle: #D4E6F8;
  --accent-primary: #38BDF8;
  --accent-strong: #0284C7;
  --text-primary: #0F172A;
  --text-secondary: #475569;
  --island-bg: rgba(15, 23, 42, 0.90);
  --island-text: #F8FAFC;
  --island-border: rgba(255, 255, 255, 0.14);
}

.dark {
  --bg-canvas: #161412;
  --bg-canvas-end: #1A1715;
  --bg-surface: #211E1B;
  --bg-subtle: #2B2723;
  --border-subtle: rgba(245, 239, 230, 0.12);
  --accent-primary: #F5EFE6;
  --accent-strong: #E6D8C3;
  --text-primary: #F5EFE6;
  --text-secondary: #A89F91;
  --island-bg: rgba(28, 25, 22, 0.94);
  --island-text: #F5EFE6;
  --island-border: rgba(245, 239, 230, 0.18);
}
```

---

## 3. Typography & Spatial Scale

* **Primary UI & Block Editor Font:** `Plus Jakarta Sans` atau `Inter`
  * Page Title (H1): `32px` ($2\text{rem}$), Weight `700`, Tracking `-0.02em`
  * Section Heading (H2): `20px` ($1.25\text{rem}$), Weight `600`
  * Body Note Text: `16px` ($1\text{rem}$), Line Height `1.7`
* **Monospace Telemetry Font:** `JetBrains Mono`
  * Digunakan khusus untuk angka timer **Pomodoro (`24:15`)**, durasi **Screen Time (`2h 40m`)**, jadwal **Waktu Sholat (`11:48`)**, dan *hotkey* (**`⌘K`** / **`Alt+Space`**).
* **Border Radius System:**
  * Dynamic Island Compact Pill: `9999px`
  * Dynamic Island Expanded Dock / Popover: `26px`
  * Main Editor & AI Cards: `20px`
  * Inner Widgets, Sliders & Chips: `12px`

---

## 4. Miu Dynamic Island Specification

Dynamic Island menggunakan animasi *spring physics* (`stiffness: 420, damping: 32, mass: 0.8`) dan otomatis menjeda animasi ketika tab tidak aktif (*visibility throttling*).

### A. 🏝️ 8 Posisi Penempatan (Anchor Grid)

Pengguna dapat memindahkan posisi Miu Dynamic Island ke **8 titik jangkar** agar tidak pernah menghalangi area kerja:

| Posisi Anchor | Koordinat CSS | Arah Ekspansi Popover |
| :--- | :--- | :--- |
| **1. Top-Left** | `top-4 left-4` | Melebar ke kanan & ke bawah |
| **2. Top-Center (Default)** | `top-4 inset-x-0 flex justify-center` | Melebar simetris dari tengah & ke bawah |
| **3. Top-Right** | `top-4 right-4` | Melebar ke kiri & ke bawah |
| **4. Mid-Left** | `inset-y-0 left-4 flex items-center` | Kapsul vertikal ringkas; melebar ke kanan |
| **5. Mid-Right** | `inset-y-0 right-4 flex items-center` | Kapsul vertikal ringkas; melebar ke kiri |
| **6. Bottom-Left** | `bottom-4 left-4` | Melebar ke kanan & ke atas |
| **7. Bottom-Center** | `bottom-4 inset-x-0 flex justify-center` | Melebar simetris dari tengah & ke atas |
| **8. Bottom-Right** | `bottom-4 right-4` | Melebar ke kiri & ke atas |

### B. Ekspresi Maskot Miu

Maskot **Miu** (siluet karakter mungil minimalis dengan telinga kucing/awan) duduk di sisi kiri kapsul dan beradaptasi dengan status aktif:
* **Idle / Relaxed:** Mata berkedip pelan setiap 6 detik; tertidur (`zZz`) saat tab *idle* untuk menghemat CPU.
* **Focus Mode (Pomodoro):** Memakai kacamata baca kecil dengan ekspresi serius.
* **Music / White Noise Mode:** Memakai *headphone* dengan gerakan kepala mengikuti ritme *equalizer*.
* **Lazytype Listening:** Memegang mikrofon mini dengan gelombang suara berdenyut.
* **Health / Sholat Reminder:** Memegang gelas air (*💧 Minum*), meregangkan tangan (*🧘 Gerak*), atau ikon bulan sabit lembut (*🕌 Waktu Sholat*).

### C. State & Popover Matrix

1. **Compact Idle (`210px × 38px`):**
   * Menampilkan maskot **Miu**, nama mata kuliah aktif, *badge* **Screen Time** hari ini (`1h 45m`), pintasan `⌘K`, dan *pill* hijau/biru kecil **`Update`** jika versi PWA baru tersedia.
2. **Expanded Navigation Dock (`540px × 54px`):**
   * Terbuka saat *hover*. Berisi ikon cepat: **Notes**, **To-do**, **Board & Shelf**, **Pomodoro**, **Music & Mixer**, **Cermin**, **Lazytype**, **Lazyshot**, **Screen Time**, **External AI**, dan **Settings (8 Posisi + Tema)**.
3. **Split Live Activity (Pomodoro + Spotify & Lirik):**
   * **Kapsul Utama:** Hitung mundur Pomodoro (`24:15`) + baris lirik sinkron berjalan (*LRCLIB*) 1 baris di bawah judul lagu.
   * **Kapsul Terpisah (Bulat `38px × 38px`):** Menampilkan *album art* Spotify yang berputar dengan pendaran warna adaptif (*ambient glow*).
4. **🎵 Musik, 🌧️ White Noise & 🎚️ Mixer Popover (`360px × 260px`):**
   * Kontrol pemutar Spotify + tampilan lirik sinkron multi-baris.
   * Tombol *toggle* berlapis (*layered*) untuk suara **Hujan**, **Hutan**, **Ombak**, **Kafe**, dan **Kalimba**.
   * 3 *slider* volume independen (**Spotify**, **White Noise**, **Notifikasi**).
5. **📋 Board & Shelf Popover (`340px × 240px`):**
   * Dua tab ringkas: **Clipboard History** (teks/rumus yang baru disalin) dan **Pinned Shelf** (kartu referensi cepat yang bisa di-*drag* langsung ke blok editor).
6. **📷 Cermin Popover (`220px × 220px`):**
   * Pratinjau kamera membulat (*squircle*) dengan tombol *ring-light* layar (bingkai cahaya krem/putih lembut) untuk cek penampilan sebelum masuk kelas daring.
7. **🎙️ Lazytype Pill (`280px × 44px`):**
   * Muncul saat menahan *hotkey* dikte (`Alt + Space`): menampilkan gelombang audio *real-time*, *badge* **`🔒 Offline • WebGPU`** (atau `CPU`), dan indikator bahasa **`🇮🇩 / 🇬🇧`**.
8. **📸 Lazyshot Overlay & Toolbar:**
   * Lapisan redup di atas layar dengan kursor *crosshair* tarik kotak, diikuti *floating toolbar* berisi: **✏️ Pena Coret-coret**, **🖍️ Stabilo**, **↗️ Panah**, **🔤 Ambil Teks (OCR)**, dan **📋 Simpan ke Catatan / Board**.
9. **⏰ Reminders & 📊 Screen Time Popover (`360px × 240px`):**
   * Grafik batang 7 hari durasi belajar per mata kuliah, status pengingat **💧 Minum** & **🧘 Gerak**, hitung mundur **🕌 Waktu Sholat** berikutnya, serta tombol **☕ Traktir Kopi** dan **🐞 Lapor Bug** di bagian bawah.

---

## 5. Workspace Layout Architecture

* **Adaptive Safe Area:** Kontainer utama memiliki jarak aman (`pt-20` untuk *Top-Anchor*, `pb-20` untuk *Bottom-Anchor*, `pl-20`/`pr-20` untuk *Side-Anchor*) agar konten catatan tidak pernah tertutup Dynamic Island.
* **Center Focus Canvas (70% Width):**
  * Breadcrumb hierarki akademik (`Semester 5 / Sistem Basis Data / Normalisasi`).
  * Metadata catatan: Tag mata kuliah, tombol cepat *"Mulai Sesi Fokus"*, dan indikator penyimpanan lokal (`Saved locally`).
  * **Notion-Style Block Editor:** Mendukung *slash-command* (`/`), blok teks, *callout*, kode, rumus matematika LaTeX, gambar hasil *Lazyshot*, dan *checklist* tugas dengan estimasi sesi Pomodoro.
* **Collapsible Right Drawer (30% Width):**
  * **External AI Assistant (BYOK):** Pemilih *provider* (`Gemini API`, `OpenRouter`, `OpenAI`, `Ollama Local`), *chip* aksi cepat (*Ringkas Catatan*, *Buat Kuis Latihan*, *Pecah Tugas ke Pomodoro*), dan area *streaming response*.

---

## 6. Google Stitch UI Generation Prompts

Gunakan prompt di bawah ini di **Google Stitch** untuk menghasilkan visualisasi layar **Miu** secara konsisten:

### Prompt 1 — Light Mode Dashboard (*Sky Blue & Cloud White*)

```text
Design a modern, ultra-clean student productivity web application dashboard named "Miu" in Light Mode with a soft sky blue and cloud white aesthetic.

Color Palette:
- Base canvas background: Soft airy sky blue (#EBF5FF) transitioning subtly to cloud white (#F8FBFF)
- Elevated workspace cards & editor sheet: Pure cloud white (#FFFFFF) with subtle sky-tinted borders (#D4E6F8) and soft diffused shadows
- Primary accents & active states: Clear sky blue (#38BDF8) and deep azure (#0284C7)
- Typography: Deep slate navy (#0F172A) for headings and muted cool slate (#475569) for body text

Top-Center Dynamic Island Navigation ("Miu Notch" - Hero UI Element):
- No traditional sidebar or full-width top navbar. Place a floating, sleek dark frosted-glass Dynamic Island pill centered at the top notch of the screen, with a cute minimalist companion mascot icon ("Miu") wearing tiny headphones sitting on the left edge of the pill.
- Show the Dynamic Island in an active split-pill state: the main pill displays navigation icons (Notes, To-do, Board, Focus, Music, Cermin, Lazytype, Lazyshot, AI), a live Pomodoro countdown ("24:15") with a glowing coral dot, and a subtle synchronized lyric line; a detached circular pill right next to it displays a mini spinning Spotify album cover with animated audio bars.

Main Workspace Layout:
- Center Canvas (70% width): A distraction-free Notion-style block editor floating on a crisp cloud-white rounded card (20px radius). Includes course breadcrumb ("Semester 5 / Sistem Basis Data"), large clean title, structured lecture notes with callout blocks, a task checklist showing estimated Pomodoro sessions ("2 pomodoros"), and a subtle Screen Time badge ("Today: 2h 40m") plus a "Saved Locally" lock badge.
- Right Collapsible Panel (30% width): A sleek External AI Assistant drawer featuring a BYOK provider selector pill ("External AI: Gemini BYOK"), quick-action chips ("Summarize Notes", "Note-to-Quiz", "Break Down Assignment"), and a clean streaming response card.

Style: Minimalist macOS / iOS-inspired web UI, generous whitespace, rounded 20px corners, crisp Plus Jakarta Sans & JetBrains Mono typography, high readability, and soft glassmorphism.
```

### Prompt 2 — Dark Mode Dashboard (*Warm Cream & Deep Charcoal*)

```text
Design the exact same student productivity web application dashboard named "Miu" in a cozy Dark Mode with a Warm Cream aesthetic, tailored for late-night studying.

Color Palette:
- Base canvas background: Deep warm charcoal-espresso (#161412)
- Elevated editor card & panels: Warm dark taupe (#211E1B) with subtle warm cream-tinted borders (rgba(245, 239, 230, 0.12))
- Primary highlights, active pills & primary typography: Soft warm cream (#F5EFE6) and toasted almond (#E6D8C3)
- Secondary muted text: Warm sand gray (#A89F91)
- Accent indicators: Muted terracotta-amber (#D99B66) for Pomodoro focus and soft sage (#8AB17D) for Spotify & White Noise active status

Top-Center Dynamic Island Navigation ("Miu Notch"):
- Centered at the top notch, a sleek smoked-obsidian frosted Dynamic Island pill with a subtle warm cream border glow (#F5EFE6/20) and the minimalist mascot "Miu" wearing study glasses on the left.
- Displays compact navigation icons, active Pomodoro timer ("24:15"), Screen Time counter ("2h 40m"), next prayer time badge ("Isya 19:05"), and a connected Spotify + White Noise indicator ("Lo-Fi + Rain").

Main Workspace Layout:
- Center Canvas: Distraction-free Notion-style block editor on a warm dark taupe card (#211E1B) with crisp warm cream typography (#F5EFE6), interactive slash-command block menu preview, and lecture notes.
- Right Panel: External AI Assistant sidebar with warm cream action buttons, local privacy lock icon, and clean AI-generated study flashcards.

Style: Cozy, eye-friendly warm dark UI, tactile 20px rounded corners, subtle glassmorphism, editorial typography, zero harsh pure-white glare.
```

### Prompt 3 — Miu Dynamic Island States & Utility Popovers Showcase

```text
Create a clean UI component showcase sheet for the student web app "Miu", displaying 6 interactive states and popovers of its Dynamic Island navigation bar on a soft sky blue background (#EBF5FF):

1. Compact Idle State with Mascot Miu: Small dark frosted pill with the cute minimalist "Miu" mascot, active course "Web Programming", daily Screen Time "1h 45m", "⌘K" shortcut, and a small glowing "Update" pill badge.
2. Split Live Activity (Pomodoro + Spotify & Lyrics): Main pill showing coral pulsing dot, "24:59" timer, and synchronized lyric text; detached circular pill on the right showing spinning Spotify album artwork.
3. Audio & Layered White Noise Mixer Popover: Expanded rounded card showing Spotify track controls, toggle pills for "Rain", "Forest", "Cafe", and "Kalimba", plus 3 independent volume sliders.
4. Cermin (Quick Mirror) & Lazytype Offline Voice Pill: A circular webcam mirror preview card next to an active push-to-talk voice pill displaying audio waveforms and an "Offline • WebGPU • ID/EN" badge.
5. Screen Time, Health & Prayer Reminders Popover: Expanded card showing a 7-day study bar chart by course, hydration & stretch reminder badges, next prayer time countdown, and a subtle "Traktir Kopi" button.
6. 8-Position Anchor Selector Mini-Map: A sleek visual screen diagram highlighting the 8 selectable edge/corner positions for placing the Miu Dynamic Island.

Style: Crisp Apple-inspired micro-interactions, smooth squircle border radius, subtle drop shadows, high UI precision.
```