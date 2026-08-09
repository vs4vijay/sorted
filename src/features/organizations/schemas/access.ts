import { z } from 'zod';

export const OrganizationRoleSchema = z.enum([
  'admin',
  'recruiter',
  'hiring_manager',
  'technical_reviewer',
]);

export const OrganizationStatusSchema = z.enum(['active', 'suspended', 'archived']);
export const InvitationStatusSchema = z.enum(['pending', 'accepted', 'revoked', 'expired']);

export const OrganizationSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2).max(120),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  status: OrganizationStatusSchema,
  timezone: z.string().min(1),
  defaultLocale: z.string().min(2).max(20),
  retentionDays: z.number().int().min(30).max(3650),
});

export const OrganizationMemberSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  userId: z.string().min(1),
  role: OrganizationRoleSchema,
});

export const ResolvedOrganizationAccessSchema = z.object({
  sessionId: z.string().min(1),
  userId: z.string().min(1),
  userEmail: z.email(),
  userName: z.string().min(1),
  organization: OrganizationSchema,
  membership: OrganizationMemberSchema,
});

export const CreateInvitationInputSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  role: OrganizationRoleSchema,
});

export const FirstRunSetupInputSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().pipe(z.email()),
  organizationName: z.string().trim().min(2).max(120),
  organizationSlug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  timezone: z.string().min(1).default('Asia/Kolkata'),
  defaultLocale: z.string().min(2).max(20).default('en-IN'),
});

export type OrganizationRole = z.infer<typeof OrganizationRoleSchema>;
export type ResolvedOrganizationAccess = z.infer<typeof ResolvedOrganizationAccessSchema>;
export type OrganizationPermission = typeof rolePermissions[OrganizationRole][number];

export const rolePermissions = {
  admin: ['organization:manage', 'members:manage', 'candidates:manage', 'candidates:export', 'positions:manage', 'reviews:submit'],
  recruiter: ['candidates:manage', 'candidates:export', 'positions:manage', 'reviews:submit'],
  hiring_manager: ['positions:manage', 'rubrics:approve', 'reviews:submit', 'shortlist:decide'],
  technical_reviewer: ['reviews:submit'],
} as const satisfies Record<OrganizationRole, readonly string[]>;

export function roleCan(role: OrganizationRole, permission: OrganizationPermission): boolean {
  return (rolePermissions[role] as readonly string[]).includes(permission);
}
