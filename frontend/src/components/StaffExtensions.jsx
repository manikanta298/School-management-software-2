import React,{useEffect,useState} from 'react';
import {api,apiBlob} from '../api/client';
// §2.3 / §4.1 — Staff extensions: attendance, documents, workload.
export default function StaffExtensions({staff,user}){
 const admin=user.role==='admin';
 const [tab,setTab]=useState('attendance');
 const [items,setItems]=useState([]),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [draft,setDraft]=useState({staff_id:'',attendance_date:'',status:'present',note:''});
 useEffect(()=>{if(!staff&&tab!=='attendance'){setItems([]);return;}setLoading(true);setError('');const path=tab==='attendance'?staff?`/staff/attendance?staff_id=${staff.id}`:'/staff/attendance':staff?`/staff/${staff.id}/documents`:'/staff';api(path).then(d=>setItems(d.items||[])).catch(e=>setError(e.message)).finally(()=>setLoading(false));},[tab,staff]);
 async function saveAttendance(e){e.preventDefault();setBusy(true);setError('');setNotice('');try{await api('/staff/attendance',{method:'PUT',body:{...draft,staff_id:staff?.id||draft.staff_id}});setNotice('Attendance saved.');api(`/staff/attendance${staff?`?staff_id=${staff.id}`:''}`).then(d=>setItems(d.items||[]));}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function uploadDoc(e){e.preventDefault();const file=e.currentTarget.file.files[0];if(!file)return;if(file.size>524288){setError('≤512 KiB.');return;}const reader=new FileReader();reader.onload=async()=>{setBusy(true);setError('');try{const data=reader.result.split(',')[1];const mime=file.type==='image/jpeg'?'image/jpeg':'application/pdf';await api(`/staff/${staff.id}/documents`,{method:'POST',body:{name:file.name,mime,data}});setNotice('Uploaded.');api(`/staff/${staff.id}/documents`).then(d=>setItems(d.items||[]));}catch(e){setError(e.message);}finally{setBusy(false);}};reader.readAsDataURL(file);}
 if(!admin)return null;
 return <details className="card"><summary>Staff extensions: attendance, documents</summary>
 {error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="notice" role="status">{notice}</p>}
 <nav aria-label="Staff tabs">{['attendance','documents'].map(t=><button key={t} aria-pressed={tab===t} onClick={()=>setTab(t)}>{t}</button>)}</nav>
 {loading?<p>Loading…</p>:<>
  {tab==='attendance'&&<div>{items.map(a=><p key={a.id}>{a.attendance_date} · {a.status} · {a.staff_name}</p>)}<form onSubmit={saveAttendance}>{!staff&&<label>Staff UUID<input value={draft.staff_id} onChange={e=>setDraft({...draft,staff_id:e.target.value})} required/></label>}<label>Date<input type="date" value={draft.attendance_date} onChange={e=>setDraft({...draft,attendance_date:e.target.value})} required/></label><label>Status<select value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value})}>{['present','absent','leave','half_day'].map(s=><option key={s}>{s}</option>)}</select></label><button disabled={busy}>Save attendance</button></form></div>}
  {tab==='documents'&&staff&&<div>{items.map(d=><p key={d.id}>{d.name} · {d.size} bytes<button onClick={async()=>{const b=await apiBlob(`/staff/${staff.id}/documents/${d.id}`);const u=URL.createObjectURL(b);const l=document.createElement('a');l.href=u;l.download=d.name;l.click();setTimeout(()=>URL.revokeObjectURL(u),5000);}}>Download</button></p>)}<form onSubmit={uploadDoc}><input type="file" name="file" accept="application/pdf,image/png,image/jpeg" required/><button disabled={busy}>Upload document</button></form></div>}
 </>}
 </details>;
}
