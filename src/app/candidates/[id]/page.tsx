import { notFound } from "next/navigation";
import Link from "next/link";
import { AppShell, CandidateAvatar } from "@/components/recruiting/app-shell";
import { requireCurrentAccess } from "@/lib/auth/session";
import { EvidenceProfileRepository } from "@/features/candidates/repositories/evidence-profile-repository";
import { addEvidenceClaim, reviewEvidenceClaim, createCandidatePrivacyRequest, decideCandidatePrivacyRequest } from "../actions";
import { matchCandidate } from "../actions";
import { PositionRepository } from "@/features/positions/repositories/position-repository";
import { EvaluationRepository } from "@/features/evaluations/repositories/evaluation-repository";
import { roleCan } from "@/features/organizations/schemas/access";
import { CandidatePrivacyRepository } from "@/features/candidates/repositories/candidate-privacy-repository";
const title = (value: unknown) => String(value ?? "").replaceAll("_", " ");
export default async function CandidatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ position?: string }>;
}) {
  const access = await requireCurrentAccess();
  const { id } = await params;
  const selectedPosition=(await searchParams).position;
  const [profile,positions,evaluationValue,privacyRequests] = await Promise.all([new EvidenceProfileRepository().getProfile(access.organization.id,id),new PositionRepository().list(access.organization.id),selectedPosition?new EvaluationRepository().latest(access.organization.id,id,selectedPosition):Promise.resolve(null),new CandidatePrivacyRepository().list(access.organization.id,id)]);
  const evaluation=evaluationValue as (Record<string,unknown>&{criteria:Record<string,unknown>[]})|null;
  if (!profile) notFound();
  const candidate = profile.candidate,
    name = String(candidate.display_name);
  const canManageCandidates=roleCan(access.membership.role,"candidates:manage");
  const canManageOrganization=roleCan(access.membership.role,"organization:manage");
  const canExport=roleCan(access.membership.role,"candidates:export");
  const claims = access.membership.role === "technical_reviewer"
    ? profile.claims.filter((claim) => !/(ctc|compensation|salary|pay)/i.test(`${claim.label} ${claim.claim_type}`))
    : profile.claims;
  const grouped = Object.groupBy(claims, (c) => String(c.claim_type));
  const reviewed = claims.filter((c) => c.latest_review_action).length;
  const unknown = [
    "Notice period",
    "Expected CTC",
    "Preferred location",
  ].filter(
    (label) =>
      !claims.some((c) =>
        String(c.label).toLowerCase().includes(label.toLowerCase()),
      ),
  );
  return (
    <AppShell active="candidates">
      <div className="detail-title">
        <Link href="/candidates">← Candidates</Link>
        <div className="candidate-hero">
          <CandidateAvatar
            initials={name
              .split(/\s+/)
              .map((v) => v[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          />
          <div>
            <h1>{name}</h1>
            <p>
              {candidate.headline
                ? String(candidate.headline)
                : "Awaiting recruiter review"}
              {candidate.location ? ` · ${candidate.location}` : ""}
            </p>
          </div>
          <span className="stage needs_review">Human review required</span>
        </div>
      </div>
      <div className="tabs">
        <span className="active">Evidence profile</span>
        <span>Sources ({profile.sources.length})</span>
        <span>Applications</span>
        <span>Activity</span>
      </div>
      <section className="surface candidate-match-panel">
        <div><span className="eyebrow">POSITION-SPECIFIC EVALUATION</span><h2>{selectedPosition?String(positions.find(p=>String(p.id)===selectedPosition)?.title??"Selected position"):"Choose a position to evaluate"}</h2><p>Role fit is contextual. Evidence confidence reflects what the current sources can support.</p></div>
        <form><select name="position" defaultValue={selectedPosition??""} aria-label="Position evaluation context"><option value="">Select approved position</option>{positions.map(p=><option key={String(p.id)} value={String(p.id)}>{String(p.title)} · {String(p.rubric_status)}</option>)}</select><button className="button secondary">View</button></form>
      </section>
      {selectedPosition && !evaluation && <form action={matchCandidate} className="surface empty-evaluation"><input type="hidden" name="candidateId" value={id}/><input type="hidden" name="positionId" value={selectedPosition}/><div><h2>Not matched</h2><p>Evaluate the current evidence snapshot against the human-approved rubric. This will not create an application or hiring decision.</p></div><button className="button primary">Match against JD</button></form>}
      {evaluation && <section className="surface scorecard"><div className="scorecard-header"><div><span className="eyebrow">RUBRIC VERSION {String(evaluation.rubric_version)} · {String(evaluation.state)}</span><h2>Explainable scorecard</h2><p>{String(evaluation.recommendation).replaceAll("_"," ")} · {evaluation.current_rubric_version!==evaluation.rubric_version?"Stale — rerun required":"Current evaluation"}</p></div><div className="score-pair"><span><strong>{String(evaluation.role_fit)}</strong>Role fit</span><span><strong>{String(evaluation.evidence_confidence)}</strong>Evidence confidence</span></div></div>{(evaluation.criteria as Record<string,unknown>[]).map(criterion=><details className="criterion-result" key={String(criterion.id)}><summary><div><strong>{String(criterion.name)}</strong><span>{title(criterion.classification)} · {String(criterion.weight)}% weight</span></div><span className={`stage ${String(criterion.rating)}`}>{title(criterion.rating)}</span></summary><p>{String(criterion.reasoning)}</p><div className="criterion-metrics"><span>Criterion score <strong>{String(criterion.score)}</strong></span><span>Evidence confidence <strong>{String(criterion.evidence_confidence)}</strong></span></div>{Array.isArray(criterion.gaps)&&(criterion.gaps as string[]).map(gap=><p className="verification-gap" key={gap}>? {gap}</p>)}</details>)}<form action={matchCandidate}><input type="hidden" name="candidateId" value={id}/><input type="hidden" name="positionId" value={selectedPosition}/><button className="button secondary">Re-run with current evidence</button></form><small>AI-assisted recommendation only. A panel records the hiring decision separately.</small></section>}
      <div className="detail-grid">
        <main className="surface profile-content">
          <span className="eyebrow">AUDITABLE CAREER PROFILE</span>
          <h2>Claims, not conclusions</h2>
          <p>
            Every fact retains its source and extraction version. Corrections
            are appended so the original model output remains available.
          </p>
          {claims.length === 0 ? (
            <div className="empty-state">
              <h3>No evidence claims yet</h3>
              <p>
                Add a claim from an authorized source. Unknown information stays
                unknown.
              </p>
            </div>
          ) : (
            Object.entries(grouped).map(([kind, items]) => (
              <section className="claim-group" key={kind}>
                <h3>{title(kind)}</h3>
                {items!.map((claim) => (
                  <details className="claim-card" key={String(claim.id)}>
                    <summary>
                      <div>
                        <strong>
                          {String(claim.latest_review_action) === "correct"
                            ? String(claim.corrected_value)
                            : String(claim.claim_value)}
                        </strong>
                        <span>
                          {String(claim.label)} · {title(claim.claim_status)}
                        </span>
                      </div>
                      <span
                        className={`claim-confidence ${claim.latest_review_action ? "reviewed" : ""}`}
                      >
                        {claim.latest_review_action
                          ? title(claim.latest_review_action)
                          : `${Math.round(Number(claim.confidence) * 100)}% source confidence`}
                      </span>
                    </summary>
                    <div className="claim-detail">
                      <blockquote>
                        “
                        {String(
                          claim.excerpt ?? "No excerpt coordinates available",
                        )}
                        ”
                      </blockquote>
                      <dl>
                        <div>
                          <dt>Source</dt>
                          <dd>{String(claim.source_label)}</dd>
                        </div>
                        <div>
                          <dt>Location</dt>
                          <dd>
                            {claim.page_number
                              ? `Page ${claim.page_number}`
                              : String(
                                  claim.section_label ?? "Section unavailable",
                                )}
                          </dd>
                        </div>
                        <div>
                          <dt>Extractor</dt>
                          <dd>{String(claim.extractor_version)}</dd>
                        </div>
                      </dl>
                    {Boolean(claim.review_reason) && (
                        <p className="review-history">
                          Latest review: {title(claim.latest_review_action)} —{" "}
                          {String(claim.review_reason)}. Original retained.
                        </p>
                      )}
                      {canManageCandidates && <form
                        action={reviewEvidenceClaim}
                        className="claim-review-form"
                      >
                        <input type="hidden" name="candidateId" value={id} />
                        <input
                          type="hidden"
                          name="claimId"
                          value={String(claim.id)}
                        />
                        <input
                          name="reason"
                          required
                          minLength={3}
                          placeholder="Review reason"
                          aria-label="Review reason"
                        />
                        <input
                          name="correctedValue"
                          placeholder="Corrected value (only for correction)"
                          aria-label="Corrected value"
                        />
                        <button
                          name="action"
                          value="confirm"
                          className="button secondary"
                        >
                          Confirm
                        </button>
                        <button
                          name="action"
                          value="correct"
                          className="button secondary"
                        >
                          Correct
                        </button>
                        <button
                          name="action"
                          value="reject"
                          className="button ghost"
                        >
                          Reject
                        </button>
                      </form>}
                    </div>
                  </details>
                ))}
              </section>
            ))
          )}
          {canManageCandidates && <section className="add-claim">
            <h3>Add recruiter-evidenced claim</h3>
            <form action={addEvidenceClaim} className="claim-add-form">
              <input type="hidden" name="candidateId" value={id} />
              <select name="claimType" aria-label="Claim type">
                {[
                  "employment",
                  "education",
                  "project",
                  "skill",
                  "certification",
                  "language",
                  "logistics",
                  "other",
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
              <input
                name="label"
                required
                placeholder="Label, e.g. Notice period"
              />
              <input name="value" required placeholder="Verified value" />
              <select name="sourceId" aria-label="Evidence source">
                {profile.sources.map((s) => (
                  <option key={String(s.id)} value={String(s.id)}>
                    {String(s.source_label)}
                  </option>
                ))}
              </select>
              <input name="section" placeholder="Page or section" />
              <textarea name="excerpt" placeholder="Supporting excerpt" />
              <button className="button primary">Add claim</button>
            </form>
          </section>}
        </main>
        <aside className="surface overview-panel">
          <span className="eyebrow">PROFILE OVERVIEW</span>
          <div className="big-metric">
            <strong>{claims.length}</strong>
            <span>evidence claims</span>
          </div>
          <div className="rubric-item">
            <span>Human reviewed</span>
            <strong>
              {reviewed}/{claims.length}
            </strong>
          </div>
          <div className="rubric-item">
            <span>Primary skills</span>
            <strong>
              {(grouped.skill ?? [])
                .slice(0, 3)
                .map((v) => String(v.claim_value))
                .join(", ") || "Unknown"}
            </strong>
          </div>
          <h3>Needs verification</h3>
          {unknown.map((item) => (
            <div className="verification-gap" key={item}>
              <span>?</span>
              <div>
                <strong>{item}</strong>
                <small>Not found in approved evidence</small>
              </div>
            </div>
          ))}
          <p className="privacy-callout">
            Protected attributes are excluded from evidence and future matching
            inputs.
          </p>
        </aside>
      </div>
      <section className="surface privacy-center">
        <div className="privacy-center-header"><div><span className="eyebrow">CANDIDATE PRIVACY</span><h2>Correction, export and deletion</h2><p>Sorted uses authorized candidate sources to support human recruiting decisions. Candidates may request a copy, correction, deletion or outreach opt-out. Approved deletion irreversibly removes direct identifiers and private files while retaining anonymized decision records required for accountability.</p></div>{canExport&&candidate.profile_status!=="anonymized"?<a className="button secondary" href={`/api/candidates/${id}/export`}>Download data export</a>:null}</div>
        {canManageCandidates&&candidate.profile_status!=="anonymized"?<form action={createCandidatePrivacyRequest} className="privacy-request-form"><input type="hidden" name="candidateId" value={id}/><select name="requestType" aria-label="Privacy request type"><option value="correction">Correction request</option><option value="export">Data export request</option><option value="deletion">Deletion request</option></select><textarea name="details" required minLength={10} placeholder="Record the candidate’s request and verification context"/><button className="button primary">Record request</button></form>:<p className="privacy-callout">This profile has been irreversibly anonymized. Historical evaluation and human-decision records remain for auditability.</p>}
        <div className="privacy-request-list">{privacyRequests.length===0?<p>No privacy requests recorded.</p>:privacyRequests.map(request=><article key={String(request.id)} className="privacy-request"><div><strong>{title(request.request_type)} request</strong><span className={`stage ${String(request.status)}`}>{title(request.status)}</span><p>{String(request.details)}</p>{request.decision_rationale?<small>Decision rationale: {String(request.decision_rationale)}</small>:null}</div>{canManageOrganization&&request.status==="requested"?<form action={decideCandidatePrivacyRequest}><input type="hidden" name="candidateId" value={id}/><input type="hidden" name="requestId" value={String(request.id)}/><input name="rationale" required minLength={10} placeholder="Decision rationale"/><button className="button secondary" name="decision" value="approve">Approve</button><button className="button ghost" name="decision" value="decline">Decline</button></form>:null}</article>)}</div>
      </section>
    </AppShell>
  );
}
