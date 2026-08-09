# Sorted Recruiting — Vertical-Slice Delivery Plan

## 1. Product definition

Sorted is an **evidence-first AI screening workspace for Indian hiring teams**. It helps recruiters, hiring managers, and technical reviewers turn inbound CVs into structured candidate profiles, compare candidates against an approved job rubric, collaborate on shortlisting, and move qualified candidates into recruiter screening through approved outreach and follow-ups.

The initial product stops at the interview boundary.

```text
Create position
→ Import CVs
→ Build evidence profiles
→ Match against an approved rubric
→ Panel reviews and shortlists
→ Send approved outreach
→ Collect response and missing information
→ Move to recruiter screening
```

### Initial target customer

- Indian technology companies with approximately 50–500 employees
- Startups without a dedicated talent-intelligence function
- Recruitment agencies screening technical candidates
- Teams processing tens or hundreds of CVs for a position

### Primary users

- **Recruiter/HR:** imports candidates, corrects profiles, manages applications and outreach.
- **Hiring manager:** creates positions, approves evaluation rubrics, and owns shortlist decisions.
- **Technical reviewer:** validates technical evidence and provides structured feedback.
- **Organization administrator:** manages members, access, retention, integrations, and policy.

### Product promise

> Drop in CVs, understand the evidence behind every candidate, compare them fairly against an approved hiring rubric, and keep shortlisted talent moving.

## 2. Product boundaries

### Included in the initial product

- Organization workspaces and hiring-panel roles
- Position and job-description management
- Single and bulk CV upload
- Candidate ingestion from CVs, authorized LinkedIn data, GitHub, portfolio URLs, CSV, email, and future provider adapters
- Candidate Evidence Profiles
- Candidate talent pool independent of positions
- Duplicate candidate detection and profile merging
- Cross-source identity resolution with human-reviewed merge and split controls
- Position-specific, explainable scorecards
- Panel review and shortlist decisions
- Email outreach and follow-up sequences
- Candidate reply and missing-information tracking
- Auditability, privacy controls, export, and deletion

### Explicitly excluded initially

- AI-led interviews
- Video interviews and interview recording
- Coding assessments
- Interview scheduling
- Job-board publishing
- Offer and compensation approval workflows
- Background verification
- Employee onboarding and HRMS features
- Autonomous rejection
- Unapproved autonomous outreach
- Full ATS replacement
- LinkedIn scraping

These exclusions protect the core outcome: producing a trustworthy shortlist and moving it to recruiter screening.

## 3. Core domain model

### Organization and access

- `User`
- `Organization`
- `OrganizationMember`
- `Role`: `admin`, `recruiter`, `hiring_manager`, `technical_reviewer`

### Hiring

- `Position`
- `JobDescription`
- `EvaluationRubric`
- `RubricCriterion`
- `HiringPanelMember`

### Candidate intelligence

- `Candidate`
- `CandidateDocument`
- `CandidateIdentity`
- `Employment`
- `Education`
- `Project`
- `Skill`
- `Certification`
- `ExternalProfileLink`
- `EvidenceClaim`
- `EvidenceSource`

### Application and evaluation

- `Application`
- `CandidateEvaluation`
- `CriterionEvaluation`
- `PanelReview`
- `ShortlistDecision`
- `PipelineStage`

### Communication

- `OutreachThread`
- `OutreachMessage`
- `OutreachSequence`
- `OutreachStep`
- `CandidateResponse`
- `ConsentRecord`
- `OptOut`

### Operations

- `Notification`
- `AuditEvent`
- `BackgroundJob`
- `ProviderExecution`

## 4. Product invariants

1. A `Candidate` exists independently of a position; an `Application` connects the candidate to a position.
2. A candidate has one organization-scoped evidence profile that can support several applications.
3. Every extracted or inferred claim retains its source and extraction version.
4. Role fit and evidence confidence are separate values.
5. AI recommendations never become hiring decisions automatically.
6. Rubrics are approved by a human before candidate ranking begins.
7. Published rubric versions and completed evaluations remain auditable.
8. Protected or irrelevant personal attributes do not influence matching.
9. Candidate-facing messages require approval until an organization explicitly configures a safe automation policy.
10. Every query and mutation is organization-scoped at the server boundary.

## Candidate list and JD-matching modes

Sorted supports both an organization-wide talent pool and position-specific matching. The candidate profile is global within the organization; scores are always contextual to a particular approved JD/rubric.

| View | Candidates shown | Score behavior |
|---|---|---|
| All Candidates | Every candidate in the organization’s talent pool | No universal score; show profile completeness and evidence confidence only |
| Position Candidates | Candidates already assigned/applied to a selected position | Show the latest score for that position’s approved JD/rubric |
| Talent Pool Match | Talent-pool candidates not yet assigned to the selected position | Allow matching on demand or in bulk, then show position-specific scores |
| Candidate Applications | One candidate across all positions | Show a different score and status for each position/JD |

The same candidate may score `86` for Senior Backend Engineer and `62` for Engineering Manager because the requirements differ. Sorted must never store or display a single context-free “candidate quality” score.

### Required candidate-list controls

- Filter by one or more positions/JDs.
- Filter by `unassigned`, `applied`, `matched`, `shortlisted`, or another pipeline stage.
- Filter by match-score range and evidence-confidence range for a selected position.
- Filter by evaluation state: `not_matched`, `queued`, `evaluated`, `stale`, or `failed`.
- Filter by must-have criterion outcome, location, experience, notice period, skills, source, reviewer, and outreach status.
- Sort by position-specific role fit, evidence confidence, last activity, import date, or profile completeness.
- Save named views such as “Backend candidates above 75 with notice period under 60 days.”
- Bulk-select talent-pool candidates and run “Match against JD.”
- Add an evaluated candidate to the position only after an explicit recruiter action; evaluation alone does not create an application unless configured and confirmed.

### JD availability rules

- With no JD or approved manual rubric, candidates remain searchable in the talent pool but have no role-fit score.
- A pasted or uploaded JD must be converted into a structured rubric and approved before official scoring.
- A position may use a manually authored rubric when no formal JD exists.
- Updating a JD/rubric marks prior evaluations as `stale`; it does not silently overwrite them.
- Matching can be triggered from the position, the candidate list, or a candidate profile, but all entry points call the same evaluation service.

## 5. Shared definition of done

Every vertical slice must include:

- A demonstrable user outcome through the real UI
- Typed domain contracts and Zod validation
- PGlite/PostgreSQL-compatible, parameterized SQL through `executeQuery()`
- Organization authorization at server boundaries
- Loading, empty, success, validation, and failure states
- Audit events for material hiring actions
- Accessibility and responsive behavior
- Unit or integration coverage for domain rules
- Playwright coverage for the primary happy path
- Updated fixtures, documentation, and `.env.example` where relevant
- No credentials, CVs, candidate data, generated media, or local database files committed to Git
- Successful `bun run build`

---

# Vertical slices

## Delivery progress tracker

Last updated: 2026-08-10 (operational controls, rate limits, kill switches, and scanner adapter complete; launch readiness remains in progress)

| Slice | Status | Evidence and remaining work |
|---|---|---|
| 0 — Reframe and foundations | Deployed to Render and verified end-to-end | Recruiting shell, synthetic fixtures, environment validation, health/readiness routes, redacted structured logging, and CI are implemented; `bun run lint` (0 errors, 6 pre-existing warnings) and `bun run build` pass. Live on Render: web `https://sorted-web.onrender.com` (`GET /api/health` and `GET /api/ready` return ok/200, ready checks DB connectivity) and worker service, both wired to managed Postgres `sorted-db` (Singapore, basic_256mb). All 7 Prisma migrations (init through slice-6 panel reviews) are applied and recorded in `_prisma_migrations`. Queue E2E verified on the live URL: `POST /api/items` creates the item and enqueues `process-item`; the worker claims it, logs `Processing item … deploy-e2e` / `Job completed`, and `GET /api/jobs` shows `completed`. Production-only fixes discovered while deploying: `items.updated_at` needs a DB default (Prisma `@updatedAt` does not add one; migration `20260809010000_items_updated_at_default`), and Prisma `$queryRawUnsafe` param casts (`$3::jsonb`, `$5::timestamp`) plus a `pg_notify` void-return wrapper in `src/lib/queue/postgres-queue.ts` are required because the extended protocol does not do implicit casts (PGlite does). Free-tier web services skip the predeploy command, so `prisma migrate deploy` runs inside the build command; upgrading the web service to a paid instance enables the predeploy hook. IP allow list on `sorted-db` is limited to the admin machine; Render-internal connections do not need it. Remaining: rotate the Postgres password after the demo (it was shared during CLI wiring), and confirm backup behavior. |
| 1 — Organization and access | Complete for hackathon scope | Added Zod access contracts, explicit role permissions, organization-scoped access resolution, password-protected workspace sign-up and sign-in, sign-out with database session revocation, invitation-based panel-member sign-up, and the responsive Hiring Panel access screen. Passwords use salted scrypt hashes; opaque session and invitation tokens are stored only as hashes. An opt-in `LOCAL_AUTH_BYPASS=true` path now provisions a stable synthetic local administrator through the same validated organization-access contract; environment validation rejects the flag outside `APP_ENV=development`. PGlite integration coverage proves repeat provisioning is idempotent, and Playwright CLI Chrome verified `/sign-in` redirects to the authenticated workspace without cookies, exposes the local admin identity, and emits no console errors. Invitation acceptance, membership/role mutations, and organization creation remain append-audited and organization-scoped. Technical reviewers do not see panel-management, export, or candidate-import actions. `/setup` collision UX is implemented (preflight checks, unique-violation field errors, atomic create CTE, non-colliding placeholders); case-insensitive `LOWER(email)` uniqueness is enforced at the DB boundary. Pending: redeploy the latest hardening branch and re-validate the live form. Account recovery and persistent browser test files were explicitly deferred to prioritize the hackathon demo flow. |
| 2 — Position and rubric | Complete for hackathon scope | Added versioned, organization-scoped position/JD/rubric/criterion/panel/provider-execution data; strict Zod contracts; Sarvam-105B JSON-schema adapter; deterministic simulated fallback; provider metadata/error recording; position creation and structured rubric review; balanced-weight enforcement; human-only approval; append audit events; and approved screening state. 17 tests pass, lint has 0 errors (6 pre-existing warnings), PGlite schema initialization and production build pass. Playwright CLI verified setup → pasted backend JD → simulated structured rubric → explicit administrator approval in Chrome with 0 console errors; capture: `.images/slice-2-position-rubric-approved-2026-08-09.png`. Live Sarvam execution requires `SARVAM_API_KEY` in the server environment and was not used for the saved browser capture. Deferred within the slice: JD file upload and a rich criterion editor; pasted JD and manual-draft paths cover the hackathon flow. |
| 3 — Candidate ingestion | Complete for hackathon scope | Added organization-scoped candidate, immutable source, private document, identity, external-link, ingestion-run, application, and duplicate-review data; PDF/DOCX signature and size validation; private local storage with five-minute authorized links; SHA-256 idempotency; Firecrawl pdf-inspector/AnyDoc local extraction; scanned/OCR review routing; versioned Sarvam-105B candidate extraction with deterministic simulated fallback; PostgreSQL background task plus reliable PGlite-local processing; global/position-scoped batch import; persistent progress; talent-pool candidates; reference-only GitHub/portfolio/authorized LinkedIn sources; reversible audited merge primitives; and source provenance UI. 25 tests pass, lint has 0 errors (6 warnings), PGlite initialization, native parsing against `data/`, Prisma generation, and the production build pass. Playwright CLI Chrome verified private upload → parsed candidate → second source → exact re-upload rejection with 0 current console errors; capture: `.images/slice-3-candidate-ingestion-verified-2026-08-09.png`. Live Sarvam was not used for the saved capture because the key was not placed in the process environment; the UI correctly represented fallback output as simulated/unreviewed. Deferred beyond the hackathon-critical CV path: CSV/manual creation UI, official GitHub API enrichment, production object-storage adapter, and OCR fallback; their replaceable source/storage interfaces and honest `needs_review` routing are in place. |
| 4 — Candidate Evidence Profile | Complete for hackathon scope | Added strict Zod contracts for typed claims and review actions; organization-scoped append-oriented evidence claims and separate human correction records; source, section/page, excerpt, extractor-version, and confidence provenance; deterministic CV-to-evidence projection for employment, education, projects, and skills; protected-attribute exclusion; profile overview and needs-verification states; evidence disclosure; and confirm, correct, reject, and recruiter-added claim workflows with audit events. Existing external profile references remain independently sourced and never scraped. 15 candidate-focused tests and all 32 repository tests pass, Prisma generation succeeds, lint has 0 errors (6 pre-existing warnings), temporary PGlite initialization succeeds, and the production build passes. Playwright CLI Chrome verified source disclosure → human confirmation → preserved original history plus the responsive mobile layout with 0 console errors; capture: `.images/slice-4-evidence-profile-verified-2026-08-09.png`. Live Sarvam remains wired through the server-only Slice 3 adapter; saved evidence validation used deterministic synthetic data so no private CV content or credentials entered screenshots/logs. Deferred beyond the hackathon-critical profile path: authorized LinkedIn/GitHub enrichment payload ingestion, richer excerpt coordinates, and dedicated editors for every India-specific logistics subfield; these remain unknown or can be added as explicit source-backed logistics claims. |
| 5 — Evidence-backed position matching | Complete for hackathon scope | Added versioned candidate and criterion evaluation data, immutable rubric/evidence snapshots, strict Zod provider contracts, exact criterion-coverage validation, deterministic weighted scoring, separate role-fit and evidence-confidence values, recommendation states without auto-reject, a server-only Sarvam-105B criterion adapter with honest deterministic fallback, organization-scoped parameterized SQL, append audit events, stale prior runs on re-evaluation, talent-pool/position context switching, explicit match action, ranked position results, and explainable criterion scorecards with evidence gaps. Matching does not create an application or change pipeline state. All 35 tests pass; TypeScript passes; lint has 0 errors (6 pre-existing warnings); Prisma generation, clean temporary PGlite initialization, and production build pass. Playwright CLI Chrome verified approved rubric → talent-pool candidate → explicit match → scorecard → responsive mobile view → controlled re-run with 0 console errors; capture: `.images/slice-5-evidence-matching-verified-2026-08-09.png`. Database verification found one current plus one stale immutable run, two matching audit events, and zero automatically created applications. Live Sarvam was not used for the saved synthetic capture because no credential was persisted into the validation process; configured deployments use the server-only adapter. Deferred beyond the primary hackathon flow: named/saved compound views, bulk matching controls, side-by-side comparison, and reasoned manual scoring overrides. |
| 6 — Panel review and shortlist consensus | Complete for hackathon scope | Added organization-scoped review assignments, independent append-only panel submissions, evidence/criterion-linked comments, explicit disagreement detection and visible unaveraged recommendations, a reviewer queue, role-scoped actions, required-review gating, and an append-only human shortlist decision with rationale, evaluation version, decision event, audit event, and application-stage transition. AI recommendations remain separate and never change pipeline state. Technical reviewers can review technical evidence but candidate compensation claims and editing controls are suppressed. Notifications persist assignments, comments, decision-required prompts, and shortlist outcomes. All 39 tests pass; TypeScript and Prisma generation pass; lint has 0 errors (6 pre-existing warnings); clean PGlite initialization and the production build pass. Playwright CLI Chrome verified assignment → evidence-linked comment → independent review → human shortlist decision → `shortlisted` application state, plus a 390×844 responsive view with 0 console errors/warnings; capture: `.images/slice-6-panel-shortlist-verified-2026-08-09.png`. Conflicting-recommendation behavior and consensus-override detection have focused domain coverage; multi-account browser validation is deferred beyond the primary one-panel-member hackathon path. |
| 7 — Candidate information request and email outreach | Complete for hackathon scope | Added organization-scoped outreach threads/messages/templates, candidate responses, delivery events, and opt-outs; strict Zod request/draft/reply contracts; a server-only Sarvam-105B drafting adapter with deterministic simulated fallback; provider-neutral Resend/fake email delivery; persisted approval before side effects; message and provider idempotency keys; edit-driven approval invalidation; explicit recruiter approval; reply/bounce/opt-out stop states; parsed notice-period/expected-CTC/interest suggestions; and human-confirmed append-only evidence updates with audit linkage. The responsive outreach workspace starts only from a human shortlist decision and clearly distinguishes simulated delivery/provider events from real ones. All 41 tests pass; TypeScript, Prisma generation, clean PGlite initialization, lint (0 errors; 6 pre-existing warnings), and production build pass. Playwright CLI Chrome verified shortlist → bounded draft → approval → one-time simulated send → candidate reply → explicit notice-period confirmation with 0 console errors/warnings; capture: `.images/slice-7-approved-outreach-reply-verified-2026-08-09.png`. Real delivery requires a verified `EMAIL_FROM_ADDRESS` plus `EMAIL_PROVIDER_API_KEY`/`RESEND_API`; no supplied credential was persisted or exposed. Deferred beyond the primary hackathon path: production Resend webhook signature verification and a candidate-facing hosted preference page; normalized inbound event and opt-out contracts are in place. |
| 8 — Follow-up sequences and pipeline handoff | Complete for hackathon scope | Added approved reminder steps, business-hour scheduling, persisted jobs, reply/bounce/opt-out/pause/pipeline stop conditions, append-only stage transitions, and a human-only recruiter-screening handoff with an immutable evidence/decision snapshot. |
| 9 — Saaras voice notes | Complete for hackathon scope | Added consent-gated private audio, versioned Saaras transcription behind a server-only adapter, deterministic simulated fallback, human transcript review, source deletion, and approved draft-rubric conversion. |
| 10 — Bulbul candidate communication | Complete for hackathon scope | Added opt-in multilingual audio previews generated only from approved text, server-only Bulbul integration with simulated fallback, private expiring playback, audit provenance, deletion, and text-change invalidation. |
| 11 — Launch readiness | In progress — privacy, fairness, retention, document security, and operational controls complete | Privacy requests, hosted opt-out, audited retention enforcement, recommendation reconstruction, strict document validation, quarantine, and cross-organization access coverage remain complete. Added a fail-closed production HTTP malware-scanner adapter with normalized/versioned results and deterministic fixture fallback; server-side Sarvam, email, and scanner kill switches; PostgreSQL/PGlite organization-and-actor-scoped limits for uploads, matching, invitations, exports, and email sends; an administrator operations screen for queue/provider/quarantine signals; and worker/restore/provider incident runbooks. Next.js and eslint-config-next were upgraded from 16.2.4 to 16.2.11, and compatible dependencies were refreshed. All 104 tests, TypeScript, Prisma generation, clean PGlite initialization, lint (0 errors; 6 pre-existing warnings), and production build pass. Playwright CLI Chrome verified the operations route at desktop and 390×844 with no horizontal overflow or console errors/warnings; captures: `.images/slice-11-operations-safety-verified-2026-08-10.png` and `.images/slice-11-operations-safety-mobile-2026-08-10.png`. `bun audit` still reports 11 high, 3 moderate, and 1 low transitive advisories in build/runtime dependencies without compatible upstream resolutions, so the “no high findings” release gate is not met. Remaining: configure and exercise a real scanner endpoint, execute documented PostgreSQL restore and worker-restart drills, resolve or formally mitigate residual advisories, complete accessibility/load/cross-browser coverage, redeploy, and run the full synthetic production journey. |

### Current handoff
- 2026-08-10 Development database plan (not yet implemented): replace the two-process PGlite file setup with a single-owner PGlite socket server for local dev. `web` and `worker` connect over Postgres wire to one process that owns `dev.db`, eliminating the concurrent-file race and the inline-job workaround below. Full plan and acceptance criteria: "Development database: single-owner PGlite socket server" section.

- 2026-08-10 Slice 11 operational controls: added `rate_limit_events` to Prisma, PGlite initialization, and a PostgreSQL migration; sensitive actions now enforce organization-and-actor-scoped hourly limits using parameterized SQL. `SARVAM_ENABLED`, `EMAIL_DELIVERY_ENABLED`, and `MALWARE_SCANNER_ENABLED` provide server-only kill switches; disabled AI/email paths remain honestly simulated. CVs can use a production multipart HTTP scanner that fails closed on timeout, bad responses, or outages, while local validation retains deterministic clean/threat/error fixtures. Administrators can inspect queue, stuck/failed work, quarantine, provider failures, and provider mode at `/settings/operations`; recovery procedures are in `OPERATIONS.md`. Next.js/eslint-config-next are upgraded to 16.2.11 and compatible dependencies refreshed. All 104 tests, TypeScript, Prisma generation, clean PGlite initialization, lint (0 errors; 6 existing warnings), and production build pass. Chrome verified desktop/mobile operations UI, 390px no-overflow, and zero console errors/warnings; captures: `.images/slice-11-operations-safety-verified-2026-08-10.png` and `.images/slice-11-operations-safety-mobile-2026-08-10.png`. `bun audit` still reports 11 high/3 moderate/1 low transitive findings; do not mark Slice 11 complete until those are upgraded or explicitly mitigated and the real scanner, restore/worker drills, cross-browser/load/accessibility audit, redeploy, and full synthetic production journey are verified.
- 2026-08-10 Slice 11 document security: CV validation now verifies declared media type, signatures, complete PDF/DOCX structure, and rejects active/embedded PDF content before persistence. Persisted documents pass through a versioned `MalwareScanner` boundary; the deterministic fixture honestly labels clean results simulated and produces auditable threat/error states. Extraction and private download are gated on a clean verdict. Threats and scanner failures stay organization-scoped in quarantine, with recruiter-visible retry guidance for outages and replacement guidance for threats. Provider/version/request/error/timestamp metadata and `candidate_document.security_scanned` audit events are stored. Four repository security tests plus nine validation/scanner tests cover cross-organization denial, scoped mutations, structure/content-type checks, clean, threat, and normalized outage behavior. All 100 tests, Prisma generation, clean PGlite initialization, lint (0 errors; 6 existing warnings), and production build pass. Chrome verified the synthetic threat path and private-route denial, desktop/mobile rendering, no overflow, and zero normal-page console errors/warnings; captures: `.images/slice-11-document-quarantine-verified-2026-08-10.png` and `.images/slice-11-document-quarantine-mobile-2026-08-10.png`. Next pickup: production scanner adapter selection plus rate limits and Sarvam/email kill switches.
- 2026-08-10 journey hardening: `bun run dev` now initializes the local PGlite schema before serving requests; protected pages redirect unauthenticated sessions; deterministic CV fallback extracts source-backed name, headline, location, email, phone, ownership, and notice-period evidence; outreach disables and safely reports sends without an email; dashboard/JD copy uses persisted user and position data; final shortlist decisions are idempotent and the completed form is hidden. All 78 tests, TypeScript, lint (0 errors; 6 pre-existing warnings), and the production build pass. Chrome verified signup → approved position → DOCX import → evidence/matching → panel shortlist → approved simulated email → reply → recruiter screening with zero console errors.
- `/setup` collision UX is implemented locally and on `main` for field-level email/slug errors; case-insensitive email uniqueness hardening (`users_email_lower_key`, write-path `LOWER(email)`, PGlite atomicity tests) is on `fix/setup-review-hardening` and still needs merge + Render redeploy before treating live production as fully verified. Use a unique email/slug (not the old `acme-india` / `ananya@company.in` placeholders).
- 2026-08-10 Slice 11 hosted candidate privacy: recruiters can mint a 30-day secure link whose raw token is shown only at creation; the database stores only its SHA-256 hash. The public route validates expiry/revocation and candidate state, then accepts correction/export/deletion for human review and an immediate, idempotent email opt-out. Opt-out stops active sequence enrollments through organization-scoped outreach threads, marks open threads opted out, and records a separate audit event; it never changes an application or hiring decision. All 87 tests, Prisma generation, clean PGlite initialization, lint (0 errors; 6 pre-existing warnings), and production build pass. Chrome verified the public flow, invalid-link 404, responsive layout, and zero console errors/warnings; capture: `.images/slice-11-hosted-privacy-optout-verified-2026-08-10.png`.
- 2026-08-10 Slice 11 fairness inspection: administrators can inspect a published allowed/separate/prohibited matching-input policy and reconstruct any organization-owned evaluation through approved rubric version, criterion reasoning, immutable evidence and extractor versions, provider/model/prompt/schema record, panel input, final human decision, and audit events. Five focused tests cover the contracts, protected-input exclusion, parameterized organization scoping, and cross-organization denial; all 92 repository tests pass. Chrome verified the real synthetic rubric → match → ledger → reconstruction path, missing-record 404, 390×844 layout without overflow, and 0 console errors/warnings on the reconstruction page. Captures: `.images/slice-11-fairness-reconstruction-verified-2026-08-10.png` and `.images/slice-11-fairness-reconstruction-mobile-2026-08-10.png`.
- Continue Slice 11 with upload hardening: add content-type verification beyond extension/signature checks, a malware-scanning provider boundary with deterministic fixtures and quarantine states, organization-scoped document access adversarial coverage, and the recruiter-visible recovery path. Fairness inspection, retention enforcement, and the hosted candidate privacy/opt-out entry point are complete.
- Slice 7 keeps generated drafts, recruiter approval, provider delivery, candidate replies, and confirmed structured profile updates as distinct auditable states. Editing invalidates approval; only an approved message can transition to the idempotent send claim.
- Slice 6 keeps AI recommendations, each reviewer recommendation, and the final human decision separate. A final decision requires every assigned review, persists rationale and evaluation linkage, and is the only Slice 6 action that changes the application stage.
- Preserve the Slice 3 privacy boundary: original files stay outside `public/`, access remains organization-authorized and short-lived, and raw document text must not enter logs or screenshots. Slice 5 snapshots only normalized evidence claims with provenance.
- Use `SARVAM_API_KEY` only through the server environment. Criterion matching validates `criterion-evaluation.v1`, requires exactly one judgment for every approved rubric criterion, records provider execution metadata, and falls back to clearly simulated output. Never add pasted credentials to source, screenshots, or logs.
- Slice 5 follow-up breadth, if prioritized after the primary demo loop, is named/saved compound candidate views, bulk match orchestration, side-by-side comparison, and audited manual score overrides. The current candidate table supports the required no-JD talent-pool mode and a selected-position ranked mode.
- The local PGlite inline-processing workaround and the two-process `dev.db` race are superseded by the "Development database: single-owner PGlite socket server" plan below. Remove the inline path as part of that work; do not extend it.
- Do not mark Slice 0 fully complete until preview deployment, production PostgreSQL, and backup behavior have been verified in the target hosting environment.

## Development database: single-owner PGlite socket server (plan)

Status: **planned — not implemented**. Supersedes the handoff note "local PGlite path processes persisted jobs inline after enqueueing because separate PGlite processes cannot safely share the same local store".

### Why

Today `scripts/dev.ts` spawns two child processes (`next dev`, `src/lib/worker.ts`) that both call `executeQuery()` → `getPGliteInstance()` → `new PGlite('dev.db')` on the same file. PGlite is single-connection per instance, so two processes on one file means last-writer-wins corruption; LISTEN/NOTIFY never crosses processes (each instance's notifications are in-memory), so the worker always falls back to 1s polling; and plan.md documents an inline-job workaround for local mode.

Goal: exactly one process owns `dev.db`; both consumers connect to it over the Postgres wire protocol. This is not the browser-only multi-tab worker feature — it is `@electric-sql/pglite-socket`, an official ElectricSQL package that exposes a PGlite instance as a TCP Postgres server with a connection multiplexer.

```text
Before:                          After:
web    -- new PGlite(dev.db) --> dev.db     dev-db (PGlite + socket :5433) -- owns --> dev.db
worker -- new PGlite(dev.db) --> dev.db     web    -- pg wire --> dev-db
                                             worker -- pg wire --> dev-db
```

### Changes (file by file)

1. **`package.json`** — bump `@electric-sql/pglite` `^0.4.5` → `0.5.4` (pglite-socket pins it exactly; 0.5 added multi-connection support); add `@electric-sql/pglite-socket` (devDependency); add `pg` as a runtime dependency (currently only present transitively; needed for the worker's LISTEN client).
2. **New `src/lib/schema.ts`** — extract the schema + seed SQL from `scripts/init-db.ts` into `ensureSchema(db: PGlite)` so both `init-db.ts` (one-shot file init) and `dev-db.ts` (server startup) share it.
3. **New `scripts/dev-db.ts`** — dev-only owner process: `new PGlite(PGLITE_DATA_DIR ?? './dev.db')`; `ensureSchema`; `PGLiteSocketServer({ db, host: '127.0.0.1', port: PGLITE_PORT ?? 5433 })`. Refuse to start when `NODE_ENV === 'production'` or `APP_ENV === 'production'`. Graceful close on SIGINT/SIGTERM. Banner: `🗄️  PGlite socket server on 127.0.0.1:5433 (dev.db)`.
4. **`scripts/init-db.ts`** — keep as one-shot file-mode init, now calling shared `ensureSchema` (no behavior change).
5. **`.env` / `.env.example`** — dev `DATABASE_URL="postgres://127.0.0.1:5433/sorted"` with a comment that `bun run dev` starts the local DB server automatically; document `PGLITE_PORT` (default 5433) and `PGLITE_DATA_DIR` (default `./dev.db`).
6. **`src/lib/db.ts`** — delete the PGlite branch, `getPGliteInstance`, and `global.pglite`. `executeQuery` becomes the single Postgres-wire path via Prisma `$queryRawUnsafe`. App code stops importing `@electric-sql/pglite` entirely (drop the `serverExternalPackages` entry for it if unused elsewhere).
7. **`src/lib/queue/postgres-queue.ts`** — rewrite `subscribe()` on a `pg` client (`LISTEN job_queue`) against `DATABASE_URL`. NOTIFY path (already `pg_notify` wrapped in a `SELECT 1`) is unchanged. Keep the poll fallback on subscribe failure.
8. **`src/app/api/items/route.ts`** — drop the stale `getPGliteInstance` import; audit and remove `runtime = 'nodejs'` PGlite-compatibility comments where nothing else requires Node.
9. **`scripts/dev.ts`** — replace `initializeLocalDatabase()` (spawnSync `db:init`) with: spawn `scripts/dev-db.ts` as a managed child; readiness = TCP connect to `PGLITE_PORT` succeeds; then start next + worker as today; `cleanup()` kills dev-db too. Only spawn dev-db when `DATABASE_URL` points at `127.0.0.1`/`localhost` on `PGLITE_PORT`.
10. **Remove the local inline-processing workaround** — audit enqueue paths (candidate import, extraction, outreach follow-ups) for the inline `processCandidateDocument`-style execution documented in the handoff; with a shared DB the worker processes everything, so the inline path is deleted.

### How we run it

- `bun run dev` → three managed processes: dev-db (:5433), next (:7070), worker. Readiness-gated; Ctrl-C kills all three.
- `bun run dev:db` → DB server alone; debug via `psql postgres://127.0.0.1:5433/sorted` (real wire protocol).
- `bun run db:init` still works for one-shot file init; the same schema now also applies at dev-db startup (idempotent `ensureSchema`).
- Everything else unchanged: `db:generate`, `lint`, `build`, `test` (tests construct their own in-memory `new PGlite()` and are untouched).

### Prod safety — this can never happen on real Postgres

Structural, not behavioral:

1. PGlite code lives only in `scripts/dev-db.ts` and `src/lib/schema.ts`, imported exclusively by `scripts/dev.ts` / `scripts/init-db.ts` — never by app routes, services, or worker code. The prod image never executes `scripts/` entrypoints (`start` = `next start`, `start:worker` = worker against real Postgres).
2. `executeQuery` has exactly one path: Postgres wire. The app is indistinguishable from any Postgres client — file access is structurally impossible from app code, whatever `DATABASE_URL` resolves to.
3. `dev-db.ts` refuses to start under `NODE_ENV=production` / `APP_ENV=production`; `scripts/dev.ts` only spawns it for a localhost socket URL.
4. Existing env validation must reject `file:` `DATABASE_URL` outside development (verify the current rule; add if missing) — with the refactor the `file:` format is no longer a supported app value at all.

### Risks and verification

- **pglite 0.4.5 → 0.5.4**: app usage is only `query`/`exec`/`waitReady`; low risk. Verify: full `bun test` + demo flow.
- **Prisma Rust engine vs faked auth handshake**: verify with `GET /api/ready` and one page load against the socket. Fallback: `executeQuery` Postgres path via `pg` Pool (`pg@8.20.0` + `@prisma/adapter-pg` already present).
- **NOTIFY through the multiplexer**: verify the worker wakes without polling (log line + job latency). Fallback: keep 1s polling (today's prod behavior).
- **Port collision**: `PGLITE_PORT` override + clear failure banner.

### Acceptance criteria

- `bun run dev` starts three processes; killing dev-db makes web/worker fail with connection errors (never file corruption).
- Enqueue a job from the UI → worker claims it within ~1s via NOTIFY, no polling warnings.
- `psql postgres://127.0.0.1:5433/sorted -c 'select 1'` succeeds.
- All repository tests pass; `bun run build` passes; lint unchanged.
- Prod: `bun run build && bun run start` with a real Postgres URL — no PGlite import in the build trace, worker processes jobs, no local store touched.
- plan.md progress tracker updated after implementation.

## Slice 0 — Reframe the prototype and establish delivery foundations

### User outcome

The team can open a private preview of Sorted Recruiting and understand the new product through a coherent recruitment-oriented shell rather than the previous customer-operations prototype.

### Scope

#### Product shell

- Replace navigation with `Dashboard`, `Positions`, `Candidates`, and `Outreach`.
- Replace conversation/workflow demo content with recruitment fixtures.
- Establish position and candidate detail page layouts.
- Add a persistent “Import candidates” action.
- Remove or gate inherited starter pages such as Items and the technical Jobs dashboard.

#### Delivery foundation

- Add typed environment validation.
- Add `/api/health` and `/api/ready`.
- Configure CI for install, targeted lint/type checks, tests, and build.
- Provision preview and production application environments.
- Provision PostgreSQL for preview/production with backups.
- Add structured logging with correlation IDs and sensitive-data redaction.

### Demo fixture

- Organization: `Acme India`
- Position: `Senior Backend Engineer`
- Panel: one recruiter, one hiring manager, and one technical reviewer
- Candidates: 10–20 synthetic CV-based profiles with varied evidence quality

### Acceptance criteria

- The private preview deploys from the repository.
- The UI contains no customer-support/workflow terminology from the old concept.
- Health and readiness checks correctly report application and database state.
- Candidate names and documents in fixtures are synthetic.
- CI blocks a deployment when required checks fail.

---

## Slice 1 — Organization, authentication, and hiring-panel access

### User outcome

An organization administrator can sign in, create an organization, invite hiring-panel members, assign roles, and ensure candidates are private to that organization.

### Scope

#### Data

- Add `users`, `organizations`, `organization_members`, and `invitations`.
- Add organization status, timezone, default locale, retention setting, and audit metadata.
- Add role-based permissions for administrator, recruiter, hiring manager, and technical reviewer.

#### Experience

- Sign in, sign out, session expiry, and account recovery.
- First-run organization setup.
- Member invitation and role management.
- Workspace switcher only if a user belongs to multiple organizations.
- Empty states for Dashboard, Positions, Candidates, and Outreach.

#### Authorization

- Resolve the current organization server-side.
- Never authorize using an unchecked organization ID supplied by the browser.
- Apply role checks to every server action and API route.
- Record membership and role changes in the audit log.

### Acceptance criteria

- A new administrator completes setup and invites all three panel roles.
- Recruiters can manage candidates but cannot change organization security settings.
- Technical reviewers cannot export the whole candidate database.
- Two organizations cannot access one another’s candidates by manipulating identifiers.
- Playwright verifies onboarding, invitation, role enforcement, and cross-tenant denial.

---

## Slice 2 — Create a position and approve its evaluation rubric

### User outcome

A hiring manager can paste or upload a job description, review structured requirements generated by Sarvam-105B, refine the evaluation rubric, add Indian hiring constraints, and approve it for screening.

### Scope

#### Data

- Add `positions`, `job_descriptions`, `evaluation_rubrics`, `rubric_criteria`, and `hiring_panel_members`.
- Version job descriptions and rubrics.
- Store criterion type, weight, classification, evidence expectations, and display order.
- Support criterion classifications: `must_have`, `preferred`, `logistics`, and `informational`.

#### Sarvam-105B adapter

- Define `JobDescriptionStructuringProvider`.
- Keep the real client server-only and provide a deterministic fake provider for tests.
- Validate structured model output with a versioned Zod schema.
- Retain model, prompt version, request ID, latency, and normalized errors.

#### Experience

- Create position manually or from pasted/uploaded JD text.
- Show extracted title, seniority, responsibilities, skills, experience, and logistics.
- Let the manager convert requirements into rubric criteria.
- Allow explicit weights while warning against overfitting.
- Require human approval before screening begins.
- Support a position without a complete JD through a manual rubric.

#### India-specific fields

- Employment type
- Location and relocation
- Remote/hybrid/on-site preference
- Compensation range
- Minimum and preferred experience
- Notice-period preference
- Shift or travel requirements
- Work authorization where relevant

### Acceptance criteria

- A backend-engineer JD becomes an editable structured rubric.
- The manager can distinguish must-have, preferred, logistics, and informational criteria.
- The AI cannot approve its own rubric.
- Changing an approved rubric creates a new version rather than mutating prior evaluations.
- A position can be saved as a draft without a JD.

---

## Slice 3 — Upload CVs and build persistent candidate records

### User outcome

A recruiter can import one or many candidates from CVs or other supported sources, see processing progress, resolve duplicate identities across sources, and obtain persistent candidate records in the organization’s talent pool.

### Scope

#### Upload pipeline

- Support PDF and DOCX initially.
- Validate file type, signature, size, page count, and malware-scan status.
- Store source files privately using short-lived signed URLs.
- Create asynchronous states: `uploaded`, `scanning`, `extracting`, `parsed`, `needs_review`, and `failed`.
- Preserve original document metadata and a content checksum.

#### Source-agnostic ingestion

- Define a shared `CandidateIngestionProvider` contract that produces normalized identity hints, profile facts, evidence claims, source metadata, and processing warnings.
- Initial ingestion methods:
  - PDF and DOCX CV upload
  - Bulk CV upload
  - CSV candidate import
  - Recruiter-entered candidate profile
  - GitHub profile or repository URL
  - Personal portfolio or public profile URL
  - LinkedIn URL stored as a reference
  - Candidate-provided LinkedIn export or explicitly authorized LinkedIn integration
  - Recruitment inbox/email attachment in a later iteration of this slice
- Store every import as a separate immutable `candidate_source` linked to the canonical candidate.
- Never treat imported claims as verified merely because they came from a public profile.
- Respect robots, provider terms, rate limits, privacy expectations, and access controls.
- Do not scrape LinkedIn pages. Support recruiter/candidate-provided exports or an authorized LinkedIn API/partner integration when available.
- Use the official GitHub API for permitted public data and clearly distinguish self-authored repositories, contributions, forks, and organization-owned work.
- Make adapters replaceable so future sources such as job boards, ATS exports, referral forms, or candidate application forms use the same normalization pipeline.

#### Data

- Add `candidates`, `candidate_sources`, `candidate_documents`, `candidate_identities`, `external_profile_links`, and `ingestion_runs`.
- Normalize email and phone values for duplicate detection while protecting raw values.
- Support candidates without an application.
- Create `applications` only when import occurs inside a position or a recruiter assigns the candidate later.

#### Duplicate detection

- Exact match on organization-scoped normalized email.
- Strong match on phone or external profile identity.
- Suggested match on name plus employment/education evidence.
- Human-reviewed merge with a reversible audit trail.
- Generate organization-scoped identity fingerprints from normalized identifiers; do not use a global cross-customer candidate identity.
- Combine deterministic and probabilistic signals:
  - Exact normalized email
  - Exact normalized phone number
  - Same GitHub account ID or verified external account ID
  - Same authorized LinkedIn member/source ID when available
  - Same portfolio domain or strongly matching profile URL
  - Name plus overlapping employer, role, education, and employment dates
  - Document checksum for re-uploaded CVs
- Classify results as `same_candidate`, `possible_duplicate`, or `distinct` with evidence and confidence.
- Auto-link only high-confidence deterministic matches within the same organization; route probabilistic matches to human review.
- Support merge preview, field-level conflict resolution, provenance preservation, and undo.
- Support splitting an incorrectly merged candidate without losing applications, reviews, or audit history.

#### Experience

- Global drag-and-drop import.
- Position-scoped import.
- Batch progress and individual retry.
- Failed-document explanation.
- Potential-duplicate review before merge.
- “Add source” action on an existing candidate to attach a CV, GitHub URL, portfolio, CSV record, or authorized LinkedIn data without creating another candidate.
- Candidate source panel showing origin, import time, permission/retrieval method, processing status, and contributed evidence.

### Acceptance criteria

- Twenty synthetic CVs can be uploaded in one batch.
- Refreshing during processing restores accurate progress.
- The same CV cannot silently create repeated candidates.
- Importing a CV and GitHub URL for the same person can enrich one canonical profile while retaining two sources.
- A likely duplicate from different CV formats is surfaced with the signals that caused the match.
- An incorrectly merged profile can be split safely.
- A candidate uploaded without a position appears in the talent pool.
- A candidate uploaded within a position receives exactly one application.
- Source CVs are never publicly addressable.

---

## Slice 4 — Candidate Evidence Profile

### User outcome

The recruiter can review a structured career profile extracted from a CV, see the evidence behind each claim, correct errors, and identify missing information without altering the source document.

### Scope

#### Data

- Add employment, education, project, skill, certification, language, and external-link records.
- Add `evidence_claims` and `evidence_sources`.
- Record claim status: `explicit`, `inferred`, `externally_evidenced`, `contradicted`, or `unverified`.
- Store source document, page/section, excerpt coordinates where possible, extractor version, and confidence.
- Store human corrections separately from model extraction history.

#### Sarvam-105B extraction

- Define `CandidateProfileExtractionProvider`.
- Extract into a versioned schema, never directly into UI state.
- Separate factual extraction from evaluative conclusions.
- Detect ambiguity rather than inventing dates, employers, or skill depth.

#### Experience

- Profile overview: experience, current role, primary skills, education, and logistics.
- Evidence view with source references.
- “Needs verification” section.
- Correct, confirm, reject, and add-claim actions.
- LinkedIn, GitHub, portfolio, CSV, email, and CV evidence shown with their distinct source provenance.
- Candidate sources can be added or refreshed independently without overwriting confirmed human corrections.
- GitHub evidence distinguishes repository ownership, contribution type, recency, and relevance; commit count is never treated as a quality score.
- LinkedIn URLs are shown as references. Data is ingested only through candidate/recruiter-provided exports or authorized integrations—never page scraping.

#### India-specific candidate fields

- Current location and preferred location
- Current and expected CTC, with fixed/variable separation
- Notice period, serving-notice status, and last working day
- Offers in hand
- Remote/hybrid preference
- Willingness to relocate
- Preferred communication language

### Acceptance criteria

- A CV produces a usable profile with employment, skills, projects, and source evidence.
- Clicking an extracted claim reveals where it came from.
- Human correction does not destroy the original extraction record.
- Unknown information is visibly unknown rather than inferred as fact.
- Protected attributes are not extracted into matching inputs.
- Conflicting claims from CV, GitHub, LinkedIn-authorized data, or portfolio sources are displayed for review instead of silently choosing one.

---

## Slice 5 — Evidence-backed position matching

### User outcome

For an approved position, the hiring panel can see each candidate’s criterion-by-criterion fit, evidence confidence, missing information, concerns, and an explainable review recommendation.

### Scope

#### Evaluation model

- Add `candidate_evaluations`, `criterion_evaluations`, and `evaluation_runs`.
- Key every official evaluation by `organization_id`, `candidate_id`, `position_id`, `rubric_version_id`, and evidence-snapshot version.
- Enforce at most one current evaluation per candidate and rubric version while retaining all historical runs.
- Snapshot candidate evidence and rubric versions used by every evaluation.
- Score job-relevant criteria only.
- Produce separate `role_fit` and `evidence_confidence` values.
- Recommendations: `strong_review`, `review`, `needs_information`, and `low_match`.
- Never generate `auto_reject`.

#### Scoring principles

- Deterministic calculation combines approved criterion weights and normalized criterion judgments.
- Sarvam-105B evaluates evidence against individual rubric criteria and returns structured reasoning.
- Missing evidence lowers confidence, not necessarily capability.
- Logistics appear separately from technical/role merit.
- Education and employer prestige are not silent quality proxies.
- Absence of public GitHub activity does not reduce core role-fit scores.

#### Experience

- Organization-wide Candidates table with an optional position/JD selector.
- Position candidate table with filters and sortable dimensions.
- “Match against JD” for one candidate, a selection, or the eligible talent pool.
- Position/JD filter that shows the candidate’s score, confidence, application stage, and evaluation freshness for the selected position.
- Multi-position candidate view that shows the candidate’s different score and status for every application/evaluation.
- Clear `Not matched`, `Matching`, `Matched`, `Stale`, and `Failed` states instead of treating missing scores as zero.
- Candidate scorecard with criterion, rating, evidence, gaps, and reviewer status.
- Side-by-side comparison for a small candidate set.
- Re-run evaluation when the rubric or evidence changes, while preserving history.
- Manual override requires a reason and remains visible in the audit trail.

### Acceptance criteria

- The demo position ranks candidates using the approved rubric.
- The All Candidates view works without any JD and does not invent a universal candidate score.
- Selecting a position/JD changes scores and filters to that position’s evaluation context.
- A recruiter can match existing talent-pool candidates against a newly created position without re-uploading their CVs.
- One candidate can retain distinct scores for multiple positions.
- Updating the approved rubric marks existing scores stale and allows controlled re-evaluation.
- Every rating links to candidate evidence or clearly says evidence is missing.
- Role fit and evidence confidence are displayed separately.
- Changing the rubric creates new evaluations without rewriting historical results.
- The system cannot use age, gender, photograph, caste, religion, marital status, disability, or name-based demographic inference.

---

## Slice 6 — Panel review and shortlist consensus

### User outcome

Recruiters, hiring managers, and technical reviewers can independently review candidates, discuss evidence, expose disagreement, and record a human shortlist decision.

### Scope

#### Data

- Add `panel_reviews`, `review_comments`, `review_assignments`, `shortlist_decisions`, and `decision_events`.
- Review states: `not_started`, `in_review`, `submitted`, and `changes_requested`.
- Reviewer recommendations: `shortlist`, `hold`, `needs_information`, and `do_not_advance`.
- Keep the final shortlist decision distinct from AI and individual recommendations.

#### Experience

- Review queue for each panel member.
- Structured review against relevant rubric criteria.
- Evidence-linked comments and mentions.
- Visible disagreement rather than averaged-away votes.
- Hiring-manager final decision with required rationale when overriding consensus.
- Bulk shortlist only after required reviews are complete.

#### Notifications

- Review assignment
- Mention/comment
- Evaluation updated after evidence correction
- Decision required
- Candidate shortlisted

### Acceptance criteria

- Each role sees only permitted candidate information and actions.
- Technical reviewers can validate technical evidence without editing compensation data.
- Conflicting reviews remain visible to the decision maker.
- AI output never changes application stage by itself.
- Every final shortlist decision records actor, rationale, evaluation version, and timestamp.

---

## Slice 7 — Candidate information request and email outreach

### User outcome

A recruiter can send an approved, personalized email to a candidate requesting missing information or confirming shortlist interest, and candidate replies update the application workflow.

### Scope

#### Communication data

- Add `outreach_threads`, `outreach_messages`, `message_templates`, `candidate_responses`, `delivery_events`, and `opt_outs`.
- Link communication to candidate and optionally application/position.
- Persist draft, approval, provider, delivery, bounce, reply, and failure states.
- Use idempotency keys to prevent duplicate sends.

#### Sarvam-105B drafting

- Generate drafts using approved candidate, position, and missing-information context.
- Validate generated content and prohibit unsupported claims or promises.
- Show exactly which information will be requested.
- Require recruiter editing/approval before sending.

#### Email adapter

- Define a provider-neutral `EmailProvider`.
- Implement one provider plus a fake implementation for tests.
- Support verified sender identity, delivery events, replies, bounce handling, and unsubscribe/opt-out.
- Parse replies into suggestions; require human confirmation before updating sensitive structured fields.

#### Experience

- “Request missing information” from profile or evaluation.
- “Confirm interest” from shortlist.
- Draft editor, approval, send, delivery status, and reply timeline.
- Candidate-facing privacy notice and communication preference.

### Acceptance criteria

- A recruiter can request notice period and expected CTC from a shortlisted candidate.
- Sending the same approved action twice cannot produce duplicate emails.
- Candidate reply appears in the communication timeline.
- Suggested structured updates require recruiter confirmation.
- Bounce and opt-out stop further automated follow-up.

---

## Slice 8 — Follow-up sequences and pipeline handoff

### User outcome

Recruiters can configure safe follow-up nudges, see who needs attention, and move responsive shortlisted candidates into recruiter screening without building interview functionality.

### Scope

#### Outreach sequences

- Add `outreach_sequences`, `outreach_steps`, and `sequence_enrollments`.
- Initial sequence types: missing-information request and shortlist-interest confirmation.
- Support delays, business hours, maximum attempts, stop conditions, and manual pause.
- Require approved templates; no unconstrained autonomous messages.
- Stop on reply, bounce, opt-out, manual disposition, or pipeline advancement.

#### Pipeline

- Stages: `talent_pool`, `applied`, `under_review`, `needs_information`, `shortlisted`, `contacted`, `interested`, `recruiter_screening`, `not_advancing`, and `withdrawn`.
- Record every stage transition and actor.
- Require a human action to enter `recruiter_screening` or `not_advancing`.
- Add a future integration boundary for handing off to an ATS or interview product.

#### Dashboard

- Candidates awaiting review
- Panel decisions pending
- Outreach due today
- Candidate replies
- Missing information
- Stalled applications

### Acceptance criteria

- An approved sequence sends reminders according to business-hour rules.
- A candidate reply immediately stops future nudges.
- Recruiters can pause all outreach for a candidate or position.
- Advancing to recruiter screening records a complete evidence and decision snapshot.
- No AI interview or scheduling behavior is introduced.

### MVP release gate

At the end of Slice 8, Sorted completes its core production loop:

```text
Approved position rubric
→ Batch CV upload
→ Evidence-backed candidate profiles
→ Explainable role matching
→ Panel-reviewed shortlist
→ Approved candidate outreach
→ Reply and missing information captured
→ Human handoff to recruiter screening
```

---

## Slice 9 — Saaras recruiter voice notes and multilingual accessibility

### User outcome

Hiring managers and recruiters can dictate position requirements or screening notes in an Indian language, review the Saaras transcript, and convert approved content into structured hiring data.

### Scope

- Define `SpeechToTextProvider` and implement Saaras server-side.
- Browser audio recording with explicit permission.
- Private media storage, upload validation, retention, and deletion.
- Transcription states with retry and recovery.
- Use cases:
  - Dictate a position requirement
  - Add recruiter screening notes
  - Add panel feedback
  - Record a candidate-provided voice response in a later iteration
- Require transcript review before it changes a rubric, candidate profile, or decision.
- Preserve language and transcript provenance.

### Acceptance criteria

- A Hindi/Hinglish hiring-manager note becomes an editable transcript.
- Approved transcript content can add a draft rubric criterion.
- Refresh during transcription restores the correct state.
- Source audio can be deleted according to retention policy.
- Transcribed speech never becomes a hiring decision automatically.

---

## Slice 10 — Bulbul candidate communication, opt-in only

### User outcome

Where appropriate, a recruiter can offer an accessible multilingual audio version of an approved candidate message, preview it, and send it only through an opt-in communication path.

### Scope

- Define `TextToSpeechProvider` and implement Bulbul server-side.
- Support approved languages/voices and accessible playback.
- Generate only from an already approved text message.
- Changing the text invalidates audio and requires regeneration/reapproval.
- Store generated audio privately with expiration and deletion controls.
- Make voice optional at organization and candidate levels.
- Do not use unsolicited AI voice calls or deceptive synthetic identity.

### Acceptance criteria

- An approved message produces a playable multilingual preview.
- Voice is never sent without a compatible channel and recorded preference/consent.
- Failed generation preserves the text-only communication path.
- Audio URLs expire and cannot be accessed across organizations.
- Audit history links the approved text, voice configuration, generated asset, and sender.

---

## Slice 11 — Privacy, fairness, security, and launch readiness

### User outcome

Organizations can trust Sorted with candidate data and explain how candidates were screened, while operators can detect and recover from production failures.

### Candidate privacy

- Candidate-facing privacy notice describing source, purpose, retention, AI assistance, and contact path.
- Data correction, export, deletion, and outreach opt-out workflows.
- Organization-configurable retention with safe minimum/maximum policy.
- Delete or irreversibly anonymize candidate data after an approved request, subject to documented legal retention needs.
- Prevent raw CVs, phone numbers, compensation, and email content from entering logs.

### Fairness and explainability

- Document allowed and prohibited matching inputs.
- Blind or suppress protected attributes in evaluation contexts.
- Add evaluation-quality sampling and reviewer feedback.
- Compare recommendation and advancement rates for unexpected disparities where legally and ethically appropriate.
- Allow organizations to inspect rubric, evidence, scoring logic, model version, and human overrides.
- Add a prominent statement that Sorted supports—not replaces—human hiring decisions.

### Security

- Threat-model authentication, tenant isolation, uploads, document parsing, prompt injection, external links, email, and data export.
- Malware scanning and content-type verification for uploaded CVs.
- Rate limits for uploads, AI evaluation, invitations, exports, and email.
- Least-privilege credentials and secret rotation.
- Dependency and static security scanning in CI.
- Signed URLs and strict access checks for all candidate documents.

### Reliability and operations

- Metrics for upload success, extraction success, evaluation latency, queue depth, stuck jobs, outreach delivery, and reply ingestion.
- Alerts for provider failures, database health, worker failure, email bounce spikes, and cross-tenant authorization failures.
- Idempotent job execution, dead-letter handling, and reconciliation tools.
- Backup restore drill and worker-restart drill.
- Sarvam and email provider kill switches.
- Incident, rollback, data-breach, and candidate-request runbooks.

### Quality

- Full Playwright coverage of the MVP release loop.
- Accessibility audit for keyboard navigation, focus, forms, drag/drop alternatives, contrast, and screen readers.
- Cross-browser and responsive testing.
- Load testing for concurrent batch uploads and evaluation jobs.
- Production test using synthetic candidates only.

### Acceptance criteria

- No critical or high security findings remain.
- Cross-organization document and candidate access tests pass.
- A candidate data request can be completed and audited.
- Every recommendation can be reconstructed from rubric version, evidence snapshot, model version, and human actions.
- Backup restore and worker recovery drills succeed.
- The complete MVP loop passes in production with synthetic candidates.

---

## 6. Recommended milestones

| Milestone | Slices | Demonstrable outcome |
|---|---:|---|
| Recruitment prototype | 0 | The current app is coherently reframed around positions, candidates, evidence, and outreach. |
| Private multi-user workspace | 1–2 | A hiring panel signs in, creates a position, and approves its rubric. |
| Candidate intelligence | 3–4 | Recruiters batch-upload CVs and receive corrected, evidence-backed profiles. |
| Explainable shortlist | 5–6 | The panel evaluates, discusses, and shortlists candidates with full evidence and human accountability. |
| Production MVP | 7–8 | Shortlisted candidates receive approved outreach and move into recruiter screening. |
| Sarvam accessibility layer | 9–10 | Recruiters use multilingual voice input and candidates can receive optional voice communication. |
| External launch candidate | 11 | Privacy, fairness, security, reliability, and operations are production-ready. |

## 7. Suggested implementation structure

```text
src/
  app/
    (auth)/
    (workspace)/
      [organization]/
        dashboard/
        positions/
        positions/[positionId]/
        candidates/
        candidates/[candidateId]/
        outreach/
        settings/
    api/
      health/
      ready/
      webhooks/
  features/
    organizations/
    positions/
    candidates/
    documents/
    ingestion/
    identity-resolution/
    evidence/
    evaluations/
    panel-reviews/
    outreach/
    audit/
  lib/
    db.ts
    auth/
    queue/
    storage/
    providers/
      sarvam/
      github/
      candidate-sources/
      email/
  workers/
    tasks/
```

Each feature should prefer:

```text
schema → repository → service → server action/route → UI
```

External services should follow:

```text
provider interface → fake adapter → real adapter → normalized domain result
```

## 8. Candidate matching design

### Example scorecard

| Dimension | Weight | Candidate result | Evidence confidence |
|---|---:|---:|---:|
| Must-have technical skills | 35% | 88 | 82 |
| Relevant experience | 25% | 80 | 90 |
| Project complexity | 15% | 76 | 68 |
| Domain alignment | 10% | 92 | 87 |
| Preferred skills | 10% | 64 | 60 |
| Communication evidence | 5% | Unknown | 0 |

Logistics such as notice period and compensation should appear beside this score, not silently distort technical merit.

### Evaluation output

```text
Role fit: 83/100
Evidence confidence: 78/100
Recommendation: Strong review

Strong evidence
- Designed production event-driven payment services
- Demonstrated PostgreSQL performance work

Needs verification
- Kafka appears in the CV but lacks project evidence
- Notice period is missing

Human decision
- Awaiting technical reviewer
```

## 9. Initial dashboard specification

### Summary cards

- Candidates to review
- Awaiting panel decision
- Outreach due today
- Candidate replies

### Main areas

- Positions needing attention
- Recently imported candidate batches
- Review assignments
- Missing-information requests
- Stalled applications
- Recent panel and outreach activity

Every dashboard number must link to the filtered underlying records and reconcile with database state.

## 10. Suggested environment variables

Exact provider-specific names and endpoints must be verified against current official documentation before implementation.

```dotenv
# Application
APP_URL=
AUTH_SECRET=

# Database
DATABASE_URL=

# Sarvam — server only
SARVAM_API_KEY=

# Private candidate document storage
OBJECT_STORAGE_BUCKET=
OBJECT_STORAGE_REGION=
OBJECT_STORAGE_ACCESS_KEY_ID=
OBJECT_STORAGE_SECRET_ACCESS_KEY=

# Email
EMAIL_PROVIDER_API_KEY=
EMAIL_FROM_ADDRESS=
EMAIL_WEBHOOK_SECRET=

# Observability
ERROR_TRACKING_DSN=
```

## 11. Final MVP release checklist

- [ ] Authentication and organization isolation pass adversarial tests.
- [ ] Hiring managers can approve versioned evaluation rubrics.
- [ ] Recruiters can batch-upload CVs with retry and duplicate handling.
- [ ] Recruiters can ingest candidates from CV, CSV, GitHub, portfolio, and authorized/candidate-provided profile data through one normalized pipeline.
- [ ] Candidate sources remain independently traceable and refreshable.
- [ ] Deterministic duplicates link safely; uncertain duplicates require human review.
- [ ] Candidate merge, undo, and split preserve applications, evidence provenance, reviews, and audit history.
- [ ] Candidate Evidence Profiles retain source provenance and corrections.
- [ ] Matching separates role fit from evidence confidence.
- [ ] Protected attributes cannot influence matching.
- [ ] Panel members can review, disagree, comment, and record a human shortlist decision.
- [ ] Approved email outreach sends exactly once and records delivery state.
- [ ] Candidate replies stop follow-ups and can update missing information after confirmation.
- [ ] Responsive Dashboard metrics reconcile with underlying applications.
- [ ] Candidate correction, export, deletion, retention, and opt-out paths work.
- [ ] CVs and candidate data never appear in logs or public storage.
- [ ] Queue retries and worker restarts do not duplicate evaluations or messages.
- [ ] CI, integration tests, Playwright tests, accessibility checks, and production build pass.
- [ ] A full synthetic production run completes from JD creation through recruiter-screening handoff.

## 12. Future roadmap after MVP

Only after the screening and handoff loop is reliable:

1. ATS integrations and bidirectional stage synchronization
2. Interview scheduling
3. Structured interview kits and panel scorecards
4. Candidate self-service portal
5. Approved GitHub enrichment using public/authorized data
6. Agency client workspaces and submissions
7. Talent rediscovery across historical candidates
8. Interview transcription and structured notes with explicit consent
9. AI-assisted interviews, only after a separate fairness, consent, and product review
10. Offer and onboarding integrations

AI interviewing is deliberately a separate future product decision, not an unfinished part of this MVP.
