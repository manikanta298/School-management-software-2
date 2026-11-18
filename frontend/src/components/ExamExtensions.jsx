import React,{useEffect,useState} from 'react';
import {api} from '../api/client';
// §2.7 / §4.1 — Exam extensions: types, ranks, principal remarks.
export default function ExamExtensions({exam,user}){
 const admin=user.role==='admin';
 const principal=user.role==='principal'||user.realRole==='principal';
 const [tab,setTab]=useState('types');
 const [types,setTypes]=useState([]),[items,setItems]=useState([]),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [typeDraft,setTypeDraft]=useState({name:'',code:''}),[remarkDraft,setRemarkDraft]=useState({student_id:'',remark:''});
 useEffect(()=>{setLoading(true);if(tab==='types'){api('/exams/types').then(d=>setTypes(d.items||[])).catch(e=>setError(e.message)).finally(()=>setLoading(false));}else if(exam){api(`/exams/${exam.id}/${tab}`).then(d=>setItems(d.items||[])).catch(e=>setError(e.message)).finally(()=>setLoading(false));}else{setItems([]);setLoading(false);}},[tab,exam]);
 async function addType(e){e.preventDefault();setBusy(true);setError('');try{await api('/exams/types',{method:'POST',body:typeDraft});setNotice('Type added.');api('/exams/types').then(d=>setTypes(d.items||[]));setTypeDraft({name:'',code:''});}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function saveRemark(e){e.preventDefault();setBusy(true);setError('');try{await api(`/exams/${exam.id}/students/${remarkDraft.student_id}/remarks`,{method:'PUT',body:{remark:remarkDraft.remark}});setNotice('Remark saved.');api(`/exams/${exam.id}/students/${remarkDraft.student_id}/remarks`).then(d=>setItems(d.items||[]));}catch(e){setError(e.message);}finally{setBusy(false);}}
 return <details className="card"><summary>Exam extensions: types, ranks, principal remarks</summary>
 {error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="notice" role="status">{notice}</p>}
 <nav aria-label="Exam tabs">{['types','ranks','remarks'].map(t=><button key={t} aria-pressed={tab===t} onClick={()=>setTab(t)}>{t}</button>)}</nav>
 {loading?<p>Loading…</p>:<>
  {tab==='types'&&<div>{types.map(t=><p key={t.id}>{t.name} ({t.code})</p>)}{admin&&<form onSubmit={addType}><input placeholder="name" value={typeDraft.name} onChange={e=>setTypeDraft({...typeDraft,name:e.target.value})} required/><input placeholder="code" value={typeDraft.code} onChange={e=>setTypeDraft({...typeDraft,code:e.target.value.toUpperCase()})} required/><button disabled={busy}>Add type</button></form>}</div>}
  {tab==='ranks'&&exam&&<div>{!items.length?<p>No ranks yet.</p>:items.map((r,i)=><p key={i}>#{r.rank} {r.student_name} · {r.percentage}%</p>)}</div>}
  {tab==='remarks'&&exam&&(admin||principal)&&<div>{items.map(r=><p key={r.id}>{r.author_name}: {r.remark}</p>)}<form onSubmit={saveRemark}><input placeholder="student UUID" value={remarkDraft.student_id} onChange={e=>setRemarkDraft({...remarkDraft,student_id:e.target.value})} required/><textarea placeholder="remark" value={remarkDraft.remark} onChange={e=>setRemarkDraft({...remarkDraft,remark:e.target.value})} required maxLength={500}/><button disabled={busy}>Save remark</button></form></div>}
  {tab==='remarks'&&!exam&&<p>Select an exam first.</p>}
 </>}
 </details>;
}
