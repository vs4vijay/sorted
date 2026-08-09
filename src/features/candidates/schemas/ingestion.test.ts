import { describe, expect, test } from 'bun:test';
import { CandidateExtractionSchemaV1, PdfExtractionResultSchema } from './ingestion';
describe('candidate ingestion contracts', () => {
  test('normalizes the deterministic PDF extractor contract', () => {
    const result = PdfExtractionResultSchema.parse({
      pdfType: 'TextBased',
      markdown: '# Synthetic Candidate',
      pageCount: 1,
      processingTimeMs: 1,
      pagesNeedingOcr: [],
      confidence: 0.9,
      isComplexLayout: false,
      pagesWithTables: [],
      pagesWithColumns: [],
      hasEncodingIssues: false,
      title: null,
      extractor: 'firecrawl-pdf-inspector',
      extractorVersion: 'fake-1',
    });
    expect(result.pagesNeedingOcr).toEqual([]);
  });
  test('rejects protected or uncontracted model fields', () => {
    const parsed = CandidateExtractionSchemaV1.parse({
      schemaVersion: 'candidate-extraction.v1',
      displayName: 'Synthetic Candidate',
      headline: null,
      location: null,
      emails: [],
      phones: [],
      externalProfiles: [],
      identityHints: [],
      processingWarnings: [],
      gender: 'ignored',
    });
    expect('gender' in parsed).toBe(false);
  });
  test('requires versioned normalized output', () => {
    expect(() => CandidateExtractionSchemaV1.parse({ displayName: 'Candidate' })).toThrow();
  });
});
