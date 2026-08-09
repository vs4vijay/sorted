import { describe, expect, test } from 'bun:test';
import { validateCandidateDocument } from './document-validation';
const pdf = new TextEncoder().encode('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF');
describe('candidate document validation', () => {
  test('accepts a structurally complete PDF', () => {
    const file = new File([pdf], 'synthetic.pdf', { type: 'application/pdf' });
    expect(validateCandidateDocument(file, pdf).mediaType).toBe('application/pdf');
  });
  test('rejects renamed content', () => {
    const file = new File(['not a pdf'], 'synthetic.pdf');
    expect(() => validateCandidateDocument(file, new TextEncoder().encode('not a pdf'))).toThrow(
      'signature',
    );
  });
  test('rejects truncated PDFs and active content', () => {
    expect(() =>
      validateCandidateDocument(
        new File(['%PDF-1.7'], 'bad.pdf'),
        new TextEncoder().encode('%PDF-1.7'),
      ),
    ).toThrow('incomplete');
    const active = new TextEncoder().encode('%PDF-1.7 /JavaScript %%EOF');
    expect(() => validateCandidateDocument(new File([active], 'active.pdf'), active)).toThrow(
      'active or embedded',
    );
  });
  test('rejects a generic ZIP renamed as DOCX', () => {
    const bytes = new TextEncoder().encode('PK\u0003\u0004ordinary archive');
    expect(() => validateCandidateDocument(new File([bytes], 'candidate.docx'), bytes)).toThrow(
      'not a valid DOCX',
    );
  });
  test('rejects mismatched browser content type', () => {
    expect(() =>
      validateCandidateDocument(new File([pdf], 'candidate.pdf', { type: 'text/plain' }), pdf),
    ).toThrow('content type');
  });
  test('rejects unsupported formats', () => {
    const file = new File(['candidate'], 'candidate.txt');
    expect(() => validateCandidateDocument(file, new TextEncoder().encode('candidate'))).toThrow(
      'only PDF and DOCX',
    );
  });
});
