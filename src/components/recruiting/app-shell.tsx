import Link from 'next/link';
import { Icon } from './icons';
import { signOut } from '@/app/auth-actions';
import { getCurrentAccess } from '@/lib/auth/session';
import { roleCan } from '@/features/organizations/schemas/access';
import { CandidateIngestionRepository } from '@/features/candidates/repositories/candidate-ingestion-repository';

const navigation = [
  { href: '/', label: 'Dashboard', icon: 'grid' as const },
  { href: '/positions', label: 'Positions', icon: 'briefcase' as const },
  { href: '/candidates', label: 'Candidates', icon: 'users' as const },
  { href: '/reviews', label: 'Reviews', icon: 'check' as const },
  { href: '/outreach', label: 'Outreach', icon: 'send' as const },
];

export async function AppShell({ active, children }: { active: string; children: React.ReactNode }) {
  const access = await getCurrentAccess();
  const candidateCount = access ? await new CandidateIngestionRepository().countCandidates(access.organization.id) : 0;
  const canManageMembers = access ? roleCan(access.membership.role, 'members:manage') : false;
  const canImportCandidates = access ? roleCan(access.membership.role, 'candidates:manage') : false;
  const initials = access?.userName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() ?? '—';
  return <div className="app-shell">
    <aside className="sidebar">
      <Link className="brand" href="/" aria-label="Sorted home"><span className="brand-mark"><Icon name="check" size={15}/></span><span>sorted</span></Link>
      <div className="workspace"><div className="workspace-avatar">{access?.organization.name.slice(0, 2).toUpperCase() ?? '—'}</div><div><strong>{access?.organization.name ?? 'Sorted'}</strong><span>Recruiting workspace</span></div></div>
      <nav aria-label="Primary navigation">{navigation.map((item) => <Link key={item.href} className={active === item.label.toLowerCase() ? 'nav-link active' : 'nav-link'} href={item.href}><Icon name={item.icon}/><span>{item.label}</span>{item.label === 'Candidates' && candidateCount > 0 && <em>{candidateCount}</em>}</Link>)}</nav>
      <div className="sidebar-foot">{canManageMembers && <Link className="quiet-link" href="/settings/members">Manage panel <span>＋</span></Link>}<div className="profile"><div className="avatar sm">{initials}</div><div><strong>{access?.userName ?? 'Signed out'}</strong><span>{access?.membership.role.replaceAll('_', ' ') ?? ''}</span></div><form action={signOut}><button className="quiet-link" aria-label="Sign out" title="Sign out">↗</button></form></div></div>
    </aside>
    <div className="workspace-main">
      <header className="global-header"><div className="global-search"><Icon name="search" size={17}/><span>Search candidates, positions…</span><kbd>⌘ K</kbd></div><button className="icon-button" aria-label="Notifications"><Icon name="bell" size={18}/><i/></button>{canImportCandidates && <Link href="/candidates?import=true" className="button primary"><Icon name="upload" size={16}/> Import candidates</Link>}</header>
      <main className="page">{children}</main>
    </div>
  </div>;
}

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="page-header"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

export function CandidateAvatar({ initials, index = 0 }: { initials: string; index?: number }) { return <div className={`avatar tone-${index % 5}`}>{initials}</div>; }
