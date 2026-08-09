import { redirect } from 'next/navigation';
import { getCurrentAccess } from '@/lib/auth/session';
import { AuthShell } from '../auth-shell';
import { SignInForm } from '../auth-form';
export default async function SignInPage() {
  if (await getCurrentAccess()) redirect('/');
  return (
    <AuthShell
      eyebrow="SECURE ACCESS"
      title="Welcome back"
      description="Sign in to your organization’s recruiting workspace."
    >
      <SignInForm />
    </AuthShell>
  );
}
