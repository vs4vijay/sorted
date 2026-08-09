import { describe, expect, test } from 'bun:test';
import { CandidateIngestionRepository } from './candidate-ingestion-repository';

describe('CandidateIngestionRepository tenant boundaries', () => {
  test('scopes candidate lists and source joins to the organization', async () => {
    const calls: { sql: string; params?: unknown[] }[] = [];
    const repo = new CandidateIngestionRepository(async (sql, params) => {
      calls.push({ sql, params });
      return [];
    });
    await repo.listCandidates('org-a');
    expect(calls[0].sql).toContain('c.organization_id=$1');
    expect(calls[0].params).toEqual(['org-a']);
  });
  test('requires organization plus checksum for exact document deduplication', async () => {
    const calls: { sql: string; params?: unknown[] }[] = [];
    const repo = new CandidateIngestionRepository(async (sql, params) => {
      calls.push({ sql, params });
      return [];
    });
    await repo.checksumExists('org-a', 'checksum');
    expect(calls[0].sql).toContain('d.organization_id=$1 AND d.checksum=$2');
    expect(calls[0].params).toEqual(['org-a', 'checksum']);
  });
  test('denies cross-organization document and quarantine lookup by construction', async () => {
    const calls: { sql: string; params?: unknown[] }[] = [];
    const repo = new CandidateIngestionRepository(async (sql, params) => {
      calls.push({ sql, params });
      return [];
    });
    expect(await repo.getDocument('org-a', 'document-from-org-b')).toBeUndefined();
    await repo.listQuarantined('org-a');
    expect(calls[0].sql).toContain('d.organization_id=$1 AND d.id=$2');
    expect(calls[0].params).toEqual(['org-a', 'document-from-org-b']);
    expect(calls[1].sql).toContain('d.organization_id=$1');
    expect(calls[1].params).toEqual(['org-a']);
  });
  test('security scan mutations require organization and document identifiers', async () => {
    const calls: { sql: string; params?: unknown[] }[] = [];
    const repo = new CandidateIngestionRepository(async (sql, params) => {
      calls.push({ sql, params });
      return [{ subject_id: 'document' }];
    });
    expect(
      await repo.recordMalwareScan({
        org: 'org-a',
        documentId: 'document',
        actorId: 'actor',
        status: 'quarantined',
        provider: 'fixture',
        engineVersion: 'v1',
        error: 'threat',
      }),
    ).toBe(true);
    expect(calls[0].sql).toContain('organization_id=$1 AND id=$2');
    expect(calls[0].params?.slice(0, 2)).toEqual(['org-a', 'document']);
  });
});
