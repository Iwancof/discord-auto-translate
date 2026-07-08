import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction
} from 'discord.js';
import { addGlossaryEntry, getGlossaryCount, getGlossaryEntries, removeGlossaryEntry } from '../db.js';

const GLOSSARY_LIMIT = 100;

export const glossaryCommand = new SlashCommandBuilder()
  .setName('glossary')
  .setDescription('Manage translation glossary for this server')
  .setDMPermission(false)
  .addSubcommand((sub) =>
    sub
      .setName('add')
      .setDescription('Add a term to the glossary (requires Manage Server)')
      .addStringOption((opt) => opt.setName('term').setDescription('Term to add').setRequired(true))
      .addStringOption((opt) =>
        opt.setName('rendering').setDescription('Translation (omit to keep as-is)').setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('remove')
      .setDescription('Remove a term from the glossary (requires Manage Server)')
      .addStringOption((opt) =>
        opt.setName('term').setDescription('Term to remove').setRequired(true)
      )
  )
  .addSubcommand((sub) => sub.setName('list').setDescription('List all glossary terms'));

export async function executeGlossaryCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    return;
  }

  const sub = interaction.options.getSubcommand();

  if (sub === 'add') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        content: 'You need **Manage Server** permission to modify the glossary.',
        ephemeral: true
      });
      return;
    }
    const term = interaction.options.getString('term', true).trim();
    const rendering = interaction.options.getString('rendering')?.trim() ?? null;
    const existing = getGlossaryEntries(guildId).some((e) => e.term === term);
    if (!existing && getGlossaryCount(guildId) >= GLOSSARY_LIMIT) {
      await interaction.reply({
        content: `Glossary is full (${GLOSSARY_LIMIT} terms). Remove a term first.`,
        ephemeral: true
      });
      return;
    }
    addGlossaryEntry(guildId, term, rendering);
    const desc = rendering ? `"${term}" → "${rendering}"` : `"${term}" (keep as-is)`;
    await interaction.reply({ content: `Glossary updated: ${desc}`, ephemeral: true });
    return;
  }

  if (sub === 'remove') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        content: 'You need **Manage Server** permission to modify the glossary.',
        ephemeral: true
      });
      return;
    }
    const term = interaction.options.getString('term', true).trim();
    const removed = removeGlossaryEntry(guildId, term);
    await interaction.reply({
      content: removed ? `Removed "${term}" from glossary.` : `"${term}" was not in the glossary.`,
      ephemeral: true
    });
    return;
  }

  const entries = getGlossaryEntries(guildId);
  if (entries.length === 0) {
    await interaction.reply({ content: 'Glossary is empty.', ephemeral: true });
    return;
  }
  const lines = entries.map((e) =>
    e.rendering ? `• **${e.term}** → ${e.rendering}` : `• **${e.term}** (keep as-is)`
  );
  await interaction.reply({
    content: `**Glossary** (${entries.length}/${GLOSSARY_LIMIT}):\n${lines.join('\n')}`,
    ephemeral: true
  });
}
