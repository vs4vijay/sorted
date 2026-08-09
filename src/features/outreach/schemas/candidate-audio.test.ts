import { describe, expect, test } from 'bun:test';
import {
  CandidateAudioOutputSchema,
  GenerateCandidateAudioSchema,
  RecordAudioPreferenceSchema,
} from './candidate-audio';

describe('candidate audio contracts', () => {
  test('requires explicit candidate opt-in', () => {
    expect(
      RecordAudioPreferenceSchema.safeParse({
        threadId: crypto.randomUUID(),
        candidateId: crypto.randomUUID(),
        languageCode: 'hi-IN',
      }).success,
    ).toBe(false);
  });

  test('restricts generation to supported language and voice values', () => {
    expect(
      GenerateCandidateAudioSchema.safeParse({
        threadId: crypto.randomUUID(),
        messageId: crypto.randomUUID(),
        languageCode: 'hi-IN',
        voice: 'anushka',
      }).success,
    ).toBe(true);
    expect(
      GenerateCandidateAudioSchema.safeParse({
        threadId: crypto.randomUUID(),
        messageId: crypto.randomUUID(),
        languageCode: 'xx-XX',
        voice: 'clone',
      }).success,
    ).toBe(false);
  });

  test('rejects empty provider audio', () => {
    expect(
      CandidateAudioOutputSchema.safeParse({
        schemaVersion: 'candidate-audio.v1',
        mediaType: 'audio/wav',
        audio: new Uint8Array(10),
      }).success,
    ).toBe(false);
  });
});
