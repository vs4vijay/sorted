CREATE TABLE "candidate_privacy_requests" (
  "id" TEXT PRIMARY KEY,
  "organization_id" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "candidate_id" TEXT NOT NULL REFERENCES "candidates"("id"),
  "request_type" TEXT NOT NULL CHECK ("request_type" IN ('correction','export','deletion')),
  "status" TEXT NOT NULL DEFAULT 'requested' CHECK ("status" IN ('requested','approved','completed','declined')),
  "details" TEXT NOT NULL,
  "requested_by_id" TEXT NOT NULL,
  "requested_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decided_by_id" TEXT,
  "decided_at" TIMESTAMP,
  "decision_rationale" TEXT,
  "completed_at" TIMESTAMP
);
CREATE INDEX "candidate_privacy_requests_org_candidate_idx" ON "candidate_privacy_requests"("organization_id","candidate_id","requested_at");
CREATE INDEX "candidate_privacy_requests_org_status_idx" ON "candidate_privacy_requests"("organization_id","status","requested_at");
