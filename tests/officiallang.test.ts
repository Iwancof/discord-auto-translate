import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getEffectiveOfficialLang,
  getLangStats,
  getOfficialLangSetting,
  incrementLangStat,
  resolveOfficialLang,
  setOfficialLangSetting,
  _resetDb,
  type LangStat
} from '../src/db.js';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'ol-test-'));
  process.env.BOT_DB_PATH = join(tempDir, 'test.db');
  _resetDb();
});

afterEach(() => {
  _resetDb();
  rmSync(tempDir, { recursive: true, force: true });
  delete process.env.BOT_DB_PATH;
});

describe('resolveOfficialLang (pure function)', () => {
  it('manual en returns en regardless of stats', () => {
    expect(resolveOfficialLang('en', [{ lang: 'ja', count: 100 }])).toBe('en');
  });

  it('manual ja returns ja regardless of stats', () => {
    expect(resolveOfficialLang('ja', [{ lang: 'en', count: 100 }])).toBe('ja');
  });

  it('manual ko returns ko regardless of stats', () => {
    expect(resolveOfficialLang('ko', [])).toBe('ko');
  });

  it('auto with empty stats returns en (fallback)', () => {
    expect(resolveOfficialLang('auto', [])).toBe('en');
  });

  it('auto with total < 10 returns en (fallback)', () => {
    const stats: LangStat[] = [{ lang: 'ja', count: 9 }];
    expect(resolveOfficialLang('auto', stats)).toBe('en');
  });

  it('auto with total = 10 and ja majority returns ja', () => {
    const stats: LangStat[] = [{ lang: 'ja', count: 7 }, { lang: 'en', count: 3 }];
    expect(resolveOfficialLang('auto', stats)).toBe('ja');
  });

  it('auto with total >= 10 and en majority returns en', () => {
    const stats: LangStat[] = [{ lang: 'en', count: 8 }, { lang: 'ja', count: 2 }];
    expect(resolveOfficialLang('auto', stats)).toBe('en');
  });

  it('auto with total >= 10 and ko majority returns ko', () => {
    const stats: LangStat[] = [{ lang: 'ko', count: 15 }, { lang: 'en', count: 5 }];
    expect(resolveOfficialLang('auto', stats)).toBe('ko');
  });
});

describe('officialLangSetting CRUD', () => {
  it('returns auto for unknown guild', () => {
    expect(getOfficialLangSetting('unknown')).toBe('auto');
  });

  it('set and get roundtrip', () => {
    setOfficialLangSetting('g1', 'ja');
    expect(getOfficialLangSetting('g1')).toBe('ja');
  });

  it('overwrites previous value', () => {
    setOfficialLangSetting('g2', 'en');
    expect(getOfficialLangSetting('g2')).toBe('en');
    setOfficialLangSetting('g2', 'ko');
    expect(getOfficialLangSetting('g2')).toBe('ko');
  });

  it('different guilds have independent settings', () => {
    setOfficialLangSetting('ga', 'ja');
    setOfficialLangSetting('gb', 'ko');
    expect(getOfficialLangSetting('ga')).toBe('ja');
    expect(getOfficialLangSetting('gb')).toBe('ko');
  });
});

describe('lang_stats', () => {
  it('returns empty for unknown guild', () => {
    expect(getLangStats('unknown')).toEqual([]);
  });

  it('increments counts', () => {
    incrementLangStat('g1', 'ja');
    incrementLangStat('g1', 'ja');
    incrementLangStat('g1', 'en');
    const stats = getLangStats('g1');
    expect(stats).toEqual([
      { lang: 'ja', count: 2 },
      { lang: 'en', count: 1 }
    ]);
  });

  it('keeps guilds independent', () => {
    incrementLangStat('g1', 'ja');
    incrementLangStat('g2', 'en');
    expect(getLangStats('g1')).toEqual([{ lang: 'ja', count: 1 }]);
    expect(getLangStats('g2')).toEqual([{ lang: 'en', count: 1 }]);
  });
});

describe('getEffectiveOfficialLang', () => {
  it('returns en by default (auto + no stats)', () => {
    expect(getEffectiveOfficialLang('new-guild')).toBe('en');
  });

  it('returns manual setting', () => {
    setOfficialLangSetting('g1', 'ja');
    expect(getEffectiveOfficialLang('g1')).toBe('ja');
  });

  it('returns detected language when auto + enough stats', () => {
    for (let i = 0; i < 10; i++) incrementLangStat('g1', 'ko');
    expect(getEffectiveOfficialLang('g1')).toBe('ko');
  });
});

describe('guild_settings migration (official_lang)', () => {
  it('migrates existing guild_settings without official_lang', async () => {
    const dbPath = process.env.BOT_DB_PATH!;
    _resetDb();
    const raw = new Database(dbPath);
    raw.exec(`
      CREATE TABLE guild_settings (
        guild_id TEXT PRIMARY KEY,
        mode TEXT NOT NULL CHECK (mode IN ('auto', 'button'))
      )
    `);
    raw.prepare("INSERT INTO guild_settings (guild_id, mode) VALUES ('g1', 'auto')").run();
    raw.close();

    _resetDb();
    const { getGuildMode } = await import('../src/db.js');
    expect(getGuildMode('g1')).toBe('auto');
    expect(getOfficialLangSetting('g1')).toBe('auto');
  });
});
