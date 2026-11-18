let accessToken=null;
let refreshPromise;
const base=import.meta.env.VITE_API_BASE || '/api';
const REQUEST_TIMEOUT_MS=15000;
async function fetchWithTimeout(url,options={}) {
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);
 try {
  return await fetch(url,{...options,signal:controller.signal});
 } catch(error) {
  if(controller.signal.aborted) throw new Error('The server did not respond within 15 seconds. Please try again.');
  throw error;
 } finally {
  clearTimeout(timeout);
 }
}
export const clearToken=()=>{accessToken=null;};
export async function api(path,{method='GET',body}={},retry=true) {
 const response=await fetchWithTimeout(`${base}${path}`,{method,credentials:'include',headers:{...(body?{'Content-Type':'application/json'}:{}),...(accessToken?{Authorization:`Bearer ${accessToken}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
 if(response.status===401 && retry && !path.startsWith('/auth/')) {
  await restore();return api(path,{method,body},false);
 }
 const data=response.status===204?null:await response.json();
 if(!response.ok) throw new Error(data?.message || 'Request failed');
 if(data?.accessToken) accessToken=data.accessToken;
 return data;
}
export function restore() {
 if(!refreshPromise) refreshPromise=api('/auth/refresh',{method:'POST'},false).finally(()=>{refreshPromise=null;});
 return refreshPromise;
}
export async function apiText(path,retry=true){
 const response=await fetchWithTimeout(`${base}${path}`,{credentials:'include',headers:accessToken?{Authorization:`Bearer ${accessToken}`}:{}});
 if(response.status===401&&retry){await restore();return apiText(path,false);}
 if(!response.ok){let message='Request failed';try{message=(await response.json()).message||message;}catch{}throw new Error(message);}
 return response.text();
}
// Fetch binary data (xlsx, pdf, bytea) as a Blob. Used by Reports and attachment downloads.
export async function apiBlob(path,retry=true){
 const response=await fetch(`${base}${path}`,{credentials:'include',headers:accessToken?{Authorization:`Bearer ${accessToken}`}:{}});
 if(response.status===401&&retry){await restore();return apiBlob(path,false);}
 if(!response.ok){let message='Request failed';try{message=(await response.json()).message||message;}catch{}throw new Error(message);}
 return response.blob();
}
export function tokenHeader(){return accessToken?{Authorization:`Bearer ${accessToken}`}:{};}
