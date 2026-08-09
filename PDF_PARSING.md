# PDF Parsing with Firecrawl pdf-inspector

Integration guide for adding local, server-side PDF extraction to Sorted's candidate CV ingestion pipeline.

**Status:** researched and verified (2026-08-09) — not yet integrated. Targets **Slice 3 — Upload CVs and build persistent candidate records** (`plan.md`).

---

## 1. What it is

[Firecrawl pdf-inspector](https://github.com/firecrawl/pdf-inspector) is an open-source (MIT) Rust library that classifies PDFs and extracts text with position awareness, converting to clean Markdown — all **without OCR, ML models, API keys, or system dependencies**.

- **Classification:** `TextBased` / `Scanned` / `ImageBased` / `Mixed` in ~10–50ms, with a confidence score (0.0–1.0) and per-page `pagesNeedingOcr` routing.
- **Extraction:** position-aware text items (`x`, `y`, `fontSize`, `isBold`, `isItalic`, `page`, `linkUrl`) and Markdown with headings, lists, code blocks, tables, multi-column reading order, CID/Type0 font decoding (ToUnicode CMaps), and broken-encoding detection.
- **Benchmark** (opendataloader-bench, 200 PDFs, local engines, OCR disabled): overall **0.875** (best), reading order 0.915, tables 0.814, **0.470s for the whole corpus** — ~36x faster than pymupdf4llm. Full table: [repo README](https://github.com/firecrawl/pdf-inspector#benchmark).

The npm binding `@firecrawl/pdf-inspector` ships native Rust via napi-rs, with platform binaries installed automatically through `optionalDependencies`:

| Platform | Arch | Package |
|---|---|---|
| Linux | x64 / arm64 (glibc, musl) | `@firecrawl/pdf-inspector-linux-{x64,arm64}-{gnu,musl}` |
| macOS | arm64 | `@firecrawl/pdf-inspector-darwin-arm64` |
| Windows | x64 | `@firecrawl/pdf-inspector-win32-x64-msvc` |

macOS arm64 covers local dev (M-series); linux-x64-gnu covers the Render deploy. No Rust toolchain needed.

**Why local extraction fits Sorted:** candidate CVs are sensitive PII. Processing them on the org's own server keeps the data in-house and costs nothing per page — versus uploading every CV to a third-party parsing API.

---

## 2. Verified: works under Bun

Smoke-tested `@firecrawl/pdf-inspector@1.12.0` in a scratch project with `bun run` on a text-based PDF:

```text
classifyPdf → { pdfType: "TextBased", pageCount: 1, pagesNeedingOcr: [], confidence: 0.5 }
processPdf  → markdown: "Hello Sorted-Senior Backend Engineer Five years Go, PostgreSQL, Kafka"
extractTextWithPositions → [{ text, x: 72, y: 720, fontSize: 24, isBold: false, ... }, ...]
```

Install succeeded with the darwin-arm64 binary; `processPdf` completed sub-millisecond for one page. The napi README explicitly targets "Node.js/Bun".

---

## 3. Install

```bash
bun add @firecrawl/pdf-inspector
# DOCX and the other 14 non-PDF formats (Slice 3 needs PDF + DOCX initially):
bun add @firecrawl/anydoc
```

No environment variables required — no API key, no config.

---

## 4. API surface (v1.12.0, verified from published `index.d.ts`)

```ts
// Classify only — lightweight, ~10-50ms. pagesNeedingOcr is 0-INDEXED here.
classifyPdf(buffer: Buffer): PdfClassification
// { pdfType, pageCount, pagesNeedingOcr: number[], confidence }

// Full process: classify + extract text + convert to Markdown.
processPdf(buffer: Buffer, pages?: number[] | null): PdfResult
// {
//   pdfType, markdown?: string, pageCount, processingTimeMs,
//   pagesNeedingOcr: number[],          // 1-INDEXED (see Gotchas)
//   ocrReasonsByPage: PageOcrReasons[], // page 1-INDEXED
//   title?: string, confidence, isComplexLayout,
//   pagesWithTables: number[],          // 1-indexed
//   pagesWithColumns: number[],         // 1-indexed
//   hasEncodingIssues: boolean,
// }

// Per-page markdown + layout metadata (useful for page-level evidence citations).
extractPagesMarkdown(buffer: Buffer, pages?: number[] | null): PagesExtractionResult
// { pages: [{ page, markdown, needsOcr, ocrReason? }], pagesWithTables,
//   pagesWithColumns, pagesNeedingOcr, ocrReasonsByPage, isComplex }

// Plain text, no markdown.
extractText(buffer: Buffer): string

// Positioned items — the evidence-provenance API (Slice 4).
extractTextWithPositions(buffer: Buffer, pages?: number[] | null): TextItem[]
// { text, x, y, width, height, font, fontSize, page, isBold, isItalic,
//   isUnderline, isStrikeout, itemType, linkUrl? }

// Hybrid-OCR helpers (only if we later add a layout-model/OCR stage):
// extractTextInRegions, extractTablesInRegions, detectVectorGridInRegion, ...

enum PdfType { TextBased = 'TextBased', Scanned = 'Scanned',
               ImageBased = 'ImageBased', Mixed = 'Mixed' }
```

---

## 5. Integration plan for Sorted

### 5.1 Dependencies and Next.js config

Add both packages to `serverExternalPackages` in `next.config.ts` (same pattern as the existing pglite entry — native modules must not be bundled by the server compiler):

```ts
// next.config.ts
const nextConfig: NextConfig = {
  serverExternalPackages: ['@electric-sql/pglite', '@firecrawl/pdf-inspector', '@firecrawl/anydoc'],
};
```

Server runtime only — the package is a native binary and must never be imported from client components (`import 'server-only'` at the top of the adapter module, matching `src/lib/env.ts`).

### 5.2 Domain contract (provider boundary)

Per `AGENTS.md` (server-only adapters, normalized + Zod-validated into versioned domain schemas, deterministic fake, provider output labeled when simulated):

```ts
// src/features/sorted/ingestion/schemas/pdf-extraction.ts
import { z } from 'zod';

export const PdfTypeSchema = z.enum(['TextBased', 'Scanned', 'ImageBased', 'Mixed']);

export const PdfExtractionResultSchema = z.object({
  pdfType: PdfTypeSchema,
  markdown: z.string().nullable(),
  pageCount: z.number().int().nonnegative(),
  processingTimeMs: z.number().nonnegative(),
  pagesNeedingOcr: z.array(z.number().int().positive()),   // 1-indexed per PdfResult
  confidence: z.number().min(0).max(1),
  isComplexLayout: z.boolean(),
  pagesWithTables: z.array(z.number().int().positive()),
  pagesWithColumns: z.array(z.number().int().positive()),
  hasEncodingIssues: z.boolean(),
  title: z.string().nullable(),
  extractor: z.literal('firecrawl-pdf-inspector'),
  extractorVersion: z.string(),
});
export type PdfExtractionResult = z.infer<typeof PdfExtractionResultSchema>;

export interface DocumentTextExtractionProvider {
  extractPdf(buffer: Uint8Array): Promise<PdfExtractionResult>;
}
```

```ts
// src/features/sorted/ingestion/services/pdf-inspector-provider.ts
import 'server-only';
import { processPdf } from '@firecrawl/pdf-inspector';
import { PdfExtractionResultSchema, type DocumentTextExtractionProvider } from '../schemas/pdf-extraction';

const EXTRACTOR_VERSION = '1.12.0';

export const pdfInspectorProvider: DocumentTextExtractionProvider = {
  async extractPdf(buffer) {
    const result = processPdf(Buffer.from(buffer));
    return PdfExtractionResultSchema.parse({
      ...result,
      markdown: result.markdown ?? null,
      title: result.title ?? null,
      extractor: 'firecrawl-pdf-inspector',
      extractorVersion: EXTRACTOR_VERSION,
    });
  },
};
```

Tests get a deterministic fake satisfying the same contract (e.g. canned markdown + classification for a fixture CV). DOCX goes through a sibling `anydocProvider` implementing the same interface so the pipeline stays format-agnostic.

### 5.3 Worker task (async pipeline)

Slice 3's states are `uploaded → scanning → extracting → parsed → needs_review → failed`. The queue substrate already exists (`src/lib/queue/`, `src/lib/worker.ts`); extraction is one more registered task:

```ts
// src/workers/tasks/extract-cv-document.ts
import type { Job, JobPayload } from '@/lib/queue/types';
import { pdfInspectorProvider } from '@/features/sorted/ingestion/services/pdf-inspector-provider';

export interface ExtractCvDocumentPayload extends JobPayload {
  organizationId: string;
  documentId: string;
  storageKey: string; // private object-store key; never a public URL
}

export default async function extractCvDocumentTask(
  payload: ExtractCvDocumentPayload,
  _job: Job,
): Promise<void> {
  // 1. load bytes from private storage (signed URL / local store)
  // 2. result = await pdfInspectorProvider.extractPdf(bytes)
  // 3. persist markdown + classification into candidate_documents
  //    (row: parsed_text_markdown, pdf_type, confidence, pages_needing_ocr,
  //     extractor, extractor_version, processing_time_ms)
  // 4. transition document state extracting -> parsed
  // 5. audit event + enqueue next stage (Sarvam structured extraction)
}
```

Register in `src/workers/tasks/index.ts`:

```ts
import extractCvDocumentTask from './extract-cv-document';
// inside registerAllTasks:
worker.registerTask('extract-cv-document', extractCvDocumentTask);
```

Enqueue from the upload route via `enqueueJob('extract-cv-document', payload)` (`src/lib/worker.ts`). The queue's `jobKey` gives idempotency for re-uploads (Slice 3 acceptance: "The same CV cannot silently create repeated candidates").

### 5.4 Scanned-PDF routing (the product win)

This is what pdf-inspector was built for — classify first, spend OCR only where needed:

- `pdfType === 'TextBased'` and `pagesNeedingOcr.length === 0` → native extraction, `parsed` immediately.
- `pagesNeedingOcr.length > 0` or `hasEncodingIssues` → keep the extracted markdown but move the document to **`needs_review`** and record `ocrReasonsByPage`; a future OCR/vision fallback (Sarvam or a cloud OCR adapter) plugs into the same interface.
- `pdfType === 'Scanned' | 'ImageBased'` → `needs_review`; store only classification metadata, no fabricated markdown.

Never present extracted text as verified just because it parsed — consistent with the product invariant "Never treat imported claims as verified merely because they came from a public profile" (apply the same rule to CV text).

### 5.5 Evidence provenance (Slice 4 payoff)

Slice 4 requires "source document, page/section, excerpt coordinates where possible, extractor version, and confidence." pdf-inspector supplies all of it:

- `extractPagesMarkdown` → page-level markdown slices for page-cited excerpts (`page: N`).
- `extractTextWithPositions` → `x`, `y`, `fontSize`, `isBold`, `page` per item for coordinate-anchored evidence references and section detection (e.g. heading font-size ratios).
- `extractor` + `extractorVersion` + `processingTimeMs` recorded on the extraction row → versioned, auditable extraction history; re-extracting after an upgrade creates a new version rather than silently overwriting (matches Slice 2/5 versioning principles).

### 5.6 DOCX (and 14 other formats) via AnyDoc

`@firecrawl/anydoc@0.1.7` (verified on npm): `toMarkdown(file)` → GitHub-Flavored Markdown; embeds pdf-inspector for text-based PDFs. Same provider interface, same worker task, covers `docx` (required by Slice 3) plus `doc, docm, xlsx, xls, xlsm, pptx, ppt, rtf, odt, ods, odp, epub, csv`.

---

## 6. Alternatives considered

| Option | For | Against | Verdict |
|---|---|---|---|
| **Local npm `@firecrawl/pdf-inspector`** | Free, no key, CVs never leave the server, ~2.4ms/doc, positioned evidence, per-page OCR routing | Scanned CVs need an OCR fallback; Node server runtime only (no Edge) | **Recommended** |
| Firecrawl cloud `/parse` | Scanned handled via `ocr` mode, 50 MB files, `redactPII`, structured JSON | API key + per-page credits; candidate PII uploaded to Firecrawl — conflicts with privacy posture | Future OCR fallback behind the same interface |
| WASM build `@firecrawl/pdf-inspector-wasm` | Runs in-browser, instant pre-upload classification | Client-side extraction of the authoritative file is a trust problem; extra bundle complexity | Not recommended |

---

## 7. Gotchas

- **Indexing mismatch:** `PdfClassification.pagesNeedingOcr` is **0-indexed**; `PdfResult.pagesNeedingOcr`, `pagesWithTables`, `pagesWithColumns`, and `ocrReasonsByPage.page` are **1-indexed**. Normalize once in the provider (the Zod schema above pins 1-indexed for storage).
- **`markdown` and `title` are optional** on `PdfResult` — normalize to `null`, don't assume presence.
- **Native binary:** must stay in `serverExternalPackages` and server-only imports; never import from a client component; no Edge runtime.
- **No OCR included** — a scanned CV yields no text. Route to `needs_review` honestly instead of returning empty markdown as success.
- **`PdfType` is a `const enum`** in the published types — use the string literals (`'TextBased'`, …) in persisted data, not the enum name.
- Keep extraction rows append-oriented: store extractor version per row; upgrading the package should produce new rows, not mutate old ones.

---

## 8. References

- Repo: <https://github.com/firecrawl/pdf-inspector> (MIT)
- Node/Bun binding docs: <https://github.com/firecrawl/pdf-inspector/blob/main/napi/README.md>
- AnyDoc (14 non-PDF formats): <https://github.com/firecrawl/anydoc>
- Launch post (pdf-inspector + AnyDoc): <https://www.firecrawl.dev/blog/anydoc-and-pdf-inspector>
- Firecrawl cloud `/parse` (alternative, OCR modes): <https://docs.firecrawl.dev/features/parse>
- npm: <https://www.npmjs.com/package/@firecrawl/pdf-inspector>

## 9. Next action

When Slice 3 starts: `bun add @firecrawl/pdf-inspector @firecrawl/anydoc`, update `next.config.ts` `serverExternalPackages`, create the schema/provider files above, register `extract-cv-document` in `src/workers/tasks/index.ts`, and keep the deterministic fake provider for tests (AGENTS.md requirement).
