-- AlterTable
-- Match scripts/init-db.ts: items.updated_at needs a default because the
-- application inserts via raw SQL and never sets updated_at explicitly
-- (Prisma's @updatedAt does not add a database-level default).
ALTER TABLE "items" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
