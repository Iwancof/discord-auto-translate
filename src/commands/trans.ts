import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction
} from 'discord.js';
import { getGlossaryEntries, getUserLang, type UserLang } from '../db.js';
import { translateBatch, type BatchTranslateItem } from '../translator.js';
import { extractTranslatable } from '../filter.js';
import { detectLanguage } from '../detect.js';

const MESSAGE_LINK_RE = /^https:\/\/discord\.com\/channels\/\d+\/\d+\/(\d+)$/;

export function parseMessageTarget(input: string): string | null {
  const linkMatch = input.match(MESSAGE_LINK_RE);
  if (linkMatch) return linkMatch[1];
  if (/^\d+$/.test(input)) return input;
  return null;
}

export function trimToLimit(lines: string[], limit: number): string {
  const joined = lines.join('\n');
  if (joined.length <= limit) return joined;

  const result = [...lines];
  let skipped = 0;
  while (result.length > 1) {
    result.shift();
    skipped++;
    const candidate = [`(${skipped} messages omitted)`, ...result].join('\n');
    if (candidate.length <= limit) break;
  }
  if (skipped > 0) {
    result.unshift(`(${skipped} messages omitted)`);
  }
  return result.join('\n').slice(0, limit);
}

export const transCommand = new SlashCommandBuilder()
  .setName('trans')
  .setDescription('Translate recent messages in this channel')
  .addIntegerOption((opt) =>
    opt
      .setName('count')
      .setDescription('Number of messages to translate (1-20, default 4)')
      .setMinValue(1)
      .setMaxValue(20)
  )
  .addStringOption((opt) =>
    opt.setName('message').setDescription('Message ID or link to translate')
  );

export async function executeTransCommand(
  interaction: ChatInputCommandInteraction,
  botUserId: string
): Promise<void> {
  const count = interaction.options.getInteger('count');
  const messageOpt = interaction.options.getString('message');

  if (count != null && messageOpt != null) {
    await interaction.reply({
      content: '`count` and `message` are mutually exclusive — use one or the other.',
      ephemeral: true
    });
    return;
  }

  const userLang: UserLang = getUserLang(interaction.user.id);
  const guildId = interaction.guildId;
  const glossary = guildId ? getGlossaryEntries(guildId) : [];

  await interaction.deferReply({ ephemeral: true });

  const channel = interaction.channel;
  if (!channel || !('messages' in channel)) {
    await interaction.editReply({ content: 'Could not access this channel.' });
    return;
  }

  if (messageOpt != null) {
    const msgId = parseMessageTarget(messageOpt);
    if (!msgId) {
      await interaction.editReply({ content: 'Invalid message ID or link.' });
      return;
    }
    try {
      const msg = await channel.messages.fetch(msgId);
      const translatable = extractTranslatable(msg.content);
      if (!translatable) {
        await interaction.editReply({ content: 'That message has nothing to translate.' });
        return;
      }
      const items: BatchTranslateItem[] = [{
        authorName: msg.member?.displayName ?? msg.author.username,
        content: translatable
      }];
      const result = await translateBatch(items, userLang, glossary);
      await interaction.editReply({ content: result || '(Empty translation)' });
    } catch {
      await interaction.editReply({ content: 'Could not fetch that message.' });
    }
    return;
  }

  const targetCount = count ?? 4;
  const fetched = await channel.messages.fetch({ limit: 50 });
  const candidates: BatchTranslateItem[] = [];

  for (const msg of fetched.values()) {
    if (candidates.length >= targetCount) break;
    if (msg.author.bot || msg.webhookId) continue;

    const translatable = extractTranslatable(msg.content);
    if (!translatable) continue;

    const sourceLang = detectLanguage(translatable);
    if (sourceLang === userLang) continue;

    candidates.push({
      authorName: msg.member?.displayName ?? msg.author.username,
      content: translatable
    });
  }

  if (candidates.length === 0) {
    await interaction.editReply({ content: 'No translatable messages found in recent history.' });
    return;
  }

  candidates.reverse();

  const result = await translateBatch(candidates, userLang, glossary);
  const lines = result.split('\n');
  const trimmed = trimToLimit(lines, 2000);
  await interaction.editReply({ content: trimmed });
}
