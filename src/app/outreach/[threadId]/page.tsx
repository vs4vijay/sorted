import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/recruiting/app-shell';
import { requirePageAccess } from '@/lib/auth/session';
import { OutreachRepository } from '@/features/outreach/repositories/outreach-repository';
import {
  advanceToScreening,
  approveMessage,
  confirmSuggestion,
  createSequence,
  deleteAudioPreview,
  editDraft,
  generateAudioPreview,
  pauseSequence,
  recordAudioOptIn,
  simulateResponse,
} from '../actions';
import { privateCandidateAudioStorage } from '@/features/outreach/services/private-candidate-audio-storage';
import { SendMessageForm } from './send-message-form';

const label = (v: unknown) => String(v ?? '').replaceAll('_', ' ');
const json = (v: unknown) => (Array.isArray(v) ? v : typeof v === 'string' ? JSON.parse(v) : []);

export default async function OutreachThread({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const access = await requirePageAccess('outreach:manage');
  const { threadId } = await params;
  const thread = await new OutreachRepository().thread(access.organization.id, threadId);
  if (!thread) notFound();
  const message = (thread.messages as Record<string, unknown>[]).find(
    (m) => m.direction === 'outbound',
  );
  const responses = thread.responses as Record<string, unknown>[];
  const enrollments = thread.enrollments as Record<string, unknown>[];
  const handoffs = thread.handoffs as Record<string, unknown>[];
  const audioPreferences = thread.audioPreferences as Record<string, unknown>[];
  const audioAssets = thread.audioAssets as Record<string, unknown>[];
  const activeAudio = audioAssets.find(
    (asset) =>
      ['ready', 'simulated'].includes(String(asset.status)) &&
      !asset.invalidated_at &&
      new Date(String(asset.expires_at)) > new Date(),
  );
  const audioLink = activeAudio?.storage_key
    ? privateCandidateAudioStorage.sign(String(activeAudio.storage_key))
    : null;
  const canSchedule =
    ['sent', 'simulated'].includes(String(message?.status)) &&
    !responses.length &&
    !enrollments.some((e) => e.status === 'scheduled');
  return (
    <AppShell active="outreach">
      <div className="detail-title">
        <Link href="/outreach">← Outreach</Link>
        <div className="outreach-title">
          <div>
            <span className="eyebrow">CANDIDATE COMMUNICATION</span>
            <h1>{String(thread.display_name)}</h1>
            <p>
              {String(thread.position_title)} · {label(thread.purpose)}
            </p>
          </div>
          <span className={`stage ${String(thread.application_stage ?? thread.status)}`}>
            {label(thread.application_stage ?? thread.status)}
          </span>
        </div>
      </div>
      <div className="outreach-layout">
        <main>
          {message && (
            <section className="surface message-editor">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">RECRUITER REVIEW</span>
                  <h2>Candidate-facing email</h2>
                </div>
                <span className={`stage ${String(message.status)}`}>{label(message.status)}</span>
              </div>
              <form action={editDraft} className="stack-form">
                <input type="hidden" name="messageId" value={String(message.id)} />
                <input type="hidden" name="threadId" value={threadId} />
                <label>
                  Subject
                  <input
                    name="subject"
                    defaultValue={String(message.subject)}
                    aria-label="Email subject"
                  />
                </label>
                <label>
                  Message
                  <textarea
                    name="body"
                    defaultValue={String(message.body)}
                    rows={10}
                    aria-label="Email message"
                  />
                </label>
                <small>
                  Editing invalidates any prior approval. Verify every claim and requested field
                  before approval.
                </small>
                <button className="button secondary">Save edits</button>
              </form>
              <div className="approval-actions">
                {message.status === 'draft' && (
                  <form action={approveMessage}>
                    <input type="hidden" name="messageId" value={String(message.id)} />
                    <input type="hidden" name="threadId" value={threadId} />
                    <button className="button primary">Approve exact message</button>
                  </form>
                )}
                {message.status === 'approved' && (
                  <SendMessageForm
                    messageId={String(message.id)}
                    threadId={threadId}
                    candidateEmail={thread.candidate_email ? String(thread.candidate_email) : null}
                  />
                )}
              </div>
              {message.provider === 'fixture' && (
                <span className="simulation-label">Simulated delivery — no email left Sorted.</span>
              )}
            </section>
          )}
          <section className="surface timeline">
            <span className="eyebrow">AUDITABLE TIMELINE</span>
            <h2>Delivery and replies</h2>
            {(thread.events as Record<string, unknown>[]).map((e) => (
              <article key={String(e.id)}>
                <span className="timeline-dot" />
                <div>
                  <strong>{label(e.event_type)}</strong>
                  <small>{new Date(String(e.created_at)).toLocaleString('en-IN')}</small>
                </div>
              </article>
            ))}
            {responses.map((r) => (
              <article key={String(r.id)}>
                <span className="timeline-dot reply" />
                <div>
                  <strong>Candidate reply</strong>
                  <p>{String(r.body)}</p>
                  <small>
                    Suggestions below are not profile updates until a recruiter confirms them.
                  </small>
                  {json(r.parsed_suggestions).map((s: { field: string; value: string }) => (
                    <form action={confirmSuggestion} className="suggestion" key={s.field}>
                      <input type="hidden" name="responseId" value={String(r.id)} />
                      <input type="hidden" name="threadId" value={threadId} />
                      <input type="hidden" name="field" value={s.field} />
                      <input name="value" defaultValue={s.value} />
                      <button className="button secondary">Confirm {label(s.field)}</button>
                    </form>
                  ))}
                </div>
              </article>
            ))}
          </section>
          {enrollments.length > 0 && (
            <section className="surface sequence-card">
              <span className="eyebrow">SAFE FOLLOW-UP</span>
              <h2>Sequence status</h2>
              {enrollments.map((e) => (
                <div className="sequence-row" key={String(e.id)}>
                  <div>
                    <strong>{String(e.name)}</strong>
                    <p>
                      {label(e.status)}
                      {e.stop_reason
                        ? ` · stopped on ${label(e.stop_reason)}`
                        : ` · due ${new Date(String(e.next_run_at)).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}`}
                    </p>
                    <small>Approved text · India business hours · maximum 1 reminder</small>
                  </div>
                  {e.status === 'scheduled' && (
                    <form action={pauseSequence}>
                      <input type="hidden" name="enrollmentId" value={String(e.id)} />
                      <input type="hidden" name="threadId" value={threadId} />
                      <button className="button secondary">Pause follow-up</button>
                    </form>
                  )}
                </div>
              ))}
            </section>
          )}
          {handoffs.length > 0 && (
            <section className="surface handoff-success">
              <span className="eyebrow">HUMAN PIPELINE HANDOFF</span>
              <h2>Moved to recruiter screening</h2>
              <p>
                The approved rubric, evaluation evidence, shortlist decision, candidate reply,
                rationale, and acting recruiter were frozen in an immutable handoff snapshot.
              </p>
            </section>
          )}
          {message && (
            <section className="surface candidate-audio-panel">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">BULBUL ACCESSIBILITY</span>
                  <h2>Optional multilingual audio</h2>
                </div>
                {activeAudio && (
                  <span className={`stage ${String(activeAudio.status)}`}>
                    {label(activeAudio.status)}
                  </span>
                )}
              </div>
              <p>
                Audio can only mirror the exact recruiter-approved text. It is an optional
                preview—not a call, interview, or synthetic recruiter identity.
              </p>
              {activeAudio && audioLink && (
                <div className="audio-preview">
                  <audio
                    controls
                    preload="metadata"
                    src={`/api/candidate-audio/${String(activeAudio.id)}?expires=${audioLink.expires}&signature=${audioLink.signature}`}
                  >
                    Your browser does not support audio playback.
                  </audio>
                  <div>
                    <strong>
                      {String(activeAudio.language_code)} · {String(activeAudio.voice)}
                    </strong>
                    <small>
                      Private link expires in 5 minutes · asset expires{' '}
                      {new Date(String(activeAudio.expires_at)).toLocaleDateString('en-IN')}
                    </small>
                    {activeAudio.provider === 'fixture' && (
                      <span className="simulation-label">
                        Simulated Bulbul preview — no provider audio was generated.
                      </span>
                    )}
                    <form action={deleteAudioPreview}>
                      <input type="hidden" name="threadId" value={threadId} />
                      <input type="hidden" name="assetId" value={String(activeAudio.id)} />
                      <button className="button secondary">Delete private audio</button>
                    </form>
                  </div>
                </div>
              )}
              {audioAssets.some((asset) => asset.status === 'invalidated') && (
                <p className="audio-warning">
                  A previous preview was invalidated because the approved message text changed or
                  was deleted.
                </p>
              )}
              {audioAssets.some((asset) => asset.status === 'failed') && (
                <p className="audio-warning">
                  Audio generation failed. The approved text-only message is still available.
                </p>
              )}
            </section>
          )}
        </main>
        <aside>
          <section className="surface outreach-context">
            <span className="eyebrow">APPROVED REQUEST</span>
            <h2>Information requested</h2>
            {json(thread.requested_fields).map((f: string) => (
              <span className="tag" key={f}>
                {label(f)}
              </span>
            ))}
            <dl>
              <dt>Candidate email</dt>
              <dd>{String(thread.candidate_email ?? 'Not available')}</dd>
              <dt>Stop policy</dt>
              <dd>
                Reply, bounce, opt-out, pause, disposition, or pipeline advancement stops every
                scheduled nudge.
              </dd>
            </dl>
          </section>
          {canSchedule && (
            <section className="surface simulate-panel">
              <span className="eyebrow">APPROVED SEQUENCE</span>
              <h2>Schedule one safe reminder</h2>
              <form action={createSequence} className="stack-form">
                <input type="hidden" name="threadId" value={threadId} />
                <label>
                  Sequence name
                  <input name="name" defaultValue="Shortlist interest reminder" />
                </label>
                <label>
                  Delay
                  <select name="delayBusinessDays" defaultValue="2">
                    <option value="1">1 business day</option>
                    <option value="2">2 business days</option>
                    <option value="3">3 business days</option>
                  </select>
                </label>
                <label>
                  Subject
                  <input
                    name="subject"
                    defaultValue={`Checking in about ${String(thread.position_title)}`}
                  />
                </label>
                <label>
                  Approved reminder
                  <textarea
                    name="body"
                    rows={6}
                    defaultValue="Hello, we’re following up on our earlier approved message. If you remain interested, please reply when convenient. You can opt out of further messages at any time."
                  />
                </label>
                <button className="button primary">Approve and schedule reminder</button>
              </form>
            </section>
          )}
          {['sent', 'simulated'].includes(String(message?.status)) && (
            <section className="surface simulate-panel">
              <span className="eyebrow">HACKATHON WEBHOOK FIXTURE</span>
              <h2>Validate inbound events</h2>
              <form action={simulateResponse} className="stack-form">
                <input type="hidden" name="threadId" value={threadId} />
                <select name="eventType">
                  <option value="reply">Candidate reply</option>
                  <option value="bounce">Bounce</option>
                  <option value="opt_out">Opt out</option>
                </select>
                <textarea
                  name="body"
                  defaultValue="I am interested. My notice period is 30 days and my expected CTC is 32 LPA."
                />
                <button className="button secondary">Record simulated provider event</button>
              </form>
            </section>
          )}
          {String(thread.status) === 'replied' && !handoffs.length && (
            <section className="surface handoff-panel">
              <span className="eyebrow">HUMAN ACTION REQUIRED</span>
              <h2>Move to recruiter screening</h2>
              <p>
                No AI output can perform this transition. Your rationale and the complete
                decision/evidence snapshot will be retained.
              </p>
              <form action={advanceToScreening} className="stack-form">
                <input type="hidden" name="threadId" value={threadId} />
                <label>
                  Recruiter rationale
                  <textarea
                    name="rationale"
                    rows={5}
                    defaultValue="Candidate confirmed interest and supplied the requested logistics. Advance for recruiter-led screening."
                  />
                </label>
                <button className="button dark">Move to recruiter screening</button>
              </form>
            </section>
          )}
          {message?.status === 'approved' && (
            <section className="surface audio-consent-panel">
              <span className="eyebrow">OPT-IN REQUIRED</span>
              <h2>Create audio preview</h2>
              {!audioPreferences.some((preference) => preference.status === 'opted_in') ? (
                <form action={recordAudioOptIn} className="stack-form">
                  <input type="hidden" name="threadId" value={threadId} />
                  <input type="hidden" name="candidateId" value={String(thread.candidate_id)} />
                  <label>
                    Preferred language
                    <select name="languageCode" defaultValue="hi-IN">
                      <option value="hi-IN">Hindi</option>
                      <option value="en-IN">English (India)</option>
                      <option value="ta-IN">Tamil</option>
                      <option value="te-IN">Telugu</option>
                      <option value="kn-IN">Kannada</option>
                      <option value="ml-IN">Malayalam</option>
                      <option value="mr-IN">Marathi</option>
                      <option value="bn-IN">Bengali</option>
                      <option value="gu-IN">Gujarati</option>
                      <option value="pa-IN">Punjabi</option>
                      <option value="od-IN">Odia</option>
                    </select>
                  </label>
                  <label className="consent-check">
                    <input type="checkbox" name="consentConfirmed" /> Candidate explicitly requested
                    or agreed to receive an audio preview through this communication path.
                  </label>
                  <button className="button secondary">Record candidate opt-in</button>
                </form>
              ) : (
                <form action={generateAudioPreview} className="stack-form">
                  <input type="hidden" name="threadId" value={threadId} />
                  <input type="hidden" name="messageId" value={String(message.id)} />
                  <label>
                    Opted-in language
                    <select
                      name="languageCode"
                      defaultValue={String(
                        audioPreferences.find((preference) => preference.status === 'opted_in')
                          ?.language_code ?? 'hi-IN',
                      )}
                    >
                      {audioPreferences
                        .filter((preference) => preference.status === 'opted_in')
                        .map((preference) => (
                          <option
                            value={String(preference.language_code)}
                            key={String(preference.id)}
                          >
                            {String(preference.language_code)}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Voice
                    <select name="voice" defaultValue="anushka">
                      <option value="anushka">Anushka</option>
                      <option value="manisha">Manisha</option>
                      <option value="vidya">Vidya</option>
                      <option value="arya">Arya</option>
                    </select>
                  </label>
                  <small>
                    Generated from approval version {String(message.approval_version)}. Editing the
                    text invalidates every preview.
                  </small>
                  <button className="button primary">Generate private audio preview</button>
                </form>
              )}
            </section>
          )}
        </aside>
      </div>
    </AppShell>
  );
}
