import { z } from 'zod';

export const COOP_NAME = 'ACPN IDEA COOP';
export const PRACTICE_TYPES = ['Community pharmacy', 'Hospital pharmacy', 'Industrial pharmacy', 'Academic / regulatory', 'Other'] as const;
export const ELIGIBLE_PRACTICE = 'Community pharmacy';

const text = (label: string, max = 120) => z.string().trim().min(1, `${label} is required`).max(max, `${label} is too long`);
const address = (label: string) => z.object({
  street: text(`${label} street`, 200),
  city: text(`${label} city`, 80),
  state: text(`${label} state`, 80),
});

export const memberSchema = z.object({
  fullName: text('Full name', 100),
  email: z.string().trim().email('Enter a valid email').max(255),
  phone: z.string().trim().regex(/^\+?\d{10,14}$/, 'Enter a valid phone number'),
  pcnNumber: z.string().trim().regex(/^[A-Za-z0-9/-]{4,20}$/, 'Enter your PCN registration number'),
  practiceType: z.enum(PRACTICE_TYPES),
  businessName: text('Pharmacy name', 120),
  premisesLicence: z.string().trim().regex(/^[A-Za-z0-9/-]{4,20}$/, 'Enter the pharmacy premises licence number'),
  personalAddress: address('Personal'),
  businessAddress: address('Business'),
  bankName: text('Bank name', 80),
  bankAccountNumber: z.string().trim().regex(/^\d{10}$/, 'Bank account number must be 10 digits'),
}).refine(v => v.practiceType === ELIGIBLE_PRACTICE, { path: ['practiceType'], message: `Only community pharmacists can join ${COOP_NAME}` });

export type MemberDetails = z.infer<typeof memberSchema>;
export type MemberProfile = MemberDetails & { id: string; accountNumber: string; joined: string; addedBy: 'self' | 'admin' };

export function accountNumberFor(sequence: number) {
  return `AIC-${String(sequence).padStart(6, '0')}`;
}

export function emptyDetails(): MemberDetails {
  const a = { street: '', city: '', state: '' };
  return { fullName: '', email: '', phone: '', pcnNumber: '', practiceType: ELIGIBLE_PRACTICE, businessName: '', premisesLicence: '', personalAddress: { ...a }, businessAddress: { ...a }, bankName: '', bankAccountNumber: '' };
}

export function fieldErrors(details: MemberDetails) {
  const result = memberSchema.safeParse(details);
  if (result.success) return {};
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) { const key = issue.path.join('.'); if (!errors[key]) errors[key] = issue.message; }
  return errors;
}

const seed: [string, string, string, string, string][] = [
  ['m1', 'Oyedamola Moreira', 'Moreira Pharmacy', 'Ikeja', 'Lagos'],
  ['m2', 'Chidinma Okafor', 'Grace Community Pharmacy', 'Enugu', 'Enugu'],
  ['m3', 'Tunde Bakare', 'Bakare Health Store', 'Ibadan', 'Oyo'],
  ['m4', 'Aisha Bello', 'Crescent Pharmacy', 'Kano', 'Kano'],
  ['m5', 'Emeka Nwosu', 'Unity Pharmacy', 'Owerri', 'Imo'],
];
const joined = ['2026-07-01', '2026-07-15', '2026-08-01', '2026-08-15', '2026-09-01'];

export function initialProfiles(): MemberProfile[] {
  return seed.map(([id, fullName, businessName, city, state], i) => ({
    id, fullName, businessName, accountNumber: accountNumberFor(i + 1), joined: joined[i] ?? '2026-07-01', addedBy: 'admin',
    email: `${fullName.split(' ')[0]?.toLowerCase()}@example.com`, phone: `0803000000${i}`, pcnNumber: `PCN/${10230 + i}`,
    practiceType: ELIGIBLE_PRACTICE, premisesLicence: `PL/${2040 + i}`,
    personalAddress: { street: `${12 + i} Residential Close`, city, state },
    businessAddress: { street: `${4 + i} Market Road`, city, state },
    bankName: 'Sample Bank', bankAccountNumber: `012345678${i}`,
  }));
}
