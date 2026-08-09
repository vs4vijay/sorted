import { z } from 'zod';

export const VoiceNotePurposeSchema = z.enum([
  'position_requirement',
  'screening_note',
  'panel_feedback',
]);
export const VoiceNoteLanguageSchema = z.enum(['hi-IN', 'en-IN', 'unknown']);
export const VoiceTranscriptSchemaV1 = z.object({
  schemaVersion: z.literal('voice-transcript.v1'),
  transcript: z.string().trim().min(2).max(20_000),
  languageCode: VoiceNoteLanguageSchema,
  draftCriterion: z
    .object({
      name: z.string().trim().min(2).max(120),
      description: z.string().trim().min(2).max(500),
      evidenceExpectations: z.string().trim().min(2).max(500),
    })
    .nullable(),
});

export const UploadVoiceNoteSchema = z.object({
  positionId: z.string().uuid(),
  purpose: VoiceNotePurposeSchema,
  languageCode: VoiceNoteLanguageSchema,
  consent: z.literal('on', { error: 'Confirm that this voice note was recorded with permission.' }),
});

export const ReviewVoiceTranscriptSchema = z.object({
  voiceNoteId: z.string().uuid(),
  positionId: z.string().uuid(),
  transcript: z.string().trim().min(2).max(20_000),
});

export type VoiceTranscript = z.infer<typeof VoiceTranscriptSchemaV1>;
