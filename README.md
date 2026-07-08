# Discord Translator Bot

Display-mode-independent core for a Discord translation bot. The current delivery mode is development-only `log_only`; public replies are intentionally not implemented.

## Discord Setup

1. Create an application in the Discord Developer Portal.
2. Add a bot user.
3. In **Bot > Privileged Gateway Intents**, enable **MESSAGE CONTENT INTENT**.
4. Invite the bot with scopes `bot` and `applications.commands`.
5. Grant these bot permissions for development: **View Channels**, **Send Messages**, **Read Message History**.

Invite URL template:

```text
https://discord.com/oauth2/authorize?client_id=DISCORD_CLIENT_ID&scope=bot%20applications.commands&permissions=68608
```

## Configuration

```sh
cp .env.example .env
```

Set:

- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`
- `OPENAI_API_KEY`
- `OPENAI_MODEL` defaults to `gpt-4.1-mini`
- `GUILD_ID` optional; use it for fast development command registration
- `DELIVERY_MODE` defaults to `log_only`; no other mode is currently implemented

## Commands

Install dependencies:

```sh
npm install
```

Register slash commands:

```sh
npm run register:commands
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

## Current Delivery

`LogOnlyDelivery` writes translations to stdout. Ephemeral context menu or button-based delivery should be added behind `DeliveryStrategy` after the display decision is made.
