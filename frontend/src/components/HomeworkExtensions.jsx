import React,{useEffect,useState} from 'react';
import {api,apiBlob} from '../api/client';
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=';
// §2.9 / §4.1 — Homework extensions: attachments, submissions, feedback.
export default function HomeworkExtensions({homework,user}){
 const teacher=user.role==='admin'||user.role==='teacher';
 const student=user.role==='student';
 const [tab,setTab]=useState('attachments');
 const [items,setItems]=useState([]),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{if(!homework)return;setLoading(true);api(`/homework/${homework.id}/${tab}`).then(d=>setItems(d.items||[])).catch(e=>setError(e.message)).finally(()=>setLoading(false));},[homework,tab]);
 async function uploadAttachment(e){e.preventDefault();const file=e.currentTarget.file.files[0];if(!file)return;if(file.size>524288){setError('≤512 KiB.');return;}const reader=new FileReader();reader.onload=async()=>{setBusy(true);setError('');try{const data=reader.result.split(',')[1];const mime=file.type==='image/jpeg'?'image/jpeg':'image/png';await api(`/homework/${homework.id}/attachments`,{method:'POST',body:{name:file.name,mime,data}});setNotice('Uploaded.');api(`/homework/${homework.id}/attachments`).then(d=>setItems(d.items||[]));}catch(e){setError(e.message);}finally{setBusy(false);}};reader.readAsDataURL(file);}
 async function submit(e){e.preventDefault();const file=e.currentTarget.file.files[0];if(!file)return;if(file.size>524288){setError('≤512 KiB.');return;}const reader=new FileReader();reader.onload=async()=>{setBusy(true);setError('');try{const data=reader.result.split(',')[1];const mime=file.type==='image/jpeg'?'image/jpeg':'image/png';await api(`/homework/${homework.id}/submissions`,{method:'POST',body:{name:file.name,mime,data,note:e.currentTarget.note?.value||null}});setNotice('Submitted.');api(`/homework/${homework.id}/submissions`).then(d=>setItems(d.items||[]));}catch(e){setError(e.message);}finally{setBusy(false);}};reader.readAsDataURL(file);}
 async function feedback(submissionId){const text=prompt('Feedback:');if(!text)return;setBusy(true);setError('');try{await api(`/homework/${homework.id}/submissions/${submissionId}/feedback`,{method:'PUT',body:{feedback:text}});setNotice('Feedback saved.');api(`/homework/${homework.id}/submissions`).then(d=>setItems(d.items||[]));}catch(e){setError(e.message);}finally{setBusy(false);}}
 if(!homework)return null;
 return <details className="card"><summary>Attachments, submissions, feedback</summary>
 {error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="notice" role="status">{notice}</p>}
 <nav aria-label="Homework tabs">{teacher&&<button aria-pressed={tab==='attachments'} onClick={()=>setTab('attachments')}>Attachments</button>}{teacher&&<button aria-pressed={tab==='submissions'} onClick={()=>setTab('submissions')}>Submissions</button>}{student&&<button aria-pressed={tab==='submissions'} onClick={()=>setTab('submissions')}>My submission</button>}</nav>
 {loading?<p>Loading…</p>:<>
  {tab==='attachments'&&teacher&&<div>{items.map(a=><p key={a.id}>{a.name} · {a.size} bytes<button onClick={async()=>{const b=await apiBlob(`/homework/${homework.id}/attachments/${a.id}`);const u=URL.createObjectURL(b);const l=document.createElement('a');l.href=u;l.download=a.name;l.click();setTimeout(()=>URL.revokeObjectURL(u),5000);}}>Download</button></p>)}<form onSubmit={uploadAttachment}><input type="file" name="file" accept="application/pdf,image/png,image/jpeg" required/><button disabled={busy}>Upload attachment</button></form></div>}
  {tab==='submissions'&&(teacher||student)&&<div>{items.map(s=><p key={s.id}>{s.student_name||s.name} · {s.size} bytes{s.feedback?` · Feedback: ${s.feedback}`:''}{teacher&&!s.feedback&&<button disabled={busy} onClick={()=>feedback(s.student_id)}>Add feedback</button>}</p>)}{student&&!items.length&&<form onSubmit={submit}><input type="file" name="file" accept="application/pdf,image/png,image/jpeg" required/><input name="note" placeholder="note (optional)"/><button disabled={busy}>Submit</button></form>}</div>}
 </>}
 </details>;
}
