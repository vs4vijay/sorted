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

Last updated: 2026-08-09 (Slice 3 end-to-end implementation in progress)

| Slice | Status | Evidence and remaining work |
|---|---|---|
| 0 — Reframe and foundations | Local implementation complete; deployment scaffolding in place, live deploy pending | Recruiting shell, synthetic fixtures, environment validation, health/readiness routes, redacted structured logging, and CI are implemented. `bun run lint` passes with 6 pre-existing warnings and `bun run build` passes. Playwright CLI verified Dashboard and Positions in Chrome with no console errors; captures: `.images/slice-0-dashboard-verified-2026-08-09.png` and `.images/slice-0-positions-verified-2026-08-09.png`. Render blueprint (`render.yaml`) defines web + worker services and managed Postgres with `DATABASE_URL` wiring; initial Prisma migration (`prisma/migrations/20260809000000_init`) applies via `prisma migrate deploy` in the web predeploy. Remaining: run the Render blueprint, verify `GET /api/health` and `GET /api/ready` on the live URL, and confirm backup behavior. |
| 1 — Organization and access | Complete for hackathon scope | Added Zod access contracts, explicit role permissions, organization-scoped access resolution, password-protected workspace sign-up and sign-in, sign-out with database session revocation, invitation-based panel-member sign-up, and the responsive Hiring Panel access screen. Passwords use salted scrypt hashes; opaque session and invitation tokens are stored only as hashes. Invitation acceptance, membership/role mutations, and organization creation remain append-audited and organization-scoped. Technical reviewers do not see panel-management, export, or candidate-import actions. Fourteen tests, TypeScript, lint (0 errors; 6 pre-existing warnings), and the production build pass. Playwright CLI verified sign-up → sign-out → sign-in in Chrome with 0 console errors; capture: `.images/slice-1-sign-up-sign-in-verified-2026-08-09.png`. Earlier CLI evidence verifies invitation acceptance, role restriction, mobile layout, and cross-tenant denial. Account recovery and persistent browser test files were explicitly deferred to prioritize the hackathon demo flow. |
| 2 — Position and rubric | Complete for hackathon scope | Added versioned, organization-scoped position/JD/rubric/criterion/panel/provider-execution data; strict Zod contracts; Sarvam-105B JSON-schema adapter; deterministic simulated fallback; provider metadata/error recording; position creation and structured rubric review; balanced-weight enforcement; human-only approval; append audit events; and approved screening state. 17 tests pass, lint has 0 errors (6 pre-existing warnings), PGlite schema initialization and production build pass. Playwright CLI verified setup → pasted backend JD → simulated structured rubric → explicit administrator approval in Chrome with 0 console errors; capture: `.images/slice-2-position-rubric-approved-2026-08-09.png`. Live Sarvam execution requires `SARVAM_API_KEY` in the server environment and was not used for the saved browser capture. Deferred within the slice: JD file upload and a rich criterion editor; pasted JD and manual-draft paths cover the hackathon flow. |
| 3 — Candidate ingestion | In progress | Started the schema-to-UI implementation for private PDF/DOCX batch ingestion, document validation, resumable processing, normalized candidate/source/document/run records, duplicate review, and Sarvam-backed extraction with deterministic fixtures. Validation evidence and the precise next pickup point will be recorded at completion. |
| 4–11 | Not started | Follow the slice order below. |

### Current handoff

- Start Slice 3 with candidate/document/source schemas and private storage boundaries, then add matching organization-scoped SQL to Prisma, the migration, and `scripts/init-db.ts` before wiring upload processing.
- Preserve the existing Slice 0 fixture UI while replacing fixture-only organization access incrementally with organization-scoped services.
- Use `SARVAM_API_KEY` supplied through the server environment. Slice 3 must retain deterministic extraction fixtures, normalize all provider output into versioned Sorted schemas, and label fallback output simulated. Use synthetic CVs in `data/` only for local validation and never commit derived private content.
- Do not mark Slice 0 fully complete until preview deployment, production PostgreSQL, and backup behavior have been verified in the target hosting environment.
- Deploy the Render blueprint (New > Blueprint in the Render dashboard, select this repo), then verify health/readiness on the live URL and confirm the free-tier PostgreSQL backup settings. Free Postgres expires after 30 days; switch to `basic-256mb` before then to keep the environment.

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
