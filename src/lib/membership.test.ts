import { describe, expect, it } from 'vitest';
import { accountNumberFor, fieldErrors, initialProfiles } from './membership';
const valid = () => { const { id, accountNumber, joined, addedBy, ...d } = initialProfiles()[0]!; return d; };
describe('Membership rules', () => {
  it('accepts a community pharmacist', () => { expect(fieldErrors(valid())).toEqual({}); });
  it('rejects non-community pharmacists', () => { expect(fieldErrors({ ...valid(), practiceType: 'Hospital pharmacy' })['practiceType']).toBeTruthy(); });
  it('requires a business address', () => { expect(fieldErrors({ ...valid(), businessAddress: { street: '', city: 'Ikeja', state: 'Lagos' } })['businessAddress.street']).toBeTruthy(); });
  it('requires a personal address', () => { expect(fieldErrors({ ...valid(), personalAddress: { street: 'x', city: '', state: 'Lagos' } })['personalAddress.city']).toBeTruthy(); });
  it('requires a 10-digit bank account number', () => { expect(fieldErrors({ ...valid(), bankAccountNumber: '12345' })['bankAccountNumber']).toBeTruthy(); });
  it('formats member account numbers', () => { expect(accountNumberFor(6)).toBe('AIC-000006'); });
});
