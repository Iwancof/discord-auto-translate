import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getGuildMode, getUserLang, setGuildMode, setUserLang, _resetDb } from '../src/db.js';

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
