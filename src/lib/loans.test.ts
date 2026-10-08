import { describe, expect, it } from 'vitest';
import { fundBalances, initialFinance } from './finance';
import { CAP_MESSAGE, addDays, addMonths, applyForLoan, availableSavings, borrowingStatus, buildSchedule, decideLoan, drawdown, frozenFor, initialLoans, initialTreasury, outstandingPrincipal, payNextInstallment, repayBorrowing, setInterestMethod, validateApplication, type LoanInput } from './loans';

const state = initialFinance();
const people = [1, 2, 3, 4, 5].map(i => ({ id: `m${i}`, fullName: `Member ${i}` }));
const base: LoanInput = { memberId: 'm1', amount: 100000000, termMonths: 12, frequency: 'monthly', guarantorIds: ['m3', 'm4'] };

describe('Loan engine', () => {
  it('rejects a loan above 3x available savings and allows exactly 3x', () => {
    const avail = availableSavings(state, [], 'm1');
    expect(validateApplication(state, [], people, { ...base, amount: avail * 3 + 1 }).amount).toMatch(/3× savings rule/);
    expect(validateApplication(state, [], people, { ...base, amount: avail * 3, guarantorIds: ['m2', 'm3'] }).amount).toBeUndefined();
  });
  it('requires two distinct guarantors other than the applicant with enough unfrozen savings', () => {
    expect(validateApplication(state, [], people, { ...base, guarantorIds: ['m3'] }).guarantors).toBeDefined();
    expect(validateApplication(state, [], people, { ...base, guarantorIds: ['m3', 'm3'] }).guarantors).toMatch(/different/);
    expect(validateApplication(state, [], people, { ...base, guarantorIds: ['m1', 'm3'] }).guarantors).toMatch(/own loan/);
    expect(validateApplication(state, [], people, { ...base, amount: 400000000, guarantorIds: ['m3', 'm5'] }).guarantors).toMatch(/unfrozen savings/);
  });
  it('freezes guarantor savings on submission, releases on rejection', () => {
    const pending = applyForLoan(state, [], people, base, '2026-10-07');
    expect(frozenFor(pending, 'm3')).toBe(25000000);
    expect(availableSavings(state, pending, 'm3')).toBe(85000000 - 25000000);
    expect(frozenFor(decideLoan(pending, 'loan-1', 'rejected', '2026-10-08'), 'm3')).toBe(0);
  });
  it('releases guarantor freezes as principal drops', () => {
    let loans = decideLoan(applyForLoan(state, [], people, base, '2026-10-07'), 'loan-1', 'approved', '2026-10-07');
    const before = frozenFor(loans, 'm3');
    loans = payNextInstallment(loans, 'loan-1');
    expect(frozenFor(loans, 'm3')).toBeLessThan(before);
    expect(outstandingPrincipal(loans[0]!)).toBeGreaterThan(0);
  });
  it('allows only one open loan per member', () => {
    const loans = applyForLoan(state, [], people, base, '2026-10-07');
    expect(validateApplication(state, loans, people, base).general).toMatch(/open loan/);
  });
});

describe('Amortization schedules', () => {
  const p = { principal: 100000000, termMonths: 12, start: '2026-10-07' } as const;
  it('weekly schedules use consecutive 7-day intervals', () => {
    const rows = buildSchedule({ ...p, frequency: 'weekly', method: 'reducing' });
    expect(rows).toHaveLength(52);
    expect(rows[0]?.due).toBe('2026-10-14');
    rows.slice(1).forEach((r, i) => expect(r.due).toBe(addDays(rows[i]!.due, 7)));
  });
  it('monthly schedules map to calendar-month dates with end-of-month clamping', () => {
    const rows = buildSchedule({ ...p, start: '2026-01-31', frequency: 'monthly', method: 'reducing' });
    expect(rows.slice(0, 3).map(r => r.due)).toEqual(['2026-02-28', '2026-03-31', '2026-04-30']);
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
  });
  for (const method of ['flat', 'reducing'] as const) for (const frequency of ['weekly', 'monthly'] as const) {
    it(`${method}/${frequency}: principal sums exactly, balance ends at zero, payment = principal + interest`, () => {
      const rows = buildSchedule({ ...p, principal: 100000003, frequency, method });
      expect(rows.reduce((s, r) => s + r.principal, 0)).toBe(100000003);
      expect(rows.at(-1)?.balance).toBe(0);
      rows.forEach(r => expect(r.payment).toBe(r.principal + r.interest));
    });
  }
  it('flat interest is 12% of principal over a year; reducing is lower', () => {
    const flat = buildSchedule({ ...p, frequency: 'monthly', method: 'flat' });
    const red = buildSchedule({ ...p, frequency: 'monthly', method: 'reducing' });
    expect(flat.reduce((s, r) => s + r.interest, 0)).toBe(12000000);
    expect(red.reduce((s, r) => s + r.interest, 0)).toBeLessThan(12000000);
  });
  it('locks the interest basis once repayments start', () => {
    const loans = payNextInstallment(initialLoans(), 'loan-1');
    expect(() => setInterestMethod(loans, 'loan-1', 'flat')).toThrow('locked');
  });
});

describe('External borrowing', () => {
  const equity = fundBalances(state).assets;
  it('tracks borrowing against the MCL and the 50% equity cap', () => {
    const s = borrowingStatus(initialTreasury(), equity);
    expect(s.outstanding).toBe(150000000);
    expect(s.locked).toBe(false);
    expect(s.cap).toBe(Math.floor(equity / 2));
  });
  it('rejects draws above the MCL or above the cap', () => {
    const t = initialTreasury();
    expect(() => drawdown(t, 200000000, equity, '2026-10-07')).toThrow('Maximum Credit Limit');
    expect(() => drawdown({ ...t, mcl: 9e9 }, 9e8, equity, '2026-10-07')).toThrow('regulatory cap');
  });
  it('locks at the cap and refuses further draws until repaid', () => {
    let t = { ...initialTreasury(), mcl: 9e9 };
    t = drawdown(t, borrowingStatus(t, equity).headroom, equity, '2026-10-07');
    expect(borrowingStatus(t, equity).locked).toBe(true);
    expect(() => drawdown(t, 1, equity, '2026-10-07')).toThrow(CAP_MESSAGE);
    t = repayBorrowing(t, 100, '2026-10-08');
    expect(borrowingStatus(t, equity).locked).toBe(false);
  });
  it('blocks draws when the toggle is off', () => { expect(() => drawdown({ ...initialTreasury(), enabled: false }, 100, equity, '2026-10-07')).toThrow('switched off'); });
});
