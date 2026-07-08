import type { UserLang } from './db.js';

const KANA_RE = /[\u3040-\u30ff]/u;
const HANGUL_RE = /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/u;
const CJK_RE = /[\u3400-\u9fff]/u;

export function detectLanguage(text: string): UserLang {
  if (KANA_RE.test(text)) return 'ja';
  if (HANGUL_RE.test(text)) return 'ko';
  if (CJK_RE.test(text)) return 'ja';
  return 'en';
}
