import 'dotenv/config';
import { Client, Events, GatewayIntentBits } from 'discord.js';
import { executeLanguageCommand } from './commands/language.js';
import type { UserLang } from './db.js';
import { LogOnlyDelivery, type DeliveryStrategy } from './delivery.js';
import { detectLanguage } from './detect.js';
import { extractTranslatable, shouldTranslate } from './filter.js';
import { translate, type ChatContextItem } from './translator.js';

const CONTEXT_LIMIT = 8;
const contextByChannel = new Map<string, ChatContextItem[]>();

async function main(): Promise<void> {
  const env = validateEnv();

  const delivery = createDeliveryStrategy();
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });

  client.once(Events.ClientReady, (readyClient) => {
    console.log(`Logged in as ${readyClient.user.tag}.`);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'language') {
      return;
    }

    try {
      await executeLanguageCommand(interaction);
    } catch (error) {
      const content = `Failed to handle /language: ${formatError(error)}`;
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content, ephemeral: true });
      } else {
        await interaction.reply({ content, ephemeral: true });
      }
    }
  });

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || message.webhookId) {
      return;
    }

    const context = getContext(message.channelId);
    try {
      if (!shouldTranslate(message)) {
        return;
      }

      const translatable = extractTranslatable(message.content);
      if (!translatable) {
        return;
      }

      const sourceLang = detectLanguage(translatable);
      const targetLang: UserLang = sourceLang === 'ja' ? 'en' : 'ja';
      const translation = await translate(translatable, targetLang, context);

      if (translation) {
        await delivery.deliver(message, translation, targetLang);
      }
    } catch (error) {
      console.error(`Translation failed for message ${message.id}: ${formatError(error)}`);
    } finally {
      rememberMessage(message.channelId, {
        authorName: message.member?.displayName ?? message.author.username,
        content: message.content
      });
    }
  });

  await client.login(env.DISCORD_TOKEN);
}

function validateEnv(): { DISCORD_TOKEN: string; DISCORD_CLIENT_ID: string; OPENAI_API_KEY: string } {
  const missing = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'OPENAI_API_KEY'].filter(
    (name) => !process.env[name]?.trim()
  );

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    DISCORD_TOKEN: process.env.DISCORD_TOKEN as string,
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID as string,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY as string
  };
}

function createDeliveryStrategy(): DeliveryStrategy {
  const mode = process.env.DELIVERY_MODE?.trim() || 'log_only';
  if (mode === 'log_only') {
    return new LogOnlyDelivery();
  }

  throw new Error(`Unsupported DELIVERY_MODE "${mode}". Currently supported: log_only.`);
}

function getContext(channelId: string): readonly ChatContextItem[] {
  return contextByChannel.get(channelId) ?? [];
}

function rememberMessage(channelId: string, item: ChatContextItem): void {
  const context = contextByChannel.get(channelId) ?? [];
  context.push(item);
  if (context.length > CONTEXT_LIMIT) {
    context.shift();
  }
  contextByChannel.set(channelId, context);
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

main().catch((error) => {
  console.error(formatError(error));
  process.exitCode = 1;
});
