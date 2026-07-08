import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type SlashCommandStringOption
} from 'discord.js';
import { getGuildMode, setGuildMode, type GuildMode } from '../db.js';

const modeChoices = [
  { name: 'button — Translate button only (ephemeral)', value: 'button' },
  { name: 'auto — Auto-reply non-English with English translation', value: 'auto' }
] as const;

const MODE_DESCRIPTIONS: Record<GuildMode, string> = {
  button: 'All messages get a 🌐 button; translations are shown only to the user who clicks (ephemeral).',
  auto: 'Non-English messages get an automatic English translation reply; English messages get a 🌐 button.'
};

export const modeCommand = new SlashCommandBuilder()
  .setName('mode')
  .setDescription('Manage translation delivery mode for this server')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false)
  .addSubcommand((subcommand) =>
    subcommand
      .setName('set')
      .setDescription('Set the translation delivery mode')
      .addStringOption((option: SlashCommandStringOption) =>
        option
          .setName('mode')
          .setDescription('Delivery mode')
          .setRequired(true)
          .addChoices(...modeChoices)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand.setName('show').setDescription('Show the current delivery mode')
  );

export async function executeModeCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'set') {
    const mode = interaction.options.getString('mode', true) as GuildMode;
    setGuildMode(guildId, mode);
    await interaction.reply({
      content: `Mode set to **${mode}**.\n${MODE_DESCRIPTIONS[mode]}`,
      ephemeral: true
    });
    return;
  }

  const mode = getGuildMode(guildId);
  await interaction.reply({
    content: `Current mode: **${mode}**\n${MODE_DESCRIPTIONS[mode]}`,
    ephemeral: true
  });
}
