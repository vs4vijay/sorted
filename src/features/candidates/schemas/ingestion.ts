import { z } from 'zod';

export const ProcessingStatusSchema = z.enum(['uploaded','scanning','extracting','parsed','needs_review','failed']);
export const PdfExtractionResultSchema = z.object({
  pdfType: z.enum(['TextBased','Scanned','ImageBased','Mixed']), markdown: z.string().nullable(),
  pageCount: z.number().int().nonnegative(), processingTimeMs: z.number().nonnegative(),
  pagesNeedingOcr: z.array(z.number().int().positive()), confidence: z.number().min(0).max(1),
  isComplexLayout: z.boolean(), pagesWithTables: z.array(z.number().int().positive()),
  pagesWithColumns: z.array(z.number().int().positive()), hasEncodingIssues: z.boolean(),
  title: z.string().nullable(), extractor: z.literal('firecrawl-pdf-inspector'), extractorVersion: z.string(),
});
export type PdfExtractionResult = z.infer<typeof PdfExtractionResultSchema>;
export interface DocumentTextExtractionProvider { extractPdf(buffer: Uint8Array): Promise<PdfExtractionResult>; extractDocx(buffer: Uint8Array): Promise<{markdown:string; extractor:string; extractorVersion:string}> }

export const CandidateExtractionSchemaV1 = z.object({
  schemaVersion: z.literal('candidate-extraction.v1'), displayName: z.string().min(1).max(160),
  headline: z.string().max(240).nullable(), location: z.string().max(160).nullable(),
  emails: z.array(z.string().email()).max(5), phones: z.array(z.string().min(7).max(30)).max(5),
  externalProfiles: z.array(z.object({ provider:z.enum(['github','portfolio','linkedin','other']), url:z.string().url(), externalId:z.string().nullable() })).max(10),
  identityHints: z.array(z.string().max(160)).max(10), processingWarnings: z.array(z.string().max(240)).max(20),
});
export type CandidateExtraction = z.infer<typeof CandidateExtractionSchemaV1>;
export interface CandidateIngestionProvider { extract(markdown:string, sourceLabel:string): Promise<{data:CandidateExtraction; execution:{provider:string;model:string;promptVersion:string;schemaVersion:string;requestId?:string;latencyMs:number;status:'succeeded'|'simulated';error?:{code:string;message:string}}}> }

export const UploadBatchSchema = z.object({ positionId:z.string().uuid().optional(), files:z.array(z.instanceof(File)).min(1).max(20) });
export const SourceUrlSchema = z.object({ candidateId:z.string().uuid().optional(), provider:z.enum(['github','portfolio','linkedin']), url:z.string().url() });
