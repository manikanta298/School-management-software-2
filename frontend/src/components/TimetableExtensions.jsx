import React,{useEffect,useState} from 'react';
import {api} from '../api/client';
// §2.8 / §4.1 — Timetable extensions: periods editor, weekly view, teacher-wise.
export default function TimetableExtensions({user}){
 const admin=user.role==='admin';
 const [tab,setTab]=useState('periods');
 const [items,setItems]=useState([]),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [filter,setFilter]=useState({section_id:'',teacher_id:''});
 useEffect(()=>{setLoading(true);setError('');const q=new URLSearchParams();if(tab==='week'&&filter.section_id)q.set('section_id',filter.section_id);const path=tab==='teacher'&&filter.teacher_id?`/timetable/teachers/${filter.teacher_id}`:tab==='week'&&filter.section_id?`/timetable/week?${q}`:'/timetable/periods';api(path).then(d=>setItems(d.items||[])).catch(e=>setError(e.message)).finally(()=>setLoading(false));},[tab,filter]);
 if(!admin)return <details className="card"><summary>Timetable extensions</summary><p>Editing is admin-only. Use the weekly view below.</p></details>;
 return <details className="card"><summary>Timetable extensions: periods, weekly view, teacher-wise</summary>
 {error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="notice" role="status">{notice}</p>}
 <nav aria-label="Timetable tabs">{['periods','week','teacher'].map(t=><button key={t} aria-pressed={tab===t} onClick={()=>setTab(t)}>{t}</button>)}</nav>
 {tab==='week'&&<label>Section UUID<input value={filter.section_id} onChange={e=>setFilter({...filter,section_id:e.target.value})}/></label>}
 {tab==='teacher'&&<label>Teacher UUID<input value={filter.teacher_id} onChange={e=>setFilter({...filter,teacher_id:e.target.value})}/></label>}
 {loading?<p>Loading…</p>:tab==='periods'?<div>{items.map(p=><p key={p.id}>Day {p.day_of_week} P{p.period_index}: {p.start_time}–{p.end_time}{p.label?` (${p.label})`:''}{p.is_break?' [break]':''}</p>)}<p>Periods are managed via the periods PUT endpoint.</p></div>:!items.length?<p>No slots.</p>:items.map(s=><p key={s.id}>Day {s.weekday} · {s.start_minute}–{s.end_minute}{s.subject_name?` · ${s.subject_name}`:''}{s.teacher_name?` · ${s.teacher_name}`:''}{s.section_name?` · ${s.section_name}`:''}</p>)}
 </details>;
}
