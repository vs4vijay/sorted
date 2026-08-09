import { notFound } from "next/navigation";
import Link from "next/link";
import { AppShell, CandidateAvatar } from "@/components/recruiting/app-shell";
import { requireCurrentAccess } from "@/lib/auth/session";
import { CandidateIngestionRepository } from "@/features/candidates/repositories/candidate-ingestion-repository";
import { privateDocumentStorage } from "@/features/candidates/services/private-document-storage";
import { addExternalSource } from "../actions";
export default async function CandidatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const access = await requireCurrentAccess();
  const { id } = await params;
  const candidate = await new CandidateIngestionRepository().getCandidate(
    access.organization.id,
    id,
  );
  if (!candidate) notFound();
  const name = String(candidate.display_name);
  const sources = candidate.sources as Record<string, unknown>[];
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
          <button className="button secondary">Review profile</button>
        </div>
      </div>
      <div className="tabs">
        <span className="active">Sources</span>
        <span>Evidence profile</span>
        <span>Applications</span>
        <span>Activity</span>
      </div>
      <div className="detail-grid">
        <section className="surface profile-content">
          <span className="eyebrow">SOURCE PROVENANCE</span>
          <h2>
            {sources.length} immutable candidate source
            {sources.length === 1 ? "" : "s"}
          </h2>
          <p>
            Extracted claims remain unverified until recruiter review. Original
            documents are served only through short-lived,
            organization-authorized links.
          </p>
          <form action={addExternalSource} className="source-add-form">
            <input type="hidden" name="candidateId" value={id} />
            <select name="provider" aria-label="Profile source">
              <option value="github">GitHub URL</option>
              <option value="portfolio">Portfolio URL</option>
              <option value="linkedin">Authorized LinkedIn reference</option>
            </select>
            <input
              name="url"
              type="url"
              required
              placeholder="https://…"
              aria-label="Profile URL"
            />
            <button className="button secondary">Add source</button>
          </form>
          <div className="source-list">
            {sources.map((source) => {
              const signed = source.storage_key
                ? privateDocumentStorage.sign(String(source.storage_key))
                : null;
              return (
                <article className="source-card" key={String(source.id)}>
                  <div>
                    <strong>{String(source.source_label)}</strong>
                    <span>
                      {String(source.source_type).replaceAll("_", " ")} ·{" "}
                      {String(source.permission_method).replaceAll("_", " ")}
                    </span>
                  </div>
                  <span className={`stage ${source.status}`}>
                    {String(source.status).replaceAll("_", " ")}
                  </span>
                  <dl>
                    <div>
                      <dt>Imported</dt>
                      <dd>
                        {new Date(String(source.imported_at)).toLocaleString(
                          "en-IN",
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Safety</dt>
                      <dd>
                        {source.malware_scan_status
                          ? String(source.malware_scan_status).replaceAll(
                              "_",
                              " ",
                            )
                          : "Reference only"}
                      </dd>
                    </div>
                    <div>
                      <dt>Extractor</dt>
                      <dd>
                        {source.extractor
                          ? `${source.extractor} ${source.extractor_version}`
                          : "No scraping performed"}
                      </dd>
                    </div>
                    <div>
                      <dt>Pages</dt>
                      <dd>
                        {source.page_count ? String(source.page_count) : "—"}
                      </dd>
                    </div>
                  </dl>
                {signed && Boolean(source.document_id) && (
                    <Link
                      className="button secondary"
                      href={`/api/candidate-documents/${source.document_id}?expires=${signed.expires}&signature=${signed.signature}`}
                      target="_blank"
                    >
                      Open private source
                    </Link>
                  )}
                </article>
              );
            })}
          </div>
        </section>
        <aside className="surface overview-panel">
          <span className="eyebrow">PROFILE CONTROL</span>
          <div className="big-metric">
            <strong>
              {String(candidate.profile_status).replaceAll("_", " ")}
            </strong>
          </div>
          <div className="rubric-item">
            <span>Canonical profile</span>
            <strong>Organization scoped</strong>
          </div>
          <div className="rubric-item">
            <span>Model status</span>
            <strong>Human review required</strong>
          </div>
          <div className="rubric-item">
            <span>Applications</span>
            <strong>Position specific</strong>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
