'use server';

import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { OrganizationAccessRepository } from '@/features/organizations/repositories/organization-access-repository';
import {
  CreateInvitationInputSchema,
  RevokeInvitationInputSchema,
  UpdateMemberRoleInputSchema,
} from '@/features/organizations/schemas/access';
import { AccessError, requireCurrentAccess } from '@/lib/auth/session';
import { enforceRateLimit } from '@/lib/security/rate-limit';

export type MemberActionState = {
  status?: 'success' | 'error';
  message?: string;
  acceptanceUrl?: string;
  errors?: Record<string, string[]>;
};

export async function inviteMember(
  _: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  try {
    const access = await requireCurrentAccess('members:manage');
    await enforceRateLimit(access.organization.id, access.userId, 'member_invitation');
    const parsed = CreateInvitationInputSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success)
      return {
        status: 'error',
        message: 'Check the invitation details.',
        errors: parsed.error.flatten().fieldErrors,
      };
    const token = randomBytes(32).toString('base64url');
    const created = await new OrganizationAccessRepository().createInvitation({
      id: randomUUID(),
      organizationId: access.organization.id,
      invitedById: access.userId,
      ...parsed.data,
      tokenHash: createHash('sha256').update(token).digest('hex'),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      auditEventId: randomUUID(),
    });
    if (!created)
      return { status: 'error', message: 'A current invitation already exists for this email.' };
    revalidatePath('/settings/members');
    return {
      status: 'success',
      message: `Invitation prepared for ${parsed.data.email}. Delivery is simulated in this preview.`,
      acceptanceUrl: `/invitations/${token}`,
    };
  } catch (error) {
    if (error instanceof AccessError) return { status: 'error', message: error.message };
    return {
      status: 'error',
      message:
        'A pending invitation already exists for this email, or the invitation could not be saved.',
    };
  }
}

export async function revokeInvitation(formData: FormData): Promise<void> {
  const access = await requireCurrentAccess('members:manage');
  const parsed = RevokeInvitationInputSchema.parse(Object.fromEntries(formData));
  await new OrganizationAccessRepository().revokeInvitation({
    invitationId: parsed.invitationId,
    organizationId: access.organization.id,
    actorUserId: access.userId,
    auditEventId: randomUUID(),
  });
  revalidatePath('/settings/members');
}

export async function updateMemberRole(formData: FormData): Promise<void> {
  const access = await requireCurrentAccess('members:manage');
  const parsed = UpdateMemberRoleInputSchema.parse(Object.fromEntries(formData));
  if (parsed.membershipId === access.membership.id)
    throw new Error('Ask another administrator to change your role.');
  await new OrganizationAccessRepository().updateMemberRole({
    organizationId: access.organization.id,
    actorUserId: access.userId,
    ...parsed,
    auditEventId: randomUUID(),
  });
  revalidatePath('/settings/members');
}
