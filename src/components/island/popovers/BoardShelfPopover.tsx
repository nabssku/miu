'use client';

import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowRightToLine, Check, Clipboard, Copy, Pin, Plus, Trash2 } from 'lucide-react';
import { db } from '../../../db/database';
import { useMiu } from '../../../context/MiuContext';

export const BoardShelfPopover: React.FC = () => {
  const { insertBlockIntoActiveNote, setActivePopover, setViewMode } = useMiu();
  const [activeTab, setActiveTab] = useState<'clipboard' | 'shelf'>('shelf');
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [contentType, setContentType] = useState<'text' | 'math'>('text');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const items = useLiveQuery(
    () => db.boardItems.where('tab').equals(activeTab).reverse().sortBy('createdAt'),
    [activeTab],
    []
  );

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;
    await db.boardItems.add({
      id: `brd-${Date.now()}`,
      tab: activeTab,
      contentType,
      title: newTitle.trim() || (contentType === 'math' ? 'Rumus Cepat' : 'Catatan Klip'),
      content: newContent.trim(),
      createdAt: Date.now()
    });
    setNewTitle('');
    setNewContent('');
  };

  const handleInsertToNote = async (item: {
    contentType: 'text' | 'math' | 'image';
    content: string;
    title: string;
  }) => {
    setViewMode('workspace');
    if (item.contentType === 'math') {
      await insertBlockIntoActiveNote({ type: 'math', content: item.content });
    } else if (item.contentType === 'image') {
      await insertBlockIntoActiveNote({ type: 'image', content: item.content, caption: item.title });
    } else {
      await insertBlockIntoActiveNote({ type: 'text', content: item.content });
    }
    setActivePopover('none');
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="w-full p-3.5 space-y-3 text-island-text">
      {/* Segmented Control Tabs */}
      <div className="flex items-center justify-between gap-1 bg-black/30 border border-white/10 p-1 rounded-xl">
        <button
          type="button"
          onClick={() => setActiveTab('shelf')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold rounded-lg transition ${
            activeTab === 'shelf'
              ? 'bg-sky-400 text-slate-950 shadow-sm'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <Pin className="w-3 h-3" />
          Pinned Shelf
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('clipboard')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold rounded-lg transition ${
            activeTab === 'clipboard'
              ? 'bg-sky-400 text-slate-950 shadow-sm'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <Clipboard className="w-3 h-3" />
          Clipboard History
        </button>
      </div>

      {/* Add Item Form */}
      <form onSubmit={handleAdd} className="miu-island-card p-2.5 rounded-2xl space-y-1.5">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Judul klip (mis. Teorema Bayes)"
            className="flex-1 bg-black/35 border border-white/10 rounded-xl px-2.5 py-1 text-[11px] text-white placeholder:text-slate-400 focus:outline-none focus:border-sky-400"
          />
          <select
            value={contentType}
            onChange={(e) => setContentType(e.target.value as 'text' | 'math')}
            className="bg-black/35 border border-white/10 rounded-xl px-2 py-1 text-[10px] font-mono text-sky-300 focus:outline-none"
          >
            <option value="text" className="bg-slate-900">Teks</option>
            <option value="math" className="bg-slate-900">LaTeX</option>
          </select>
        </div>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder={
              contentType === 'math'
                ? '\\sum_{i=1}^{n} x_i'
                : 'Simpan kutipan, link jurnal, atau rumus...'
            }
            className="flex-1 bg-black/35 border border-white/10 rounded-xl px-2.5 py-1.5 text-[11px] text-white placeholder:text-slate-400 focus:outline-none focus:border-sky-400"
          />
          <button
            type="submit"
            className="px-2.5 py-1.5 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 font-semibold text-[11px] flex items-center gap-1 shrink-0 transition"
            title="Simpan ke Board"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>

      {/* Items list */}
      <div className="max-h-44 overflow-y-auto space-y-2 pr-0.5">
        {items.length === 0 ? (
          <div className="text-[11px] text-slate-400 text-center py-6 miu-island-card rounded-2xl">
            Belum ada potongan referensi di tab ini.
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/miu-board-item', JSON.stringify(item));
              }}
              className="group miu-island-card hover:bg-white/[0.09] rounded-2xl p-2.5 transition"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[11px] font-semibold text-sky-300 truncate">
                  {item.title}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  {item.contentType !== 'image' && (
                    <button
                      type="button"
                      onClick={() => void handleCopy(item.id, item.content)}
                      className="p-1 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 transition"
                      title="Salin"
                    >
                      {copiedId === item.id ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleInsertToNote(item)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sky-400/20 hover:bg-sky-400/35 text-sky-200 text-[10px] font-medium transition"
                    title="Sisipkan ke Catatan Aktif"
                  >
                    <ArrowRightToLine className="w-3 h-3" />
                    Sisip
                  </button>
                  <button
                    type="button"
                    onClick={() => void db.boardItems.delete(item.id)}
                    className="p-1 text-slate-400 hover:text-rose-400 transition"
                    aria-label="Hapus item"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
              {item.contentType === 'image' ? (
                <img
                  src={item.content}
                  alt={item.title}
                  className="w-full h-20 object-cover rounded-xl border border-white/10"
                />
              ) : (
                <p className="text-[11px] text-slate-300 line-clamp-2 font-mono">{item.content}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
