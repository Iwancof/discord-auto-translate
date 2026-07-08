import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildBatchButtonCustomId,
  ButtonBatcher,
  parseBatchButtonCustomId,
  type FlushedBatch
} from '../src/buttonBatcher.js';

describe('ButtonBatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function collect(): { flushed: FlushedBatch<string>[]; batcher: ButtonBatcher<string> } {
    const flushed: FlushedBatch<string>[] = [];
    const batcher = new ButtonBatcher<string>(5000, (b) => flushed.push(b));
    return { flushed, batcher };
  }

  it('flushes a single message after the window elapses', () => {
    const { flushed, batcher } = collect();
    batcher.add('ch1', 'user1', 'm1', 'hello there friend', 'p1');
    vi.advanceTimersByTime(4999);
    expect(flushed).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(flushed).toHaveLength(1);
    expect(flushed[0]).toMatchObject({
      channelId: 'ch1',
      authorId: 'user1',
      firstMessageId: 'm1',
      lastMessageId: 'm1',
      count: 1,
      texts: ['hello there friend'],
      lastPayload: 'p1'
    });
  });

  it('aggregates consecutive messages and resets the timer on each add', () => {
    const { flushed, batcher } = collect();
    batcher.add('ch1', 'user1', 'm1', 'first', 'p1');
    vi.advanceTimersByTime(4000);
    batcher.add('ch1', 'user1', 'm2', 'second', 'p2');
    vi.advanceTimersByTime(4000);
    expect(flushed).toHaveLength(0);
    batcher.add('ch1', 'user1', 'm3', 'third', 'p3');
    vi.advanceTimersByTime(5000);
    expect(flushed).toHaveLength(1);
    expect(flushed[0]).toMatchObject({
      firstMessageId: 'm1',
      lastMessageId: 'm3',
      count: 3,
      texts: ['first', 'second', 'third'],
      lastPayload: 'p3'
    });
  });

  it('keeps different authors in separate batches', () => {
    const { flushed, batcher } = collect();
    batcher.add('ch1', 'user1', 'm1', 'from user1', 'p1');
    batcher.add('ch1', 'user2', 'm2', 'from user2', 'p2');
    vi.advanceTimersByTime(5000);
    expect(flushed).toHaveLength(2);
    expect(flushed.map((b) => b.authorId).sort()).toEqual(['user1', 'user2']);
    expect(flushed.every((b) => b.count === 1)).toBe(true);
  });

  it('keeps different channels in separate batches', () => {
    const { flushed, batcher } = collect();
    batcher.add('ch1', 'user1', 'm1', 'in ch1', 'p1');
    batcher.add('ch2', 'user1', 'm2', 'in ch2', 'p2');
    vi.advanceTimersByTime(5000);
    expect(flushed).toHaveLength(2);
    expect(flushed.map((b) => b.channelId).sort()).toEqual(['ch1', 'ch2']);
  });

  it('starts a fresh batch after a flush', () => {
    const { flushed, batcher } = collect();
    batcher.add('ch1', 'user1', 'm1', 'first burst', 'p1');
    vi.advanceTimersByTime(5000);
    batcher.add('ch1', 'user1', 'm2', 'second burst', 'p2');
    vi.advanceTimersByTime(5000);
    expect(flushed).toHaveLength(2);
    expect(flushed[1]).toMatchObject({ firstMessageId: 'm2', count: 1 });
  });

  it('reports pendingCount', () => {
    const { batcher } = collect();
    expect(batcher.pendingCount).toBe(0);
    batcher.add('ch1', 'user1', 'm1', 'a', 'p');
    batcher.add('ch2', 'user2', 'm2', 'b', 'p');
    expect(batcher.pendingCount).toBe(2);
    vi.advanceTimersByTime(5000);
    expect(batcher.pendingCount).toBe(0);
  });
});

describe('batch button customId', () => {
  it('round-trips through build and parse', () => {
    const id = buildBatchButtonCustomId('111', '222', '333');
    expect(parseBatchButtonCustomId(id)).toEqual({
      authorId: '111',
      firstMessageId: '222',
      lastMessageId: '333'
    });
  });

  it('stays within the 100-char customId limit for snowflakes', () => {
    const id = buildBatchButtonCustomId('9'.repeat(20), '9'.repeat(20), '9'.repeat(20));
    expect(id.length).toBeLessThanOrEqual(100);
  });

  it('rejects malformed customIds', () => {
    expect(parseBatchButtonCustomId('trb:1:2')).toBeNull();
    expect(parseBatchButtonCustomId('tr:123')).toBeNull();
    expect(parseBatchButtonCustomId('trb:a:b:c')).toBeNull();
  });
});
