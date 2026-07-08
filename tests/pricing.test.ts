import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  calculateModelCost,
  checkAndMarkBudgetCrossed,
  getMonthlyTotalUSD,
  getPriceTable,
  getUsageSummaryByModel,
  isBudgetAlerted,
  markBudgetAlerted,
  getCurrentMonthKey,
  recordUsage,
  _resetDb
} from '../src/db.js';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'pricing-test-'));
  process.env.BOT_DB_PATH = join(tempDir, 'test.db');
  _resetDb();
});

afterEach(() => {
  _resetDb();
  rmSync(tempDir, { recursive: true, force: true });
  delete process.env.BOT_DB_PATH;
  delete process.env.PRICE_TABLE_JSON;
});

describe('getPriceTable', () => {
  it('returns default table when no env set', () => {
    const table = getPriceTable();
    expect(table['claude-haiku-4-5']).toEqual({ in: 1, out: 5 });
    expect(table['claude-opus-4-8']).toEqual({ in: 5, out: 25 });
  });

  it('uses PRICE_TABLE_JSON when set', () => {
    process.env.PRICE_TABLE_JSON = JSON.stringify({ 'custom-model': { in: 10, out: 50 } });
    const table = getPriceTable();
    expect(table['custom-model']).toEqual({ in: 10, out: 50 });
    expect(table['claude-haiku-4-5']).toBeUndefined();
  });

  it('falls back to default on invalid JSON', () => {
    process.env.PRICE_TABLE_JSON = 'not-json';
    const table = getPriceTable();
    expect(table['claude-haiku-4-5']).toBeDefined();
  });
});

describe('calculateModelCost', () => {
  it('computes haiku cost correctly', () => {
    const table = getPriceTable();
    const cost = calculateModelCost('claude-haiku-4-5', 1_000_000, 1_000_000, table);
    expect(cost).toBeCloseTo(6.0, 4);
  });

  it('computes opus cost correctly', () => {
    const table = getPriceTable();
    const cost = calculateModelCost('claude-opus-4-8', 1_000_000, 1_000_000, table);
    expect(cost).toBeCloseTo(30.0, 4);
  });

  it('falls back to haiku pricing for unknown model', () => {
    const table = getPriceTable();
    const cost = calculateModelCost('unknown-model', 1_000_000, 1_000_000, table);
    expect(cost).toBeCloseTo(6.0, 4);
  });
});

describe('getUsageSummaryByModel', () => {
  it('returns empty arrays when no usage', () => {
    const { allTime, last7d } = getUsageSummaryByModel();
    expect(allTime).toEqual([]);
    expect(last7d).toEqual([]);
  });

  it('groups by model', () => {
    recordUsage('claude-haiku-4-5', 100, 20);
    recordUsage('claude-haiku-4-5', 200, 40);
    recordUsage('claude-opus-4-8', 500, 100);
    const { allTime } = getUsageSummaryByModel();
    expect(allTime).toHaveLength(2);
    const haiku = allTime.find((m) => m.model === 'claude-haiku-4-5');
    const opus = allTime.find((m) => m.model === 'claude-opus-4-8');
    expect(haiku).toEqual({ model: 'claude-haiku-4-5', calls: 2, input: 300, output: 60 });
    expect(opus).toEqual({ model: 'claude-opus-4-8', calls: 1, input: 500, output: 100 });
  });
});

describe('getMonthlyTotalUSD', () => {
  it('returns 0 when no usage', () => {
    expect(getMonthlyTotalUSD()).toBe(0);
  });

  it('sums costs across models', () => {
    recordUsage('claude-haiku-4-5', 1_000_000, 0);
    recordUsage('claude-opus-4-8', 1_000_000, 0);
    const total = getMonthlyTotalUSD();
    expect(total).toBeCloseTo(6.0, 2);
  });
});

describe('budget alerts', () => {
  it('getCurrentMonthKey returns YYYY-MM format', () => {
    const key = getCurrentMonthKey();
    expect(key).toMatch(/^\d{4}-\d{2}$/);
  });

  it('isBudgetAlerted returns false initially', () => {
    expect(isBudgetAlerted('2026-07')).toBe(false);
  });

  it('markBudgetAlerted + isBudgetAlerted roundtrip', () => {
    markBudgetAlerted('2026-07');
    expect(isBudgetAlerted('2026-07')).toBe(true);
  });

  it('markBudgetAlerted is idempotent', () => {
    markBudgetAlerted('2026-07');
    markBudgetAlerted('2026-07');
    expect(isBudgetAlerted('2026-07')).toBe(true);
  });

  it('checkAndMarkBudgetCrossed fires once then returns false', () => {
    recordUsage('claude-haiku-4-5', 100_000_000, 0);
    expect(checkAndMarkBudgetCrossed(30)).toBe(true);
    expect(checkAndMarkBudgetCrossed(30)).toBe(false);
  });

  it('checkAndMarkBudgetCrossed returns false below threshold', () => {
    recordUsage('claude-haiku-4-5', 100, 20);
    expect(checkAndMarkBudgetCrossed(30)).toBe(false);
  });

  it('different months are independent', () => {
    markBudgetAlerted('2026-06');
    expect(isBudgetAlerted('2026-06')).toBe(true);
    expect(isBudgetAlerted('2026-07')).toBe(false);
  });
});
