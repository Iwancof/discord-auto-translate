import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type SlashCommandStringOption
} from 'discord.js';
import {
  getOfficialLangSetting,
  setOfficialLangSetting,
  getLangStats,
  resolveOfficialLang,
  type OfficialLangSetting
} from '../db.js';
import { LANG_CHOICES, LANG_NAMES } from '../langs.js';

const langChoices = [{ name: 'Auto (detect from usage)', value: 'auto' }, ...LANG_CHOICES];

export const officialLangCommand = new SlashCommandBuilder()
  .setName('officiallang')
  .setDescription('Manage the official language for this server')
  .setDMPermission(false)
  .addSubcommand((sub) =>
    sub
      .setName('set')
      .setDescription('Set the official language (requires Manage Server)')
      .addStringOption((opt: SlashCommandStringOption) =>
        opt
          .setName('lang')
          .setDescription('Official language')
          .setRequired(true)
          .addChoices(...langChoices)
      )
  )
  .addSubcommand((sub) =>
    sub.setName('show').setDescription('Show the current official language')
  );

export async function executeOfficialLangCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'set') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        content: 'You need **Manage Server** permission to change the official language.',
        ephemeral: true
      });
      return;
    }
    const lang = interaction.options.getString('lang', true) as OfficialLangSetting;
    setOfficialLangSetting(guildId, lang);
    const display = lang === 'auto' ? 'Auto (detect from usage)' : LANG_NAMES[lang];
    await interaction.reply({
      content: `Official language set to **${display}**.`,
      ephemeral: true
    });
    return;
  }

  const setting = getOfficialLangSetting(guildId);
  const stats = getLangStats(guildId);
  const effective = resolveOfficialLang(setting, stats);

  if (setting === 'auto') {
    const total = stats.reduce((s, e) => s + e.count, 0);
    if (total < 10) {
      await interaction.reply({
        content: `Official language: **auto** → ${LANG_NAMES[effective]} (fallback — only ${total} messages detected so far, need 10)`,
        ephemeral: true
      });
    } else {
      const topCount = stats[0]?.count ?? 0;
      const pct = Math.round((topCount / total) * 100);
      await interaction.reply({
        content: `Official language: **auto** → ${LANG_NAMES[effective]} (${pct}% of ${total} messages)`,
        ephemeral: true
      });
    }
  } else {
    await interaction.reply({
      content: `Official language: **${LANG_NAMES[setting]}** (manually set)`,
      ephemeral: true
    });
  }
}
