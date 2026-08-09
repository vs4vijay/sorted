import Link from 'next/link';
import { AppShell, CandidateAvatar, PageHeader } from '@/components/recruiting/app-shell';
import { Icon } from '@/components/recruiting/icons';
import { recruitingService } from '@/features/sorted/services/recruiting-service';
import { getCurrentAccess } from '@/lib/auth/session';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const access = await getCurrentAccess();
  if (!access) redirect('/setup');
  const [positions, candidates] = await Promise.all([recruitingService.listPositions(), recruitingService.listCandidates()]);
  const reviewed = candidates.filter((candidate) => candidate.stage === 'under_review');
  return <AppShell active="dashboard">
    <PageHeader eyebrow="SUNDAY, 9 AUGUST" title="Good morning, Ananya" description="Here’s what your hiring team needs to move forward today." action={<Link className="button secondary" href="/positions/new"><Icon name="plus" size={16}/> Create position</Link>}/>
    <section className="stats-grid" aria-label="Hiring overview">
      {[['Active positions', '3', '+1 this month'], ['Candidates', '18', '6 added this week'], ['Awaiting review', '5', '2 overdue'], ['Shortlisted', '4', 'Across 2 positions']].map(([label, value, note], index) => <div className="stat-card" key={label}><span>{label}</span><strong>{value}</strong><small className={index === 2 ? 'warning' : ''}>{note}</small></div>)}
    </section>
    <div className="dashboard-grid">
      <section><div className="section-heading"><div><span className="eyebrow">PRIORITY QUEUE</span><h2>Needs your attention</h2></div><Link href="/candidates">View all <Icon name="arrow" size={14}/></Link></div>
        <div className="stack-card">
          <div className="attention-item"><div className="attention-icon amber"><Icon name="clock"/></div><div className="attention-copy"><div><span className="pill amber">2 overdue</span><h3>Candidate reviews waiting</h3></div><p>Two backend candidates have been waiting for panel feedback for more than 24 hours.</p><div className="candidate-stack">{reviewed.slice(0,3).map((candidate, index) => <CandidateAvatar key={candidate.id} initials={candidate.initials} index={index}/>)}</div></div><Link className="round-link" href="/candidates"><Icon name="arrow"/></Link></div>
          <div className="attention-item"><div className="attention-icon green"><Icon name="check"/></div><div className="attention-copy"><div><span className="pill green">Ready</span><h3>Product Designer rubric</h3></div><p>The draft evaluation rubric is ready for hiring-manager approval before screening can begin.</p><div className="mini-meta"><span className="avatar micro">VS</span> Vikram Shah · Hiring manager</div></div><Link className="round-link" href="/positions/product-designer"><Icon name="arrow"/></Link></div>
          <div className="attention-item"><div className="attention-icon purple"><Icon name="send"/></div><div className="attention-copy"><div><span className="pill purple">3 replies</span><h3>Candidate responses received</h3></div><p>Shortlisted candidates have replied with notice period and expected CTC details.</p><div className="mini-meta">Last reply 38 minutes ago</div></div><Link className="round-link" href="/outreach"><Icon name="arrow"/></Link></div>
        </div>
      </section>
      <aside><div className="section-heading"><div><span className="eyebrow">PIPELINE</span><h2>Position progress</h2></div><Link href="/positions">All positions</Link></div><div className="position-stack">{positions.map((position, index) => <Link className="position-card" href={`/positions/${position.id}`} key={position.id}><div className={`position-symbol tone-${index}`}><Icon name="briefcase"/></div><div><h3>{position.title}</h3><p>{position.location}</p><div className="progress"><i style={{width: `${position.candidateCount ? Math.max(18, position.reviewedCount / position.candidateCount * 100) : 8}%`}}/></div><small>{position.candidateCount} candidates · {position.reviewedCount} reviewed</small></div><Icon name="arrow" size={15}/></Link>)}</div></aside>
    </div>
    <section className="ai-note"><span className="ai-icon"><Icon name="spark"/></span><div><span className="eyebrow">SORTED INSIGHT · SIMULATED</span><h2>Your backend shortlist is taking shape</h2><p>Three candidates have strong distributed-systems evidence. Two still need technical review before the panel can decide.</p></div><Link className="button dark" href="/positions/senior-backend-engineer">Review shortlist <Icon name="arrow" size={15}/></Link></section>
  </AppShell>;
}
