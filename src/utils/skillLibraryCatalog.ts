import type { NoteBlock, NoteBlockBase, NoteRecord } from '../types/miu';

export type SkillLibraryCategory =
  | 'Riset & Web'
  | 'Akademik & Kuliah'
  | 'Produktivitas & Rapat'
  | 'Koding & IoT'
  | 'Integrasi & API'
  | 'Komunitas';

export interface SkillLibraryItem {
  id: string;
  slug: string;
  name: string;
  icon: string;
  category: SkillLibraryCategory;
  summary: string;
  functionDescription: string;
  useCases: string[];
  tags: string[];
  connectionUrl?: string;
  instructionsMarkdown: string;
  authorName: string;
  authorId?: string;
  isOfficial?: boolean;
  installCount: number;
  createdAt: number;
  updatedAt: number;
}

export const SKILL_LIBRARY_CATEGORIES: SkillLibraryCategory[] = [
  'Riset & Web',
  'Akademik & Kuliah',
  'Produktivitas & Rapat',
  'Koding & IoT',
  'Integrasi & API',
  'Komunitas'
];

export const OFFICIAL_SKILL_LIBRARY: SkillLibraryItem[] = [
  {
    id: 'skill-lib-academic-research',
    slug: 'riset-akademik-web/skill.md',
    name: 'Riset Akademik & Referensi Web',
    icon: '🔬',
    category: 'Riset & Web',
    summary:
      'Mencari referensi jurnal, artikel ilmiah, dan fakta terkini via Web Tool lalu menyusunnya ke catatan lengkap dengan sitasi.',
    functionDescription:
      'Skill ini berfungsi sebagai asisten riset ilmiah dan literatur. Saat diaktifkan, AI otomatis menggunakan Web Tool untuk memverifikasi fakta, mengumpulkan kutipan/tautan sumber yang kredibel, merangkum temuan dalam struktur akademik (Pendahuluan, Temuan Utama, Analisis, dan Daftar Referensi), serta dapat langsung membuat atau memperbarui halaman catatan risetmu.',
    useCases: [
      'Mencari referensi paper atau artikel teknis terbaru beserta tautan sumbernya',
      'Membandingkan beberapa metode/teknologi dari hasil pencarian web ke dalam tabel catatan',
      'Menyusun tinjauan pustaka (literature review) langsung menjadi halaman catatan baru'
    ],
    tags: ['Web Tool', 'Riset Ilmiah', 'Sitasi', 'Catatan CRUD'],
    instructionsMarkdown: [
      '## Peran & Fungsi Utama',
      '- Kamu adalah **Asisten Riset Akademik & Literatur**. Selalu utamakan keakuratan data dengan memanggil tool `web_search` (Web Tool) ketika pengguna menanyakan topik ilmiah, berita terbaru, atau referensi teknis.',
      '- Setiap kali mengutip fakta dari hasil pencarian web, cantumkan nama sumber dan URL aslinya dalam format Markdown `[Nama Sumber](https://...)`.',
      '- Susun hasil riset dengan struktur rapi: **## Ringkasan Eksekutif**, **## Poin Temuan Utama**, **## Tabel Perbandingan** (jika relevan), dan **## Daftar Referensi**.',
      '- Jika pengguna meminta hasil riset disimpan, gunakan tool `create_note` atau `update_note` agar langsung tersimpan rapi di workspace catatan.'
    ].join('\n'),
    authorName: 'Tim Miu Official',
    authorId: 'miu-official',
    isOfficial: true,
    installCount: 148,
    createdAt: 1700000000000,
    updatedAt: 1700000000000
  },
  {
    id: 'skill-lib-iot-hardware',
    slug: 'asisten-iot-esp32/skill.md',
    name: 'Asisten IoT, ESP32 & Mikrokontroler',
    icon: '⚡',
    category: 'Koding & IoT',
    summary:
      'Merancang daftar komponen hardware, tabel wiring pinout ESP32/Arduino, kode firmware C++, dan diagram alur sistem IoT.',
    functionDescription:
      'Skill ini berfungsi untuk membantu praktikum dan proyek Smart Devices / IoT. AI akan otomatis menyusun spesifikasi komponen (sensor, aktuator, resistor pull-up/divider), tabel pemetaan pin (GPIO Pinout), potongan kode Arduino/ESP-IDF yang siap pakai, serta diagram arsitektur Mermaid (Sensor -> Mikrokontroler -> Cloud/Blynk/MQTT).',
    useCases: [
      'Membuat checklist komponen pasif & aktif beserta tabel wiring pin GPIO ESP32',
      'Menulis dan men-debug kode firmware Arduino IDE / PlatformIO untuk sensor DHT11, MPU6050, LDR, dan Relay',
      'Membuat diagram alur arsitektur IoT dengan blok Mermaid langsung di catatan'
    ],
    tags: ['IoT', 'ESP32', 'Arduino', 'Mermaid', 'Tabel Pinout'],
    instructionsMarkdown: [
      '## Peran & Fungsi Utama',
      '- Kamu adalah **Insinyur & Asisten Laboratorium IoT (ESP32, Arduino, Raspberry Pi, Sensor & Aktuator)**.',
      '- Saat pengguna membahas proyek hardware/IoT, selalu sertakan:',
      '  1. **Daftar Komponen & Spesifikasi Tegangan/Arus** (gunakan blok checklist `- [ ]` atau Tabel Markdown).',
      '  2. **Tabel Pemetaan Pin (Pinout Wiring)** antara sensor/aktuator dan GPIO mikrokontroler.',
      '  3. **Diagram Alur Sistem** menggunakan blok kode `mermaid` (`flowchart LR` atau `flowchart TD`).',
      '  4. **Kode Firmware** lengkap dengan komentar penjelasan baris demi baris.',
      '- Gunakan `web_search` jika perlu mengecek spesifikasi datasheet sensor atau library terbaru, dan gunakan `update_note` untuk menyisipkan hasilnya ke catatan modul praktikum.'
    ].join('\n'),
    authorName: 'Tim Miu Official',
    authorId: 'miu-official',
    isOfficial: true,
    installCount: 112,
    createdAt: 1700000010000,
    updatedAt: 1700000010000
  },
  {
    id: 'skill-lib-meeting-notulensi',
    slug: 'notulensi-rapat-ai/skill.md',
    name: 'Notulensi Rapat & Action Tracker',
    icon: '🎙️',
    category: 'Produktivitas & Rapat',
    summary:
      'Mengubah transkrip Voice Note atau catatan rapat menjadi ringkasan keputusan, agenda, dan checklist tugas berdeadline.',
    functionDescription:
      'Skill ini berfungsi untuk merapikan hasil diskusi, rekaman Voice Note dosen/rapat organisasi, atau poin-poin kasar menjadi dokumen notulensi profesional. AI otomatis mengekstrak Tujuan Rapat, Poin Pembahasan, Keputusan Kunci, serta membuat pelacak tugas (`- [ ]`) lengkap dengan estimasi Pomodoro di catatan.',
    useCases: [
      'Merangkum transkrip blok Voice Note menjadi notulensi rapat yang rapi',
      'Menyusun template agenda rapat sebelum diskusi dimulai',
      'Mengekstrak action items dari catatan rapat dan memperbarui blok To-do di halaman'
    ],
    tags: ['Notulensi', 'Voice Note', 'Agenda Rapat', 'To-do', 'Catatan CRUD'],
    instructionsMarkdown: [
      '## Peran & Fungsi Utama',
      '- Kamu adalah **Sekretaris & Notulen Rapat Eksekutif AI**.',
      '- Baca isi catatan aktif (termasuk transkrip pada blok `[Voice Note]`) menggunakan `read_note` jika diperlukan.',
      '- Format setiap notulensi atau agenda rapat ke dalam bagian berikut:',
      '  - **## 📌 Informasi & Tujuan Rapat**',
      '  - **## 💬 Poin Pembahasan Utama**',
      '  - **## ✅ Keputusan yang Disepakati**',
      '  - **## 🎯 Tindak Lanjut (Action Items)** dalam format checklist `- [ ] Tugas — Penanggung Jawab (🍅 Estimasi Pomodoro)`.',
      '- Jika pengguna meminta langsung diterapkan ke halaman, panggil `update_note` atau `create_note`.'
    ].join('\n'),
    authorName: 'Tim Miu Official',
    authorId: 'miu-official',
    isOfficial: true,
    installCount: 96,
    createdAt: 1700000020000,
    updatedAt: 1700000020000
  },
  {
    id: 'skill-lib-mermaid-architect',
    slug: 'arsitek-diagram-mermaid/skill.md',
    name: 'Arsitek Diagram Mermaid & Flowchart',
    icon: '📊',
    category: 'Koding & IoT',
    summary:
      'Membuat flowchart, sequence diagram, mind-map alur, dan ER diagram otomatis dari deskripsi teks di catatan.',
    functionDescription:
      'Skill ini berfungsi untuk memvisualisasikan konsep rumit, alur kode, skema database, atau tahapan proyek menjadi diagram Mermaid interaktif dan tabel ringkas. AI memastikan sintaks Mermaid bebas error (label dengan tanda kurung selalu diberi tanda kutip ganda) dan dapat langsung menyisipkan blok diagram ke dalam catatan aktif.',
    useCases: [
      'Mengubah penjelasan tahapan sistem menjadi flowchart atau sequence diagram Mermaid',
      'Membuat Entity-Relationship Diagram (ERD) dari deskripsi tabel database',
      'Menyisipkan diagram langsung ke halaman catatan aktif menggunakan tool update_note'
    ],
    tags: ['Mermaid', 'Flowchart', 'Sequence Diagram', 'ERD', 'Visualisasi'],
    instructionsMarkdown: [
      '## Peran & Fungsi Utama',
      '- Kamu adalah **Arsitek Visualisasi Sistem & Diagram Mermaid**.',
      '- Setiap kali menjelaskan alur, arsitektur, state machine, atau relasi tabel, buatlah blok kode ```mermaid yang valid.',
      '- Gunakan jenis diagram yang didukung penuh: `flowchart TD`, `flowchart LR`, `sequenceDiagram`, `stateDiagram-v2`, `classDiagram`, atau `erDiagram`.',
      '- Pastikan setiap label node yang mengandung karakter khusus seperti tanda kurung `()` atau `[]` selalu dibungkus tanda kutip ganda, contoh: `A["Sensor DHT11 (Suhu & Lembap)"] --> B["ESP32"]`.',
      '- Jika pengguna meminta diagram ditambahkan ke catatan, panggil `update_note` dengan `mode: "append_markdown"`.'
    ].join('\n'),
    authorName: 'Tim Miu Official',
    authorId: 'miu-official',
    isOfficial: true,
    installCount: 89,
    createdAt: 1700000030000,
    updatedAt: 1700000030000
  },
  {
    id: 'skill-lib-socratic-tutor',
    slug: 'tutor-ujian-kuis/skill.md',
    name: 'Tutor Ujian, Analogi & Generator Kuis',
    icon: '🎓',
    category: 'Akademik & Kuliah',
    summary:
      'Menjelaskan materi kuliah yang sulit dengan analogi sederhana, memeriksa celah pemahaman, dan membuat soal latihan ujian.',
    functionDescription:
      'Skill ini berfungsi sebagai tutor belajar personal untuk persiapan UTS/UAS. AI membaca seluruh halaman catatan mata kuliah di workspace, menjelaskan rumus atau teori sulit dengan analogi sehari-hari, lalu membuat paket soal latihan pilihan ganda & esai beserta pembahasan mendalam.',
    useCases: [
      'Membuat rangkuman kilat (cheat-sheet) dari beberapa halaman catatan kuliah',
      'Menjelaskan rumus matematika/fisika/algoritma dengan analogi yang mudah diingat',
      'Membuat halaman kuis latihan baru di workspace lengkap dengan kunci jawaban'
    ],
    tags: ['Tutor Kuliah', 'Kuis & Ujian', 'Analogi', 'Rangkuman', 'Catatan CRUD'],
    instructionsMarkdown: [
      '## Peran & Fungsi Utama',
      '- Kamu adalah **Tutor Akademik Socratic & Pembuat Soal Ujian**.',
      '- Saat menjelaskan konsep kuliah, gunakan pendekatan 3 langkah:',
      '  1. **Intisari 1 Kalimat**: Definisi paling jelas dan padat.',
      '  2. **Analogi Dunia Nyata**: Perumpamaan sehari-hari agar mudah dipahami.',
      '  3. **Contoh Penerapan / Rumus & Latihan Singkat**.',
      '- Kamu dapat membaca beberapa catatan terkait di workspace menggunakan `list_notes` dan `read_note` untuk menyusun rangkuman ujian terpadu atau membuat halaman bank soal baru via `create_note`.'
    ].join('\n'),
    authorName: 'Tim Miu Official',
    authorId: 'miu-official',
    isOfficial: true,
    installCount: 134,
    createdAt: 1700000040000,
    updatedAt: 1700000040000
  },
  {
    id: 'skill-lib-webhook-connector',
    slug: 'konektor-webhook-api/skill.md',
    name: 'Konektor Webhook & REST API Eksternal',
    icon: '🔗',
    category: 'Integrasi & API',
    summary:
      'Menghubungkan catatan Miu dengan webhook eksternal (n8n, Make, Discord, Slack, atau REST API kustom) secara dua arah.',
    functionDescription:
      'Skill ini berfungsi untuk mengintegrasikan catatan dengan layanan luar melalui HTTP GET/POST (`call_external_connection`). Pengguna cukup menuliskan URL endpoint atau webhook di dalam halaman skill.md ini, lalu meminta AI mengirim ringkasan catatan ke webhook tersebut atau mengambil data JSON dari API eksternal untuk ditulis ke dalam catatan.',
    useCases: [
      'Mengirim ringkasan catatan atau daftar tugas ke webhook n8n / Make / Discord / Slack',
      'Mengambil data JSON dari endpoint REST API publik dan mengubahnya menjadi tabel di catatan',
      'Mengotomasi sinkronisasi laporan proyek dari halaman catatan ke server eksternal'
    ],
    tags: ['Webhook', 'REST API', 'n8n', 'Otomasi', 'Koneksi Eksternal'],
    connectionUrl: 'https://httpbin.org/post',
    instructionsMarkdown: [
      '## Peran & Fungsi Utama',
      '- Kamu adalah **Agen Integrasi Webhook & REST API Eksternal**.',
      '- Ketika pengguna meminta pengiriman data catatan ke luar atau pengambilan data dari URL API, gunakan tool `call_external_connection` dengan `url`, `method` (`GET` atau `POST`), `headers`, dan `payload` JSON yang sesuai.',
      '- Setelah menerima respons dari API eksternal, format hasilnya menjadi blok catatan atau tabel yang rapi dan simpan ke halaman menggunakan `update_note` jika diminta.'
    ].join('\n'),
    authorName: 'Tim Miu Official',
    authorId: 'miu-official',
    isOfficial: true,
    installCount: 77,
    createdAt: 1700000050000,
    updatedAt: 1700000050000
  }
];

const LOCAL_COMMUNITY_SKILLS_KEY = 'miu_community_skill_library_v1';

export function loadLocalCommunitySkills(): SkillLibraryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_COMMUNITY_SKILLS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SkillLibraryItem[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalCommunitySkills(items: SkillLibraryItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      LOCAL_COMMUNITY_SKILLS_KEY,
      JSON.stringify(items.slice(0, 100))
    );
  } catch {
    // ignore
  }
}

export function mergeSkillLibraryItems(
  remoteItems: SkillLibraryItem[] = [],
  localItems: SkillLibraryItem[] = []
): SkillLibraryItem[] {
  const byId = new Map<string, SkillLibraryItem>();

  for (const official of OFFICIAL_SKILL_LIBRARY) {
    byId.set(official.id, official);
  }
  for (const loc of localItems) {
    if (loc && loc.id) {
      byId.set(loc.id, loc);
    }
  }
  for (const rem of remoteItems) {
    if (rem && rem.id) {
      const existing = byId.get(rem.id);
      byId.set(rem.id, {
        ...existing,
        ...rem,
        installCount: Math.max(
          rem.installCount || 0,
          existing?.installCount || 0
        )
      });
    }
  }

  return Array.from(byId.values()).sort((a, b) => {
    if (Boolean(a.isOfficial) !== Boolean(b.isOfficial)) {
      return a.isOfficial ? -1 : 1;
    }
    return (b.installCount || 0) - (a.installCount || 0) || b.updatedAt - a.updatedAt;
  });
}

function blocksToSkillMarkdown(blocks: Array<NoteBlock | NoteBlockBase>): string {
  const lines: string[] = [];
  for (const b of blocks) {
    // Skip the generic template banner callout or YAML config block when extracting clean instructions
    if (
      b.type === 'callout' &&
      b.content.includes('Halaman Skill AI (skill.md)')
    ) {
      continue;
    }
    if (b.type === 'code' && b.language === 'yaml' && b.content.includes('workspace_access:')) {
      continue;
    }
    if (b.type === 'h1') lines.push(`# ${b.content}`);
    else if (b.type === 'h2') lines.push(`## ${b.content}`);
    else if (b.type === 'h3') lines.push(`### ${b.content}`);
    else if (b.type === 'bullet') lines.push(`- ${b.content}`);
    else if (b.type === 'numbered') lines.push(`1. ${b.content}`);
    else if (b.type === 'todo') lines.push(`- [${b.checked ? 'x' : ' '}] ${b.content}`);
    else if (b.type === 'quote') lines.push(`> ${b.content}`);
    else if (b.type === 'callout') lines.push(`> ${b.calloutIcon || '💡'} ${b.content}`);
    else if (b.type === 'code') lines.push(`\`\`\`${b.language || ''}\n${b.content}\n\`\`\``);
    else if (b.content?.trim()) lines.push(b.content.trim());
  }
  return lines.join('\n\n').trim();
}

export function extractSkillMetadataFromNote(note: NoteRecord): {
  name: string;
  slug: string;
  icon: string;
  summary: string;
  functionDescription: string;
  useCases: string[];
  tags: string[];
  connectionUrl: string;
  instructionsMarkdown: string;
} {
  const rawTitle = (note.title || 'skill-baru/skill.md').trim();
  const cleanName = rawTitle
    .replace(/\/?skill\.md$/i, '')
    .replace(/[-_/]/g, ' ')
    .trim();
  const displayName = cleanName
    ? cleanName.replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Skill Kustom Miu';
  const slug = rawTitle.toLowerCase().includes('skill.md')
    ? rawTitle
    : `${rawTitle.toLowerCase().replace(/\s+/g, '-')}/skill.md`;

  let yamlDescription = '';
  let connectionUrl = '';

  for (const b of note.blocks || []) {
    if (b.type === 'code' && b.content) {
      const descMatch = b.content.match(/description:\s*(.+)/i);
      if (descMatch?.[1]) {
        yamlDescription = descMatch[1].trim();
      }
      const urlMatch = b.content.match(/url:\s*(https?:\/\/[^\s]+)/i);
      if (urlMatch?.[1] && !urlMatch[1].includes('httpbin.org/post')) {
        connectionUrl = urlMatch[1].trim();
      }
    }
    if (!connectionUrl && b.content) {
      const inlineUrl = b.content.match(/https:\/\/[^\s)]+/i);
      if (inlineUrl?.[0] && !inlineUrl[0].includes('httpbin.org/post')) {
        connectionUrl = inlineUrl[0].trim();
      }
    }
  }

  const bulletLines = (note.blocks || [])
    .filter((b) => b.type === 'bullet' && b.content.trim())
    .map((b) => b.content.trim());

  const instructionsMarkdown =
    blocksToSkillMarkdown(note.blocks || []) ||
    '## Instruksi Skill\n- Ikuti arahan pengguna dan gunakan Web Tool serta akses catatan sesuai kebutuhan.';

  const summary =
    yamlDescription ||
    bulletLines[0]?.slice(0, 140) ||
    `Skill ${displayName} untuk membantu riset, pengelolaan catatan, dan otomasi tugas di Miu.`;

  const functionDescription =
    bulletLines.length > 0
      ? `Skill "${displayName}" berfungsi untuk:\n${bulletLines
          .slice(0, 4)
          .map((l) => `• ${l}`)
          .join('\n')}`
      : summary;

  return {
    name: displayName,
    slug,
    icon: note.icon || '🧩',
    summary,
    functionDescription,
    useCases:
      bulletLines.length > 0
        ? bulletLines.slice(0, 4)
        : [
            `Menjalankan alur kerja ${displayName} secara otomatis`,
            'Mengakses dan memperbarui halaman catatan di workspace',
            'Mencari referensi pendukung dengan Web Tool'
          ],
    tags: ['Skill Komunitas', 'Catatan CRUD', 'Web Tool'],
    connectionUrl,
    instructionsMarkdown
  };
}
