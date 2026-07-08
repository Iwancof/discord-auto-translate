import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createMock = vi.hoisted(() => vi.fn());
const constructorMock = vi.hoisted(() => vi.fn());

vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: createMock
      }
    };

    constructor(options: unknown) {
      constructorMock(options);
    }
  }
}));

import { buildTranslationMessages, translate } from '../src/translator.js';

describe('buildTranslationMessages', () => {
  it('includes context, preservation rules, and the SKIP instruction', () => {
    const messages = buildTranslationMessages('明日いける?', 'en', [
      { authorName: 'Alice', content: 'Are we meeting tomorrow?' }
    ]);
    const rendered = messages.map((message) => String(message.content)).join('\n');

    expect(rendered).toContain('Alice: Are we meeting tomorrow?');
    expect(rendered).toContain('Preserve tone, mentions, emoji, and line breaks');
    expect(rendered).toContain('output exactly SKIP');
    expect(rendered).toContain('Target language: English');
  });
});

describe('translate', () => {
  beforeEach(() => {
    createMock.mockReset();
    constructorMock.mockClear();
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.OPENAI_MODEL = 'test-model';
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
  });

  it('uses OPENAI_MODEL and returns null when the model outputs SKIP', async () => {
    createMock.mockResolvedValueOnce({
      choices: [{ message: { content: 'SKIP' } }]
    });

    await expect(translate('lol', 'ja', [])).resolves.toBeNull();
    expect(constructorMock).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'test-key', timeout: 10_000, maxRetries: 0 })
    );
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'test-model' }),
      expect.objectContaining({ timeout: 10_000 })
    );
  });

  it('retries once after a failed OpenAI request', async () => {
    createMock
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({ choices: [{ message: { content: '了解です' } }] });

    await expect(translate('Got it', 'ja', [])).resolves.toBe('了解です');
    expect(createMock).toHaveBeenCalledTimes(2);
  });
});
