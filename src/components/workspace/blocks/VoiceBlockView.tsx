'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  FileText,
  Loader2,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Square,
  UploadCloud,
  X
} from 'lucide-react';
import type { NoteBlock, VoiceBlockData } from '../../../types/miu';
import { uploadMediaToCloud } from '../../../services/cloudServices';
import {
  browserSupportsSpeechRecognition,
  loadElevenLabsConfig
} from '../../../services/elevenLabsService';

interface VoiceBlockViewProps {
  block: NoteBlock;
  canEdit: boolean;
  onUpdateVoice: (patch: {
    voiceData: VoiceBlockData;
    content: string;
    caption?: string;
  }) => void;
  onInsertTranscriptAsBlock?: (transcript: string) => void;
  onAskAI?: (transcript: string, title: string) => void;
}

function formatDuration(sec: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(sec) ? sec : 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const VoiceBlockView: React.FC<VoiceBlockViewProps> = ({
  block,
  canEdit,
  onUpdateVoice,
  onInsertTranscriptAsBlock,
  onAskAI
}) => {
  const voiceData: VoiceBlockData = block.voiceData || {
    audioUrl: block.content || '',
    language: 'id-ID',
    transcript: ''
  };
  const audioUrl = voiceData.audioUrl || block.content || '';
  const language: 'id-ID' | 'en-US' = voiceData.language === 'en-US' ? 'en-US' : 'id-ID';

  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Player states
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState<number>(voiceData.durationSec || 0);
  const [playbackRate, setPlaybackRate] = useState<1 | 1.25 | 1.5 | 2>(1);
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const [showRecorderInEdit, setShowRecorderInEdit] = useState(false);

  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const speechRecRef = useRef<{ stop: () => void } | null>(null);
  const liveTranscriptRef = useRef<string>('');
  const recordStartAtRef = useRef<number>(0);
  const lastRecordedBlobRef = useRef<Blob | null>(null);

  useEffect(() => {
    if (voiceData.durationSec && !duration) {
      setDuration(voiceData.durationSec);
    }
  }, [voiceData.durationSec, duration]);

  const stopHardware = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    try {
      speechRecRef.current?.stop();
    } catch {
      // ignore
    }
    speechRecRef.current = null;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setAudioLevel(0);
  };

  useEffect(() => {
    return () => {
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch {
        // ignore
      }
      stopHardware();
    };
  }, []);

  const commitVoicePatch = (patch: Partial<VoiceBlockData>, captionOverride?: string) => {
    const nextVoice: VoiceBlockData = {
      ...voiceData,
      ...patch,
      audioUrl: patch.audioUrl !== undefined ? patch.audioUrl : audioUrl
    };
    onUpdateVoice({
      voiceData: nextVoice,
      content: nextVoice.audioUrl,
      ...(captionOverride !== undefined ? { caption: captionOverride } : {})
    });
  };

  const transcribeViaStt = async (
    payload: { audioUrl: string } | { blob: Blob },
    lang: 'id-ID' | 'en-US'
  ): Promise<string> => {
    const cfg = loadElevenLabsConfig();
    let res: Response;

    if ('audioUrl' in payload) {
      res = await fetch('/api/elevenlabs/stt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioUrl: payload.audioUrl,
          languageCode: lang === 'en-US' ? 'en' : 'id',
          ...(cfg.apiKey?.trim() ? { elevenlabsApiKey: cfg.apiKey.trim() } : {})
        })
      });
    } else {
      if (payload.blob.size > 4 * 1024 * 1024) {
        throw new Error(
          'Audio lokal melebihi 4 MB untuk transkrip langsung. Unggah lewat Cloud Catatan (Cloudinary) atau rekam lebih singkat.'
        );
      }
      const form = new FormData();
      form.append('file', payload.blob, 'voice-note.webm');
      form.append('languageCode', lang === 'en-US' ? 'en' : 'id');
      if (cfg.apiKey?.trim()) {
        form.append('elevenlabsApiKey', cfg.apiKey.trim());
      }
      res = await fetch('/api/elevenlabs/stt', { method: 'POST', body: form });
    }

    if (res.status === 413) {
      throw new Error('Ukuran file audio terlalu besar untuk batas server (413).');
    }
    if (!res.ok) {
      const errData = (await res.json().catch(() => ({}))) as { error?: string };
      if (errData.error === 'ELEVENLABS_API_KEY_MISSING') {
        throw new Error(
          'ELEVENLABS_API_KEY belum dikonfigurasi di server atau Pengaturan Suara.'
        );
      }
      throw new Error(errData.error || `Gagal mentranskripsi (${res.status}).`);
    }
    const data = (await res.json()) as { text?: string };
    return (data.text || '').trim();
  };

  const handleUploadAndSaveAudio = async (
    blobOrFile: Blob | File,
    approxDurationSec?: number,
    fallbackTranscript?: string,
    defaultCaption?: string
  ) => {
    setUploadingAudio(true);
    setErrorMsg('');
    lastRecordedBlobRef.current = blobOrFile;
    try {
      const { url } = await uploadMediaToCloud(blobOrFile);
      const createdAt = Date.now();
      const nextCaption =
        block.caption?.trim() ||
        defaultCaption ||
        `Voice Note ${new Date(createdAt).toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit'
        })}`;

      commitVoicePatch(
        {
          audioUrl: url,
          durationSec: approxDurationSec ?? duration,
          transcript: fallbackTranscript ?? voiceData.transcript ?? '',
          language,
          createdAt
        },
        nextCaption
      );
      setShowRecorderInEdit(false);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal menyimpan rekaman audio.'
      );
    } finally {
      setUploadingAudio(false);
    }
  };

  const startRecording = async () => {
    if (!canEdit || isRecording) return;
    setErrorMsg('');
    setLiveTranscript('');
    liveTranscriptRef.current = '';

    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        throw new Error('Browser ini tidak mendukung perekaman audio mikrofon.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);

      const freqData = new Uint8Array(analyser.frequencyBinCount);
      const tickLevel = () => {
        if (!mediaStreamRef.current) return;
        analyser.getByteFrequencyData(freqData);
        let sum = 0;
        for (let i = 0; i < freqData.length; i += 1) sum += freqData[i];
        setAudioLevel(Math.min(1, sum / (freqData.length * 85)));
        rafRef.current = requestAnimationFrame(tickLevel);
      };
      tickLevel();

      // Optional live Web Speech capture during recording
      if (browserSupportsSpeechRecognition()) {
        try {
          const w = window as unknown as {
            SpeechRecognition?: new () => {
              lang: string;
              continuous: boolean;
              interimResults: boolean;
              onresult: ((e: unknown) => void) | null;
              onerror: (() => void) | null;
              start: () => void;
              stop: () => void;
            };
            webkitSpeechRecognition?: new () => {
              lang: string;
              continuous: boolean;
              interimResults: boolean;
              onresult: ((e: unknown) => void) | null;
              onerror: (() => void) | null;
              start: () => void;
              stop: () => void;
            };
          };
          const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
          if (Ctor) {
            const rec = new Ctor();
            rec.lang = language;
            rec.continuous = true;
            rec.interimResults = true;
            let finals = '';
            rec.onresult = (event: unknown) => {
              const ev = event as {
                resultIndex: number;
                results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
              };
              let interim = '';
              for (let i = ev.resultIndex; i < ev.results.length; i += 1) {
                const text = ev.results[i][0].transcript;
                if (ev.results[i].isFinal) {
                  finals += (finals ? ' ' : '') + text;
                } else {
                  interim += text;
                }
              }
              const combined = `${finals} ${interim}`.trim();
              liveTranscriptRef.current = combined;
              setLiveTranscript(combined);
            };
            rec.onerror = () => {};
            rec.start();
            speechRecRef.current = rec;
          }
        } catch {
          // ignore if speech recognition fails in this browser
        }
      }

      const preferredTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
      const mimeType = preferredTypes.find((t) => MediaRecorder.isTypeSupported(t));
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recordStartAtRef.current = Date.now();
      setRecordSeconds(0);
      timerRef.current = window.setInterval(() => {
        setRecordSeconds(Math.max(1, Math.floor((Date.now() - recordStartAtRef.current) / 1000)));
      }, 400);

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setIsRecording(true);
    } catch (err) {
      stopHardware();
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Izin mikrofon ditolak atau tidak tersedia.'
      );
    }
  };

  const finishRecording = (save: boolean) => {
    const recorder = mediaRecorderRef.current;
    const elapsedSec = Math.max(1, Math.round((Date.now() - recordStartAtRef.current) / 1000));
    const capturedSpeech = liveTranscriptRef.current.trim();

    if (!recorder || recorder.state === 'inactive') {
      stopHardware();
      setIsRecording(false);
      return;
    }

    recorder.onstop = async () => {
      const mime = recorder.mimeType || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type: mime });
      chunksRef.current = [];
      stopHardware();
      setIsRecording(false);

      if (!save) return;
      if (blob.size < 600) {
        setErrorMsg('Rekaman terlalu singkat.');
        return;
      }

      await handleUploadAndSaveAudio(blob, elapsedSec, capturedSpeech);
    };

    recorder.stop();
  };

  const handleTranscribeClick = async () => {
    if (!audioUrl || transcribing) return;
    setTranscribing(true);
    setErrorMsg('');
    try {
      let text = '';
      if (audioUrl.startsWith('https://')) {
        text = await transcribeViaStt({ audioUrl }, language);
      } else {
        let blob = lastRecordedBlobRef.current;
        if (!blob) {
          const resp = await fetch(audioUrl);
          if (!resp.ok) {
            throw new Error('Gagal mengunduh file audio untuk transkripsi.');
          }
          blob = await resp.blob();
        }
        text = await transcribeViaStt({ blob }, language);
      }
      if (!text) {
        setErrorMsg('Tidak ada ucapan yang terdeteksi pada audio.');
        return;
      }
      if (canEdit) {
        commitVoicePatch({ transcript: text });
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal mentranskripsi audio.');
    } finally {
      setTranscribing(false);
    }
  };

  const handleAudioFilePicked = async (file: File) => {
    if (!canEdit) return;
    await handleUploadAndSaveAudio(
      file,
      undefined,
      voiceData.transcript || '',
      file.name.replace(/\.[^/.]+$/, '')
    );
  };

  const togglePlay = () => {
    const el = audioElRef.current;
    if (!el) return;
    if (el.paused) {
      el.playbackRate = playbackRate;
      void el.play().catch(() => {});
    } else {
      el.pause();
    }
  };

  const cyclePlaybackRate = () => {
    const order: Array<1 | 1.25 | 1.5 | 2> = [1, 1.25, 1.5, 2];
    const next = order[(order.indexOf(playbackRate) + 1) % order.length];
    setPlaybackRate(next);
    if (audioElRef.current) {
      audioElRef.current.playbackRate = next;
    }
  };

  const showRecorder = (!audioUrl || showRecorderInEdit) && canEdit;

  return (
    <div className="my-2 rounded-2xl border border-border-subtle bg-subtle/45 p-3.5 space-y-3">
      {/* Hidden native audio element */}
      {audioUrl && (
        <audio
          ref={audioElRef}
          src={audioUrl}
          preload="metadata"
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            if (Number.isFinite(d) && d > 0) {
              setDuration(d);
            }
          }}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
        />
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              isRecording
                ? 'bg-rose-500/20 text-rose-500 animate-pulse'
                : 'bg-sky-500/15 text-sky-500'
            }`}
          >
            <Mic className="w-4 h-4" />
          </div>
          {canEdit ? (
            <input
              type="text"
              value={block.caption || ''}
              onChange={(e) =>
                commitVoicePatch({}, e.target.value)
              }
              placeholder="Judul Voice Note (mis. Rekaman Kuliah)..."
              className="bg-transparent text-xs font-bold text-text-primary placeholder:text-text-secondary/50 focus:outline-none min-w-0 flex-1"
            />
          ) : (
            <span className="text-xs font-bold text-text-primary truncate">
              {block.caption || 'Voice Note'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 no-print">
          {canEdit && (
            <select
              aria-label="Bahasa Transkrip"
              value={language}
              disabled={isRecording}
              onChange={(e) =>
                commitVoicePatch({
                  language: e.target.value === 'en-US' ? 'en-US' : 'id-ID'
                })
              }
              className="px-2 py-1 rounded-lg bg-surface border border-border-subtle text-[11px] font-medium text-text-primary focus:outline-none cursor-pointer"
            >
              <option value="id-ID">Indonesia</option>
              <option value="en-US">English</option>
            </select>
          )}

          {audioUrl && canEdit && !isRecording && (
            <button
              type="button"
              onClick={() => setShowRecorderInEdit((v) => !v)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-surface border border-border-subtle text-[11px] text-text-secondary hover:text-text-primary transition"
              title="Rekam ulang atau ganti file audio"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{showRecorderInEdit ? 'Batal' : 'Ganti Audio'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Recorder / Upload Controls */}
      {showRecorder && (
        <div className="p-3 rounded-xl bg-surface border border-border-subtle space-y-2.5 no-print">
          {uploadingAudio ? (
            <div className="flex items-center justify-center gap-2 py-3 text-xs text-text-secondary">
              <Loader2 className="w-4 h-4 animate-spin text-accent-strong" />
              <span>Mengunggah rekaman suara ke Cloud Catatan...</span>
            </div>
          ) : isRecording ? (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                  <span className="text-xs font-bold text-rose-500 font-mono">
                    REC {formatDuration(recordSeconds)}
                  </span>
                </div>

                {/* Live level visualizer */}
                <div className="flex-1 h-2 rounded-full bg-subtle overflow-hidden max-w-[200px]">
                  <div
                    className="h-full bg-gradient-to-r from-sky-500 to-rose-500 transition-all duration-75"
                    style={{ width: `${Math.max(8, Math.round(audioLevel * 100))}%` }}
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => finishRecording(false)}
                    className="px-2.5 py-1 rounded-lg bg-subtle hover:bg-subtle/80 text-[11px] font-medium text-text-secondary transition"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={() => finishRecording(true)}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-semibold shadow-sm transition"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    <span>Simpan</span>
                  </button>
                </div>
              </div>

              {liveTranscript && (
                <p className="text-[11px] text-text-secondary bg-subtle/60 rounded-lg px-2.5 py-1.5 italic">
                  &ldquo;{liveTranscript}&rdquo;
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => void startRecording()}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold shadow-sm transition"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Mulai Rekam Suara</span>
              </button>

              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-subtle hover:bg-subtle/80 border border-border-subtle text-xs font-medium text-text-primary cursor-pointer transition">
                <UploadCloud className="w-3.5 h-3.5 text-accent-strong" />
                <span>Unggah Audio (.mp3 / .webm / .m4a)</span>
                <input
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleAudioFilePicked(f);
                  }}
                />
              </label>
            </div>
          )}
        </div>
      )}

      {/* Custom Player */}
      {audioUrl && !isRecording && (
        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-surface border border-border-subtle">
          <button
            type="button"
            onClick={togglePlay}
            className="w-9 h-9 rounded-full bg-accent-strong text-white dark:text-slate-950 flex items-center justify-center shrink-0 hover:opacity-90 transition shadow-sm"
            title={isPlaying ? 'Jeda' : 'Putar'}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4 ml-0.5" />
            )}
          </button>

          <div className="flex-1 min-w-0 space-y-1">
            <input
              type="range"
              aria-label="Posisi audio"
              min={0}
              max={Math.max(1, duration || 1)}
              step={0.1}
              value={Math.min(currentTime, duration || 1)}
              onChange={(e) => {
                const next = Number(e.target.value);
                setCurrentTime(next);
                if (audioElRef.current) {
                  audioElRef.current.currentTime = next;
                }
              }}
              className="w-full accent-sky-500 cursor-pointer h-1.5"
            />
            <div className="flex items-center justify-between text-[10px] font-mono text-text-secondary">
              <span>{formatDuration(currentTime)}</span>
              <span>{duration > 0 ? formatDuration(duration) : '--:--'}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={cyclePlaybackRate}
            className="px-2 py-1 rounded-lg bg-subtle hover:bg-subtle/80 text-[11px] font-mono font-semibold text-text-primary shrink-0 transition"
            title="Kecepatan putar"
          >
            {playbackRate}x
          </button>
        </div>
      )}

      {/* Error Message */}
      {errorMsg && (
        <div className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-500 flex items-center justify-between gap-2">
          <span className="min-w-0 break-words">{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg('')}
            className="p-0.5 rounded hover:bg-rose-500/15 shrink-0 transition"
            title="Tutup pesan error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Transcript Section */}
      {(audioUrl || (voiceData.transcript || '').trim()) && (
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <span className="text-[11px] font-semibold text-text-secondary">
              Transkrip Suara
            </span>
            <div className="flex flex-wrap items-center gap-1 no-print">
              {audioUrl && canEdit && (
                <button
                  type="button"
                  disabled={transcribing}
                  onClick={() => void handleTranscribeClick()}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-600 dark:text-sky-300 text-[11px] font-semibold disabled:opacity-50 transition"
                  title="Buat transkrip otomatis menggunakan ElevenLabs STT"
                >
                  {transcribing ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  <span>{transcribing ? 'Mentranskripsi...' : 'Transkrip AI'}</span>
                </button>
              )}

              {(voiceData.transcript || '').trim() && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(voiceData.transcript || '');
                      setCopiedTranscript(true);
                      window.setTimeout(() => setCopiedTranscript(false), 1500);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-surface border border-border-subtle text-[11px] text-text-secondary hover:text-text-primary transition"
                  >
                    {copiedTranscript ? (
                      <Check className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>{copiedTranscript ? 'Tersalin' : 'Salin'}</span>
                  </button>

                  {canEdit && onInsertTranscriptAsBlock && (
                    <button
                      type="button"
                      onClick={() => onInsertTranscriptAsBlock(voiceData.transcript || '')}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-surface border border-border-subtle text-[11px] text-text-primary hover:bg-subtle transition"
                      title="Sisipkan transkrip sebagai paragraf di bawah blok ini"
                    >
                      <FileText className="w-3 h-3 text-accent-strong" />
                      <span>Jadi Blok Teks</span>
                    </button>
                  )}

                  {onAskAI && (
                    <button
                      type="button"
                      onClick={() =>
                        onAskAI(voiceData.transcript || '', block.caption || 'Voice Note')
                      }
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 text-[11px] font-medium transition"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Rangkum AI</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {canEdit ? (
            <textarea
              rows={Math.max(2, Math.min(8, (voiceData.transcript || '').split('\n').length + 1))}
              value={voiceData.transcript || ''}
              onChange={(e) => commitVoicePatch({ transcript: e.target.value })}
              placeholder="Klik 'Transkrip AI' untuk mengekstrak teks otomatis, atau ketik ringkasan rekaman di sini..."
              className="w-full rounded-xl bg-surface border border-border-subtle px-3 py-2 text-xs text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent-strong resize-y leading-relaxed"
            />
          ) : (
            <p className="rounded-xl bg-surface border border-border-subtle px-3 py-2 text-xs text-text-primary whitespace-pre-wrap leading-relaxed">
              {(voiceData.transcript || '').trim() || 'Belum ada transkrip.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
