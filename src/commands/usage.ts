import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import {
  calculateModelCost,
  getPriceTable,
  getUsageSummaryByModel,
  type ModelUsageBucket,
  type PriceEntry
} from '../db.js';

export const usageCommand = new SlashCommandBuilder()
  .setName('usage')
  .setDescription('Show API usage statistics and estimated cost')
  .setDMPermission(false);

function formatModelBucket(
  bucket: ModelUsageBucket,
  priceTable: Record<string, PriceEntry>
): string {
  const cost = calculateModelCost(bucket.model, bucket.input, bucket.output, priceTable);
  return `• ${bucket.model}: ${bucket.calls} calls | ${bucket.input.toLocaleString()} in / ${bucket.output.toLocaleString()} out | ~$${cost.toFixed(4)}`;
}

function formatSection(
  label: string,
  buckets: ModelUsageBucket[],
  priceTable: Record<string, PriceEntry>
): string {
  if (buckets.length === 0) return `**${label}**: no usage`;
  const lines = buckets.map((b) => formatModelBucket(b, priceTable));
  const totalCalls = buckets.reduce((s, b) => s + b.calls, 0);
  const totalCost = buckets.reduce(
    (s, b) => s + calculateModelCost(b.model, b.input, b.output, priceTable),
    0
  );
  lines.push(`Total: ${totalCalls} calls | ~$${totalCost.toFixed(4)}`);
  return `**${label}**:\n${lines.join('\n')}`;
}

export async function executeUsageCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const { allTime, last7d } = getUsageSummaryByModel();
  const priceTable = getPriceTable();
  const sections = [
    formatSection('All time', allTime, priceTable),
    formatSection('Last 7 days', last7d, priceTable)
  ];
  await interaction.reply({ content: sections.join('\n\n'), ephemeral: true });
}
