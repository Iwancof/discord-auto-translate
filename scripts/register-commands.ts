import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { languageCommand } from '../src/commands/language.js';

async function main(): Promise<void> {
  const token = requireEnv('DISCORD_TOKEN');
  const clientId = requireEnv('DISCORD_CLIENT_ID');
  const guildId = process.env.GUILD_ID?.trim();
  const rest = new REST({ version: '10' }).setToken(token);
  const body = [languageCommand.toJSON()];

  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
    console.log(`Registered ${body.length} command(s) for guild ${guildId}.`);
    return;
  }

  await rest.put(Routes.applicationCommands(clientId), { body });
  console.log(`Registered ${body.length} global command(s).`);
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

main().catch((error) => {
  console.error(formatError(error));
  process.exitCode = 1;
});
