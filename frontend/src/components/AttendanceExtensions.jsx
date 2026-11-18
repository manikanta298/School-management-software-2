import React,{useEffect,useState} from 'react';
import {api} from '../api/client';
// §2.5 / §4.1 — Attendance extensions: alerts, monthly report, corrections queue.
export default function AttendanceExtensions({user}){
 const admin=user.role==='admin';
 const [tab,setTab]=useState('alerts');
 const [items,setItems]=useState([]),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [filter,setFilter]=useState({threshold:75,section_id:'',month:'',status:'pending'});
 useEffect(()=>{
  setLoading(true);setError('');
  const q=new URLSearchParams();
  if(tab==='alerts'){q.set('threshold',filter.threshold);if(filter.from)q.set('from',filter.from);if(filter.to)q.set('to',filter.to);}
  if(tab==='monthly'){if(!filter.section_id||!filter.month){setItems([]);setLoading(false);return;}q.set('section_id',filter.section_id);q.set('month',filter.month);}
  if(tab==='corrections'){if(filter.status)q.set('status',filter.status);}
  api(`/attendance/${tab}?${q}`).then(d=>setItems(d.items||[])).catch(e=>setError(e.message)).finally(()=>setLoading(false));
 },[tab,filter]);
 async function approve(id,decision){setBusy(true);setError('');try{const note=prompt('Note (optional):')||'';await api(`/attendance/corrections/${id}/${decision}`,{method:'POST',body:{note}});setNotice(`${decision}.`);const q=new URLSearchParams();if(filter.status)q.set('status',filter.status);api(`/attendance/corrections?${q}`).then(d=>setItems(d.items||[]));}catch(e){setError(e.message);}finally{setBusy(false);}}
 return <details className="card" open><summary>Attendance extensions: alerts, monthly report, corrections queue</summary>
 {error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="notice" role="status">{notice}</p>}
 <nav aria-label="Attendance tabs">{['alerts','monthly','corrections'].map(t=><button key={t} aria-pressed={tab===t} onClick={()=>setTab(t)}>{t}</button>)}</nav>
 {tab==='alerts'&&<div><label>Threshold %<input type="number" value={filter.threshold} onChange={e=>setFilter({...filter,threshold:+e.target.value})}/></label><label>From<input type="date" onChange={e=>setFilter({...filter,from:e.target.value})}/></label><label>To<input type="date" onChange={e=>setFilter({...filter,to:e.target.value})}/></label></div>}
 {tab==='monthly'&&<div><label>Section UUID<input value={filter.section_id} onChange={e=>setFilter({...filter,section_id:e.target.value})}/></label><label>Month (YYYY-MM)<input value={filter.month} onChange={e=>setFilter({...filter,month:e.target.value})} placeholder="2026-11"/></label></div>}
 {tab==='corrections'&&admin&&<label>Status<select value={filter.status} onChange={e=>setFilter({...filter,status:e.target.value})}><option value="">All</option>{['pending','approved','rejected'].map(s=><option key={s}>{s}</option>)}</select></label>}
 {loading?<p>Loading…</p>:!items.length?<p>No results.</p>:tab==='alerts'?items.map(a=><p key={a.student_id}>{a.student_name} · {a.absent_pct}% absent ({a.absent_count}/{a.total})</p>):tab==='monthly'?items.map(m=><p key={m.date}>{m.date}: present {m.present}, absent {m.absent}, late {m.late}</p>):items.map(c=><p key={c.id}>{c.requested_by_name} requested {c.requested_status} for {c.attendance_date} · {c.status}{c.status==='pending'&&admin&&<><button disabled={busy} onClick={()=>approve(c.id,'approve')}>Approve</button><button disabled={busy} onClick={()=>approve(c.id,'reject')}>Reject</button></>}</p>)}
 </details>;
}
