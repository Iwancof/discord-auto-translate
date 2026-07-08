import type { GuildMode, UserLang } from './db.js';

export type DispatchAction =
  | { type: 'auto-reply'; targetLang: UserLang }
  | { type: 'button-only' }
  | { type: 'none' }
  | { type: 'log'; targetLang: UserLang };

export function resolveDispatch(
  sourceLang: UserLang,
  deliveryMode: string,
  guildMode: GuildMode = 'button',
  officialLang: UserLang = 'en'
): DispatchAction {
  if (deliveryMode === 'log_only') {
    const targetLang: UserLang = sourceLang === 'en' ? 'ja' : 'en';
    return { type: 'log', targetLang };
  }
  if (sourceLang === officialLang) {
    return { type: 'none' };
  }
  if (guildMode === 'auto') {
    return { type: 'auto-reply', targetLang: officialLang };
  }
  return { type: 'button-only' };
}
