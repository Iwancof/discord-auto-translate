import { config as loadEnv } from 'dotenv';
// この bot は自前の .env を正とする(シェルに他プロジェクトの DISCORD_TOKEN が居ても負けない)
loadEnv({ override: true });
import { Client, Events, GatewayIntentBits, MessageFlags, type ButtonInteraction } from 'discord.js';
import { executeLanguageCommand, languageCommand } from './commands/language.js';
import { getUserLang, type UserLang } from './db.js';
import {
  AutoReplyDelivery,
  LogOnlyDelivery,
  postTranslateButton,
  TranslationCache
} from './delivery.js';
import { detectLanguage } from './detect.js';
import { resolveDispatch } from './dispatch.js';
import { extractTranslatable, shouldTranslate } from './filter.js';
import { translate, type ChatContextItem } from './translator.js';

const CONTEXT_LIMIT = 8;
const contextByChannel = new Map<string, ChatContextItem[]>();
const translationCache = new TranslationCache();

async function main(): Promise<void> {
  const token = process.env.DISCORD_TOKEN?.trim();
  if (!token) {
    throw new Error('Missing required environment variable: DISCORD_TOKEN');
  }

  const deliveryMode = process.env.DELIVERY_MODE?.trim() || 'auto';

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });

  client.once(Events.ClientReady, async (readyClient) => {
    console.log(`Logged in as ${readyClient.user.tag}.`);
    await readyClient.application.commands.set([languageCommand.toJSON()]);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isChatInputCommand() && interaction.commandName === 'language') {
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
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('tr:')) {
      await handleTranslateButton(interaction);
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

      const action = resolveDispatch(sourceLang, deliveryMode);
      switch (action.type) {
        case 'log': {
          const translation = await translate(translatable, action.targetLang, context);
          if (translation) {
            new LogOnlyDelivery().deliver(message, translation, action.targetLang);
          }
          break;
        }
        case 'auto-reply': {
          await message.channel.sendTyping();
          const translation = await translate(translatable, action.targetLang, context);
          if (translation) {
            await new AutoReplyDelivery().deliver(message, translation, action.targetLang);
          }
          break;
        }
        case 'button-only':
          await postTranslateButton(message);
          break;
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

  await client.login(token);
}

async function handleTranslateButton(interaction: ButtonInteraction): Promise<void> {
  const messageId = interaction.customId.slice(3);
  const userLang = getUserLang(interaction.user.id);

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const channel = interaction.channel;
    if (!channel) {
      await interaction.editReply({ content: 'Could not access the channel.' });
      return;
    }

    const originalMsg = await channel.messages.fetch(messageId);
    const translatable = extractTranslatable(originalMsg.content);
    if (!translatable) {
      await interaction.editReply({ content: '(Nothing to translate)' });
      return;
    }

    const sourceLang = detectLanguage(translatable);
    if (userLang === sourceLang) {
      await interaction.editReply({
        content: 'Set your language first with `/language set` to see translations.'
      });
      return;
    }

    const cached = translationCache.get(messageId, userLang);
    if (cached) {
      await interaction.editReply({ content: cached });
      return;
    }

    const context = getContext(interaction.channelId);
    const translation = await translate(translatable, userLang, context);
    if (translation) {
      translationCache.set(messageId, userLang, translation);
      await interaction.editReply({ content: translation });
    } else {
      await interaction.editReply({ content: '(Translation skipped)' });
    }
  } catch (error) {
    console.error(`Button translation failed: ${formatError(error)}`);
    await interaction.editReply({ content: `Translation failed: ${formatError(error)}` });
  }
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
