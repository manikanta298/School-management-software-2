let accessToken=null;
let refreshPromise;
const base=import.meta.env.VITE_API_BASE || '/api';
const REQUEST_TIMEOUT_MS=15000;
// Status codes that indicate the backend is cold-starting or temporarily unavailable.
// Render free-tier services sleep after ~15 min of inactivity; the first request after
// sleep returns an HTML "Application is starting up" page (or a 502/503/504 from the proxy).
const COLD_START_STATUS=new Set([502,503,504]);
const COLD_START_RETRY_MS=5000; // wait 5s before retrying once

async function fetchWithTimeout(url,options={}) {
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);
 try {
  return await fetch(url,{...options,signal:controller.signal});
 } catch(error) {
  if(controller.signal.aborted) throw new Error('The server did not respond within 15 seconds. The backend may be starting up after inactivity. Please try again.');
  throw error;
 } finally {
  clearTimeout(timeout);
 }
}

// Parse a response body safely. If the backend returns HTML (cold-start page, Vercel
// 404 fallback, proxy error page) instead of JSON, throw a user-friendly error rather
// than letting JSON.parse() surface "Unexpected token '<'".
async function parseBody(response){
 if(response.status===204) return null;
 const ct=response.headers.get('content-type')||'';
 if(ct.includes('application/json')){
  try{ return await response.json(); }
  catch{ throw new Error('Server returned an invalid JSON response. Please try again.'); }
 }
 // Non-JSON response. This typically means:
 //  - Render is waking the backend up (HTML "Application is starting up" page)
 //  - A proxy (Vercel, Cloudflare) returned an HTML error page
 //  - The request hit a path that fell through to the SPA index.html
 const text=await response.text().catch(()=>'');
 const snippet=text.slice(0,120);
 const isHtml=snippet.toLowerCase().includes('<!doctype')||snippet.toLowerCase().includes('<html');
 const msg = isHtml && response.status>=500
   ? 'The backend is starting up after inactivity (Render free-tier sleep). Please wait a few seconds and try again.'
   : isHtml
     ? 'Server returned an HTML page instead of JSON. The backend may be unavailable or starting up.'
     : `Unexpected response (status ${response.status}, content-type "${ct||'none'}").`;
 throw new Error(msg);
}

// Sleep helper for retry-after-delay on cold-start responses.
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

// Fetch with one automatic retry when the backend returns a cold-start status.
// The retry waits COLD_START_RETRY_MS to give Render time to finish spinning up.
async function fetchWithColdStartRetry(url,options){
 const first=await fetchWithTimeout(url,options);
 if(COLD_START_STATUS.has(first.status)){
  await sleep(COLD_START_RETRY_MS);
  return fetchWithTimeout(url,options);
 }
 return first;
}

export const clearToken=()=>{accessToken=null;};
export async function api(path,{method='GET',body}={},retry=true) {
 const response=await fetchWithColdStartRetry(`${base}${path}`,{method,credentials:'include',headers:{...(body?{'Content-Type':'application/json'}:{}),...(accessToken?{Authorization:`Bearer ${accessToken}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
 if(response.status===401 && retry && !path.startsWith('/auth/')) {
  await restore();return api(path,{method,body},false);
 }
 const data=await parseBody(response);
 if(!response.ok) throw new Error(data?.message || 'Request failed');
 if(data?.accessToken) accessToken=data.accessToken;
 return data;
}
export function restore() {
 if(!refreshPromise) refreshPromise=api('/auth/refresh',{method:'POST'},false).finally(()=>{refreshPromise=null;});
 return refreshPromise;
}
export async function apiText(path,retry=true){
 const response=await fetchWithColdStartRetry(`${base}${path}`,{credentials:'include',headers:accessToken?{Authorization:`Bearer ${accessToken}`}:{}});
 if(response.status===401&&retry){await restore();return apiText(path,false);}
 if(!response.ok){const data=await parseBody(response);throw new Error(data?.message||'Request failed');}
 return response.text();
}
// Fetch binary data (xlsx, pdf, bytea) as a Blob. Used by Reports and attachment downloads.
export async function apiBlob(path,retry=true){
 const response=await fetchWithColdStartRetry(`${base}${path}`,{credentials:'include',headers:accessToken?{Authorization:`Bearer ${accessToken}`}:{}});
 if(response.status===401&&retry){await restore();return apiBlob(path,false);}
 if(!response.ok){const data=await parseBody(response);throw new Error(data?.message||'Request failed');}
 return response.blob();
}
export function tokenHeader(){return accessToken?{Authorization:`Bearer ${accessToken}`}:{};}
