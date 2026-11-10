const V='nu-v5';
const SHELL=['./','./index.html','./manifest.json','./icon.svg'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  if(e.request.method!=='GET')return;
  if(/firebaseio\.com|firebasedatabase\.app|firebaseinstallations|firebaselogging/.test(url.hostname))return;
  if(url.origin===location.origin){
    e.respondWith(caches.open(V).then(c=>c.match(e.request).then(hit=>{
      const net=fetch(e.request).then(res=>{if(res&&res.ok)c.put(e.request,res.clone());return res}).catch(()=>hit);
      return hit||net;
    })));
  }else{
    e.respondWith(caches.open(V).then(c=>c.match(e.request).then(hit=>hit||fetch(e.request).then(res=>{if(res&&(res.ok||res.type==='opaque'))c.put(e.request,res.clone());return res}).catch(()=>hit))));
  }
});
