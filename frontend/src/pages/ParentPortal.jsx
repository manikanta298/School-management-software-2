import React,{useEffect,useState} from 'react';
import {api} from '../api/client';
const fmt=v=>v==null?'-':String(v).slice(0,10);
export default function ParentPortal({user}){
 const [children,setChildren]=useState([]),[overview,setOverview]=useState(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let active=true;setLoading(true);api('/portal/children').then(d=>{if(active)setChildren(d.items);}).catch(e=>setError(e.message)).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]);
 async function open(c){setBusy(true);setError('');try{const d=await api(`/portal/children/${c.id}/overview`);setOverview(d.item);}catch(e){setError(e.message);}finally{setBusy(false);}}
 return <section><p className="eyebrow">PARENT PORTAL</p><h1>Welcome, {user?.name}</h1>
 {error&&<p className="error" role="alert">{error}</p>}
 {loading?<p role="status">Loading your children…</p>:!children.length?<p>No linked children yet. Contact the school office to link your profile to your children.</p>:<div className="grid">
  <div><h2>Your children</h2>{children.map(c=><article className="card" key={c.id}><h3>{c.name}</h3><p>{c.admission_number}</p><p>Outstanding: {c.outstanding_minor} minor</p><p>Attendance (30d): {c.attendance_pct_30d!=null?Math.round(c.attendance_pct_30d)+'%':'-'}</p><p>Unread notices: {c.unread_notices}</p><p>Pending homework: {c.pending_homework}</p>{c.next_exam&&<p>Next exam: {c.next_exam.name} · {fmt(c.next_exam.start_date)}</p>}<button disabled={busy} onClick={()=>open(c)}>Open overview</button></article>)}</div>
  <div>{overview?<><h2>{overview.student.name}</h2><p>{overview.student.admission_number} · {overview.student.class_name} / {overview.student.section_name}</p>
   <h3>Recent invoices</h3>{!overview.invoices.length&&<p>No invoices.</p>}{overview.invoices.map(i=><p key={i.id}>{i.invoice_number} · {i.title} · {i.amount_minor} minor · paid {i.paid_minor}</p>)}
   <h3>Attendance (last 30 days)</h3>{!overview.attendance.length&&<p>No records.</p>}{overview.attendance.map((a,i)=><span key={i}>{fmt(a.date)}: {a.status}; </span>)}
   <h3>Homework</h3>{!overview.homework.length&&<p>No homework.</p>}{overview.homework.map(h=><p key={h.id}>{h.title} · due {fmt(h.due_on)}</p>)}
  </>:<p>Select a child to see their overview.</p>}</div>
 </div>}
 </section>;
}
