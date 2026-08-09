import { executeQuery } from '@/lib/db';
import { calculateEvaluation, type CriterionJudgment } from '../schemas/evaluation';
import type { EvaluationProviderResult } from '../sarvam/criterion-evaluation-provider';
type Query = (sql: string, params?: unknown[]) => Promise<unknown[]>;

export class EvaluationRepository {
  constructor(private query: Query = executeQuery) {}
  async context(organizationId: string, candidateId: string, positionId: string) {
    const rubrics = (await this.query(
      `SELECT r.id,r.version FROM evaluation_rubrics r WHERE r.organization_id=$1 AND r.position_id=$2 AND r.status='approved' ORDER BY r.version DESC LIMIT 1`,
      [organizationId, positionId],
    )) as { id: string; version: number }[];
    if (!rubrics[0]) throw new Error('Approve the position rubric before matching candidates.');
    const candidate = await this.query(
      `SELECT id FROM candidates WHERE organization_id=$1 AND id=$2 AND merged_into_id IS NULL`,
      [organizationId, candidateId],
    );
    if (!candidate[0]) throw new Error('Candidate was not found in this organization.');
    const criteria = (await this.query(
      `SELECT id,name,description,evidence_expectations,weight,classification FROM rubric_criteria WHERE organization_id=$1 AND rubric_id=$2 ORDER BY display_order`,
      [organizationId, rubrics[0].id],
    )) as Record<string, unknown>[];
    const claims = (await this.query(
      `SELECT ec.id,ec.label,CASE WHEN cr.action='correct' THEN cr.corrected_value ELSE ec.claim_value END AS value,ec.claim_status AS status,ec.confidence,ec.source_id,ec.extractor_version FROM evidence_claims ec LEFT JOIN LATERAL (SELECT action,corrected_value FROM evidence_claim_corrections WHERE organization_id=ec.organization_id AND claim_id=ec.id ORDER BY created_at DESC LIMIT 1) cr ON TRUE WHERE ec.organization_id=$1 AND ec.candidate_id=$2 AND COALESCE(cr.action,'')<>'reject' ORDER BY ec.created_at`,
      [organizationId, candidateId],
    )) as Record<string, unknown>[];
    return {
      rubric: rubrics[0],
      criteria: criteria.map((c) => ({
        id: String(c.id),
        name: String(c.name),
        description: String(c.description),
        evidenceExpectations: String(c.evidence_expectations),
        weight: Number(c.weight),
        classification: String(c.classification),
      })),
      claims: claims.map((c) => ({
        id: String(c.id),
        label: String(c.label),
        value: String(c.value),
        status: String(c.status),
        confidence: Number(c.confidence),
        sourceId: String(c.source_id),
        extractorVersion: String(c.extractor_version),
      })),
    };
  }
  async save(input: {
    organizationId: string;
    candidateId: string;
    positionId: string;
    actorId: string;
    rubric: { id: string; version: number };
    criteria: Array<{ id: string; weight: number; classification: string }>;
    claims: unknown[];
    judgments: CriterionJudgment[];
    execution: EvaluationProviderResult['execution'];
  }) {
    const totals = calculateEvaluation(input.criteria, input.judgments),
      evaluationId = crypto.randomUUID(),
      executionId = crypto.randomUUID();
    await this.query(
      `WITH stale AS (UPDATE candidate_evaluations SET state='stale' WHERE organization_id=$1 AND candidate_id=$2 AND position_id=$3 AND state='evaluated'), e AS (INSERT INTO provider_executions(id,organization_id,provider,operation,model,prompt_version,schema_version,provider_request_id,latency_ms,status,normalized_error) VALUES($4,$1,$5,'candidate.evaluate',$6,$7,$8,$9,$10,$11,$12::JSON)), ce AS (INSERT INTO candidate_evaluations(id,organization_id,candidate_id,position_id,rubric_id,rubric_version,state,role_fit,evidence_confidence,recommendation,evidence_snapshot,provider_execution_id,created_by_id) VALUES($13,$1,$2,$3,$14,$15,'evaluated',$16,$17,$18,$19::JSON,$4,$20)) INSERT INTO audit_events(id,organization_id,actor_user_id,action,subject_type,subject_id,metadata) VALUES($21,$1,$20,'candidate.evaluated','candidate_evaluation',$13,json_build_object('candidate_id',$2::TEXT,'position_id',$3::TEXT,'rubric_version',$15::INT,'role_fit',$16::INT,'evidence_confidence',$17::INT))`,
      [
        input.organizationId,
        input.candidateId,
        input.positionId,
        executionId,
        input.execution.provider,
        input.execution.model,
        input.execution.promptVersion,
        input.execution.schemaVersion,
        input.execution.requestId ?? null,
        input.execution.latencyMs,
        input.execution.status,
        JSON.stringify(input.execution.error ?? null),
        evaluationId,
        input.rubric.id,
        input.rubric.version,
        totals.roleFit,
        totals.evidenceConfidence,
        totals.recommendation,
        JSON.stringify(input.claims),
        input.actorId,
        crypto.randomUUID(),
      ],
    );
    for (const judgment of input.judgments)
      await this.query(
        `INSERT INTO criterion_evaluations(id,organization_id,candidate_evaluation_id,criterion_id,rating,score,evidence_confidence,reasoning,evidence_claim_ids,gaps) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::JSON,$10::JSON)`,
        [
          crypto.randomUUID(),
          input.organizationId,
          evaluationId,
          judgment.criterionId,
          judgment.rating,
          judgment.score,
          judgment.confidence,
          judgment.reasoning,
          JSON.stringify(judgment.evidenceClaimIds),
          JSON.stringify(judgment.gaps),
        ],
      );
    return evaluationId;
  }
  async latest(organizationId: string, candidateId: string, positionId?: string) {
    const rows = (await this.query(
      `SELECT ce.*,p.title AS position_title,r.status AS current_rubric_status,(SELECT MAX(version) FROM evaluation_rubrics WHERE organization_id=ce.organization_id AND position_id=ce.position_id AND status='approved') AS current_rubric_version FROM candidate_evaluations ce JOIN positions p ON p.id=ce.position_id AND p.organization_id=ce.organization_id JOIN evaluation_rubrics r ON r.id=ce.rubric_id AND r.organization_id=ce.organization_id WHERE ce.organization_id=$1 AND ce.candidate_id=$2 ${positionId ? 'AND ce.position_id=$3' : ''} ORDER BY ce.created_at DESC`,
      positionId ? [organizationId, candidateId, positionId] : [organizationId, candidateId],
    )) as Record<string, unknown>[];
    if (!rows[0]) return positionId ? null : [];
    if (positionId) {
      const criteria = await this.query(
        `SELECT c.*,rc.name,rc.classification,rc.weight FROM criterion_evaluations c JOIN rubric_criteria rc ON rc.id=c.criterion_id AND rc.organization_id=c.organization_id WHERE c.organization_id=$1 AND c.candidate_evaluation_id=$2 ORDER BY rc.display_order`,
        [organizationId, rows[0].id],
      );
      return { ...rows[0], criteria };
    }
    const seen = new Set<string>();
    return rows.filter(
      (row) => !seen.has(String(row.position_id)) && seen.add(String(row.position_id)),
    );
  }
  async listCandidates(
    organizationId: string,
    positionId?: string,
  ): Promise<Record<string, unknown>[]> {
    return this.query(
      `SELECT c.*,COUNT(DISTINCT s.id)::INT AS source_count,COUNT(DISTINCT a.id)::INT AS application_count,ev.role_fit,ev.evidence_confidence,ev.recommendation,ev.state AS evaluation_state,ev.position_id AS evaluation_position_id FROM candidates c LEFT JOIN candidate_sources s ON s.candidate_id=c.id AND s.organization_id=c.organization_id LEFT JOIN applications a ON a.candidate_id=c.id AND a.organization_id=c.organization_id LEFT JOIN LATERAL (SELECT * FROM candidate_evaluations ce WHERE ce.organization_id=c.organization_id AND ce.candidate_id=c.id ${positionId ? 'AND ce.position_id=$2' : ''} ORDER BY ce.created_at DESC LIMIT 1) ev ON TRUE WHERE c.organization_id=$1 AND c.merged_into_id IS NULL GROUP BY c.id,ev.role_fit,ev.evidence_confidence,ev.recommendation,ev.state,ev.position_id ORDER BY ev.role_fit DESC NULLS LAST,c.created_at DESC`,
      positionId ? [organizationId, positionId] : [organizationId],
    ) as Promise<Record<string, unknown>[]>;
  }
}
