'use client';

import { useState } from 'react';

type View = 'dashboard' | 'inbox' | 'workflows';

const conversations = [
  { name:'Rahul Sharma', initials:'RS', preview:'Kal 6 baje AC service ke liye aa sakte ho?', tag:'Quote + booking', time:'12m', color:'#c5d7ca' },
  { name:'Priya Nair', initials:'PN', preview:'Thanks, I will confirm by evening.', tag:'Waiting', time:'31m', color:'#ead6bf' },
  { name:'Ahmed Khan', initials:'AK', preview:'The installation is still not complete.', tag:'Needs action', time:'2h', color:'#d8d3e8' },
  { name:'Sarah D\'Souza', initials:'SD', preview:'Could you send the updated invoice?', tag:'Invoice', time:'4h', color:'#cbdbe3' },
  { name:'Meera Iyer', initials:'MI', preview:'हाँ, कल दोपहर ठीक रहेगा।', tag:'AI handled', time:'1d', color:'#e1cfce' },
];

const workflowItems = [
  ['Quote information collector','Active · 18 runs'],
  ['Unanswered quote follow-up','Active · 7 runs'],
  ['Complaint recovery','Paused · 3 runs'],
  ['Booking confirmation','Draft · Never run'],
];

function Sidebar({ view, setView }:{ view:View; setView:(v:View)=>void }) {
  return <aside className="sidebar">
    <div className="brand"><span className="brand-mark">✓</span><span>sorted</span></div>
    <nav className="nav">
      <button className={view==='dashboard'?'active':''} onClick={()=>setView('dashboard')}><span className="nav-icon">⌂</span><span>Dashboard</span></button>
      <button className={view==='inbox'?'active':''} onClick={()=>setView('inbox')}><span className="nav-icon">✦</span><span>AI Inbox</span></button>
      <button className={view==='workflows'?'active':''} onClick={()=>setView('workflows')}><span className="nav-icon">◇</span><span>Workflows</span></button>
    </nav>
    <div className="side-label">Recent</div>
    <div className="recent">Follow up quote — Rahul</div>
    <div className="recent">Booking request — Priya</div>
    <div className="recent">Complaint recovery</div>
    <div className="sidebar-bottom">
      <div className="recent">⚙ &nbsp; Settings</div>
      <div className="profile"><div className="avatar">ER</div><div><b>Easwarendra</b><br/><span className="meta">Indira Services</span></div></div>
    </div>
  </aside>
}

function Header({ title, eyebrow, openComposer }:{title:string;eyebrow:string;openComposer:()=>void}) {
  return <div className="topbar"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1></div><div className="top-actions"><button className="icon-btn">⌕</button><button className="icon-btn">♢</button><button className="primary" onClick={openComposer}>＋ Create workflow</button></div></div>
}

function Dashboard({ openComposer, setView }:{openComposer:()=>void;setView:(v:View)=>void}) {
  const stats=[['Needs attention','7','2 new'],['Waiting on customer','4',''],['Active workflows','3','94% healthy'],['Completed today','12','↑ 18%']];
  const bars=[[7,11,14,10,19,21,17,24],[4,9,8,13,16,15,19,22],[9,12,8,16,14,21,19,23],[18,15,20,14,12,9,8,6]];
  return <>
    <Header eyebrow="SUNDAY, 9 AUGUST" title="Good morning, Easwarendra" openComposer={openComposer}/>
    <div className="command"><span className="command-star">✦</span><input placeholder="Ask Sorted anything…"/><span className="shortcut">⌘ K</span><div className="chips"><button className="chip">What needs me?</button><button className="chip">Show conversations waiting 24h+</button><button className="chip" onClick={openComposer}>Create a follow-up workflow</button></div></div>
    <div className="stats">{stats.map(s=><button className="stat" key={s[0]}><div className="stat-label">{s[0]}</div><div className="stat-value">{s[1]}<span className="stat-note">{s[2]}</span></div></button>)}</div>
    <div className="grid-main">
      <section><div className="section-title"><h2>Needs your attention</h2><button onClick={()=>setView('inbox')}>View inbox →</button></div>
        <div className="card attention"><div className="row-head"><div className="person"><div className="avatar">RS</div><div><div className="person-name">Rahul Sharma</div><div className="meta">Quote request · 12 min ago</div></div></div><span className="channel">◉ WhatsApp</span></div><p className="attention-copy">Customer wants AC servicing tomorrow evening, but pricing information is incomplete.</p><div className="suggestion">✦ Suggested next action<strong>Ask for AC model, exact address and a photo</strong></div><div className="actions"><button className="dark" onClick={()=>setView('inbox')}>Review reply</button><button onClick={openComposer}>Create workflow</button><button>Dismiss</button></div></div>
        <div className="card attention"><div className="row-head"><div className="person"><div className="avatar" style={{background:'#d9cfe7'}}>AK</div><div><div className="person-name">Ahmed Khan</div><div className="meta">Complaint · 2 hours ago</div></div></div><span className="channel">◉ WhatsApp</span></div><p className="attention-copy">Installation is incomplete after two visits. Sentiment has dropped and a personal response is recommended.</p><div className="actions"><button className="dark">Review response</button><button onClick={openComposer}>Create recovery workflow</button></div></div>
      </section>
      <aside><div className="section-title"><h2>Notifications</h2><button>Mark all read</button></div><div className="card right-card"><div className="notification"><i className="dot"/><span><b>Quote workflow needs approval</b><br/><span className="meta">Rahul is waiting for a reply</span></span><time>12m</time></div><div className="notification"><i className="dot" style={{background:'#ddb157'}}/><span><b>3 conversations need review</b><br/><span className="meta">Two have waited over an hour</span></span><time>1h</time></div><div className="notification"><i className="dot" style={{background:'#7caa82'}}/><span><b>Follow-up completed</b><br/><span className="meta">Priya received a reminder</span></span><time>3h</time></div></div><div className="section-title"><h2>Suggested automation</h2></div><div className="automation"><span className="spark">✦</span><p>You manually followed up unanswered quotes <b>6 times</b> this week.</p><button className="primary" onClick={openComposer}>Create workflow →</button></div></aside>
    </div>
    <div className="analytics">{[['Customer activity','32','conversations this week'],['AI suggestions','24','19 accepted · 4 edited'],['Workflow activity','18','94% successful'],['Response time','12m','median · down 21%']].map((m,i)=><div className="card metric" key={m[0]}><div className="metric-label">{m[0]}</div><strong>{m[1]}</strong><div className="meta">{m[2]}</div><div className="bars">{bars[i].map((h,j)=><i key={j} style={{height:h}}/>)}</div></div>)}</div>
  </>
}

function Inbox({ openComposer }:{openComposer:()=>void}) {
  const [selected,setSelected]=useState(0);
  return <><Header eyebrow="AI INBOX" title="Conversations" openComposer={openComposer}/><div className="inbox-layout">
    <div className="pane"><div className="pane-head"><h2>Inbox <span className="meta">7</span></h2><div className="filters"><button className="filter active">All</button><button className="filter">Needs action</button><button className="filter">Waiting</button></div></div>{conversations.map((c,i)=><button className={`conversation-row ${selected===i?'active':''}`} key={c.name} onClick={()=>setSelected(i)}><div className="conversation-top"><b>{c.name}</b><span className="meta">{c.time}</span></div><div className="preview">{c.preview}</div><span className="intent-tag">{c.tag}</span></button>)}</div>
    <div className="pane"><div className="pane-head"><div className="chat-head"><div className="avatar" style={{background:conversations[selected].color}}>{conversations[selected].initials}</div><div><div className="person-name">{conversations[selected].name}</div><div className="meta">WhatsApp · Active now</div></div></div></div><div className="chat-body"><div className="day">TODAY</div><div className="message"><div className="bubble">Namaste, kal 6 baje AC service ke liye aa sakte ho? Kitna charge hoga?</div><div className="message-info"><span>Hindi / Hinglish · View translation</span><span>10:42</span></div></div><div className="understood">✦ Sorted understood: <b>Quote request · Booking request</b></div><div className="message out"><div className="bubble">Namaste Rahul! Haan, kal 6 baje ka slot available hai. Sahi quote ke liye aap AC ka model aur ek photo share kar sakte hain?</div><div className="message-info"><span>Drafted with Sarvam-105B</span><span>10:43</span></div></div><div className="composer"><span>＋</span><input placeholder="Write a message…"/><button className="primary">Send</button></div></div></div>
    <div className="pane work-panel"><span className="ai-badge">✦ Sorted intelligence</span><div className="panel-block"><h3>Understanding</h3><div className="confidence"><span>Quote request</span><b>96%</b></div><div className="confidence"><span>Booking request</span><b>91%</b></div></div><div className="panel-block"><h3>Known</h3><div className="facts"><span>✓ AC servicing</span><span>✓ Tomorrow around 6 PM</span><span>✓ Indiranagar</span><span className="missing">○ Exact address</span><span className="missing">○ AC type / model</span></div></div><div className="panel-block"><h3>Recommended next action</h3><div className="recommend">Ask Rahul for the exact address, AC model and a photo of the unit.</div><div className="actions" style={{margin:'10px 0 0'}}><button className="dark">Use draft</button><button>▶ Voice preview</button></div></div><div className="panel-block"><h3>Workflow opportunity</h3><div className="recommend"><b>When quote details are missing</b><br/>Identify fields → ask customer → wait → prepare quote</div><button className="primary" style={{width:'100%',marginTop:10}} onClick={openComposer}>Create workflow</button></div><div className="sarvam-stack"><div className="sarvam-item"><span className="sarvam-logo">S</span><span><b>Saaras</b><br/>Speech transcribed · hi-IN</span></div><div className="sarvam-item"><span className="sarvam-logo">S</span><span><b>Sarvam-105B</b><br/>Intent + response reasoning</span></div><div className="sarvam-item"><span className="sarvam-logo">B</span><span><b>Bulbul</b><br/>Natural Hindi voice ready</span></div></div></div>
  </div></>
}

function Workflows({ openComposer, notify }:{openComposer:()=>void;notify:(s:string)=>void}) {
  const [running,setRunning]=useState(false);
  const run=()=>{setRunning(true);notify('Workflow started for Rahul Sharma');setTimeout(()=>setRunning(false),3200)};
  return <><Header eyebrow="AUTOMATIONS" title="Workflows" openComposer={openComposer}/><div className="workflow-grid"><div className="card workflow-list"><div className="section-title" style={{padding:'10px 10px 4px'}}><h2>All workflows</h2><button>Filter</button></div>{workflowItems.map((w,i)=><button className={`workflow-item ${i===0?'active':''}`} key={w[0]}><strong>{w[0]}</strong><span>{w[1]}</span></button>)}</div><div className="card workflow-main"><div className="workflow-header"><div><span className="status">● Active</span><h2>Quote information collector</h2><div className="meta">Triggered by incoming quote requests · Last run 12 min ago</div></div><div className="top-actions"><button className="secondary">Pause</button><button className="primary" onClick={run}>{running?'Running…':'▶ Run workflow'}</button></div></div><div className="tabs"><button className="tab active">Canvas</button><button className="tab">Runs <span className="meta">18</span></button><button className="tab">Logs</button></div><div className="canvas"><div className="flow"><div className="node"><small>Trigger</small><strong>New quote request</strong></div><div className="connector"/><div className={`node ${running?'active-node':''}`}><small>Sarvam-105B</small><strong>Extract quote requirements</strong></div><div className="connector"/><div className="diamond">Missing information?</div><div className="connector"/><div className="node-row"><div><div className="branch-label">YES</div><div className="node"><small>AI action</small><strong>Draft a question</strong></div></div><div><div className="branch-label">NO</div><div className="node"><small>Business action</small><strong>Prepare quote</strong></div></div></div><div className="connector"/><div className="node"><small>Human in the loop</small><strong>Wait for owner approval</strong></div><div className="connector"/><div className="node"><small>Bulbul / WhatsApp</small><strong>Send multilingual response</strong></div></div>{running&&<div className="run-strip"><b>Run #1043 · Rahul Sharma</b><div className="run-step">✓ Trigger received <span>10:42:01</span></div><div className="run-step">✓ Intent extracted <span>10:42:02</span></div><div className="run-step current">● Checking missing info…</div><div className="run-step">○ Draft response</div><div className="run-step">○ Human approval</div></div>}</div></div></div></>
}

function Composer({ close, activate }:{close:()=>void;activate:()=>void}) {
  return <div className="drawer-backdrop" onMouseDown={close}><div className="drawer" onMouseDown={e=>e.stopPropagation()}><div className="drawer-top"><div className="brand" style={{padding:0}}><span className="brand-mark">✦</span><span>Workflow composer</span></div><button className="icon-btn" onClick={close}>×</button></div><h2>Follow up missing quote details</h2><div className="step-pill">Sorted generated this workflow from your context</div><div className="prompt-box">“When someone asks for a quote and we need more information, ask them for it in their language.”</div><div className="recipe"><div className="recipe-step"><b>WHEN</b><div>Quote request arrives</div></div><div className="recipe-step"><b>IF</b><div>Required quote information is missing</div></div><div className="recipe-step"><b>THEN</b><div>Use Sarvam-105B to understand missing fields and draft a response</div></div><div className="recipe-step"><b>WAIT</b><div>For owner approval</div></div><div className="recipe-step"><b>THEN</b><div>Send in the customer’s language with text or Bulbul voice</div></div></div><div className="sarvam-stack"><div className="sarvam-item"><span className="sarvam-logo">सा</span><span><b>Multilingual by default</b><br/>Saaras listens · Sarvam reasons · Bulbul speaks</span></div></div><div className="drawer-actions"><button className="secondary" onClick={close}>Save draft</button><button className="secondary">Test with Rahul</button><button className="primary" onClick={activate}>Activate workflow</button></div></div></div>
}

export function SortedApp() {
  const [view,setView]=useState<View>('dashboard'); const [composer,setComposer]=useState(false); const [toast,setToast]=useState('');
  const notify=(s:string)=>{setToast(s);setTimeout(()=>setToast(''),2500)};
  return <div className="app-shell"><Sidebar view={view} setView={setView}/><main className="content">{view==='dashboard'&&<Dashboard openComposer={()=>setComposer(true)} setView={setView}/>} {view==='inbox'&&<Inbox openComposer={()=>setComposer(true)}/>} {view==='workflows'&&<Workflows openComposer={()=>setComposer(true)} notify={notify}/>}</main>{composer&&<Composer close={()=>setComposer(false)} activate={()=>{setComposer(false);setView('workflows');notify('Workflow activated successfully')}}/>}{toast&&<div className="toast">✓ {toast}</div>}</div>
}
