import React,{useEffect,useState} from 'react';
import {api} from '../api/client';

// Settings: school profile + logo + notification preferences + MFA status.
// Visible to admin (full manage) and principal (view + notifications own).
export default function Settings({user}){
 const admin=user.role==='admin';
 const [profile,setProfile]=useState(null),[draft,setDraft]=useState({}),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [logoBusy,setLogoBusy]=useState(false);
 const [prefs,setPrefs]=useState([]),[prefDraft,setPrefDraft]=useState({in_app:'daily',email:'instant',sms:'instant'});
 const [mfa,setMfa]=useState({enrolled:false,last_used_at:null}),[mfaSecret,setMfaSecret]=useState(null),[mfaToken,setMfaToken]=useState('');

 useEffect(()=>{
  let active=true;setLoading(true);
  Promise.all([api('/settings/school'),api('/settings/notifications'),api('/auth/mfa/status')]).then(([p,n,m])=>{if(!active)return;setProfile(p.item);setDraft(p.item||{display_name:'',address:'',phone:'',email:'',principal_name:'',letterhead_text:''});setPrefs(n.items);setMfa(m);}).catch(e=>setError(e.message)).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[]);

 async function saveProfile(e){e.preventDefault();setBusy(true);setError('');setNotice('');try{const d=await api('/settings/school',{method:'PUT',body:draft});setProfile(d.item);setNotice('School profile saved.');}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function uploadLogo(e){e.preventDefault();const file=e.currentTarget.logo.files[0];if(!file)return;if(file.size>524288){setError('Logo must be ≤512 KiB.');return;}const reader=new FileReader();reader.onload=async()=>{setLogoBusy(true);setError('');setNotice('');try{const data=reader.result.split(',')[1];const mime=file.type==='image/jpeg'?'image/jpeg':'image/png';await api('/settings/school/logo',{method:'PUT',body:{mime,data}});setNotice('Logo uploaded.');}catch(e){setError(e.message);}finally{setLogoBusy(false);}};reader.readAsDataURL(file);}
 async function savePrefs(e){e.preventDefault();setBusy(true);setError('');setNotice('');try{const items=Object.entries(prefDraft).filter(([k,v])=>k&&v).map(([channel,digest])=>({channel,enabled:true,digest}));const d=await api('/settings/notifications',{method:'PUT',body:{preferences:items}});setPrefs(d.items);setNotice('Notification preferences saved.');}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function enrollMfa(e){e.preventDefault();setBusy(true);setError('');try{const d=await api('/auth/mfa/enroll',{method:'POST'});setMfaSecret(d);}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function verifyMfa(e){e.preventDefault();setBusy(true);setError('');setNotice('');try{await api('/auth/mfa/verify',{method:'POST',body:{token:mfaToken}});setMfaSecret(null);setMfaToken('');const s=await api('/auth/mfa/status');setMfa(s);setNotice('MFA verified.');}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function unenrollMfa(){if(!window.confirm('Disable MFA for your account?'))return;setBusy(true);setError('');try{await api('/auth/mfa/unenroll',{method:'POST'});const s=await api('/auth/mfa/status');setMfa(s);setNotice('MFA disabled.');}catch(e){setError(e.message);}finally{setBusy(false);}}

 const field=(key,label,type='text')=><label>{label}<input type={type} value={draft[key]??''} onChange={e=>setDraft({...draft,[key]:e.target.value})} disabled={!admin}/></label>;

 return <section><p className="eyebrow">SCHOOL SETTINGS</p><h1>Settings</h1>
 {error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="notice" role="status">{notice}</p>}
 {loading?<p role="status">Loading settings…</p>:<div className="grid">
  <div className="card"><h2>School profile</h2><p>This appears on receipts, certificates and report cards.</p><form onSubmit={saveProfile}>
   {field('display_name','Display name','text')}
   {field('address','Address','text')}
   {field('phone','Phone','tel')}
   {field('email','Public email','email')}
   {field('principal_name','Principal name','text')}
   {field('letterhead_text','Letterhead tagline','text')}
   {admin&&<button disabled={busy}>Save profile</button>}
  </form></div>
  <div className="card"><h2>Logo</h2>{profile?.logo_size?<p>Current logo: {profile.logo_size} bytes.</p>:<p>No logo uploaded.</p>}<form onSubmit={uploadLogo}>
   <label>PNG or JPEG (≤512 KiB)<input type="file" name="logo" accept="image/png,image/jpeg" required disabled={!admin}/></label>
   {admin&&<button disabled={logoBusy}>{logoBusy?'Uploading…':'Upload logo'}</button>}
  </form></div>
  <div className="card"><h2>Notification preferences</h2><p>How you want to be notified. Delivery channels are not active yet; this records your preference.</p><form onSubmit={savePrefs}>
   {['in_app','email','sms'].map(ch=><label key={ch}>{ch.replace('_',' ')} digest<select value={prefDraft[ch]} onChange={e=>setPrefDraft({...prefDraft,[ch]:e.target.value})}><option value="instant">Instant</option><option value="daily">Daily</option><option value="weekly">Weekly</option></select></label>)}
   <button disabled={busy}>Save preferences</button>
  </form>{prefs.length>0&&<p>Current: {prefs.map(p=>`${p.channel}=${p.digest}`).join(', ')}</p>}</div>
  {(admin||user.realRole==='admin'||user.role==='principal')&&<div className="card"><h2>Multi-factor authentication</h2>{mfa.enrolled?<p>MFA is active. Last used: {mfa.last_used_at?String(mfa.last_used_at).slice(0,16):'never'}.</p>:<p>MFA is not enrolled. Recommended for admin and principal accounts.</p>}
   {mfaSecret?<div><p>Scan this QR in an authenticator app (Authy, Google Authenticator, 1Password).</p><img src={mfaSecret.qr_url} alt="MFA QR code" style={{maxWidth:240}}/><p>Or enter this secret manually: <code>{mfaSecret.secret}</code></p><form onSubmit={verifyMfa}><label>6-digit code<input value={mfaToken} onChange={e=>setMfaToken(e.target.value.replace(/\D/g,'').slice(0,6))} required pattern="^\d{6}$"/></label><button disabled={busy||mfaToken.length!==6}>Verify and enable</button></form></div>:<form onSubmit={enrollMfa}><button disabled={busy}>{mfa.enrolled?'Re-enroll MFA':'Enroll MFA'}</button>{mfa.enrolled&&<button type="button" disabled={busy} onClick={unenrollMfa}>Disable MFA</button>}</form>}
  </div>}
 </div>}
 </section>;
}
