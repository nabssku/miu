import type { Metadata } from 'next';
import React from 'react';
import { LegalPageShell, type LegalSection } from '@/components/legal/LegalPageShell';
import { buildPageMetadata } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: 'Terms of Service',
  description:
    'Syarat dan Ketentuan Layanan Miu Workspace (miu.kodelokal.store) terkait penggunaan editor catatan, Kanban, Kalender, Google Calendar, dan layanan AI.',
  path: '/terms-of-service'
});

const TERMS_SECTIONS: LegalSection[] = [
  {
    id: 'penerimaan',
    title: '1. Penerimaan Syarat Layanan',
    paragraphs: [
      'Dengan mengakses atau menggunakan Miu Workspace ("Miu", di https://miu.kodelokal.store), Anda menyetujui untuk terikat pada Syarat dan Ketentuan Layanan ini. Apabila Anda tidak menyetujui bagian mana pun dari ketentuan ini, mohon untuk tidak menggunakan fitur daring yang terkait.'
    ]
  },
  {
    id: 'layanan',
    title: '2. Deskripsi Layanan',
    paragraphs: [
      'Miu menyediakan ruang kerja produktivitas berbasis web yang mencakup editor catatan blok, manajemen tugas Kanban, Kalender beserta blok /deadline, Dynamic Island ambien (Pomodoro, To-do, Board Shelf, pemutar musik, mixer white noise, pengingat kesehatan/sholat, dikte suara, serta OCR lokal), sinkronisasi cloud opsional, integrasi Google Calendar opsional, dan asisten AI teks maupun suara.'
    ]
  },
  {
    id: 'kepemilikan-konten',
    title: '3. Kepemilikan Konten & Tanggung Jawab Data',
    bullets: [
      {
        label: 'Hak Penuh Pengguna',
        text: 'Anda tetap menjadi pemilik tunggal atas seluruh catatan, dokumen, tugas, media, dan konten lain yang Anda buat atau simpan di Miu.'
      },
      {
        label: 'Pencadangan Data Lokal',
        text: 'Karena Miu menyimpan sebagian atau seluruh data di browser perangkat Anda apabila Anda tidak menggunakan sinkronisasi cloud, Anda disarankan melakukan ekspor atau cadangan berkala untuk catatan penting sebelum membersihkan cache/data browser.'
      },
      {
        label: 'Berbagi & Kolaborasi',
        text: 'Ketika Anda membuat tautan berbagi catatan atau memberi akses edit/komentar kepada pihak lain, Anda bertanggung jawab penuh atas konten yang dibagikan dan pengaturan hak aksesnya.'
      }
    ]
  },
  {
    id: 'integrasi-pihak-ketiga',
    title: '4. Integrasi Google & Layanan Pihak Ketiga (BYOK / Eksternal)',
    paragraphs: [
      'Sebagian fitur Miu bersifat opsional dan terhubung ke layanan pihak ketiga:'
    ],
    bullets: [
      {
        label: 'Google Account & Google Calendar',
        text: 'Penggunaan login Google dan sinkronisasi agenda Google Calendar tunduk pula pada Terms of Service dan Privacy Policy Google. Miu hanya memproses event kalender sesuai tindakan langsung yang Anda picu.'
      },
      {
        label: 'Provider AI & Suara (Groq, ElevenLabs, Custom BYOK)',
        text: 'Jika Anda memakai API Key sendiri (Bring Your Own Key) atau proxy AI yang tersedia, Anda bertanggung jawab menjaga kerahasiaan kredensial Anda, memahami biaya/kuota dari penyedia masing-masing, serta meninjau ulang keluaran AI sebelum dijadikan rujukan penting.'
      },
      {
        label: 'Sematan Video & Musik',
        text: 'Pemutaran embed YouTube, Vimeo, Loom, Google Drive, maupun Spotify mengikuti ketentuan hak cipta dan layanan penyedia media terkait.'
      }
    ]
  },
  {
    id: 'penggunaan-dilarang',
    title: '5. Penggunaan yang Tidak Diperkenankan',
    paragraphs: [
      'Dalam menggunakan Miu, Anda setuju untuk tidak:'
    ],
    bullets: [
      {
        label: 'Penyalahgunaan Infrastruktur',
        text: 'Melakukan spam, scraping otomatis berlebihan, DDoS, atau menyalahgunakan endpoint API server (/api/*) di luar penggunaan wajar aplikasi.'
      },
      {
        label: 'Akses Tanpa Hak',
        text: 'Berusaha melewati batas izin berbagi catatan, mengakses data pengguna lain, atau mengeksploitasi celah keamanan sistem.'
      },
      {
        label: 'Konten Melanggar Hukum',
        text: 'Menyimpan, membagikan, atau mendistribusikan materi ilegal, malware, atau konten yang melanggar hak kekayaan intelektual pihak lain melalui fitur berbagi cloud.'
      }
    ]
  },
  {
    id: 'penafian',
    title: '6. Ketersediaan Layanan & Batasan Tanggung Jawab',
    paragraphs: [
      'Miu disediakan secara gratis "sebagaimana adanya" (as-is) dan "sebagaimana tersedia" (as-available) tanpa jaminan tersurat maupun tersirat bahwa layanan akan selalu bebas dari gangguan, keterlambatan jaringan eksternal, atau perubahan API pihak ketiga.',
      'Sejauh diizinkan oleh hukum yang berlaku, pengembang Miu tidak bertanggung jawab atas kehilangan data lokal akibat pembersihan browser, gangguan penyedia pihak ketiga, maupun kerugian tidak langsung dari penggunaan layanan ini.'
    ]
  },
  {
    id: 'perubahan-kontak',
    title: '7. Pembaruan Ketentuan & Kontak',
    paragraphs: [
      'Syarat dan Ketentuan Layanan ini dapat diperbarui kapan saja untuk menyesuaikan perkembangan fitur atau kepatuhan regulasi. Penggunaan berkelanjutan setelah pembaruan dianggap sebagai persetujuan atas versi terbaru.',
      'Untuk pertanyaan, saran, atau pelaporan kendala layanan, silakan hubungi pengembang melalui https://github.com/nabssku/miu/issues atau menu Lapor Bug di aplikasi.'
    ]
  }
];

export default function TermsOfServicePage() {
  return (
    <LegalPageShell
      activeDoc="terms"
      title="Terms of Service (Syarat & Ketentuan Layanan)"
      subtitle="Ketentuan penggunaan aplikasi Miu Workspace, hak atas konten Anda, serta batasan tanggung jawab fitur cloud, Google Calendar, dan AI opsional."
      lastUpdated="17 November 2026"
      highlights={[
        { label: 'Layanan', value: 'Miu Workspace' },
        { label: 'Domain Resmi', value: 'https://miu.kodelokal.store' },
        { label: 'Lisensi Penggunaan', value: 'Gratis / Local-First' }
      ]}
      sections={TERMS_SECTIONS}
    />
  );
}
