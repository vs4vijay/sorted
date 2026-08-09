-- Enforce case-insensitive email uniqueness at the database boundary.
-- Application code still canonicalizes with LOWER(...) on write; this index is authoritative.
-- Explicit transaction: create the replacement index before dropping the old one so a failed
-- CREATE cannot leave users.email without uniqueness (Prisma does not wrap PG migrations by default).

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "users"
    GROUP BY LOWER("email")
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce case-insensitive email uniqueness: duplicate emails exist that differ only by case. Resolve them before redeploying.';
  END IF;
END $$;

UPDATE "users"
SET "email" = LOWER("email");

CREATE UNIQUE INDEX "users_email_lower_key"
ON "users" (LOWER("email"));

DROP INDEX IF EXISTS "users_email_key";

COMMIT;
