-- Enforce case-insensitive email uniqueness at the database boundary.
-- Application code still canonicalizes with LOWER(...) on write; this index is authoritative.

UPDATE "users" SET "email" = LOWER("email");

DROP INDEX IF EXISTS "users_email_key";

CREATE UNIQUE INDEX "users_email_lower_key" ON "users" (LOWER("email"));
