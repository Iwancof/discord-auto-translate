# Discord Translator Bot

[![CI](https://github.com/Iwancof/discord-auto-translate/actions/workflows/ci.yml/badge.svg)](https://github.com/Iwancof/discord-auto-translate/actions/workflows/ci.yml)

Discord translation bot powered by Claude (Anthropic API).

All messages (English, Japanese, Korean) get a "Translate" button. Pressing it shows an ephemeral translation in the user's preferred language (set via `/language set`).

Server admins can switch between two delivery modes with `/mode set`:

- **button** (default) — All messages get a 🌐 button; translations are shown only to the user who clicks (ephemeral).
- **auto** — Non-English messages get an automatic public English translation reply (with a 🌐 button); English messages get a button only.

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
- `PRICE_IN_PER_MTOK` — input token price per million tokens (default `1`)
- `PRICE_OUT_PER_MTOK` — output token price per million tokens (default `5`)

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

- `/language set <English|Japanese|Korean>` saves the user's preferred language.
- `/language show` shows the saved language. Unset users default to English.
- `/mode set <button|auto>` sets the server's delivery mode (requires **Manage Server** permission).
- `/mode show` shows the current delivery mode.
- `/usage` shows API usage statistics (call count, token totals, estimated cost) for all time and the last 7 days.

Slash commands are registered automatically when the bot starts.

## Deployment (systemd user service)

Copy `deploy/auto-translate.service` to your systemd user directory and enable it:

```sh
mkdir -p ~/.config/systemd/user
cp deploy/auto-translate.service ~/.config/systemd/user/
systemctl --user enable --now auto-translate.service
loginctl enable-linger "$USER"
```

## CI/CD

**CI** runs on every push to `main` and on pull requests via GitHub Actions (`.github/workflows/ci.yml`): checkout → install → build → test.

**CD** uses a systemd timer that checks for updates every 10 minutes:

```sh
cp deploy/auto-translate-update.service deploy/auto-translate-update.timer ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now auto-translate-update.timer
```

The update script (`deploy/update.sh`) fetches `origin/main`, and if the local HEAD differs, pulls with `--ff-only`, runs `npm ci && npm run build && npm test`, then restarts the service. If tests fail, the service is not restarted.

Manual deploy:

```sh
bash deploy/update.sh
```
