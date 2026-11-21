export interface AIChatThreadMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  attachmentLabel?: string;
  createdAt: number;
}

export interface AIChatThread {
  id: string;
  title: string;
  messages: AIChatThreadMessage[];
  model: string;
  createdAt: number;
  updatedAt: number;
}

interface LegacyChatHistoryItem {
  id?: unknown;
  title?: unknown;
  response?: unknown;
  model?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  messages?: unknown;
}

export function normalizeStoredAIChatThreads(raw: unknown): AIChatThread[] {
  if (!Array.isArray(raw)) return [];
  const normalized: AIChatThread[] = [];

  for (let i = 0; i < raw.length; i++) {
    const item = raw[i] as LegacyChatHistoryItem | null;
    if (!item || typeof item !== 'object') continue;

    const id =
      typeof item.id === 'string' && item.id.trim()
        ? item.id
        : `chat-legacy-${i}-${Date.now()}`;
    const createdAt =
      typeof item.createdAt === 'number' && Number.isFinite(item.createdAt)
        ? item.createdAt
        : Date.now();
    const updatedAt =
      typeof item.updatedAt === 'number' && Number.isFinite(item.updatedAt)
        ? item.updatedAt
        : createdAt;
    const model = typeof item.model === 'string' ? item.model : 'groq';
    const title =
      typeof item.title === 'string' && item.title.trim()
        ? item.title.trim()
        : 'Obrolan AI';

    if (Array.isArray(item.messages)) {
      const validMessages: AIChatThreadMessage[] = item.messages
        .filter(
          (m): m is AIChatThreadMessage =>
            Boolean(m) &&
            typeof m === 'object' &&
            ((m as AIChatThreadMessage).role === 'user' ||
              (m as AIChatThreadMessage).role === 'assistant') &&
            typeof (m as AIChatThreadMessage).content === 'string'
        )
        .map((m, mIdx) => ({
          id: typeof m.id === 'string' && m.id ? m.id : `${id}-m-${mIdx}`,
          role: m.role,
          content: m.content,
          model: typeof m.model === 'string' ? m.model : model,
          attachmentLabel:
            typeof m.attachmentLabel === 'string' ? m.attachmentLabel : undefined,
          createdAt:
            typeof m.createdAt === 'number' && Number.isFinite(m.createdAt)
              ? m.createdAt
              : createdAt
        }));

      if (validMessages.length > 0) {
        normalized.push({
          id,
          title,
          messages: validMessages,
          model,
          createdAt,
          updatedAt
        });
      }
      continue;
    }

    if (typeof item.response === 'string' && item.response.trim()) {
      normalized.push({
        id,
        title,
        model,
        createdAt,
        updatedAt,
        messages: [
          {
            id: `${id}-u`,
            role: 'user',
            content: title,
            createdAt
          },
          {
            id: `${id}-a`,
            role: 'assistant',
            content: item.response,
            model,
            createdAt: createdAt + 1
          }
        ]
      });
    }
  }

  return normalized.slice(0, 25);
}
