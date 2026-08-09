import { executeQuery } from '@/lib/db';
import { decisionOverridesConsensus } from '../schemas/panel-review';
type Query = (sql: string, params?: unknown[]) => Promise<unknown[]>;

export class PanelReviewRepository {
  constructor(private query: Query = executeQuery) {}

  async queue(
    organizationId: string,
    memberId: string,
    canDecide: boolean,
  ): Promise<Record<string, unknown>[]> {
    return this.query(
      `SELECT ce.id AS evaluation_id,ce.role_fit,ce.evidence_confidence,ce.recommendation AS ai_recommendation,ce.rubric_version,ce.created_at,c.id AS candidate_id,c.display_name,p.id AS position_id,p.title AS position_title,ra.id AS assignment_id,COALESCE(ra.state,'not_started') AS review_state,(SELECT COUNT(*)::INT FROM review_assignments required WHERE required.organization_id=$1 AND required.candidate_evaluation_id=ce.id) AS assigned_count,(SELECT COUNT(*)::INT FROM review_assignments done WHERE done.organization_id=$1 AND done.candidate_evaluation_id=ce.id AND done.state='submitted') AS submitted_count FROM candidate_evaluations ce JOIN candidates c ON c.id=ce.candidate_id AND c.organization_id=ce.organization_id JOIN positions p ON p.id=ce.position_id AND p.organization_id=ce.organization_id LEFT JOIN review_assignments ra ON ra.candidate_evaluation_id=ce.id AND ra.organization_id=ce.organization_id AND ra.reviewer_member_id=$2 WHERE ce.organization_id=$1 AND ce.state='evaluated' AND ($3::BOOLEAN OR ra.id IS NOT NULL) ORDER BY ce.created_at DESC`,
      [organizationId, memberId, canDecide],
    ) as Promise<Record<string, unknown>[]>;
  }

  async workspace(organizationId: string, evaluationId: string) {
    const evaluations = (await this.query(
      `SELECT ce.*,c.display_name,c.headline,p.title AS position_title FROM candidate_evaluations ce JOIN candidates c ON c.id=ce.candidate_id AND c.organization_id=ce.organization_id JOIN positions p ON p.id=ce.position_id AND p.organization_id=ce.organization_id WHERE ce.organization_id=$1 AND ce.id=$2`,
      [organizationId, evaluationId],
    )) as Record<string, unknown>[];
    if (!evaluations[0]) return null;
    const [criteria, assignments, reviews, comments, members, decisions] = (await Promise.all([
      this.query(
        `SELECT rc.id,rc.name,rc.classification,rc.weight,cr.rating,cr.score,cr.evidence_confidence,cr.reasoning,cr.gaps FROM criterion_evaluations cr JOIN rubric_criteria rc ON rc.id=cr.criterion_id AND rc.organization_id=cr.organization_id WHERE cr.organization_id=$1 AND cr.candidate_evaluation_id=$2 ORDER BY rc.display_order`,
        [organizationId, evaluationId],
      ),
      this.query(
        `SELECT ra.*,om.user_id,u.name,u.email,om.role FROM review_assignments ra JOIN organization_members om ON om.id=ra.reviewer_member_id AND om.organization_id=ra.organization_id JOIN users u ON u.id=om.user_id WHERE ra.organization_id=$1 AND ra.candidate_evaluation_id=$2 ORDER BY ra.created_at`,
        [organizationId, evaluationId],
      ),
      this.query(
        `SELECT pr.*,u.name AS reviewer_name,om.role AS reviewer_role FROM panel_reviews pr JOIN organization_members om ON om.id=pr.reviewer_member_id AND om.organization_id=pr.organization_id JOIN users u ON u.id=om.user_id WHERE pr.organization_id=$1 AND pr.candidate_evaluation_id=$2 ORDER BY pr.submitted_at`,
        [organizationId, evaluationId],
      ),
      this.query(
        `SELECT rc.*,u.name AS author_name FROM review_comments rc JOIN organization_members om ON om.id=rc.author_member_id AND om.organization_id=rc.organization_id JOIN users u ON u.id=om.user_id WHERE rc.organization_id=$1 AND rc.candidate_evaluation_id=$2 ORDER BY rc.created_at`,
        [organizationId, evaluationId],
      ),
      this.query(
        `SELECT om.id,u.name,u.email,om.role FROM organization_members om JOIN users u ON u.id=om.user_id WHERE om.organization_id=$1 ORDER BY u.name`,
        [organizationId],
      ),
      this.query(
        `SELECT sd.*,u.name AS decided_by_name FROM shortlist_decisions sd JOIN users u ON u.id=sd.decided_by_id WHERE sd.organization_id=$1 AND sd.candidate_evaluation_id=$2 ORDER BY sd.decided_at DESC`,
        [organizationId, evaluationId],
      ),
    ])) as Record<string, unknown>[][];
    return {
      evaluation: evaluations[0],
      criteria,
      assignments,
      reviews,
      comments,
      members,
      decisions,
    };
  }

  async assign(
    organizationId: string,
    evaluationId: string,
    reviewerMemberId: string,
    actorId: string,
  ) {
    await this.query(
      `WITH valid AS (SELECT 1 FROM candidate_evaluations ce JOIN organization_members om ON om.organization_id=ce.organization_id WHERE ce.organization_id=$1 AND ce.id=$2 AND om.id=$3), inserted AS (INSERT INTO review_assignments(id,organization_id,candidate_evaluation_id,reviewer_member_id,assigned_by_id) SELECT $4,$1,$2,$3,$5 FROM valid ON CONFLICT(organization_id,candidate_evaluation_id,reviewer_member_id) DO NOTHING RETURNING id), notified AS (INSERT INTO notifications(id,organization_id,recipient_member_id,kind,subject_type,subject_id,body) SELECT $6,$1,$3,'review_assignment','candidate_evaluation',$2,'A candidate evidence review was assigned to you.' FROM inserted) INSERT INTO audit_events(id,organization_id,actor_user_id,action,subject_type,subject_id,metadata) SELECT $7,$1,$5,'review.assigned','candidate_evaluation',$2,json_build_object('reviewer_member_id',$3::TEXT) FROM inserted`,
      [
        organizationId,
        evaluationId,
        reviewerMemberId,
        crypto.randomUUID(),
        actorId,
        crypto.randomUUID(),
        crypto.randomUUID(),
      ],
    );
  }

  async submit(
    organizationId: string,
    memberId: string,
    actorId: string,
    input: {
      assignmentId: string;
      evaluationId: string;
      recommendation: string;
      summary: string;
    },
  ) {
    const rows = await this.query(
      `WITH allowed AS (SELECT id FROM review_assignments WHERE organization_id=$1 AND id=$2 AND candidate_evaluation_id=$3 AND reviewer_member_id=$4), review AS (INSERT INTO panel_reviews(id,organization_id,assignment_id,candidate_evaluation_id,reviewer_member_id,recommendation,summary,criterion_feedback) SELECT $5,$1,$2,$3,$4,$6,$7,'{}'::JSON FROM allowed RETURNING id), updated AS (UPDATE review_assignments SET state='submitted',updated_at=CURRENT_TIMESTAMP WHERE id IN (SELECT $2 FROM review) RETURNING id) INSERT INTO audit_events(id,organization_id,actor_user_id,action,subject_type,subject_id,metadata) SELECT $8,$1,$9,'panel_review.submitted','candidate_evaluation',$3,json_build_object('recommendation',$6::TEXT) FROM review RETURNING id`,
      [
        organizationId,
        input.assignmentId,
        input.evaluationId,
        memberId,
        crypto.randomUUID(),
        input.recommendation,
        input.summary,
        crypto.randomUUID(),
        actorId,
      ],
    );
    if (!rows[0]) throw new Error('This review is not assigned to you.');
    await this.query(
      `INSERT INTO notifications(id,organization_id,recipient_member_id,kind,subject_type,subject_id,body) SELECT md5($1||om.id),$2,om.id,'decision_required','candidate_evaluation',$3,'All required reviews may now be ready for a human decision.' FROM organization_members om WHERE om.organization_id=$2 AND om.role IN ('admin','hiring_manager')`,
      [crypto.randomUUID(), organizationId, input.evaluationId],
    );
  }

  async comment(
    organizationId: string,
    memberId: string,
    actorId: string,
    input: { evaluationId: string; criterionId?: string; body: string },
  ) {
    await this.query(
      `WITH valid AS (SELECT id FROM candidate_evaluations WHERE organization_id=$1 AND id=$2), comment AS (INSERT INTO review_comments(id,organization_id,candidate_evaluation_id,criterion_id,author_member_id,body) SELECT $3,$1,$2,$4,$5,$6 FROM valid RETURNING id), notified AS (INSERT INTO notifications(id,organization_id,recipient_member_id,kind,subject_type,subject_id,body) SELECT md5($7||ra.reviewer_member_id),$1,ra.reviewer_member_id,'review_comment','candidate_evaluation',$2,'A panel member added an evidence-linked comment.' FROM review_assignments ra,comment WHERE ra.organization_id=$1 AND ra.candidate_evaluation_id=$2 AND ra.reviewer_member_id<>$5) INSERT INTO audit_events(id,organization_id,actor_user_id,action,subject_type,subject_id,metadata) SELECT $8,$1,$9,'review.comment_added','candidate_evaluation',$2,'{}'::JSON FROM comment`,
      [
        organizationId,
        input.evaluationId,
        crypto.randomUUID(),
        input.criterionId ?? null,
        memberId,
        input.body,
        crypto.randomUUID(),
        crypto.randomUUID(),
        actorId,
      ],
    );
  }

  async decide(
    organizationId: string,
    actorId: string,
    input: { evaluationId: string; decision: string; rationale: string },
  ) {
    const existing = await this.query(
      `SELECT id FROM shortlist_decisions WHERE organization_id=$1 AND candidate_evaluation_id=$2 LIMIT 1`,
      [organizationId, input.evaluationId],
    );
    if (existing[0]) return;
    const ctx = (await this.query(
      `SELECT ce.candidate_id,ce.position_id,COALESCE(json_agg(pr.recommendation) FILTER(WHERE pr.id IS NOT NULL),'[]') AS recommendations,COUNT(ra.id)::INT AS assigned_count,COUNT(ra.id) FILTER(WHERE ra.state='submitted')::INT AS submitted_count FROM candidate_evaluations ce LEFT JOIN review_assignments ra ON ra.organization_id=ce.organization_id AND ra.candidate_evaluation_id=ce.id LEFT JOIN panel_reviews pr ON pr.organization_id=ce.organization_id AND pr.assignment_id=ra.id WHERE ce.organization_id=$1 AND ce.id=$2 GROUP BY ce.id`,
      [organizationId, input.evaluationId],
    )) as {
      candidate_id: string;
      position_id: string;
      recommendations: string[];
      assigned_count: number;
      submitted_count: number;
    }[];
    if (!ctx[0]) throw new Error('Evaluation not found.');
    if (!ctx[0].assigned_count || ctx[0].submitted_count !== ctx[0].assigned_count)
      throw new Error('All assigned reviews must be submitted before the final decision.');
    const override = decisionOverridesConsensus(input.decision, ctx[0].recommendations);
    const decisionId = crypto.randomUUID();
    await this.query(
      `WITH decision AS (INSERT INTO shortlist_decisions(id,organization_id,candidate_evaluation_id,candidate_id,position_id,decision,rationale,decided_by_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id), app AS (INSERT INTO applications(id,organization_id,candidate_id,position_id,stage,created_by_id) SELECT $9,$2,$4,$5,CASE WHEN $6='shortlisted' THEN 'shortlisted' WHEN $6='not_advancing' THEN 'not_advancing' ELSE 'under_review' END,$8 FROM decision ON CONFLICT(organization_id,candidate_id,position_id) DO UPDATE SET stage=EXCLUDED.stage), event AS (INSERT INTO decision_events(id,organization_id,shortlist_decision_id,event_type,actor_user_id,metadata) VALUES($10,$2,$1,'shortlist_decision.recorded',$8,json_build_object('override_consensus',$11::BOOLEAN,'evaluation_id',$3::TEXT))), notified AS (INSERT INTO notifications(id,organization_id,recipient_member_id,kind,subject_type,subject_id,body) SELECT md5($13||ra.reviewer_member_id),$2,ra.reviewer_member_id,CASE WHEN $6='shortlisted' THEN 'candidate_shortlisted' ELSE 'decision_recorded' END,'shortlist_decision',$1,'A human shortlist decision was recorded.' FROM review_assignments ra,decision WHERE ra.organization_id=$2 AND ra.candidate_evaluation_id=$3) INSERT INTO audit_events(id,organization_id,actor_user_id,action,subject_type,subject_id,metadata) VALUES($12,$2,$8,'shortlist_decision.recorded','shortlist_decision',$1,json_build_object('decision',$6::TEXT,'evaluation_id',$3::TEXT,'override_consensus',$11::BOOLEAN))`,
      [
        decisionId,
        organizationId,
        input.evaluationId,
        ctx[0].candidate_id,
        ctx[0].position_id,
        input.decision,
        input.rationale,
        actorId,
        crypto.randomUUID(),
        crypto.randomUUID(),
        override,
        crypto.randomUUID(),
        crypto.randomUUID(),
      ],
    );
  }
}
