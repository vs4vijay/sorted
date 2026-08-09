import { executeQuery } from "@/lib/db";
import type { EvidenceClaimInput, EvidenceReviewInput } from "../schemas/evidence-profile";

type Query = (sql: string, params?: unknown[]) => Promise<unknown[]>;
export class EvidenceProfileRepository {
  constructor(private query: Query = executeQuery) {}

  async getProfile(organizationId: string, candidateId: string) {
    const candidates = await this.query(`SELECT c.* FROM candidates c WHERE c.organization_id=$1 AND c.id=$2 AND c.merged_into_id IS NULL`, [organizationId, candidateId]);
    if (!candidates[0]) return null;
    const claims = await this.query(`SELECT ec.*,s.source_label,s.source_type,d.original_filename,cr.action AS latest_review_action,cr.corrected_value,cr.reason AS review_reason,cr.created_at AS reviewed_at FROM evidence_claims ec JOIN candidate_sources s ON s.id=ec.source_id AND s.organization_id=ec.organization_id LEFT JOIN candidate_documents d ON d.source_id=s.id AND d.organization_id=s.organization_id LEFT JOIN LATERAL (SELECT action,corrected_value,reason,created_at FROM evidence_claim_corrections WHERE organization_id=ec.organization_id AND claim_id=ec.id ORDER BY created_at DESC LIMIT 1) cr ON TRUE WHERE ec.organization_id=$1 AND ec.candidate_id=$2 ORDER BY CASE ec.claim_type WHEN 'employment' THEN 1 WHEN 'skill' THEN 2 WHEN 'project' THEN 3 WHEN 'education' THEN 4 ELSE 5 END,ec.created_at`, [organizationId, candidateId]);
    const sources = await this.query(`SELECT id,source_label,source_type,permission_method,imported_at FROM candidate_sources WHERE organization_id=$1 AND candidate_id=$2 ORDER BY imported_at DESC`, [organizationId, candidateId]);
    return { candidate: candidates[0] as Record<string, unknown>, claims: claims as Record<string, unknown>[], sources: sources as Record<string, unknown>[] };
  }

  async addClaim(organizationId: string, actorId: string, input: EvidenceClaimInput) {
    const sourceRows = input.sourceId
      ? await this.query(`SELECT id FROM candidate_sources WHERE organization_id=$1 AND candidate_id=$2 AND id=$3`, [organizationId,input.candidateId,input.sourceId])
      : await this.query(`SELECT id FROM candidate_sources WHERE organization_id=$1 AND candidate_id=$2 ORDER BY imported_at DESC LIMIT 1`, [organizationId,input.candidateId]);
    const sourceId=(sourceRows[0] as {id?:string}|undefined)?.id;
    if (!sourceId) throw new Error("Choose a source belonging to this candidate.");
    const claimId=crypto.randomUUID();
    await this.query(`WITH c AS (INSERT INTO evidence_claims(id,organization_id,candidate_id,source_id,claim_type,label,claim_value,claim_status,page_number,section_label,excerpt,extractor_version,confidence,created_by_type) SELECT $1,$2,id,$3,$4,$5,$6,$7,$8,$9,$10,'human.v1',$11,'human' FROM candidates WHERE organization_id=$2 AND id=$12 AND merged_into_id IS NULL RETURNING id) INSERT INTO audit_events(id,organization_id,actor_user_id,action,subject_type,subject_id,metadata) SELECT $13,$2,$14,'evidence_claim.added','evidence_claim',$1,json_build_object('candidate_id',$12::TEXT,'claim_type',$4::TEXT) WHERE EXISTS(SELECT 1 FROM c)`,[claimId,organizationId,sourceId,input.claimType,input.label,input.value,input.status,input.pageNumber??null,input.section??null,input.excerpt??null,input.confidence,input.candidateId,crypto.randomUUID(),actorId]);
  }

  async reviewClaim(organizationId:string,actorId:string,input:EvidenceReviewInput){
    const rows=await this.query(`SELECT id FROM evidence_claims WHERE organization_id=$1 AND candidate_id=$2 AND id=$3`,[organizationId,input.candidateId,input.claimId]);
    if(!rows[0]) throw new Error("Evidence claim was not found in this organization.");
    await this.query(`WITH r AS (INSERT INTO evidence_claim_corrections(id,organization_id,candidate_id,claim_id,action,corrected_value,reason,created_by_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)),u AS (UPDATE candidates SET profile_status='reviewed',updated_at=CURRENT_TIMESTAMP WHERE organization_id=$2 AND id=$3) INSERT INTO audit_events(id,organization_id,actor_user_id,action,subject_type,subject_id,metadata) VALUES($9,$2,$8,$10,'evidence_claim',$4,json_build_object('candidate_id',$3::TEXT,'original_preserved',true))`,[crypto.randomUUID(),organizationId,input.candidateId,input.claimId,input.action,input.correctedValue??null,input.reason,actorId,crypto.randomUUID(),`evidence_claim.${input.action}ed`]);
  }
}
