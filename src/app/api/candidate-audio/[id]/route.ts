import { requireCurrentAccess } from '@/lib/auth/session';
import { CandidateAudioRepository } from '@/features/outreach/repositories/candidate-audio-repository';
import { privateCandidateAudioStorage } from '@/features/outreach/services/private-candidate-audio-storage';

export const runtime = 'nodejs';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireCurrentAccess('outreach:manage');
  const { id } = await context.params;
  const asset = await new CandidateAudioRepository().getAsset(access.organization.id, id);
  if (!asset?.storage_key) return new Response('Not found', { status: 404 });
  const url = new URL(request.url);
  const expires = Number(url.searchParams.get('expires'));
  const signature = url.searchParams.get('signature') ?? '';
  if (!privateCandidateAudioStorage.verify(String(asset.storage_key), expires, signature))
    return new Response('Link expired', { status: 403 });
  const bytes = await privateCandidateAudioStorage.get(String(asset.storage_key));
  return new Response(bytes, {
    headers: {
      'content-type': String(asset.media_type ?? 'audio/wav'),
      'content-disposition': 'inline; filename="candidate-audio-preview.wav"',
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}
