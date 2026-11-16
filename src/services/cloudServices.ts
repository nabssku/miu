import type { NoteComment, NoteRecord } from '../types/miu';

export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  picture: string;
  provider: 'google';
  loginAt: number;
}

export interface CloudStatus {
  dbReady: boolean;
  mediaReady: boolean;
  aiReady: boolean;
  aiModel: string;
  googleClientId: string;
  elevenlabsReady: boolean;
  elevenlabsVoiceId: string;
  elevenlabsModelId: string;
  synced: boolean;
}

export interface CloudConfig {
  googleClientId: string;
}

const STORAGE_KEYS = {
  USER: 'miu_google_user_v1'
};

let cachedStatus: CloudStatus = {
  dbReady: true,
  mediaReady: true,
  aiReady: true,
  aiModel: 'qwen/qwen3.8-27b',
  googleClientId: (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '').trim(),
  elevenlabsReady: false,
  elevenlabsVoiceId: 'JBFqnCBsd6RMkjVDRZzb',
  elevenlabsModelId: 'eleven_flash_v2_5',
  synced: false
};

let statusFetchPromise: Promise<CloudStatus> | null = null;

export async function syncCloudStatus(force = false): Promise<CloudStatus> {
  if (typeof window === 'undefined') return cachedStatus;
  if (cachedStatus.synced && !force) return cachedStatus;
  if (statusFetchPromise && !force) return statusFetchPromise;

  statusFetchPromise = fetch('/api/cloud/status', { cache: 'no-store' })
    .then(async (res) => {
      if (!res.ok) throw new Error('Status unavailable');
      const data = (await res.json()) as Partial<CloudStatus>;
      cachedStatus = {
        dbReady: Boolean(data.dbReady),
        mediaReady: Boolean(data.mediaReady),
        aiReady: Boolean(data.aiReady),
        aiModel: data.aiModel || 'qwen/qwen3.8-27b',
        googleClientId:
          (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '').trim() ||
          String(data.googleClientId || '').trim(),
        elevenlabsReady: Boolean(data.elevenlabsReady),
        elevenlabsVoiceId: data.elevenlabsVoiceId || 'JBFqnCBsd6RMkjVDRZzb',
        elevenlabsModelId: data.elevenlabsModelId || 'eleven_flash_v2_5',
        synced: true
      };
      return cachedStatus;
    })
    .catch(() => cachedStatus)
    .finally(() => {
      statusFetchPromise = null;
    });

  return statusFetchPromise;
}

export function getCloudStatusSnapshot(): CloudStatus {
  return cachedStatus;
}

export function getCloudConfig(): CloudConfig {
  return {
    googleClientId:
      (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '').trim() || cachedStatus.googleClientId
  };
}

export function getStoredGoogleUser(): GoogleUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.USER);
    if (!raw) return null;
    return JSON.parse(raw) as GoogleUser;
  } catch {
    return null;
  }
}

export function setStoredGoogleUser(user: GoogleUser | null): void {
  if (typeof window === 'undefined') return;
  if (!user) {
    window.localStorage.removeItem(STORAGE_KEYS.USER);
  } else {
    window.localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  }
}

export function isNeonConfigured(): boolean {
  return cachedStatus.dbReady;
}

export function isCloudinaryConfigured(): boolean {
  return cachedStatus.mediaReady;
}

export async function ensureNeonSchema(): Promise<boolean> {
  try {
    const res = await fetch('/api/cloud/status', {
      method: 'POST',
      cache: 'no-store'
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { ok?: boolean };
    cachedStatus = { ...cachedStatus, dbReady: Boolean(data.ok), synced: true };
    return Boolean(data.ok);
  } catch {
    return false;
  }
}

export async function upsertUserToNeon(user: GoogleUser): Promise<boolean> {
  try {
    const res = await fetch('/api/cloud/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { ok?: boolean };
    return Boolean(data.ok);
  } catch (err) {
    console.warn('[Cloud Catatan] Gagal menyimpan user:', err);
    return false;
  }
}

export async function fetchNotesFromNeon(
  userId: string,
  userEmail = ''
): Promise<NoteRecord[] | null> {
  if (!userId) return null;
  try {
    const params = new URLSearchParams({ userId });
    if (userEmail.trim()) params.set('userEmail', userEmail.trim());
    const res = await fetch(`/api/notes?${params.toString()}`, {
      cache: 'no-store'
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { notes?: NoteRecord[] | null };
    return data.notes ?? null;
  } catch (err) {
    console.warn('[Cloud Catatan] Gagal memuat catatan:', err);
    return null;
  }
}

export async function fetchSharedNoteByIdFromNeon(
  noteId: string,
  viewerUserId = '',
  viewerEmail = ''
): Promise<NoteRecord[] | null> {
  if (!noteId) return null;
  try {
    const params = new URLSearchParams({ shareId: noteId });
    if (viewerUserId) params.set('userId', viewerUserId);
    if (viewerEmail.trim()) params.set('userEmail', viewerEmail.trim());
    const res = await fetch(`/api/notes?${params.toString()}`, {
      cache: 'no-store'
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { notes?: NoteRecord[] | null };
    return data.notes ?? null;
  } catch (err) {
    console.warn('[Cloud Catatan] Gagal memuat catatan bersama:', err);
    return null;
  }
}

export async function saveNoteCommentsToNeon(
  noteId: string,
  comments: NoteComment[]
): Promise<boolean> {
  try {
    const viewer = getStoredGoogleUser();
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save-comments',
        noteId,
        comments,
        userId: viewer?.id || '',
        userEmail: viewer?.email || ''
      })
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { ok?: boolean };
    return Boolean(data.ok);
  } catch (err) {
    console.warn('[Cloud Catatan] Gagal menyimpan komentar catatan:', err);
    return false;
  }
}

export async function saveNoteToNeon(userId: string, note: NoteRecord): Promise<boolean> {
  if (!userId) return false;
  try {
    const viewer = getStoredGoogleUser();
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save-note',
        userId,
        userEmail: viewer?.email || '',
        note
      })
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { ok?: boolean };
    return Boolean(data.ok);
  } catch (err) {
    console.warn('[Cloud Catatan] Gagal menyimpan catatan:', err);
    return false;
  }
}

export async function deleteNoteFromNeon(userId: string, noteId: string): Promise<boolean> {
  if (!userId || !noteId) return false;
  try {
    const params = new URLSearchParams({ noteId, userId });
    const res = await fetch(`/api/notes?${params.toString()}`, {
      method: 'DELETE'
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { ok?: boolean };
    return Boolean(data.ok);
  } catch (err) {
    console.warn('[Cloud Catatan] Gagal menghapus catatan:', err);
    return false;
  }
}

function fileOrBlobToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Gagal membaca file media.'));
    reader.readAsDataURL(file);
  });
}

export async function uploadImageToCloudinary(
  source: File | Blob | string
): Promise<{ url: string; isCloudinary: boolean }> {
  try {
    if (typeof source === 'string') {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl: source })
      });
      if (res.ok) {
        return (await res.json()) as { url: string; isCloudinary: boolean };
      }
      return { url: source, isCloudinary: false };
    }

    const formData = new FormData();
    formData.append('file', source);
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    if (!res.ok) {
      const errData = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(errData.error || `Gagal mengunggah media (${res.status}).`);
    }
    return (await res.json()) as { url: string; isCloudinary: boolean };
  } catch (err) {
    if (typeof source === 'string') {
      return { url: source, isCloudinary: false };
    }
    if (err instanceof Error && err.message.includes('Gagal mengunggah')) {
      throw err;
    }
    const dataUrl = await fileOrBlobToDataUrl(source);
    return { url: dataUrl, isCloudinary: false };
  }
}

// ============================================================================
// GOOGLE OAUTH 2.0 (GOOGLE IDENTITY SERVICES)
// ============================================================================

interface GoogleTokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
}

export interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: GoogleTokenResponse) => void;
          }) => GoogleTokenClient;
          revoke?: (token: string, done?: () => void) => void;
        };
      };
    };
  }
}

let gsiScriptPromise: Promise<void> | null = null;

export function loadGoogleIdentityScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gsiScriptPromise) return gsiScriptPromise;

  gsiScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Gagal memuat Google Auth SDK.')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Gagal memuat Google Identity Services SDK.'));
    document.head.appendChild(script);
  });

  return gsiScriptPromise;
}

export async function signInWithGoogleOAuth(): Promise<GoogleUser> {
  if (!getCloudConfig().googleClientId) {
    await syncCloudStatus(true);
  }
  const { googleClientId } = getCloudConfig();
  if (!googleClientId) {
    throw new Error('GOOGLE_CLIENT_ID_MISSING');
  }

  await loadGoogleIdentityScript();

  return new Promise((resolve, reject) => {
    const oauth2 = window.google?.accounts?.oauth2;
    if (!oauth2) {
      reject(new Error('Google OAuth SDK tidak tersedia.'));
      return;
    }

    const client = oauth2.initTokenClient({
      client_id: googleClientId,
      scope: 'openid email profile',
      callback: async (tokenResponse) => {
        if (tokenResponse.error || !tokenResponse.access_token) {
          reject(new Error(tokenResponse.error || 'Login Google dibatalkan.'));
          return;
        }
        try {
          const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
          });
          if (!profileRes.ok) {
            throw new Error('Gagal mengambil profil akun Google.');
          }
          const profile = (await profileRes.json()) as {
            sub: string;
            email: string;
            name: string;
            picture?: string;
          };

          const user: GoogleUser = {
            id: profile.sub || profile.email,
            email: profile.email,
            name: profile.name || profile.email.split('@')[0],
            picture:
              profile.picture ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(
                profile.name || 'User'
              )}&background=0284c7&color=fff`,
            provider: 'google',
            loginAt: Date.now()
          };
          resolve(user);
        } catch (err) {
          reject(err instanceof Error ? err : new Error('Gagal memproses login Google.'));
        }
      }
    });

    client.requestAccessToken({ prompt: 'select_account' });
  });
}
