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
  role: OrganizationRoleSchema.exclude(['admin']),
});

export const UpdateMemberRoleInputSchema = z.object({
  membershipId: z.string().uuid(),
  role: OrganizationRoleSchema,
});

export const RevokeInvitationInputSchema = z.object({ invitationId: z.string().uuid() });

export const AcceptInvitationInputSchema = z.object({
  token: z.string().min(32).max(256),
  name: z.string().trim().min(2).max(100),
  password: z.string().min(12).max(128).regex(/[A-Za-z]/, 'Add at least one letter.').regex(/[0-9]/, 'Add at least one number.'),
});

export const InvitationAcceptanceViewSchema = z.object({
  invitationId: z.string().min(1), organizationId: z.string().min(1), organizationName: z.string().min(2),
  organizationSlug: z.string().min(1), email: z.email(), role: OrganizationRoleSchema,
  status: InvitationStatusSchema, expiresAt: z.coerce.date(),
});

export const OrganizationMemberViewSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.email(),
  role: OrganizationRoleSchema,
  joinedAt: z.coerce.date(),
  isCurrentUser: z.boolean(),
});

export const InvitationViewSchema = z.object({
  id: z.string().min(1),
  email: z.email(),
  role: OrganizationRoleSchema,
  status: InvitationStatusSchema,
  expiresAt: z.coerce.date(),
  createdAt: z.coerce.date(),
});

export const FirstRunSetupInputSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().pipe(z.email()),
  organizationName: z.string().trim().min(2).max(120),
  organizationSlug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  timezone: z.string().min(1).default('Asia/Kolkata'),
  defaultLocale: z.string().min(2).max(20).default('en-IN'),
  password: z.string().min(12).max(128).regex(/[A-Za-z]/, 'Add at least one letter.').regex(/[0-9]/, 'Add at least one number.'),
});

export const SignInInputSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1).max(128),
});


export type OrganizationRole = z.infer<typeof OrganizationRoleSchema>;
export type OrganizationMemberView = z.infer<typeof OrganizationMemberViewSchema>;
export type InvitationView = z.infer<typeof InvitationViewSchema>;
export type InvitationAcceptanceView = z.infer<typeof InvitationAcceptanceViewSchema>;
export type ResolvedOrganizationAccess = z.infer<typeof ResolvedOrganizationAccessSchema>;
export type OrganizationPermission = typeof rolePermissions[OrganizationRole][number];

export const rolePermissions = {
  admin: ['organization:manage', 'members:manage', 'candidates:manage', 'candidates:export', 'positions:manage', 'rubrics:approve', 'reviews:submit', 'shortlist:decide', 'outreach:manage'],
  recruiter: ['candidates:manage', 'candidates:export', 'positions:manage', 'reviews:submit', 'outreach:manage'],
  hiring_manager: ['positions:manage', 'rubrics:approve', 'reviews:submit', 'shortlist:decide'],
  technical_reviewer: ['reviews:submit'],
} as const satisfies Record<OrganizationRole, readonly string[]>;

export function roleCan(role: OrganizationRole, permission: OrganizationPermission): boolean {
  return (rolePermissions[role] as readonly string[]).includes(permission);
}
