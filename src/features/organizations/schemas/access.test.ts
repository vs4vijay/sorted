import { describe, expect, test } from 'bun:test';
import { CreateInvitationInputSchema, OrganizationSchema, roleCan } from './access';

describe('organization access contracts', () => {
  test('normalizes an invitation email and accepts panel roles', () => {
    expect(CreateInvitationInputSchema.parse({ email: ' Reviewer@Example.com ', role: 'technical_reviewer' })).toEqual({
      email: 'reviewer@example.com',
      role: 'technical_reviewer',
    });
  });

  test('rejects unsafe retention settings', () => {
    expect(() => OrganizationSchema.parse({
      id: 'org-1', name: 'Acme India', slug: 'acme-india', status: 'active',
      timezone: 'Asia/Kolkata', defaultLocale: 'en-IN', retentionDays: 7,
    })).toThrow();
  });

  test('keeps technical reviewers away from organization and export permissions', () => {
    expect(roleCan('technical_reviewer', 'reviews:submit')).toBe(true);
    expect(roleCan('technical_reviewer', 'organization:manage')).toBe(false);
    expect(roleCan('technical_reviewer', 'candidates:export')).toBe(false);
  });
});
