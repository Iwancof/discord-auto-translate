import type { Message } from 'discord.js';
import type { UserLang } from './db.js';

export interface DeliveryStrategy {
  deliver(originalMsg: Message, translation: string, targetLang: UserLang): Promise<void> | void;
}

export class LogOnlyDelivery implements DeliveryStrategy {
  deliver(originalMsg: Message, translation: string, targetLang: UserLang): void {
    console.log(
      `[translation:${targetLang}] channel=${originalMsg.channelId} message=${originalMsg.id} author=${originalMsg.author.tag}\n${translation}`
    );
  }
}

// TODO: Add ephemeral delivery strategies here after the display mode decision is made.
