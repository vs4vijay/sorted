CREATE TABLE "rate_limit_events" (
  "id" TEXT PRIMARY KEY,
  "organization_id" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "actor_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "rate_limit_events_scope_idx"
  ON "rate_limit_events"("organization_id", "actor_id", "action", "created_at");
