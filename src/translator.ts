import Anthropic from '@anthropic-ai/sdk';
import type { UserLang } from './db.js';

export interface ChatContextItem {
  authorName: string;
  content: string;
}

const DEFAULT_MODEL = 'claude-haiku-4-5';
const SKIP_TOKEN = 'SKIP';

const LANG_NAMES: Record<UserLang, string> = { en: 'English', ja: 'Japanese', ko: 'Korean' };

export function buildSystemPrompt(targetLang: UserLang): string {
  const languageName = LANG_NAMES[targetLang];
  return (
    'You are a fast Discord chat translator. Translate naturally for chat readers. ' +
    'Use recent context when it helps. Preserve tone, mentions, emoji, and line breaks. ' +
    `Output only the ${languageName} translation. ` +
    `If the target reader does not need a translation because the content is slang, an acknowledgement, emoji-only, code-only, proper nouns only, or otherwise language-independent, output exactly ${SKIP_TOKEN} and nothing else.`
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
  context: readonly ChatContextItem[]
): Promise<string | null> {
  const client = new Anthropic({
    timeout: 10_000,
    maxRetries: 0
  });

  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await client.messages.create({
        model: process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL,
        max_tokens: 1024,
        system: buildSystemPrompt(targetLang),
        messages: [{ role: 'user', content: buildUserContent(text, targetLang, context) }]
      });

      const output = res.content.find((b) => b.type === 'text')?.text?.trim() ?? '';
      if (!output || output === SKIP_TOKEN) {
        return null;
      }

      return output;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
