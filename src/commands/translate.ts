import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type SlashCommandStringOption
} from 'discord.js';
import { getGlossaryEntries, getUserLang, type UserLang } from '../db.js';
import { translate } from '../translator.js';

const langChoices = [
  { name: 'English', value: 'en' },
  { name: 'Japanese', value: 'ja' },
  { name: 'Korean', value: 'ko' }
] as const;

export const translateCommand = new SlashCommandBuilder()
  .setName('translate')
  .setDescription('Translate text (ephemeral, not posted to channel)')
  .addStringOption((opt) => opt.setName('text').setDescription('Text to translate').setRequired(true))
  .addStringOption((opt: SlashCommandStringOption) =>
    opt
      .setName('to')
      .setDescription('Target language (default: your /language setting)')
      .setRequired(false)
      .addChoices(...langChoices)
  );

export async function executeTranslateCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const text = interaction.options.getString('text', true);
  const targetLang = (interaction.options.getString('to') ?? getUserLang(interaction.user.id)) as UserLang;

  await interaction.deferReply({ ephemeral: true });

  const glossary = interaction.guildId ? getGlossaryEntries(interaction.guildId) : [];
  const translation = await translate(text, targetLang, [], { allowSkip: false, glossary });
  await interaction.editReply({
    content: translation ?? '(Empty translation — try again)'
  });
}
