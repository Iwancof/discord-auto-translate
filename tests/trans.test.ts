import { describe, expect, it } from 'vitest';
import { parseMessageTarget, trimToLimit } from '../src/commands/trans.js';

describe('parseMessageTarget', () => {
  it('parses a Discord message link', () => {
    expect(
      parseMessageTarget('https://discord.com/channels/111/222/333')
    ).toBe('333');
  });

  it('parses a raw numeric ID', () => {
    expect(parseMessageTarget('1234567890')).toBe('1234567890');
  });

  it('returns null for invalid input', () => {
    expect(parseMessageTarget('not-a-link')).toBeNull();
  });

  it('returns null for partial link', () => {
    expect(parseMessageTarget('https://discord.com/channels/111/222')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseMessageTarget('')).toBeNull();
  });
});

describe('trimToLimit', () => {
  it('returns joined lines when within limit', () => {
    const lines = ['line1', 'line2', 'line3'];
    expect(trimToLimit(lines, 100)).toBe('line1\nline2\nline3');
  });

  it('trims from oldest and adds omission notice', () => {
    const lines = [
      '**Alice**: Hello everyone',
      '**Bob**: How are you doing today',
      '**Charlie**: I am fine thanks'
    ];
    const result = trimToLimit(lines, 60);
    expect(result).toContain('omitted');
    expect(result).toContain('**Charlie**: I am fine thanks');
    expect(result).not.toContain('**Alice**');
  });

  it('preserves single line even if over limit', () => {
    const lines = ['a'.repeat(50)];
    const result = trimToLimit(lines, 30);
    expect(result.length).toBeLessThanOrEqual(30);
  });

  it('handles empty array', () => {
    expect(trimToLimit([], 100)).toBe('');
  });
});
