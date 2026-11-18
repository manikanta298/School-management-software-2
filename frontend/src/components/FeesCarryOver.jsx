import React,{useEffect,useState} from 'react';
import {api} from '../api/client';
import {formatMoney} from '../api/money';
// §2.6 / §4.1 — Fees carry-over tab: concessions, instalments, penalties, refunds, statement.
export default function FeesCarryOver({invoice,user}){
 const admin=user.role==='admin';
 const [tab,setTab]=useState('concessions');
 const [items,setItems]=useState([]),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [draft,setDraft]=useState({});
 useEffect(()=>{if(!invoice)return;setLoading(true);setError('');api(`/fees/invoices/${invoice.id}/${tab}`).then(d=>setItems(d.items||[])).catch(e=>setError(e.message)).finally(()=>setLoading(false));},[invoice,tab]);
 async function post(path,body){setBusy(true);setError('');setNotice('');try{await api(`/fees/invoices/${invoice.id}/${path}`,{method:'POST',body});setNotice('Saved.');api(`/fees/invoices/${invoice.id}/${tab}`).then(d=>setItems(d.items||[]));}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function putInstalments(){setBusy(true);setError('');try{await api(`/fees/invoices/${invoice.id}/instalments`,{method:'PUT',body:{instalments:draft.instalments||[]}});setNotice('Instalments saved.');api(`/fees/invoices/${invoice.id}/instalments`).then(d=>setItems(d.items||[]));}catch(e){setError(e.message);}finally{setBusy(false);}}
 if(!invoice)return null;
 const tabs=['concessions','instalments','penalties','refunds'];
 return <details className="card"><summary>Carry-over: concessions, instalments, penalties, refunds</summary>
 {error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="notice" role="status">{notice}</p>}
 <nav aria-label="Carry-over tabs">{tabs.map(t=><button key={t} aria-pressed={tab===t} onClick={()=>setTab(t)}>{t}</button>)}</nav>
 {loading?<p>Loading…</p>:<>
  {tab==='concessions'&&<div>{items.map(c=><p key={c.id}>{c.amount_minor} minor · {c.reason}{c.voided_at?' · VOIDED':''}</p>)}{admin&&<form onSubmit={e=>{e.preventDefault();post('concessions',draft);}}><input type="number" placeholder="amount_minor" onChange={e=>setDraft({...draft,amount_minor:+e.target.value})} required/><input placeholder="reason" onChange={e=>setDraft({...draft,reason:e.target.value})} required minLength={3}/><button disabled={busy}>Add concession</button></form>}</div>}
  {tab==='instalments'&&<div>{items.map(i=><p key={i.id}>{i.due_on} · {i.amount_minor} minor</p>)}{admin&&<form onSubmit={e=>{e.preventDefault();putInstalments();}}><p>Add instalments (due_on,amount_minor)</p><input type="date" onChange={e=>setDraft({...draft,newDue:e.target.value})}/><input type="number" placeholder="amount" onChange={e=>setDraft({...draft,newAmt:+e.target.value})}/><button type="button" disabled={busy} onClick={()=>setDraft({...draft,instalments:[...(draft.instalments||[]),{due_on:draft.newDue,amount_minor:draft.newAmt,position:(draft.instalments||[]).length}]})}>Add row</button> <button disabled={busy}>Save instalments</button></form>}</div>}
  {tab==='penalties'&&<div>{items.map(p=><p key={p.id}>{p.rule} · {p.amount_minor} minor · {p.applied_on}</p>)}{admin&&<form onSubmit={e=>{e.preventDefault();post('penalties',draft);}}><select onChange={e=>setDraft({...draft,rule:e.target.value})}><option value="manual">manual</option><option value="late_flat">late_flat</option><option value="late_percentage">late_percentage</option></select><input type="number" placeholder="amount_minor" onChange={e=>setDraft({...draft,amount_minor:+e.target.value})} required/><input type="date" onChange={e=>setDraft({...draft,applied_on:e.target.value})} required/><button disabled={busy}>Add penalty</button></form>}</div>}
  {tab==='refunds'&&<div>{items.map(r=><p key={r.id}>#{r.refund_number} · {r.amount_minor} minor · {r.reason}</p>)}{admin&&<p>Refunds are issued from a payment's detail view.</p>}</div>}
 </>}
 </details>;
}
