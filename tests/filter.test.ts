import { describe, expect, it } from 'vitest';
import {
  extractTranslatable,
  isAcknowledgement,
  isTrivial,
  shouldBatchForButton,
  shouldTranslate,
  type MessageLike
} from '../src/filter.js';

function message(overrides: Partial<MessageLike>): MessageLike {
  return {
    content: 'Please review this tomorrow.',
    author: { bot: false },
    webhookId: null,
    attachments: { size: 0 },
    ...overrides
  };
}

describe('extractTranslatable', () => {
  it('replaces code blocks and inline code with placeholders', () => {
    expect(extractTranslatable('check `foo()`\n```ts\nconst x = 1;\n```')).toBe(
      'check [code]\n[code]'
    );
  });

  it('drops empty, url-only, and emoji-only messages', () => {
    expect(extractTranslatable('   ')).toBeNull();
    expect(extractTranslatable('https://example.com https://example.org/a')).toBeNull();
    expect(extractTranslatable('😀 <:party:1234567890>')).toBeNull();
  });

  it('drops mention-only messages', () => {
    expect(extractTranslatable('<@123456789012345678>')).toBeNull();
    expect(extractTranslatable('<@!123456789012345678>')).toBeNull();
    expect(extractTranslatable('<@&123456789012345678>')).toBeNull();
    expect(extractTranslatable('<#123456789012345678>')).toBeNull();
    expect(extractTranslatable('@everyone')).toBeNull();
    expect(extractTranslatable('@here')).toBeNull();
    expect(extractTranslatable('<@123456789012345678> <@987654321098765432>')).toBeNull();
  });

  it('drops mention+emoji-only and timestamp-only messages', () => {
    expect(extractTranslatable('<@123456789012345678> 😀')).toBeNull();
    expect(extractTranslatable('<t:1720000000:R>')).toBeNull();
  });

  it('keeps messages with real text alongside a mention', () => {
    expect(extractTranslatable('<@123456789012345678> can you check this tomorrow?')).toBe(
      '<@123456789012345678> can you check this tomorrow?'
    );
  });
});

describe('isTrivial', () => {
  it('matches short acknowledgements and slang', () => {
    expect(isTrivial('lol')).toBe(true);
    expect(isTrivial('ok!')).toBe(true);
    expect(isTrivial('草')).toBe(true);
    expect(isTrivial('それな')).toBe(true);
  });

  it('treats emoji-only as trivial', () => {
    expect(isTrivial('😀🎉')).toBe(true);
  });

  it('treats short single-word below 8 chars as trivial', () => {
    expect(isTrivial('abcdefg')).toBe(true);
  });

  it('keeps single-word of 8+ chars as non-trivial', () => {
    expect(isTrivial('abcdefgh')).toBe(false);
  });

  it('matches ww... slang variants', () => {
    expect(isTrivial('wwwww')).toBe(true);
  });

  it('keeps substantial chat text', () => {
    expect(isTrivial('Please review this patch tomorrow')).toBe(false);
  });

  it('ignores mentions when judging triviality', () => {
    expect(isTrivial('<@123456789012345678> thanks')).toBe(true);
    expect(isTrivial('<@123456789012345678> ありがとう')).toBe(true);
    expect(isTrivial('<@123456789012345678> could you review the deployment plan?')).toBe(false);
  });
});

describe('isAcknowledgement', () => {
  it('matches pattern slang and emoji-only', () => {
    expect(isAcknowledgement('lol')).toBe(true);
    expect(isAcknowledgement('それな')).toBe(true);
    expect(isAcknowledgement('😀🎉')).toBe(true);
    expect(isAcknowledgement('wwww')).toBe(true);
  });

  it('does not match short fragments that are not pure acks', () => {
    expect(isAcknowledgement('あのさ')).toBe(false);
    expect(isAcknowledgement('まって')).toBe(false);
    expect(isAcknowledgement('abcdefg')).toBe(false);
  });
});

describe('shouldBatchForButton', () => {
  function message(overrides: Partial<MessageLike>): MessageLike {
    return {
      content: 'Please review this tomorrow.',
      author: { bot: false },
      webhookId: null,
      attachments: { size: 0 },
      ...overrides
    };
  }

  it('accepts short fragments that shouldTranslate rejects', () => {
    const short = message({ content: 'あのさ' });
    expect(shouldTranslate(short)).toBe(false);
    expect(shouldBatchForButton(short)).toBe(true);
  });

  it('rejects pure acknowledgements', () => {
    expect(shouldBatchForButton(message({ content: 'lol' }))).toBe(false);
    expect(shouldBatchForButton(message({ content: '草' }))).toBe(false);
  });

  it('rejects bots, mention-only, url-only, and code-heavy messages', () => {
    expect(shouldBatchForButton(message({ author: { bot: true } }))).toBe(false);
    expect(shouldBatchForButton(message({ content: '<@123456789012345678>' }))).toBe(false);
    expect(shouldBatchForButton(message({ content: 'https://example.com' }))).toBe(false);
    expect(
      shouldBatchForButton(message({ content: '```ts\nconst a = 1;\nconst b = 2;\n``` ok' }))
    ).toBe(false);
  });

  it('accepts substantial messages', () => {
    expect(shouldBatchForButton(message({ content: 'Can you review this?' }))).toBe(true);
  });
});

describe('shouldTranslate', () => {
  it('excludes bot, webhook, attachment-only, trivial, long, and mostly-code messages', () => {
    expect(shouldTranslate(message({ author: { bot: true } }))).toBe(false);
    expect(shouldTranslate(message({ webhookId: 'webhook-id' }))).toBe(false);
    expect(shouldTranslate(message({ content: '', attachments: { size: 1 } }))).toBe(false);
    expect(shouldTranslate(message({ content: 'thanks' }))).toBe(false);
    expect(shouldTranslate(message({ content: 'a'.repeat(2001) }))).toBe(false);
    expect(shouldTranslate(message({ content: '```ts\nconst a = 1;\nconst b = 2;\n``` ok' }))).toBe(
      false
    );
  });

  it('accepts normal non-trivial messages', () => {
    expect(shouldTranslate(message({ content: 'Can you review this before the meeting?' }))).toBe(
      true
    );
  });

  it('accepts exactly 2000 chars', () => {
    expect(shouldTranslate(message({ content: 'a'.repeat(8) + ' ' + 'b'.repeat(1991) }))).toBe(
      true
    );
  });

  it('rejects URL-only messages', () => {
    expect(shouldTranslate(message({ content: 'https://example.com' }))).toBe(false);
  });

  it('rejects mention-only messages, with or without an image', () => {
    expect(shouldTranslate(message({ content: '<@123456789012345678>' }))).toBe(false);
    expect(
      shouldTranslate(message({ content: '<@123456789012345678>', attachments: { size: 1 } }))
    ).toBe(false);
  });

  it('rejects image with a trivial short caption', () => {
    expect(shouldTranslate(message({ content: 'みて', attachments: { size: 1 } }))).toBe(false);
  });

  it('accepts mention plus substantial text', () => {
    expect(
      shouldTranslate(message({ content: '<@123456789012345678> can you deploy this today?' }))
    ).toBe(true);
  });

  it('accepts messages at exactly 50% code ratio', () => {
    const code = '```\nx\n```';
    const text = 'a'.repeat(code.length) + ' something';
    expect(shouldTranslate(message({ content: text + code }))).toBe(true);
  });

  it('rejects messages above 50% code ratio', () => {
    const code = '```ts\nconst a = 1;\nconst b = 2;\nconst c = 3;\n```';
    const text = 'ok';
    expect(shouldTranslate(message({ content: text + code }))).toBe(false);
  });
});
