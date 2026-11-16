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
}

export async function startLazytypeCapture(options: {
  lang: 'id-ID' | 'en-US';
  onInterim: (text: string) => void;
  onFinal: (formattedText: string) => void;
  onWaveform: (levels: number[]) => void;
  onError: (message: string) => void;
}): Promise<LazytypeSession> {
  let stopped = false;
  let stream: MediaStream | null = null;
  let audioCtx: AudioContext | null = null;
  let rafId = 0;

  // Start microphone analyser for real-time audio waveform pill
  try {
    if (navigator.mediaDevices?.getUserMedia) {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtx = new AudioCtx();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 32;
      source.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      const loop = () => {
        if (stopped) return;
        analyser.getByteFrequencyData(data);
        const bars = Array.from({ length: 10 }, (_, i) => {
          const val = data[i % data.length] || 0;
          return Math.max(0.15, Math.min(1, val / 180));
        });
        options.onWaveform(bars);
        rafId = requestAnimationFrame(loop);
      };
      loop();
    }
  } catch {
    options.onError('Izin mikrofon ditolak. Aktifkan izin mic di browser untuk dikte suara.');
  }

  interface SpeechRecognitionInstance {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    onresult: ((e: unknown) => void) | null;
    onerror: ((e: unknown) => void) | null;
    start: () => void;
    stop: () => void;
  }

  // Speech recognition (runs locally on supported engines; falls back gracefully)
  const SpeechRecCtor =
    (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance }).SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance }).webkitSpeechRecognition;

  let finalBuffer = '';
  let recognition: SpeechRecognitionInstance | null = null;

  if (SpeechRecCtor) {
    recognition = new SpeechRecCtor();
    recognition.lang = options.lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event: unknown) => {
      const ev = event as {
        resultIndex: number;
        results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
      };
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const transcript = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) {
          finalBuffer += (finalBuffer ? ' ' : '') + transcript;
        } else {
          interim += transcript;
        }
      }
      options.onInterim(`${finalBuffer} ${interim}`.trim());
    };
    recognition.onerror = () => {
      // Ignore silent abort errors on release
    };
    try {
      recognition.start();
    } catch {
      // ignore already started
    }
  }

  return {
    stop: () => {
      stopped = true;
      if (rafId) cancelAnimationFrame(rafId);
      try {
        recognition?.stop();
      } catch {
        // ignore
      }
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      if (audioCtx) {
        void audioCtx.close();
      }
      const formatted = formatDictationTranscript(finalBuffer);
      if (formatted) {
        options.onFinal(formatted);
      }
    }
  };
}
