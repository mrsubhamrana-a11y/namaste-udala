// Run: ADMIN_PHONE=9000000001 ADMIN_PASSWORD=ChangeMe123 node test.js  (uses a temp DB)
const assert=require('assert'),os=require('os'),path=require('path');
process.env.DB_FILE=path.join(os.tmpdir(),'nu-test-'+Date.now()+'.db');process.env.ADMIN_PHONE=process.env.ADMIN_PHONE||'9000000001';process.env.ADMIN_PASSWORD=process.env.ADMIN_PASSWORD||'ChangeMe123';
const {server}=require('./server');
server.listen(0,async()=>{const base='http://localhost:'+server.address().port;
 const call=async(ck,m,u,b)=>{const r=await fetch(base+u,{method:m,headers:{'Content-Type':'application/json',cookie:ck||''},body:b?JSON.stringify(b):undefined});return{s:r.status,j:await r.json().catch(()=>({})),ck:(r.headers.get('set-cookie')||'').split(';')[0]};};
 let n=0;const ok=(c,m)=>{assert(c,m);n++;console.log('PASS',m)};
 try{
 let a=await call('','POST','/api/register',{name:'Asha',phone:'9876543210',password:'password1'});ok(a.s===200&&a.j.user.role==='customer','register creates customer');
 ok((await call('','POST','/api/register',{name:'X',phone:'12345',password:'password1'})).s===400,'rejects bad phone');
 ok((await call('','POST','/api/register',{name:'Asha',phone:'9876543210',password:'password1'})).s===409,'rejects duplicate phone');
 ok((await call('','POST','/api/register',{name:'Hax',phone:'9876500000',password:'password1',role:'admin'})).j.user.role==='customer','cannot self-assign admin role');
 ok((await call('','GET','/api/me')).s===401,'me requires login');
 ok((await call('','POST','/api/login',{phone:'9876543210',password:'wrongpass'})).s===401,'wrong password rejected');
 const b=await call('','POST','/api/login',{phone:'9876543210',password:'password1'});ok(b.s===200&&b.ck,'login sets session');
 ok((await call(b.ck+'x','GET','/api/me')).s===401,'tampered cookie rejected');
 ok((await call(b.ck,'GET','/api/admin/users')).s===403,'customer blocked from admin');
 await call(b.ck,'POST','/api/addresses',{label:'Home',line1:'Ward 3',landmark:'Near temple'});
 const ad=await call('','POST','/api/login',{phone:process.env.ADMIN_PHONE,password:process.env.ADMIN_PASSWORD});ok(ad.s===200&&ad.j.user.role==='admin','admin bootstrap login');
 const c2=await call('','POST','/api/register',{name:'Ravi',phone:'9123456780',password:'password1'});
 ok((await call(c2.ck,'GET','/api/addresses')).j.addresses.length===0,'customers cannot see others\' addresses');
 ok((await call(ad.ck,'GET','/api/admin/users')).j.users.length>=3,'admin lists users');
 ok((await call(ad.ck,'PATCH','/api/admin/users/'+c2.j.user.id,{status:'suspended'})).s===200,'admin suspends user');
 ok((await call(c2.ck,'GET','/api/me')).s===401,'suspended session invalidated');
 ok((await call(ad.ck,'GET','/api/admin/audit')).j.logs.length>=1,'admin actions audited');
 ok((await call('','GET','/api/categories')).j.categories.length===7,'7 default categories');
 console.log(`\n${n} checks passed`);}catch(e){console.error('FAIL',e.message);process.exitCode=1}server.close();process.exit(process.exitCode||0);});
