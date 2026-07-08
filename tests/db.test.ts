import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getGuildMode, getUsageSummary, getUserLang, recordUsage, setGuildMode, setUserLang, _resetDb } from '../src/db.js';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'db-test-'));
  process.env.BOT_DB_PATH = join(tempDir, 'test.db');
  _resetDb();
});

afterEach(() => {
  _resetDb();
  rmSync(tempDir, { recursive: true, force: true });
  delete process.env.BOT_DB_PATH;
});

describe('getUserLang', () => {
  it('returns en for unknown user', () => {
    expect(getUserLang('unknown-user-123')).toBe('en');
  });
});

describe('setUserLang / getUserLang roundtrip', () => {
  it('stores and retrieves en', () => {
    setUserLang('user-1', 'en');
    expect(getUserLang('user-1')).toBe('en');
  });

  it('stores and retrieves ja', () => {
    setUserLang('user-2', 'ja');
    expect(getUserLang('user-2')).toBe('ja');
  });

  it('stores and retrieves ko', () => {
    setUserLang('user-3', 'ko');
    expect(getUserLang('user-3')).toBe('ko');
  });

  it('overwrites previous value', () => {
    setUserLang('user-4', 'en');
    expect(getUserLang('user-4')).toBe('en');
    setUserLang('user-4', 'ko');
    expect(getUserLang('user-4')).toBe('ko');
  });
});

describe('CHECK constraint', () => {
  it('rejects invalid lang values at the DB level', () => {
    getUserLang('seed');
    const dbPath = process.env.BOT_DB_PATH!;
    const raw = new Database(dbPath);
    expect(() =>
      raw.prepare("INSERT INTO user_prefs (user_id, lang) VALUES ('x', 'fr')").run()
    ).toThrow();
    raw.close();
  });
});

describe('getGuildMode', () => {
  it('returns button for unknown guild', () => {
    expect(getGuildMode('unknown-guild-123')).toBe('button');
  });
});

describe('setGuildMode / getGuildMode roundtrip', () => {
  it('stores and retrieves auto', () => {
    setGuildMode('guild-1', 'auto');
    expect(getGuildMode('guild-1')).toBe('auto');
  });

  it('stores and retrieves button', () => {
    setGuildMode('guild-2', 'button');
    expect(getGuildMode('guild-2')).toBe('button');
  });

  it('overwrites previous value', () => {
    setGuildMode('guild-3', 'auto');
    expect(getGuildMode('guild-3')).toBe('auto');
    setGuildMode('guild-3', 'button');
    expect(getGuildMode('guild-3')).toBe('button');
  });

  it('different guilds have independent settings', () => {
    setGuildMode('guild-a', 'auto');
    setGuildMode('guild-b', 'button');
    expect(getGuildMode('guild-a')).toBe('auto');
    expect(getGuildMode('guild-b')).toBe('button');
  });
});

describe('guild_settings CHECK constraint', () => {
  it('rejects invalid mode values at the DB level', () => {
    getGuildMode('seed');
    const dbPath = process.env.BOT_DB_PATH!;
    const raw = new Database(dbPath);
    expect(() =>
      raw.prepare("INSERT INTO guild_settings (guild_id, mode) VALUES ('x', 'invalid')").run()
    ).toThrow();
    raw.close();
  });
});

describe('recordUsage / getUsageSummary', () => {
  it('returns zero counts when no usage recorded', () => {
    const summary = getUsageSummary();
    expect(summary.allTime).toEqual({ calls: 0, input: 0, output: 0 });
    expect(summary.last7d).toEqual({ calls: 0, input: 0, output: 0 });
  });

  it('records and summarizes usage', () => {
    recordUsage('claude-haiku-4-5', 100, 20);
    recordUsage('claude-haiku-4-5', 200, 40);
    const summary = getUsageSummary();
    expect(summary.allTime).toEqual({ calls: 2, input: 300, output: 60 });
    expect(summary.last7d).toEqual({ calls: 2, input: 300, output: 60 });
  });

  it('excludes old records from last7d', () => {
    recordUsage('claude-haiku-4-5', 100, 20);
    const dbPath = process.env.BOT_DB_PATH!;
    const raw = new Database(dbPath);
    const oldTs = Math.floor(Date.now() / 1000) - 8 * 86400;
    raw.prepare('INSERT INTO usage_log (ts, model, input_tokens, output_tokens) VALUES (?, ?, ?, ?)').run(oldTs, 'old-model', 500, 100);
    raw.close();

    const summary = getUsageSummary();
    expect(summary.allTime).toEqual({ calls: 2, input: 600, output: 120 });
    expect(summary.last7d).toEqual({ calls: 1, input: 100, output: 20 });
  });
});

describe('usage cost estimation', () => {
  it('computes correct cost with default prices (in=1, out=5 per Mtok)', () => {
    recordUsage('claude-haiku-4-5', 1_000_000, 1_000_000);
    const summary = getUsageSummary();
    const cost = (summary.allTime.input / 1e6) * 1 + (summary.allTime.output / 1e6) * 5;
    expect(cost).toBeCloseTo(6.0, 4);
  });

  it('computes correct cost for fractional tokens', () => {
    recordUsage('claude-haiku-4-5', 500, 200);
    const summary = getUsageSummary();
    const cost = (summary.allTime.input / 1e6) * 1 + (summary.allTime.output / 1e6) * 5;
    expect(cost).toBeCloseTo(0.0015, 4);
  });
});

describe('migration from old schema', () => {
  it('migrates a table without ko in CHECK to the new schema', () => {
    const dbPath = process.env.BOT_DB_PATH!;
    const raw = new Database(dbPath);
    raw.exec(`
      CREATE TABLE user_prefs (
        user_id TEXT PRIMARY KEY,
        lang TEXT NOT NULL CHECK (lang IN ('en', 'ja'))
      )
    `);
    raw.prepare("INSERT INTO user_prefs (user_id, lang) VALUES ('u1', 'ja')").run();
    raw.close();

    expect(getUserLang('u1')).toBe('ja');
    setUserLang('u1', 'ko');
    expect(getUserLang('u1')).toBe('ko');
  });
});
