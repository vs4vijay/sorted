export type SetupConflictState = {
  message: string;
  errors: Record<string, string[]>;
};

export function setupConflictState(input: {
  emailTaken?: boolean;
  slugTaken?: boolean;
}): SetupConflictState | null {
  const errors: Record<string, string[]> = {};
  if (input.emailTaken) {
    errors.email = ['An account with this email already exists. Sign in instead.'];
  }
  if (input.slugTaken) {
    errors.organizationSlug = ['This workspace URL is already taken. Choose another.'];
  }
  if (Object.keys(errors).length === 0) return null;

  if (input.emailTaken && input.slugTaken) {
    return {
      message: 'That email and workspace URL are already in use.',
      errors,
    };
  }
  if (input.emailTaken) {
    return {
      message: 'An account with this email already exists. Sign in instead.',
      errors,
    };
  }
  return {
    message: 'This workspace URL is already taken. Choose another.',
    errors,
  };
}

function uniqueConstraintHint(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  const record = error as {
    code?: unknown;
    message?: unknown;
    meta?: { code?: unknown; message?: unknown; target?: unknown };
    cause?: unknown;
  };
  const parts = [
    typeof record.code === 'string' ? record.code : '',
    typeof record.message === 'string' ? record.message : '',
    typeof record.meta?.code === 'string' ? record.meta.code : '',
    typeof record.meta?.message === 'string' ? record.meta.message : '',
    Array.isArray(record.meta?.target) ? record.meta.target.join(' ') : '',
    uniqueConstraintHint(record.cause),
  ];
  return parts.join(' ').toLowerCase();
}

export function isUniqueConstraintViolation(error: unknown): boolean {
  const hint = uniqueConstraintHint(error);
  return (
    hint.includes('23505') ||
    hint.includes('p2002') ||
    hint.includes('unique constraint') ||
    hint.includes('duplicate key')
  );
}

export function mapUniqueViolationToSetupState(error: unknown): SetupConflictState | null {
  if (!isUniqueConstraintViolation(error)) return null;
  const hint = uniqueConstraintHint(error);
  const emailTaken = hint.includes('users_email') || hint.includes('(email)');
  const slugTaken =
    hint.includes('organizations_slug') || hint.includes('(slug)') || hint.includes('slug_key');

  if (emailTaken || slugTaken) {
    return setupConflictState({ emailTaken, slugTaken });
  }

  return {
    message: 'That email or workspace URL is already in use.',
    errors: {
      email: ['This email may already be registered.'],
      organizationSlug: ['This workspace URL may already be taken.'],
    },
  };
}
