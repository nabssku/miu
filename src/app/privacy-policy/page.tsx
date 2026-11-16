import type { Metadata } from 'next';
import React from 'react';
import { LegalPageShell, type LegalSection } from '@/components/legal/LegalPageShell';
import { buildPageMetadata } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: 'Privacy Policy',
  description:
    'Kebijakan Privasi Miu Workspace (miu.kodelokal.store): penyimpanan lokal, sinkronisasi cloud opsional, integrasi Google Account & Google Calendar, serta perlindungan data pengguna.',
  path: '/privacy-policy'
});

const PRIVACY_SECTIONS: LegalSection[] = [
  {
    id: 'ringkasan',
    title: '1. Pendekatan Local-First & Privasi Sejak Awal',
    paragraphs: [
      'Miu Workspace ("Miu", tersedia di https://miu.kodelokal.store) dirancang dengan prinsip local-first. Anda dapat menggunakan editor catatan, papan Kanban, kalender lokal, timer Pomodoro, white noise, dikte suara browser, serta screenshot/OCR lokal tanpa harus membuat akun atau masuk.',
      'Kebijakan Privasi ini menjelaskan informasi apa saja yang diakses ketika Anda menggunakan fitur opsional berbasis cloud, integrasi Google, atau asisten AI.'
    ]
  },
  {
    id: 'data-lokal',
    title: '2. Data yang Disimpan Secara Lokal di Perangkat Anda',
    paragraphs: [
      'Secara default, seluruh data kerja Anda disimpan langsung di penyimpanan browser perangkat Anda (IndexedDB via Dexie.js dan localStorage):'
    ],
    bullets: [
      {
        label: 'Isi Workspace',
        text: 'Catatan blok, blok /deadline, papan Kanban, daftar To-do, Board Shelf, serta riwayat percakapan AI tersimpan lokal di browser Anda.'
      },
      {
        label: 'Preferensi & Statistik Fokus',
        text: 'Tema tampilan, posisi Dynamic Island, durasi Pomodoro, pengingat kesehatan/sholat, dan catatan screen time harian tetap berada di perangkat Anda.'
      },
      {
        label: 'Kamera & Mikrofon Lokal',
        text: 'Fitur Cermin Cepat memproses pratinjau kamera secara lokal tanpa merekam atau mengunggah video. Fitur dikte suara hanya aktif ketika Anda menekan tombol mikrofon.'
      }
    ]
  },
  {
    id: 'google-oauth',
    title: '3. Login Akun Google (OAuth 2.0)',
    paragraphs: [
      'Apabila Anda memilih masuk menggunakan tombol Login Google, Miu meminta izin dasar (scope openid, email, dan profile) untuk:'
    ],
    bullets: [
      {
        label: 'Informasi Profil',
        text: 'Nama tampilan, alamat email, ID akun Google, dan URL foto profil digunakan untuk mengidentifikasi akun dan memisahkan catatan pribadi antar pengguna.'
      },
      {
        label: 'Kolaborasi & Berbagi Catatan',
        text: 'Alamat email digunakan untuk memvalidasi tautan berbagi catatan serta mengatur izin kolaborator (view, comment, atau edit).'
      }
    ]
  },
  {
    id: 'google-calendar',
    title: '4. Integrasi Google Calendar & Google API Limited Use Policy',
    paragraphs: [
      'Fitur Kalender di Miu dapat dihubungkan secara opsional ke akun Google Calendar Anda melalui tombol "Hubungkan Google Calendar" dengan scope https://www.googleapis.com/auth/calendar.events.'
    ],
    bullets: [
      {
        label: 'Tujuan Akses Kalender',
        text: 'Miu hanya membaca daftar acara pada rentang bulan yang sedang Anda buka untuk menampilkannya di kalender workspace, serta membuat atau memperbarui acara kalender secara eksplisit ketika Anda menekan sinkronisasi blok /deadline atau formulir tambah acara.'
      },
      {
        label: 'Penyimpanan Token Akses',
        text: 'Token OAuth Google Calendar disimpan sementara di browser Anda (localStorage) agar sesi tetap aktif saat menyinkronkan agenda, dan langsung dihapus serta dicabut ketika Anda menekan tombol Putuskan.'
      },
      {
        label: 'Tidak Ada Penjualan atau Pelatihan AI',
        text: 'Data Google Calendar Anda tidak pernah dijual, disewakan, dibagikan ke pengiklan pihak ketiga, atau digunakan untuk melatih model AI/machine learning apa pun.'
      }
    ],
    note: 'Kepatuhan Kebijakan Data Google: Penggunaan dan transfer informasi yang diterima dari Google API oleh Miu Workspace mematuhi Google API Services User Data Policy, termasuk persyaratan Limited Use (Google API Services User Data Policy, including the Limited Use requirements).'
  },
  {
    id: 'cloud-dan-ai',
    title: '5. Sinkronisasi Cloud Catatan, Media, & Layanan AI Opsional',
    bullets: [
      {
        label: 'Cloud Catatan & Media Cloud',
        text: 'Saat Anda masuk dengan akun Google atau membagikan catatan, isi catatan disinkronkan ke database cloud aplikasi dan gambar yang Anda sisipkan dapat diunggah ke penyimpanan media cloud agar dapat diakses lintas perangkat.'
      },
      {
        label: 'Asisten AI & Voice AI',
        text: 'Konteks catatan aktif, pertanyaan chat, atau rekaman suara hanya dikirim ketika Anda secara sadar menggunakan fitur AI atau Voice AI (Groq AI, ElevenLabs TTS/STT/Agent, atau AI Provider Custom / BYOK yang Anda konfigurasi sendiri). API Key custom yang Anda masukkan disimpan di browser perangkat Anda.'
      }
    ]
  },
  {
    id: 'hak-pengguna',
    title: '6. Kontrol, Retensi, & Penghapusan Data',
    paragraphs: [
      'Anda memegang kendali penuh atas data Anda setiap saat:'
    ],
    bullets: [
      {
        label: 'Hapus Data Lokal',
        text: 'Anda dapat menghapus catatan langsung di editor atau membersihkan data situs (IndexedDB & localStorage) melalui pengaturan browser.'
      },
      {
        label: 'Cabut Izin Google',
        text: 'Tekan tombol Putuskan di menu Kalender / akun Miu, atau cabut akses Miu kapan saja melalui halaman keamanan akun Google Anda di https://myaccount.google.com/permissions.'
      },
      {
        label: 'Keamanan Transmisi',
        text: 'Seluruh pertukaran data antara browser Anda, server Miu, dan API pihak ketiga dilakukan melalui koneksi terenkripsi HTTPS/TLS.'
      }
    ]
  },
  {
    id: 'kontak',
    title: '7. Perubahan Kebijakan & Kontak',
    paragraphs: [
      'Kebijakan Privasi ini dapat diperbarui sewaktu-waktu seiring penambahan atau penyempurnaan fitur. Perubahan terbaru akan selalu ditampilkan beserta tanggal pembaruannya pada halaman ini.',
      'Apabila Anda memiliki pertanyaan, permintaan penghapusan data cloud, atau laporan terkait privasi, Anda dapat menghubungi pengembang melalui halaman Issues repositori resmi proyek di https://github.com/nabssku/miu/issues atau melalui fitur Lapor Bug di halaman utama Miu.'
    ]
  }
];

export default function PrivacyPolicyPage() {
  return (
    <LegalPageShell
      activeDoc="privacy"
      title="Privacy Policy (Kebijakan Privasi)"
      subtitle="Penjelasan transparan mengenai cara Miu Workspace menangani penyimpanan lokal, akun Google opsional, integrasi Google Calendar, serta fitur AI."
      lastUpdated="17 November 2026"
      highlights={[
        { label: 'Aplikasi', value: 'Miu Workspace' },
        { label: 'Domain Resmi', value: 'https://miu.kodelokal.store' },
        { label: 'Arsitektur Dasar', value: 'Local-First (Opsional Cloud)' }
      ]}
      sections={PRIVACY_SECTIONS}
    />
  );
}
