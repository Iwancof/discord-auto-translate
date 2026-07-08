import Anthropic from '@anthropic-ai/sdk';
import { recordUsage, type GlossaryEntry, type UserLang } from './db.js';

export interface ChatContextItem {
  authorName: string;
  content: string;
}

export interface TranslateOptions {
  allowSkip?: boolean;
  glossary?: GlossaryEntry[];
}

const DEFAULT_MODEL = 'claude-haiku-4-5';
const SKIP_TOKEN = 'SKIP';

const LANG_NAMES: Record<UserLang, string> = { en: 'English', ja: 'Japanese', ko: 'Korean' };

export function buildSystemPrompt(
  targetLang: UserLang,
  allowSkip = true,
  glossary: GlossaryEntry[] = []
): string {
  const languageName = LANG_NAMES[targetLang];
  let base =
    'You are a fast Discord chat translator. Translate naturally for chat readers. ' +
    'Use recent context when it helps. Preserve tone, mentions, emoji, and line breaks. ' +
    `Output only the ${languageName} translation.`;
  if (glossary.length > 0) {
    const lines = glossary.map((e) =>
      e.rendering
        ? `- "${e.term}" → "${e.rendering}"`
        : `- "${e.term}" → keep as-is (do not translate)`
    );
    base += `\n\nGlossary (apply these terms exactly as specified):\n${lines.join('\n')}`;
  }
  if (!allowSkip) return base;
  return (
    base +
    ` If the target reader does not need a translation because the content is slang, an acknowledgement, emoji-only, code-only, proper nouns only, or otherwise language-independent, output exactly ${SKIP_TOKEN} and nothing else.`
  );
}

export function buildUserContent(
  text: string,
  targetLang: UserLang,
  context: readonly ChatContextItem[]
): string {
  const languageName = LANG_NAMES[targetLang];
  const recentContext = context
    .slice(-8)
    .map((item) => `- ${item.authorName}: ${item.content}`)
    .join('\n');

  return [
    `Target language: ${languageName}`,
    'Recent context (oldest to newest, up to 8):',
    recentContext || '(none)',
    'Target message:',
    text
  ].join('\n');
}

export async function translate(
  text: string,
  targetLang: UserLang,
  context: readonly ChatContextItem[],
  opts?: TranslateOptions
): Promise<string | null> {
  const allowSkip = opts?.allowSkip ?? true;
  const glossary = opts?.glossary ?? [];
  const model = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
  const client = new Anthropic({
    timeout: 10_000,
    maxRetries: 0
  });

  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await client.messages.create({
        model,
        max_tokens: 1024,
        system: buildSystemPrompt(targetLang, allowSkip, glossary),
        messages: [{ role: 'user', content: buildUserContent(text, targetLang, context) }]
      });

      recordUsage(model, res.usage.input_tokens, res.usage.output_tokens);

      const output = res.content.find((b) => b.type === 'text')?.text?.trim() ?? '';
      if (!output || (allowSkip && output === SKIP_TOKEN)) {
        return null;
      }

      return output;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export function buildSummarizePrompt(targetLang: UserLang): string {
  const languageName = LANG_NAMES[targetLang];
  return (
    `You are a Discord chat summarizer. Summarize the conversation in ${languageName}. ` +
    'Structure your summary as: key topics with bullet points, decisions made, TODOs/unresolved items. Be concise.'
  );
}

export async function summarize(
  transcript: string,
  targetLang: UserLang
): Promise<string> {
  const model = process.env.SUMMARIZE_MODEL ?? 'claude-opus-4-8';
  const client = new Anthropic({ timeout: 30_000, maxRetries: 0 });

  const res = await client.messages.create({
    model,
    max_tokens: 2000,
    system: buildSummarizePrompt(targetLang),
    messages: [{ role: 'user', content: transcript }]
  });

  recordUsage(model, res.usage.input_tokens, res.usage.output_tokens);

  return res.content.find((b) => b.type === 'text')?.text?.trim() ?? '';
}
