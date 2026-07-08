# Discord Translator Bot

Asymmetric Discord translation bot powered by Claude (Anthropic API).

- **Non-English messages** (Japanese) are automatically replied with an English translation.
- **English messages** get a "Translate" button; pressing it shows an ephemeral translation in the user's preferred language.

## Discord Setup

1. Create an application in the Discord Developer Portal.
2. Add a bot user.
3. In **Bot > Privileged Gateway Intents**, enable **MESSAGE CONTENT INTENT**.
4. Invite the bot with scopes `bot` and `applications.commands`.
5. Grant these bot permissions: **View Channels**, **Send Messages**, **Read Message History**.

Invite URL template:

```text
https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&scope=bot%20applications.commands&permissions=68608
```

## Configuration

```sh
cp .env.example .env
```

Set:

- `DISCORD_TOKEN` — bot token from Developer Portal
- `ANTHROPIC_API_KEY` — Anthropic API key
- `ANTHROPIC_MODEL` — defaults to `claude-haiku-4-5`
- `GUILD_ID` — optional; not currently used
- `DELIVERY_MODE` — `auto` (default, full translation) or `log_only` (development, stdout only)

## Commands

Install dependencies:

```sh
npm install
```

Run in development:

```sh
npm run dev
```

Build and test:

```sh
npm run build
npm test
```

## Slash Commands

- `/language set <English|Japanese>` saves the user's preferred language.
- `/language show` shows the saved language. Unset users default to English.

Slash commands are registered automatically when the bot starts.

## Deployment (systemd user service)

Copy `deploy/auto-translate.service` to your systemd user directory and enable it:

```sh
mkdir -p ~/.config/systemd/user
cp deploy/auto-translate.service ~/.config/systemd/user/
systemctl --user enable --now auto-translate.service
loginctl enable-linger "$USER"
```
