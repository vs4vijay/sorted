import Link from 'next/link';
import { Icon } from './icons';
import { signOut } from '@/app/auth-actions';

const navigation = [
  { href: '/', label: 'Dashboard', icon: 'grid' as const },
  { href: '/positions', label: 'Positions', icon: 'briefcase' as const },
  { href: '/candidates', label: 'Candidates', icon: 'users' as const },
  { href: '/outreach', label: 'Outreach', icon: 'send' as const },
];

export function AppShell({ active, children }: { active: string; children: React.ReactNode }) {
  return <div className="app-shell">
    <aside className="sidebar">
      <Link className="brand" href="/" aria-label="Sorted home"><span className="brand-mark"><Icon name="check" size={15}/></span><span>sorted</span></Link>
      <div className="workspace"><div className="workspace-avatar">AI</div><div><strong>Acme India</strong><span>Recruiting workspace</span></div><span className="chevron">⌄</span></div>
      <nav aria-label="Primary navigation">{navigation.map((item) => <Link key={item.href} className={active === item.label.toLowerCase() ? 'nav-link active' : 'nav-link'} href={item.href}><Icon name={item.icon}/><span>{item.label}</span>{item.label === 'Candidates' && <em>18</em>}</Link>)}</nav>
      <div className="sidebar-foot"><button className="quiet-link">Invite panel member <span>＋</span></button><div className="profile"><div className="avatar sm">AR</div><div><strong>Ananya Rao</strong><span>Recruiter</span></div><form action={signOut}><button className="quiet-link" aria-label="Sign out" title="Sign out">↗</button></form></div></div>
    </aside>
    <div className="workspace-main">
      <header className="global-header"><div className="global-search"><Icon name="search" size={17}/><span>Search candidates, positions…</span><kbd>⌘ K</kbd></div><button className="icon-button" aria-label="Notifications"><Icon name="bell" size={18}/><i/></button><Link href="/candidates?import=true" className="button primary"><Icon name="upload" size={16}/> Import candidates</Link></header>
      <main className="page">{children}</main>
    </div>
  </div>;
}

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="page-header"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

export function CandidateAvatar({ initials, index = 0 }: { initials: string; index?: number }) { return <div className={`avatar tone-${index % 5}`}>{initials}</div>; }
