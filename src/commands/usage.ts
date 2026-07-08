import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { getUsageSummary, type UsageBucket } from '../db.js';

const PRICE_IN_PER_MTOK = Number(process.env.PRICE_IN_PER_MTOK) || 1;
const PRICE_OUT_PER_MTOK = Number(process.env.PRICE_OUT_PER_MTOK) || 5;

export const usageCommand = new SlashCommandBuilder()
  .setName('usage')
  .setDescription('Show API usage statistics and estimated cost')
  .setDMPermission(false);

function estimateCost(bucket: UsageBucket): string {
  const cost = (bucket.input / 1e6) * PRICE_IN_PER_MTOK + (bucket.output / 1e6) * PRICE_OUT_PER_MTOK;
  return cost.toFixed(4);
}

function formatBucket(label: string, bucket: UsageBucket): string {
  return `**${label}**: ${bucket.calls} calls | ${bucket.input.toLocaleString()} in / ${bucket.output.toLocaleString()} out tokens | ~$${estimateCost(bucket)}`;
}

export async function executeUsageCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const { allTime, last7d } = getUsageSummary();
  const lines = [formatBucket('All time', allTime), formatBucket('Last 7 days', last7d)];
  await interaction.reply({ content: lines.join('\n'), ephemeral: true });
}
