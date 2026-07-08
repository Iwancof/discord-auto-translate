import { existsSync, readFileSync } from 'node:fs';

const env = { ...process.env, ...readDotEnv() };
const missing = ['DISCORD_TOKEN', 'ANTHROPIC_API_KEY'].filter(
  (name) => !env[name]?.trim()
);

if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const deliveryMode = env.DELIVERY_MODE?.trim() || 'auto';
if (!['auto', 'log_only'].includes(deliveryMode)) {
  console.error(`Unsupported DELIVERY_MODE "${deliveryMode}". Supported: auto, log_only.`);
  process.exit(1);
}

function readDotEnv() {
  if (!existsSync('.env')) {
    return {};
  }

  const values = {};
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    values[key] = rawValue.replace(/^(['"])(.*)\1$/, '$2');
  }
  return values;
}
