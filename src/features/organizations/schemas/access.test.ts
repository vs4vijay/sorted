import { describe, expect, test } from 'bun:test';
import { AcceptInvitationInputSchema, CreateInvitationInputSchema, OrganizationSchema, RevokeInvitationInputSchema, roleCan } from './access';

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
expect(roleCan('admin', 'shortlist:decide')).toBe(true);
    expect(roleCan('technical_reviewer', 'organization:manage')).toBe(false);
    expect(roleCan('technical_reviewer', 'candidates:export')).toBe(false);
  });

  test('validates invitation mutation inputs', () => {
    expect(RevokeInvitationInputSchema.safeParse({ invitationId: 'not-an-id' }).success).toBe(false);
    expect(AcceptInvitationInputSchema.parse({ token: 'a'.repeat(43), name: ' Ravi Reviewer ', password: 'reviewer-pass-12' }).name).toBe('Ravi Reviewer');
  });
});
