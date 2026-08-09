# AGENTS.md

## Project

Sorted is a multilingual AI operations copilot for small and medium businesses, created for the Sarvam Building Hours Hackathon. It turns customer conversations into clear actions and executable workflows.

The product has three views over the same underlying work:

- **Dashboard** — what needs the owner’s attention?
- **AI Inbox** — what is happening in customer conversations?
- **Workflows** — what will Sorted do, and what has it already done?

The `Workflow` is the central domain object connecting all three surfaces. Do not implement Dashboard, Inbox, and Workflows as disconnected features.

## Product principles

1. Design for nontechnical business owners, not automation engineers.
2. Prefer business-readable explanations over infrastructure terminology.
3. Keep a human approval step for sensitive outbound actions.
4. Treat multilingual voice and text as first-class inputs and outputs.
5. Show the system’s understanding, missing information, proposed action, and execution state.
6. Use one reusable workflow composer everywhere; screens provide context rather than implementing separate builders.
7. Keep analytics lightweight and action-oriented.

## Sarvam AI responsibilities

Sorted is designed around three Sarvam offerings:

- **Saaras Speech-to-Text** transcribes multilingual customer or owner voice input.
- **Sarvam-105B** detects intent, extracts facts, identifies missing information, drafts responses, and converts natural-language instructions into workflow definitions.
- **Bulbul** produces multilingual voice responses and voice previews.

Keep provider calls behind adapters. UI and domain code must not depend directly on Sarvam HTTP response shapes. Normalize provider results into Sorted domain types first.

Until real integrations are implemented, clearly label simulated output. Never imply a real model call, transcription, voice generation, or outbound message occurred when it did not.

Suggested boundaries:

```text
Customer channel / microphone
          ↓
Channel and media adapters
          ↓
Saaras transcription adapter
          ↓
Sorted conversation domain
          ↓
Sarvam-105B reasoning adapter
          ↓
Workflow engine + human approval
          ↓
Text channel adapter / Bulbul voice adapter
```

## Core domain

Build around these concepts:

- `Customer`
- `Conversation` and `Message`
- `Intent`, extracted facts, and missing facts
- `SuggestedAction`
- `Workflow`, `WorkflowNode`, and `WorkflowEdge`
- `WorkflowRun` and `WorkflowRunStep`
- `Approval`
- `Notification`
- `DashboardStats`

Workflow runs should be append-oriented and auditable. Preserve business-readable step descriptions alongside structured inputs, outputs, errors, duration, and provider metadata.

## Primary demo flows

Prioritize these end-to-end scenarios:

1. Open Rahul’s multilingual quote conversation, review Sorted’s interpretation, create the suggested missing-information workflow, and activate it.
2. Turn the Dashboard insight about repeatedly following up unanswered quotes into a workflow.
3. Manually execute the quote workflow, visualize node progress, pause for approval, approve the response, complete the run, and update Inbox and Dashboard state.

New features should strengthen one of these flows before adding breadth.

## Technical architecture

- Runtime and package manager: **Bun**
- Framework: **Next.js 16 App Router**
- UI: **React 19**, TypeScript, Tailwind CSS 4
- Validation: **Zod**
- Local database: **PGlite**
- Production database: **PostgreSQL**
- Schema documentation/client generation: **Prisma 6**
- Background work: PostgreSQL queue using `LISTEN/NOTIFY` and `SKIP LOCKED`

The architecture follows a Postgres-for-everything approach. Do not introduce Redis or another queue/database without a concrete requirement.

## Database rules

- Use `executeQuery()` from `src/lib/db.ts` for application queries.
- Use parameterized SQL with `$1`, `$2`, and so on.
- Do not use Prisma model methods such as `findMany()` or `create()` in application code.
- Keep SQL compatible with PGlite and PostgreSQL.
- Update both `prisma/schema.prisma` and `scripts/init-db.ts` when adding tables.
- Prisma describes/generates the schema; raw SQL is the application data-access interface.
- Never commit local database files. `.gitignore` must continue to cover PGlite, `*.db`, SQLite journals, WAL, and shared-memory files.

## Service and fixture boundaries

Do not hardcode expanding domain data directly inside page components. As the prototype grows, organize it under a Sorted feature boundary such as:

```text
src/
  app/
  components/
  features/sorted/
    schemas/
    services/
    fixtures/
    sarvam/
    workflows/
```

UI components should consume services/domain objects. Fixtures should satisfy the same contracts that production database and Sarvam adapters will later satisfy.

## Workflow execution rules

- Execution must be deterministic and resumable at approval steps.
- Persist run and step state before triggering side effects.
- Make outbound actions idempotent.
- Store provider request IDs and normalized error information, but never credentials.
- Technical logs may be available behind a secondary disclosure; default logs must remain business-readable.
- Register every background task in `src/workers/tasks/index.ts`.

## Security and privacy

- Never commit `.env` files, API keys, credentials, customer exports, audio recordings, or database files.
- Keep `.env.example` limited to placeholder values.
- Treat customer messages, transcripts, generated audio, phone numbers, and addresses as sensitive data.
- Avoid logging raw conversation content in production.
- Require explicit approval before sending customer-facing content unless a workflow is deliberately configured otherwise.

## Commands

Use Bun, never npm, yarn, or pnpm.

```bash
bun install
bun run db:generate
bun run db:init
bun run dev:next
bun run dev
bun run dev:worker
bun run lint
bun run build
```

The web app runs on `http://localhost:7070`.

## Development workflow

1. Read the relevant Next.js documentation in `node_modules/next/dist/docs/` before relying on remembered framework behavior.
2. Preserve Server Components by default; add `'use client'` only when interactivity requires it.
3. Define or update domain types before expanding UI state.
4. Keep real providers behind interfaces and maintain fixture implementations for the demo.
5. Validate user and provider input with Zod.
6. Run targeted checks while iterating, then `bun run build` before handoff.
7. Add Playwright coverage for the three primary demo flows when behavior changes.

## Current implementation status

The current application is a UI-first prototype. Dashboard, AI Inbox, Workflows, workflow composition, and simulated execution are present. Sarvam API calls, real customer channels, production workflow execution, authentication, and the final Sorted database schema are not yet implemented.

Preserve that distinction in code, documentation, demos, and user-facing copy.
