import React,{useState} from 'react';
import {api} from '../api/client';
import {parseCsv,rowsFromCsv} from '../api/csv';

// Student bulk import (BATCH_1_HANDOFF.md §2.8). Dry-run by default; on apply, creates
// users with temporary passwords and returns a one-time credentials list.
export default function StudentImport(){
 const [text,setText]=useState(''),[dryRun,setDryRun]=useState(true),[result,setResult]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function run(e){e.preventDefault();setBusy(true);setError('');setResult(null);try{const rows=rowsFromCsv(text);if(!rows.length)throw new Error('No rows parsed.');const d=await api('/students/import',{method:'POST',body:{dry_run:dryRun,rows}});setResult(d);}catch(e){setError(e.message);}finally{setBusy(false);}}
 function downloadCredentials(){if(!result?.credentials?.length)return;const csv=['admission_number,email,temporary_password',...result.credentials.map(c=>`${c.admission_number},${c.email},${c.temporary_password}`)].join('\r\n')+'\r\n';const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='student-credentials.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}
 return <details className="card"><summary>Bulk import students</summary>
  {error&&<p className="error" role="alert">{error}</p>}
  <p>CSV columns: admission_number, name, email, admission_date (YYYY-MM-DD), optional date_of_birth, gender, blood_group, address.</p>
  <form onSubmit={run}>
   <label>CSV content<textarea rows={6} value={text} onChange={e=>setText(e.target.value)} placeholder="admission_number,name,email,admission_date&#10;IMP-001,Jane Doe,jane@example.com,2025-06-01" required/></label>
   <label><input type="checkbox" checked={dryRun} onChange={e=>setDryRun(e.target.checked)}/> Dry run (validate without applying)</label>
   <button disabled={busy}>{busy?'Processing…':dryRun?'Validate':'Import and create accounts'}</button>
  </form>
  {result&&<div>
   <p>Valid: {result.valid?'yes':'no'}. Applied: {result.applied?'yes':'no'}.</p>
   {result.results?.map(r=><p key={r.row}>Row {r.row}: {r.admission_number} — {r.errors.length?r.errors.join('; '):'OK'}</p>)}
   {result.credentials?.length>0&&<><p><strong>{result.credentials.length} accounts created.</strong> Temporary passwords are shown once.</p><button onClick={downloadCredentials}>Download credentials CSV</button><table><thead><tr><th>Admission</th><th>Email</th><th>Temporary password</th></tr></thead><tbody>{result.credentials.map(c=><tr key={c.admission_number}><td>{c.admission_number}</td><td>{c.email}</td><td><code>{c.temporary_password}</code></td></tr>)}</tbody></table></>}
  </div>}
 </details>;
}
