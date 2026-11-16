'use client';

import {
  getCloudConfig,
  loadGoogleIdentityScript,
  syncCloudStatus
} from './cloudServices';

const GCAL_TOKEN_STORAGE = 'miu_google_calendar_token_v1';
const GCAL_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

interface StoredCalendarToken {
  accessToken: string;
  expiresAt: number;
}

export interface GoogleCalendarEventItem {
  id: string;
  summary: string;
  description?: string;
  startDate: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  isAllDay: boolean;
  htmlLink?: string;
}

export function formatLocalYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysToYYYYMMDD(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return formatLocalYYYYMMDD(dt);
}

export function getStoredCalendarToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(GCAL_TOKEN_STORAGE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredCalendarToken;
    if (!parsed.accessToken || !parsed.expiresAt || Date.now() >= parsed.expiresAt - 30000) {
      window.localStorage.removeItem(GCAL_TOKEN_STORAGE);
      return null;
    }
    return parsed.accessToken;
  } catch {
    return null;
  }
}

export function clearStoredCalendarToken(): void {
  if (typeof window === 'undefined') return;
  try {
    const token = getStoredCalendarToken();
    if (token && window.google?.accounts?.oauth2?.revoke) {
      window.google.accounts.oauth2.revoke(token);
    }
    window.localStorage.removeItem(GCAL_TOKEN_STORAGE);
  } catch {
    // ignore
  }
}

export async function authorizeGoogleCalendar(
  promptMode: '' | 'consent' | 'select_account' = 'consent'
): Promise<string> {
  if (!getCloudConfig().googleClientId) {
    await syncCloudStatus(true);
  }
  const { googleClientId } = getCloudConfig();
  if (!googleClientId) {
    throw new Error('NEXT_PUBLIC_GOOGLE_CLIENT_ID belum dikonfigurasi di environment.');
  }

  await loadGoogleIdentityScript();

  return new Promise((resolve, reject) => {
    const oauth2 = window.google?.accounts?.oauth2;
    if (!oauth2) {
      reject(new Error('Google Identity Services SDK tidak tersedia.'));
      return;
    }

    const client = oauth2.initTokenClient({
      client_id: googleClientId,
      scope: GCAL_SCOPE,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error || 'Izin Google Calendar dibatalkan.'));
          return;
        }
        const ttlSec = Math.max(600, Number(resp.expires_in) || 3500);
        const stored: StoredCalendarToken = {
          accessToken: resp.access_token,
          expiresAt: Date.now() + ttlSec * 1000
        };
        try {
          window.localStorage.setItem(GCAL_TOKEN_STORAGE, JSON.stringify(stored));
        } catch {
          // ignore
        }
        resolve(resp.access_token);
      }
    });

    client.requestAccessToken({ prompt: promptMode });
  });
}

function parseGoogleApiError(status: number, body: { error?: { message?: string } }): Error {
  if (status === 401) {
    clearStoredCalendarToken();
    return new Error('Sesi Google Calendar kedaluwarsa. Klik Hubungkan Ulang.');
  }
  if (status === 403) {
    return new Error(
      `Akses Google Calendar ditolak (403): ${
        body.error?.message ||
        'Pastikan Google Calendar API sudah diaktifkan di Google Cloud Console.'
      }`
    );
  }
  return new Error(body.error?.message || `Google Calendar Error (${status})`);
}

export async function fetchGoogleCalendarEvents(
  accessToken: string,
  timeMinIso: string,
  timeMaxIso: string
): Promise<GoogleCalendarEventItem[]> {
  const params = new URLSearchParams({
    timeMin: timeMinIso,
    timeMax: timeMaxIso,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250'
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      cache: 'no-store'
    }
  );

  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw parseGoogleApiError(res.status, errBody);
  }

  const data = (await res.json()) as {
    items?: Array<{
      id: string;
      summary?: string;
      description?: string;
      htmlLink?: string;
      start?: { date?: string; dateTime?: string };
    }>;
  };

  return (data.items || []).map((ev) => {
    const rawDateTime = ev.start?.dateTime;
    if (rawDateTime) {
      const parsed = new Date(rawDateTime);
      const startDate = formatLocalYYYYMMDD(parsed);
      const hh = String(parsed.getHours()).padStart(2, '0');
      const mm = String(parsed.getMinutes()).padStart(2, '0');
      return {
        id: ev.id,
        summary: ev.summary || '(Tanpa Judul)',
        description: ev.description || '',
        startDate,
        startTime: `${hh}:${mm}`,
        isAllDay: false,
        htmlLink: ev.htmlLink || ''
      };
    }

    return {
      id: ev.id,
      summary: ev.summary || '(Tanpa Judul)',
      description: ev.description || '',
      startDate: ev.start?.date || formatLocalYYYYMMDD(new Date()),
      isAllDay: true,
      htmlLink: ev.htmlLink || ''
    };
  });
}

export async function upsertGoogleCalendarEvent(
  accessToken: string,
  params: {
    title: string;
    description?: string;
    dueDate: string; // YYYY-MM-DD
    dueTime?: string; // HH:mm
    existingEventId?: string;
  }
): Promise<{ eventId: string; htmlLink: string }> {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jakarta';
  let start: Record<string, string>;
  let end: Record<string, string>;

  if (params.dueTime && /^\d{2}:\d{2}$/.test(params.dueTime.trim())) {
    const [y, m, d] = params.dueDate.split('-').map(Number);
    const [hh, mm] = params.dueTime.trim().split(':').map(Number);
    const startDt = new Date(y, (m || 1) - 1, d || 1, hh || 9, mm || 0, 0);
    const endDt = new Date(startDt.getTime() + 60 * 60 * 1000);
    start = { dateTime: startDt.toISOString(), timeZone };
    end = { dateTime: endDt.toISOString(), timeZone };
  } else {
    start = { date: params.dueDate };
    end = { date: addDaysToYYYYMMDD(params.dueDate, 1) };
  }

  const eventPayload = {
    summary: params.title.trim() || 'Deadline Catatan Miu',
    description: params.description || 'Disinkronkan dari Catatan Miu Workspace.',
    start,
    end
  };

  if (params.existingEventId?.trim()) {
    const patchRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(
        params.existingEventId.trim()
      )}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(eventPayload)
      }
    );

    if (patchRes.ok) {
      const updated = (await patchRes.json()) as { id: string; htmlLink?: string };
      return { eventId: updated.id, htmlLink: updated.htmlLink || '' };
    }
    if (patchRes.status !== 404 && patchRes.status !== 410) {
      const errBody = (await patchRes.json().catch(() => ({}))) as { error?: { message?: string } };
      throw parseGoogleApiError(patchRes.status, errBody);
    }
  }

  const createRes = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(eventPayload)
    }
  );

  if (!createRes.ok) {
    const errBody = (await createRes.json().catch(() => ({}))) as { error?: { message?: string } };
    throw parseGoogleApiError(createRes.status, errBody);
  }

  const created = (await createRes.json()) as { id: string; htmlLink?: string };
  return { eventId: created.id, htmlLink: created.htmlLink || '' };
}
