import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createMock = vi.hoisted(() => vi.fn());
const constructorMock = vi.hoisted(() => vi.fn());
const recordUsageMock = vi.hoisted(() => vi.fn());

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

vi.mock('../src/db.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/db.js')>();
  return { ...actual, recordUsage: recordUsageMock };
});

import { buildSummarizePrompt, buildSystemPrompt, buildUserContent, summarize, translate } from '../src/translator.js';

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

  it('omits SKIP instruction when allowSkip is false', () => {
    const system = buildSystemPrompt('en', false);
    expect(system).not.toContain('SKIP');
    expect(system).toContain('English translation');
  });

  it('includes SKIP instruction when allowSkip is true', () => {
    const system = buildSystemPrompt('ja', true);
    expect(system).toContain('output exactly SKIP');
  });

  it('injects glossary with rendering into system prompt', () => {
    const system = buildSystemPrompt('en', false, [
      { term: '進捗', rendering: 'progress' },
      { term: 'pwn', rendering: null }
    ]);
    expect(system).toContain('Glossary (apply these terms exactly as specified)');
    expect(system).toContain('"進捗" → "progress"');
    expect(system).toContain('"pwn" → keep as-is (do not translate)');
  });

  it('omits glossary section when glossary is empty', () => {
    const system = buildSystemPrompt('en', false, []);
    expect(system).not.toContain('Glossary');
  });

  it('places glossary before SKIP instruction', () => {
    const system = buildSystemPrompt('en', true, [{ term: 'test', rendering: 'テスト' }]);
    const glossaryIdx = system.indexOf('Glossary');
    const skipIdx = system.indexOf('SKIP');
    expect(glossaryIdx).toBeLessThan(skipIdx);
  });
});

describe('buildSummarizePrompt', () => {
  it('produces a prompt in the target language', () => {
    const prompt = buildSummarizePrompt('ja');
    expect(prompt).toContain('Japanese');
    expect(prompt).toContain('summarizer');
  });

  it('mentions expected structure', () => {
    const prompt = buildSummarizePrompt('en');
    expect(prompt).toContain('key topics');
    expect(prompt).toContain('decisions');
    expect(prompt).toContain('TODO');
  });
});

describe('translate', () => {
  const usageData = { input_tokens: 100, output_tokens: 20 };

  beforeEach(() => {
    createMock.mockReset();
    constructorMock.mockClear();
    recordUsageMock.mockClear();
    process.env.ANTHROPIC_API_KEY = 'test-key';
    process.env.ANTHROPIC_MODEL = 'test-model';
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_MODEL;
  });

  it('uses ANTHROPIC_MODEL and returns null when the model outputs SKIP', async () => {
    createMock.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'SKIP' }],
      usage: usageData
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
      .mockResolvedValueOnce({ content: [{ type: 'text', text: '了解です' }], usage: usageData });

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
      content: [{ type: 'text', text: '' }],
      usage: usageData
    });

    await expect(translate('test', 'ja', [])).resolves.toBeNull();
  });

  it('uses default model when ANTHROPIC_MODEL is unset', async () => {
    delete process.env.ANTHROPIC_MODEL;
    createMock.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'translated' }],
      usage: usageData
    });

    await translate('Hello', 'ja', []);
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-haiku-4-5' })
    );
  });

  it('records usage on successful call', async () => {
    createMock.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'こんにちは' }],
      usage: { input_tokens: 150, output_tokens: 30 }
    });

    await translate('Hello', 'ja', []);
    expect(recordUsageMock).toHaveBeenCalledWith('test-model', 150, 30);
  });

  it('does not record usage on failed call', async () => {
    createMock
      .mockRejectedValueOnce(new Error('fail1'))
      .mockRejectedValueOnce(new Error('fail2'));

    await expect(translate('Hello', 'ja', [])).rejects.toThrow();
    expect(recordUsageMock).not.toHaveBeenCalled();
  });

  it('records usage for both retry attempts when first succeeds on retry', async () => {
    createMock
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'OK' }],
        usage: { input_tokens: 50, output_tokens: 10 }
      });

    await translate('test', 'ja', []);
    expect(recordUsageMock).toHaveBeenCalledTimes(1);
    expect(recordUsageMock).toHaveBeenCalledWith('test-model', 50, 10);
  });

  it('returns SKIP text as translation when allowSkip is false', async () => {
    createMock.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'SKIP' }],
      usage: usageData
    });

    const result = await translate('lol', 'ja', [], { allowSkip: false });
    expect(result).toBe('SKIP');
  });

  it('passes allowSkip=false to buildSystemPrompt (no SKIP in system)', async () => {
    createMock.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'translated' }],
      usage: usageData
    });

    await translate('test', 'ja', [], { allowSkip: false });
    const callArgs = createMock.mock.calls[0][0];
    expect(callArgs.system).not.toContain('SKIP');
  });

  it('injects glossary entries into system prompt', async () => {
    createMock.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'translated' }],
      usage: usageData
    });

    await translate('test', 'ja', [], {
      glossary: [{ term: 'pwn', rendering: null }]
    });
    const callArgs = createMock.mock.calls[0][0];
    expect(callArgs.system).toContain('Glossary');
    expect(callArgs.system).toContain('"pwn"');
  });
});

describe('summarize', () => {
  beforeEach(() => {
    createMock.mockReset();
    recordUsageMock.mockClear();
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.SUMMARIZE_MODEL;
  });

  it('uses default model claude-opus-4-8', async () => {
    createMock.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'summary' }],
      usage: { input_tokens: 500, output_tokens: 200 }
    });

    const result = await summarize('transcript', 'en');
    expect(result).toBe('summary');
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-opus-4-8', max_tokens: 2000 })
    );
  });

  it('uses SUMMARIZE_MODEL env when set', async () => {
    process.env.SUMMARIZE_MODEL = 'custom-model';
    createMock.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'result' }],
      usage: { input_tokens: 100, output_tokens: 50 }
    });

    await summarize('transcript', 'ja');
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'custom-model' })
    );
  });

  it('records usage with correct model', async () => {
    createMock.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'summary' }],
      usage: { input_tokens: 1000, output_tokens: 300 }
    });

    await summarize('transcript', 'ko');
    expect(recordUsageMock).toHaveBeenCalledWith('claude-opus-4-8', 1000, 300);
  });
});
