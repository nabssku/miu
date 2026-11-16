export interface ParsedVideoEmbed {
  kind: 'youtube' | 'vimeo' | 'gdrive' | 'loom' | 'video' | 'invalid';
  providerLabel: string;
  embedUrl: string;
  originalUrl: string;
}

function parseYouTubeStartSeconds(raw: string | null): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const match = trimmed.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/i);
  if (!match) return null;
  const h = Number(match[1] || 0);
  const m = Number(match[2] || 0);
  const s = Number(match[3] || 0);
  const total = h * 3600 + m * 60 + s;
  return total > 0 ? total : null;
}

export function parseVideoEmbedUrl(rawInput: string): ParsedVideoEmbed {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { kind: 'invalid', providerLabel: 'URL Kosong', embedUrl: '', originalUrl: '' };
  }

  let normalized = trimmed;
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return { kind: 'invalid', providerLabel: 'URL Tidak Valid', embedUrl: '', originalUrl: trimmed };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { kind: 'invalid', providerLabel: 'Protokol Tidak Didukung', embedUrl: '', originalUrl: trimmed };
  }

  const host = parsed.hostname.toLowerCase();
  const pathParts = parsed.pathname.split('/').filter(Boolean);

  // YouTube (youtube.com, youtu.be, m.youtube.com, music.youtube.com, shorts, live, embed)
  if (
    host === 'youtu.be' ||
    host.endsWith('.youtube.com') ||
    host === 'youtube.com' ||
    host.endsWith('.youtube-nocookie.com') ||
    host === 'youtube-nocookie.com'
  ) {
    let videoId = '';
    if (host === 'youtu.be') {
      videoId = pathParts[0] || '';
    } else if (parsed.searchParams.get('v')) {
      videoId = parsed.searchParams.get('v') || '';
    } else if (
      pathParts[0] &&
      ['embed', 'shorts', 'live', 'v'].includes(pathParts[0]) &&
      pathParts[1]
    ) {
      videoId = pathParts[1];
    }

    const cleanId = videoId.replace(/[^a-zA-Z0-9_-]/g, '');
    if (cleanId.length >= 6) {
      const startSec =
        parseYouTubeStartSeconds(parsed.searchParams.get('t')) ||
        parseYouTubeStartSeconds(parsed.searchParams.get('start'));
      const embedUrl = startSec
        ? `https://www.youtube.com/embed/${cleanId}?start=${startSec}&rel=0`
        : `https://www.youtube.com/embed/${cleanId}?rel=0`;
      return {
        kind: 'youtube',
        providerLabel: 'YouTube',
        embedUrl,
        originalUrl: normalized
      };
    }
  }

  // Vimeo (vimeo.com/<id> or player.vimeo.com/video/<id>)
  if (host === 'vimeo.com' || host === 'www.vimeo.com' || host === 'player.vimeo.com') {
    const idMatch = parsed.pathname.match(/(\d{5,15})/);
    if (idMatch) {
      return {
        kind: 'vimeo',
        providerLabel: 'Vimeo',
        embedUrl: `https://player.vimeo.com/video/${idMatch[1]}`,
        originalUrl: normalized
      };
    }
  }

  // Google Drive shared video preview
  if (host === 'drive.google.com') {
    const driveMatch = parsed.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (driveMatch) {
      return {
        kind: 'gdrive',
        providerLabel: 'Google Drive',
        embedUrl: `https://drive.google.com/file/d/${driveMatch[1]}/preview`,
        originalUrl: normalized
      };
    }
  }

  // Loom share link
  if (host === 'www.loom.com' || host === 'loom.com') {
    if ((pathParts[0] === 'share' || pathParts[0] === 'embed') && pathParts[1]) {
      return {
        kind: 'loom',
        providerLabel: 'Loom',
        embedUrl: `https://www.loom.com/embed/${pathParts[1]}`,
        originalUrl: normalized
      };
    }
  }

  // Direct HTML5 video URL or streaming asset
  return {
    kind: 'video',
    providerLabel: 'Video URL',
    embedUrl: normalized,
    originalUrl: normalized
  };
}
