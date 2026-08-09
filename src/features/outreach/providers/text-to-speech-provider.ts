import 'server-only';
import { CandidateAudioOutputSchema, type CandidateAudioOutput } from '../schemas/candidate-audio';

export type SpeechExecution = { provider: 'sarvam' | 'fixture'; model: string; schemaVersion: 'candidate-audio.v1'; requestId?: string; latencyMs: number; status: 'succeeded' | 'simulated'; error?: { code: string; message: string } };
export interface TextToSpeechProvider { synthesize(text: string, languageCode: string, voice: string): Promise<{ data: CandidateAudioOutput; execution: SpeechExecution }>; }

function quietWav(): Uint8Array {
  const samples = 8_000;
  const bytes = new Uint8Array(44 + samples);
  const view = new DataView(bytes.buffer);
  const write = (offset: number, value: string) => [...value].forEach((char, index) => bytes[offset + index] = char.charCodeAt(0));
  write(0, 'RIFF'); view.setUint32(4, 36 + samples, true); write(8, 'WAVEfmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, 8_000, true); view.setUint32(28, 8_000, true); view.setUint16(32, 1, true); view.setUint16(34, 8, true); write(36, 'data'); view.setUint32(40, samples, true); bytes.fill(128, 44);
  return bytes;
}

export class FakeTextToSpeechProvider implements TextToSpeechProvider {
  async synthesize(...input: Parameters<TextToSpeechProvider['synthesize']>): Promise<{ data: CandidateAudioOutput; execution: SpeechExecution }> {
    void input;
    return { data: CandidateAudioOutputSchema.parse({ schemaVersion: 'candidate-audio.v1', mediaType: 'audio/wav', audio: quietWav() }), execution: { provider: 'fixture', model: 'deterministic-bulbul-fixture-v1', schemaVersion: 'candidate-audio.v1', latencyMs: 0, status: 'simulated' } };
  }
}

export class BulbulTextToSpeechProvider implements TextToSpeechProvider {
  async synthesize(text: string, languageCode: string, voice: string): Promise<{ data: CandidateAudioOutput; execution: SpeechExecution }> {
    const started = Date.now();
    const response = await fetch('https://api.sarvam.ai/text-to-speech', { method: 'POST', headers: { 'api-subscription-key': process.env.SARVAM_API_KEY!, 'content-type': 'application/json' }, body: JSON.stringify({ inputs: [text], target_language_code: languageCode, speaker: voice, model: 'bulbul:v3', pace: 1.0, speech_sample_rate: 22050, enable_preprocessing: true }) });
    const body = await response.json() as { audios?: string[]; request_id?: string; error?: { code?: string; message?: string } };
    if (!response.ok || !body.audios?.[0]) throw Object.assign(new Error(body.error?.message ?? `Bulbul request failed (${response.status})`), { code: body.error?.code ?? `http_${response.status}`, requestId: body.request_id });
    return { data: CandidateAudioOutputSchema.parse({ schemaVersion: 'candidate-audio.v1', mediaType: 'audio/wav', audio: Uint8Array.from(Buffer.from(body.audios[0], 'base64')) }), execution: { provider: 'sarvam' as const, model: 'bulbul:v3', schemaVersion: 'candidate-audio.v1' as const, requestId: body.request_id ?? response.headers.get('x-request-id') ?? undefined, latencyMs: Date.now() - started, status: 'succeeded' as const } };
  }
}

export async function synthesizeCandidateAudio(text: string, languageCode: string, voice: string) {
  if (!process.env.SARVAM_API_KEY) return new FakeTextToSpeechProvider().synthesize(text, languageCode, voice);
  try { return await new BulbulTextToSpeechProvider().synthesize(text, languageCode, voice); }
  catch (error) { const fallback = await new FakeTextToSpeechProvider().synthesize(text, languageCode, voice); return { ...fallback, execution: { ...fallback.execution, error: { code: String((error as { code?: string }).code ?? 'provider_error'), message: 'Bulbul generation was unavailable; deterministic simulated audio was used.' } } }; }
}
