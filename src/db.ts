import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export type UserLang = 'en' | 'ja';

const dbPath = resolve(process.cwd(), 'data', 'bot.db');

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (db) {
    return db;
  }

  mkdirSync(dirname(dbPath), { recursive: true });
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_prefs (
      user_id TEXT PRIMARY KEY,
      lang TEXT NOT NULL CHECK (lang IN ('en', 'ja'))
    )
  `);
  return db;
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
