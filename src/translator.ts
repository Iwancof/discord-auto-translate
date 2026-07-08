import OpenAI from 'openai';
import type { UserLang } from './db.js';

export interface ChatContextItem {
  authorName: string;
  content: string;
}

export type TranslationMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string };

const DEFAULT_OPENAI_MODEL = 'gpt-4.1-mini';
const SKIP_TOKEN = 'SKIP';

export function buildTranslationMessages(
  text: string,
  targetLang: UserLang,
  context: readonly ChatContextItem[]
): TranslationMessage[] {
  const languageName = targetLang === 'ja' ? 'Japanese' : 'English';
  const recentContext = context
    .slice(-8)
    .map((item) => `- ${item.authorName}: ${item.content}`)
    .join('\n');

  return [
    {
      role: 'system',
      content:
        'You are a fast Discord chat translator. Translate naturally for chat readers. ' +
        'Use recent context when it helps. Preserve tone, mentions, emoji, and line breaks. ' +
        `Output only the ${languageName} translation. ` +
        `If the target reader does not need a translation because the content is slang, an acknowledgement, emoji-only, code-only, proper nouns only, or otherwise language-independent, output exactly ${SKIP_TOKEN} and nothing else.`
    },
    {
      role: 'user',
      content: [
        `Target language: ${languageName}`,
        'Recent context (oldest to newest, up to 8):',
        recentContext || '(none)',
        'Target message:',
        text
      ].join('\n')
    }
  ];
}

export async function translate(
  text: string,
  targetLang: UserLang,
  context: readonly ChatContextItem[]
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required to translate messages.');
  }

  const client = new OpenAI({
    apiKey,
    timeout: 10_000,
    maxRetries: 0
  });

  const messages = buildTranslationMessages(text, targetLang, context);
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const completion = await client.chat.completions.create(
        {
          model: getOpenAIModel(),
          messages,
          temperature: 0.2
        },
        {
          timeout: 10_000
        }
      );

      const output = completion.choices[0]?.message?.content?.trim();
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

function getOpenAIModel(): string {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
}
