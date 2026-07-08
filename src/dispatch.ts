import type { UserLang } from './db.js';

export type DispatchAction =
  | { type: 'button-only' }
  | { type: 'log'; targetLang: UserLang };

export function resolveDispatch(sourceLang: UserLang, deliveryMode: string): DispatchAction {
  if (deliveryMode === 'log_only') {
    const targetLang: UserLang = sourceLang === 'en' ? 'ja' : 'en';
    return { type: 'log', targetLang };
  }
  return { type: 'button-only' };
}
