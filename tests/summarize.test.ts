import { describe, expect, it } from 'vitest';
import { buildTranscript, type TranscriptMessage } from '../src/commands/summarize.js';

describe('buildTranscript', () => {
  it('formats messages as [username] content lines', () => {
    const msgs: TranscriptMessage[] = [
      { author: { username: 'Alice' }, content: 'Hello everyone' },
      { author: { username: 'Bob' }, content: 'Hi Alice!' }
    ];
    expect(buildTranscript(msgs)).toBe('[Alice] Hello everyone\n[Bob] Hi Alice!');
  });

  it('returns empty string for no messages', () => {
    expect(buildTranscript([])).toBe('');
  });

  it('handles single message', () => {
    const msgs: TranscriptMessage[] = [
      { author: { username: 'User' }, content: 'Just me here' }
    ];
    expect(buildTranscript(msgs)).toBe('[User] Just me here');
  });

  it('preserves multiline content', () => {
    const msgs: TranscriptMessage[] = [
      { author: { username: 'Dev' }, content: 'line1\nline2\nline3' }
    ];
    expect(buildTranscript(msgs)).toBe('[Dev] line1\nline2\nline3');
  });

  it('excludes nothing (caller is responsible for filtering)', () => {
    const msgs: TranscriptMessage[] = [
      { author: { username: 'Bot' }, content: 'bot message' },
      { author: { username: 'User' }, content: 'user message' }
    ];
    expect(buildTranscript(msgs)).toContain('Bot');
    expect(buildTranscript(msgs)).toContain('User');
  });
});
