const assert=require('assert'),os=require('os'),path=require('path');
process.env.DB_FILE=path.join(os.tmpdir(),'nu6-'+Date.now()+'.db');process.env.ADMIN_PHONE='9000000001';process.env.ADMIN_PASSWORD='ChangeMe123';
const {server}=require('./server');
server.listen(0,async()=>{const base='http://localhost:'+server.address().port;
 const call=async(ck,m,u,b)=>{const r=await fetch(base+u,{method:m,headers:{'Content-Type':'application/json',cookie:ck||''},body:b?JSON.stringify(b):undefined});return{s:r.status,j:await r.json().catch(()=>({})),ck:(r.headers.get('set-cookie')||'').split(';')[0]};};
 try{const adm=await call('','POST','/api/login',{phone:'9000000001',password:'ChangeMe123'});
 const s=await call('','POST','/api/register',{name:'Sita',phone:'9811111111',password:'password1'}),c=await call('','POST','/api/register',{name:'Ravi',phone:'9822222222',password:'password1'});
 const cat=(await call('','GET','/api/categories')).j.categories.find(x=>x.name.startsWith('Restaurants'));
 const ap=await call(s.ck,'POST','/api/seller/apply',{name:'Tiffin',category_id:cat.id});await call(adm.ck,'POST','/api/admin/businesses/'+ap.j.id+'/review',{decision:'approved'});
 await call(s.ck,'PUT','/api/seller/rates',{preset:'suggested'});
 const pk=await call(s.ck,'POST','/api/seller/packs',{days:7,meal_type:'morning,lunch,dinner',diet:'veg',price:769});
 const ad=await call(c.ck,'POST','/api/addresses',{line1:'Ward 3'});const sb=await call(c.ck,'POST','/api/subscriptions',{pack_id:pk.j.id,address_id:ad.j.id});
 await call(s.ck,'POST','/api/seller/subscriptions/'+sb.j.id+'/confirm-cash');const d=(await call('','GET','/api/packs?business_id='+ap.j.id)).j.earliest_start;
 let t=0;for(const sl of['morning','lunch','dinner'])t+=(await call(c.ck,'POST','/api/subscriptions/'+sb.j.id+'/skip',{date:d,slot:sl})).j.credit_paise;
 console.log(JSON.stringify(pk.j),JSON.stringify(sb.j),'pack',pk.j.price_paise,'one full day skipped credit',t,'(paid per day ≈',Math.round(76900/7)+')');assert(t<=Math.round(76900/7)+2&&t>=Math.round(76900/7)-2);console.log('PASS credit never exceeds what was paid');}
 catch(e){console.error('FAIL',e.message);process.exitCode=1}server.close();process.exit(process.exitCode||0);});
