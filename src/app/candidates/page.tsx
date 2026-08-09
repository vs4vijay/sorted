import Link from 'next/link';
import { AppShell, CandidateAvatar, PageHeader } from '@/components/recruiting/app-shell';
import { Icon } from '@/components/recruiting/icons';
import { requirePageAccess } from '@/lib/auth/session';
import { CandidateIngestionRepository } from '@/features/candidates/repositories/candidate-ingestion-repository';
import { PositionRepository } from '@/features/positions/repositories/position-repository';
import { EvaluationRepository } from '@/features/evaluations/repositories/evaluation-repository';
import { CandidateImportForm } from './import-form';
import { ProgressRefresh } from './progress-refresh';
import { matchCandidate, mergeDuplicate, retryDocumentSecurityScan } from './actions';

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{ import?: string; position?: string }>;
}) {
  const access = await requirePageAccess();
  const params = await searchParams;
  const repo = new CandidateIngestionRepository();
  const positions = await new PositionRepository().list(access.organization.id);
  const selected = positions.some((position) => String(position.id) === params.position)
    ? params.position
    : undefined;
  const [candidates, runs, duplicates, quarantined] = await Promise.all([
    new EvaluationRepository().listCandidates(access.organization.id, selected),
    repo.listRuns(access.organization.id),
    repo.listDuplicates(access.organization.id),
    repo.listQuarantined(access.organization.id),
  ]);
  const showImport = params.import === 'true' || runs.length === 0;
  const active = runs.some((run) => String(run.status) === 'processing');
  return (
    <AppShell active="candidates">
      <ProgressRefresh active={active} />
      <PageHeader
        title="Candidates"
        description={
          selected
            ? 'Position-specific role fit and evidence confidence.'
            : 'Organization talent pool · no universal candidate score.'
        }
        action={
          !showImport ? (
            <Link className="button primary" href="/candidates?import=true">
              <Icon name="upload" size={16} /> Import candidates
            </Link>
          ) : undefined
        }
      />
      {showImport && (
        <CandidateImportForm
          positions={positions.map((position) => ({
            id: String(position.id),
            title: String(position.title),
          }))}
        />
      )}
      <form className="surface matching-context">
        <label htmlFor="position-context">
          <span className="eyebrow">MATCHING CONTEXT</span>
          <strong>Choose an approved position</strong>
        </label>
        <select id="position-context" name="position" defaultValue={selected ?? ''}>
          <option value="">All candidates · profile evidence only</option>
          {positions.map((position) => (
            <option key={String(position.id)} value={String(position.id)}>
              {String(position.title)} · rubric {String(position.rubric_status)}
            </option>
          ))}
        </select>
        <button className="button secondary">Apply context</button>
      </form>
      {runs.length > 0 && (
        <section className="surface batch-panel">
          <span className="eyebrow">IMPORT ACTIVITY</span>
          {runs.slice(0, 2).map((run) => (
            <div className="batch-row" key={String(run.id)}>
              <div>
                <strong>{Number(run.total_count)} CV batch</strong>
                <span>{String(run.status).replaceAll('_', ' ')}</span>
              </div>
            </div>
          ))}
        </section>
      )}
      {quarantined.length > 0 && (
        <section className="surface duplicate-panel" aria-labelledby="quarantine-heading">
          <span className="eyebrow">DOCUMENT SECURITY</span>
          <h2 id="quarantine-heading">Uploads isolated from candidate processing</h2>
          <p>
            These files cannot be opened or extracted. Retry a failed scanner check after recovery;
            replace a detected threat with a clean CV.
          </p>
          {quarantined.map((document) => (
            <div className="duplicate-row" key={String(document.id)}>
              <div>
                <strong>{String(document.original_filename)}</strong>
                <span>
                  {String(document.malware_scan_error ?? 'Security review required')} ·{' '}
                  {String(document.malware_scan_provider ?? 'scanner unavailable')}
                </span>
              </div>
              {String(document.malware_scan_status) === 'scan_failed' ? (
                <form action={retryDocumentSecurityScan}>
                  <input type="hidden" name="documentId" value={String(document.id)} />
                  <button className="button secondary">Retry security scan</button>
                </form>
              ) : (
                <span className="stage failed">Threat isolated</span>
              )}
            </div>
          ))}
        </section>
      )}
      {duplicates.length > 0 && (
        <section className="surface duplicate-panel">
          <span className="eyebrow">HUMAN REVIEW REQUIRED</span>
          <h2>Potential duplicate identities</h2>
          {duplicates.map((duplicate) => (
            <div className="duplicate-row" key={String(duplicate.id)}>
              <strong>
                {String(duplicate.candidate_name)} may match {String(duplicate.possible_name)}
              </strong>
              <form action={mergeDuplicate}>
                <input type="hidden" name="reviewId" value={String(duplicate.id)} />
                <button className="button secondary">Review and merge</button>
              </form>
            </div>
          ))}
        </section>
      )}
      <section className="surface table-surface">
        {candidates.length === 0 ? (
          <div className="empty-state">
            <h2>No candidates yet</h2>
            <p>Import synthetic CVs to create persistent talent-pool profiles.</p>
          </div>
        ) : (
          candidates.map((candidate, index) => (
            <div className="match-candidate-row" key={String(candidate.id)}>
              <Link
                className="candidate-cell"
                href={`/candidates/${candidate.id}${selected ? `?position=${selected}` : ''}`}
              >
                <CandidateAvatar
                  initials={String(candidate.display_name)
                    .split(/\s+/)
                    .map((value) => value[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                  index={index}
                />
                <div>
                  <h3>{String(candidate.display_name)}</h3>
                  <p>
                    {candidate.headline ? String(candidate.headline) : 'Awaiting recruiter review'}{' '}
                    · {Number(candidate.source_count)} source(s)
                  </p>
                </div>
              </Link>
              {selected ? (
                candidate.role_fit == null ? (
                  <form action={matchCandidate}>
                    <input type="hidden" name="candidateId" value={String(candidate.id)} />
                    <input type="hidden" name="positionId" value={selected} />
                    <span className="stage">Not matched</span>
                    <button className="button primary">Match against JD</button>
                  </form>
                ) : (
                  <div className="score-pair">
                    <span>
                      <strong>{String(candidate.role_fit)}</strong>Role fit
                    </span>
                    <span>
                      <strong>{String(candidate.evidence_confidence)}</strong>Evidence confidence
                    </span>
                    <Link
                      className="button secondary"
                      href={`/candidates/${candidate.id}?position=${selected}`}
                    >
                      View scorecard
                    </Link>
                  </div>
                )
              ) : (
                <span className="stage">
                  {String(candidate.profile_status).replaceAll('_', ' ')}
                </span>
              )}
            </div>
          ))
        )}
      </section>
    </AppShell>
  );
}
