export interface FlushedBatch<T> {
  channelId: string;
  authorId: string;
  firstMessageId: string;
  lastMessageId: string;
  count: number;
  texts: string[];
  lastPayload: T;
}

interface PendingEntry<T> {
  batch: FlushedBatch<T>;
  timer: ReturnType<typeof setTimeout>;
}

// Debounces translate-button posting per (channel, author): consecutive
// messages within the window collapse into one batch and get a single button.
export class ButtonBatcher<T = unknown> {
  private pending = new Map<string, PendingEntry<T>>();

  constructor(
    private windowMs: number,
    private onFlush: (batch: FlushedBatch<T>) => void
  ) {}

  add(channelId: string, authorId: string, messageId: string, text: string, payload: T): void {
    const key = `${channelId}:${authorId}`;
    const existing = this.pending.get(key);
    if (existing) {
      clearTimeout(existing.timer);
      existing.batch.lastMessageId = messageId;
      existing.batch.count += 1;
      existing.batch.texts.push(text);
      existing.batch.lastPayload = payload;
      existing.timer = setTimeout(() => this.flush(key), this.windowMs);
      return;
    }

    const batch: FlushedBatch<T> = {
      channelId,
      authorId,
      firstMessageId: messageId,
      lastMessageId: messageId,
      count: 1,
      texts: [text],
      lastPayload: payload
    };
    this.pending.set(key, { batch, timer: setTimeout(() => this.flush(key), this.windowMs) });
  }

  private flush(key: string): void {
    const entry = this.pending.get(key);
    if (!entry) return;
    this.pending.delete(key);
    this.onFlush(entry.batch);
  }

  get pendingCount(): number {
    return this.pending.size;
  }
}

export const BATCH_BUTTON_PREFIX = 'trb:';

export interface BatchButtonRef {
  authorId: string;
  firstMessageId: string;
  lastMessageId: string;
}

export function buildBatchButtonCustomId(
  authorId: string,
  firstMessageId: string,
  lastMessageId: string
): string {
  return `${BATCH_BUTTON_PREFIX}${authorId}:${firstMessageId}:${lastMessageId}`;
}

export function parseBatchButtonCustomId(customId: string): BatchButtonRef | null {
  const match = customId.match(/^trb:(\d+):(\d+):(\d+)$/);
  if (!match) return null;
  return { authorId: match[1], firstMessageId: match[2], lastMessageId: match[3] };
}
