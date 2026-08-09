# Sorted operations runbook

Use synthetic candidate data for every drill. Never paste CV text, communication content, credentials, or database URLs into tickets or logs.

## Provider incident and kill switches

Set `SARVAM_ENABLED=false`, `EMAIL_DELIVERY_ENABLED=false`, or `MALWARE_SCANNER_ENABLED=false` in the server environment and restart the web and worker services. Sarvam and email then use visibly simulated adapters. Production deployments must keep a real scanner enabled before accepting CVs.

## Worker restart drill

1. Import a synthetic CV and record the organization-scoped job ID.
2. Stop the worker while the job is pending or retryable, then restart it with `bun run dev:worker`.
3. Confirm the job completes once, the document produces one immutable source, and no duplicate candidate/application is created.
4. Inspect `/settings/operations`; stuck and failed counts must return to zero.

## PostgreSQL restore drill

1. Create an encrypted provider snapshot in an isolated non-production database.
2. Restore it to a new database, never over the active database.
3. Run `bun run db:generate`, `bun run build`, then check `/api/ready` against the restored database.
4. Reconcile counts for organizations, candidates, evidence claims, evaluations, decisions, outreach messages, audit events, and jobs.
5. Verify a cross-organization candidate/document request still returns 404. Record snapshot ID, duration, actor, and discrepancies outside this repository.

Do not manually replay completed jobs or sent messages. Fix the dependency, retain the original idempotency key, and retry only failed/retryable work. Quarantined documents stay inaccessible until a clean scanner verdict is persisted.
