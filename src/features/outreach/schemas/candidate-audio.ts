import { z } from 'zod';

export const CandidateAudioLanguageSchema = z.enum(['hi-IN', 'en-IN', 'ta-IN', 'te-IN', 'kn-IN', 'ml-IN', 'mr-IN', 'bn-IN', 'gu-IN', 'pa-IN', 'od-IN']);
export const CandidateAudioVoiceSchema = z.enum(['anushka', 'manisha', 'vidya', 'arya']);

export const CandidateAudioOutputSchema = z.object({
  schemaVersion: z.literal('candidate-audio.v1'),
  mediaType: z.literal('audio/wav'),
  audio: z.instanceof(Uint8Array).refine(value => value.byteLength > 44, 'Audio output is empty.'),
});

export const RecordAudioPreferenceSchema = z.object({
  threadId: z.string().uuid(),
  candidateId: z.string().uuid(),
  languageCode: CandidateAudioLanguageSchema,
  consentConfirmed: z.literal('on', { error: 'Confirm the candidate opted in to an audio preview.' }),
});

export const GenerateCandidateAudioSchema = z.object({
  threadId: z.string().uuid(),
  messageId: z.string().uuid(),
  languageCode: CandidateAudioLanguageSchema,
  voice: CandidateAudioVoiceSchema,
});
export const DeleteCandidateAudioSchema = z.object({ threadId: z.string().uuid(), assetId: z.string().uuid() });

export type CandidateAudioOutput = z.infer<typeof CandidateAudioOutputSchema>;
