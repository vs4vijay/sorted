import { CandidateExtractionSchemaV1, type CandidateExtraction } from '../schemas/ingestion';

export function extractDeterministicCandidate(
  markdown: string,
  sourceLabel: string,
): CandidateExtraction {
  const stem = sourceLabel
    .replace(/\.(pdf|docx)$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const generic = /^document\s*\(?\d*\)?$/i.test(stem);
  const lines = markdown
    .split(/\n+/)
    .map((line) => line.replace(/^#+\s*/, '').trim())
    .filter(Boolean);
  const labeledName = lines
    .find((line) => /^name\s*:/i.test(line))
    ?.replace(/^name\s*:\s*/i, '')
    .trim();
  const firstLine = lines.find(
    (line) =>
      line.length >= 2 &&
      line.length <= 100 &&
      !/^(summary|experience|education|skills?|employment|projects?|contact|email|phone|location|availability)\b/i.test(
        line,
      ),
  );
  const displayName = labeledName || firstLine || (!generic ? stem : 'Candidate awaiting review');
  const emails = [
    ...new Set(
      markdown
        .match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)
        ?.map((value) => value.toLowerCase()) ?? [],
    ),
  ].slice(0, 5);
  const phones = [
    ...new Set(markdown.match(/(?:\+?91[\s-]?)?[6-9]\d{9}\b/g)?.map((value) => value.trim()) ?? []),
  ].slice(0, 5);
  const headline =
    lines.find(
      (line) =>
        line !== displayName &&
        /\b(engineer|developer|architect|manager|designer|analyst|recruiter)\b/i.test(line),
    ) ?? null;
  const location =
    lines
      .find((line) =>
        /^(?:location\s*:\s*)?(?:bengaluru|bangalore|mumbai|delhi|new delhi|hyderabad|chennai|pune|kolkata|gurugram|gurgaon|noida)(?:,\s*india)?$/i.test(
          line,
        ),
      )
      ?.replace(/^location\s*:\s*/i, '') ?? null;
  return CandidateExtractionSchemaV1.parse({
    schemaVersion: 'candidate-extraction.v1',
    displayName,
    headline,
    location,
    emails,
    phones,
    externalProfiles: [],
    identityHints: [],
    processingWarnings: [
      'Simulated extraction from deterministic CV text rules; recruiter review required.',
    ],
  });
}
