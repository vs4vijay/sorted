# Sorted — Vertical-Slice Plan to Production

## Purpose

This plan takes Sorted from its current UI-first hackathon prototype to a live, secure, observable product. Work is organized as **vertical slices**: every phase delivers a usable customer outcome through the UI, domain layer, database, integrations, tests, and operations. A phase is complete only when its end-to-end acceptance criteria pass.

## Current state

### Already available

- Responsive Dashboard, AI Inbox, and Workflows views
- A reusable workflow composer
- Multilingual demo conversation and simulated AI interpretation
- Visual workflow canvas and simulated execution progress
- Human-approval concept
- Sarvam touchpoints for Saaras, Sarvam-105B, and Bulbul
- Next.js 16, React 19, Bun, Tailwind CSS, PGlite/PostgreSQL abstraction, and a PostgreSQL job-queue foundation
- Production build succeeds

### Still pending

- Authentication, account/workspace isolation, and onboarding
- Sorted-specific database schema, migrations/init scripts, seed data, and repositories
- Server-backed Dashboard, Inbox, Workflows, runs, approvals, and notifications
- Real Sarvam authentication and API adapters
- Audio upload/recording, transcription, and generated voice playback
- Durable workflow execution, retries, idempotency, and recovery
- A real inbound/outbound customer channel
- Security hardening, privacy controls, retention, and audit logging
- End-to-end, integration, accessibility, and failure-path tests
- Production infrastructure, CI/CD, monitoring, alerting, backups, and runbooks

## Product invariant

Dashboard, AI Inbox, and Workflows are three views of the same domain state:

```text
Conversation → Understanding → Suggested action → Workflow → Run → Approval → Outcome
       ↑                                                                  │
       └──────────────────── updated conversation state ──────────────────┘
```

No slice should introduce a second source of truth for any part of this lifecycle.

## Definition of done for every slice

Each vertical slice must include:

- A user-visible outcome that can be demonstrated without database editing
- Typed domain contracts and Zod validation at external boundaries
- Parameterized SQL through `executeQuery()` and PGlite/PostgreSQL compatibility
- Loading, empty, success, validation-error, provider-error, and retry states
- Authorization checks at the server boundary
- Business-readable audit events for important actions
- Unit/integration coverage for core rules and Playwright coverage for the happy path
- No secrets, database files, customer exports, or generated customer media committed to Git
- Relevant documentation and `.env.example` updates
- A successful `bun run build`

---

## Slice 0 — Production foundation and safe deployment

### User outcome

A private preview deployment is reachable by the team, has a real PostgreSQL database, and can be promoted safely without exposing secrets or customer data.

### Scope

#### Application

- Choose a hosting target for the Next.js app and a compatible long-running worker target.
- Provision development, preview, and production environments.
- Provision managed PostgreSQL with TLS, automated backups, and point-in-time recovery if available.
- Add `/api/health` and `/api/ready` endpoints. Readiness must verify required configuration and database connectivity without exposing sensitive details.
- Add typed environment validation at startup.
- Separate browser-safe environment variables from server-only credentials.

#### Delivery

- Add CI for dependency installation, lint/type checks, production build, and tests.
- Protect `main`; require passing CI before deployment.
- Configure preview deployments for pull requests and production deployment from `main`.
- Add a migration/deployment procedure that cannot apply production schema changes from a developer laptop accidentally.

#### Baseline observability

- Structured server logs with request/correlation IDs.
- Error tracking for browser, server, and worker failures.
- Basic uptime monitoring for health and readiness endpoints.
- Redact authorization headers, API keys, message content, phone numbers, addresses, transcripts, and audio URLs from logs.

### Deliverables

- Hosting and database environments
- CI/CD workflow
- Environment schema and updated `.env.example`
- Health/readiness endpoints
- Deployment and rollback runbook

### Acceptance criteria

- A preview URL deploys automatically and loads the current Sorted UI.
- Production database credentials exist only in the deployment secret store.
- A failed build or test prevents deployment.
- Health checks distinguish a running process from a database-ready application.
- Rollback to the previous application release is documented and tested once.

---

## Slice 1 — Sign in, workspace onboarding, and tenant isolation

### User outcome

A business owner can sign in, create a workspace, enter basic business details, and see a private empty Sorted workspace that no other account can access.

### Scope

#### Domain and data

- Add `users`, `workspaces`, `workspace_members`, and `business_profiles`.
- Include `workspace_id` on every future business-domain table.
- Define owner/member roles and a minimal authorization policy.
- Add database constraints and indexes for workspace-scoped lookups.

#### Experience

- Sign-in/sign-out flow.
- First-run onboarding for business name, timezone, default language, service category, and approval preference.
- Workspace-aware shell and settings.
- Empty Dashboard, Inbox, and Workflows states with a clear next action.

#### Server boundaries

- Resolve the active user and workspace server-side.
- Reject unauthenticated API/server-action access.
- Require workspace ownership or membership for every domain query.
- Never accept an unchecked `workspace_id` from the browser as authorization.

### Acceptance criteria

- A new user completes onboarding and lands in their own workspace.
- Two test users cannot read or mutate each other’s data by changing URLs or request payloads.
- Sign-out invalidates access to protected pages and APIs.
- Workspace timezone and language persist after refresh.
- Playwright covers sign in, onboarding, sign out, and cross-tenant denial.

---

## Slice 2 — Persistent multilingual Inbox with seeded conversations

### User outcome

The owner can open Inbox, browse persisted customer conversations, read messages, filter by operational status, and see the same data after refreshing or signing in elsewhere.

### Scope

#### Domain and data

- Add `customers`, `conversations`, `messages`, `conversation_intents`, `extracted_facts`, `suggested_actions`, and `notifications`.
- Model language, direction, channel, delivery state, message timestamps, and optional media metadata.
- Define statuses such as `needs_action`, `waiting_on_customer`, `ai_handled`, and `closed`.
- Replace starter `items` data and routes with Sorted repositories/services.
- Add deterministic demo seed data for Rahul, Priya, Ahmed, Sarah, and Meera.

#### Experience

- Load conversation list and selected conversation from the server.
- Persist filters and selected conversation in the URL where useful.
- Implement empty, loading, pagination, and error states.
- Mark conversations read and change operational status.
- Derive Dashboard attention counts from the same persisted records.

#### Architecture

- Introduce Sorted schemas, repositories, services, and fixture producers.
- Keep fixtures behind the same service contracts as database implementations.
- Use server components for initial reads; use client components only for interactive panes.

### Acceptance criteria

- Seeded conversations survive refresh and appear consistently in Inbox and Dashboard.
- Updating a conversation status changes Dashboard counts without editing fixtures.
- All reads and writes are workspace-scoped.
- Pagination/order is stable when messages share similar timestamps.
- Integration tests run against PGlite and verify the repository SQL.

---

## Slice 3 — Saaras voice transcription inside a conversation

### User outcome

The owner can record or upload a multilingual voice message, submit it for transcription, review the Saaras transcript and detected language, correct it if necessary, and attach it to a conversation.

### Scope

#### Sarvam adapter

- Implement a server-only Sarvam client with timeout, retry, cancellation, and normalized errors.
- Implement `SpeechToTextProvider` and a Saaras adapter.
- Store Sarvam request IDs, model/version metadata, duration, status, and language—not credentials.
- Add a fake provider for deterministic local and CI tests.

#### Media pipeline

- Browser recording with explicit microphone permission.
- File upload validation for MIME type, size, and duration.
- Private object storage with short-lived signed URLs.
- Transcription job states: `queued`, `processing`, `completed`, `failed`, and `cancelled`.
- Retention policy for source audio and a user-visible delete action.

#### Experience

- Recording/upload controls in AI Inbox.
- Progress and retry UI.
- Transcript, language, confidence/metadata when available, and correction workflow.
- Clear disclosure that audio is being processed by Sarvam.

### Acceptance criteria

- A Hindi/Hinglish sample can be recorded or uploaded and transcribed into a persisted message.
- Refreshing during transcription restores the correct job state.
- Invalid formats, oversized files, timeout, quota, and provider failure produce actionable errors.
- Deleting retained audio removes access while preserving an allowed corrected transcript and audit record.
- Automated tests use the fake provider; one protected smoke test validates the real sandbox integration.

---

## Slice 4 — Sarvam-105B conversation understanding and draft response

### User outcome

From a customer conversation, the owner can ask Sorted to identify intent, known and missing facts, a recommended next action, and a multilingual draft response grounded in the conversation and business profile.

### Scope

#### Reasoning contract

- Define a versioned structured output schema for intents, facts, missing fields, suggested actions, draft response, language, confidence, and safety flags.
- Implement `ConversationReasoningProvider` and a Sarvam-105B adapter.
- Validate every model response with Zod; reject or repair invalid structured output safely.
- Include only the minimum necessary conversation and business context.
- Add prompt/model versioning and normalized token/latency/cost metadata where available.

#### Experience

- Run/re-run understanding from AI Inbox.
- Persist and show current analysis separately from previous versions.
- Let the owner accept, edit, or reject a draft.
- Never send a generated draft automatically in this slice.
- Update Dashboard attention state based on persisted missing facts and suggestions.

#### Safety

- Treat conversation text as untrusted input; prevent it from overriding system/tool policy.
- Require approval for prices, promises, complaint resolutions, and outbound content.
- Do not invent business facts; visibly mark unknown information.

### Acceptance criteria

- Rahul’s message produces quote and booking intents plus the expected missing fields.
- Accepted/edited/rejected outcomes are persisted for future quality measurement.
- Invalid provider output cannot reach the UI as trusted structured data.
- Re-running analysis does not destroy the prior audit history.
- Failure falls back to a manual reply path without blocking the conversation.

---

## Slice 5 — Create and activate a real workflow from Inbox

### User outcome

The owner can turn Rahul’s suggested action into a persisted workflow, review its visual definition, test it against the conversation, and activate it.

### Scope

#### Domain and data

- Add `workflows`, `workflow_versions`, `workflow_nodes`, `workflow_edges`, and `workflow_triggers`.
- Define versioned node configuration schemas for trigger, reasoning, condition, draft, approval, voice, and send actions.
- Store published versions immutably; edits create a new draft version.
- Validate graph integrity: one trigger, reachable nodes, valid edges, no unsupported cycles, and valid node configuration.

#### Composer

- Move the existing composer to a reusable feature component.
- Accept typed context from Inbox, Dashboard, or an existing workflow.
- Use Sarvam-105B to propose a workflow definition from natural language, then validate it through the same graph schema.
- Allow manual review and modification before saving.
- Implement test mode that runs without customer-facing side effects.

### Acceptance criteria

- “When quote details are missing, ask for them” becomes a valid persisted workflow.
- The workflow can be tested with Rahul’s conversation and produces a previewed path and draft.
- Activation creates an immutable published version.
- Invalid or disconnected graphs cannot be activated.
- The activated workflow appears in Workflows and on relevant Dashboard counts.

---

## Slice 6 — Durable execution, runs, logs, and human approval

### User outcome

The owner can manually run an active workflow, watch persisted step progress, approve or reject its drafted response, recover from failures, and inspect understandable run history.

### Scope

#### Execution data

- Add `workflow_runs`, `workflow_run_steps`, `approvals`, `outbound_actions`, and `audit_events`.
- Snapshot the workflow version and relevant inputs at run start.
- Define state transitions and enforce them transactionally.
- Assign an idempotency key to every trigger and external side effect.

#### Worker

- Implement registered tasks for starting/resuming runs and executing supported nodes.
- Persist state before enqueueing the next step or invoking a side effect.
- Add retry policy with exponential backoff, maximum attempts, and terminal failure.
- Resume a run after approval without repeating completed actions.
- Add recovery for abandoned locks and worker restarts.

#### Experience

- Real-time or polling-based run progress.
- Canvas path highlighting based on persisted steps.
- Approval inbox with approve, edit-and-approve, and reject.
- Runs and business-readable logs, with technical detail behind disclosure.
- Retry/replay controls that explain their effects.

### Acceptance criteria

- A run survives browser refresh and worker restart.
- Approval pauses execution indefinitely without holding a database lock.
- Approving once cannot send or execute an action twice.
- Failed steps show a useful message and can be retried safely.
- Inbox state, notification state, workflow run, and Dashboard counts remain consistent.

---

## Slice 7 — Bulbul voice preview and approved voice response

### User outcome

The owner can preview an approved response in the customer’s language using Bulbul, choose text or voice delivery, and confirm the exact content before sending.

### Scope

#### Sarvam adapter

- Implement `TextToSpeechProvider` and a Bulbul adapter.
- Normalize voice, language, format, duration, request ID, and provider errors.
- Cache generated previews by safe content hash and configuration where policy permits.

#### Media and experience

- Voice/language selection with sensible defaults from the conversation.
- Audio preview, regenerate, and delete controls.
- Persist private generated media with expiry/retention rules.
- Link generated audio to the approval and outbound action.
- Prevent post-approval text mutation: changed text requires regeneration and reapproval.

### Acceptance criteria

- An approved Hindi/Hinglish response produces playable Bulbul audio.
- The owner can switch between text and voice before dispatch.
- Changed draft text invalidates the previous audio and approval.
- Bulbul failures preserve the approved text fallback.
- Generated audio is private and inaccessible after expiry/deletion.

---

## Slice 8 — First live customer channel

### User outcome

A real customer message enters Sorted, is processed into a conversation, triggers the quote workflow, pauses for approval, and receives exactly one approved text or voice response through the same channel.

### Channel choice

Select one channel for the first live slice. WhatsApp is the product-aligned default; a simpler web-chat or test channel may be used first if provider approval would threaten the hackathon deadline. Do not build multiple channels in parallel.

### Scope

- Define `ChannelAdapter` for inbound verification/parsing, outbound text/media, delivery receipts, and normalized errors.
- Add `channel_connections`, external identity mapping, inbound event records, and delivery attempts.
- Verify webhook signatures before reading payloads.
- Persist inbound events before processing and deduplicate by provider event ID.
- Resolve customer identity safely and support unknown contacts.
- Add connection/setup UI and a test-message flow.
- Feed inbound events through the existing conversation and workflow services—not channel-specific UI state.

### Acceptance criteria

- A real inbound message appears once in the correct workspace and conversation.
- Duplicate webhook deliveries do not duplicate messages or workflow runs.
- The active workflow reaches human approval and sends exactly one approved response.
- Delivery status updates the message timeline.
- Invalid signatures and cross-workspace identifiers are rejected and audited.

### Hackathon release gate

At the end of this slice, Sorted has a complete live loop and is demo-ready:

```text
Real multilingual message
→ Saaras when audio
→ Sarvam-105B understanding
→ Workflow trigger
→ Human approval
→ Text or Bulbul voice response
→ Delivered through the customer channel
```

---

## Slice 9 — Dashboard truth, notifications, and operational control

### User outcome

The Dashboard accurately reflects live conversation and workflow state, proactively identifies workflow opportunities, and lets the owner act without searching through the Inbox.

### Scope

- Replace every remaining hardcoded count/chart with server-backed queries.
- Define precise rules for needs attention, waiting on customer, active workflows, completed today, response time, and execution success.
- Add actionable notifications for approval, failure, overdue response, and successful completion.
- Add mark-read, dismiss, deep-link, and deduplication behavior.
- Generate automation opportunities from auditable behavior signals, initially through deterministic rules; use AI only where it adds value.
- Add workflow pause/resume and emergency-disable controls.

### Acceptance criteria

- Every summary card reconciles with its underlying records.
- Clicking a metric opens the corresponding filtered records.
- Notifications are not duplicated by retries or repeated events.
- The unanswered-quote insight can create a prefilled workflow through the shared composer.
- Pausing a workflow prevents new runs while preserving in-progress run state according to a documented policy.

---

## Slice 10 — Security, privacy, reliability, and public launch readiness

### User outcome

Customers can trust Sorted with business conversations, and operators can detect, diagnose, recover from, and communicate production incidents.

### Security and privacy

- Threat-model authentication, workspace isolation, webhook ingestion, prompt injection, media handling, approvals, and outbound sends.
- Add rate limits and abuse controls to login, uploads, model execution, workflow runs, and webhooks.
- Encrypt traffic and managed storage; document encryption-at-rest guarantees.
- Implement workspace export and deletion.
- Define retention for messages, transcripts, audio, provider payloads, logs, and audit events.
- Add secrets rotation and least-privilege service credentials.
- Review third-party data processing and user disclosure requirements.

### Reliability

- Define service-level indicators for inbound processing, model success, workflow completion, approval latency, and delivery success.
- Add dashboards and alerts for queue depth, stuck runs, provider errors, webhook failures, and database health.
- Test database restore, worker recovery, provider outage fallback, and channel retry behavior.
- Add dead-letter/reconciliation tooling for terminal events.
- Add feature flags and provider kill switches.

### Quality and launch

- Full Playwright coverage of the three primary demo flows and the real-channel loop.
- Accessibility audit for keyboard navigation, focus, labels, contrast, reduced motion, and screen-reader semantics.
- Responsive testing across supported viewport sizes.
- Load test inbound webhooks and workflow execution at expected launch volume.
- Complete privacy notice, terms, support contact, incident runbook, and customer-facing status communication path.
- Remove or gate inherited starter pages/routes such as Items and the technical Jobs dashboard.

### Acceptance criteria

- No critical/high findings remain from the launch security review.
- Backup restoration and a provider-outage drill succeed.
- Alerting detects a deliberately failed worker and stuck run.
- Workspace deletion removes or irreversibly anonymizes data according to policy.
- The full live loop passes in production using a designated test customer.
- A release owner signs off on product, engineering, security/privacy, and operations checklists.

---

## Recommended milestone sequence

| Milestone | Slices | Demonstrable result |
|---|---:|---|
| Private hosted preview | 0–2 | A signed-in owner sees persistent, isolated conversations and accurate Dashboard counts. |
| Sarvam intelligence demo | 3–4 | Voice becomes a transcript, and a conversation becomes structured understanding plus a safe draft. |
| Real workflow demo | 5–7 | A suggested workflow is created, executed durably, approved, and previewed with Bulbul voice. |
| Hackathon live loop | 8 | One real customer channel completes the multilingual message-to-response journey. |
| Launch candidate | 9–10 | Dashboard truth, operational controls, security, reliability, and compliance are ready for external users. |

## Scope discipline

Defer these until the first live loop is reliable:

- Multiple customer channels
- A general-purpose drag-and-drop automation platform
- Full customer CRM
- Knowledge-base authoring suite
- Advanced BI/analytics
- Autonomous outbound sending by default
- Marketplace/templates ecosystem
- Multiple AI providers in the UI
- Native mobile applications

## Suggested environment configuration

Names must be verified against the selected Sarvam SDK/API before implementation; do not guess production endpoints or model identifiers.

```dotenv
# Database
DATABASE_URL=

# Application/auth
APP_URL=
AUTH_SECRET=

# Sarvam (server-only)
SARVAM_API_KEY=

# Private media storage
OBJECT_STORAGE_BUCKET=
OBJECT_STORAGE_REGION=
OBJECT_STORAGE_ACCESS_KEY_ID=
OBJECT_STORAGE_SECRET_ACCESS_KEY=

# First customer channel
CHANNEL_WEBHOOK_SECRET=
CHANNEL_ACCESS_TOKEN=

# Observability
ERROR_TRACKING_DSN=
```

## Final go-live checklist

- [ ] Production environment and database are provisioned and backed up.
- [ ] Authentication and workspace isolation are verified.
- [ ] No demo fixtures appear in real customer workspaces.
- [ ] Saaras, Sarvam-105B, and Bulbul adapters pass sandbox and production smoke tests.
- [ ] One customer channel passes webhook, deduplication, delivery, and retry tests.
- [ ] Workflow execution is durable, idempotent, resumable, and auditable.
- [ ] Human approval is enforced for configured customer-facing actions.
- [ ] Customer media and transcripts follow the documented retention policy.
- [ ] Monitoring, alerts, kill switches, backup restoration, and incident runbooks are tested.
- [ ] Accessibility and responsive checks pass.
- [ ] CI, production build, integration tests, and Playwright tests pass.
- [ ] Privacy, terms, support, and deletion/export paths are available.
- [ ] A production test customer completes the full live loop successfully.
