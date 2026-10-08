import { memberBalances, money, type FinanceState } from './finance';

/* ---------- Rules ---------- */
export const LOAN_RULES = {
  savingsMultiplier: 3,
  annualRateBps: 1200, // 12.00% per annum, nominal
  guarantorCoverPercent: 50, // guarantors together secure 50% of principal
  guarantorCount: 2,
  terms: [3, 6, 12, 18, 24],
} as const;
export const REGULATORY_CAP_PERCENT = 50;
export const CAP_MESSAGE = 'Regulatory Cap Reached: External borrowing locked.';
export const FREEZE_NOTICE = "Submitting this application will digitally freeze your guarantors' savings balances by the required security margin until the loan principal drops.";

export type Frequency = 'weekly' | 'monthly';
export type InterestMethod = 'flat' | 'reducing';
export type LoanStatus = 'pending' | 'approved' | 'rejected' | 'completed';
export type Loan = {
  id: string; memberId: string; principal: number; termMonths: number; frequency: Frequency;
  interestMethod: InterestMethod; status: LoanStatus; appliedOn: string; decidedOn?: string; approvedOn?: string;
  guarantorIds: string[]; guaranteeEach: number; savingsBasis: number; paidCount: number;
};
export type ScheduleRow = { n: number; due: string; payment: number; principal: number; interest: number; balance: number };
export type LoanInput = { memberId: string; amount: number; termMonths: number; frequency: Frequency; guarantorIds: string[] };
export type NamedMember = { id: string; fullName: string };

export const frequencyLabel = (f: Frequency) => (f === 'weekly' ? 'Weekly Payments' : 'Monthly Payments');
export const methodLabel = (m: InterestMethod) => (m === 'flat' ? 'Flat Interest Rate' : 'Reducing Balance Interest Rate');

/* ---------- Dates (UTC, ISO yyyy-mm-dd) ---------- */
const DAY = 86400000;
const pad = (n: number) => String(n).padStart(2, '0');
export function addDays(date: string, n: number) { return new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10); }
export function addMonths(date: string, n: number) {
  const [y = 1970, m = 1, d = 1] = date.split('-').map(Number);
  const total = m - 1 + n;
  const year = y + Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return `${year}-${pad(month + 1)}-${pad(Math.min(d, last))}`;
}

/* ---------- Amortization ---------- */
export function periodsFor(termMonths: number, frequency: Frequency) { return frequency === 'weekly' ? Math.round((termMonths * 52) / 12) : termMonths; }
const periodsPerYear = (f: Frequency) => (f === 'weekly' ? 52 : 12);
const divRound = (num: bigint, den: bigint) => (num * 2n + den) / (2n * den);

export function buildSchedule(p: { principal: number; termMonths: number; frequency: Frequency; method: InterestMethod; start: string }): ScheduleRow[] {
  const { principal, termMonths, frequency, method, start } = p;
  const n = periodsFor(termMonths, frequency);
  if (!Number.isSafeInteger(principal) || principal <= 0 || n <= 0) return [];
  const dueDate = (k: number) => (frequency === 'weekly' ? addDays(start, 7 * k) : addMonths(start, k));
  const rows: ScheduleRow[] = [];
  let balance = principal;

  if (method === 'flat') {
    const totalInterest = Number(divRound(BigInt(principal) * BigInt(LOAN_RULES.annualRateBps) * BigInt(termMonths), 10000n * 12n));
    const pBase = Math.floor(principal / n), pRem = principal - pBase * n;
    const iBase = Math.floor(totalInterest / n), iRem = totalInterest - iBase * n;
    for (let k = 1; k <= n; k++) {
      const prin = pBase + (k <= pRem ? 1 : 0);
      const interest = iBase + (k <= iRem ? 1 : 0);
      balance -= prin;
      rows.push({ n: k, due: dueDate(k), payment: prin + interest, principal: prin, interest, balance });
    }
    return rows;
  }

  const den = 10000n * BigInt(periodsPerYear(frequency));
  const r = LOAN_RULES.annualRateBps / (10000 * periodsPerYear(frequency));
  const level = Math.round((principal * r) / (1 - Math.pow(1 + r, -n)));
  for (let k = 1; k <= n; k++) {
    const interest = Number(divRound(BigInt(balance) * BigInt(LOAN_RULES.annualRateBps), den));
    const prin = k === n ? balance : Math.min(balance, level - interest);
    balance -= prin;
    rows.push({ n: k, due: dueDate(k), payment: prin + interest, principal: prin, interest, balance });
  }
  return rows;
}

export function scheduleFor(loan: Loan, method: InterestMethod = loan.interestMethod): ScheduleRow[] {
  return buildSchedule({ principal: loan.principal, termMonths: loan.termMonths, frequency: loan.frequency, method, start: loan.approvedOn ?? loan.appliedOn });
}
export const isOpen = (l: Loan) => l.status === 'pending' || l.status === 'approved';
export function outstandingPrincipal(loan: Loan) {
  if (loan.status === 'rejected' || loan.status === 'completed') return 0;
  if (loan.status === 'pending' || loan.paidCount === 0) return loan.principal;
  return scheduleFor(loan)[loan.paidCount - 1]?.balance ?? 0;
}
export function nextDue(loan: Loan) { return loan.status === 'approved' ? scheduleFor(loan)[loan.paidCount] : undefined; }

/* ---------- Guarantor freezes & eligibility ---------- */
export function guaranteeEach(principal: number) { return Math.ceil((principal * LOAN_RULES.guarantorCoverPercent) / 100 / LOAN_RULES.guarantorCount); }
function frozenAmount(l: Loan) {
  if (l.status === 'pending') return l.guaranteeEach;
  const num = BigInt(l.guaranteeEach) * BigInt(outstandingPrincipal(l)), den = BigInt(l.principal);
  return Number((num + den - 1n) / den);
}
export function frozenFor(loans: Loan[], memberId: string) { return loans.filter(l => isOpen(l) && l.guarantorIds.includes(memberId)).reduce((s, l) => s + frozenAmount(l), 0); }
export function availableSavings(state: FinanceState, loans: Loan[], memberId: string) { return Math.max(0, memberBalances(state, memberId).savings - frozenFor(loans, memberId)); }
export const maxLoanFor = (available: number) => available * LOAN_RULES.savingsMultiplier;
export function riskBand(multiplier: number) { return multiplier <= 1.5 ? 'Low' : multiplier <= 2.25 ? 'Medium' : 'High'; }

export type ApplicationErrors = { amount?: string; guarantors?: string; general?: string };
export function validateApplication(state: FinanceState, loans: Loan[], members: NamedMember[], input: LoanInput): ApplicationErrors {
  const errors: ApplicationErrors = {};
  const available = availableSavings(state, loans, input.memberId);
  const max = maxLoanFor(available);
  if (loans.some(l => l.memberId === input.memberId && isOpen(l))) errors.general = 'You already have an open loan. Repay it before applying again.';
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) errors.amount = 'Enter a valid loan amount.';
  else if (input.amount > max) errors.amount = `Loan amount exceeds the ${LOAN_RULES.savingsMultiplier}× savings rule. Your maximum is ${money(max)} (${LOAN_RULES.savingsMultiplier} × ${money(available)} available savings).`;
  const ids = input.guarantorIds;
  const names = new Map(members.map(m => [m.id, m.fullName]));
  if (ids.length !== LOAN_RULES.guarantorCount || ids.some(id => !id)) errors.guarantors = 'Select two guarantors.';
  else if (new Set(ids).size !== ids.length) errors.guarantors = 'Choose two different guarantors.';
  else if (ids.includes(input.memberId)) errors.guarantors = 'You cannot guarantee your own loan.';
  else if (ids.some(id => !names.has(id))) errors.guarantors = 'Guarantors must be active members.';
  else if (!errors.amount) {
    const each = guaranteeEach(input.amount);
    const short = ids.find(id => availableSavings(state, loans, id) < each);
    if (short) errors.guarantors = `${names.get(short)} has only ${money(availableSavings(state, loans, short))} of unfrozen savings; ${money(each)} is required.`;
  }
  return errors;
}

export function applyForLoan(state: FinanceState, loans: Loan[], members: NamedMember[], input: LoanInput, today: string): Loan[] {
  const e = validateApplication(state, loans, members, input);
  const first = e.general ?? e.amount ?? e.guarantors;
  if (first) throw new Error(first);
  const loan: Loan = {
    id: `loan-${loans.length + 1}`, memberId: input.memberId, principal: input.amount, termMonths: input.termMonths, frequency: input.frequency,
    interestMethod: 'reducing', status: 'pending', appliedOn: today, guarantorIds: [...input.guarantorIds],
    guaranteeEach: guaranteeEach(input.amount), savingsBasis: availableSavings(state, loans, input.memberId), paidCount: 0,
  };
  return [...loans, loan];
}
function update(loans: Loan[], id: string, fn: (l: Loan) => Loan) {
  if (!loans.some(l => l.id === id)) throw new Error('Loan not found.');
  return loans.map(l => (l.id === id ? fn(l) : l));
}
export function decideLoan(loans: Loan[], id: string, decision: 'approved' | 'rejected', today: string) {
  return update(loans, id, l => {
    if (l.status !== 'pending') throw new Error('Only pending applications can be decided.');
    return decision === 'approved' ? { ...l, status: 'approved', decidedOn: today, approvedOn: today } : { ...l, status: 'rejected', decidedOn: today };
  });
}
export function payNextInstallment(loans: Loan[], id: string) {
  return update(loans, id, l => {
    if (l.status !== 'approved') throw new Error('Only approved loans can be repaid.');
    const paid = l.paidCount + 1;
    return { ...l, paidCount: paid, status: paid >= periodsFor(l.termMonths, l.frequency) ? 'completed' : 'approved' };
  });
}
export function setInterestMethod(loans: Loan[], id: string, method: InterestMethod) {
  return update(loans, id, l => {
    if (l.paidCount > 0) throw new Error('Interest basis is locked once repayments have started.');
    return { ...l, interestMethod: method };
  });
}

export function initialLoans(): Loan[] {
  return [
    { id: 'loan-1', memberId: 'm5', principal: 90000000, termMonths: 6, frequency: 'weekly', interestMethod: 'reducing', status: 'approved', appliedOn: '2026-09-20', decidedOn: '2026-09-23', approvedOn: '2026-09-23', guarantorIds: ['m1', 'm2'], guaranteeEach: guaranteeEach(90000000), savingsBasis: 60000000, paidCount: 2 },
    { id: 'loan-2', memberId: 'm2', principal: 240000000, termMonths: 12, frequency: 'monthly', interestMethod: 'reducing', status: 'pending', appliedOn: '2026-10-05', guarantorIds: ['m3', 'm4'], guaranteeEach: guaranteeEach(240000000), savingsBasis: 150000000, paidCount: 0 },
  ];
}

/* ---------- External debt / corporate borrowing ---------- */
export type BorrowEntry = { id: string; date: string; type: 'drawdown' | 'repayment'; amount: number };
export type Treasury = { enabled: boolean; mcl: number; entries: BorrowEntry[] };
export function initialTreasury(): Treasury {
  return { enabled: true, mcl: 300000000, entries: [{ id: 'bor-1', date: '2026-09-10', type: 'drawdown', amount: 150000000 }] };
}
export function outstandingBorrowing(t: Treasury) { return t.entries.reduce((s, e) => s + (e.type === 'drawdown' ? e.amount : -e.amount), 0); }
export function borrowingStatus(t: Treasury, equity: number) {
  const outstanding = outstandingBorrowing(t);
  const cap = Math.floor((equity * REGULATORY_CAP_PERCENT) / 100);
  const locked = outstanding > 0 && outstanding * 100 >= equity * REGULATORY_CAP_PERCENT;
  const headroom = !t.enabled || locked ? 0 : Math.max(0, Math.min(t.mcl, cap) - outstanding);
  return {
    outstanding, cap, locked, headroom, equity,
    mclUsedPercent: t.mcl ? (outstanding / t.mcl) * 100 : 0,
    equityPercent: equity ? (outstanding / equity) * 100 : 0,
    overMcl: outstanding > t.mcl,
  };
}
const validAmount = (a: number) => Number.isSafeInteger(a) && a > 0;
export function drawdown(t: Treasury, amount: number, equity: number, date: string): Treasury {
  const s = borrowingStatus(t, equity);
  if (!t.enabled) throw new Error('External borrowing is switched off.');
  if (s.locked) throw new Error(CAP_MESSAGE);
  if (!validAmount(amount)) throw new Error('Enter a valid drawdown amount.');
  if (s.outstanding + amount > t.mcl) throw new Error(`This would exceed the Maximum Credit Limit of ${money(t.mcl)}. Headroom: ${money(Math.max(0, t.mcl - s.outstanding))}.`);
  if (s.outstanding + amount > s.cap) throw new Error(`This would exceed the ${REGULATORY_CAP_PERCENT}% regulatory cap of ${money(s.cap)} (50% of member equity).`);
  return { ...t, entries: [...t.entries, { id: `bor-${t.entries.length + 1}`, date, type: 'drawdown', amount }] };
}
export function repayBorrowing(t: Treasury, amount: number, date: string): Treasury {
  if (!validAmount(amount)) throw new Error('Enter a valid repayment amount.');
  if (amount > outstandingBorrowing(t)) throw new Error('Repayment is more than the outstanding borrowing.');
  return { ...t, entries: [...t.entries, { id: `bor-${t.entries.length + 1}`, date, type: 'repayment', amount }] };
}
export function setMcl(t: Treasury, mcl: number): Treasury {
  if (!validAmount(mcl)) throw new Error('Enter a valid Maximum Credit Limit.');
  return { ...t, mcl };
}
