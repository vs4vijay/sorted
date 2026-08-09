import 'server-only';
import { providerEnabled } from '@/lib/providers/provider-controls';
import { VoiceTranscriptSchemaV1, type VoiceTranscript } from '../schemas/voice-note';

export type TranscriptionResult = {
  data: VoiceTranscript;
  execution: {
    provider: 'sarvam' | 'fixture';
    model: string;
    promptVersion: 'voice-note.prompt.v1';
    schemaVersion: 'voice-transcript.v1';
    requestId?: string;
    latencyMs: number;
    status: 'succeeded' | 'simulated';
    error?: { code: string; message: string };
  };
};
export interface SpeechToTextProvider {
  transcribe(
    bytes: Uint8Array,
    mediaType: string,
    languageCode: string,
  ): Promise<TranscriptionResult>;
}

export class FakeSpeechToTextProvider implements SpeechToTextProvider {
  async transcribe(
    ...input: Parameters<SpeechToTextProvider['transcribe']>
  ): Promise<TranscriptionResult> {
    void input;
    return {
      data: VoiceTranscriptSchemaV1.parse({
        schemaVersion: 'voice-transcript.v1',
        transcript:
          'Senior backend candidates should demonstrate production PostgreSQL ownership and explain one reliability improvement in detail.',
        languageCode: 'hi-IN',
        draftCriterion: {
          name: 'Production database ownership',
          description: 'Demonstrates hands-on ownership of PostgreSQL systems in production.',
          evidenceExpectations:
            'A specific production example with scale, decisions, and a measurable reliability or performance outcome.',
        },
      }),
      execution: {
        provider: 'fixture',
        model: 'deterministic-saaras-fixture-v1',
        promptVersion: 'voice-note.prompt.v1',
        schemaVersion: 'voice-transcript.v1',
        latencyMs: 0,
        status: 'simulated',
      },
    };
  }
}

export class SaarasSpeechToTextProvider implements SpeechToTextProvider {
  async transcribe(
    bytes: Uint8Array,
    mediaType: string,
    languageCode: string,
  ): Promise<TranscriptionResult> {
    const started = Date.now();
    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(bytes).buffer as ArrayBuffer], { type: mediaType }),
      `voice-note.${mediaType.includes('webm') ? 'webm' : 'wav'}`,
    );
    form.append('model', 'saaras:v3');
    form.append(
      'language_code',
      languageCode === 'unknown' ? 'unknown' : languageCode.split('-')[0]!,
    );
    const response = await fetch('https://api.sarvam.ai/speech-to-text', {
      method: 'POST',
      headers: { 'api-subscription-key': process.env.SARVAM_API_KEY! },
      body: form,
    });
    const body = (await response.json()) as {
      transcript?: string;
      language_code?: string;
      request_id?: string;
      error?: { code?: string; message?: string };
    };
    if (!response.ok || !body.transcript)
      throw Object.assign(
        new Error(body.error?.message ?? `Saaras request failed (${response.status})`),
        {
          code: body.error?.code ?? `http_${response.status}`,
          requestId: body.request_id,
          latencyMs: Date.now() - started,
        },
      );
    const transcript = body.transcript.trim();
    return {
      data: VoiceTranscriptSchemaV1.parse({
        schemaVersion: 'voice-transcript.v1',
        transcript,
        languageCode: body.language_code?.startsWith('hi')
          ? 'hi-IN'
          : body.language_code?.startsWith('en')
            ? 'en-IN'
            : 'unknown',
        draftCriterion: {
          name: 'Voice-note requirement',
          description: transcript.slice(0, 500),
          evidenceExpectations:
            'Candidate evidence directly supporting this human-reviewed requirement.',
        },
      }),
      execution: {
        provider: 'sarvam',
        model: 'saaras:v3',
        promptVersion: 'voice-note.prompt.v1',
        schemaVersion: 'voice-transcript.v1',
        requestId: body.request_id ?? response.headers.get('x-request-id') ?? undefined,
        latencyMs: Date.now() - started,
        status: 'succeeded',
      },
    };
  }
}

export async function transcribeVoiceNote(
  bytes: Uint8Array,
  mediaType: string,
  languageCode: string,
): Promise<TranscriptionResult> {
  if (!providerEnabled('sarvam'))
    return new FakeSpeechToTextProvider().transcribe(bytes, mediaType, languageCode);
  try {
    return await new SaarasSpeechToTextProvider().transcribe(bytes, mediaType, languageCode);
  } catch (error) {
    const fallback = await new FakeSpeechToTextProvider().transcribe(
      bytes,
      mediaType,
      languageCode,
    );
    return {
      ...fallback,
      execution: {
        ...fallback.execution,
        error: {
          code: String((error as { code?: string }).code ?? 'provider_error'),
          message: 'Saaras transcription was unavailable; deterministic simulated output was used.',
        },
      },
    };
  }
}
