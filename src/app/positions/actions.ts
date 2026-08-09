'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireCurrentAccess } from '@/lib/auth/session';
import { CreatePositionSchema } from '@/features/positions/schemas/position';
import { structureJobDescription } from '@/features/positions/sarvam/job-description-provider';
import { PositionRepository } from '@/features/positions/repositories/position-repository';
import {
  UploadVoiceNoteSchema,
  ReviewVoiceTranscriptSchema,
  VoiceTranscriptSchemaV1,
} from '@/features/voice-notes/schemas/voice-note';
import { privateAudioStorage } from '@/features/voice-notes/services/private-audio-storage';
import { transcribeVoiceNote } from '@/features/voice-notes/sarvam/speech-to-text-provider';
import { VoiceNoteRepository } from '@/features/voice-notes/repositories/voice-note-repository';
import { createHash } from 'node:crypto';

export type PositionActionState = { error?: string };
export async function createPosition(
  _: PositionActionState,
  formData: FormData,
): Promise<PositionActionState> {
  const access = await requireCurrentAccess('positions:manage');
  const parsed = CreatePositionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? 'Check the position details.' };
  const structured = await structureJobDescription(parsed.data.jobDescription, parsed.data.title);
  const id = crypto.randomUUID();
  await new PositionRepository().create({
    id,
    organizationId: access.organization.id,
    actorId: access.userId,
    ...parsed.data,
    rawText: parsed.data.jobDescription,
    structured: structured.data,
    execution: structured.execution,
    jobDescriptionId: crypto.randomUUID(),
    rubricId: crypto.randomUUID(),
    executionId: crypto.randomUUID(),
    auditId: crypto.randomUUID(),
  });
  redirect(`/positions/${id}`);
}
export async function approveRubric(positionId: string, rubricId: string) {
  const access = await requireCurrentAccess('rubrics:approve');
  const ok = await new PositionRepository().approve({
    organizationId: access.organization.id,
    positionId,
    rubricId,
    actorId: access.userId,
    auditId: crypto.randomUUID(),
  });
  if (!ok) throw new Error('Rubric must be a draft and scored weights must total 100.');
  revalidatePath(`/positions/${positionId}`);
}

export async function uploadVoiceNote(formData: FormData) {
  const access = await requireCurrentAccess('positions:manage');
  const parsed = UploadVoiceNoteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Check the voice note.');
  const audio = formData.get('audio');
  if (!(audio instanceof File) || audio.size < 1 || audio.size > 25 * 1024 * 1024)
    throw new Error('Choose an audio file up to 25 MB.');
  const allowed = new Set(['audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp4', 'audio/webm']);
  if (!allowed.has(audio.type)) throw new Error('Use WAV, MP3, M4A, or WebM audio.');
  const bytes = new Uint8Array(await audio.arrayBuffer());
  const id = crypto.randomUUID(),
    storageKey = `${access.organization.id}/${id}`;
  await privateAudioStorage.put(storageKey, bytes);
  const repository = new VoiceNoteRepository();
  await repository.create({
    id,
    organizationId: access.organization.id,
    positionId: parsed.data.positionId,
    actorId: access.userId,
    purpose: parsed.data.purpose,
    languageCode: parsed.data.languageCode,
    storageKey,
    mediaType: audio.type,
    byteSize: audio.size,
    checksum: createHash('sha256').update(bytes).digest('hex'),
  });
  const result = await transcribeVoiceNote(bytes, audio.type, parsed.data.languageCode);
  await repository.complete({
    id,
    organizationId: access.organization.id,
    result,
    executionId: crypto.randomUUID(),
  });
  revalidatePath(`/positions/${parsed.data.positionId}`);
}

export async function approveVoiceTranscript(formData: FormData) {
  const access = await requireCurrentAccess('positions:manage');
  const parsed = ReviewVoiceTranscriptSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Review the transcript.');
  const repository = new VoiceNoteRepository();
  const note = await repository.get(access.organization.id, parsed.data.voiceNoteId);
  if (!note || note.position_id !== parsed.data.positionId)
    throw new Error('Voice note not found.');
  const transcriptData = VoiceTranscriptSchemaV1.parse(note.transcript_data);
  const criterion = transcriptData.draftCriterion
    ? { ...transcriptData.draftCriterion, description: parsed.data.transcript.slice(0, 500) }
    : null;
  const ok = await repository.approveAndCreateDraft({
    organizationId: access.organization.id,
    positionId: parsed.data.positionId,
    voiceNoteId: parsed.data.voiceNoteId,
    actorId: access.userId,
    transcript: parsed.data.transcript,
    criterion,
  });
  if (!ok) throw new Error('This transcript has already been reviewed.');
  revalidatePath(`/positions/${parsed.data.positionId}`);
}

export async function deleteVoiceSource(positionId: string, voiceNoteId: string) {
  const access = await requireCurrentAccess('positions:manage');
  const repository = new VoiceNoteRepository();
  const note = await repository.get(access.organization.id, voiceNoteId);
  if (!note || note.position_id !== positionId) throw new Error('Voice note not found.');
  const key = typeof note.storage_key === 'string' ? note.storage_key : null;
  const changed = await repository.markDeleted(access.organization.id, voiceNoteId, access.userId);
  if (changed && key) await privateAudioStorage.remove(key);
  revalidatePath(`/positions/${positionId}`);
}
