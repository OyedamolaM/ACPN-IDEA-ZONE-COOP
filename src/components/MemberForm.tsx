import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ELIGIBLE_PRACTICE, PRACTICE_TYPES, fieldErrors, type MemberDetails } from '@/lib/membership';

type Props = { initial: MemberDetails; submitLabel: string; onSubmit: (d: MemberDetails) => string | void; lockIdentity?: boolean | undefined; lockEmail?: boolean; onChange?: (details: MemberDetails) => void };

export function MemberForm({ initial, submitLabel, onSubmit, lockIdentity, lockEmail, onChange }: Props) {
  const [d, setD] = useState<MemberDetails>(initial);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState('');
  const formId = useId();
  const errors = fieldErrors(d);
  const show = (k: string) => touched && errors[k] ? <span id={`${formId}-${k}-error`} className="text-[11px] text-destructive">{errors[k]}</span> : null;
  const accessibility = (k: string) => ({ 'aria-invalid': Boolean(touched && errors[k]), 'aria-describedby': touched && errors[k] ? `${formId}-${k}-error` : undefined });
  const set = (patch: Partial<MemberDetails>) => { const next = { ...d, ...patch }; setD(next); onChange?.(next); };

  function field(label: string, key: keyof MemberDetails, opts: { placeholder?: string; disabled?: boolean | undefined; inputMode?: 'numeric' | 'tel' | 'email' } = {}) {
    return <div className="grid gap-1.5 text-xs font-medium"><label htmlFor={`${formId}-${key}`}>{label}</label><Input id={`${formId}-${key}`} {...accessibility(key)} type={opts.inputMode === 'email' ? 'email' : opts.inputMode === 'tel' ? 'tel' : 'text'} value={String(d[key])} disabled={opts.disabled} inputMode={opts.inputMode} placeholder={opts.placeholder} onChange={e => set({ [key]: e.target.value } as Partial<MemberDetails>)} />{show(key)}</div>;
  }
  function addr(label: string, key: 'personalAddress' | 'businessAddress') {
    const a = d[key];
    const upd = (p: Partial<typeof a>) => set({ [key]: { ...a, ...p } } as Partial<MemberDetails>);
    return <fieldset className="grid gap-3 rounded-lg border border-border p-4"><legend className="px-1 text-xs font-semibold">{label} <span className="text-destructive">*</span></legend>
      <div className="grid gap-1.5 text-xs"><label htmlFor={`${formId}-${key}-street`}>Street address</label><Input id={`${formId}-${key}-street`} {...accessibility(`${key}.street`)} value={a.street} onChange={e => upd({ street: e.target.value })} />{show(`${key}.street`)}</div>
      <div className="grid grid-cols-2 gap-3"><div className="grid gap-1.5 text-xs"><label htmlFor={`${formId}-${key}-city`}>City</label><Input id={`${formId}-${key}-city`} {...accessibility(`${key}.city`)} value={a.city} onChange={e => upd({ city: e.target.value })} />{show(`${key}.city`)}</div><div className="grid gap-1.5 text-xs"><label htmlFor={`${formId}-${key}-state`}>State</label><Input id={`${formId}-${key}-state`} {...accessibility(`${key}.state`)} value={a.state} onChange={e => upd({ state: e.target.value })} />{show(`${key}.state`)}</div></div>
    </fieldset>;
  }
  function submit(e: React.FormEvent) {
    e.preventDefault(); setTouched(true); setError('');
    if (Object.keys(errors).length) { setError('Please fix the highlighted fields.'); return; }
    try { const msg = onSubmit(d); if (msg) setError(msg); } catch (err) { setError(err instanceof Error ? err.message : 'Could not save.'); }
  }
  const ineligible = d.practiceType !== ELIGIBLE_PRACTICE;

  return <form onSubmit={submit} className="grid gap-6" noValidate>
    <section className="grid gap-3"><h3 className="text-sm font-semibold">Personal details</h3>
      <div className="grid sm:grid-cols-2 gap-3">{field('Full name', 'fullName', { disabled: lockIdentity })}{field('Email', 'email', { inputMode: 'email', disabled: lockEmail })}{field('Phone number', 'phone', { inputMode: 'tel', placeholder: '08030000000' })}{field('PCN registration number', 'pcnNumber', { disabled: lockIdentity, placeholder: 'PCN/12345' })}</div>
      {addr('Personal (home) address', 'personalAddress')}
    </section>
    <section className="grid gap-3"><h3 className="text-sm font-semibold">Pharmacy business</h3>
      <label className="grid gap-1.5 text-xs font-medium">Area of practice<select className="h-9 rounded-md border border-input bg-card px-2 text-sm" value={d.practiceType} disabled={lockIdentity} onChange={e => set({ practiceType: e.target.value as MemberDetails['practiceType'] })}>{PRACTICE_TYPES.map(p => <option key={p}>{p}</option>)}</select></label>
      {ineligible && <div className="notice warning">Membership is open only to community pharmacists.</div>}
      <div className="grid sm:grid-cols-2 gap-3">{field('Pharmacy name', 'businessName')}{field('Premises licence number', 'premisesLicence', { placeholder: 'PL/1234' })}</div>
      {addr('Business (pharmacy) address', 'businessAddress')}
    </section>
    <section className="grid gap-3"><h3 className="text-sm font-semibold">Bank account for payouts</h3>
      <div className="grid sm:grid-cols-2 gap-3">{field('Bank name', 'bankName')}{field('Account number (10 digits)', 'bankAccountNumber', { inputMode: 'numeric' })}</div>
    </section>
    {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
    <Button type="submit" disabled={ineligible}>{submitLabel}</Button>
  </form>;
}
