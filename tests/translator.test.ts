import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createMock = vi.hoisted(() => vi.fn());
const constructorMock = vi.hoisted(() => vi.fn());

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = {
      create: createMock
    };

    constructor(options: unknown) {
      constructorMock(options);
    }
  }
}));

import { buildSystemPrompt, buildUserContent, translate } from '../src/translator.js';

describe('buildSystemPrompt / buildUserContent', () => {
  it('includes context, preservation rules, and the SKIP instruction', () => {
    const system = buildSystemPrompt('en');
    const user = buildUserContent('明日いける?', 'en', [
      { authorName: 'Alice', content: 'Are we meeting tomorrow?' }
    ]);

    expect(system).toContain('Preserve tone, mentions, emoji, and line breaks');
    expect(system).toContain('output exactly SKIP');
    expect(system).toContain('English translation');
    expect(user).toContain('Alice: Are we meeting tomorrow?');
    expect(user).toContain('Target language: English');
  });

  it('uses Korean language name for ko target', () => {
    const system = buildSystemPrompt('ko');
    const user = buildUserContent('Hello there', 'ko', []);

    expect(system).toContain('Korean translation');
    expect(user).toContain('Target language: Korean');
  });
});

describe('translate', () => {
  beforeEach(() => {
    createMock.mockReset();
    constructorMock.mockClear();
    process.env.ANTHROPIC_API_KEY = 'test-key';
    process.env.ANTHROPIC_MODEL = 'test-model';
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_MODEL;
  });

  it('uses ANTHROPIC_MODEL and returns null when the model outputs SKIP', async () => {
    createMock.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'SKIP' }]
    });

    await expect(translate('lol', 'ja', [])).resolves.toBeNull();
    expect(constructorMock).toHaveBeenCalledWith(
      expect.objectContaining({ timeout: 10_000, maxRetries: 0 })
    );
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'test-model' })
    );
  });

  it('retries once after a failed API request', async () => {
    createMock
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({ content: [{ type: 'text', text: '了解です' }] });

    await expect(translate('Got it', 'ja', [])).resolves.toBe('了解です');
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  it('throws after two consecutive failures', async () => {
    createMock
      .mockRejectedValueOnce(new Error('first failure'))
      .mockRejectedValueOnce(new Error('second failure'));

    await expect(translate('Hello', 'ja', [])).rejects.toThrow('second failure');
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  it('returns null for empty text response', async () => {
    createMock.mockResolvedValueOnce({
      content: [{ type: 'text', text: '' }]
    });

    await expect(translate('test', 'ja', [])).resolves.toBeNull();
  });

  it('uses default model when ANTHROPIC_MODEL is unset', async () => {
    delete process.env.ANTHROPIC_MODEL;
    createMock.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'translated' }]
    });

    await translate('Hello', 'ja', []);
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-haiku-4-5' })
    );
  });
});
