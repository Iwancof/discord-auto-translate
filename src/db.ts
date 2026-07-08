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

  const gsSchema = db.prepare(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='guild_settings'"
  ).get() as { sql: string } | undefined;

  if (gsSchema && !gsSchema.sql.includes('official_lang')) {
    db.exec('ALTER TABLE guild_settings RENAME TO _guild_settings_v1');
    db.exec(`
      CREATE TABLE guild_settings (
        guild_id TEXT PRIMARY KEY,
        mode TEXT NOT NULL CHECK (mode IN ('auto', 'button')),
        official_lang TEXT NOT NULL DEFAULT 'auto' CHECK (official_lang IN ('auto', 'en', 'ja', 'ko'))
      )
    `);
    db.exec("INSERT INTO guild_settings (guild_id, mode) SELECT guild_id, mode FROM _guild_settings_v1");
    db.exec('DROP TABLE _guild_settings_v1');
  } else if (!gsSchema) {
    db.exec(`
      CREATE TABLE guild_settings (
        guild_id TEXT PRIMARY KEY,
        mode TEXT NOT NULL CHECK (mode IN ('auto', 'button')),
        official_lang TEXT NOT NULL DEFAULT 'auto' CHECK (official_lang IN ('auto', 'en', 'ja', 'ko'))
      )
    `);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS lang_stats (
      guild_id TEXT NOT NULL,
      lang TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (guild_id, lang)
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

  db.exec(`
    CREATE TABLE IF NOT EXISTS glossary (
      guild_id TEXT NOT NULL,
      term TEXT NOT NULL,
      rendering TEXT,
      PRIMARY KEY (guild_id, term)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS budget_alerts (
      month_key TEXT PRIMARY KEY,
      alerted_at INTEGER NOT NULL
    )
  `);

  return db;
}

export type GuildMode = 'auto' | 'button';
export type OfficialLangSetting = 'auto' | 'en' | 'ja' | 'ko';

export interface LangStat {
  lang: string;
  count: number;
}

export function resolveOfficialLang(setting: OfficialLangSetting, stats: LangStat[]): UserLang {
  if (setting !== 'auto') return setting;
  const total = stats.reduce((s, e) => s + e.count, 0);
  if (total < 10) return 'en';
  return (stats[0]?.lang ?? 'en') as UserLang;
}

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

export function getOfficialLangSetting(guildId: string): OfficialLangSetting {
  const row = getDb()
    .prepare('SELECT official_lang FROM guild_settings WHERE guild_id = ?')
    .get(guildId) as { official_lang: OfficialLangSetting } | undefined;
  return row?.official_lang ?? 'auto';
}

export function setOfficialLangSetting(guildId: string, lang: OfficialLangSetting): void {
  getDb()
    .prepare(
      `INSERT INTO guild_settings (guild_id, mode, official_lang)
       VALUES (?, 'button', ?)
       ON CONFLICT(guild_id) DO UPDATE SET official_lang = excluded.official_lang`
    )
    .run(guildId, lang);
}

export function incrementLangStat(guildId: string, lang: string): void {
  getDb()
    .prepare(
      `INSERT INTO lang_stats (guild_id, lang, count)
       VALUES (?, ?, 1)
       ON CONFLICT(guild_id, lang) DO UPDATE SET count = count + 1`
    )
    .run(guildId, lang);
}

export function getLangStats(guildId: string): LangStat[] {
  return getDb()
    .prepare('SELECT lang, count FROM lang_stats WHERE guild_id = ? ORDER BY count DESC')
    .all(guildId) as LangStat[];
}

export function getEffectiveOfficialLang(guildId: string): UserLang {
  const setting = getOfficialLangSetting(guildId);
  const stats = getLangStats(guildId);
  return resolveOfficialLang(setting, stats);
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

// --- Glossary ---

export interface GlossaryEntry {
  term: string;
  rendering: string | null;
}

export function addGlossaryEntry(guildId: string, term: string, rendering: string | null): void {
  getDb()
    .prepare(
      `INSERT INTO glossary (guild_id, term, rendering)
       VALUES (?, ?, ?)
       ON CONFLICT(guild_id, term) DO UPDATE SET rendering = excluded.rendering`
    )
    .run(guildId, term, rendering);
}

export function removeGlossaryEntry(guildId: string, term: string): boolean {
  const result = getDb()
    .prepare('DELETE FROM glossary WHERE guild_id = ? AND term = ?')
    .run(guildId, term);
  return result.changes > 0;
}

export function getGlossaryEntries(guildId: string): GlossaryEntry[] {
  return getDb()
    .prepare('SELECT term, rendering FROM glossary WHERE guild_id = ? ORDER BY term')
    .all(guildId) as GlossaryEntry[];
}

export function getGlossaryCount(guildId: string): number {
  const row = getDb()
    .prepare('SELECT COUNT(*) AS count FROM glossary WHERE guild_id = ?')
    .get(guildId) as { count: number };
  return row.count;
}

// --- Usage ---

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

// --- Multi-model usage ---

export interface ModelUsageBucket {
  model: string;
  calls: number;
  input: number;
  output: number;
}

export function getUsageSummaryByModel(): { allTime: ModelUsageBucket[]; last7d: ModelUsageBucket[] } {
  const d = getDb();
  const allTime = d
    .prepare(
      'SELECT model, COUNT(*) AS calls, COALESCE(SUM(input_tokens),0) AS input, COALESCE(SUM(output_tokens),0) AS output FROM usage_log GROUP BY model ORDER BY model'
    )
    .all() as ModelUsageBucket[];
  const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 86400;
  const last7d = d
    .prepare(
      'SELECT model, COUNT(*) AS calls, COALESCE(SUM(input_tokens),0) AS input, COALESCE(SUM(output_tokens),0) AS output FROM usage_log WHERE ts >= ? GROUP BY model ORDER BY model'
    )
    .all(sevenDaysAgo) as ModelUsageBucket[];
  return { allTime, last7d };
}

// --- Price table ---

export interface PriceEntry {
  in: number;
  out: number;
}

export function getPriceTable(): Record<string, PriceEntry> {
  const envTable = process.env.PRICE_TABLE_JSON;
  if (envTable) {
    try {
      return JSON.parse(envTable);
    } catch {
      // fall through to default
    }
  }
  return {
    'claude-haiku-4-5': { in: 1, out: 5 },
    'claude-opus-4-8': { in: 5, out: 25 }
  };
}

export function calculateModelCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  priceTable: Record<string, PriceEntry>
): number {
  const price = priceTable[model] ?? { in: 1, out: 5 };
  return (inputTokens / 1e6) * price.in + (outputTokens / 1e6) * price.out;
}

export function getMonthlyTotalUSD(): number {
  const d = getDb();
  const startOfMonth = getStartOfMonthTimestamp();
  const rows = d
    .prepare(
      'SELECT model, COALESCE(SUM(input_tokens),0) AS input, COALESCE(SUM(output_tokens),0) AS output FROM usage_log WHERE ts >= ? GROUP BY model'
    )
    .all(startOfMonth) as Array<{ model: string; input: number; output: number }>;
  const priceTable = getPriceTable();
  return rows.reduce((sum, r) => sum + calculateModelCost(r.model, r.input, r.output, priceTable), 0);
}

function getStartOfMonthTimestamp(): number {
  const now = new Date();
  return Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000);
}

// --- Budget alert ---

export function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function isBudgetAlerted(monthKey: string): boolean {
  const row = getDb()
    .prepare('SELECT 1 FROM budget_alerts WHERE month_key = ?')
    .get(monthKey);
  return !!row;
}

export function markBudgetAlerted(monthKey: string): void {
  getDb()
    .prepare('INSERT OR IGNORE INTO budget_alerts (month_key, alerted_at) VALUES (?, ?)')
    .run(monthKey, Math.floor(Date.now() / 1000));
}

export function checkAndMarkBudgetCrossed(thresholdUsd: number): boolean {
  const monthKey = getCurrentMonthKey();
  if (isBudgetAlerted(monthKey)) return false;
  const total = getMonthlyTotalUSD();
  if (total >= thresholdUsd) {
    markBudgetAlerted(monthKey);
    return true;
  }
  return false;
}
