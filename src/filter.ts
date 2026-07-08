export interface MessageLike {
  content: string;
  author?: {
    bot?: boolean;
  };
  webhookId?: string | null;
  attachments?: {
    size: number;
  };
}

export const TRIVIAL_PATTERNS: readonly RegExp[] = [
  /^(?:lol|lmao|rofl|gg|ok|okay|nice|thanks?|thx|ty|np)$/iu,
  /^w+$/iu,
  /^草+$/u,
  /^(?:それな|おつ|お疲れ|お疲れさま)$/u
];

const CODE_BLOCK_RE = /```[\s\S]*?```/g;
const INLINE_CODE_RE = /`[^`\n]*`/g;
const URL_RE = /^https?:\/\/\S+$/iu;
const CUSTOM_EMOJI_RE = /<a?:[A-Za-z0-9_~]+:\d+>/g;
const EMOJI_RE = /[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\u200D]/gu;
// User/role/channel mentions, slash-command mentions, timestamps, @everyone/@here \u2014
// language-independent tokens that carry no translatable text.
const MENTION_RE = /<@[!&]?\d+>|<#\d+>|<\/[-\w ]+:\d+>|<t:\d+(?::\w)?>|@everyone|@here/g;

export function extractTranslatable(content: string): string | null {
  const trimmed = content.trim();
  if (!trimmed) {
    return null;
  }

  if (isUrlOnly(trimmed) || isEmojiOnly(trimmed)) {
    return null;
  }

  const replaced = replaceCodeWithPlaceholder(trimmed).trim();
  return replaced.length > 0 ? replaced : null;
}

// Pure acknowledgements/slang/emoji — never worth translating, alone or in a batch.
export function isAcknowledgement(text: string): boolean {
  const normalized = normalizeForTrivial(text);
  if (!normalized) {
    return true;
  }

  if (isEmojiOnly(normalized)) {
    return true;
  }

  return TRIVIAL_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function isTrivial(text: string): boolean {
  if (isAcknowledgement(text)) {
    return true;
  }

  const normalized = normalizeForTrivial(text);
  const compactLength = normalized.replace(/\s+/g, '').length;
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  return compactLength < 8 && wordCount < 2;
}

function passesContentGates(msg: MessageLike): string | null {
  if (msg.author?.bot || msg.webhookId) {
    return null;
  }

  const content = msg.content ?? '';
  if (!content.trim() && (msg.attachments?.size ?? 0) > 0) {
    return null;
  }

  if (content.length > 2000) {
    return null;
  }

  if (codeBlockRatio(content) > 0.5) {
    return null;
  }

  return extractTranslatable(content);
}

export function shouldTranslate(msg: MessageLike): boolean {
  const translatable = passesContentGates(msg);
  return !!translatable && !isTrivial(translatable);
}

// Looser gate for the button batcher: short fragments are allowed (they may
// combine into a meaningful block), only pure acknowledgements are excluded.
export function shouldBatchForButton(msg: MessageLike): boolean {
  const translatable = passesContentGates(msg);
  return !!translatable && !isAcknowledgement(translatable);
}

function replaceCodeWithPlaceholder(text: string): string {
  return text.replace(CODE_BLOCK_RE, '[code]').replace(INLINE_CODE_RE, '[code]');
}

function normalizeForTrivial(text: string): string {
  return text
    .replace(CODE_BLOCK_RE, ' ')
    .replace(INLINE_CODE_RE, ' ')
    .replace(/\[code\]/giu, ' ')
    .replace(CUSTOM_EMOJI_RE, ' ')
    .replace(MENTION_RE, ' ')
    .replace(EMOJI_RE, ' ')
    .replace(/[.!?。！、,~ー]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isUrlOnly(text: string): boolean {
  const parts = text.split(/\s+/).filter(Boolean);
  return parts.length > 0 && parts.every((part) => URL_RE.test(part));
}

function isEmojiOnly(text: string): boolean {
  const stripped = text
    .replace(CUSTOM_EMOJI_RE, '')
    .replace(MENTION_RE, '')
    .replace(EMOJI_RE, '')
    .trim();
  return stripped.length === 0;
}

function codeBlockRatio(text: string): number {
  if (!text.length) {
    return 0;
  }

  const codeLength = Array.from(text.matchAll(CODE_BLOCK_RE)).reduce(
    (total, match) => total + match[0].length,
    0
  );
  return codeLength / text.length;
}
