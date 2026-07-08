import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export type UserLang = 'en' | 'ja' | 'ko';

let db: Database.Database | null = null;

export function _resetDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

function getDb(): Database.Database {
  if (db) {
    return db;
  }

  const dbPath = process.env.BOT_DB_PATH ?? resolve(process.cwd(), 'data', 'bot.db');
  mkdirSync(dirname(dbPath), { recursive: true });
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  const existing = db.prepare(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='user_prefs'"
  ).get() as { sql: string } | undefined;

  if (existing && !existing.sql.includes("'ko'")) {
    db.exec('ALTER TABLE user_prefs RENAME TO _user_prefs_v1');
    db.exec(`
      CREATE TABLE user_prefs (
        user_id TEXT PRIMARY KEY,
        lang TEXT NOT NULL CHECK (lang IN ('en', 'ja', 'ko'))
      )
    `);
    db.exec('INSERT INTO user_prefs SELECT * FROM _user_prefs_v1');
    db.exec('DROP TABLE _user_prefs_v1');
  } else if (!existing) {
    db.exec(`
      CREATE TABLE user_prefs (
        user_id TEXT PRIMARY KEY,
        lang TEXT NOT NULL CHECK (lang IN ('en', 'ja', 'ko'))
      )
    `);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS guild_settings (
      guild_id TEXT PRIMARY KEY,
      mode TEXT NOT NULL CHECK (mode IN ('auto', 'button'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS usage_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      model TEXT NOT NULL,
      input_tokens INTEGER NOT NULL,
      output_tokens INTEGER NOT NULL
    )
  `);

  return db;
}

export type GuildMode = 'auto' | 'button';

export function getGuildMode(guildId: string): GuildMode {
  const row = getDb()
    .prepare('SELECT mode FROM guild_settings WHERE guild_id = ?')
    .get(guildId) as { mode: GuildMode } | undefined;
  return row?.mode ?? 'button';
}

export function setGuildMode(guildId: string, mode: GuildMode): void {
  getDb()
    .prepare(
      `INSERT INTO guild_settings (guild_id, mode)
       VALUES (?, ?)
       ON CONFLICT(guild_id) DO UPDATE SET mode = excluded.mode`
    )
    .run(guildId, mode);
}

export function getUserLang(userId: string): UserLang {
  const row = getDb()
    .prepare('SELECT lang FROM user_prefs WHERE user_id = ?')
    .get(userId) as { lang: UserLang } | undefined;

  return row?.lang ?? 'en';
}

export function setUserLang(userId: string, lang: UserLang): void {
  getDb()
    .prepare(
      `INSERT INTO user_prefs (user_id, lang)
       VALUES (?, ?)
       ON CONFLICT(user_id) DO UPDATE SET lang = excluded.lang`
    )
    .run(userId, lang);
}

export function recordUsage(model: string, inputTokens: number, outputTokens: number): void {
  getDb()
    .prepare('INSERT INTO usage_log (ts, model, input_tokens, output_tokens) VALUES (?, ?, ?, ?)')
    .run(Math.floor(Date.now() / 1000), model, inputTokens, outputTokens);
}

export interface UsageBucket {
  calls: number;
  input: number;
  output: number;
}

export function getUsageSummary(): { allTime: UsageBucket; last7d: UsageBucket } {
  const d = getDb();
  const allTime = d
    .prepare('SELECT COUNT(*) AS calls, COALESCE(SUM(input_tokens),0) AS input, COALESCE(SUM(output_tokens),0) AS output FROM usage_log')
    .get() as UsageBucket;
  const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 86400;
  const last7d = d
    .prepare('SELECT COUNT(*) AS calls, COALESCE(SUM(input_tokens),0) AS input, COALESCE(SUM(output_tokens),0) AS output FROM usage_log WHERE ts >= ?')
    .get(sevenDaysAgo) as UsageBucket;
  return { allTime, last7d };
}
