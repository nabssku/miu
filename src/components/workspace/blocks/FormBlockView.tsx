'use client';

import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  ClipboardList,
  Database,
  Eye,
  EyeOff,
  Globe,
  Loader2,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  X
} from 'lucide-react';
import type {
  DatabaseBadgeColor,
  DatabaseColumn,
  DatabaseColumnType,
  FormBlockData,
  FormFieldConfig,
  FormResponseAccess,
  NoteBlock,
  NoteRecord
} from '../../../types/miu';
import {
  BADGE_COLOR_CLASSES,
  BADGE_COLOR_ORDER,
  buildFormFieldsFromColumns,
  createDatabaseId,
  createDefaultFormData,
  createSelectOption,
  findAllDatabaseSources,
  sanitizeFormSubmission,
  syncFormFieldsWithDatabase
} from '../../../utils/databaseHelper';

interface FormBlockViewProps {
  block: NoteBlock;
  activeNoteId: string;
  allNotes: NoteRecord[];
  canEdit: boolean;
  onUpdateForm: (nextData: FormBlockData, titleContent: string) => Promise<void> | void;
  onSyncColumnInDatabase: (
    targetNoteId: string,
    targetBlockId: string,
    column: DatabaseColumn
  ) => Promise<void>;
  onCreateStarterDatabase: () => Promise<{ noteId: string; blockId: string } | null>;
  onSubmitForm: (payload: {
    formBlockId: string;
    targetNoteId: string;
    targetBlockId: string;
    values: Record<string, unknown>;
    responseAccess: FormResponseAccess;
  }) => Promise<{ ok: boolean; error?: string }>;
}

const FIELD_TYPE_OPTIONS: Array<{ id: DatabaseColumnType; label: string }> = [
  { id: 'text', label: 'Teks Singkat' },
  { id: 'number', label: 'Angka' },
  { id: 'select', label: 'Pilihan Tunggal' },
  { id: 'multi_select', label: 'Multi-Pilihan' },
  { id: 'checkbox', label: 'Checkbox (Ya/Tidak)' },
  { id: 'date', label: 'Tanggal' },
  { id: 'url', label: 'Tautan URL' }
];

const ACCESS_OPTIONS: Array<{
  id: FormResponseAccess;
  label: string;
  desc: string;
  Icon: React.FC<{ className?: string }>;
}> = [
  {
    id: 'public',
    label: 'Terbuka (Link Publik & Kolaborator)',
    desc: 'Siapa saja dengan link share dapat mengisi formulir',
    Icon: Globe
  },
  {
    id: 'edit_only',
    label: 'Hanya Kolaborator Edit',
    desc: 'Hanya pemilik & editor catatan yang bisa mengirim respon',
    Icon: Lock
  },
  {
    id: 'closed',
    label: 'Formulir Ditutup',
    desc: 'Responden tidak dapat mengirim isian baru',
    Icon: EyeOff
  }
];

export const FormBlockView: React.FC<FormBlockViewProps> = ({
  block,
  activeNoteId,
  allNotes,
  canEdit,
  onUpdateForm,
  onSyncColumnInDatabase,
  onCreateStarterDatabase,
  onSubmitForm
}) => {
  const sources = useMemo(() => findAllDatabaseSources(allNotes), [allNotes]);
  const formData = useMemo<FormBlockData>(
    () => block.formData || createDefaultFormData(sources),
    [block.formData, sources]
  );

  const targetSource = useMemo(
    () =>
      sources.find(
        (s) =>
          s.noteId === formData.targetNoteId && s.blockId === formData.targetBlockId
      ) || sources.find((s) => s.blockId === formData.targetBlockId),
    [sources, formData.targetNoteId, formData.targetBlockId]
  );

  const [mode, setMode] = useState<'fill' | 'edit'>(
    !formData.targetBlockId && canEdit ? 'edit' : 'fill'
  );
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [newOptInputs, setNewOptInputs] = useState<Record<string, string>>({});

  const commit = async (patch: Partial<FormBlockData>) => {
    if (!canEdit) return;
    const next: FormBlockData = { ...formData, ...patch };
    await onUpdateForm(next, next.title || 'Formulir');
  };

  const handleSelectTargetDatabase = async (combinedKey: string) => {
    if (!combinedKey) return;
    const [noteId, blockId] = combinedKey.split('::');
    const src = sources.find((s) => s.noteId === noteId && s.blockId === blockId);
    if (!src) return;
    await commit({
      targetNoteId: src.noteId,
      targetBlockId: src.blockId,
      fields: buildFormFieldsFromColumns(src.columns)
    });
  };

  const handleQuickCreateDatabase = async () => {
    const created = await onCreateStarterDatabase();
    if (!created) return;
    const freshNote = allNotes.find((n) => n.id === created.noteId);
    const freshCols =
      freshNote?.blocks.find((b) => b.id === created.blockId)?.databaseData?.columns || [];
    const fields =
      freshCols.length > 0
        ? buildFormFieldsFromColumns(freshCols)
        : [
            {
              id: createDatabaseId('fld'),
              columnId: 'col-name',
              label: 'Item',
              placeholder: 'Isi item...',
              fieldType: 'text' as DatabaseColumnType,
              required: true
            },
            {
              id: createDatabaseId('fld'),
              columnId: 'col-category',
              label: 'Kategori',
              fieldType: 'select' as DatabaseColumnType,
              options: [
                { id: 'opt-a', label: 'Kategori A', color: 'sky' as DatabaseBadgeColor },
                { id: 'opt-b', label: 'Kategori B', color: 'emerald' as DatabaseBadgeColor },
                { id: 'opt-c', label: 'Kategori C', color: 'amber' as DatabaseBadgeColor }
              ],
              required: true
            },
            {
              id: createDatabaseId('fld'),
              columnId: 'col-value',
              label: 'Jumlah',
              placeholder: 'Masukkan angka...',
              fieldType: 'number' as DatabaseColumnType,
              required: true
            }
          ];
    await commit({
      targetNoteId: created.noteId,
      targetBlockId: created.blockId,
      fields
    });
  };

  const handlePullColumnsFromDatabase = async () => {
    if (!targetSource) return;
    const synced = syncFormFieldsWithDatabase(formData.fields, targetSource.columns);
    await commit({ fields: synced });
  };

  const handleAddField = async () => {
    if (!canEdit || !formData.targetNoteId || !formData.targetBlockId) return;
    const newColId = createDatabaseId('col');
    const newCol: DatabaseColumn = {
      id: newColId,
      name: `Pertanyaan ${formData.fields.length + 1}`,
      type: 'text'
    };
    const newField: FormFieldConfig = {
      id: createDatabaseId('fld'),
      columnId: newColId,
      label: newCol.name,
      placeholder: 'Tulis jawaban...',
      fieldType: 'text',
      required: false,
      hidden: false
    };
    await onSyncColumnInDatabase(formData.targetNoteId, formData.targetBlockId, newCol);
    await commit({ fields: [...formData.fields, newField] });
  };

  const handleUpdateField = async (
    fieldId: string,
    patch: Partial<FormFieldConfig>,
    syncColumnToDb = false
  ) => {
    if (!canEdit) return;
    let updatedField: FormFieldConfig | undefined;
    const nextFields = formData.fields.map((f) => {
      if (f.id !== fieldId) return f;
      const merged: FormFieldConfig = { ...f, ...patch };
      if (
        (patch.fieldType === 'select' || patch.fieldType === 'multi_select') &&
        (!merged.options || merged.options.length === 0)
      ) {
        merged.options = [
          createSelectOption('Pilihan 1', 0),
          createSelectOption('Pilihan 2', 1)
        ];
      }
      updatedField = merged;
      return merged;
    });

    if (syncColumnToDb && updatedField && formData.targetNoteId && formData.targetBlockId) {
      const existingCol = targetSource?.columns.find(
        (c) => c.id === updatedField!.columnId
      );
      await onSyncColumnInDatabase(formData.targetNoteId, formData.targetBlockId, {
        ...(existingCol || {}),
        id: updatedField.columnId,
        name: updatedField.label || existingCol?.name || 'Kolom',
        type: updatedField.fieldType,
        options: updatedField.options
      });
    }

    await commit({ fields: nextFields });
  };

  const handleMoveField = async (fieldId: string, dir: -1 | 1) => {
    const idx = formData.fields.findIndex((f) => f.id === fieldId);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= formData.fields.length) return;
    const copy = [...formData.fields];
    const [removed] = copy.splice(idx, 1);
    copy.splice(target, 0, removed);
    await commit({ fields: copy });
  };

  const handleDeleteField = async (fieldId: string) => {
    await commit({ fields: formData.fields.filter((f) => f.id !== fieldId) });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setFieldErrors({});

    if (!formData.targetNoteId || !formData.targetBlockId) {
      setSubmitError('Formulir belum terhubung ke Tabel Database.');
      return;
    }

    const activeCols: DatabaseColumn[] =
      targetSource?.columns ||
      formData.fields.map((f) => ({
        id: f.columnId,
        name: f.label,
        type: f.fieldType,
        options: f.options
      }));

    const check = sanitizeFormSubmission(formData, activeCols, answers);
    if (!check.ok) {
      setFieldErrors(check.errors);
      return;
    }

    setSubmitting(true);
    try {
      const res = await onSubmitForm({
        formBlockId: block.id,
        targetNoteId: formData.targetNoteId,
        targetBlockId: formData.targetBlockId,
        values: answers,
        responseAccess: formData.responseAccess
      });
      if (!res.ok) {
        setSubmitError(res.error || 'Gagal mengirim formulir.');
        return;
      }
      setAnswers({});
      setSubmittedSuccess(true);
    } finally {
      setSubmitting(false);
    }
  };

  const localSources = sources.filter((s) => s.noteId === activeNoteId);
  const crossSources = sources.filter((s) => s.noteId !== activeNoteId);
  const visibleFields = formData.fields.filter((f) => !f.hidden);

  const canFillInCurrentMode =
    formData.responseAccess === 'public' ||
    (formData.responseAccess === 'edit_only' && canEdit);

  return (
    <div className="my-2 rounded-2xl border border-border-subtle bg-surface shadow-sm overflow-hidden">
      {/* Form Header */}
      <div className="px-4 py-3 bg-subtle/60 border-b border-border-subtle flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
            <ClipboardList className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            {mode === 'edit' && canEdit ? (
              <input
                type="text"
                value={formData.title}
                onChange={(e) => void commit({ title: e.target.value })}
                placeholder="Judul Formulir..."
                className="w-full bg-transparent text-sm font-bold text-text-primary focus:outline-none"
              />
            ) : (
              <h3 className="text-sm font-bold text-text-primary truncate">
                {formData.title || 'Formulir'}
              </h3>
            )}
            <div className="flex flex-wrap items-center gap-2 text-[10px] text-text-secondary">
              {targetSource ? (
                <span className="truncate">
                  Terhubung ke: <strong className="text-text-primary">{targetSource.title}</strong>
                </span>
              ) : (
                <span className="text-amber-500">Belum terhubung ke tabel</span>
              )}
              <span>•</span>
              <span className="font-mono">{formData.submissionCount || 0} respon</span>
              <span>•</span>
              <span>
                {formData.responseAccess === 'public'
                  ? 'Publik'
                  : formData.responseAccess === 'closed'
                    ? 'Ditutup'
                    : 'Khusus Editor'}
              </span>
            </div>
          </div>
        </div>

        {canEdit && (
          <div className="inline-flex rounded-lg bg-surface border border-border-subtle p-0.5 no-print">
            <button
              type="button"
              onClick={() => {
                setMode('fill');
                setSubmittedSuccess(false);
              }}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                mode === 'fill'
                  ? 'bg-accent-strong text-white dark:text-slate-950'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Eye className="w-3 h-3" />
              <span>Isi</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('edit')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                mode === 'edit'
                  ? 'bg-accent-strong text-white dark:text-slate-950'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Pencil className="w-3 h-3" />
              <span>Edit Formulir</span>
            </button>
          </div>
        )}
      </div>

      {/* Body: Edit Mode vs Fill Mode */}
      {mode === 'edit' && canEdit ? (
        <div className="p-4 space-y-4">
          {/* Form Metadata & Database Target */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                Deskripsi Formulir
              </label>
              <textarea
                rows={2}
                value={formData.description || ''}
                onChange={(e) => void commit({ description: e.target.value })}
                placeholder="Tambahkan instruksi singkat untuk pengisi formulir..."
                className="w-full bg-subtle/45 border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent-strong resize-none"
              />
            </div>

            <div className="space-y-2">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                  Tabel Database Tujuan
                </label>
                <div className="flex gap-1.5">
                  <select
                    value={
                      targetSource
                        ? `${targetSource.noteId}::${targetSource.blockId}`
                        : ''
                    }
                    onChange={(e) => void handleSelectTargetDatabase(e.target.value)}
                    className="flex-1 min-w-0 bg-subtle/45 border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent-strong"
                  >
                    <option value="">-- Pilih Tabel Database --</option>
                    {localSources.length > 0 && (
                      <optgroup label="Di Halaman Ini">
                        {localSources.map((s) => (
                          <option key={`${s.noteId}::${s.blockId}`} value={`${s.noteId}::${s.blockId}`}>
                            {s.title}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {crossSources.length > 0 && (
                      <optgroup label="Dari Catatan Lain">
                        {crossSources.map((s) => (
                          <option key={`${s.noteId}::${s.blockId}`} value={`${s.noteId}::${s.blockId}`}>
                            {s.noteTitle} → {s.title}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <button
                    type="button"
                    onClick={() => void handleQuickCreateDatabase()}
                    className="px-2.5 py-1.5 rounded-lg bg-accent-strong text-white dark:text-slate-950 text-[11px] font-semibold shrink-0"
                  >
                    + Tabel Baru
                  </button>
                </div>
              </div>

              {targetSource && (
                <button
                  type="button"
                  onClick={() => void handlePullColumnsFromDatabase()}
                  className="inline-flex items-center gap-1.5 text-[11px] font-medium text-accent-strong hover:underline"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Sinkronkan kolom baru dari tabel {targetSource.title}</span>
                </button>
              )}
            </div>
          </div>

          {/* Owner-Configurable Form Access Setting */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
              Siapa yang bisa mengisi formulir ini?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {ACCESS_OPTIONS.map((opt) => {
                const active = formData.responseAccess === opt.id;
                const Icon = opt.Icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => void commit({ responseAccess: opt.id })}
                    className={`p-2.5 rounded-xl border text-left transition space-y-0.5 ${
                      active
                        ? 'bg-accent-strong/10 border-accent-strong text-text-primary'
                        : 'bg-subtle/35 border-border-subtle text-text-secondary hover:bg-subtle/70'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
                      <Icon className="w-3.5 h-3.5 text-accent-strong shrink-0" />
                      <span className="truncate">{opt.label}</span>
                    </div>
                    <p className="text-[10px] text-text-secondary leading-snug">{opt.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Editable Questions List */}
          <div className="space-y-2.5 pt-2 border-t border-border-subtle">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-text-primary">
                Daftar Pertanyaan ({formData.fields.length})
              </span>
              {targetSource && (
                <button
                  type="button"
                  onClick={() => void handleAddField()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent-strong text-white dark:text-slate-950 text-[11px] font-semibold hover:opacity-95 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Pertanyaan</span>
                </button>
              )}
            </div>

            {formData.fields.length === 0 ? (
              <div className="py-6 px-4 rounded-xl border border-dashed border-border-subtle bg-subtle/30 text-center text-xs text-text-secondary">
                {targetSource
                  ? 'Belum ada pertanyaan. Klik "+ Tambah Pertanyaan" atau sinkronkan kolom tabel.'
                  : 'Hubungkan formulir ke Tabel Database terlebih dahulu untuk membuat pertanyaan.'}
              </div>
            ) : (
              <div className="space-y-2">
                {formData.fields.map((field, idx) => {
                  const newOptVal = newOptInputs[field.id] || '';
                  return (
                    <div
                      key={field.id}
                      className={`p-3 rounded-xl border space-y-2.5 transition ${
                        field.hidden
                          ? 'bg-subtle/20 border-border-subtle/50 opacity-65'
                          : 'bg-subtle/45 border-border-subtle'
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-mono text-text-secondary px-1.5 py-0.5 rounded bg-surface border border-border-subtle">
                          #{idx + 1}
                        </span>
                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) =>
                            void handleUpdateField(field.id, { label: e.target.value }, true)
                          }
                          placeholder="Tulis pertanyaan..."
                          className="flex-1 min-w-[160px] bg-surface border border-border-subtle focus:border-accent-strong rounded-lg px-2.5 py-1 text-xs font-semibold text-text-primary focus:outline-none"
                        />
                        <select
                          value={field.fieldType}
                          onChange={(e) =>
                            void handleUpdateField(
                              field.id,
                              { fieldType: e.target.value as DatabaseColumnType },
                              true
                            )
                          }
                          className="bg-surface border border-border-subtle rounded-lg px-2 py-1 text-[11px] text-text-primary focus:outline-none"
                        >
                          {FIELD_TYPE_OPTIONS.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.label}
                            </option>
                          ))}
                        </select>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void handleMoveField(field.id, -1)}
                            disabled={idx === 0}
                            className="p-1 rounded hover:bg-surface disabled:opacity-30 text-text-secondary"
                            title="Geser naik"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleMoveField(field.id, 1)}
                            disabled={idx === formData.fields.length - 1}
                            className="p-1 rounded hover:bg-surface disabled:opacity-30 text-text-secondary"
                            title="Geser turun"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void handleUpdateField(field.id, { hidden: !field.hidden })
                            }
                            className="p-1 rounded hover:bg-surface text-text-secondary"
                            title={field.hidden ? 'Tampilkan di formulir' : 'Sembunyikan'}
                          >
                            {field.hidden ? (
                              <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteField(field.id)}
                            className="p-1 rounded hover:bg-rose-500/15 text-text-secondary hover:text-rose-500"
                            title="Hapus pertanyaan dari formulir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        <input
                          type="text"
                          value={field.helperText || ''}
                          onChange={(e) =>
                            void handleUpdateField(field.id, { helperText: e.target.value })
                          }
                          placeholder="Keterangan bantuan (opsional)..."
                          className="flex-1 min-w-[160px] bg-surface/70 border border-border-subtle/70 rounded-lg px-2.5 py-1 text-[11px] text-text-secondary focus:outline-none"
                        />
                        <label className="inline-flex items-center gap-1.5 cursor-pointer select-none px-2 py-1 rounded-lg bg-surface border border-border-subtle">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) =>
                              void handleUpdateField(field.id, { required: e.target.checked })
                            }
                            className="rounded border-border-subtle"
                          />
                          <span className="text-[11px] font-medium text-text-primary">
                            Wajib diisi
                          </span>
                        </label>
                      </div>

                      {(field.fieldType === 'select' || field.fieldType === 'multi_select') && (
                        <div className="pt-1.5 border-t border-border-subtle/60 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {(field.options || []).map((opt) => {
                              const cls = BADGE_COLOR_CLASSES[opt.color];
                              return (
                                <span
                                  key={opt.id}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-medium ${cls.bg} ${cls.text} ${cls.border}`}
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextColor =
                                        BADGE_COLOR_ORDER[
                                          (BADGE_COLOR_ORDER.indexOf(opt.color) + 1) %
                                            BADGE_COLOR_ORDER.length
                                        ];
                                      void handleUpdateField(
                                        field.id,
                                        {
                                          options: (field.options || []).map((o) =>
                                            o.id === opt.id ? { ...o, color: nextColor } : o
                                          )
                                        },
                                        true
                                      );
                                    }}
                                    title="Klik untuk ganti warna"
                                  >
                                    {opt.label}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleUpdateField(
                                        field.id,
                                        {
                                          options: (field.options || []).filter(
                                            (o) => o.id !== opt.id
                                          )
                                        },
                                        true
                                      )
                                    }
                                    className="opacity-70 hover:opacity-100"
                                  >
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                          <div className="flex items-center gap-1.5 max-w-xs">
                            <input
                              type="text"
                              value={newOptVal}
                              onChange={(e) =>
                                setNewOptInputs((prev) => ({
                                  ...prev,
                                  [field.id]: e.target.value
                                }))
                              }
                              placeholder="+ Tambah pilihan..."
                              className="flex-1 bg-surface border border-border-subtle rounded-md px-2 py-1 text-[11px] text-text-primary focus:outline-none"
                            />
                            <button
                              type="button"
                              disabled={!newOptVal.trim()}
                              onClick={() => {
                                const cur = field.options || [];
                                const nextOpt = createSelectOption(newOptVal, cur.length);
                                setNewOptInputs((prev) => ({ ...prev, [field.id]: '' }));
                                void handleUpdateField(
                                  field.id,
                                  { options: [...cur, nextOpt] },
                                  true
                                );
                              }}
                              className="px-2.5 py-1 rounded-md bg-surface border border-border-subtle hover:border-accent-strong text-[10px] font-semibold text-text-primary disabled:opacity-40"
                            >
                              Tambah
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Submit Button & Success Message Customization */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border-subtle text-xs">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-text-secondary">
                Teks Tombol Kirim
              </label>
              <input
                type="text"
                value={formData.submitLabel || 'Kirim Formulir'}
                onChange={(e) => void commit({ submitLabel: e.target.value })}
                className="w-full bg-subtle/45 border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-text-secondary">
                Pesan Setelah Berhasil Kirim
              </label>
              <input
                type="text"
                value={formData.successMessage || ''}
                onChange={(e) => void commit({ successMessage: e.target.value })}
                placeholder="Terima kasih! Jawaban tersimpan."
                className="w-full bg-subtle/45 border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4">
          {!canFillInCurrentMode ? (
            <div className="py-8 px-4 rounded-xl border border-dashed border-border-subtle bg-subtle/35 text-center space-y-1.5">
              <Lock className="w-5 h-5 text-text-secondary mx-auto" />
              <p className="text-xs font-semibold text-text-primary">
                {formData.responseAccess === 'closed'
                  ? 'Formulir ini sedang ditutup oleh pemiliknya.'
                  : 'Formulir ini hanya dapat diisi oleh pemilik atau kolaborator Edit.'}
              </p>
            </div>
          ) : submittedSuccess ? (
            <div className="py-8 px-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-center space-y-3">
              <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto" />
              <p className="text-xs font-semibold text-text-primary">
                {formData.successMessage || 'Terima kasih! Data Anda berhasil ditambahkan ke tabel.'}
              </p>
              <button
                type="button"
                onClick={() => setSubmittedSuccess(false)}
                className="px-3.5 py-1.5 rounded-lg bg-surface border border-border-subtle text-xs font-semibold text-text-primary hover:border-accent-strong transition"
              >
                Kirim isian lain
              </button>
            </div>
          ) : visibleFields.length === 0 ? (
            <div className="py-8 px-4 rounded-xl border border-dashed border-border-subtle bg-subtle/30 text-center space-y-2.5">
              <Database className="w-6 h-6 text-amber-500 mx-auto opacity-85" />
              <p className="text-xs text-text-secondary">
                Formulir ini belum memiliki pertanyaan atau belum terhubung ke Tabel Database.
              </p>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setMode('edit')}
                  className="px-3.5 py-1.5 rounded-lg bg-accent-strong text-white dark:text-slate-950 text-xs font-semibold"
                >
                  Atur &amp; Edit Formulir
                </button>
              )}
            </div>
          ) : (
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3.5">
              {formData.description?.trim() && (
                <p className="text-xs text-text-secondary leading-relaxed">
                  {formData.description}
                </p>
              )}

              <div className="space-y-3">
                {visibleFields.map((field) => {
                  const val = answers[field.columnId];
                  const err = fieldErrors[field.columnId];
                  const dbColOptions =
                    targetSource?.columns.find((c) => c.id === field.columnId)?.options ||
                    field.options ||
                    [];

                  return (
                    <div key={field.id} className="space-y-1">
                      <label className="flex items-center gap-1 text-xs font-semibold text-text-primary">
                        <span>{field.label}</span>
                        {field.required && <span className="text-rose-500">*</span>}
                      </label>
                      {field.helperText && (
                        <p className="text-[11px] text-text-secondary">{field.helperText}</p>
                      )}

                      {field.fieldType === 'checkbox' ? (
                        <label className="inline-flex items-center gap-2 py-1 cursor-pointer">
                          <button
                            type="button"
                            onClick={() =>
                              setAnswers((prev) => ({
                                ...prev,
                                [field.columnId]: !Boolean(val)
                              }))
                            }
                            className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition ${
                              val
                                ? 'bg-accent-strong border-accent-strong text-white dark:text-slate-950'
                                : 'border-text-secondary/50 bg-surface'
                            }`}
                          >
                            {Boolean(val) && <Check className="w-3 h-3 stroke-[3]" />}
                          </button>
                          <span className="text-xs text-text-primary">Ya / Setuju</span>
                        </label>
                      ) : field.fieldType === 'select' ? (
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {dbColOptions.map((opt) => {
                            const selected = val === opt.label;
                            const cls = BADGE_COLOR_CLASSES[opt.color];
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() =>
                                  setAnswers((prev) => ({
                                    ...prev,
                                    [field.columnId]: selected ? '' : opt.label
                                  }))
                                }
                                className={`px-3 py-1 rounded-lg border text-xs font-medium transition ${
                                  selected
                                    ? `${cls.bg} ${cls.text} ${cls.border} ring-2 ring-accent-strong/40`
                                    : 'bg-subtle/40 border-border-subtle text-text-primary hover:bg-subtle'
                                }`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      ) : field.fieldType === 'multi_select' ? (
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {dbColOptions.map((opt) => {
                            const currentArr = Array.isArray(val) ? (val as string[]) : [];
                            const selected = currentArr.includes(opt.label);
                            const cls = BADGE_COLOR_CLASSES[opt.color];
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() =>
                                  setAnswers((prev) => ({
                                    ...prev,
                                    [field.columnId]: selected
                                      ? currentArr.filter((x) => x !== opt.label)
                                      : [...currentArr, opt.label]
                                  }))
                                }
                                className={`px-3 py-1 rounded-lg border text-xs font-medium transition ${
                                  selected
                                    ? `${cls.bg} ${cls.text} ${cls.border} ring-2 ring-accent-strong/40`
                                    : 'bg-subtle/40 border-border-subtle text-text-primary hover:bg-subtle'
                                }`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <input
                          type={
                            field.fieldType === 'number'
                              ? 'number'
                              : field.fieldType === 'date'
                                ? 'date'
                                : 'text'
                          }
                          step={field.fieldType === 'number' ? 'any' : undefined}
                          value={typeof val === 'string' || typeof val === 'number' ? String(val) : ''}
                          onChange={(e) =>
                            setAnswers((prev) => ({
                              ...prev,
                              [field.columnId]: e.target.value
                            }))
                          }
                          placeholder={field.placeholder || 'Tulis jawaban...'}
                          className="w-full bg-subtle/40 border border-border-subtle focus:border-accent-strong rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none"
                        />
                      )}

                      {err && <p className="text-[11px] text-rose-500">{err}</p>}
                    </div>
                  );
                })}
              </div>

              {submitError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-500">
                  {submitError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent-strong text-white dark:text-slate-950 text-xs font-bold hover:opacity-95 disabled:opacity-50 transition"
                >
                  {submitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>{formData.submitLabel || 'Kirim Formulir'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
