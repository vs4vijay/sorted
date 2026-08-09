'use server';
import { HostedCandidatePrivacyRequestInputSchema } from '@/features/candidates/schemas/privacy';
import { CandidatePrivacyRepository } from '@/features/candidates/repositories/candidate-privacy-repository';
export type HostedPrivacyState = { success?: string; error?: string };
export async function submitHostedPrivacyRequest(
  token: string,
  _state: HostedPrivacyState,
  formData: FormData,
): Promise<HostedPrivacyState> {
  try {
    const parsed = HostedCandidatePrivacyRequestInputSchema.safeParse({
      requestType: formData.get('requestType') || undefined,
      details: formData.get('details'),
      optOutEmail: formData.get('optOutEmail') === 'on',
    });
    if (!parsed.success)
      return { error: parsed.error.issues[0]?.message ?? 'Review the form and try again.' };
    const result = await new CandidatePrivacyRepository().submitHostedRequest(token, parsed.data);
    const parts = [];
    if (result.requestRecorded) parts.push('Your privacy request was recorded for human review');
    if (result.emailOptedOut) parts.push('email outreach has been stopped');
    return { success: `${parts.join(' and ')}. We will keep an auditable record of this request.` };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : 'We could not record the request. Please contact the hiring team.',
    };
  }
}
