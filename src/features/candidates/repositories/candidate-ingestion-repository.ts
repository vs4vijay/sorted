import { executeQuery } from "@/lib/db";
import type { CandidateExtraction } from "../schemas/ingestion";
type Query = (sql: string, params?: unknown[]) => Promise<unknown[]>;
export class CandidateIngestionRepository {
  constructor(private query: Query = executeQuery) {}
  async checksumExists(org: string, checksum: string) {
    const rows = (await this.query(
      "SELECT c.id,c.display_name FROM candidate_documents d JOIN candidate_sources s ON s.id=d.source_id JOIN candidates c ON c.id=s.candidate_id WHERE d.organization_id=$1 AND d.checksum=$2 LIMIT 1",
      [org, checksum],
    )) as { id: string; display_name: string }[];
    return rows[0] ?? null;
  }
  async createRun(input: {
    id: string;
    organizationId: string;
    positionId?: string;
    count: number;
    actorId: string;
    auditId: string;
  }) {
    await this.query(
      `WITH r AS (INSERT INTO ingestion_runs(id,organization_id,position_id,source_type,status,total_count,created_by_id) VALUES($1,$2,$3,'cv_batch','processing',$4,$5)) INSERT INTO audit_events(id,organization_id,actor_user_id,action,subject_type,subject_id,metadata) VALUES($6,$2,$5,'candidate_import.started','ingestion_run',$1,json_build_object('document_count',$4,'position_scoped',$3::TEXT IS NOT NULL))`,
      [
        input.id,
        input.organizationId,
        input.positionId ?? null,
        input.count,
        input.actorId,
        input.auditId,
      ],
    );
  }
  async createDocument(input: {
    organizationId: string;
    runId: string;
    sourceId: string;
    documentId: string;
    storageKey: string;
    filename: string;
    mediaType: string;
    byteSize: number;
    checksum: string;
    actorId: string;
  }) {
    await this.query(
      `WITH s AS (INSERT INTO candidate_sources(id,organization_id,ingestion_run_id,source_type,permission_method,status,source_label,imported_by_id) VALUES($1,$2,$3,'cv_upload','recruiter_provided','uploaded',$4,$5)) INSERT INTO candidate_documents(id,organization_id,source_id,storage_key,original_filename,media_type,byte_size,checksum,malware_scan_status) VALUES($6,$2,$1,$7,$4,$8,$9,$10,'passed_signature_scan')`,
      [
        input.sourceId,
        input.organizationId,
        input.runId,
        input.filename,
        input.actorId,
        input.documentId,
        input.storageKey,
        input.mediaType,
        input.byteSize,
        input.checksum,
      ],
    );
  }
  async getDocument(org: string, documentId: string) {
    const rows = await this.query(
      `SELECT d.*,s.status,s.ingestion_run_id,s.source_label,s.candidate_id,r.position_id,r.created_by_id FROM candidate_documents d JOIN candidate_sources s ON s.id=d.source_id JOIN ingestion_runs r ON r.id=s.ingestion_run_id WHERE d.organization_id=$1 AND d.id=$2`,
      [org, documentId],
    );
    return rows[0] as Record<string, unknown> | undefined;
  }
  async markExtracting(org: string, sourceId: string) {
    await this.query(
      `UPDATE candidate_sources SET status='extracting' WHERE organization_id=$1 AND id=$2 AND status IN ('uploaded','scanning','failed')`,
      [org, sourceId],
    );
  }
  async complete(input: {
    org: string;
    documentId: string;
    sourceId: string;
    runId: string;
    positionId?: string;
    actorId: string;
    candidate: CandidateExtraction;
    markdown: string | null;
    pageCount: number | null;
    pdfType: string | null;
    pages: number[];
    extractor: string;
    version: string;
    confidence: number | null;
    processingMs: number | null;
    status: "parsed" | "needs_review";
    execution: {
      provider: string;
      model: string;
      promptVersion: string;
      schemaVersion: string;
      requestId?: string;
      latencyMs: number;
      status: string;
      error?: unknown;
    };
  }) {
    const candidateId = crypto.randomUUID();
    const executionId = crypto.randomUUID();
    const auditId = crypto.randomUUID();
    await this.query(
      `WITH c AS (INSERT INTO candidates(id,organization_id,display_name,headline,location,profile_status) VALUES($1,$2,$3,$4,$5,$6)), u AS (UPDATE candidate_sources SET candidate_id=$1,status=$7,warnings=$8::JSON WHERE id=$9 AND organization_id=$2), d AS (UPDATE candidate_documents SET parsed_text_markdown=$10,page_count=$11,pdf_type=$12,pages_needing_ocr=$13::JSON,extractor=$14,extractor_version=$15,extraction_confidence=$16,processing_time_ms=$17 WHERE id=$18 AND organization_id=$2), e AS (INSERT INTO provider_executions(id,organization_id,provider,operation,model,prompt_version,schema_version,provider_request_id,latency_ms,status,normalized_error) VALUES($19,$2,$20,'candidate.extract',$21,$22,$23,$24,$25,$26,$27::JSON)), a AS (INSERT INTO applications(id,organization_id,candidate_id,position_id,stage,created_by_id) SELECT $28,$2,$1,$29,'applied',$30 WHERE $29::TEXT IS NOT NULL ON CONFLICT(organization_id,candidate_id,position_id) DO NOTHING), r AS (UPDATE ingestion_runs SET completed_count=completed_count+1,updated_at=CURRENT_TIMESTAMP,status=CASE WHEN completed_count+failed_count+1>=total_count THEN 'completed' ELSE status END WHERE id=$31 AND organization_id=$2) INSERT INTO audit_events(id,organization_id,actor_user_id,action,subject_type,subject_id,metadata) VALUES($32,$2,$30,'candidate_source.parsed','candidate_source',$9,json_build_object('candidate_id',$1::TEXT,'processing_status',$7::TEXT,'extraction_mode',$26::TEXT))`,
      [
        candidateId,
        input.org,
        input.candidate.displayName,
        input.candidate.headline,
        input.candidate.location,
        input.status === "parsed" ? "unreviewed" : "needs_review",
        input.status,
        JSON.stringify(input.candidate.processingWarnings),
        input.sourceId,
        input.markdown,
        input.pageCount,
        input.pdfType,
        JSON.stringify(input.pages),
        input.extractor,
        input.version,
        input.confidence,
        input.processingMs,
        input.documentId,
        executionId,
        input.execution.provider,
        input.execution.model,
        input.execution.promptVersion,
        input.execution.schemaVersion,
        input.execution.requestId ?? null,
        input.execution.latencyMs,
        input.execution.status,
        JSON.stringify(input.execution.error ?? null),
        crypto.randomUUID(),
        input.positionId ?? null,
        input.actorId,
        input.runId,
        auditId,
      ],
    );
    for (const [type, values] of [
      ["email", input.candidate.emails],
      ["phone", input.candidate.phones],
    ] as const)
      for (const value of values) {
        const normalized =
          type === "email"
            ? value.trim().toLowerCase()
            : value.replace(/\D/g, "");
        const fingerprint = await crypto.subtle
          .digest(
            "SHA-256",
            new TextEncoder().encode(`${input.org}:${type}:${normalized}`),
          )
          .then((v) => Buffer.from(v).toString("hex"));
        const existing = (await this.query(
          `SELECT candidate_id FROM candidate_identities WHERE organization_id=$1 AND identity_type=$2 AND value_fingerprint=$3 LIMIT 1`,
          [input.org, type, fingerprint],
        )) as { candidate_id: string }[];
        if (existing[0] && existing[0].candidate_id !== candidateId) {
          await this.query(
            `INSERT INTO duplicate_reviews(id,organization_id,candidate_id,possible_candidate_id,classification,confidence,signals) VALUES($1,$2,$3,$4,'possible_duplicate',0.98,$5::JSON)`,
            [
              crypto.randomUUID(),
              input.org,
              candidateId,
              existing[0].candidate_id,
              JSON.stringify([`Exact normalized ${type}`]),
            ],
          );
        } else
          await this.query(
            `INSERT INTO candidate_identities(id,organization_id,candidate_id,identity_type,normalized_value,value_fingerprint,source_id) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
            [
              crypto.randomUUID(),
              input.org,
              candidateId,
              type,
              normalized,
              fingerprint,
              input.sourceId,
            ],
          );
      }
    return candidateId;
  }
  async fail(
    org: string,
    documentId: string,
    sourceId: string,
    runId: string,
    message: string,
  ) {
    await this.query(
      `WITH s AS (UPDATE candidate_sources SET status='failed',warnings=$1::JSON WHERE id=$2 AND organization_id=$3),r AS (UPDATE ingestion_runs SET failed_count=failed_count+1,updated_at=CURRENT_TIMESTAMP,status=CASE WHEN completed_count+failed_count+1>=total_count THEN 'completed_with_errors' ELSE status END WHERE id=$4 AND organization_id=$3) UPDATE candidate_documents SET parsed_text_markdown=NULL WHERE id=$5 AND organization_id=$3`,
      [JSON.stringify([message]), sourceId, org, runId, documentId],
    );
  }
  async listCandidates(org: string) {
    return this.query(
      `SELECT c.*,COUNT(s.id)::INT AS source_count,MAX(s.status) AS latest_status,(SELECT COUNT(*)::INT FROM applications a WHERE a.organization_id=c.organization_id AND a.candidate_id=c.id) AS application_count FROM candidates c LEFT JOIN candidate_sources s ON s.organization_id=c.organization_id AND s.candidate_id=c.id WHERE c.organization_id=$1 AND c.merged_into_id IS NULL GROUP BY c.id ORDER BY c.created_at DESC`,
      [org],
    ) as Promise<Record<string, unknown>[]>;
  }
  async countCandidates(org:string){const rows=await this.query(`SELECT COUNT(*)::INT AS count FROM candidates WHERE organization_id=$1 AND merged_into_id IS NULL`,[org]) as {count:number}[];return Number(rows[0]?.count??0)}
  async listRuns(org: string) {
    return this.query(
      `SELECT r.*,p.title AS position_title FROM ingestion_runs r LEFT JOIN positions p ON p.id=r.position_id AND p.organization_id=r.organization_id WHERE r.organization_id=$1 ORDER BY r.created_at DESC LIMIT 8`,
      [org],
    ) as Promise<Record<string, unknown>[]>;
  }
  async getCandidate(
    org: string,
    id: string,
  ): Promise<
    (Record<string, unknown> & { sources: Record<string, unknown>[] }) | null
  > {
    const rows = (await this.query(
      `SELECT * FROM candidates WHERE organization_id=$1 AND id=$2 AND merged_into_id IS NULL`,
      [org, id],
    )) as Record<string, unknown>[];
    if (!rows[0]) return null;
    const sources = (await this.query(
      `SELECT s.*,d.id AS document_id,d.storage_key,d.original_filename,d.page_count,d.pdf_type,d.extractor,d.extractor_version,d.malware_scan_status FROM candidate_sources s LEFT JOIN candidate_documents d ON d.source_id=s.id AND d.organization_id=s.organization_id WHERE s.organization_id=$1 AND s.candidate_id=$2 ORDER BY s.imported_at DESC`,
      [org, id],
    )) as Record<string, unknown>[];
    return { ...rows[0], sources };
  }
  async addExternalSource(input: {
    org: string;
    candidateId: string;
    actor: string;
    provider: string;
    url: string;
  }) {
    const runId = crypto.randomUUID(),
      sourceId = crypto.randomUUID();
    await this.query(
      `WITH r AS (INSERT INTO ingestion_runs(id,organization_id,source_type,status,total_count,completed_count,created_by_id) VALUES($1,$2,'external_profile','completed',1,1,$3)),s AS (INSERT INTO candidate_sources(id,organization_id,candidate_id,ingestion_run_id,source_type,permission_method,status,source_label,imported_by_id) SELECT $4,$2,id,$1,$5,'recruiter_provided_reference','parsed',$6,$3 FROM candidates WHERE id=$7 AND organization_id=$2 AND merged_into_id IS NULL RETURNING id),l AS (INSERT INTO external_profile_links(id,organization_id,candidate_id,source_id,provider,profile_url,retrieval_method) SELECT $8,$2,$7,$4,$5,$6,'reference_only' WHERE EXISTS(SELECT 1 FROM s)) INSERT INTO audit_events(id,organization_id,actor_user_id,action,subject_type,subject_id,metadata) SELECT $9,$2,$3,'candidate_source.added','candidate_source',$4,json_build_object('provider',$5::TEXT,'retrieval_method','reference_only') WHERE EXISTS(SELECT 1 FROM s)`,
      [
        runId,
        input.org,
        input.actor,
        sourceId,
        input.provider,
        input.url,
        input.candidateId,
        crypto.randomUUID(),
        crypto.randomUUID(),
      ],
    );
  }
  async listDuplicates(org: string) {
    return this.query(
      `SELECT d.*,c.display_name AS candidate_name,p.display_name AS possible_name FROM duplicate_reviews d JOIN candidates c ON c.id=d.candidate_id JOIN candidates p ON p.id=d.possible_candidate_id WHERE d.organization_id=$1 AND d.status='pending' ORDER BY d.created_at`,
      [org],
    ) as Promise<Record<string, unknown>[]>;
  }
  async merge(org: string, reviewId: string, actor: string) {
    const rows = (await this.query(
      `SELECT * FROM duplicate_reviews WHERE id=$1 AND organization_id=$2 AND status='pending'`,
      [reviewId, org],
    )) as { candidate_id: string; possible_candidate_id: string }[];
    const review = rows[0];
    if (!review) return false;
    await this.query(
      `WITH moved_sources AS (UPDATE candidate_sources SET candidate_id=$1 WHERE organization_id=$2 AND candidate_id=$3), moved_apps AS (UPDATE applications SET candidate_id=$1 WHERE organization_id=$2 AND candidate_id=$3 AND NOT EXISTS(SELECT 1 FROM applications x WHERE x.organization_id=$2 AND x.candidate_id=$1 AND x.position_id=applications.position_id)), merged AS (UPDATE candidates SET merged_into_id=$1,updated_at=CURRENT_TIMESTAMP WHERE organization_id=$2 AND id=$3), resolved AS (UPDATE duplicate_reviews SET status='merged',resolved_by_id=$4,resolved_at=CURRENT_TIMESTAMP WHERE id=$5 AND organization_id=$2) INSERT INTO audit_events(id,organization_id,actor_user_id,action,subject_type,subject_id,metadata) VALUES($6,$2,$4,'candidate.merged','candidate',$3,json_build_object('canonical_candidate_id',$1::TEXT,'reversible',true))`,
      [
        review.possible_candidate_id,
        org,
        review.candidate_id,
        actor,
        reviewId,
        crypto.randomUUID(),
      ],
    );
    return true;
  }
  async split(org: string, candidateId: string, actor: string) {
    const rows = await this.query(
      `UPDATE candidates SET merged_into_id=NULL,updated_at=CURRENT_TIMESTAMP WHERE organization_id=$1 AND id=$2 AND merged_into_id IS NOT NULL RETURNING id`,
      [org, candidateId],
    );
    if (!rows[0]) return false;
    await this.query(
      `INSERT INTO audit_events(id,organization_id,actor_user_id,action,subject_type,subject_id,metadata) VALUES($1,$2,$3,'candidate.merge_undone','candidate',$4,json_build_object('applications_preserved',true))`,
      [crypto.randomUUID(), org, actor, candidateId],
    );
    return true;
  }
}
