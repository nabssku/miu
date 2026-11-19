export interface LazytypeCapabilities {
  backend: 'WebGPU' | 'CPU (WASM)';
  hasSpeechApi: boolean;
}

export function detectLazytypeCapabilities(): LazytypeCapabilities {
  const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;
  const SpeechRec =
    typeof window !== 'undefined' &&
    ((window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition);

  return {
    backend: hasWebGPU ? 'WebGPU' : 'CPU (WASM)',
    hasSpeechApi: Boolean(SpeechRec)
  };
}

/** Auto-clean punctuation & capitalization for Indo + English lecture dictation */
export function formatDictationTranscript(raw: string): string {
  const cleaned = raw.trim().replace(/\s+/g, ' ');
  if (!cleaned) return '';

  const capitalized = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  if (/[.!?]$/.test(capitalized)) return capitalized;
  return `${capitalized}.`;
}

export interface LazytypeSession {
  stop: () => void;
  cancel: () => void;
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: unknown) => void) | null;
  onerror: ((e: unknown) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
}

export function startLazytypeCapture(options: {
  lang: 'id-ID' | 'en-US';
  onInterim: (text: string) => void;
  onFinal: (formattedText: string) => void;
  onWaveform: (levels: number[]) => void;
  onError: (message: string) => void;
  onEmpty?: () => void;
}): LazytypeSession {
  let stopped = false;
  let aborted = false;
  let finalized = false;
  let permissionDenied = false;
  let hasSpeechError = false;
  let hasReceivedResult = false;

  let stream: MediaStream | null = null;
  let audioCtx: AudioContext | null = null;
  let rafId = 0;
  let flushTimer: number | null = null;

  let committedRoundsText = '';
  let finalChunks: string[] = [];
  let interimChunks: string[] = [];

  const getCurrentRawTranscript = () => {
    const roundFinal = finalChunks.filter(Boolean).join(' ').trim();
    const roundInterim = interimChunks.filter(Boolean).join(' ').trim();
    return [committedRoundsText, roundFinal, roundInterim]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const cleanupHardware = () => {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    if (audioCtx) {
      void audioCtx.close().catch(() => {});
      audioCtx = null;
    }
  };

  const finalizeOnce = () => {
    if (finalized || aborted) return;
    finalized = true;
    if (flushTimer !== null) {
      window.clearTimeout(flushTimer);
      flushTimer = null;
    }
    const raw = getCurrentRawTranscript();
    const formatted = formatDictationTranscript(raw);
    if (formatted) {
      options.onFinal(formatted);
    } else if (!hasSpeechError && !permissionDenied) {
      options.onEmpty?.();
    }
  };

  const SpeechRecCtor =
    typeof window !== 'undefined'
      ? (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance })
          .SpeechRecognition ||
        (
          window as unknown as {
            webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
          }
        ).webkitSpeechRecognition
      : undefined;

  let recognition: SpeechRecognitionInstance | null = null;

  if (SpeechRecCtor) {
    recognition = new SpeechRecCtor();
    recognition.lang = options.lang;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: unknown) => {
      if (aborted) return;
      hasReceivedResult = true;
      const ev = event as {
        resultIndex: number;
        results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
      };
      const startIndex = Math.max(0, ev.resultIndex || 0);
      for (let i = startIndex; i < ev.results.length; i++) {
        const transcript = ev.results[i]?.[0]?.transcript || '';
        if (ev.results[i].isFinal) {
          finalChunks[i] = transcript.trim();
          interimChunks[i] = '';
        } else {
          interimChunks[i] = transcript;
        }
      }
      options.onInterim(getCurrentRawTranscript());
    };

    recognition.onerror = (event: unknown) => {
      if (aborted) return;
      const errCode = (event as { error?: string } | null)?.error || '';
      if (errCode === 'aborted' || errCode === 'no-speech') {
        return;
      }
      if (errCode === 'not-allowed' || errCode === 'service-not-allowed') {
        permissionDenied = true;
        hasSpeechError = true;
        options.onError(
          'Izin mikrofon/dikte ditolak browser. Aktifkan izin mic (HTTPS) lalu coba lagi.'
        );
        return;
      }
      if (errCode === 'audio-capture') {
        hasSpeechError = true;
        options.onError('Mikrofon tidak ditemukan atau sedang dipakai aplikasi lain.');
        return;
      }
      if (errCode === 'network') {
        hasSpeechError = true;
        options.onError(
          'Pengenalan suara browser butuh koneksi internet atau gunakan kolom ketik cepat di bawah.'
        );
      }
    };

    recognition.onend = () => {
      if (aborted) return;
      if (stopped) {
        finalizeOnce();
        return;
      }
      // Browser ended recognition unexpectedly while still recording: preserve text and restart cleanly
      if (!permissionDenied) {
        committedRoundsText = getCurrentRawTranscript();
        finalChunks = [];
        interimChunks = [];
        try {
          recognition?.start();
        } catch {
          // ignore restart failure if stopped mid-transition
        }
      }
    };

    try {
      recognition.start();
    } catch {
      // ignore if browser throws on rapid restart
    }
  } else {
    hasSpeechError = true;
    options.onError(
      'Browser ini belum mendukung dikte suara Web Speech API. Gunakan Chrome/Edge atau ketik cepat di bawah.'
    );
  }

  // Start microphone analyser in parallel without blocking SpeechRecognition startup
  void (async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return;
      const capturedStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (stopped || aborted) {
        capturedStream.getTracks().forEach((t) => t.stop());
        return;
      }
      stream = capturedStream;
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtx = new AudioCtx();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 32;
      source.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      const loop = () => {
        if (stopped || aborted) return;
        analyser.getByteFrequencyData(data);
        const bars = Array.from({ length: 10 }, (_, i) => {
          const val = data[i % data.length] || 0;
          return Math.max(0.15, Math.min(1, val / 180));
        });
        options.onWaveform(bars);
        rafId = requestAnimationFrame(loop);
      };
      loop();
    } catch (err) {
      const errName = err instanceof Error ? err.name : '';
      if (
        !hasReceivedResult &&
        !permissionDenied &&
        (errName === 'NotAllowedError' || errName === 'PermissionDeniedError')
      ) {
        permissionDenied = true;
        options.onError('Izin mikrofon ditolak. Aktifkan izin mic di browser untuk dikte suara.');
      }
    }
  })();

  return {
    stop: () => {
      if (stopped || aborted) return;
      stopped = true;
      cleanupHardware();

      if (recognition) {
        try {
          recognition.stop();
        } catch {
          finalizeOnce();
          return;
        }
        // Wait briefly for browser SpeechRecognition to flush trailing interim words into onresult/onend
        flushTimer = window.setTimeout(finalizeOnce, 240);
      } else {
        finalizeOnce();
      }
    },
    cancel: () => {
      if (aborted) return;
      aborted = true;
      stopped = true;
      if (flushTimer !== null) {
        window.clearTimeout(flushTimer);
        flushTimer = null;
      }
      cleanupHardware();
      try {
        if (recognition?.abort) {
          recognition.abort();
        } else {
          recognition?.stop();
        }
      } catch {
        // ignore
      }
    }
  };
}
