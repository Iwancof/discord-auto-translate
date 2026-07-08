import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  addGlossaryEntry,
  getGlossaryCount,
  getGlossaryEntries,
  removeGlossaryEntry,
  _resetDb
} from '../src/db.js';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'glossary-test-'));
  process.env.BOT_DB_PATH = join(tempDir, 'test.db');
  _resetDb();
});

afterEach(() => {
  _resetDb();
  rmSync(tempDir, { recursive: true, force: true });
  delete process.env.BOT_DB_PATH;
});

describe('glossary CRUD', () => {
  it('returns empty entries for unknown guild', () => {
    expect(getGlossaryEntries('guild-x')).toEqual([]);
    expect(getGlossaryCount('guild-x')).toBe(0);
  });

  it('adds and retrieves a term with rendering', () => {
    addGlossaryEntry('g1', 'pwn', null);
    addGlossaryEntry('g1', '進捗', 'progress');
    const entries = getGlossaryEntries('g1');
    expect(entries).toHaveLength(2);
    expect(entries).toContainEqual({ term: 'pwn', rendering: null });
    expect(entries).toContainEqual({ term: '進捗', rendering: 'progress' });
    expect(getGlossaryCount('g1')).toBe(2);
  });

  it('upserts existing term', () => {
    addGlossaryEntry('g1', 'test', null);
    addGlossaryEntry('g1', 'test', 'テスト');
    const entries = getGlossaryEntries('g1');
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({ term: 'test', rendering: 'テスト' });
  });

  it('removes an existing term', () => {
    addGlossaryEntry('g1', 'term1', null);
    expect(removeGlossaryEntry('g1', 'term1')).toBe(true);
    expect(getGlossaryEntries('g1')).toEqual([]);
  });

  it('returns false when removing non-existent term', () => {
    expect(removeGlossaryEntry('g1', 'nonexist')).toBe(false);
  });

  it('isolates entries by guild', () => {
    addGlossaryEntry('g1', 'foo', 'bar');
    addGlossaryEntry('g2', 'baz', 'qux');
    expect(getGlossaryEntries('g1')).toHaveLength(1);
    expect(getGlossaryEntries('g2')).toHaveLength(1);
    expect(getGlossaryCount('g1')).toBe(1);
  });

  it('returns entries sorted by term', () => {
    addGlossaryEntry('g1', 'zeta', null);
    addGlossaryEntry('g1', 'alpha', null);
    addGlossaryEntry('g1', 'mid', null);
    const terms = getGlossaryEntries('g1').map((e) => e.term);
    expect(terms).toEqual(['alpha', 'mid', 'zeta']);
  });
});

describe('glossary limit', () => {
  it('counts up to limit correctly', () => {
    for (let i = 0; i < 100; i++) {
      addGlossaryEntry('g1', `term${i}`, null);
    }
    expect(getGlossaryCount('g1')).toBe(100);
  });
});
