# Discord Translator Bot

[![CI](https://github.com/Iwancof/discord-auto-translate/actions/workflows/ci.yml/badge.svg)](https://github.com/Iwancof/discord-auto-translate/actions/workflows/ci.yml)

Discord translation bot powered by Claude (Anthropic API).

Each server has an **official language** (auto-detected or manually set). Messages in the official language pass through silently; messages in other languages get a translate button or automatic translation depending on the delivery mode.

## How it works

1. A message arrives in the server.
2. The bot detects the message language (English / Japanese / Korean).
3. Dispatch depends on the **delivery mode** and the server's **official language**:

| Delivery mode | Message = official lang | Message ≠ official lang |
|---|---|---|
| **button** (default) | Nothing | 🌐 Translate button |
| **auto** | Nothing | Auto-reply with official-lang translation + 🌐 button |

4. Pressing the 🌐 button (or right-click → Translate) shows an ephemeral translation in the user's personal language (set via `/language set`).

## Slash Commands

| Command | Description | Permission |
|---|---|---|
| `/language set <lang>` | Set your preferred translation language | Everyone |
| `/language show` | Show your current language | Everyone |
| `/officiallang set <Auto\|English\|Japanese\|Korean>` | Set the server's official language | Manage Server |
| `/officiallang show` | Show the official language (with auto-detection stats) | Everyone |
| `/mode set <button\|auto>` | Set the delivery mode | Manage Server |
| `/mode show` | Show the current delivery mode | Everyone |
| `/trans [count:N]` | Translate recent N messages (default 4, max 20) | Everyone |
| `/trans [message:<ID or link>]` | Translate a specific message | Everyone |
| `/translate <text> [to:<lang>]` | Translate arbitrary text (ephemeral) | Everyone |
| `/glossary add <term> [rendering]` | Add a glossary term | Manage Server |
| `/glossary remove <term>` | Remove a glossary term | Manage Server |
| `/glossary list` | List glossary entries | Everyone |
| `/summarize [count] [lang]` | Summarize recent conversation | Everyone |
| `/usage` | Show API usage statistics | Everyone |
| Right-click → **Translate** | Context menu translation | Everyone |

Slash commands are registered automatically when the bot starts.

## Official Language

The official language determines which messages are "native" and need no translation:

- **Auto** (default): The bot detects the most-used language after 10+ messages. Until then, defaults to English.
- **Manual**: Set explicitly with `/officiallang set`. Overrides auto-detection.

Use `/officiallang show` to see the current effective language and detection stats.

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
- `DELIVERY_MODE` — `auto` (default, full translation) or `log_only` (development, stdout only)
- `SUMMARIZE_MODEL` — model for /summarize (default `claude-opus-4-8`)
- `PRICE_TABLE_JSON` — JSON object mapping model names to `{in, out}` per-Mtok prices
- `BUDGET_ALERT_USD` — monthly spending alert threshold (default `30`)

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
