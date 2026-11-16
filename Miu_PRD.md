# Product Requirements Document (PRD)

**Nama Produk:** Miu *(Student Focus Workspace)*

**Versi Dokumen:** 2.1 (Brand & Feature Specification)

**Referensi Konsep & Interaksi:** [iamlayzee.com](https://iamlayzee.com/) (*Dynanotch & Zee*)

**Target Platform:** Web Application & Progressive Web App (Desktop-First Responsive)

## 1. Ringkasan Eksekutif & Filosofi Produk

**Miu** adalah *all-in-one student productivity workspace* berbasis web yang menggabungkan struktur pencatatan fleksibel ala **Notion**, manajemen fokus **Pomodoro**, pemutar musik **Spotify + Lirik Live**, pelacak **Screen Time** per mata kuliah, utilitas cepat (*Voice-to-Note*, *Screen Clipper & OCR*, *Quick Mirror*, *White Noise Mixer*), serta asisten **External AI (BYOK / Custom API)** dalam satu antarmuka bebas distraksi.

Mengadaptasi filosofi dari **iamlayzee.com**, Miu mengusung empat prinsip utama:

1. **Satu Notch, Banyak Fungsi:** Seluruh navigasi dan utilitas melayang rapi dalam kapsul **Dynamic Island** yang terbuka saat kursor mendekat (*hover*) dan menyusut kembali saat kursor menjauh, ditemani maskot pendamping belajar mungil (**"Miu"**).

2. **Privasi Lokal & Tanpa Akun (*Local-First*):** Catatan, *To-do*, *Board*, *Screen Time*, hingga pemrosesan suara dikte dan OCR berjalan langsung di *browser* perangkat mahasiswa tanpa dikirim ke server pelacak.

3. **Ringan & Hemat Sumber Daya (*Lazy-Loaded*):** Jika sedang diam atau tab tidak aktif, animasi berhenti. Modul berat seperti model suara *offline* (WebGPU/WASM), kamera cermin, dan OCR baru dimuat ke memori saat pengguna menyalakannya.

4. **Gratis Selamanya & Mandiri:** Bebas iklan, tanpa *paywall*, tanpa wajib login, dan didukung oleh model **BYOK (Bring Your Own Key)** untuk fitur AI serta dukungan sukarela komunitas (*Traktir Kopi*).

## 2. Target Pengguna & Persona

| Persona | Karakteristik & Kebiasaan | Kebutuhan Utama | 
| :--- | :--- | :--- | 
| **Mahasiswa Aktif Kuliah (S1/D3)** | Mencatat materi dosen dengan cepat, sering menyalin kutipan/rumus dari PDF/web, dan ikut kelas daring (Zoom/Meet). | Dikte suara cepat (*Lazytype*), *screenshot* + ambil teks dari slide dosen (*Lazyshot*), papan klip sementara (*Board & Shelf*), dan cek penampilan cepat (*Cermin*). | 
| **Pejuang Tugas Akhir / Skripsi** | Menatap layar berjam-jam hingga larut malam, membutuhkan suasana audio tenang dan pengingat kesehatan. | Mode gelap krem hangat (*Warm Cream Dark Mode*), *Layered White Noise Mixer*, Pomodoro terikat sub-bab, serta pengingat minum, peregangan, dan waktu sholat. | 
| **Budget-Conscious Tech Student** | Membutuhkan AI untuk merangkum jurnal atau membuat kuis latihan tanpa biaya langganan bulanan. | Konektor **External AI (BYOK)** menggunakan API Key gratis/murah milik sendiri (Google Gemini, OpenRouter, OpenAI, atau Ollama lokal). | 

## 3. Peta Fitur Terpadu (Feature Matrix)

| Kategori | Fitur Utama | Adaptasi Web / PWA | 
| :--- | :--- | :--- | 
| **Workspace & Catatan** | **Notion-Style Block Editor** | Hierarki *Semester → Mata Kuliah → Catatan*, *slash-command* (`/`), blok matematika LaTeX, dan penyimpanan *local-first* (IndexedDB). | 
| **Navigasi Utama** | **🏝️ Dynamic Island (8 Posisi)** | Kapsul navigasi *hover-to-open* dengan maskot Miu yang dapat dipindah ke **8 titik posisi layar**. | 
| **Manajemen Fokus** | **⏱️ Focus & ✅ To-do** | Timer Pomodoro terikat ke daftar tugas/catatan (*Web Worker*) + *checklist* cepat langsung dari notch. | 
| **Utilitas Harian** | **📋 Board & Shelf** | Papan *clipboard* sementara & rak penyimpanan potongan teks, rumus, atau gambar referensi. | 
| **Audio & Musik** | **🎵 Musik & Lirik + 🌧️ White Noise + 🎚️ Mixer** | Kontrol Spotify + lirik sinkron (LRCLIB) dipadu *layered ambient sounds* dengan pengaturan volume terpisah. | 
| **Kesiapan Kelas** | **📷 Cermin (Quick Mirror)** | Pratinjau kamera instan langsung di dalam notch sebelum menyalakan kamera di Zoom/Google Meet. | 
| **Input Cepat** | **🎙️ Lazytype (Voice-to-Note)** | Tahan *hotkey*, bicara (Indo/English), lepas → teks otomatis terformat rapi dan tertempel ke blok catatan secara *offline*. | 
| **Tangkapan Layar** | **📸 Lazyshot (Clipper & OCR)** | *Hotkey* tarik kotak area layar/dokumen → **✏️ coret-coret** anotasi atau **🔤 ambil teks (OCR)** langsung ke catatan/AI. | 
| **Kesehatan & Waktu** | **⏰ Reminders & 📊 Screen Time** | Miu mengingatkan **💧 minum & gerak**, **🕌 waktu sholat**, serta grafik *Screen Time* aktif per mata kuliah. | 
| **Kecerdasan Buatan** | **✨ External AI (BYOK)** | Ringkas catatan, *Note-to-Quiz*, pecah tugas ke estimasi Pomodoro, dan penjelasan blok materi via API pilihan pengguna. | 

## 4. Spesifikasi Kebutuhan Fungsional (Functional Requirements)

### F1. Dynamic Island, Maskot Miu & 🏝️ 8 Posisi

* **FR-1.1 Hover & Hotkey Ergonomics:** Kapsul terbuka otomatis saat kursor diarahkan ke area notch atau saat menekan pintasan keyboard (`⌘K` / `Ctrl + K`), dan menyusut kembali saat kursor menjauh.

* **FR-1.2 🏝️ 8 Posisi Penempatan:** Pengguna dapat memilih 8 titik jangkar (*anchor*) untuk Dynamic Island agar tidak menutupi elemen penting: *Top-Left, Top-Center (Default), Top-Right, Mid-Left, Mid-Right, Bottom-Left, Bottom-Center, Bottom-Right*.

* **FR-1.3 Maskot Pendamping ("Miu"):** Karakter mini di sisi kapsul yang berubah ekspresi sesuai konteks (memakai *headphone* saat Spotify aktif, berkacamata fokus saat Pomodoro berjalan, memegang gelas air saat pengingat hidrasi muncul).

* **FR-1.4 Split Live Activity:** Saat Pomodoro dan Spotify berjalan bersamaan, kapsul terbelah secara organik—kapsul utama menampilkan hitung mundur fokus, sementara kapsul bulat di sebelahnya menampilkan *album art* berputar.

### F2. Notion-Style Block Workspace, ✅ To-do & 📋 Board & Shelf

* **FR-2.1 Struktur Akademik:** Pengelompokan catatan berdasarkan **Semester → Mata Kuliah → Halaman Catatan**.

* **FR-2.2 Block Editor:** Mendukung *slash-command* (`/h1`, `/todo`, `/callout`, `/code`, `/math` dengan sintaks LaTeX, `/quote`), *drag-and-drop* blok, dan ekspor ke Markdown/PDF.

* **FR-2.3 ✅ Quick To-do:** Daftar tugas terintegrasi antara halaman catatan dan pop-over Dynamic Island, lengkap dengan target jumlah sesi Pomodoro.

* **FR-2.4 📋 Board & Shelf:** Ruang penyimpanan sementara di dalam Dynamic Island untuk menampung riwayat teks yang disalin (*clipboard history*), potongan rumus, maupun gambar referensi saat mahasiswa melakukan riset agar tidak tertimpa.

### F3. 🎵 Musik & Lirik, 🌧️ White Noise & 🎚️ Mixer

* **FR-3.1 🎵 Spotify Player & Lirik Sinkron:**

  * Kontrol *Play, Pause, Next/Prev*, informasi lagu, dan pendaran warna adaptif (*ambient glow*) dari sampul album.

  * Menampilkan lirik lagu berjalan secara *real-time* di dalam notch menggunakan API terbuka **LRCLIB** (aman, tanpa menyentuh endpoint privat akun Spotify).

* **FR-3.2 🌧️ Layered White Noise:** Pemutar suara ambient bawaan (*Hujan, Hutan, Ombak, Kafe, Kalimba*) yang dapat diputar berlapis (*layered*) bersamaan dengan musik Spotify.

* **FR-3.3 🎚️ Audio Mixer:** Panel *slider* volume independen di dalam notch untuk menyeimbangkan tingkat suara antara **Spotify**, **White Noise**, dan **Suara Notifikasi/Timer**.

### F4. 📷 Cermin (Quick Mirror)

* **FR-4.1 Pratinjau Kamera Instan:** Satu klik ikon kamera di Dynamic Island membuka jendela cermin membulat menggunakan `navigator.mediaDevices.getUserMedia` untuk mengecek kerapian rambut/pencahayaan sebelum masuk kelas daring.

* **FR-4.2 Zero-Recording Guarantee:** Aliran video kamera hanya dirender secara lokal di elemen `<video>` browser dan langsung memutus akses perangkat keras (*hardware stream stop*) begitu pop-over ditutup.

### F5. 🎙️ Lazytype (Offline Voice-to-Note)

* **FR-5.1 Push-to-Talk Hotkey:** Pengguna menahan kombinasi tombol kustom (default: `Alt + Space` atau `Ctrl + Shift + V` di web), berbicara, lalu melepas tombol—hasil transkripsi langsung tertempel ke blok catatan yang sedang aktif.

* **FR-5.2 🔒 Offline & Akselerasi WebGPU/WASM:** Menggunakan model pengenalan suara *on-device* (*Whisper via Transformers.js*) yang berjalan di browser tanpa mengirim rekaman suara ke internet. Mendukung akselerasi **⚡ WebGPU** dengan *fallback* otomatis ke **CPU (WASM)** jika perangkat tidak memiliki GPU khusus.

* **FR-5.3 🇮🇩 Indo + English & ✍️ Format Rapi:** Mendukung dikte dwibahasa (Indonesia & Inggris) serta pembersihan tanda baca dan huruf kapital otomatis (dapat diperkaya opsional dengan External AI untuk merapikan struktur poin kuliah).

### F6. 📸 Lazyshot (Web Clipper, ✏️ Coret-coret & 🔤 Ambil Teks)

* **FR-6.1 Hotkey & Area Selection:** Menekan *hotkey* kustom (**⌨️ Hotkey bebas**, default `Alt + S`) memunculkan *overlay* tarik kotak (*region selector*) untuk menangkap area catatan, slide presentasi, atau layar (*Screen Capture API*).

* **FR-6.2 ✏️ Anotasi Coret-coret:** *Toolbar* gambar cepat (pena bebas, *highlighter*, panah, kotak sorotan, teks) langsung di atas hasil tangkapan layar sebelum disisipkan ke halaman catatan.

* **FR-6.3 🔤 Ambil Teks (Local OCR):** Ekstraksi teks instan dari gambar tangkapan layar menggunakan **Tesseract.js (WASM)** secara lokal—memudahkan mahasiswa menyalin teks dari slide dosen atau PDF terkunci langsung ke editor atau *prompt* AI.

### F7. ⏰ Reminders & 📊 Screen Time

* **FR-7.1 📊 Active Workspace Screen Time:** Melacak durasi belajar aktif per **Mata Kuliah** menggunakan *Page Visibility API* dan deteksi interaksi (*anti-AFK timeout* 3 menit). Ditampilkan dalam grafik batang 7 hari di pop-over notch.

* **FR-7.2 💧 Pengingat Minum & Gerak:** Miu memberikan notifikasi kapsul lembut setiap **60 menit** untuk minum air dan setiap **45 menit** untuk peregangan mata/bahu.

* **FR-7.3 🕌 Pengingat Waktu Sholat:** Notifikasi opsional menjelang dan saat masuk waktu sholat berdasarkan kota mahasiswa (menggunakan jadwal resmi Kemenag / API Aladhan dengan *caching* bulanan *offline*).

### F8. ✨ External AI Engine (BYOK & Custom Endpoint)

* **FR-8.1 Konfigurasi BYOK:** Mendukung API Key milik mahasiswa sendiri untuk **Google Gemini**, **OpenRouter**, **OpenAI**, maupun server lokal (**Ollama**). Key dienkripsi dan hanya disimpan di penyimpanan lokal browser.

* **FR-8.2 Fitur AI Akademik:**

  * *Summarize Notes:* Merangkum materi kuliah panjang menjadi poin terstruktur.

  * *Note-to-Quiz:* Membuat soal latihan pilihan ganda dan *flashcard* dari catatan aktif.

  * *Assignment Breakdown:* Memecah instruksi tugas besar menjadi daftar *To-do* beserta estimasi sesi Pomodoro.

  * *Inline Explain:* Menjelaskan paragraf atau rumus sulit dengan bahasa sederhana via *streaming response*.

## 5. Kebutuhan Non-Fungsional: Ringan, Privasi & Update Mandiri

### NFR-1. 🔒 Privasi & Penyimpanan Lokal (*Local-First*)

* Seluruh catatan, daftar *To-do*, isi *Board & Shelf*, log *Screen Time*, dan audio dikte *Lazytype* disimpan 100% di browser pengguna menggunakan **IndexedDB (Dexie.js)**.

* Tidak ada kewajiban membuat akun, tidak ada pelacakan analitik perilaku, dan tidak ada data yang dikirim ke server pusat (kecuali *request* langsung dari browser pengguna ke endpoint AI eksternal atau Spotify yang mereka hubungkan sendiri).

### NFR-2. 🪶 Hemat Memori & Baterai (*Zero-Idle Overhead*)

* **Visibility Throttling:** Saat tab berada di latar belakang (`document.hidden === true`), seluruh animasi *equalizer*, maskot Miu, dan pembaruan UI dijeda otomatis.

* **On-Demand Lazy Loading:** Modul *Lazytype* (model suara WASM), *Lazyshot* (Tesseract OCR), dan *Cermin* tidak dimuat saat halaman pertama kali dibuka. Modul hanya diunduh dan dialokasikan ke RAM ketika pengguna mengaktifkannya, serta dibersihkan saat dimatikan.

* Target penggunaan memori dasar saat idle: $< 90\text{ MB}$.

### NFR-3. 🔄 Update Mandiri via Dynamic Island

* Miu berjalan sebagai **Progressive Web App (PWA)** dengan *Service Worker*.

* Ketika versi terbaru dirilis, Dynamic Island memunculkan pill notifikasi kecil bertuliskan **`"Update"`** di sudut kapsul. Dengan sekali klik, *Service Worker* memperbarui aplikasi secara mulus tanpa menghilangkan draf catatan yang sedang diketik.

### NFR-4. 🎨 Dual-Theme Visual System (`Design.md`)

* **Light Mode (*Sky Blue & Cloud White*):** Latar biru langit lembut (`#EBF5FF` → `#F8FBFF`) dengan kartu putih awan (`#FFFFFF`) dan aksen biru cerah (`#38BDF8` / `#0284C7`).

* **Dark Mode (*Warm Cream & Deep Charcoal*):** Latar arang hangat (`#161412`) dengan kartu taupe gelap (`#211E1B`) dan teks/aksen **Warm Cream** (`#F5EFE6` / `#E6D8C3`) untuk kenyamanan belajar malam hari.

## 6. Model Distribusi & FAQ Pengguna (Built-in Info)

Miu mengadopsi model **Gratis Selamanya** (*Free Forever, No Ads, No Login*) yang didukung oleh kontribusi sukarela komunitas (**☕ Traktir Kopi biar Miu makin rajin**) serta tombol **🐞 Lapor Bug** langsung di dalam menu Dynamic Island.

### Ringkasan FAQ yang Ditampilkan di Landing Page / Help Popover

1. **Beneran gratis?** Ya, 100% gratis tanpa iklan, tanpa akun, dan tanpa versi berbayar. Fitur AI menggunakan API Key kamu sendiri (*BYOK*), sehingga bebas biaya langganan aplikasi.

2. **Berat nggak di browser/laptop?** Sangat ringan. Kalau lagi diam, Miu tidak memproses animasi berat. Fitur seperti *Lazytype* (dikte suara) dan *Lazyshot* (OCR) baru memakai memori kalau kamu nyalakan.

3. **Suara dikte & catatan saya dikirim ke internet?** Tidak. Catatan, *To-do*, *Board*, *Screen Time*, dan pemrosesan suara *Lazytype* berjalan lokal di browser perangkatmu.

4. **Laptop saya nggak punya GPU khusus, bisa pakai Lazytype?** Bisa. *Lazytype* otomatis mendeteksi **WebGPU** untuk akselerasi cepat, dan otomatis beralih ke mode **CPU (WebAssembly)** jika perangkat tidak memiliki GPU diskrit.

5. **Lirik lagunya dari mana? Aman buat akun Spotify?** Lirik diambil dari database terbuka **LRCLIB** berdasarkan judul lagu yang sedang diputar, sehingga tidak melanggar aturan maupun membahayakan akun Spotify kamu.

6. **Butuh koneksi internet?** Mencatat, Pomodoro, *To-do*, *Board*, *White Noise*, *Lazytype*, dan *Lazyshot* berjalan **100% offline**. Internet hanya dibutuhkan saat memutar Spotify, mengambil lirik baru, jadwal sholat, atau memanggil External AI.

## 7. Roadmap Pengembangan (MVP Phasing)

| Fase | Ruang Lingkup | Deliverable Utama | 
| :--- | :--- | :--- | 
| **Fase 1: Miu Notch & Core Editor** | Fondasi UI, Tema Dual-Mode, & Editor | Dynamic Island (8 posisi + maskot Miu), *Sky Blue & Warm Cream theme*, Notion-style Block Editor (*IndexedDB*), ✅ *To-do*, dan 📋 *Board & Shelf*. | 
| **Fase 2: Focus, Audio & Wellness** | Produktivitas & Kesehatan Mahasiswa | ⏱️ Pomodoro (*Web Worker*), 🌧️ *Layered White Noise* + 🎚️ *Mixer*, 📊 *Screen Time* per mata kuliah, ⏰ pengingat minum/gerak/sholat, dan 📷 *Cermin*. | 
| **Fase 3: Offline AI Tools & Integrations** | Utilitas Cerdas & Konektivitas Eksternal | 🎙️ *Lazytype* (WebGPU/WASM *offline*), 📸 *Lazyshot* (Anotasi + OCR), 🎵 Spotify + lirik LRCLIB, ✨ konektor External AI (BYOK), dan 🔄 PWA *Auto-Update Pill*. | 