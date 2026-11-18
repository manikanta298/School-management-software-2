import React,{useEffect,useState} from 'react';
import {api} from '../api/client';
import {allPages} from '../api/pagination';
const dateOnly=v=>String(v??'').slice(0,10);
export default function Leave({user}){
 const admin=user.role==='admin'||user.realRole==='admin';
 const principal=user.role==='principal'||user.realRole==='principal';
 const canApprove=admin||principal;
 const [tab,setTab]=useState('requests');
 const [items,setItems]=useState([]),[balances,setBalances]=useState([]),[students,setStudents]=useState([]),[staff,setStaff]=useState([]),[years,setYears]=useState([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[revision,setRevision]=useState(0);
 const [draft,setDraft]=useState({person_type:'student',person_id:'',from_date:'',to_date:'',reason:'',academic_year_id:''}),[balanceDraft,setBalanceDraft]=useState({staff_id:'',academic_year_id:'',total_days:12});
 const [filter,setFilter]=useState({status:'',person_type:''});
 useEffect(()=>{let active=true;Promise.all([allPages('/students'),allPages('/staff'),allPages('/academic/academic-years')]).then(([s,st,y])=>{if(active){setStudents(s);setStaff(st);setYears(y);if(y.find(yy=>yy.is_current))setBalanceDraft(b=>({...b,academic_year_id:y.find(yy=>yy.is_current).id}));}}).catch(e=>setError(e.message));return()=>{active=false;};},[]);
 useEffect(()=>{let active=true;setLoading(true);const q=new URLSearchParams({limit:50,offset:0});if(filter.status)q.set('status',filter.status);if(filter.person_type)q.set('person_type',filter.person_type);api(`/leave?${q}`).then(d=>{if(active)setItems(d.items);}).catch(e=>setError(e.message)).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[filter,revision]);
 useEffect(()=>{if(canApprove)api('/leave/balances').then(d=>setBalances(d.items)).catch(()=>{});},[canApprove,revision]);
 async function create(e){e.preventDefault();setBusy(true);setError('');setNotice('');try{await api('/leave',{method:'POST',body:draft});setRevision(v=>v+1);setNotice('Leave request submitted.');setDraft({...draft,person_id:'',from_date:'',to_date:'',reason:''});}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function review(id,decision){setBusy(true);setError('');try{const note=window.prompt(`${decision==='approved'?'Approve':'Reject'} — note (optional):`)||'';await api(`/leave/${id}/${decision}`,{method:'POST',body:{note}});setRevision(v=>v+1);}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function saveBalance(e){e.preventDefault();setBusy(true);setError('');try{await api('/leave/balances',{method:'POST',body:balanceDraft});setRevision(v=>v+1);setNotice('Leave balance saved.');}catch(e){setError(e.message);}finally{setBusy(false);}}
 const people=draft.person_type==='student'?students:staff;
 return <section><p className="eyebrow">LEAVE</p><h1>Leave management</h1>
 {error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="notice" role="status">{notice}</p>}
 <nav aria-label="Leave tabs"><button aria-pressed={tab==='requests'} onClick={()=>setTab('requests')}>Requests</button>{canApprove&&<button aria-pressed={tab==='balances'} onClick={()=>setTab('balances')}>Staff balances</button>}</nav>
 {tab==='requests'&&<div className="grid">
  <div className="card"><h2>Apply for leave</h2><form onSubmit={create}>
   <label>For<select value={draft.person_type} onChange={e=>setDraft({...draft,person_type:e.target.value,person_id:''})}><option value="student">Student</option><option value="staff">Staff</option></select></label>
   <label>{draft.person_type==='student'?'Student':'Staff member'}<select required value={draft.person_id} onChange={e=>setDraft({...draft,person_id:e.target.value})}><option value="">Select…</option>{people.map(p=><option key={p.id} value={p.id}>{p.name}{p.admission_number?` · ${p.admission_number}`:''}</option>)}</select></label>
   <label>From<input type="date" required value={draft.from_date} onChange={e=>setDraft({...draft,from_date:e.target.value})}/></label>
   <label>To<input type="date" required value={draft.to_date} onChange={e=>setDraft({...draft,to_date:e.target.value})}/></label>
   <label>Reason<textarea required minLength={3} maxLength={500} value={draft.reason} onChange={e=>setDraft({...draft,reason:e.target.value})}/></label>
   <button disabled={busy}>Submit request</button>
  </form></div>
  <div><h2>Requests</h2><label>Status<select value={filter.status} onChange={e=>setFilter({...filter,status:e.target.value})}><option value="">All</option>{['pending','approved','rejected'].map(s=><option key={s}>{s}</option>)}</select></label>
  {loading?<p>Loading…</p>:!items.length?<p>No requests.</p>:items.map(r=><article className="card" key={r.id}><h3>{r.person_type} · {r.status}</h3><p>{dateOnly(r.from_date)} to {dateOnly(r.to_date)}</p><p>{r.reason}</p><p>By {r.requested_by_name} · {dateOnly(r.requested_at)}</p>{canApprove&&r.status==='pending'&&<><button disabled={busy} onClick={()=>review(r.id,'approved')}>Approve</button> <button disabled={busy} onClick={()=>review(r.id,'rejected')}>Reject</button></>}</article>)}</div>
 </div>}
 {tab==='balances'&&canApprove&&<div className="grid"><div className="card"><h2>Add leave balance</h2><form onSubmit={saveBalance}><label>Staff<select required value={balanceDraft.staff_id} onChange={e=>setBalanceDraft({...balanceDraft,staff_id:e.target.value})}><option value="">Select…</option>{staff.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Academic year<select required value={balanceDraft.academic_year_id} onChange={e=>setBalanceDraft({...balanceDraft,academic_year_id:e.target.value})}><option value="">Select…</option>{years.map(y=><option key={y.id} value={y.id}>{y.name}</option>)}</select></label><label>Total days<input type="number" min={0} max={365} value={balanceDraft.total_days} onChange={e=>setBalanceDraft({...balanceDraft,total_days:+e.target.value})}/></label><button disabled={busy}>Save balance</button></form></div><div><h2>Current balances</h2>{!balances.length?<p>No balances.</p>:balances.map(b=><article className="card" key={b.id}><h3>{b.staff_name}</h3><p>{b.academic_year_name}: {b.used_days}/{b.total_days} days used</p></article>)}</div></div>}
 </section>;
}
