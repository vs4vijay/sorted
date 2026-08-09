import { executeQuery } from "@/lib/db";
import type { CandidatePrivacyDecisionInput, CandidatePrivacyRequestInput } from "../schemas/privacy";

type Query = (sql: string, params?: unknown[]) => Promise<unknown[]>;

export class CandidatePrivacyRepository {
  constructor(private query: Query = executeQuery) {}

  async list(org: string, candidateId: string) {
    return this.query(`SELECT id,request_type,status,details,decision_rationale,requested_at,decided_at,completed_at FROM candidate_privacy_requests WHERE organization_id=$1 AND candidate_id=$2 ORDER BY requested_at DESC`, [org, candidateId]) as Promise<Record<string, unknown>[]>;
  }

  async request(org: string, actor: string, input: CandidatePrivacyRequestInput) {
    const id = crypto.randomUUID();
    const rows = await this.query(`WITH candidate AS (SELECT id FROM candidates WHERE organization_id=$1 AND id=$2 AND profile_status<>'anonymized'), created AS (INSERT INTO candidate_privacy_requests(id,organization_id,candidate_id,request_type,status,details,requested_by_id) SELECT $3,$1,id,$4,'requested',$5,$6 FROM candidate RETURNING id) INSERT INTO audit_events(id,organization_id,actor_user_id,action,subject_type,subject_id,metadata) SELECT $7,$1,$6,'candidate_privacy.requested','candidate_privacy_request',$3,json_build_object('candidate_id',$2::TEXT,'request_type',$4::TEXT) FROM created RETURNING subject_id`, [org, input.candidateId, id, input.requestType, input.details, actor, crypto.randomUUID()]);
    if (!rows[0]) throw new Error("Candidate not found in this organization.");
    return id;
  }

  async decide(org: string, actor: string, input: CandidatePrivacyDecisionInput) {
    const rows = await this.query(`UPDATE candidate_privacy_requests SET status=$1,decision_rationale=$2,decided_by_id=$3,decided_at=CURRENT_TIMESTAMP WHERE organization_id=$4 AND candidate_id=$5 AND id=$6 AND status='requested' RETURNING request_type`, [input.decision === "approve" ? "approved" : "declined", input.rationale, actor, org, input.candidateId, input.requestId]) as {request_type:string}[];
    if (!rows[0]) throw new Error("Open privacy request not found in this organization.");
    await this.query(`INSERT INTO audit_events(id,organization_id,actor_user_id,action,subject_type,subject_id,metadata) VALUES($1,$2,$3,$4,'candidate_privacy_request',$5,json_build_object('candidate_id',$6::TEXT,'request_type',$7::TEXT,'rationale',$8::TEXT))`, [crypto.randomUUID(), org, actor, `candidate_privacy.${input.decision}d`, input.requestId, input.candidateId, rows[0].request_type, input.rationale]);
    if (input.decision === "approve" && rows[0].request_type === "deletion") return this.anonymize(org, actor, input.candidateId, input.requestId);
    if (input.decision === "approve" && rows[0].request_type === "export") await this.complete(org, actor, input.candidateId, input.requestId, "candidate_privacy.export_ready");
    return {documentKeys:[],audioKeys:[]};
  }

  private async anonymize(org: string, actor: string, candidateId: string, requestId: string) {
    const documents = await this.query(`SELECT d.storage_key FROM candidate_documents d JOIN candidate_sources s ON s.id=d.source_id AND s.organization_id=d.organization_id WHERE d.organization_id=$1 AND s.candidate_id=$2`, [org, candidateId]) as {storage_key:string}[];
    const audio = await this.query(`SELECT storage_key FROM candidate_audio_assets WHERE organization_id=$1 AND candidate_id=$2 AND storage_key IS NOT NULL`,[org,candidateId]) as {storage_key:string}[];
    await this.query(`WITH candidate AS (UPDATE candidates SET display_name='Deleted candidate',headline=NULL,location=NULL,profile_status='anonymized',updated_at=CURRENT_TIMESTAMP WHERE organization_id=$1 AND id=$2), identities AS (UPDATE candidate_identities SET normalized_value=NULL,raw_value_encrypted=NULL,value_fingerprint=('deleted-' || id),verified=FALSE WHERE organization_id=$1 AND candidate_id=$2), links AS (UPDATE external_profile_links SET profile_url='https://deleted.invalid',external_id=NULL WHERE organization_id=$1 AND candidate_id=$2), sources AS (UPDATE candidate_sources SET source_label='Deleted candidate source',warnings='[]'::JSON WHERE organization_id=$1 AND candidate_id=$2), docs AS (UPDATE candidate_documents d SET storage_key=('deleted/' || d.id),original_filename='deleted',byte_size=0,checksum=('deleted-' || d.id),parsed_text_markdown=NULL,pages_needing_ocr='[]'::JSON FROM candidate_sources s WHERE d.source_id=s.id AND d.organization_id=$1 AND s.organization_id=$1 AND s.candidate_id=$2), claims AS (UPDATE evidence_claims SET claim_value='[redacted]',excerpt=NULL WHERE organization_id=$1 AND candidate_id=$2), corrections AS (UPDATE evidence_claim_corrections SET corrected_value=NULL,reason='[redacted after approved deletion]' WHERE organization_id=$1 AND candidate_id=$2), evaluations AS (UPDATE candidate_evaluations SET evidence_snapshot=json_build_object('redacted',true,'reason','approved candidate deletion') WHERE organization_id=$1 AND candidate_id=$2), criterion_details AS (UPDATE criterion_evaluations c SET reasoning='[redacted after approved deletion]',evidence_claim_ids='[]'::JSON,gaps='[]'::JSON FROM candidate_evaluations e WHERE c.candidate_evaluation_id=e.id AND c.organization_id=$1 AND e.organization_id=$1 AND e.candidate_id=$2), messages AS (UPDATE outreach_messages m SET subject='[redacted]',body='[redacted after approved deletion]' FROM outreach_threads t WHERE m.thread_id=t.id AND m.organization_id=$1 AND t.organization_id=$1 AND t.candidate_id=$2), responses AS (UPDATE candidate_responses r SET body='[redacted after approved deletion]',parsed_suggestions='{}'::JSON FROM outreach_threads t WHERE r.thread_id=t.id AND r.organization_id=$1 AND t.organization_id=$1 AND t.candidate_id=$2), audio AS (UPDATE candidate_audio_assets SET storage_key=NULL,byte_size=NULL,status='deleted',updated_at=CURRENT_TIMESTAMP WHERE organization_id=$1 AND candidate_id=$2) UPDATE candidate_privacy_requests SET status='completed',completed_at=CURRENT_TIMESTAMP WHERE organization_id=$1 AND candidate_id=$2 AND id=$3`, [org, candidateId, requestId]);
    await this.query(`INSERT INTO audit_events(id,organization_id,actor_user_id,action,subject_type,subject_id,metadata) VALUES($1,$2,$3,'candidate_privacy.anonymized','candidate',$4,json_build_object('request_id',$5::TEXT,'historical_hiring_records_preserved',true,'private_documents_scheduled_for_deletion',true))`, [crypto.randomUUID(), org, actor, candidateId, requestId]);
    return {documentKeys:documents.map((row) => row.storage_key),audioKeys:audio.map((row)=>row.storage_key)};
  }

  private async complete(org:string, actor:string, candidateId:string, requestId:string, action:string) {
    await this.query(`WITH completed AS (UPDATE candidate_privacy_requests SET status='completed',completed_at=CURRENT_TIMESTAMP WHERE organization_id=$1 AND candidate_id=$2 AND id=$3 AND status='approved' RETURNING id) INSERT INTO audit_events(id,organization_id,actor_user_id,action,subject_type,subject_id,metadata) SELECT $4,$1,$5,$6,'candidate_privacy_request',$3,json_build_object('candidate_id',$2::TEXT) FROM completed`, [org,candidateId,requestId,crypto.randomUUID(),actor,action]);
  }

  async exportBundle(org:string,candidateId:string) {
    const candidates=await this.query(`SELECT id,display_name,headline,location,profile_status,created_at,updated_at FROM candidates WHERE organization_id=$1 AND id=$2`,[org,candidateId]);
    if(!candidates[0]) return null;
    const [claims,applications,sources,requests]=await Promise.all([
      this.query(`SELECT claim_type,label,claim_value,claim_status,confidence,created_at FROM evidence_claims WHERE organization_id=$1 AND candidate_id=$2 ORDER BY created_at`,[org,candidateId]),
      this.query(`SELECT position_id,stage,created_at FROM applications WHERE organization_id=$1 AND candidate_id=$2 ORDER BY created_at`,[org,candidateId]),
      this.query(`SELECT source_type,permission_method,status,source_label,imported_at FROM candidate_sources WHERE organization_id=$1 AND candidate_id=$2 ORDER BY imported_at`,[org,candidateId]),
      this.list(org,candidateId),
    ]);
    return {schemaVersion:"candidate-export.v1",exportedAt:new Date().toISOString(),candidate:candidates[0],evidenceClaims:claims,applications,sources,privacyRequests:requests};
  }
}
