import 'server-only';
import { processPdf } from '@firecrawl/pdf-inspector';
import { toMarkdownBytes } from '@firecrawl/anydoc';
import {
  PdfExtractionResultSchema,
  type DocumentTextExtractionProvider,
} from '../schemas/ingestion';

export const documentTextExtractionProvider: DocumentTextExtractionProvider = {
  async extractPdf(buffer) {
    const result = processPdf(Buffer.from(buffer));
    return PdfExtractionResultSchema.parse({
      ...result,
      markdown: result.markdown ?? null,
      title: result.title ?? null,
      extractor: 'firecrawl-pdf-inspector',
      extractorVersion: '1.12.0',
    });
  },
  async extractDocx(buffer) {
    return {
      markdown: await toMarkdownBytes(buffer),
      extractor: 'firecrawl-anydoc',
      extractorVersion: '0.1.7',
    };
  },
};

export const fakeDocumentTextExtractionProvider: DocumentTextExtractionProvider = {
  async extractPdf() {
    return PdfExtractionResultSchema.parse({
      pdfType: 'TextBased',
      markdown: '# Synthetic Candidate\nBackend engineer',
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
  },
  async extractDocx() {
    return {
      markdown: '# Synthetic Candidate\nBackend engineer',
      extractor: 'firecrawl-anydoc',
      extractorVersion: 'fake-1',
    };
  },
};
