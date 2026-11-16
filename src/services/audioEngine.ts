import type { NoiseChannelId } from '../types/miu';

interface ActiveChannelNodes {
  stop: () => void;
  gainNode: GainNode;
}

class MiuAudioEngine {
  private ctx: AudioContext | null = null;
  private noiseMasterGain: GainNode | null = null;
  private musicMasterGain: GainNode | null = null;
  private notifMasterGain: GainNode | null = null;

  private activeNoises = new Map<NoiseChannelId, ActiveChannelNodes>();
  private focusSynthStop: (() => void) | null = null;
  private streamAudio: HTMLAudioElement | null = null;
  private streamListener:
    | ((state: {
        positionMs: number;
        durationMs: number;
        isPlaying: boolean;
        ended?: boolean;
      }) => void)
    | null = null;

  private volumes = {
    spotify: 0.75,
    noise: 0.55,
    notif: 0.7
  };

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.noiseMasterGain = this.ctx.createGain();
      this.noiseMasterGain.gain.value = this.volumes.noise;
      this.noiseMasterGain.connect(this.ctx.destination);

      this.musicMasterGain = this.ctx.createGain();
      this.musicMasterGain.gain.value = this.volumes.spotify * 0.85;
      this.musicMasterGain.connect(this.ctx.destination);

      this.notifMasterGain = this.ctx.createGain();
      this.notifMasterGain.gain.value = this.volumes.notif;
      this.notifMasterGain.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public setVolume(channel: 'spotify' | 'noise' | 'notif', value: number): void {
    const clamped = Math.max(0, Math.min(1, value));
    this.volumes[channel] = clamped;
    if (channel === 'spotify' && this.streamAudio) {
      this.streamAudio.volume = clamped;
    }
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    if (channel === 'noise' && this.noiseMasterGain) {
      this.noiseMasterGain.gain.setTargetAtTime(clamped, now, 0.04);
    } else if (channel === 'spotify' && this.musicMasterGain) {
      this.musicMasterGain.gain.setTargetAtTime(clamped * 0.85, now, 0.04);
    } else if (channel === 'notif' && this.notifMasterGain) {
      this.notifMasterGain.gain.setTargetAtTime(clamped, now, 0.04);
    }
  }

  public getVolumes() {
    return { ...this.volumes };
  }

  private createNoiseBuffer(ctx: AudioContext, color: 'pink' | 'brown' | 'white'): AudioBuffer {
    const bufferSize = ctx.sampleRate * 3;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    if (color === 'white') {
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      return buffer;
    }

    if (color === 'brown') {
      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = data[i];
        data[i] *= 3.2;
      }
      return buffer;
    }

    // Pink noise (Paul Kellet filter)
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.08;
      b6 = white * 0.115926;
    }
    return buffer;
  }

  public toggleNoise(channel: NoiseChannelId, enable: boolean): void {
    if (!enable) {
      const existing = this.activeNoises.get(channel);
      if (existing) {
        existing.stop();
        this.activeNoises.delete(channel);
      }
      return;
    }

    if (this.activeNoises.has(channel)) return;

    const ctx = this.ensureContext();
    const target = this.noiseMasterGain!;
    const channelGain = ctx.createGain();
    channelGain.gain.setValueAtTime(0.001, ctx.currentTime);
    channelGain.gain.exponentialRampToValueAtTime(0.38, ctx.currentTime + 0.35);
    channelGain.connect(target);

    if (channel === 'rain') {
      const src = ctx.createBufferSource();
      src.buffer = this.createNoiseBuffer(ctx, 'pink');
      src.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1150;
      filter.Q.value = 0.65;

      src.connect(filter);
      filter.connect(channelGain);
      src.start();

      this.activeNoises.set(channel, {
        gainNode: channelGain,
        stop: () => {
          try {
            src.stop();
            src.disconnect();
            channelGain.disconnect();
          } catch {
            // ignore
          }
        }
      });
    } else if (channel === 'waves') {
      const src = ctx.createBufferSource();
      src.buffer = this.createNoiseBuffer(ctx, 'brown');
      src.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 520;

      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.14; // calm ocean swell
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.18;
      lfo.connect(lfoGain);
      lfoGain.connect(channelGain.gain);

      src.connect(filter);
      filter.connect(channelGain);
      src.start();
      lfo.start();

      this.activeNoises.set(channel, {
        gainNode: channelGain,
        stop: () => {
          try {
            src.stop();
            lfo.stop();
            channelGain.disconnect();
          } catch {
            // ignore
          }
        }
      });
    } else if (channel === 'forest') {
      const src = ctx.createBufferSource();
      src.buffer = this.createNoiseBuffer(ctx, 'pink');
      src.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 720;

      src.connect(filter);
      filter.connect(channelGain);
      src.start();

      // Gentle occasional bird chirp
      const chirpTimer = window.setInterval(() => {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        const now = this.ctx.currentTime;
        osc.type = 'sine';
        const baseFreq = 1900 + Math.random() * 900;
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.28, now + 0.08);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(0.04, now + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
        osc.connect(g);
        g.connect(channelGain);
        osc.start(now);
        osc.stop(now + 0.18);
      }, 3600);

      this.activeNoises.set(channel, {
        gainNode: channelGain,
        stop: () => {
          window.clearInterval(chirpTimer);
          try {
            src.stop();
            channelGain.disconnect();
          } catch {
            // ignore
          }
        }
      });
    } else if (channel === 'cafe') {
      const src = ctx.createBufferSource();
      src.buffer = this.createNoiseBuffer(ctx, 'brown');
      src.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 460;
      filter.Q.value = 0.8;

      src.connect(filter);
      filter.connect(channelGain);
      src.start();

      // Soft ceramic cup clink every few seconds
      const clinkTimer = window.setInterval(() => {
        if (!this.ctx || this.ctx.state !== 'running' || Math.random() > 0.55) return;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        const now = this.ctx.currentTime;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(2400 + Math.random() * 400, now);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(0.035, now + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
        osc.connect(g);
        g.connect(channelGain);
        osc.start(now);
        osc.stop(now + 0.15);
      }, 4200);

      this.activeNoises.set(channel, {
        gainNode: channelGain,
        stop: () => {
          window.clearInterval(clinkTimer);
          try {
            src.stop();
            channelGain.disconnect();
          } catch {
            // ignore
          }
        }
      });
    } else if (channel === 'kalimba') {
      // Pentatonic C-major gentle kalimba arpeggio
      const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
      let step = 0;
      const playPluck = () => {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        const now = this.ctx.currentTime;
        const note = scale[(step + Math.floor(Math.random() * 2)) % scale.length];
        step++;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(note, now);
        g.gain.setValueAtTime(0.001, now);
        g.gain.exponentialRampToValueAtTime(0.16, now + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 1.35);
        osc.connect(g);
        g.connect(channelGain);
        osc.start(now);
        osc.stop(now + 1.4);
      };
      playPluck();
      const timer = window.setInterval(playPluck, 1250);

      this.activeNoises.set(channel, {
        gainNode: channelGain,
        stop: () => {
          window.clearInterval(timer);
          try {
            channelGain.disconnect();
          } catch {
            // ignore
          }
        }
      });
    }
  }

  private ensureStreamAudio(): HTMLAudioElement {
    if (!this.streamAudio) {
      const audio = new Audio();
      audio.loop = false;
      audio.preload = 'auto';

      const emitUpdate = (ended = false) => {
        if (!this.streamListener) return;
        const durationSec =
          Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
        this.streamListener({
          positionMs: Math.round((audio.currentTime || 0) * 1000),
          durationMs: durationSec > 0 ? Math.round(durationSec * 1000) : 0,
          isPlaying: !audio.paused && !audio.ended,
          ended
        });
      };

      audio.addEventListener('timeupdate', () => emitUpdate(false));
      audio.addEventListener('loadedmetadata', () => emitUpdate(false));
      audio.addEventListener('play', () => emitUpdate(false));
      audio.addEventListener('pause', () => emitUpdate(false));
      audio.addEventListener('ended', () => emitUpdate(true));

      this.streamAudio = audio;
    }
    return this.streamAudio;
  }

  public onStreamStateChange(
    cb:
      | ((state: {
          positionMs: number;
          durationMs: number;
          isPlaying: boolean;
          ended?: boolean;
        }) => void)
      | null
  ): void {
    this.streamListener = cb;
  }

  public playStreamUrl(url: string): void {
    this.stopOfflineFocusMusic();
    const audio = this.ensureStreamAudio();
    audio.pause();
    if (audio.src !== url) {
      audio.src = url;
      audio.currentTime = 0;
    }
    audio.volume = this.volumes.spotify;
    void audio.play().catch(() => {});
  }

  public pauseStream(): void {
    if (this.streamAudio) {
      this.streamAudio.pause();
    }
  }

  public stopStream(): void {
    if (this.streamAudio) {
      this.streamAudio.pause();
      this.streamAudio.currentTime = 0;
      this.streamAudio.removeAttribute('src');
      this.streamAudio.load();
    }
  }

  public seekStream(positionMs: number): void {
    if (this.streamAudio && this.streamAudio.src) {
      const targetSec = Math.max(0, positionMs / 1000);
      if (Number.isFinite(this.streamAudio.duration) && this.streamAudio.duration > 0) {
        this.streamAudio.currentTime = Math.min(this.streamAudio.duration, targetSec);
      } else {
        this.streamAudio.currentTime = targetSec;
      }
    }
  }

  public resumeStream(): boolean {
    if (this.streamAudio && this.streamAudio.src) {
      this.streamAudio.volume = this.volumes.spotify;
      void this.streamAudio.play().catch(() => {});
      return true;
    }
    return false;
  }

  public startOfflineFocusMusic(): void {
    if (this.focusSynthStop) return;
    const ctx = this.ensureContext();
    const chords = [
      [261.63, 329.63, 392.0, 493.88], // Cmaj7
      [220.0, 261.63, 329.63, 392.0], // Am7
      [174.61, 220.0, 261.63, 349.23], // Fmaj7
      [196.0, 246.94, 293.66, 392.0] // G6
    ];
    const melodyNotes = [523.25, 659.25, 587.33, 493.88, 523.25, 392.0, 440.0, 493.88];
    let idx = 0;

    const playWarmChord = () => {
      if (!this.ctx || !this.musicMasterGain) return;
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      const now = this.ctx.currentTime;
      const chord = chords[idx % chords.length];
      const melody = melodyNotes[idx % melodyNotes.length];
      idx++;

      // Warm Lo-Fi Electric Piano Pad
      chord.forEach((freq) => {
        const osc = ctx.createOscillator();
        const g = this.ctx!.createGain();
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1100;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        g.gain.setValueAtTime(0.001, now);
        g.gain.linearRampToValueAtTime(0.14, now + 0.35);
        g.gain.exponentialRampToValueAtTime(0.0008, now + 3.8);

        osc.connect(filter);
        filter.connect(g);
        g.connect(this.musicMasterGain!);
        osc.start(now);
        osc.stop(now + 3.9);
      });

      // Gentle Lo-Fi Pluck Melody note
      const mOsc = ctx.createOscillator();
      const mGain = ctx.createGain();
      mOsc.type = 'sine';
      mOsc.frequency.setValueAtTime(melody, now + 0.5);
      mGain.gain.setValueAtTime(0.001, now + 0.5);
      mGain.gain.exponentialRampToValueAtTime(0.16, now + 0.54);
      mGain.gain.exponentialRampToValueAtTime(0.0005, now + 2.4);
      mOsc.connect(mGain);
      mGain.connect(this.musicMasterGain);
      mOsc.start(now + 0.5);
      mOsc.stop(now + 2.5);
    };

    playWarmChord();
    const timer = window.setInterval(playWarmChord, 3800);
    this.focusSynthStop = () => window.clearInterval(timer);
  }

  public stopOfflineFocusMusic(): void {
    if (this.focusSynthStop) {
      this.focusSynthStop();
      this.focusSynthStop = null;
    }
  }

  public playNotificationChime(kind: 'pomodoro' | 'reminder' = 'pomodoro'): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const freqs = kind === 'pomodoro' ? [587.33, 880] : [523.25, 659.25];

    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + i * 0.14);
      g.gain.setValueAtTime(0.001, now + i * 0.14);
      g.gain.exponentialRampToValueAtTime(0.24, now + i * 0.14 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.14 + 0.55);
      osc.connect(g);
      g.connect(this.notifMasterGain!);
      osc.start(now + i * 0.14);
      osc.stop(now + i * 0.14 + 0.6);
    });
  }
}

export const audioEngine = new MiuAudioEngine();
