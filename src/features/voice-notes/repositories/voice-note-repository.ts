import { executeQuery } from '@/lib/db';
import type { TranscriptionResult } from '../sarvam/speech-to-text-provider';
type Query = (sql: string, params?: unknown[]) => Promise<unknown[]>;

export class VoiceNoteRepository {
  constructor(private readonly query: Query = executeQuery) {}
  async create(input: {
    id: string;
    organizationId: string;
    positionId: string;
    actorId: string;
    purpose: string;
    languageCode: string;
    storageKey: string;
    mediaType: string;
    byteSize: number;
    checksum: string;
  }) {
    await this.query(
      `WITH note AS (INSERT INTO voice_notes(id,organization_id,position_id,purpose,language_code,consent_recorded_by_id,consent_recorded_at,storage_key,media_type,byte_size,checksum,status,created_by_id) VALUES($1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP,$7,$8,$9,$10,'uploaded',$6) RETURNING id) INSERT INTO audit_events(id,organization_id,actor_user_id,action,subject_type,subject_id,metadata) VALUES($11,$2,$6,'voice_note.uploaded','voice_note',$1,json_build_object('purpose',$4::TEXT,'language_code',$5::TEXT))`,
      [
        input.id,
        input.organizationId,
        input.positionId,
        input.purpose,
        input.languageCode,
        input.actorId,
        input.storageKey,
        input.mediaType,
        input.byteSize,
        input.checksum,
        crypto.randomUUID(),
      ],
    );
  }
  async complete(input: {
    id: string;
    organizationId: string;
    result: TranscriptionResult;
    executionId: string;
  }) {
    await this.query(
      `WITH execution AS (INSERT INTO provider_executions(id,organization_id,provider,operation,model,prompt_version,schema_version,provider_request_id,latency_ms,status,normalized_error) VALUES($3,$2,$4,'speech.transcribe',$5,$6,$7,$8,$9,$10,$11::JSON)), updated AS (UPDATE voice_notes SET status=$10,transcript=$12,transcript_data=$13::JSON,provider_execution_id=$3,updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND organization_id=$2 RETURNING id) INSERT INTO audit_events(id,organization_id,action,subject_type,subject_id,metadata) SELECT $14,$2,'voice_note.transcribed','voice_note',id,json_build_object('mode',$10::TEXT) FROM updated`,
      [
        input.id,
        input.organizationId,
        input.executionId,
        input.result.execution.provider,
        input.result.execution.model,
        input.result.execution.promptVersion,
        input.result.execution.schemaVersion,
        input.result.execution.requestId ?? null,
        input.result.execution.latencyMs,
        input.result.execution.status,
        JSON.stringify(input.result.execution.error ?? null),
        input.result.data.transcript,
        JSON.stringify(input.result.data),
        crypto.randomUUID(),
      ],
    );
  }
  async listForPosition(organizationId: string, positionId: string) {
    return this.query(
      `SELECT id,purpose,language_code,status,transcript,transcript_data,reviewed_transcript,reviewed_at,source_deleted_at,created_at FROM voice_notes WHERE organization_id=$1 AND position_id=$2 ORDER BY created_at DESC`,
      [organizationId, positionId],
    ) as Promise<Record<string, unknown>[]>;
  }
  async get(organizationId: string, id: string) {
    const rows = (await this.query(`SELECT * FROM voice_notes WHERE organization_id=$1 AND id=$2`, [
      organizationId,
      id,
    ])) as Record<string, unknown>[];
    return rows[0] ?? null;
  }
  async approveAndCreateDraft(input: {
    organizationId: string;
    positionId: string;
    voiceNoteId: string;
    actorId: string;
    transcript: string;
    criterion: { name: string; description: string; evidenceExpectations: string } | null;
  }) {
    const reviewed = await this.query(
      `UPDATE voice_notes SET reviewed_transcript=$4,reviewed_by_id=$5,reviewed_at=CURRENT_TIMESTAMP,status='approved',updated_at=CURRENT_TIMESTAMP WHERE id=$3 AND organization_id=$1 AND position_id=$2 AND reviewed_at IS NULL RETURNING id`,
      [input.organizationId, input.positionId, input.voiceNoteId, input.transcript, input.actorId],
    );
    if (!reviewed.length) return false;
    if (input.criterion) {
      const rows = (await this.query(
        `SELECT r.id,r.version FROM evaluation_rubrics r WHERE r.organization_id=$1 AND r.position_id=$2 ORDER BY r.version DESC LIMIT 1`,
        [input.organizationId, input.positionId],
      )) as { id: string; version: number }[];
      if (!rows[0]) throw new Error('Position rubric not found.');
      const nextId = crypto.randomUUID(),
        nextVersion = Number(rows[0].version) + 1;
      await this.query(
        `WITH rubric AS (INSERT INTO evaluation_rubrics(id,organization_id,position_id,version,status,created_by_id) VALUES($3,$1,$2,$4,'draft',$5)), copied AS (INSERT INTO rubric_criteria(id,organization_id,rubric_id,name,description,criterion_type,classification,weight,evidence_expectations,display_order) SELECT CAST(gen_random_uuid() AS TEXT),organization_id,$3,name,description,criterion_type,classification,weight,evidence_expectations,display_order FROM rubric_criteria WHERE organization_id=$1 AND rubric_id=$6), added AS (INSERT INTO rubric_criteria(id,organization_id,rubric_id,name,description,criterion_type,classification,weight,evidence_expectations,display_order) SELECT $7,$1,$3,$8,$9,'voice_requirement','informational',0,$10,COALESCE(MAX(display_order),-1)+1 FROM rubric_criteria WHERE organization_id=$1 AND rubric_id=$3) UPDATE positions SET status='rubric_review',updated_at=CURRENT_TIMESTAMP WHERE id=$2 AND organization_id=$1`,
        [
          input.organizationId,
          input.positionId,
          nextId,
          nextVersion,
          input.actorId,
          rows[0].id,
          crypto.randomUUID(),
          input.criterion.name,
          input.criterion.description,
          input.criterion.evidenceExpectations,
        ],
      );
    }
    await this.query(
      `INSERT INTO audit_events(id,organization_id,actor_user_id,action,subject_type,subject_id,metadata) VALUES($1,$2,$3,'voice_transcript.approved','voice_note',$4,json_build_object('draft_criterion_added',$5::BOOLEAN))`,
      [
        crypto.randomUUID(),
        input.organizationId,
        input.actorId,
        input.voiceNoteId,
        Boolean(input.criterion),
      ],
    );
    return true;
  }
  async markDeleted(organizationId: string, id: string, actorId: string) {
    const rows = await this.query(
      `WITH updated AS (UPDATE voice_notes SET source_deleted_at=CURRENT_TIMESTAMP,storage_key=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND organization_id=$2 AND source_deleted_at IS NULL RETURNING id) INSERT INTO audit_events(id,organization_id,actor_user_id,action,subject_type,subject_id) SELECT $4,$2,$3,'voice_note.source_deleted','voice_note',id FROM updated RETURNING id`,
      [id, organizationId, actorId, crypto.randomUUID()],
    );
    return rows.length > 0;
  }
}
