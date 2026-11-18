import React,{useState} from 'react';
import {apiText,apiBlob} from '../api/client';

const REPORTS=[
 {name:'students',label:'Students',needsSection:false,needsYear:false},
 {name:'attendance',label:'Attendance',needsSection:true,needsYear:false},
 {name:'fees-collection',label:'Fees collection',needsSection:false,needsYear:false},
 {name:'defaulters',label:'Defaulters',needsSection:false,needsYear:false},
 {name:'exam-results',label:'Exam results',needsSection:false,needsYear:true}
];
export default function Reports({user}){
 const [report,setReport]=useState('students');
 const [format,setFormat]=useState('csv');
 const [params,setParams]=useState({section_id:'',academic_year_id:'',from:'',to:''});
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const meta=REPORTS.find(r=>r.name===report);

 async function download(e){
  e.preventDefault();setBusy(true);setError('');setNotice('');
  try{
   const q=new URLSearchParams({format});
   for(const [k,v] of Object.entries(params))if(v)q.set(k,v);
   const path=`/reports/${report}?${q}`;
   const blob=format==='csv'?new Blob([await apiText(path)],{type:'text/csv;charset=utf-8'}):await apiBlob(path);
   triggerDownload(blob,`${report}.${format}`);
   setNotice('Download started.');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 function triggerDownload(blob,filename){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}
 return <section><p className="eyebrow">REPORTS</p><h1>Reports & exports</h1><p>Download CSV, XLSX or PDF for the active school. Cross-school rows are never included.</p>
 {error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="notice" role="status">{notice}</p>}
 <form onSubmit={download} className="card">
  <label>Report<select value={report} onChange={e=>setReport(e.target.value)}>{REPORTS.map(r=><option key={r.name} value={r.name}>{r.label}</option>)}</select></label>
  <label>Format<select value={format} onChange={e=>setFormat(e.target.value)}><option value="csv">CSV</option><option value="xlsx">XLSX</option><option value="pdf">PDF</option></select></label>
  {(report==='fees-collection'||report==='defaulters')&&<><label>From date<input type="date" value={params.from} onChange={e=>setParams({...params,from:e.target.value})}/></label><label>To date<input type="date" value={params.to} onChange={e=>setParams({...params,to:e.target.value})}/></label></>}
  {meta?.needsSection&&<label>Section ID<input value={params.section_id} onChange={e=>setParams({...params,section_id:e.target.value})} required placeholder="Section UUID"/></label>}
  {meta?.needsYear&&<label>Academic year ID<input value={params.academic_year_id} onChange={e=>setParams({...params,academic_year_id:e.target.value})} required placeholder="Year UUID"/></label>}
  <button disabled={busy}>Download {format.toUpperCase()}</button>
 </form>
 </section>;
}
