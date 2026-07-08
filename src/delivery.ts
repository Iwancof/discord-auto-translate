import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  type Message
} from 'discord.js';
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

export class AutoReplyDelivery implements DeliveryStrategy {
  async deliver(originalMsg: Message, translation: string, _targetLang: UserLang): Promise<void> {
    await originalMsg.reply({
      content: translation,
      allowedMentions: { repliedUser: false, parse: [] },
      flags: [MessageFlags.SuppressNotifications]
    });
  }
}

export async function postTranslateButton(originalMsg: Message): Promise<void> {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`tr:${originalMsg.id}`)
      .setLabel('\u{1F310} Translate')
      .setStyle(ButtonStyle.Secondary)
  );
  if (!('send' in originalMsg.channel)) return;
  await originalMsg.channel.send({ components: [row] });
}

export class TranslationCache {
  private cache = new Map<string, string>();
  private keys: string[] = [];
  private maxSize: number;

  constructor(maxSize = 200) {
    this.maxSize = maxSize;
  }

  get(messageId: string, targetLang: UserLang): string | undefined {
    return this.cache.get(`${messageId}:${targetLang}`);
  }

  set(messageId: string, targetLang: UserLang, value: string): void {
    const key = `${messageId}:${targetLang}`;
    if (!this.cache.has(key)) {
      this.keys.push(key);
      if (this.keys.length > this.maxSize) {
        const oldest = this.keys.shift()!;
        this.cache.delete(oldest);
      }
    }
    this.cache.set(key, value);
  }
}
