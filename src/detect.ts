import type { UserLang } from './db.js';

const JA_RE = /[\u3040-\u30ff\u3400-\u9fff]/u;

export function detectLanguage(text: string): UserLang {
  return JA_RE.test(text) ? 'ja' : 'en';
}
