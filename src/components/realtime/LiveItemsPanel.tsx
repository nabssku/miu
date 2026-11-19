'use client';

import React, { startTransition, useCallback, useEffect, useMemo, useOptimistic, useState } from 'react';
import Link from 'next/link';
import type { SealedLiveQuery } from '@neon/realtime/client';
import { useLiveQuery as useNeonLiveQuery } from '@neon/realtime-react';
import { ArrowLeft, CheckCircle2, Radio, RefreshCw, Send, WifiOff } from 'lucide-react';
import type { LiveItemRow } from '@/lib/realtimeShared';
import { useIsRealtimeAvailable } from './RealtimeRoot';

type OptimisticLiveItem = LiveItemRow & { pending?: boolean };

interface SealedChannelState {
  channel: string;
  sealedQuery?: SealedLiveQuery<LiveItemRow>;
  error?: string;
}

interface UpdateLogEntry {
  id: string;
  summary: string;
  at: string;
}

function normalizeRowCreatedAt(createdAt: Date | string): Date {
  return createdAt instanceof Date ? createdAt : new Date(createdAt);
}

function applyOptimisticItem(
  items: readonly OptimisticLiveItem[],
  incoming: LiveItemRow
): readonly OptimisticLiveItem[] {
  if (items.some((item) => item.id === incoming.id)) {
    return items;
  }
  return [{ ...incoming, pending: true }, ...items];
}

async function fetchSealedItems(channel: string): Promise<SealedLiveQuery<LiveItemRow>> {
  const res = await fetch('/api/realtime/live-query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({ kind: 'items', channel })
  });
  const data = (await res.json().catch(() => ({}))) as {
    sealedQuery?: SealedLiveQuery<LiveItemRow>;
    error?: string;
  };
  if (!res.ok || !data.sealedQuery) {
    throw new Error(data.error || `Gagal mengambil sealed query (${res.status})`);
  }
  return data.sealedQuery;
}

const LocalTimestamp: React.FC<{ value: Date | string }> = ({ value }) => {
  const [formatted, setFormatted] = useState('');

  useEffect(() => {
    const date = normalizeRowCreatedAt(value);
    setFormatted(Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('id-ID'));
  }, [value]);

  return <span className="font-mono text-[11px] text-text-secondary">{formatted}</span>;
};

const LiveItemsSubscriber: React.FC<{
  channel: string;
  sealedQuery: SealedLiveQuery<LiveItemRow>;
  initialData?: readonly LiveItemRow[];
  dbDisabled: boolean;
  onReseal: () => void;
}> = ({ channel, sealedQuery, initialData, dbDisabled, onReseal }) => {
  const [query] = useState(sealedQuery);
  const refreshQuery = useCallback(() => fetchSealedItems(channel), [channel]);
  const { data, status, error, utils } = useNeonLiveQuery(query, {
    refreshQuery,
    initialData
  });

  const [optimisticItems, addOptimistic] = useOptimistic<
    readonly OptimisticLiveItem[],
    LiveItemRow
  >(data ?? initialData ?? [], applyOptimisticItem);

  const [content, setContent] = useState('');
  const [author, setAuthor] = useState('Miu User');
  const [notice, setNotice] = useState<{ tone: 'error' | 'info' | 'ok'; text: string } | null>(
    null
  );
  const [eventLog, setEventLog] = useState<UpdateLogEntry[]>([]);

  useEffect(() => {
    return utils.onUpdate((update) => {
      const timeLabel = new Date().toLocaleTimeString('id-ID');
      if (update.type === 'rows') {
        setEventLog((prev) => [
          {
            id: `${Date.now()}-${Math.random()}`,
            summary: `Snapshot awal/penuh diterima (${update.rows.length} baris)`,
            at: timeLabel
          },
          ...prev.slice(0, 14)
        ]);
        return;
      }
      setEventLog((prev) => [
        {
          id: `${Date.now()}-${Math.random()}`,
          summary: `Perubahan live (${update.changes.length} perubahan, txid: ${update.batch.txids.join(', ')})`,
          at: timeLabel
        },
        ...prev.slice(0, 14)
      ]);
    });
  }, [utils]);

  const sortedItems = useMemo(() => {
    return [...optimisticItems].sort((a, b) => {
      const ta = normalizeRowCreatedAt(a.created_at).getTime();
      const tb = normalizeRowCreatedAt(b.created_at).getTime();
      return tb - ta || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);
    });
  }, [optimisticItems]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;

    const item: LiveItemRow = {
      id: crypto.randomUUID(),
      channel,
      content: trimmed,
      author: author.trim() || 'Miu User',
      created_at: new Date()
    };

    setContent('');
    setNotice(null);

    startTransition(async () => {
      addOptimistic(item);
      try {
        const res = await fetch('/api/realtime/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: item.id,
            channel: item.channel,
            content: item.content,
            author: item.author
          })
        });
        const payload = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          kind?: 'committed' | 'unchanged';
          txid?: string;
          error?: string;
        };
        if (!res.ok || !payload.ok) {
          setNotice({
            tone: 'error',
            text: payload.error || `Gagal menyimpan ke Postgres (${res.status})`
          });
          return;
        }
        if (payload.kind === 'committed' && payload.txid) {
          await utils.awaitTxId(payload.txid, 10_000);
          setNotice({
            tone: 'ok',
            text: `Baris tersimpan & terkonfirmasi lewat stream live (txid ${payload.txid}).`
          });
        }
      } catch {
        setNotice({
          tone: 'info',
          text: 'Tersimpan di Postgres; menunggu stream live menyinkronkan perubahan.'
        });
      }
    });
  };

  const statusBadge = (() => {
    switch (status) {
      case 'live':
        return {
          label: 'Live Terhubung',
          cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30',
          Icon: Radio
        };
      case 'connecting':
        return {
          label: 'Menyambung...',
          cls: 'bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/30',
          Icon: RefreshCw
        };
      case 'stale':
        return {
          label: 'Memperbarui Capability',
          cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30',
          Icon: RefreshCw
        };
      case 'error':
      default:
        return {
          label: 'Terputus / Error',
          cls: 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30',
          Icon: WifiOff
        };
    }
  })();

  const StatusIcon = statusBadge.Icon;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-subtle/40 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${statusBadge.cls}`}
          >
            <StatusIcon className="w-3.5 h-3.5" />
            {statusBadge.label}
          </span>
          <span className="text-xs text-text-secondary font-mono">
            channel={channel} • fingerprint={sealedQuery.queryFingerprint.slice(0, 12)}…
          </span>
        </div>

        {status === 'error' && (
          <button
            type="button"
            onClick={onReseal}
            className="inline-flex items-center gap-1.5 rounded-xl bg-accent-strong px-3 py-1.5 text-xs font-semibold text-white dark:text-slate-950"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Sambungkan Ulang
          </button>
        )}
      </div>

      {dbDisabled && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-700 dark:text-amber-300">
          <strong>Catatan:</strong> `DATABASE_URL` / `NEON_DATABASE_URL` belum disetel pada server,
          sehingga pembacaan awal dan penambahan baris SQL belum bisa ditulis ke Postgres sampai
          connection string ditambahkan di `.env.local`.
        </div>
      )}

      {status === 'error' && error && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-600 dark:text-rose-300"
        >
          Live updates berhenti: {error.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="Nama pengirim"
          className="sm:w-44 rounded-xl border border-border-subtle bg-subtle px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent-strong"
        />
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Kirim pesan atau event ke tabel miu_live_items..."
          required
          className="flex-1 rounded-xl border border-border-subtle bg-subtle px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent-strong"
        />
        <button
          type="submit"
          disabled={dbDisabled}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-accent-strong px-4 py-2 text-xs font-semibold text-white dark:text-slate-950 disabled:opacity-50"
        >
          <Send className="w-3.5 h-3.5" />
          Insert Baris
        </button>
      </form>

      {notice && (
        <div
          role="status"
          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${
            notice.tone === 'error'
              ? 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-300'
              : notice.tone === 'ok'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                : 'border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-300'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>{notice.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="lg:col-span-2 rounded-2xl border border-border-subtle bg-surface p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-text-primary">
              Baris Live (`miu_live_items`)
            </h2>
            <span className="text-xs text-text-secondary">
              {sortedItems.length} baris
            </span>
          </div>

          {data === undefined && sortedItems.length === 0 ? (
            <p className="text-xs text-text-secondary py-6 text-center">
              Menunggu snapshot awal dari Neon Realtime...
            </p>
          ) : sortedItems.length === 0 ? (
            <p className="text-xs text-text-secondary py-6 text-center">
              Belum ada baris pada channel `{channel}`. Coba insert satu baris di atas.
            </p>
          ) : (
            <ul className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {sortedItems.map((item) => (
                <li
                  key={item.id}
                  aria-busy={item.pending}
                  className={`rounded-xl border border-border-subtle px-3.5 py-2.5 flex items-start justify-between gap-3 ${
                    item.pending ? 'opacity-65 bg-subtle/30' : 'bg-subtle/20'
                  }`}
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-text-primary">
                        {item.author}
                      </span>
                      {item.pending && (
                        <span className="text-[10px] font-mono text-sky-500">
                          menunggu konfirmasi txid...
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-primary break-words">{item.content}</p>
                    <p className="text-[10px] font-mono text-text-secondary truncate">
                      id={item.id}
                    </p>
                  </div>
                  <LocalTimestamp value={item.created_at} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-border-subtle bg-surface p-4 space-y-3">
          <h2 className="text-sm font-bold text-text-primary">Log Stream Transaksi</h2>
          {eventLog.length === 0 ? (
            <p className="text-xs text-text-secondary">
              Belum ada event update yang diterima.
            </p>
          ) : (
            <ul className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {eventLog.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-xl border border-border-subtle bg-subtle/30 px-3 py-2 text-[11px] space-y-0.5"
                >
                  <div className="font-mono text-[10px] text-text-secondary">{entry.at}</div>
                  <div className="text-text-primary">{entry.summary}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

export const LiveItemsPanel: React.FC = () => {
  const realtimeAvailable = useIsRealtimeAvailable();
  const [channel, setChannel] = useState('default');
  const [sealed, setSealed] = useState<SealedChannelState | undefined>();
  const [initialItems, setInitialItems] = useState<LiveItemRow[] | undefined>();
  const [dbDisabled, setDbDisabled] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!realtimeAvailable) return;
    let cancelled = false;

    Promise.all([
      fetchSealedItems(channel),
      fetch(`/api/realtime/items?channel=${encodeURIComponent(channel)}`, {
        cache: 'no-store'
      }).then((r) => r.json() as Promise<{ items?: LiveItemRow[]; dbDisabled?: boolean }>)
    ])
      .then(([sealedQuery, itemsRes]) => {
        if (cancelled) return;
        setDbDisabled(Boolean(itemsRes.dbDisabled));
        setInitialItems(
          (itemsRes.items || []).map((row) => ({
            ...row,
            created_at: normalizeRowCreatedAt(row.created_at)
          }))
        );
        setSealed({ channel, sealedQuery });
      })
      .catch((err) => {
        if (cancelled) return;
        setSealed({
          channel,
          error: err instanceof Error ? err.message : 'Gagal memuat live query'
        });
      });

    return () => {
      cancelled = true;
    };
  }, [realtimeAvailable, channel, nonce]);

  return (
    <main className="min-h-screen bg-surface text-text-primary px-4 py-8 sm:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <Link
              href="/app"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Kembali ke Workspace
            </Link>
            <h1 className="text-xl font-bold text-text-primary">
              Neon Realtime Live Query (`miu_live_items`)
            </h1>
            <p className="text-xs text-text-secondary">
              Query disegel di server lewat `/api/realtime/live-query` menggunakan `rawSql` dan
              disubscribe oleh browser lewat `@neon/realtime-react`.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-text-secondary" htmlFor="live-channel-select">
              Channel:
            </label>
            <select
              id="live-channel-select"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="rounded-xl border border-border-subtle bg-subtle px-3 py-1.5 text-xs font-semibold text-text-primary"
            >
              <option value="default">default</option>
              <option value="workspace">workspace</option>
              <option value="demo">demo</option>
            </select>
          </div>
        </div>

        {!realtimeAvailable ? (
          <div className="rounded-2xl border border-border-subtle bg-subtle/40 p-5 text-xs text-text-secondary">
            Neon Realtime belum aktif (`NEON_REALTIME_URL` atau `NEXT_PUBLIC_NEON_REALTIME_URL`
            belum tersedia).
          </div>
        ) : sealed?.error ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-xs text-rose-600 dark:text-rose-300 space-y-2">
            <p>{sealed.error}</p>
            <button
              type="button"
              onClick={() => setNonce((n) => n + 1)}
              className="rounded-xl bg-accent-strong px-3 py-1.5 text-xs font-semibold text-white dark:text-slate-950"
            >
              Coba Lagi
            </button>
          </div>
        ) : sealed?.channel === channel && sealed.sealedQuery ? (
          <LiveItemsSubscriber
            key={`${channel}:${sealed.sealedQuery.queryFingerprint}:${nonce}`}
            channel={channel}
            sealedQuery={sealed.sealedQuery}
            initialData={initialItems}
            dbDisabled={dbDisabled}
            onReseal={() => setNonce((n) => n + 1)}
          />
        ) : (
          <div className="rounded-2xl border border-border-subtle bg-subtle/30 p-5 text-xs text-text-secondary">
            Menyiapkan sealed live query dari server...
          </div>
        )}
      </div>
    </main>
  );
};
