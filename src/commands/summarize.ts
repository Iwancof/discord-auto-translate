import {
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction
} from 'discord.js';
import { getUserLang } from '../db.js';
import { summarize } from '../translator.js';

export const summarizeCommand = new SlashCommandBuilder()
  .setName('summarize')
  .setDescription('Summarize recent messages in this channel')
  .addIntegerOption((opt) =>
    opt
      .setName('count')
      .setDescription('Number of messages to summarize (10-200, default 50)')
      .setRequired(false)
      .setMinValue(10)
      .setMaxValue(200)
  );

export interface TranscriptMessage {
  author: { username: string };
  content: string;
}

export function buildTranscript(messages: TranscriptMessage[]): string {
  return messages.map((m) => `[${m.author.username}] ${m.content}`).join('\n');
}

export async function executeSummarizeCommand(
  interaction: ChatInputCommandInteraction,
  botId: string
): Promise<void> {
  const count = interaction.options.getInteger('count') ?? 50;
  const targetLang = getUserLang(interaction.user.id);

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const channel = interaction.channel;
  if (!channel || !('messages' in channel)) {
    await interaction.editReply({ content: 'Cannot access messages in this channel.' });
    return;
  }

  const allMessages: TranscriptMessage[] = [];
  let lastId: string | undefined;
  let remaining = count;

  while (remaining > 0) {
    const opts: { limit: number; before?: string } = { limit: Math.min(remaining, 100) };
    if (lastId) opts.before = lastId;
    const batch = await channel.messages.fetch(opts);
    if (batch.size === 0) break;
    for (const msg of batch.values()) {
      if (!msg.author.bot && msg.id !== interaction.id) {
        allMessages.push({ author: { username: msg.author.username }, content: msg.content });
      }
    }
    lastId = batch.lastKey();
    remaining -= batch.size;
  }

  if (allMessages.length === 0) {
    await interaction.editReply({ content: 'No messages to summarize.' });
    return;
  }

  allMessages.reverse();
  const transcript = buildTranscript(allMessages);
  const summary = await summarize(transcript, targetLang);
  await interaction.editReply({ content: summary || '(Empty summary — try again)' });
}
