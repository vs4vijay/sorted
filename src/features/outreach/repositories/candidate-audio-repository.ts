import { createHash } from 'node:crypto';
import { executeQuery } from '@/lib/db';
import { synthesizeCandidateAudio } from '../providers/text-to-speech-provider';
import { privateCandidateAudioStorage } from '../services/private-candidate-audio-storage';

type Query = (sql: string, params?: unknown[]) => Promise<unknown[]>;

export class CandidateAudioRepository {
  constructor(private query: Query = executeQuery) {}

  async recordOptIn(org: string, actor: string, input: { candidateId: string; languageCode: string }) {
    await this.query(`WITH preference AS (
      INSERT INTO candidate_communication_preferences(id,organization_id,candidate_id,channel,language_code,status,source,recorded_by_id,recorded_at,withdrawn_at)
      VALUES($1,$2,$3,'audio_preview',$4,'opted_in','candidate_confirmed',$5,CURRENT_TIMESTAMP,NULL)
      ON CONFLICT(organization_id,candidate_id,channel,language_code) DO UPDATE SET status='opted_in',source='candidate_confirmed',recorded_by_id=$5,recorded_at=CURRENT_TIMESTAMP,withdrawn_at=NULL
      RETURNING id
    ) INSERT INTO audit_events(id,organization_id,actor_user_id,action,subject_type,subject_id,metadata)
      SELECT $6,$2,$5,'candidate.audio_opt_in_recorded','candidate', $3, json_build_object('channel','audio_preview','language_code',$4::TEXT) FROM preference`, [crypto.randomUUID(), org, input.candidateId, input.languageCode, actor, crypto.randomUUID()]);
  }

  async generate(org: string, actor: string, input: { messageId: string; languageCode: string; voice: string }) {
    const rows = await this.query(`SELECT m.id,m.body,m.approval_version,t.candidate_id
      FROM outreach_messages m JOIN outreach_threads t ON t.id=m.thread_id AND t.organization_id=m.organization_id
      JOIN candidate_communication_preferences p ON p.organization_id=t.organization_id AND p.candidate_id=t.candidate_id AND p.channel='audio_preview' AND p.language_code=$3 AND p.status='opted_in'
      WHERE m.organization_id=$1 AND m.id=$2 AND m.direction='outbound' AND m.status='approved' AND m.approved_at IS NOT NULL LIMIT 1`, [org, input.messageId, input.languageCode]) as Record<string, unknown>[];
    const message = rows[0];
    if (!message) throw new Error('An approved message and recorded candidate audio opt-in are required.');
    const body = String(message.body);
    const textHash = createHash('sha256').update(body).digest('hex');
    const existing = await this.query(`SELECT id FROM candidate_audio_assets WHERE organization_id=$1 AND message_id=$2 AND text_hash=$3 AND language_code=$4 AND voice=$5 AND status IN('ready','simulated') LIMIT 1`, [org, input.messageId, textHash, input.languageCode, input.voice]);
    if (existing[0]) return String((existing[0] as { id: string }).id);
    const id = crypto.randomUUID();
    await this.query(`INSERT INTO candidate_audio_assets(id,organization_id,candidate_id,message_id,text_hash,text_approval_version,language_code,voice,status,schema_version,generated_by_id,expires_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,'generating','candidate-audio.v1',$9,CURRENT_TIMESTAMP + INTERVAL '7 days')`, [id, org, message.candidate_id, input.messageId, textHash, message.approval_version, input.languageCode, input.voice, actor]);
    try {
      const result = await synthesizeCandidateAudio(body, input.languageCode, input.voice);
      const key = `${org}/${id}`;
      await privateCandidateAudioStorage.put(key, result.data.audio);
      await this.query(`WITH asset AS (UPDATE candidate_audio_assets SET status=$3,provider=$4,model=$5,provider_request_id=$6,storage_key=$7,media_type=$8,byte_size=$9,generated_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE organization_id=$1 AND id=$2 RETURNING id), execution AS (
        INSERT INTO provider_executions(id,organization_id,provider,operation,model,prompt_version,schema_version,provider_request_id,latency_ms,status,normalized_error)
        VALUES($10,$1,$4,'candidate_audio.generate',$5,'candidate-audio.prompt.v1','candidate-audio.v1',$6,$11,$12,$13::JSON)
      ) INSERT INTO audit_events(id,organization_id,actor_user_id,action,subject_type,subject_id,metadata)
        SELECT $14,$1,$15,'candidate.audio_generated','candidate_audio_asset',$2,json_build_object('message_id',$16::TEXT,'language_code',$17::TEXT,'voice',$18::TEXT,'simulated',$3::TEXT='simulated') FROM asset`, [org, id, result.execution.status === 'simulated' ? 'simulated' : 'ready', result.execution.provider, result.execution.model, result.execution.requestId ?? null, key, result.data.mediaType, result.data.audio.byteLength, crypto.randomUUID(), result.execution.latencyMs, result.execution.status, JSON.stringify(result.execution.error ?? null), crypto.randomUUID(), actor, input.messageId, input.languageCode, input.voice]);
      return id;
    } catch (error) {
      await this.query(`UPDATE candidate_audio_assets SET status='failed',normalized_error=$3,updated_at=CURRENT_TIMESTAMP WHERE organization_id=$1 AND id=$2`, [org, id, 'Audio generation failed. The approved text message remains available.']);
      throw error;
    }
  }

  async getAsset(org: string, id: string) {
    const rows = await this.query(`SELECT * FROM candidate_audio_assets WHERE organization_id=$1 AND id=$2 AND status IN('ready','simulated') AND invalidated_at IS NULL AND expires_at>CURRENT_TIMESTAMP LIMIT 1`, [org, id]);
    return rows[0] as Record<string, unknown> | undefined;
  }

  async remove(org: string, actor: string, id: string) {
    const rows = await this.query(`SELECT storage_key FROM candidate_audio_assets WHERE organization_id=$1 AND id=$2 AND invalidated_at IS NULL LIMIT 1`, [org, id]) as Record<string, unknown>[];
    if (!rows[0]) throw new Error('Audio preview not found.');
    if (rows[0].storage_key) await privateCandidateAudioStorage.remove(String(rows[0].storage_key));
    await this.query(`WITH asset AS (UPDATE candidate_audio_assets SET status='invalidated',storage_key=NULL,invalidated_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE organization_id=$1 AND id=$2 RETURNING id) INSERT INTO audit_events(id,organization_id,actor_user_id,action,subject_type,subject_id,metadata) SELECT $3,$1,$4,'candidate.audio_deleted','candidate_audio_asset',$2,'{}'::JSON FROM asset`, [org, id, crypto.randomUUID(), actor]);
  }
}
