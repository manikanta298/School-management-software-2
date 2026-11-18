import React,{useEffect,useState} from 'react';
import {api,apiBlob} from '../api/client';
import {allPages} from '../api/pagination';
import {printElement} from '../api/print';
const TYPES=[['bonafide','Bonafide'],['transfer','Transfer'],['study','Study'],['character','Character']];
export default function Certificates({user}){
 const admin=user.role==='admin'||user.realRole==='admin'||user.role==='principal';
 const [items,setItems]=useState([]),[students,setStudents]=useState([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[revision,setRevision]=useState(0);
 const [draft,setDraft]=useState({type:'bonafide',student_id:'',reason:''});
 useEffect(()=>{let active=true;setLoading(true);Promise.all([api('/certificates?limit=50'),allPages('/students')]).then(([c,s])=>{if(!active)return;setItems(c.items);setStudents(s);}).catch(e=>setError(e.message)).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[revision]);
 async function issue(e){e.preventDefault();setBusy(true);setError('');setNotice('');try{const d=await api('/certificates',{method:'POST',body:draft});setRevision(v=>v+1);setNotice(`Certificate #${d.item.certificate_number} issued.`);}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function void_(id){if(!window.confirm('Void this certificate?'))return;setBusy(true);setError('');try{const reason=prompt('Reason for voiding?');if(!reason)return;await api(`/certificates/${id}/void`,{method:'POST',body:{reason}});setRevision(v=>v+1);}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function printCert(id){try{const d=await api(`/certificates/${id}`);const el=document.createElement('div');el.style.padding='40px';el.innerHTML=`<h1>${d.item.profile?.display_name||'School'}</h1><p>${d.item.profile?.address||''}</p><h2>${d.item.type.toUpperCase()} Certificate #${d.item.certificate_number}</h2><p>This is to certify that <strong>${d.item.student_name}</strong> (Admission: ${d.item.admission_number}) is a student of this school.</p><p>Issued on: ${String(d.item.issued_at).slice(0,10)}</p><p>Signed: ${d.item.profile?.principal_name||''}</p>`;document.body.appendChild(el);printElement(el);setTimeout(()=>el.remove(),1000);}catch(e){setError(e.message);}}
 return <section><p className="eyebrow">CERTIFICATES</p><h1>Certificates</h1>
 {error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="notice" role="status">{notice}</p>}
 {loading?<p role="status">Loading…</p>:<div className="grid">
  {admin&&<div className="card"><h2>Issue certificate</h2><form onSubmit={issue}>
   <label>Type<select value={draft.type} onChange={e=>setDraft({...draft,type:e.target.value})}>{TYPES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
   <label>Student<select required value={draft.student_id} onChange={e=>setDraft({...draft,student_id:e.target.value})}><option value="">Select student</option>{students.map(s=><option key={s.id} value={s.id}>{s.name} · {s.admission_number}</option>)}</select></label>
   <label>Reason (optional)<input value={draft.reason} onChange={e=>setDraft({...draft,reason:e.target.value})}/></label>
   <button disabled={busy}>Issue certificate</button>
  </form></div>}
  <div><h2>Issued certificates</h2>{!items.length&&<p>No certificates issued yet.</p>}{items.map(c=><article className="card" key={c.id}><h3>#{c.certificate_number} · {c.type}</h3><p>{c.student_name} · {c.admission_number}</p><p>Issued: {String(c.issued_at).slice(0,10)}{c.voided?' · VOIDED':''}</p>{!c.voided&&admin&&<><button disabled={busy} onClick={()=>printCert(c.id)}>Print</button> <button disabled={busy} onClick={()=>void_(c.id)}>Void</button></>}</article>)}</div>
 </div>}
 </section>;
}
