CREATE TABLE evidence_claims (
  id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE, source_id TEXT NOT NULL REFERENCES candidate_sources(id) ON DELETE CASCADE,
  claim_type TEXT NOT NULL CHECK(claim_type IN ('employment','education','project','skill','certification','language','logistics','other')),
  label TEXT NOT NULL, claim_value TEXT NOT NULL, claim_status TEXT NOT NULL CHECK(claim_status IN ('explicit','inferred','externally_evidenced','contradicted','unverified')),
  page_number INTEGER, section_label TEXT, excerpt TEXT, extractor_version TEXT NOT NULL, confidence DOUBLE PRECISION NOT NULL CHECK(confidence BETWEEN 0 AND 1),
  created_by_type TEXT NOT NULL CHECK(created_by_type IN ('model','human','import')), created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE evidence_claim_corrections (
  id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  claim_id TEXT NOT NULL REFERENCES evidence_claims(id) ON DELETE CASCADE, action TEXT NOT NULL CHECK(action IN ('confirm','reject','correct')),
  corrected_value TEXT, reason TEXT NOT NULL, created_by_id TEXT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX evidence_claims_org_candidate_idx ON evidence_claims(organization_id,candidate_id,created_at);
CREATE INDEX evidence_corrections_org_claim_idx ON evidence_claim_corrections(organization_id,claim_id,created_at);
