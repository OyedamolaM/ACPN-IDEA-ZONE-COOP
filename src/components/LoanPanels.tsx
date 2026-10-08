import { useMemo, useState, type ReactNode } from 'react';
import { Check, CheckCircle2, ShieldAlert, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { memberBalances, money, parseNaira, type FinanceState } from '@/lib/finance';
import {
  CAP_MESSAGE, FREEZE_NOTICE, LOAN_RULES, REGULATORY_CAP_PERCENT, availableSavings, borrowingStatus, buildSchedule, frequencyLabel, frozenFor,
  guaranteeEach, maxLoanFor, methodLabel, nextDue, outstandingPrincipal, periodsFor, riskBand, scheduleFor, validateApplication,
  type Frequency, type InterestMethod, type Loan, type NamedMember, type Treasury,
} from '@/lib/loans';

const fmtDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
const toDate = (d: string) => { const [y = 1970, m = 1, day = 1] = d.split('-').map(Number); return new Date(y, m - 1, day); };
const nameOf = (members: NamedMember[], id: string) => members.find(m => m.id === id)?.fullName ?? id;

function Stat({ label, value, detail }: { label: string; value: string; detail?: ReactNode }) {
  return <div className="metric"><span className="text-[11px] text-muted-foreground">{label}</span><div className="metric-value">{value}</div>{detail && <div className="metric-detail">{detail}</div>}</div>;
}
function Bar({ percent, warn, label }: { percent: number; warn?: boolean; label: string }) {
  return <div role="progressbar" aria-label={label} aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100} className="liquidity-track"><div className={`liquidity-fill ${warn ? 'warn' : ''}`} style={{ ['--ratio' as string]: `${Math.min(100, percent)}%` }} /></div>;
}
const StatusBadge = ({ status }: { status: Loan['status'] }) => <span className={`category loan-${status}`}>{status[0]!.toUpperCase() + status.slice(1)}</span>;

/* ---------- Admin: external borrowing ---------- */
export function CapBanner({ treasury, equity }: { treasury: Treasury; equity: number }) {
  const s = borrowingStatus(treasury, equity);
  if (!s.locked) return null;
  return <div className="notice danger" role="alert"><ShieldAlert size={16} className="shrink-0" /><span><strong>{CAP_MESSAGE}</strong><span className="block mt-1 opacity-80">Corporate borrowing of {money(s.outstanding)} has reached {REGULATORY_CAP_PERCENT}% of total member equity ({money(s.equity)}). No further drawdowns until borrowing is repaid or member equity grows.</span></span></div>;
}

type BorrowProps = { treasury: Treasury; equity: number; onToggle: (on: boolean) => void; onMcl: (kobo: number) => string | void; onDraw: (kobo: number) => string | void; onRepay: (kobo: number) => string | void };
export function BorrowingPanel({ treasury, equity, onToggle, onMcl, onDraw, onRepay }: BorrowProps) {
  const s = borrowingStatus(treasury, equity);
  const [mcl, setMclText] = useState(String(treasury.mcl / 100));
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const amt = parseNaira(amount);
  const run = (fn: (k: number) => string | void, value: number, after?: () => void) => { const e = fn(value); setError(e ?? ''); if (!e) after?.(); };
  return <div className="mt-7 grid gap-6">
    <CapBanner treasury={treasury} equity={equity} />
    <div className="metrics">
      <Stat label="Outstanding borrowing" value={money(s.outstanding)} detail={treasury.enabled ? 'External debt currently owed' : 'Borrowing switched off'} />
      <Stat label="Maximum Credit Limit (MCL)" value={money(treasury.mcl)} detail="Set by cooperative bylaws" />
      <Stat label="Total member equity" value={money(equity)} detail="Savings + investments + dividends" />
      <Stat label="Regulatory cap (50%)" value={money(s.cap)} detail={`Available headroom: ${money(s.headroom)}`} />
    </div>
    <div className="content-grid !my-0">
      <section>
        <div className="section-title"><div><h2>External Debt / Corporate Borrowing</h2><p className="text-[11px] text-muted-foreground mt-1">Administrative switch for drawing on external credit.</p></div>
          <label className="flex items-center gap-2 text-[11px] font-medium">{treasury.enabled ? 'Enabled' : 'Disabled'}<Switch aria-label="Enable external borrowing" checked={treasury.enabled} onCheckedChange={onToggle} /></label></div>
        <div className="grid gap-5">
          <div><div className="flex justify-between text-[11px] mb-1"><span>Used against MCL</span><strong>{s.mclUsedPercent.toFixed(1)}%{s.overMcl ? ' · over limit' : ''}</strong></div><Bar label="MCL utilisation" percent={s.mclUsedPercent} warn={s.mclUsedPercent >= 90} /><p className="text-[10px] text-muted-foreground">{money(s.outstanding)} of {money(treasury.mcl)}</p></div>
          <div><div className="flex justify-between text-[11px] mb-1"><span>Share of member equity</span><strong>{s.equityPercent.toFixed(1)}% <span className="text-muted-foreground font-normal">/ {REGULATORY_CAP_PERCENT}% cap</span></strong></div><Bar label="Equity cap utilisation" percent={(s.equityPercent / REGULATORY_CAP_PERCENT) * 100} warn={s.locked || s.equityPercent >= 40} /><p className="text-[10px] text-muted-foreground">Locks when borrowing reaches {REGULATORY_CAP_PERCENT}% of member equity.</p></div>
        </div>
        <div className="table-frame mt-6"><div className="table-scroll"><table className="data-table"><thead><tr><th>Date</th><th>Type</th><th className="amount">Amount</th></tr></thead><tbody>{treasury.entries.slice().reverse().map(e => <tr key={e.id}><td className="text-muted-foreground">{fmtDate(e.date)}</td><td>{e.type === 'drawdown' ? 'Drawdown' : 'Repayment'}</td><td className={`amount ${e.type === 'drawdown' ? '' : 'text-primary'}`}>{e.type === 'drawdown' ? '+' : '−'}{money(e.amount)}</td></tr>)}{treasury.entries.length === 0 && <tr><td colSpan={3} className="text-center text-muted-foreground">No borrowing recorded.</td></tr>}</tbody></table></div></div>
      </section>
      <section className="contribution-panel">
        <label className="input-label" htmlFor="mcl">Maximum Credit Limit (bylaws)</label>
        <div className="flex gap-2"><div className="amount-input flex-1"><span className="text-muted-foreground">₦</span><Input id="mcl" inputMode="decimal" value={mcl} onChange={e => setMclText(e.target.value)} /></div><Button variant="outline" className="h-[44px]" onClick={() => run(onMcl, parseNaira(mcl))}>Save</Button></div>
        <label className="input-label mt-6" htmlFor="borrow-amount">Record drawdown or repayment</label>
        <div className="amount-input"><span className="text-muted-foreground">₦</span><Input id="borrow-amount" inputMode="decimal" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-2 mt-3"><Button disabled={!amt || !treasury.enabled || s.locked} onClick={() => run(onDraw, amt, () => setAmount(''))}>Draw funds</Button><Button variant="outline" disabled={!amt || !s.outstanding} onClick={() => run(onRepay, amt, () => setAmount(''))}>Repay</Button></div>
        <Button variant="ghost" className="mt-2 w-full text-[11px]" disabled={!s.headroom} onClick={() => setAmount(String(s.headroom / 100))}>Use maximum permitted ({money(s.headroom)})</Button>
        {error && <p className="mt-3 text-[11px] text-destructive" role="alert">{error}</p>}
        <p className="mt-4 text-[10px] text-muted-foreground">Drawdowns are rejected if they would exceed the MCL or the {REGULATORY_CAP_PERCENT}% equity cap. Simulation only.</p>
      </section>
    </div>
  </div>;
}

/* ---------- Member: loan application, schedule, calendar ---------- */
type MemberLoansProps = {
  state: FinanceState; loans: Loan[]; members: NamedMember[]; memberId: string;
  onApply: (input: { amount: number; termMonths: number; frequency: Frequency; guarantorIds: string[] }) => string | void;
  onPay: (id: string) => void; onMethod: (id: string, m: InterestMethod) => string | void;
};
export function MemberLoans({ state, loans, members, memberId, onApply, onPay, onMethod }: MemberLoansProps) {
  const [amount, setAmount] = useState('');
  const [term, setTerm] = useState<number>(12);
  const [frequency, setFrequency] = useState<Frequency>('monthly');
  const [g1, setG1] = useState('');
  const [g2, setG2] = useState('');
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState('');
  const savings = memberBalances(state, memberId).savings;
  const frozen = frozenFor(loans, memberId);
  const available = availableSavings(state, loans, memberId);
  const kobo = parseNaira(amount);
  const input = { memberId, amount: kobo, termMonths: term, frequency, guarantorIds: [g1, g2] };
  const errors = validateApplication(state, loans, members, input);
  const others = members.filter(m => m.id !== memberId);
  const mine = loans.filter(l => l.memberId === memberId).slice().reverse();
  const guaranteed = loans.filter(l => l.guarantorIds.includes(memberId) && (l.status === 'pending' || l.status === 'approved'));
  const preview = useMemo(() => kobo > 0 && !errors.amount ? buildSchedule({ principal: kobo, termMonths: term, frequency, method: 'reducing', start: '2000-01-01' })[0]?.payment : undefined, [kobo, term, frequency, errors.amount]);
  function submit() {
    setTouched(true); setServerError('');
    if (errors.general || errors.amount || errors.guarantors) return;
    const e = onApply({ amount: kobo, termMonths: term, frequency, guarantorIds: [g1, g2] });
    if (e) setServerError(e); else { setAmount(''); setG1(''); setG2(''); setTouched(false); }
  }
  const sel = 'h-9 w-full rounded-md border border-input bg-card px-2 text-sm';
  return <div className="mt-7 grid gap-6">
    <div className="metrics">
      <Stat label="Liquid savings" value={money(savings)} />
      <Stat label="Frozen as guarantor" value={money(frozen)} detail={frozen ? 'Released as borrowers repay principal' : 'Nothing frozen'} />
      <Stat label="Available savings" value={money(available)} />
      <Stat label={`Maximum loan (${LOAN_RULES.savingsMultiplier}× savings)`} value={money(maxLoanFor(available))} />
    </div>
    <div className="content-grid !my-0">
      <section>
        <div className="section-title"><div><h2>Loans you've applied for</h2><p className="text-[11px] text-muted-foreground mt-1">Approved loans show a live repayment schedule and calendar.</p></div></div>
        {mine.length === 0 && <p className="text-xs text-muted-foreground">No loan applications yet.</p>}
        <div className="grid gap-6">{mine.map(l => l.status === 'approved' || l.status === 'completed'
          ? <LoanSchedule key={l.id} loan={l} onPay={onPay} onMethod={onMethod} />
          : <div key={l.id} className="rounded-lg border border-border p-4 text-xs flex flex-wrap items-center justify-between gap-3"><div><strong>{money(l.principal)}</strong> · {frequencyLabel(l.frequency)} · {l.termMonths} months<span className="block text-[10px] text-muted-foreground mt-1">Guarantors: {l.guarantorIds.map(id => nameOf(members, id)).join(', ')} · Applied {fmtDate(l.appliedOn)}</span></div><StatusBadge status={l.status} /></div>)}</div>
        {guaranteed.length > 0 && <div className="table-frame mt-6"><div className="table-scroll"><table className="data-table"><thead><tr><th>Loans you guarantee</th><th>Borrower</th><th>Status</th><th className="amount">Your frozen amount</th></tr></thead><tbody>{guaranteed.map(l => <tr key={l.id}><td>{money(l.principal)}</td><td>{nameOf(members, l.memberId)}</td><td><StatusBadge status={l.status} /></td><td className="amount">{money(frozenFor([l], memberId))}</td></tr>)}</tbody></table></div></div>}
      </section>
      <section className="contribution-panel">
        <div className="section-title"><h2>Apply for a loan</h2><span className="category Savings">Simulation</span></div>
        <label className="input-label" htmlFor="loan-amount">Loan amount</label>
        <div className="amount-input"><span className="text-muted-foreground">₦</span><Input id="loan-amount" inputMode="decimal" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} aria-invalid={!!errors.amount && !!amount} /></div>
        {amount && errors.amount && <p className="mt-2 text-[11px] text-destructive" role="alert">{errors.amount}</p>}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <label className="grid gap-1.5 text-[11px] font-semibold">Term<select className={sel} value={term} onChange={e => setTerm(Number(e.target.value))}>{LOAN_RULES.terms.map(t => <option key={t} value={t}>{t} months</option>)}</select></label>
          <label className="grid gap-1.5 text-[11px] font-semibold">Repayment Frequency<select className={sel} value={frequency} onChange={e => setFrequency(e.target.value as Frequency)}><option value="weekly">Weekly Payments</option><option value="monthly">Monthly Payments</option></select></label>
        </div>
        <div className="grid gap-3 mt-4">
          {[[g1, setG1, 'Guarantor 1'], [g2, setG2, 'Guarantor 2']].map(([val, set, label]) => <label key={label as string} className="grid gap-1.5 text-[11px] font-semibold">{label as string}<select className={sel} value={val as string} onChange={e => (set as (v: string) => void)(e.target.value)}><option value="">Select an active member</option>{others.map(m => <option key={m.id} value={m.id}>{m.fullName} · {money(availableSavings(state, loans, m.id))} available</option>)}</select></label>)}
        </div>
        {touched && errors.guarantors && <p className="mt-2 text-[11px] text-destructive" role="alert">{errors.guarantors}</p>}
        {touched && errors.general && <p className="mt-2 text-[11px] text-destructive" role="alert">{errors.general}</p>}
        {serverError && <p className="mt-2 text-[11px] text-destructive" role="alert">{serverError}</p>}
        <div className="split-box">
          <div className="split-row"><span>Payments</span><strong>{periodsFor(term, frequency)} × {frequency === 'weekly' ? 'weekly' : 'monthly'}</strong></div>
          <div className="split-row"><span>Est. instalment (reducing balance)</span><strong>{preview ? money(preview) : '—'}</strong></div>
          <div className="split-row"><span>Each guarantor freezes</span><strong>{kobo > 0 ? money(guaranteeEach(kobo)) : '—'}</strong></div>
        </div>
        <div className="notice warning"><ShieldAlert size={14} className="shrink-0 mt-0.5" /><span>{FREEZE_NOTICE}</span></div>
        <Button className="button-main" onClick={submit}>Submit application</Button>
        <p className="mt-3 text-center text-[10px] text-muted-foreground">Interest {LOAN_RULES.annualRateBps / 100}% p.a. · Guarantors secure {LOAN_RULES.guarantorCoverPercent}% of principal</p>
      </section>
    </div>
  </div>;
}

export function LoanSchedule({ loan, onPay, onMethod }: { loan: Loan; onPay: (id: string) => void; onMethod: (id: string, m: InterestMethod) => string | void }) {
  const rows = scheduleFor(loan);
  const next = nextDue(loan);
  const [picked, setPicked] = useState<number | null>(null);
  const [error, setError] = useState('');
  const paid = rows.slice(0, loan.paidCount), upcoming = rows.slice(loan.paidCount + 1);
  const totalInterest = rows.reduce((s, r) => s + r.interest, 0);
  const detail = rows.find(r => r.n === picked) ?? next ?? rows.at(-1);
  const locked = loan.paidCount > 0;
  const toggle = (m: InterestMethod) => { const e = onMethod(loan.id, m); setError(e ?? ''); };
  return <div className="rounded-lg border border-border p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="text-sm font-bold">{money(loan.principal)} loan <StatusBadge status={loan.status} /></h3><p className="text-[11px] text-muted-foreground mt-1">{frequencyLabel(loan.frequency)} · {rows.length} payments · approved {fmtDate(loan.approvedOn ?? loan.appliedOn)}</p></div>
      <div className="mode-switch" role="group" aria-label="Interest basis">{(['flat', 'reducing'] as const).map(m => <Button key={m} variant="ghost" disabled={locked && loan.interestMethod !== m} className={`mode-button ${loan.interestMethod === m ? 'selected' : ''}`} aria-pressed={loan.interestMethod === m} onClick={() => toggle(m)}>{m === 'flat' ? 'Flat Interest Rate' : 'Reducing Balance'}</Button>)}</div>
    </div>
    {(locked || error) && <p className="mt-2 text-[10px] text-muted-foreground">{error || 'Interest basis is locked once repayments have started.'}</p>}
    <div className="metrics compact mt-4">
      <Stat label="Remaining balance" value={money(outstandingPrincipal(loan))} />
      <Stat label="Next payment due" value={next ? fmtDate(next.due) : 'Fully repaid'} detail={next ? `${money(next.payment)} · #${next.n} of ${rows.length}` : undefined} />
      <Stat label="Total interest" value={money(totalInterest)} detail={methodLabel(loan.interestMethod)} />
      <Stat label="Progress" value={`${loan.paidCount} / ${rows.length}`} detail="Instalments paid" />
    </div>
    <div className="grid md:grid-cols-[auto_minmax(0,1fr)] gap-5 mt-5 items-start">
      <div className="border border-border rounded-lg"><Calendar mode="single" defaultMonth={toDate(next?.due ?? rows[0]!.due)} numberOfMonths={1}
        modifiers={{ paid: paid.map(r => toDate(r.due)), next: next ? [toDate(next.due)] : [], due: upcoming.map(r => toDate(r.due)) }}
        modifiersClassNames={{ paid: 'cal-paid', next: 'cal-next', due: 'cal-due' }}
        onDayClick={d => { const r = rows.find(x => toDate(x.due).getTime() === d.getTime()); if (r) setPicked(r.n); }} />
        <div className="flex gap-3 px-4 pb-3 text-[10px] text-muted-foreground"><span><span className="dot" />Paid</span><span><span className="dot cal-dot-next" />Next</span><span><span className="dot cal-dot-due" />Upcoming</span></div></div>
      <div className="grid gap-3">
        {detail && <div className="split-box !m-0"><div className="split-row"><span>Instalment #{detail.n} · {fmtDate(detail.due)}</span><strong>{money(detail.payment)}</strong></div><div className="split-row"><span>Principal</span><span>{money(detail.principal)}</span></div><div className="split-row"><span>Interest</span><span>{money(detail.interest)}</span></div><div className="split-row"><span>Balance after</span><span>{money(detail.balance)}</span></div></div>}
        {loan.status === 'approved' && <Button onClick={() => { setPicked(null); onPay(loan.id); }}><Check size={14} />Simulate payment of next instalment</Button>}
        {loan.status === 'completed' && <div className="notice !m-0"><CheckCircle2 size={14} />Loan fully repaid. Guarantor savings released.</div>}
      </div>
    </div>
    <div className="table-frame mt-5"><div className="table-scroll" style={{ maxHeight: 340, overflowY: 'auto' }}><table className="data-table"><thead><tr><th>#</th><th>Due date</th><th className="amount">Payment</th><th className="amount">Principal</th><th className="amount">Interest</th><th className="amount">Remaining balance</th><th>Status</th></tr></thead><tbody>{rows.map(r => <tr key={r.n} className={r.n === next?.n ? 'bg-accent' : ''}><td>{r.n}</td><td>{fmtDate(r.due)}</td><td className="amount">{money(r.payment)}</td><td className="amount">{money(r.principal)}</td><td className="amount">{money(r.interest)}</td><td className="amount">{money(r.balance)}</td><td>{r.n <= loan.paidCount ? 'Paid' : r.n === next?.n ? 'Next due' : 'Upcoming'}</td></tr>)}</tbody></table></div></div>
  </div>;
}

/* ---------- Admin: credit committee ---------- */
type CommitteeProps = { loans: Loan[]; members: NamedMember[]; onDecide: (id: string, d: 'approved' | 'rejected') => void };
export function CreditCommittee({ loans, members, onDecide }: CommitteeProps) {
  const pending = loans.filter(l => l.status === 'pending');
  const decided = loans.filter(l => l.status !== 'pending').slice().reverse();
  return <div className="mt-7 grid gap-8">
    <section>
      <div className="section-title"><div><h2>Credit committee review · {pending.length} pending</h2><p className="text-[11px] text-muted-foreground mt-1">Approving generates the borrower's amortization schedule and payment calendar.</p></div></div>
      {pending.length === 0 ? <p className="text-xs text-muted-foreground">No applications awaiting review.</p> : <div className="table-frame"><div className="table-scroll"><table className="data-table"><thead><tr><th>Applicant</th><th className="amount">Amount</th><th>Risk multiplier</th><th>Repayment</th><th>Guarantors (frozen each)</th><th className="text-right">Decision</th></tr></thead><tbody>{pending.map(l => { const mult = l.principal / l.savingsBasis; return <tr key={l.id}>
        <td>{nameOf(members, l.memberId)}<span className="block text-[10px] text-muted-foreground">Savings {money(l.savingsBasis)} · applied {fmtDate(l.appliedOn)}</span></td>
        <td className="amount">{money(l.principal)}</td>
        <td>{mult.toFixed(2)}× <span className="text-muted-foreground">of {LOAN_RULES.savingsMultiplier}.00×</span><span className="block text-[10px] text-muted-foreground">{riskBand(mult)} risk</span></td>
        <td>{frequencyLabel(l.frequency)}<span className="block text-[10px] text-muted-foreground">{periodsFor(l.termMonths, l.frequency)} payments · {l.termMonths} months</span></td>
        <td>{l.guarantorIds.map(id => nameOf(members, id)).join(' & ')}<span className="block text-[10px] text-muted-foreground">{money(l.guaranteeEach)} each</span></td>
        <td><div className="flex justify-end gap-2"><Button size="sm" onClick={() => onDecide(l.id, 'approved')}><Check size={13} />Approve</Button><Button size="sm" variant="outline" onClick={() => onDecide(l.id, 'rejected')}><X size={13} />Reject</Button></div></td></tr>; })}</tbody></table></div></div>}
    </section>
    <section>
      <h2 className="mb-4">Loan book</h2>
      <div className="table-frame"><div className="table-scroll"><table className="data-table"><thead><tr><th>Borrower</th><th className="amount">Principal</th><th>Status</th><th>Schedule</th><th>Progress</th><th className="amount">Outstanding</th></tr></thead><tbody>{decided.map(l => <tr key={l.id}><td>{nameOf(members, l.memberId)}</td><td className="amount">{money(l.principal)}</td><td><StatusBadge status={l.status} /></td><td>{frequencyLabel(l.frequency)} · {methodLabel(l.interestMethod)}</td><td>{l.status === 'rejected' ? '—' : `${l.paidCount} / ${periodsFor(l.termMonths, l.frequency)}`}</td><td className="amount">{money(outstandingPrincipal(l))}</td></tr>)}{decided.length === 0 && <tr><td colSpan={6} className="text-center text-muted-foreground">No decided loans yet.</td></tr>}</tbody></table></div></div>
    </section>
  </div>;
}
