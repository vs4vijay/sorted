ALTER TYPE "DocumentProcessingStatus" ADD VALUE IF NOT EXISTS 'quarantined';

ALTER TABLE "candidate_documents"
  ADD COLUMN IF NOT EXISTS "malware_scan_provider" TEXT,
  ADD COLUMN IF NOT EXISTS "malware_scan_version" TEXT,
  ADD COLUMN IF NOT EXISTS "malware_scan_request_id" TEXT,
  ADD COLUMN IF NOT EXISTS "malware_scan_error" TEXT,
  ADD COLUMN IF NOT EXISTS "malware_scanned_at" TIMESTAMP(3);
