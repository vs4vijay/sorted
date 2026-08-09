CREATE TABLE candidate_communication_preferences (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  candidate_id TEXT NOT NULL REFERENCES candidates(id),
  channel TEXT NOT NULL,
  language_code TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('opted_in','withdrawn')),
  source TEXT NOT NULL,
  recorded_by_id TEXT NOT NULL,
  recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  withdrawn_at TIMESTAMP,
  UNIQUE(organization_id,candidate_id,channel,language_code)
);
CREATE INDEX candidate_communication_preferences_org_candidate_idx ON candidate_communication_preferences(organization_id,candidate_id,status);

CREATE TABLE candidate_audio_assets (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  candidate_id TEXT NOT NULL REFERENCES candidates(id),
  message_id TEXT NOT NULL REFERENCES outreach_messages(id),
  text_hash TEXT NOT NULL,
  text_approval_version INTEGER NOT NULL,
  language_code TEXT NOT NULL,
  voice TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'generating' CHECK(status IN ('generating','ready','simulated','failed','invalidated')),
  provider TEXT,
  model TEXT,
  schema_version TEXT NOT NULL,
  provider_request_id TEXT,
  storage_key TEXT,
  media_type TEXT,
  byte_size INTEGER,
  normalized_error TEXT,
  generated_by_id TEXT NOT NULL,
  generated_at TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  invalidated_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX candidate_audio_assets_org_message_idx ON candidate_audio_assets(organization_id,message_id,created_at);
CREATE INDEX candidate_audio_assets_org_candidate_idx ON candidate_audio_assets(organization_id,candidate_id,status);
