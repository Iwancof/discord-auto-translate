import { config as loadEnv } from 'dotenv';
loadEnv({ override: true });
import {
  ApplicationCommandType,
  Client,
  ContextMenuCommandBuilder,
  Events,
  GatewayIntentBits,
  MessageFlags,
  Partials,
  Team,
  User,
  type ButtonInteraction,
  type MessageContextMenuCommandInteraction
} from 'discord.js';
import { executeLanguageCommand, formatLang, languageCommand } from './commands/language.js';
import { executeModeCommand, modeCommand } from './commands/mode.js';
import { executeUsageCommand, usageCommand } from './commands/usage.js';
import { executeGlossaryCommand, glossaryCommand } from './commands/glossary.js';
import { executeTranslateCommand, translateCommand } from './commands/translate.js';
import { executeSummarizeCommand, summarizeCommand } from './commands/summarize.js';
import { executeOfficialLangCommand, officialLangCommand } from './commands/officiallang.js';
import { executeTransCommand, transCommand } from './commands/trans.js';
import {
  checkAndMarkBudgetCrossed,
  getEffectiveOfficialLang,
  getGlossaryEntries,
  getGuildMode,
  getMonthlyTotalUSD,
  getUserLang,
  incrementLangStat,
  type UserLang
} from './db.js';
import {
  AutoReplyDelivery,
  CompanionTracker,
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
const companionTracker = new CompanionTracker();

const translateContextMenu = new ContextMenuCommandBuilder()
  .setName('Translate')
  .setType(ApplicationCommandType.Message);

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
    ],
    partials: [Partials.Message]
  });

  client.once(Events.ClientReady, async (readyClient) => {
    console.log(`Logged in as ${readyClient.user.tag}.`);
    await readyClient.application.commands.set([
      languageCommand.toJSON(),
      modeCommand.toJSON(),
      usageCommand.toJSON(),
      glossaryCommand.toJSON(),
      translateCommand.toJSON(),
      summarizeCommand.toJSON(),
      officialLangCommand.toJSON(),
      transCommand.toJSON(),
      translateContextMenu.toJSON()
    ]);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isChatInputCommand()) {
      try {
        switch (interaction.commandName) {
          case 'language':
            await executeLanguageCommand(interaction);
            break;
          case 'mode':
            await executeModeCommand(interaction);
            break;
          case 'usage':
            await executeUsageCommand(interaction);
            break;
          case 'glossary':
            await executeGlossaryCommand(interaction);
            break;
          case 'translate':
            await executeTranslateCommand(interaction);
            await maybeSendBudgetAlert(client);
            break;
          case 'summarize':
            await executeSummarizeCommand(interaction, client.user!.id);
            await maybeSendBudgetAlert(client);
            break;
          case 'officiallang':
            await executeOfficialLangCommand(interaction);
            break;
          case 'trans':
            await executeTransCommand(interaction, client.user!.id);
            await maybeSendBudgetAlert(client);
            break;
          default:
            return;
        }
      } catch (error) {
        const content = `Failed to handle /${interaction.commandName}: ${formatError(error)}`;
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content, ephemeral: true });
        } else {
          await interaction.reply({ content, ephemeral: true });
        }
      }
      return;
    }

    if (interaction.isMessageContextMenuCommand() && interaction.commandName === 'Translate') {
      await handleTranslateContextMenu(interaction, client);
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('tr:')) {
      await handleTranslateButton(interaction, client);
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
      const glossary = message.guildId ? getGlossaryEntries(message.guildId) : [];

      if (message.guildId) {
        incrementLangStat(message.guildId, sourceLang);
      }

      const guildMode = message.guildId ? getGuildMode(message.guildId) : 'button';
      const officialLang = message.guildId ? getEffectiveOfficialLang(message.guildId) : 'en';
      const action = resolveDispatch(sourceLang, deliveryMode, guildMode, officialLang);
      switch (action.type) {
        case 'none':
          break;
        case 'log': {
          const translation = await translate(translatable, action.targetLang, context, { glossary });
          if (translation) {
            new LogOnlyDelivery().deliver(message, translation, action.targetLang);
          }
          break;
        }
        case 'auto-reply': {
          await message.channel.sendTyping();
          const translation = await translate(translatable, action.targetLang, context, { glossary });
          if (translation) {
            const botMsg = await new AutoReplyDelivery().deliver(message, translation, action.targetLang);
            companionTracker.track(message.id, botMsg.id);
          }
          await maybeSendBudgetAlert(client);
          break;
        }
        case 'button-only': {
          const botMsg = await postTranslateButton(message);
          if (botMsg) companionTracker.track(message.id, botMsg.id);
          break;
        }
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

  client.on(Events.MessageUpdate, async (_oldMessage, newMessage) => {
    try {
      const msg = newMessage.partial ? await newMessage.fetch() : newMessage;
      if (msg.author.bot || msg.webhookId) return;

      translationCache.invalidateMessage(msg.id);

      const companionId = companionTracker.get(msg.id);
      if (!companionId) return;

      const translatable = extractTranslatable(msg.content);
      if (!translatable) {
        try {
          const channel = msg.channel;
          if (channel && 'messages' in channel) {
            const companion = await channel.messages.fetch(companionId);
            await companion.delete();
          }
        } catch { /* companion already deleted */ }
        companionTracker.remove(msg.id);
        return;
      }

      const glossary = msg.guildId ? getGlossaryEntries(msg.guildId) : [];
      const context = getContext(msg.channelId);
      const editTargetLang = msg.guildId ? getEffectiveOfficialLang(msg.guildId) : 'en';
      const translation = await translate(translatable, editTargetLang, context, { glossary });
      if (translation) {
        const channel = msg.channel;
        if (channel && 'messages' in channel) {
          const companion = await channel.messages.fetch(companionId);
          await companion.edit({ content: translation });
        }
      }
    } catch (error) {
      console.error(`Edit tracking failed: ${formatError(error)}`);
    }
  });

  client.on(Events.MessageDelete, async (message) => {
    translationCache.invalidateMessage(message.id);
    const companionId = companionTracker.remove(message.id);
    if (!companionId) return;

    try {
      const channel = message.channel;
      if (channel && 'messages' in channel) {
        const companion = await channel.messages.fetch(companionId);
        await companion.delete();
      }
    } catch { /* companion already deleted */ }
  });

  await client.login(token);
}

async function translateForUser(
  messageId: string,
  content: string,
  userLang: UserLang,
  guildId: string | null,
  channelId: string
): Promise<string> {
  const translatable = extractTranslatable(content);
  if (!translatable) return '(Nothing to translate)';

  const sourceLang = detectLanguage(translatable);
  if (userLang === sourceLang) {
    return `This message is already in your language (${formatLang(userLang)}). Use \`/language set\` to pick a different one.`;
  }

  const cached = translationCache.get(messageId, userLang);
  if (cached) return cached;

  const glossary = guildId ? getGlossaryEntries(guildId) : [];
  const context = getContext(channelId);
  const translation = await translate(translatable, userLang, context, { allowSkip: false, glossary });
  if (translation) {
    translationCache.set(messageId, userLang, translation);
    return translation;
  }
  return '(Empty translation — try again)';
}

async function handleTranslateButton(interaction: ButtonInteraction, client: Client): Promise<void> {
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
    const result = await translateForUser(messageId, originalMsg.content, userLang, interaction.guildId, interaction.channelId);
    await interaction.editReply({ content: result });
    await maybeSendBudgetAlert(client);
  } catch (error) {
    console.error(`Button translation failed: ${formatError(error)}`);
    await interaction.editReply({ content: `Translation failed: ${formatError(error)}` });
  }
}

async function handleTranslateContextMenu(
  interaction: MessageContextMenuCommandInteraction,
  client: Client
): Promise<void> {
  const targetMessage = interaction.targetMessage;
  const userLang = getUserLang(interaction.user.id);

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const result = await translateForUser(
      targetMessage.id,
      targetMessage.content,
      userLang,
      interaction.guildId,
      interaction.channelId
    );
    await interaction.editReply({ content: result });
    await maybeSendBudgetAlert(client);
  } catch (error) {
    console.error(`Context menu translation failed: ${formatError(error)}`);
    await interaction.editReply({ content: `Translation failed: ${formatError(error)}` });
  }
}

async function maybeSendBudgetAlert(client: Client): Promise<void> {
  const threshold = Number(process.env.BUDGET_ALERT_USD) || 30;
  if (!checkAndMarkBudgetCrossed(threshold)) return;

  const total = getMonthlyTotalUSD();
  const alertMsg = `⚠️ Translation bot monthly spending has reached **$${total.toFixed(2)}** (alert threshold: $${threshold}).`;

  try {
    const app = await client.application!.fetch();
    const owner = app.owner;
    if (!owner) return;

    if (owner instanceof User) {
      await owner.send(alertMsg);
    } else if (owner instanceof Team && owner.ownerId) {
      const teamOwner = owner.members.get(owner.ownerId);
      if (teamOwner?.user) {
        await teamOwner.user.send(alertMsg);
      }
    }
  } catch (error) {
    console.error(`Budget alert DM failed: ${formatError(error)}`);
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
