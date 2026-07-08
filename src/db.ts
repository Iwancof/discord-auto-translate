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
