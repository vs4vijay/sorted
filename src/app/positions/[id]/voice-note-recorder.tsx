'use client';
import { useRef, useState } from 'react';
import { uploadVoiceNote } from '../actions';

export function VoiceNoteRecorder({ positionId }: { positionId: string }) {
  const [recording, setRecording] = useState(false);
  const [ready, setReady] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const input = useRef<HTMLInputElement | null>(null);
  async function start() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunks.current = [];
    const next = new MediaRecorder(stream);
    next.ondataavailable = (event) => chunks.current.push(event.data);
    next.onstop = () => {
      const blob = new Blob(chunks.current, { type: next.mimeType || 'audio/webm' });
      const file = new File([blob], 'recruiter-voice-note.webm', { type: blob.type });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      if (input.current) input.current.files = transfer.files;
      stream.getTracks().forEach((track) => track.stop());
      setReady(true);
    };
    next.start();
    recorder.current = next;
    setRecording(true);
  }
  function stop() {
    recorder.current?.stop();
    setRecording(false);
  }
  return (
    <form action={uploadVoiceNote} className="voice-note-form">
      <input type="hidden" name="positionId" value={positionId} />
      <div className="voice-controls">
        <button type="button" className="button secondary" onClick={recording ? stop : start}>
          {recording ? 'Stop recording' : 'Record voice note'}
        </button>
        <span>
          {recording
            ? 'Recording…'
            : ready
              ? 'Recording ready to transcribe'
              : 'or choose an audio file'}
        </span>
      </div>
      <label>
        Audio file
        <input
          ref={input}
          name="audio"
          type="file"
          accept="audio/wav,audio/mpeg,audio/mp4,audio/webm"
          required
          onChange={() => setReady(Boolean(input.current?.files?.length))}
        />
      </label>
      <div className="form-grid">
        <label>
          Purpose
          <select name="purpose" defaultValue="position_requirement">
            <option value="position_requirement">Position requirement</option>
            <option value="screening_note">Recruiter screening note</option>
            <option value="panel_feedback">Panel feedback</option>
          </select>
        </label>
        <label>
          Spoken language
          <select name="languageCode" defaultValue="hi-IN">
            <option value="hi-IN">Hindi / Hinglish</option>
            <option value="en-IN">Indian English</option>
            <option value="unknown">Auto-detect</option>
          </select>
        </label>
      </div>
      <label className="consent-check">
        <input name="consent" type="checkbox" required /> I confirm the speaker knowingly recorded
        this note for hiring use.
      </label>
      <button className="button primary" disabled={!ready}>
        Transcribe privately
      </button>
    </form>
  );
}
