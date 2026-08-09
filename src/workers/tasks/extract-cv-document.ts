import type { JobPayload } from '@/lib/queue/types';
import { privateDocumentStorage } from '@/features/candidates/services/private-document-storage';
import { documentTextExtractionProvider } from '@/features/candidates/services/document-extraction-provider';
import { extractCandidate } from '@/features/candidates/sarvam/candidate-ingestion-provider';
import { CandidateIngestionRepository } from '@/features/candidates/repositories/candidate-ingestion-repository';

export interface ExtractCvDocumentPayload extends JobPayload {
  organizationId: string;
  documentId: string;
}
export async function processCandidateDocument(payload: ExtractCvDocumentPayload) {
  const repo = new CandidateIngestionRepository();
  const row = await repo.getDocument(payload.organizationId, payload.documentId);
  if (!row) throw new Error('Organization-scoped candidate document not found.');
  if (!['clean', 'clean_simulated'].includes(String(row.malware_scan_status)))
    throw new Error('Candidate document is not cleared for extraction.');
  const sourceId = String(row.source_id),
    runId = String(row.ingestion_run_id);
  try {
    await repo.markExtracting(payload.organizationId, sourceId);
    const bytes = await privateDocumentStorage.get(String(row.storage_key));
    let markdown: string | null = null,
      pageCount: number | null = null,
      pdfType: string | null = null,
      pages: number[] = [],
      extractor = '',
      version = '',
      confidence: number | null = null,
      processingMs: number | null = null,
      status: 'parsed' | 'needs_review' = 'parsed';
    if (String(row.media_type) === 'application/pdf') {
      const result = await documentTextExtractionProvider.extractPdf(bytes);
      markdown = result.markdown;
      pageCount = result.pageCount;
      pdfType = result.pdfType;
      pages = result.pagesNeedingOcr;
      extractor = result.extractor;
      version = result.extractorVersion;
      confidence = result.confidence;
      processingMs = Math.round(result.processingTimeMs);
      if (result.pageCount > 50) throw new Error('PDF exceeds the 50-page CV limit.');
      if (
        result.pagesNeedingOcr.length ||
        result.hasEncodingIssues ||
        result.pdfType === 'Scanned' ||
        result.pdfType === 'ImageBased'
      )
        status = 'needs_review';
    } else {
      const result = await documentTextExtractionProvider.extractDocx(bytes);
      markdown = result.markdown;
      extractor = result.extractor;
      version = result.extractorVersion;
    }
    const candidate = await extractCandidate(markdown ?? '', String(row.source_label));
    await repo.complete({
      org: payload.organizationId,
      documentId: payload.documentId,
      sourceId,
      runId,
      positionId: row.position_id ? String(row.position_id) : undefined,
      actorId: String(row.created_by_id),
      candidate: candidate.data,
      markdown,
      pageCount,
      pdfType,
      pages,
      extractor,
      version,
      confidence,
      processingMs,
      status,
      execution: candidate.execution,
    });
  } catch (error) {
    await repo.fail(
      payload.organizationId,
      payload.documentId,
      sourceId,
      runId,
      error instanceof Error ? error.message : 'Document processing failed.',
    );
    throw error;
  }
}
export default async function extractCvDocumentTask(rawPayload: JobPayload) {
  const payload = rawPayload as ExtractCvDocumentPayload;
  if (typeof payload.organizationId !== 'string' || typeof payload.documentId !== 'string')
    throw new Error('Invalid candidate extraction job payload.');
  await processCandidateDocument(payload);
}
