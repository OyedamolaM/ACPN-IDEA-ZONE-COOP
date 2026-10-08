import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { CheckCircle2, Cuboid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MemberForm } from '@/components/MemberForm';
import { COOP_NAME, emptyDetails, type MemberProfile } from '@/lib/membership';
import { useMembership } from '@/lib/membership-store';

export const Route = createFileRoute('/register')({
  head: () => ({ meta: [
    { title: `Join ${COOP_NAME} — Community Pharmacists' Cooperative` },
    { name: 'description', content: `Register as a member of ${COOP_NAME}. Open to licensed community pharmacists in Nigeria.` },
    { property: 'og:title', content: `Join ${COOP_NAME}` },
    { property: 'og:description', content: 'Membership registration for community pharmacists.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary' },
  ] }),
  component: Register,
});

function Register() {
  const { addMember } = useMembership();
  const [done, setDone] = useState<MemberProfile | null>(null);
  return <div className="min-h-screen bg-background px-4 py-10"><div className="mx-auto max-w-2xl">
    <div className="flex items-center gap-2 font-bold text-lg"><Cuboid className="text-primary" />{COOP_NAME}</div>
    {done ? <div className="mt-10 rounded-xl border border-border bg-card p-8 text-center">
      <CheckCircle2 className="mx-auto text-primary" size={40} />
      <h1 className="mt-4 text-2xl font-bold">Welcome, {done.fullName}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Your membership account number is</p>
      <p className="mt-1 text-2xl font-bold tracking-wider">{done.accountNumber}</p>
      <p className="mt-4 text-xs text-muted-foreground">Simulation only — no real account has been opened.</p>
      <Button asChild className="mt-6"><Link to="/">Go to dashboard</Link></Button>
    </div> : <>
      <h1 className="mt-8 text-3xl font-bold">Become a member</h1>
      <p className="mt-2 text-sm text-muted-foreground">{COOP_NAME} is open only to licensed community pharmacists. Your personal and pharmacy business addresses are required.</p>
      <div className="mt-8 rounded-xl border border-border bg-card p-6"><MemberForm initial={emptyDetails()} submitLabel="Register" onSubmit={d => { setDone(addMember(d, 'self')); }} /></div>
      <p className="mt-4 text-center text-xs text-muted-foreground">Already a member? <Link to="/" className="text-primary underline">Open your dashboard</Link></p>
    </>}
  </div></div>;
}
