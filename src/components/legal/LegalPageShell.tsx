import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, FileText, ShieldCheck } from 'lucide-react';

export interface LegalSection {
  id: string;
  title: string;
  paragraphs?: string[];
  bullets?: Array<{ label?: string; text: string }>;
  note?: string;
}

interface LegalPageShellProps {
  activeDoc: 'privacy' | 'terms';
  title: string;
  subtitle: string;
  lastUpdated: string;
  highlights: Array<{ label: string; value: string }>;
  sections: LegalSection[];
}

export const LegalPageShell: React.FC<LegalPageShellProps> = ({
  activeDoc,
  title,
  subtitle,
  lastUpdated,
  highlights,
  sections
}) => {
  const Icon = activeDoc === 'privacy' ? ShieldCheck : FileText;

  return (
    <div className="min-h-screen pt-28 pb-14 px-4 sm:px-8 max-w-3xl mx-auto flex flex-col gap-6">
      {/* Top Bar */}
      <nav
        aria-label="Navigasi dokumen legal"
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-surface/85 border border-border-subtle text-xs font-medium text-text-secondary hover:text-text-primary hover:border-accent-strong transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Beranda Miu</span>
        </Link>

        <div className="inline-flex items-center gap-1.5 p-1 rounded-full bg-surface/85 border border-border-subtle">
          <Link
            href="/privacy-policy"
            className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
              activeDoc === 'privacy'
                ? 'bg-accent-strong text-white dark:text-slate-950 shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Privacy Policy
          </Link>
          <Link
            href="/terms-of-service"
            className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
              activeDoc === 'terms'
                ? 'bg-accent-strong text-white dark:text-slate-950 shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Terms of Service
          </Link>
        </div>

        <Link
          href="/app"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-accent-strong text-white dark:text-slate-950 text-xs font-bold hover:opacity-95 transition"
        >
          <span>Buka Workspace</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </nav>

      {/* Hero Header Card */}
      <header className="miu-card p-6 sm:p-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-subtle border border-border-subtle text-xs font-semibold text-accent-strong">
            <Icon className="w-3.5 h-3.5" />
            <span>Miu Workspace • Legal</span>
          </span>
          <span className="text-xs font-mono text-text-secondary">
            Diperbarui: {lastUpdated}
          </span>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary">
            {title}
          </h1>
          <p className="text-sm text-text-secondary leading-relaxed">{subtitle}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
          {highlights.map((item) => (
            <div
              key={item.label}
              className="rounded-xl bg-subtle/80 border border-border-subtle px-3.5 py-2.5"
            >
              <p className="text-[11px] font-medium text-text-secondary">{item.label}</p>
              <p className="text-xs font-bold text-text-primary mt-0.5 break-all">{item.value}</p>
            </div>
          ))}
        </div>
      </header>

      {/* Main Legal Sections */}
      <main className="miu-card p-6 sm:p-8 space-y-7">
        {sections.map((section) => (
          <section key={section.id} id={section.id} className="space-y-2.5 scroll-mt-28">
            <h2 className="text-base sm:text-lg font-bold text-text-primary">
              {section.title}
            </h2>

            {section.paragraphs?.map((paragraph, idx) => (
              <p key={idx} className="text-sm text-text-secondary leading-relaxed">
                {paragraph}
              </p>
            ))}

            {section.bullets && section.bullets.length > 0 && (
              <ul className="space-y-2 pl-4 list-disc text-sm text-text-secondary leading-relaxed">
                {section.bullets.map((bullet, idx) => (
                  <li key={idx}>
                    {bullet.label && (
                      <strong className="text-text-primary">{bullet.label}: </strong>
                    )}
                    <span>{bullet.text}</span>
                  </li>
                ))}
              </ul>
            )}

            {section.note && (
              <div className="rounded-xl bg-subtle border border-border-subtle px-4 py-3 text-xs text-text-primary leading-relaxed">
                {section.note}
              </div>
            )}
          </section>
        ))}
      </main>

      {/* Footer */}
      <footer className="pt-4 border-t border-border-subtle flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-text-secondary">
        <span>Miu Workspace · https://miu.kodelokal.store</span>
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/" className="hover:text-text-primary transition">
            Beranda
          </Link>
          <Link href="/privacy-policy" className="hover:text-text-primary transition">
            Privacy Policy
          </Link>
          <Link href="/terms-of-service" className="hover:text-text-primary transition">
            Terms of Service
          </Link>
          <a
            href="https://github.com/nabssku/miu"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-text-primary transition"
          >
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
};
