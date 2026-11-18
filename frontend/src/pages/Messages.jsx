import React,{useEffect,useState} from 'react';
import {api} from '../api/client';
import {allPages} from '../api/pagination';
const ts=v=>String(v??'').slice(0,16);
export default function Messages({user}){
 const [threads,setThreads]=useState([]),[messages,setMessages]=useState([]),[active,setActive]=useState(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[draft,setDraft]=useState(''),[newThread,setNewThread]=useState({teacher_id:'',parent_id:'',student_id:''}),[teachers,setTeachers]=useState([]),[parents,setParents]=useState([]),[students,setStudents]=useState([]);
 const admin=user.role==='admin'||user.realRole==='admin';
 useEffect(()=>{let active=true;setLoading(true);api('/messages/threads').then(d=>{if(active)setThreads(d.items);}).catch(e=>setError(e.message)).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[notice]);
 useEffect(()=>{if(admin)Promise.all([allPages('/teachers'),allPages('/parents'),allPages('/students')]).then(([t,p,s])=>{setTeachers(t);setParents(p);setStudents(s);}).catch(()=>{});},[admin]);
 async function open(t){setActive(t);setMessages([]);try{const d=await api(`/messages/threads/${t.id}`);setMessages(d.items);}catch(e){setError(e.message);}}
 async function send(e){e.preventDefault();setBusy(true);setError('');setNotice('');try{await api(`/messages/threads/${active.id}`,{method:'POST',body:{thread_id:active.id,body:draft}});setDraft('');const d=await api(`/messages/threads/${active.id}`);setMessages(d.items);}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function createThread(e){e.preventDefault();setBusy(true);setError('');setNotice('');try{const d=await api('/messages/threads',{method:'POST',body:newThread});setNotice('Thread created.');setNewThread({teacher_id:'',parent_id:'',student_id:''});setActive(d.item);const m=await api(`/messages/threads/${d.item.id}`);setMessages(m.items);}catch(e){setError(e.message);}finally{setBusy(false);}}
 return <section><p className="eyebrow">MESSAGES</p><h1>Messages</h1>
 {error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="notice" role="status">{notice}</p>}
 <div className="grid">
  <div><h2>Threads</h2>{loading?<p>Loading…</p>:!threads.length?<p>No threads yet.</p>:threads.map(t=><article className={`card${active?.id===t.id?'':''}`} key={t.id}><button onClick={()=>open(t)}><strong>{t.student_name}</strong><br/>{t.teacher_name} ↔ {t.parent_name}<br/>{t.unread?`${t.unread} unread`:''}</button></article>)}
  {admin&&<details className="card"><summary>Start new thread</summary><form onSubmit={createThread}><label>Teacher<select required value={newThread.teacher_id} onChange={e=>setNewThread({...newThread,teacher_id:e.target.value})}><option value="">Select…</option>{teachers.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>Parent<select required value={newThread.parent_id} onChange={e=>setNewThread({...newThread,parent_id:e.target.value})}><option value="">Select…</option>{parents.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Student<select required value={newThread.student_id} onChange={e=>setNewThread({...newThread,student_id:e.target.value})}><option value="">Select…</option>{students.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><button disabled={busy}>Create thread</button></form></details>}
  </div>
  <div>{active?<><h2>{active.student_name}</h2><div className="card" style={{maxHeight:'60vh',overflowY:'auto'}}>{messages.map(m=><p key={m.id} style={{textAlign:m.sent_by===user.id?'right':'left'}}><strong>{m.sent_by_name}</strong> · {ts(m.sent_at)}<br/>{m.body}</p>)}</div><form onSubmit={send}><label>Message<textarea required maxLength={2000} value={draft} onChange={e=>setDraft(e.target.value)}/></label><button disabled={busy}>Send</button></form></>:<p>Select a thread to view messages.</p>}</div>
 </div>
 </section>;
}
