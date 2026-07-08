import type { UserLang } from './db.js';

const KANA_RE = /[\u3040-\u30ff]/u;
const HANGUL_RE = /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/u;
const CJK_RE = /[\u3400-\u9fff]/u;
// Arabic + Arabic Supplement
const ARABIC_RE = /[\u0600-\u06ff\u0750-\u077f]/u;
// Vietnamese-only Latin letters: d-bar (U+0111/U+0110), horn/breve vowels
// (o-horn U+01A1/U+01A0, u-horn U+01B0/U+01AF, a-breve U+0103/U+0102),
// i/u-tilde (U+0129/U+0128, U+0169/U+0168), and the tone-marked vowels in
// Latin Extended Additional (U+1EA0..U+1EF9).
// Deliberately excludes letters shared with French (a/e/o-circumflex, grave,
// acute, cedilla, ...) so French text is not misclassified as Vietnamese.
const VIETNAMESE_RE = /[\u0111\u0110\u01a1\u01a0\u01b0\u01af\u0103\u0102\u0129\u0128\u0169\u0168\u1ea0-\u1ef9]/u;
// French accented Latin letters (lower + upper): a-grave/circumflex, c-cedilla,
// e-acute/grave/circumflex/diaeresis, i-circumflex/diaeresis, o-circumflex,
// u-grave/circumflex/diaeresis, y-diaeresis, oe/ae ligatures.
const FRENCH_RE = /[\u00e0\u00e2\u00e7\u00e9\u00e8\u00ea\u00eb\u00ee\u00ef\u00f4\u00f9\u00fb\u00fc\u00ff\u0153\u00e6\u00c0\u00c2\u00c7\u00c9\u00c8\u00ca\u00cb\u00ce\u00cf\u00d4\u00d9\u00db\u00dc\u0178\u0152\u00c6]/u;

export function detectLanguage(text: string): UserLang {
  if (KANA_RE.test(text)) return 'ja';
  if (HANGUL_RE.test(text)) return 'ko';
  if (CJK_RE.test(text)) return 'ja';
  if (ARABIC_RE.test(text)) return 'ar';
  if (VIETNAMESE_RE.test(text)) return 'vi';
  if (FRENCH_RE.test(text)) return 'fr';
  return 'en';
}
