export interface SpotifyTrackItem {
  id: string;
  label?: string;
  title: string;
  artist: string;
  album: string;
  uri: string;
  url: string;
  coverUrl: string;
  durationMs: number;
  durationSec?: number;
  youtubeId?: string;
  sourceKind?: 'youtube' | 'spotify';
  searchQuery?: string;
  audioUrl?: string;
  isFullTrack?: boolean;
  glowColor: string;
}

export const SPOTIFY_STUDY_PRESETS: SpotifyTrackItem[] = [
  {
    id: 'preset-nadin',
    label: 'Bertaut — Nadin Amizah',
    title: 'Bertaut',
    artist: 'Nadin Amizah',
    album: 'Selamat Ulang Tahun',
    uri: 'spotify:track:630DpnzdfjdVqv2yLfPbAX',
    url: 'https://open.spotify.com/track/630DpnzdfjdVqv2yLfPbAX',
    coverUrl:
      'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=300&q=80',
    durationMs: 316000,
    glowColor: '#10B981'
  },
  {
    id: 'preset-hindia',
    label: 'Evaluasi — Hindia',
    title: 'Evaluasi',
    artist: 'Hindia',
    album: 'Menari Dengan Bayangan',
    uri: 'spotify:track:2dIBMHByUGcNPzmYBJ6OAj',
    url: 'https://open.spotify.com/track/2dIBMHByUGcNPzmYBJ6OAj',
    coverUrl:
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=300&q=80',
    durationMs: 194000,
    glowColor: '#38BDF8'
  },
  {
    id: 'preset-tulus',
    label: 'Hati-Hati di Jalan — Tulus',
    title: 'Hati-Hati di Jalan',
    artist: 'Tulus',
    album: 'Manusia',
    uri: 'spotify:track:2hHeGD57S0BcopfVcmehdl',
    url: 'https://open.spotify.com/track/2hHeGD57S0BcopfVcmehdl',
    coverUrl:
      'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=300&q=80',
    durationMs: 242000,
    glowColor: '#D99B66'
  },
  {
    id: 'preset-lofi',
    label: 'Lo-Fi Study Beats',
    title: 'Snowman',
    artist: 'WYS',
    album: '1 Am. Study Session',
    uri: 'spotify:playlist:0vvXsWCC9xrXsKd4FyS8kM',
    url: 'https://open.spotify.com/playlist/0vvXsWCC9xrXsKd4FyS8kM',
    coverUrl:
      'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=300&q=80',
    durationMs: 195000,
    glowColor: '#8B5CF6'
  },
  {
    id: 'preset-piano',
    label: 'Peaceful Piano Focus',
    title: 'River Flows in You',
    artist: 'Yiruma',
    album: 'First Love (Piano Focus)',
    uri: 'spotify:playlist:37i9dQZF1DX4sWSpwq3LiO',
    url: 'https://open.spotify.com/playlist/37i9dQZF1DX4sWSpwq3LiO',
    coverUrl:
      'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=300&q=80',
    durationMs: 210000,
    glowColor: '#10B981'
  }
];

const FULL_STREAM_SEARCH_ENDPOINTS = [
  'https://saavn.dev/api/search/songs',
  'https://saavn.sumit.co/api/search/songs',
  'https://jiosaavn-api-privatecvc2.vercel.app/search/songs'
];

function decodeHtmlEntities(input: string): string {
  if (!input) return '';
  return input
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

interface RawMediaLink {
  quality?: string;
  url?: string;
  link?: string;
}

interface RawSaavnSong {
  id?: string;
  name?: string;
  title?: string;
  duration?: number | string;
  album?: { name?: string } | string;
  primaryArtists?: string;
  artists?: {
    primary?: Array<{ name?: string }>;
  };
  image?: RawMediaLink[] | string;
  downloadUrl?: RawMediaLink[] | string;
}

function parseFullStreamItems(payload: unknown): SpotifyTrackItem[] {
  if (!payload || typeof payload !== 'object') return [];
  const root = payload as Record<string, unknown>;
  const dataObj = (root.data as Record<string, unknown>) || root;
  const rawResults = Array.isArray(dataObj.results)
    ? (dataObj.results as RawSaavnSong[])
    : Array.isArray(root.results)
      ? (root.results as RawSaavnSong[])
      : [];

  const parsed: SpotifyTrackItem[] = [];

  for (const row of rawResults) {
    const title = decodeHtmlEntities(row.name || row.title || '').trim();
    if (!title) continue;

    const artistFromArray = row.artists?.primary
      ?.map((a) => a.name)
      .filter(Boolean)
      .join(', ');
    const artist = decodeHtmlEntities(artistFromArray || row.primaryArtists || 'Artis').trim();

    const albumName =
      typeof row.album === 'string'
        ? decodeHtmlEntities(row.album)
        : decodeHtmlEntities(row.album?.name || 'Single');

    // Extract highest-quality full audio stream URL (prefer 320kbps or 160kbps)
    let audioUrl = '';
    if (typeof row.downloadUrl === 'string') {
      audioUrl = row.downloadUrl;
    } else if (Array.isArray(row.downloadUrl) && row.downloadUrl.length > 0) {
      const preferred =
        row.downloadUrl.find((d) => d.quality === '320kbps') ||
        row.downloadUrl.find((d) => d.quality === '160kbps') ||
        row.downloadUrl[row.downloadUrl.length - 1];
      audioUrl = preferred?.url || preferred?.link || '';
    }
    if (!audioUrl) continue;

    // Extract high-res artwork
    let coverUrl =
      'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=300&q=80';
    if (typeof row.image === 'string' && row.image) {
      coverUrl = row.image;
    } else if (Array.isArray(row.image) && row.image.length > 0) {
      const bestImg = row.image[row.image.length - 1];
      coverUrl = bestImg?.url || bestImg?.link || coverUrl;
    }

    const durationSec = Number(row.duration || 0);
    const durationMs = durationSec > 0 ? durationSec * 1000 : 210000;

    const matchedPreset = SPOTIFY_STUDY_PRESETS.find(
      (p) =>
        p.title.toLowerCase() === title.toLowerCase() &&
        p.artist.toLowerCase().includes(artist.toLowerCase())
    );

    const spotifySearchUrl = `https://open.spotify.com/search/${encodeURIComponent(
      `${title} ${artist}`
    )}`;

    parsed.push({
      id: `sp-full-${row.id || Math.random().toString(36).slice(2, 8)}`,
      title,
      artist,
      album: albumName,
      uri: matchedPreset?.uri || '',
      url: matchedPreset?.url || spotifySearchUrl,
      coverUrl,
      durationMs,
      audioUrl,
      isFullTrack: durationMs > 45000,
      glowColor: matchedPreset?.glowColor || '#10B981'
    });
  }

  return parsed;
}

async function fetchFullStreamCatalog(query: string, limit = 10): Promise<SpotifyTrackItem[]> {
  for (const endpoint of FULL_STREAM_SEARCH_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 4500);
      const sep = endpoint.includes('?') ? '&' : '?';
      const url = `${endpoint}${sep}query=${encodeURIComponent(query)}&limit=${limit}`;
      const resp = await fetch(url, { signal: controller.signal });
      window.clearTimeout(timeout);
      if (!resp.ok) continue;
      const json = await resp.json();
      const items = parseFullStreamItems(json);
      if (items.length > 0) {
        return items;
      }
    } catch {
      // try next mirror
    }
  }
  return [];
}

/** Convert a Spotify share URL or URI into canonical spotify:type:id URI */
export function parseSpotifyUri(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('spotify:')) return trimmed;

  try {
    const url = new URL(trimmed);
    if (!url.hostname.includes('spotify.com')) return null;
    const parts = url.pathname.split('/').filter(Boolean);
    const validTypes = ['track', 'album', 'playlist', 'episode', 'show'];
    const typeIdx = parts.findIndex((p) => validTypes.includes(p));
    if (typeIdx !== -1 && parts[typeIdx + 1]) {
      return `spotify:${parts[typeIdx]}:${parts[typeIdx + 1]}`;
    }
  } catch {
    return null;
  }
  return null;
}

/** Convert canonical spotify:type:id URI into https://open.spotify.com/type/id */
export function spotifyUriToWebUrl(uri: string): string {
  if (uri.startsWith('http')) return uri;
  const parts = uri.split(':');
  if (parts.length >= 3) {
    return `https://open.spotify.com/${parts[1]}/${parts[2]}`;
  }
  return 'https://open.spotify.com/track/630DpnzdfjdVqv2yLfPbAX';
}

/** Fetch public track/playlist metadata via Spotify oEmbed API (CORS-enabled, no key needed) */
export async function fetchSpotifyOEmbedMeta(
  uriOrUrl: string
): Promise<{ title: string; thumbnailUrl: string } | null> {
  try {
    const webUrl = spotifyUriToWebUrl(uriOrUrl);
    const resp = await fetch(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(webUrl)}`
    );
    if (!resp.ok) return null;
    const data = (await resp.json()) as { title?: string; thumbnail_url?: string };
    return {
      title: data.title || 'Spotify Audio',
      thumbnailUrl:
        data.thumbnail_url ||
        'https://images.unsplash.com/photo-1614680376593-902f74cf0d41?auto=format&fit=crop&w=300&q=80'
    };
  } catch {
    return null;
  }
}

interface ItunesTrackRow {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  trackTimeMillis?: number;
}

/**
 * Clean noisy YouTube video suffixes/emojis before searching synced lyrics in LRCLIB
 */
export function cleanTrackMetaForLyrics(
  title: string,
  artist: string
): { title: string; artist: string } {
  const cleanTitle = (title || '')
    .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ')
    .replace(/\|.*$/g, ' ')
    .replace(/\b(official\s*(music\s*)?video|official\s*audio|lyric\s*video|lyrics?|mv|hd|hq|4k|full\s*song|viral\s*tiktok|jedag\s*jedug|fyp\s*tiktok|terbaru\s*20\d\d|rmx|remix|style\s*bootleg)\b/gi, ' ')
    .replace(/[!?.]{2,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const cleanArtist = (artist || '')
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/\b(official|channel)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    title: cleanTitle || title.trim(),
    artist: cleanArtist
  };
}

/**
 * Search songs via Next.js proxy -> /api/search?q={Judul Music}
 */
export async function searchMusicCatalog(
  query: string
): Promise<{ results: SpotifyTrackItem[]; error?: string }> {
  const q = query.trim();
  if (!q) return { results: SPOTIFY_STUDY_PRESETS };

  try {
    const resp = await fetch(`/api/music/search?q=${encodeURIComponent(q)}`, {
      cache: 'no-store'
    });
    const data = (await resp.json().catch(() => ({}))) as {
      results?: Array<{
        vid: string;
        title: string;
        artist: string;
        duration: number;
        thumb: string;
      }>;
      error?: string;
    };

    if (!resp.ok) {
      return {
        results: [],
        error: data.error || `Gagal mencari musik (HTTP ${resp.status}).`
      };
    }

    const rows = Array.isArray(data.results) ? data.results : [];
    const results: SpotifyTrackItem[] = rows
      .filter((r) => Boolean(r && r.vid))
      .map((r) => {
        const durationSec = Math.max(0, Number(r.duration) || 0);
        const durationMs = durationSec > 0 ? durationSec * 1000 : 180000;
        const thumbUrl =
          r.thumb || `https://i.ytimg.com/vi/${r.vid}/mqdefault.jpg`;

        return {
          id: `yt-${r.vid}`,
          title: r.title || 'Tanpa Judul',
          artist: r.artist || 'YouTube',
          album: 'YouTube Music',
          uri: '',
          url: `https://www.youtube.com/watch?v=${r.vid}`,
          coverUrl: thumbUrl,
          durationMs,
          durationSec,
          youtubeId: r.vid,
          sourceKind: 'youtube',
          searchQuery: q,
          isFullTrack: true,
          glowColor: '#EF4444'
        };
      });

    return {
      results,
      ...(data.error ? { error: data.error } : {})
    };
  } catch {
    return {
      results: [],
      error: 'Tidak dapat terhubung ke server pencarian musik.'
    };
  }
}

/**
 * Backward-compatible wrapper returning track array from searchMusicCatalog
 */
export async function searchSpotifyCatalog(query: string): Promise<SpotifyTrackItem[]> {
  const res = await searchMusicCatalog(query);
  return res.results;
}

/**
 * Notify backend /api/played telemetry when a track starts playing
 */
export async function reportTrackPlayed(
  track: SpotifyTrackItem,
  query?: string
): Promise<void> {
  if (!track.youtubeId) return;
  const duration =
    typeof track.durationSec === 'number'
      ? track.durationSec
      : Math.max(0, Math.round((track.durationMs || 0) / 1000));

  try {
    await fetch('/api/music/played', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        track: {
          vid: track.youtubeId,
          title: track.title,
          artist: track.artist,
          duration,
          thumb: track.coverUrl
        },
        query: (query || track.searchQuery || track.title).trim()
      })
    });
  } catch {
    // Non-blocking telemetry
  }
}

/** Resolve full-length direct audio stream for a track title + artist */
export async function resolveDirectAudioStream(
  title: string,
  artist: string
): Promise<{
  audioUrl?: string;
  coverUrl?: string;
  durationMs?: number;
  isFullTrack?: boolean;
} | null> {
  const q = `${title} ${artist}`.trim();

  // 1. Try full-length audio stream first (3-5 min full song)
  const fullItems = await fetchFullStreamCatalog(q, 5);
  if (fullItems.length > 0) {
    const exactMatch =
      fullItems.find(
        (item) =>
          item.title.toLowerCase().includes(title.toLowerCase()) &&
          (!artist || item.artist.toLowerCase().includes(artist.toLowerCase()))
      ) || fullItems[0];

    if (exactMatch?.audioUrl) {
      return {
        audioUrl: exactMatch.audioUrl,
        coverUrl: exactMatch.coverUrl,
        durationMs: exactMatch.durationMs,
        isFullTrack: true
      };
    }
  }

  // 2. Fallback to iTunes preview if full stream is unavailable
  try {
    const resp = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(
        q
      )}&media=music&entity=song&limit=1&country=ID`
    );
    if (!resp.ok) return null;
    const data = (await resp.json()) as { results?: ItunesTrackRow[] };
    const first = data.results?.[0];
    if (!first) return null;
    return {
      audioUrl: first.previewUrl,
      coverUrl: first.artworkUrl100?.replace('100x100bb', '400x400bb'),
      durationMs: 30000,
      isFullTrack: false
    };
  } catch {
    return null;
  }
}

// --- Spotify Official Embed iFrame API & YouTube IFrame Player API Loaders ---
export interface SpotifyEmbedController {
  loadUri: (uri: string) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (seconds: number) => void;
  addListener: (event: string, cb: (e: { data: Record<string, unknown> }) => void) => void;
  destroy?: () => void;
}

type SpotifyIframeApiObject = {
  createController: (
    el: HTMLElement,
    options: { uri: string; width?: string | number; height?: string | number },
    cb: (controller: SpotifyEmbedController) => void
  ) => void;
};

export interface YouTubePlayerController {
  loadVideoById: (
    videoId: string | { videoId: string; startSeconds?: number }
  ) => void;
  cueVideoById?: (
    videoId: string | { videoId: string; startSeconds?: number }
  ) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo?: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  setVolume: (volume: number) => void;
  getVolume?: () => number;
  mute?: () => void;
  unMute?: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  getIframe?: () => HTMLIFrameElement;
  destroy?: () => void;
}

export interface YouTubeIframeNamespace {
  Player: new (
    el: HTMLElement | string,
    options: {
      videoId?: string;
      width?: string | number;
      height?: string | number;
      playerVars?: Record<string, string | number | undefined>;
      events?: {
        onReady?: (event: { target: YouTubePlayerController }) => void;
        onStateChange?: (event: {
          target: YouTubePlayerController;
          data: number;
        }) => void;
        onError?: (event: {
          target: YouTubePlayerController;
          data: number;
        }) => void;
      };
    }
  ) => YouTubePlayerController;
  PlayerState?: {
    UNSTARTED: number;
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
    BUFFERING: number;
    CUED: number;
  };
}

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: SpotifyIframeApiObject) => void;
    __miuSpotifyIframeApi?: SpotifyIframeApiObject;
    onYouTubeIframeAPIReady?: () => void;
    YT?: YouTubeIframeNamespace;
  }
}

let iframeApiPromise: Promise<SpotifyIframeApiObject> | null = null;

export function loadSpotifyIframeApi(): Promise<SpotifyIframeApiObject> {
  if (window.__miuSpotifyIframeApi) {
    return Promise.resolve(window.__miuSpotifyIframeApi);
  }
  if (iframeApiPromise) return iframeApiPromise;

  iframeApiPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById('spotify-iframe-api');
    window.onSpotifyIframeApiReady = (IFrameAPI) => {
      window.__miuSpotifyIframeApi = IFrameAPI;
      resolve(IFrameAPI);
    };

    if (!existing) {
      const script = document.createElement('script');
      script.id = 'spotify-iframe-api';
      script.src = 'https://open.spotify.com/embed/iframe-api/v1';
      script.async = true;
      script.onerror = () => {
        iframeApiPromise = null;
        reject(new Error('Gagal memuat Spotify Embed API.'));
      };
      document.body.appendChild(script);
    }
  });

  return iframeApiPromise;
}

let ytIframeApiPromise: Promise<YouTubeIframeNamespace> | null = null;

export function loadYouTubeIframeApi(): Promise<YouTubeIframeNamespace> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('YouTube API hanya berjalan di browser.'));
  }
  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }
  if (ytIframeApiPromise) return ytIframeApiPromise;

  ytIframeApiPromise = new Promise((resolve, reject) => {
    let settled = false;
    const finish = (yt: YouTubeIframeNamespace) => {
      if (settled) return;
      settled = true;
      window.clearInterval(pollTimer);
      resolve(yt);
    };

    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prevReady === 'function') {
        try {
          prevReady();
        } catch {
          // ignore
        }
      }
      if (window.YT?.Player) {
        finish(window.YT);
      }
    };

    const pollTimer = window.setInterval(() => {
      if (window.YT?.Player) {
        finish(window.YT);
      }
    }, 100);

    const existing = document.getElementById('youtube-iframe-api');
    if (!existing) {
      const script = document.createElement('script');
      script.id = 'youtube-iframe-api';
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = () => {
        if (!settled) {
          settled = true;
          window.clearInterval(pollTimer);
          ytIframeApiPromise = null;
          reject(new Error('Gagal memuat YouTube IFrame API.'));
        }
      };
      document.body.appendChild(script);
    }
  });

  return ytIframeApiPromise;
}

/** Extract dominant vibrant color from album artwork for Ambient Glow */
export function extractDominantGlowColor(imageUrl: string, fallback = '#10B981'): Promise<string> {
  return new Promise((resolve) => {
    if (!imageUrl) {
      resolve(fallback);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(fallback);
          return;
        }
        ctx.drawImage(img, 0, 0, 16, 16);
        const data = ctx.getImageData(0, 0, 16, 16).data;
        let r = 0,
          g = 0,
          b = 0,
          count = 0;
        for (let i = 0; i < data.length; i += 4) {
          const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          if (lum > 35 && lum < 230) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            count++;
          }
        }
        if (count === 0) {
          resolve(fallback);
          return;
        }
        resolve(
          `rgb(${Math.round(r / count)}, ${Math.round(g / count)}, ${Math.round(b / count)})`
        );
      } catch {
        resolve(fallback);
      }
    };
    img.onerror = () => resolve(fallback);
    img.src = imageUrl;
  });
}
