export type Category = 'Savings' | 'Investment' | 'Dividend';
export type Member = { id: string; name: string; initials: string; joined: string };
export type Entry = { account: string; debit: number; credit: number };
export type Transaction = { id: string; memberId: string; date: string; description: string; category: Category; amount: number; entries: Entry[] };
export type FinanceState = { transactions: Transaction[]; savingsPercent: number; distributions: number };
export const TODAY = '2026-10-07';
export const CYCLE_START = '2026-07-01';
export const CYCLE_END = '2026-09-30';
export const members: Member[] = [
  { id: 'm1', name: 'Oyedamola Moreira', initials: 'OM', joined: '2026-07-01' },
  { id: 'm2', name: 'Chidinma Okafor', initials: 'CO', joined: '2026-07-15' },
  { id: 'm3', name: 'Tunde Bakare', initials: 'TB', joined: '2026-08-01' },
  { id: 'm4', name: 'Aisha Bello', initials: 'AB', joined: '2026-08-15' },
  { id: 'm5', name: 'Emeka Nwosu', initials: 'EN', joined: '2026-09-01' },
];
export function money(kobo: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(kobo / 100);
}
export function parseNaira(value: string) {
  if (!/^\d+(\.\d{0,2})?$/.test(value)) return 0;
  const amount = Math.round(Number(value) * 100);
  return Number.isSafeInteger(amount) && amount <= 100000000000 ? amount : 0;
}
export function makeTransaction(id: string, memberId: string, date: string, description: string, category: Category, amount: number): Transaction {
  return { id, memberId, date, description, category, amount, entries: [
    { account: category === 'Investment' ? 'investment-assets' : 'cash', debit: amount, credit: 0 },
    { account: `${memberId}:${category.toLowerCase()}`, debit: 0, credit: amount },
  ] };
}
export function initialFinance(): FinanceState {
  const transactions: Transaction[] = [];
  const investments = [800000, 1200000, 650000, 950000, 400000];
  const savings = [1200000, 1500000, 850000, 1050000, 600000];
  members.forEach((m, i) => {
    transactions.push(makeTransaction(`seed-${i}-s`, m.id, m.joined, 'Opening contribution · Savings', 'Savings', (savings[i] ?? 0) * 100));
    transactions.push(makeTransaction(`seed-${i}-i`, m.id, m.joined, 'Opening contribution · Investment', 'Investment', (investments[i] ?? 0) * 100));
  });
  transactions.push(makeTransaction('seed-dividend', 'm1', '2026-09-30', 'Q2 investment dividend', 'Dividend', 4250000));
  transactions.push(makeTransaction('seed-sep-s', 'm1', '2026-09-18', 'September contribution', 'Savings', 15000000));
  transactions.push(makeTransaction('seed-sep-i', 'm1', '2026-09-18', 'September contribution', 'Investment', 10000000));
  return { transactions, savingsPercent: 60, distributions: 0 };
}
export function memberBalances(state: FinanceState, memberId: string) {
  const totals = { Savings: 0, Investment: 0, Dividend: 0 };
  state.transactions.filter(t => t.memberId === memberId).forEach(t => { totals[t.category] += t.amount; });
  return { savings: totals.Savings, investment: totals.Investment, dividends: totals.Dividend, contributions: totals.Savings + totals.Investment };
}
export function fundBalances(state: FinanceState) {
  const memberIds = [...new Set(state.transactions.map(t => t.memberId))];
  const balances = memberIds.map(id => memberBalances(state, id));
  const cash = balances.reduce((s, b) => s + b.savings + b.dividends, 0);
  const investment = balances.reduce((s, b) => s + b.investment, 0);
  const assets = cash + investment;
  return { cash, investment, assets, liquidity: assets ? cash / assets : 0 };
}
export function isLowLiquidity(ratio: number) { return ratio < 0.25; }
export function splitContribution(amount: number, savingsPercent: number, liquidity = 1) {
  const effectivePercent = isLowLiquidity(liquidity) ? 100 : savingsPercent;
  const savings = Math.round(amount * effectivePercent / 100);
  return { savings, investment: amount - savings, effectivePercent };
}
export function deposit(state: FinanceState, memberId: string, amount: number): FinanceState {
  if (amount <= 0 || !Number.isSafeInteger(amount)) throw new Error('Enter a valid contribution amount.');
  const split = splitContribution(amount, state.savingsPercent, fundBalances(state).liquidity);
  const next = [...state.transactions];
  if (split.savings) next.push(makeTransaction(`tx-${next.length + 1}`, memberId, TODAY, 'October contribution', 'Savings', split.savings));
  if (split.investment) next.push(makeTransaction(`tx-${next.length + 1}`, memberId, TODAY, 'October contribution', 'Investment', split.investment));
  return { ...state, transactions: next };
}
export function daysHeld(date: string, start = CYCLE_START, end = CYCLE_END) {
  const startMs = Math.max(Date.parse(`${date}T00:00:00Z`), Date.parse(`${start}T00:00:00Z`));
  return Math.max(0, Math.floor((Date.parse(`${end}T00:00:00Z`) - startMs) / 86400000) + 1);
}
export function allocateSurplus(state: FinanceState, pool: number) {
  const rows = members.map(member => {
    const deposits = state.transactions.filter(t => t.memberId === member.id && t.category === 'Investment' && daysHeld(t.date) > 0);
    const weight = deposits.reduce((s, t) => s + BigInt(t.amount) * BigInt(daysHeld(t.date)), 0n);
    return { ...member, amount: deposits.reduce((s, t) => s + t.amount, 0), days: daysHeld(member.joined), weight, payout: 0, percent: 0, remainder: 0n };
  });
  const totalWeight = rows.reduce((s, r) => s + r.weight, 0n);
  if (!totalWeight || pool <= 0 || !Number.isSafeInteger(pool)) return rows;
  rows.forEach(r => {
    const numerator = BigInt(pool) * r.weight;
    r.payout = Number(numerator / totalWeight);
    r.remainder = numerator % totalWeight;
    r.percent = Number(r.weight) / Number(totalWeight) * 100;
  });
  let remainder = pool - rows.reduce((s, r) => s + r.payout, 0);
  const sorted = [...rows].sort((a, b) => a.remainder === b.remainder ? a.id.localeCompare(b.id) : a.remainder > b.remainder ? -1 : 1);
  for (const row of sorted) { if (remainder <= 0) break; row.payout += 1; remainder -= 1; }
  return rows;
}
export function distribute(state: FinanceState, pool: number): FinanceState {
  if (state.distributions > 0) throw new Error('This cycle has already been distributed.');
  if (pool <= 0 || !Number.isSafeInteger(pool)) throw new Error('Enter a valid surplus pool.');
  const rows = allocateSurplus(state, pool);
  if (rows.reduce((s, r) => s + r.payout, 0) !== pool) throw new Error('No eligible capital for this cycle.');
  return { ...state, distributions: state.distributions + 1, transactions: [...state.transactions, ...rows.filter(r => r.payout > 0).map((r, i) => makeTransaction(`distribution-${state.transactions.length + i}`, r.id, TODAY, 'Q3 surplus distribution', 'Dividend', r.payout))] };
}
