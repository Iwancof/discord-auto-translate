import type { GuildMode, UserLang } from './db.js';

export type DispatchAction =
  | { type: 'auto-reply'; targetLang: 'en' }
  | { type: 'button-only' }
  | { type: 'log'; targetLang: UserLang };

export function resolveDispatch(
  sourceLang: UserLang,
  deliveryMode: string,
  guildMode: GuildMode = 'button'
): DispatchAction {
  if (deliveryMode === 'log_only') {
    const targetLang: UserLang = sourceLang === 'en' ? 'ja' : 'en';
    return { type: 'log', targetLang };
  }
  if (guildMode === 'auto' && sourceLang !== 'en') {
    return { type: 'auto-reply', targetLang: 'en' };
  }
  return { type: 'button-only' };
}
