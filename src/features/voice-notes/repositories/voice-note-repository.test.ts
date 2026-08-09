import { describe, expect, test } from 'bun:test';
import { VoiceNoteRepository } from './voice-note-repository';

describe('voice note repository isolation', () => {
  test('scopes position notes to organization and position', async () => {
    const calls: { sql: string; params?: unknown[] }[] = [];
    const repository = new VoiceNoteRepository(async (sql, params) => {
      calls.push({ sql, params });
      return [];
    });
    await repository.listForPosition('org-a', 'position-a');
    expect(calls[0]?.sql).toContain('organization_id=$1 AND position_id=$2');
    expect(calls[0]?.params).toEqual(['org-a', 'position-a']);
  });
  test('records consent before transcription output exists', async () => {
    const calls: { sql: string }[] = [];
    const repository = new VoiceNoteRepository(async (sql) => {
      calls.push({ sql });
      return [];
    });
    await repository.create({
      id: 'note',
      organizationId: 'org',
      positionId: 'position',
      actorId: 'actor',
      purpose: 'position_requirement',
      languageCode: 'hi-IN',
      storageKey: 'org/note',
      mediaType: 'audio/webm',
      byteSize: 10,
      checksum: 'sum',
    });
    expect(calls[0]?.sql).toContain('consent_recorded_at');
    expect(calls[0]?.sql).toContain("'voice_note.uploaded'");
  });
  test('uses organization scope when deleting private source metadata', async () => {
    const calls: { sql: string; params?: unknown[] }[] = [];
    const repository = new VoiceNoteRepository(async (sql, params) => {
      calls.push({ sql, params });
      return [{ id: 'note' }];
    });
    expect(await repository.markDeleted('org-a', 'note', 'actor')).toBe(true);
    expect(calls[0]?.sql).toContain('id=$1 AND organization_id=$2');
  });
});
