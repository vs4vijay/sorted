import { describe, expect, test } from 'bun:test';
import { extractDeterministicCandidate } from '../services/deterministic-candidate-extraction';

describe('extractDeterministicCandidate', () => {
  test('extracts source-backed contact and display fields from deterministic CV text', async () => {
    const result = extractDeterministicCandidate(
      'Riya Sharma\nSenior Backend Engineer\nriya.sharma@example.com\nBengaluru, India',
      'uploaded-cv.docx',
    );
    expect(result).toMatchObject({
      displayName: 'Riya Sharma',
      headline: 'Senior Backend Engineer',
      location: 'Bengaluru, India',
      emails: ['riya.sharma@example.com'],
    });
  });
});
