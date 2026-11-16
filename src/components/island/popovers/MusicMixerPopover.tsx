'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  CloudRain,
  Coffee,
  ExternalLink,
  Link2,
  Loader2,
  Music2,
  Pause,
  Play,
  Search,
  SkipBack,
  SkipForward,
  Sliders,
  Sparkles,
  Trees,
  Volume2,
  Waves
} from 'lucide-react';
import { useMiu } from '../../../context/MiuContext';
import {
  loadSpotifyIframeApi,
  searchSpotifyCatalog,
  SPOTIFY_STUDY_PRESETS,
  spotifyUriToWebUrl,
  type SpotifyTrackItem
} from '../../../services/spotifyService';
import type { NoiseChannelId } from '../../../types/miu';
import { formatTimerMMSS } from '../../../utils/formatters';

const NOISE_OPTIONS: Array<{
  id: NoiseChannelId;
  label: string;
  Icon: React.FC<{ className?: string }>;
}> = [
  { id: 'rain', label: 'Hujan', Icon: CloudRain },
  { id: 'forest', label: 'Hutan', Icon: Trees },
  { id: 'waves', label: 'Ombak', Icon: Waves },
  { id: 'cafe', label: 'Kafe', Icon: Coffee },
  { id: 'kalimba', label: 'Kalimba', Icon: Sparkles }
];

export const MusicMixerPopover: React.FC = () => {
  const {
    activeTrack,
    lyrics,
    activeLyricText,
    lyricsLoading,
    spotifyEmbedUri,
    loadSpotifyUrlOrPreset,
    playSpotifyTrackItem,
    registerEmbedController,
    updateEmbedPlaybackState,
    togglePlayMusic,
    seekMusic,
    nextTrack,
    prevTrack,
    activeNoises,
    toggleNoiseChannel,
    volumes,
    setChannelVolume
  } = useMiu();

  const [tab, setTab] = useState<'player' | 'search'>('player');
  const [showSpotifyEmbedWidget, setShowSpotifyEmbedWidget] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SpotifyTrackItem[]>(SPOTIFY_STUDY_PRESETS);
  const [searching, setSearching] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [embedError, setEmbedError] = useState('');

  const embedHostRef = useRef<HTMLDivElement | null>(null);
  const controllerInitializedRef = useRef(false);
  const activeLyricRef = useRef<HTMLParagraphElement | null>(null);

  // Auto-scroll lyrics inside popover
  useEffect(() => {
    activeLyricRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeLyricText]);

  // Debounced Spotify catalog search
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults(SPOTIFY_STUDY_PRESETS);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(() => {
      searchSpotifyCatalog(q)
        .then((items) => {
          if (!cancelled) setSearchResults(items);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 320);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  // Mount Official Spotify Embed iFrame Controller once and keep it alive across tab switches
  useEffect(() => {
    if (!embedHostRef.current || controllerInitializedRef.current) return;

    let mounted = true;
    setEmbedError('');

    loadSpotifyIframeApi()
      .then((IFrameAPI) => {
        if (!mounted || !embedHostRef.current) return;
        controllerInitializedRef.current = true;
        embedHostRef.current.innerHTML = '';
        IFrameAPI.createController(
          embedHostRef.current,
          { uri: spotifyEmbedUri, width: '100%', height: 80 },
          (controller) => {
            if (!mounted) return;
            registerEmbedController(controller);
            controller.addListener('playback_update', (e) => {
              const d = e.data || {};
              updateEmbedPlaybackState(
                Number(d.position || 0),
                Number(d.duration || 180000),
                Boolean(d.isPaused)
              );
            });
          }
        );
      })
      .catch((err: unknown) => {
        if (mounted) {
          setEmbedError(err instanceof Error ? err.message : 'Spotify Embed tidak tersedia.');
        }
      });

    return () => {
      mounted = false;
    };
  }, [spotifyEmbedUri, registerEmbedController, updateEmbedPlaybackState]);

  const handlePasteUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    loadSpotifyUrlOrPreset(trimmed);
    if (trimmed.includes('/playlist/') || trimmed.includes('/album/')) {
      setShowSpotifyEmbedWidget(true);
    }
    setUrlInput('');
    setTab('player');
  };

  const activeLyricIndex = lyrics.findIndex((l) => l.text === activeLyricText);
  const trackProgressPct = Math.min(
    100,
    Math.round((activeTrack.positionMs / Math.max(1, activeTrack.durationMs)) * 100)
  );
  const currentSpotifyWebUrl = activeTrack.spotifyUri
    ? spotifyUriToWebUrl(activeTrack.spotifyUri)
    : `https://open.spotify.com/search/${encodeURIComponent(
        `${activeTrack.title} ${activeTrack.artist}`
      )}`;

  return (
    <div className="w-full p-3.5 space-y-3 text-island-text">
      {/* Sub-navigation Segmented Control */}
      <div className="flex items-center justify-between gap-1 bg-black/30 border border-white/10 p-1 rounded-xl">
        <button
          type="button"
          onClick={() => setTab('player')}
          className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition ${
            tab === 'player'
              ? 'bg-emerald-400 text-slate-950 shadow-sm'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          Player, Lirik &amp; Mixer
        </button>
        <button
          type="button"
          onClick={() => setTab('search')}
          className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition inline-flex items-center justify-center gap-1 ${
            tab === 'search'
              ? 'bg-emerald-400 text-slate-950 shadow-sm'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <Search className="w-3 h-3" />
          Cari &amp; Sumber Spotify
        </button>
      </div>

      {/* Persistent Official Spotify Embed Host (mounted once, toggled when needed so there are never 2 duplicate players competing) */}
      <div className={tab === 'player' && showSpotifyEmbedWidget ? 'block space-y-1' : 'hidden'}>
        <div
          ref={embedHostRef}
          className="rounded-xl overflow-hidden bg-black/40 border border-emerald-400/25 min-h-[80px]"
        />
        <p className="text-[9.5px] text-slate-400 leading-tight px-1">
          Info: Pemutar utama Miu di bawah memutar <strong>lagu penuh (Full Track)</strong>. Widget Embed Spotify di atas hanya diperlukan untuk Playlist/Album.
        </p>
        {embedError && <p className="text-[10px] text-amber-300 mt-1">{embedError}</p>}
      </div>

      {tab === 'player' ? (
        <>
          {/* Track Card + Source Link + Ambient Glow */}
          <div
            className="relative overflow-hidden rounded-2xl p-3 border border-white/10 space-y-2.5"
            style={{
              background: `radial-gradient(circle at top left, ${activeTrack.glowColor}38, rgba(255,255,255,0.03))`
            }}
          >
            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 shrink-0">
                <img
                  src={activeTrack.coverUrl}
                  alt={activeTrack.title}
                  className="w-12 h-12 rounded-xl object-cover shadow-md"
                />
                {activeTrack.isPlaying && (
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 text-slate-950 flex items-center justify-center shadow">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping" />
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <a
                    href={currentSpotifyWebUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 hover:bg-emerald-500/30 transition"
                    title="Lihat sumber lagu di Spotify"
                  >
                    <span>Sumber: Spotify</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => setShowSpotifyEmbedWidget((v) => !v)}
                    className={`text-[9px] font-mono px-1.5 py-0.5 rounded border transition ${
                      showSpotifyEmbedWidget
                        ? 'bg-sky-500/20 border-sky-400/40 text-sky-200'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                    }`}
                    title="Tampilkan/sembunyikan Widget Embed Spotify"
                  >
                    {showSpotifyEmbedWidget ? 'Tutup Embed' : 'Embed'}
                  </button>
                </div>
                <p className="text-xs font-bold text-white truncate mt-1">{activeTrack.title}</p>
                <p className="text-[11px] text-slate-300 truncate">{activeTrack.artist}</p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={prevTrack}
                  className="p-1.5 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition"
                  aria-label="Lagu sebelumnya"
                >
                  <SkipBack className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={togglePlayMusic}
                  className="w-9 h-9 rounded-full bg-emerald-400 hover:bg-emerald-300 text-slate-950 flex items-center justify-center shadow-[0_0_16px_rgba(16,185,129,0.4)] transition active:scale-95"
                  aria-label={activeTrack.isPlaying ? 'Pause' : 'Play'}
                >
                  {activeTrack.isPlaying ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4 ml-0.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={nextTrack}
                  className="p-1.5 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition"
                  aria-label="Lagu berikutnya"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Seekable Track Progress Bar */}
            <div className="space-y-1">
              <div
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                  seekMusic(Math.round(ratio * activeTrack.durationMs));
                }}
                className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden cursor-pointer group"
                title="Klik untuk menggeser posisi waktu lagu"
              >
                <div
                  className="h-full bg-emerald-400 group-hover:bg-emerald-300 transition-all duration-150"
                  style={{ width: `${trackProgressPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[9px] font-mono text-slate-400">
                <span>{formatTimerMMSS(Math.floor(activeTrack.positionMs / 1000))}</span>
                <span className="text-emerald-300/80">Full Audio Stream</span>
                <span>{formatTimerMMSS(Math.floor(activeTrack.durationMs / 1000))}</span>
              </div>
            </div>

            {/* Live Synced LRCLIB Lyrics */}
            <div className="bg-black/30 border border-white/[0.07] rounded-xl px-3 py-2 max-h-20 overflow-y-auto space-y-1">
              <div className="flex items-center justify-between text-[9px] text-slate-400 uppercase tracking-wider font-mono">
                <span>♪ LRCLIB Synced Lyrics</span>
                <span>{lyricsLoading ? 'Memuat...' : `${lyrics.length} baris`}</span>
              </div>
              {lyrics.length > 0 ? (
                lyrics.map((line, idx) => {
                  const isCurrent = idx === activeLyricIndex;
                  return (
                    <p
                      key={`${line.timeMs}-${idx}`}
                      ref={isCurrent ? activeLyricRef : null}
                      onClick={() => seekMusic(line.timeMs)}
                      className={`text-[11px] leading-snug transition-all cursor-pointer hover:text-emerald-200 ${
                        isCurrent ? 'text-emerald-300 font-semibold' : 'text-slate-400/70'
                      }`}
                      title="Klik baris lirik untuk lompat ke bagian ini"
                    >
                      {line.text}
                    </p>
                  );
                })
              ) : (
                <p className="text-[11px] text-slate-300">{activeLyricText}</p>
              )}
            </div>
          </div>

          {/* Layered White Noise Toggles */}
          <div>
            <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              <span>Layered White Noise</span>
              {activeNoises.length > 0 && (
                <span className="font-mono text-sky-300">{activeNoises.length} aktif</span>
              )}
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {NOISE_OPTIONS.map(({ id, label, Icon }) => {
                const active = activeNoises.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleNoiseChannel(id)}
                    className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl text-[10px] font-medium transition border ${
                      active
                        ? 'bg-sky-500/20 border-sky-400/50 text-sky-200 shadow-sm'
                        : 'bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3 Independent Audio Mixer Sliders */}
          <div className="miu-island-card rounded-2xl p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              <Sliders className="w-3 h-3 text-sky-300" />
              <span>Audio Mixer Independen</span>
            </div>
            {[
              { key: 'spotify' as const, label: 'Spotify / Musik', Icon: Music2 },
              { key: 'noise' as const, label: 'White Noise', Icon: CloudRain },
              { key: 'notif' as const, label: 'Notifikasi Timer', Icon: Volume2 }
            ].map(({ key, label, Icon }) => (
              <div key={key} className="flex items-center gap-2 text-[11px]">
                <Icon className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                <span className="w-28 truncate text-slate-200">{label}</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={volumes[key]}
                  onChange={(e) => setChannelVolume(key, Number(e.target.value))}
                  className="miu-slider flex-1"
                />
                <span className="font-mono text-[10px] w-9 text-right text-sky-300">
                  {Math.round(volumes[key] * 100)}%
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        /* Tab 2: Pencarian Lagu Spotify + Tempel Sumber Link Spotify */
        <div className="space-y-3 text-xs">
          {/* 1. Search Bar */}
          <div className="miu-island-card rounded-2xl p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-emerald-300">
                Cari Lagu atau Artis di Spotify
              </span>
              {searching && <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />}
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ketik judul lagu / artis (mis. Hindia, Tulus, Nadin)..."
                autoFocus
                className="w-full bg-black/40 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-400"
              />
            </div>

            {/* Search Results List */}
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-0.5">
              {searchResults.length === 0 ? (
                <p className="text-[11px] text-slate-400 text-center py-4">
                  Lagu tidak ditemukan. Coba kata kunci lain atau tempel link Spotify di bawah.
                </p>
              ) : (
                searchResults.map((item) => {
                  const isCurrent =
                    activeTrack.title.toLowerCase() === item.title.toLowerCase() &&
                    activeTrack.artist.toLowerCase() === item.artist.toLowerCase();
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        playSpotifyTrackItem(item);
                        setTab('player');
                      }}
                      className={`group flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer transition ${
                        isCurrent
                          ? 'bg-emerald-500/20 border-emerald-400/40'
                          : 'bg-white/[0.04] border-white/[0.06] hover:bg-white/10'
                      }`}
                    >
                      <img
                        src={item.coverUrl}
                        alt={item.title}
                        className="w-10 h-10 rounded-lg object-cover shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <p className="text-xs font-semibold text-white truncate">{item.title}</p>
                          <span className="text-[10px] font-mono text-slate-400 shrink-0">
                            {formatTimerMMSS(Math.floor((item.durationMs || 180000) / 1000))}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-300 truncate">
                          <span className="truncate">{item.artist}</span>
                          <span>•</span>
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-0.5 text-emerald-300 hover:underline shrink-0"
                            title="Buka Sumber di Spotify"
                          >
                            Spotify
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="w-7 h-7 rounded-full bg-emerald-400 text-slate-950 flex items-center justify-center shrink-0 group-hover:scale-105 transition"
                        title="Putar Lagu"
                      >
                        <Play className="w-3.5 h-3.5 ml-0.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 2. Sumber Link Spotify (Paste Direct URL) */}
          <div className="miu-island-card rounded-2xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sky-300">Sumber Link Spotify</span>
              <span className="text-[10px] font-mono text-slate-400">Track / Playlist URL</span>
            </div>
            <form onSubmit={handlePasteUrl} className="flex gap-1.5">
              <div className="relative flex-1">
                <Link2 className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://open.spotify.com/track/..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl pl-8 pr-2.5 py-1.5 text-[11px] text-white placeholder:text-slate-400 focus:outline-none focus:border-sky-400"
                />
              </div>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 font-semibold text-[11px] transition shrink-0"
              >
                Muat
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
