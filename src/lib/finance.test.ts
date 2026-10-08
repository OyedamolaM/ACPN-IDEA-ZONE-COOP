import { describe, expect, it } from 'vitest';
import { allocateSurplus, daysHeld, deposit, distribute, initialFinance, isLowLiquidity, memberBalances, money, splitContribution } from './finance';

describe('Cooperative financial rules', () => {
  it('formats all money as naira', () => { expect(money(123456)).toBe('₦1,234.56'); });
  it('splits a ₦100 contribution into ₦60 savings and ₦40 investment', () => { expect(splitContribution(10000, 60)).toEqual({ savings: 6000, investment: 4000, effectivePercent: 60 }); });
  it('preserves all kobo on an uneven deposit', () => { const s = splitContribution(101, 60); expect(s.savings + s.investment).toBe(101); });
  it('warns strictly below 25% liquidity', () => { expect(isLowLiquidity(0.2499)).toBe(true); expect(isLowLiquidity(0.25)).toBe(false); });
  it('throttles investments by routing a low-liquidity deposit to savings', () => { expect(splitContribution(10000, 60, 0.24).investment).toBe(0); });
  it('counts daily capital inclusively and excludes future deposits', () => { expect(daysHeld('2026-07-01')).toBe(92); expect(daysHeld('2026-10-07')).toBe(0); });
  it('weights every deposit by its days held', () => { const rows = allocateSurplus(initialFinance(), 1000000); expect(rows[0]?.weight).toBe(80000000n * 92n + 10000000n * 13n); expect(rows[1]?.weight).toBe(120000000n * 78n); });
  it('allocates exactly 100% of a surplus including the last kobo', () => { const rows = allocateSurplus(initialFinance(), 1000003); expect(rows.reduce((s, r) => s + r.payout, 0)).toBe(1000003); });
  it('appends deposits without changing existing ledger entries and balances every entry', () => { const state = initialFinance(); const result = deposit(state, 'm1', 10000); expect(result.transactions.slice(0, state.transactions.length)).toEqual(state.transactions); expect(memberBalances(result, 'm1').contributions - memberBalances(state, 'm1').contributions).toBe(10000); for (const t of result.transactions) expect(t.entries.reduce((s, e) => s + e.debit - e.credit, 0)).toBe(0); });
  it('credits accrued dividends and prevents a duplicate cycle payout', () => { const state = initialFinance(); const rows = allocateSurplus(state, 1000003); const result = distribute(state, 1000003); expect(memberBalances(result, 'm1').dividends - memberBalances(state, 'm1').dividends).toBe(rows[0]?.payout); expect(() => distribute(result, 1000003)).toThrow('already been distributed'); });
});