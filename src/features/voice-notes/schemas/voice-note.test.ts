import { describe, expect, test } from 'bun:test';
import { ReviewVoiceTranscriptSchema, UploadVoiceNoteSchema, VoiceTranscriptSchemaV1 } from './voice-note';

describe('voice note contracts',()=>{
  test('requires explicit recording consent',()=>{expect(UploadVoiceNoteSchema.safeParse({positionId:crypto.randomUUID(),purpose:'position_requirement',languageCode:'hi-IN'}).success).toBe(false);});
  test('keeps normalized transcripts versioned and bounded',()=>{expect(VoiceTranscriptSchemaV1.parse({schemaVersion:'voice-transcript.v1',transcript:'PostgreSQL production ownership is required.',languageCode:'hi-IN',draftCriterion:null}).schemaVersion).toBe('voice-transcript.v1');});
  test('rejects an unedited empty transcript review',()=>{expect(ReviewVoiceTranscriptSchema.safeParse({voiceNoteId:crypto.randomUUID(),positionId:crypto.randomUUID(),transcript:' '}).success).toBe(false);});
  test('does not allow a transcript to carry a hiring decision',()=>{expect(VoiceTranscriptSchemaV1.safeParse({schemaVersion:'voice-transcript.v1',transcript:'Relevant note',languageCode:'en-IN',draftCriterion:null,decision:'shortlist'}).success).toBe(true);expect(Object.keys(VoiceTranscriptSchemaV1.parse({schemaVersion:'voice-transcript.v1',transcript:'Relevant note',languageCode:'en-IN',draftCriterion:null,decision:'shortlist'}))).not.toContain('decision');});
});
