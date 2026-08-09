ALTER TABLE "candidate_privacy_requests" ALTER COLUMN "requested_by_id" DROP NOT NULL;
ALTER TABLE "candidate_privacy_requests" ADD COLUMN "request_source" TEXT NOT NULL DEFAULT 'recruiter_recorded';

CREATE TABLE "candidate_privacy_access_tokens" (
  "id" TEXT PRIMARY KEY,
  "organization_id" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "candidate_id" TEXT NOT NULL REFERENCES "candidates"("id") ON DELETE CASCADE,
  "token_hash" TEXT NOT NULL UNIQUE,
  "expires_at" TIMESTAMP NOT NULL,
  "created_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_used_at" TIMESTAMP,
  "revoked_at" TIMESTAMP
);
CREATE INDEX "candidate_privacy_access_tokens_org_candidate_idx" ON "candidate_privacy_access_tokens"("organization_id","candidate_id","expires_at");
