# AGENTS.md

## Project

Sorted is an evidence-first AI recruiting and screening workspace for Indian hiring teams, built for the Sarvam Building Hours Hackathon. It turns candidate sources into auditable evidence profiles, compares candidates against a human-approved position rubric, supports panel review, and moves shortlisted candidates through approved outreach to recruiter screening.

The initial product stops at the interview boundary:

```text
Create position
→ Import CVs and authorized candidate sources
→ Build evidence profiles
→ Match against an approved rubric
→ Panel reviews and shortlists
→ Send approved outreach
→ Collect replies and missing information
→ Move to recruiter screening
```

`plan.md` is the source of truth for product scope, invariants, vertical slices, acceptance criteria, and delivery progress. Implement it phase by phase. Keep its progress tracker current after each meaningful unit of work so another contributor can resume without reconstructing context.

## Product principles

1. Design for recruiters, hiring managers, technical reviewers, and organization administrators—not automation engineers.
2. A `Candidate` belongs to an organization independently of a position; an `Application` connects a candidate to a position.
3. Treat role fit and evidence confidence as separate values. Never present a universal candidate-quality score.
4. Preserve the source and extraction version behind every extracted or inferred claim.
5. Require human approval for rubrics, shortlist decisions, sensitive profile updates, and candidate-facing outreach.
6. AI recommendations support hiring decisions; they never become hiring decisions automatically and never auto-reject candidates.
7. Do not use protected or irrelevant personal attributes in matching.
8. Scope every server query and mutation to the resolved organization.
9. Keep multilingual voice and text first-class, accessible, opt-in capabilities.
10. Prefer business-readable states, explanations, gaps, and next actions over infrastructure terminology.

## Primary demo flow

Prioritize one coherent end-to-end path before adding breadth:

1. Create the Senior Backend Engineer position from a job description.
2. Review and approve a structured evaluation rubric.
3. Import synthetic CVs and build evidence-backed candidate profiles.
4. Match candidates against the approved rubric with separate role-fit and evidence-confidence values.
5. Complete panel review and record a human shortlist decision.
6. Draft, approve, and send a missing-information or shortlist-interest message.
7. Capture the candidate reply and move the candidate to recruiter screening through a human action.

New work should strengthen this flow or satisfy the current vertical slice in `plan.md` before expanding scope.

## Sarvam AI responsibilities

Use Sarvam offerings where they materially support the recruiting workflow:

- **Sarvam-105B** structures job descriptions, extracts candidate-profile facts and evidence, evaluates evidence against rubric criteria, and drafts candidate communication.
- **Saaras Speech-to-Text** transcribes multilingual recruiter, hiring-manager, reviewer, and opt-in candidate voice notes.
- **Bulbul** creates accessible multilingual audio previews from already approved candidate-facing text.

Keep all provider calls behind server-only adapters. UI, services, and domain code must not depend on Sarvam HTTP response shapes. Normalize and validate provider results into versioned Sorted domain schemas first.

Every provider integration must have a deterministic fixture/fake implementation. Until a real call succeeds, label output as simulated. Never imply a real extraction, transcription, evaluation, voice generation, email, or outbound action occurred when it did not.

Store model name, prompt/schema version, provider request ID, latency, and normalized errors where relevant. Never store credentials. Never expose `SARVAM_API_KEY` through a `NEXT_PUBLIC_` variable or client component.

## Core domain

Build around the domain model in `plan.md`, including:

- Organization and access: `User`, `Organization`, `OrganizationMember`, `Invitation`, and role permissions.
- Hiring: `Position`, `JobDescription`, `EvaluationRubric`, `RubricCriterion`, and `HiringPanelMember`.
- Candidate intelligence: `Candidate`, sources and documents, identities, employment, education, projects, skills, links, and evidence claims/sources.
- Evaluation: `Application`, candidate and criterion evaluations, panel reviews, shortlist decisions, and pipeline stages.
- Communication: outreach threads/messages/sequences, candidate responses, consent, and opt-outs.
- Operations: notifications, audit events, background jobs, and provider executions.

Historical rubrics, evidence, evaluations, reviews, decisions, outreach, and workflow/job runs must remain append-oriented and auditable.

## Product boundaries

The initial product does not include AI-led interviews, video interviews, coding assessments, interview scheduling, job-board publishing, offers, background verification, onboarding, autonomous rejection, unapproved autonomous outreach, a full ATS replacement, or LinkedIn scraping.

LinkedIn data may only come from recruiter/candidate-provided exports or an authorized integration. Use official provider APIs for permitted public data and retain source provenance.

## Technical architecture

- Runtime and package manager: **Bun** only
- Framework: **Next.js 16 App Router**
- UI: **React 19**, TypeScript, Tailwind CSS 4
- Validation: **Zod**
- Local database: **PGlite**
- Production database: **PostgreSQL**
- Schema documentation/client generation: **Prisma 6**
- Background work: PostgreSQL queue using `LISTEN/NOTIFY` and `SKIP LOCKED`

Follow a Postgres-for-everything architecture. Do not introduce Redis or another queue/database without a concrete requirement.

## Database rules

- Use `executeQuery()` from `src/lib/db.ts` for application queries.
- Use parameterized SQL with `$1`, `$2`, and so on.
- Do not use Prisma model methods such as `findMany()` or `create()` in application code.
- Keep SQL compatible with PGlite and PostgreSQL.
- Update both `prisma/schema.prisma` and `scripts/init-db.ts` when adding or changing tables.
- Prisma describes/generates the schema; raw SQL is the application data-access interface.
- Never commit local database files. Keep PGlite, `*.db`, journals, WAL, and shared-memory files ignored.

## Service, domain, and provider boundaries

Do not hardcode growing domain data in page components. Organize recruiting code under a feature boundary such as:

```text
src/features/sorted/
  schemas/
  services/
  fixtures/
  sarvam/
  candidates/
  positions/
  evaluations/
  outreach/
```

Define or update domain types and Zod schemas before expanding UI state. UI components consume services and normalized domain objects. Fixtures must satisfy the same contracts used by database-backed services and real provider adapters.

## Execution and background-work rules

- Persist state before triggering side effects.
- Make uploads, provider jobs, evaluation jobs, and outbound messages idempotent and resumable.
- Store provider request IDs and normalized errors, never credentials.
- Keep default logs business-readable; place technical details behind secondary disclosure.
- Register every background task in `src/workers/tasks/index.ts`.
- Ensure replies, bounces, opt-outs, pauses, and pipeline advancement stop scheduled outreach as defined in `plan.md`.

## Security, privacy, and fairness

- Never commit `.env` files, API keys, credentials, real CVs, customer/candidate exports, recordings, generated private media, or database files.
- Keep `.env.example` limited to placeholder values.
- Treat CVs, transcripts, generated audio, emails, phone numbers, addresses, compensation, and outreach content as sensitive.
- Avoid logging raw candidate documents and communication content in production.
- Require explicit approval before candidate-facing content is sent unless a deliberately configured safe policy permits otherwise.
- Store source files privately and authorize every document/media access.
- Do not extract or use age, gender, photograph, caste, religion, marital status, disability, or name-based demographic inference as matching inputs.
- Preserve human corrections without destroying original model extraction history.

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
2. Review `plan.md`, identify the first incomplete slice or explicitly selected phase, and record its starting state in the progress tracker.
3. Preserve Server Components by default; add `'use client'` only where interactivity requires it.
4. Define or update domain schemas before expanding UI state.
5. Keep real providers behind interfaces and retain deterministic fixtures for local demos and tests.
6. Validate user input, uploaded/provider data, and normalized model output with Zod.
7. Run targeted checks while iterating, then `bun run build` before handoff.
8. Use Playwright CLI for UI validation and add Playwright coverage when behavior changes.
9. Save intentional UI validation screenshots under `.images/` with descriptive phase-based names. Do not store sensitive data in captures.
10. Update `plan.md` with completed work, verification evidence, open risks, and the precise next pick-up point.

## Shared definition of done

Each vertical slice must meet the shared definition of done in `plan.md`: a real UI outcome, typed contracts and Zod validation, organization-scoped parameterized SQL, complete states, audit events, accessibility and responsive behavior, appropriate tests, updated fixtures/docs/environment examples, no committed secrets or sensitive data, and a successful production build.

## Current implementation status

The repository is a UI-first recruiting prototype with Dashboard, Positions, Candidates, Outreach, and synthetic fixtures. Some delivery foundations such as environment validation and health/readiness routes exist. Authentication, the final organization-scoped recruiting schema, real Sarvam calls, document ingestion, production evaluation/execution, real email/customer channels, and complete audit/privacy controls are not yet implemented.

Preserve the distinction between fixture/simulated behavior and real provider or production behavior in code, documentation, tests, demos, and user-facing copy.

<!-- rtk-instructions v2 -->
# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule

**Always prefix commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged. This means RTK is always safe to use.

**Important**: Even in command chains with `&&`, use `rtk`:
```bash
# ❌ Wrong
git add . && git commit -m "msg" && git push

# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## RTK Commands by Workflow

### Build & Compile (80-90% savings)
```bash
rtk cargo build         # Cargo build output
rtk cargo check         # Cargo check output
rtk cargo clippy        # Clippy warnings grouped by file (80%)
rtk tsc                 # TypeScript errors grouped by file/code (83%)
rtk lint                # ESLint/Biome violations grouped (84%)
rtk prettier --check    # Files needing format only (70%)
rtk next build          # Next.js build with route metrics (87%)
```

### Test (60-99% savings)
```bash
rtk cargo test          # Cargo test failures only (90%)
rtk go test             # Go test failures only (90%)
rtk jest                # Jest failures only (99.5%)
rtk vitest              # Vitest failures only (99.5%)
rtk playwright test     # Playwright failures only (94%)
rtk pytest              # Python test failures only (90%)
rtk rake test           # Ruby test failures only (90%)
rtk rspec               # RSpec test failures only (60%)
rtk test <cmd>          # Generic test wrapper - failures only
```

### Git (59-80% savings)
```bash
rtk git status          # Compact status
rtk git log             # Compact log (works with all git flags)
rtk git diff            # Compact diff (80%)
rtk git show            # Compact show (80%)
rtk git add             # Ultra-compact confirmations (59%)
rtk git commit          # Ultra-compact confirmations (59%)
rtk git push            # Ultra-compact confirmations
rtk git pull            # Ultra-compact confirmations
rtk git branch          # Compact branch list
rtk git fetch           # Compact fetch
rtk git stash           # Compact stash
rtk git worktree        # Compact worktree
```

Note: Git passthrough works for ALL subcommands, even those not explicitly listed.

### GitHub (26-87% savings)
```bash
rtk gh pr view <num>    # Compact PR view (87%)
rtk gh pr checks        # Compact PR checks (79%)
rtk gh run list         # Compact workflow runs (82%)
rtk gh issue list       # Compact issue list (80%)
rtk gh api              # Compact API responses (26%)
```

### JavaScript/TypeScript Tooling (70-90% savings)
```bash
rtk pnpm list           # Compact dependency tree (70%)
rtk pnpm outdated       # Compact outdated packages (80%)
rtk pnpm install        # Compact install output (90%)
rtk npm run <script>    # Compact npm script output
rtk npx <cmd>           # Compact npx command output
rtk prisma              # Prisma without ASCII art (88%)
```

### Files & Search (60-75% savings)
```bash
rtk ls <path>           # Tree format, compact (65%)
rtk read <file>         # Code reading with filtering (60%)
rtk grep <pattern>      # Search grouped by file (75%)
rtk find <pattern>      # Find grouped by directory (70%)
```

### Analysis & Debug (70-90% savings)
```bash
rtk err <cmd>           # Filter errors only from any command
rtk log <file>          # Deduplicated logs with counts
rtk json <file>         # JSON structure without values
rtk deps                # Dependency overview
rtk env                 # Environment variables compact
rtk summary <cmd>       # Smart summary of command output
rtk diff                # Ultra-compact diffs
```

### Infrastructure (85% savings)
```bash
rtk docker ps           # Compact container list
rtk docker images       # Compact image list
rtk docker logs <c>     # Deduplicated logs
rtk kubectl get         # Compact resource list
rtk kubectl logs        # Deduplicated pod logs
```

### Network (65-70% savings)
```bash
rtk curl <url>          # Compact HTTP responses (70%)
rtk wget <url>          # Compact download output (65%)
```

### Meta Commands
```bash
rtk gain                # View token savings statistics
rtk gain --history      # View command history with savings
rtk discover            # Analyze Claude Code sessions for missed RTK usage
rtk proxy <cmd>         # Run command without filtering (for debugging)
rtk init                # Add RTK instructions to CLAUDE.md
rtk init --global       # Add RTK to ~/.claude/CLAUDE.md
```

## Token Savings Overview

| Category | Commands | Typical Savings |
|----------|----------|-----------------|
| Tests | vitest, playwright, cargo test | 90-99% |
| Build | next, tsc, lint, prettier | 70-87% |
| Git | status, log, diff, add, commit | 59-80% |
| GitHub | gh pr, gh run, gh issue | 26-87% |
| Package Managers | pnpm, npm, npx | 70-90% |
| Files | ls, read, grep, find | 60-75% |
| Infrastructure | docker, kubectl | 85% |
| Network | curl, wget | 65-70% |

Overall average: **60-90% token reduction** on common development operations.
<!-- /rtk-instructions -->
