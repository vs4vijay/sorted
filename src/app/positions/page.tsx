import Link from 'next/link';
import { AppShell, PageHeader } from '@/components/recruiting/app-shell';
import { Icon } from '@/components/recruiting/icons';
import { recruitingService } from '@/features/sorted/services/recruiting-service';
import { getCurrentAccess } from '@/lib/auth/session';
import { PositionRepository } from '@/features/positions/repositories/position-repository';

export default async function PositionsPage() {
  const access = await getCurrentAccess();
  const stored = access ? await new PositionRepository().list(access.organization.id) : [];
  const positions = stored.length ? stored.map((row)=>({id:String(row.id),title:String(row.title),location:String(row.location??'Location flexible'),employmentType:String(row.employment_type),status:String(row.status),panel:[],candidateCount:0,reviewedCount:0})) : await recruitingService.listPositions();
  return <AppShell active="positions"><PageHeader title="Positions" description="Create roles, approve fair evaluation rubrics, and follow every shortlist." action={<Link className="button primary" href="/positions/new"><Icon name="plus" size={16}/> Create position</Link>}/><div className="toolbar"><div className="search-field"><Icon name="search" size={16}/> Search positions</div><button className="button ghost"><Icon name="filter" size={15}/> Filter</button></div><div className="cards-grid">{positions.map((position, index) => <Link href={`/positions/${position.id}`} className="large-card" key={position.id}><div className="card-top"><span className={`position-symbol tone-${index}`}><Icon name="briefcase"/></span><span className={`status ${position.status}`}>{position.status.replace('_', ' ')}</span></div><h2>{position.title}</h2><p>{position.location} · {position.employmentType}</p><div className="panel-row">{position.panel.map((member, memberIndex) => <span className={`avatar sm tone-${memberIndex}`} key={member.initials}>{member.initials}</span>)}<small>{position.panel.length} panel member{position.panel.length === 1 ? '' : 's'}</small></div><div className="card-footer"><span><strong>{position.candidateCount}</strong> Candidates</span><span><strong>{position.reviewedCount}</strong> Reviewed</span><Icon name="arrow"/></div></Link>)}</div></AppShell>;
}
