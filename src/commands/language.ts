import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type SlashCommandStringOption
} from 'discord.js';
import { getUserLang, setUserLang, type UserLang } from '../db.js';
import { formatLang, LANG_CHOICES } from '../langs.js';

export const languageCommand = new SlashCommandBuilder()
  .setName('language')
  .setDescription('Manage your translation language')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('set')
      .setDescription('Set your preferred language')
      .addStringOption((option: SlashCommandStringOption) =>
        option
          .setName('lang')
          .setDescription('Preferred language')
          .setRequired(true)
          .addChoices(...LANG_CHOICES)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand.setName('show').setDescription('Show your preferred language')
  );

export async function executeLanguageCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'set') {
    const lang = interaction.options.getString('lang', true) as UserLang;
    setUserLang(interaction.user.id, lang);
    await interaction.reply({
      content: `Language set to ${formatLang(lang)}.`,
      ephemeral: true
    });
    return;
  }

  const lang = getUserLang(interaction.user.id);
  await interaction.reply({
    content: `Your language is ${formatLang(lang)}.`,
    ephemeral: true
  });
}

export { formatLang } from '../langs.js';
