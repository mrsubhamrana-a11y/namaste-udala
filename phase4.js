// Phase 3+4: product orders (COD for now), seller order flow, delivery assignment, numbered route + Google Maps links.
module.exports=({db,q,one,run,audit,need,fail,str})=>{
db.exec(`CREATE TABLE IF NOT EXISTS deliveries(id INTEGER PRIMARY KEY,created_at TEXT DEFAULT CURRENT_TIMESTAMP,kind TEXT NOT NULL,order_id INTEGER REFERENCES orders(id),subscription_id INTEGER REFERENCES subscriptions(id),
 meal_date TEXT,slot TEXT,route_date TEXT NOT NULL,staff_id INTEGER NOT NULL REFERENCES users(id),stop_no INTEGER NOT NULL,status TEXT DEFAULT 'assigned');
CREATE TABLE IF NOT EXISTS delivery_events(id INTEGER PRIMARY KEY,created_at TEXT DEFAULT CURRENT_TIMESTAMP,delivery_id INTEGER NOT NULL REFERENCES deliveries(id),status TEXT,note TEXT,by_user INTEGER);`);
const IST=36e5*5.5,today=()=>new Date(Date.now()+IST).toISOString().slice(0,10);
const myBiz=u=>{need(u,'seller');const b=one("SELECT * FROM businesses WHERE owner_id=? AND status='approved'",u.id);if(!b)throw fail(403,'Your business is not approved yet.');return b;};
const feePaise=()=>parseInt(one("SELECT value v FROM settings WHERE key='delivery_fee_paise'")?.v||'0');
const tx=fn=>{db.exec('BEGIN');try{const r=fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}};
const restock=id=>q('SELECT product_id,qty FROM order_items WHERE order_id=?',id).forEach(i=>run('UPDATE products SET stock=stock+? WHERE id=?',i.qty,i.product_id));
const NEXT={placed:['accepted','rejected'],accepted:['preparing','ready','rejected'],preparing:['ready']};
const ev=(id,s,note,by)=>run('INSERT INTO delivery_events(delivery_id,status,note,by_user) VALUES(?,?,?,?)',id,s,note||null,by);
const nextStop=(staff,date)=>(one('SELECT MAX(stop_no) m FROM deliveries WHERE staff_id=? AND route_date=?',staff,date).m||0)+1;
const staffOk=id=>{if(!one("SELECT 1 x FROM users WHERE id=? AND role='delivery' AND status='active'",id))throw fail(400,'Choose an active delivery staff member.');};
const mapsQ=a=>[a.line1,a.landmark,a.area,a.pincode,'Udala, Odisha'].filter(Boolean).join(', ');
return[
 ['POST','/api/orders',(b,u)=>{need(u);const biz=one("SELECT * FROM businesses WHERE id=? AND status='approved'",b.business_id);if(!biz)throw fail(400,'This shop is not available.');
  const mode=b.mode==='pickup'?'pickup':'delivery';let addr=null;if(mode==='delivery'){addr=one('SELECT * FROM addresses WHERE id=? AND user_id=?',b.address_id,u.id);if(!addr)throw fail(400,'Choose a delivery address.');}
  if(!Array.isArray(b.items)||!b.items.length||b.items.length>50)throw fail(400,'Your cart is empty.');
  return tx(()=>{let sub=0;const lines=b.items.map(i=>{const qty=parseInt(i.qty);if(!(qty>0&&qty<=100))throw fail(400,'Invalid quantity.');
    const p=one('SELECT * FROM products WHERE id=? AND business_id=? AND available=1',i.product_id,biz.id);if(!p)throw fail(400,'An item in your cart is no longer available.');
    if(p.stock<qty)throw fail(409,p.name+' has only '+p.stock+' left.');sub+=p.price_paise*qty;return{p,qty};});
   const fee=mode==='delivery'?feePaise():0,id=Number(run('INSERT INTO orders(customer_id,business_id,address_id,mode,subtotal_paise,delivery_paise,total_paise) VALUES(?,?,?,?,?,?,?)',u.id,biz.id,addr?.id??null,mode,sub,fee,sub+fee).lastInsertRowid);
   for(const{p,qty}of lines){run('INSERT INTO order_items(order_id,product_id,name,price_paise,qty) VALUES(?,?,?,?,?)',id,p.id,p.name,p.price_paise,qty);run('UPDATE products SET stock=stock-? WHERE id=?',qty,p.id);}
   run("INSERT INTO payments(order_id,method,status,amount_paise) VALUES(?,'cod','pending',?)",id,sub+fee);return{id,subtotal_paise:sub,delivery_paise:fee,total_paise:sub+fee,payment:'cod, pending'};});}],
 ['GET','/api/orders',(b,u)=>{need(u);return{orders:q('SELECT o.*,bz.name business,(SELECT status FROM payments WHERE order_id=o.id) payment_status FROM orders o JOIN businesses bz ON bz.id=o.business_id WHERE customer_id=? ORDER BY o.id DESC',u.id).map(o=>({...o,items:q('SELECT name,price_paise,qty FROM order_items WHERE order_id=?',o.id)}))};}],
 ['POST',/^\/api\/orders\/(\d+)\/cancel$/,(b,u,r,s,m)=>{need(u);const o=one('SELECT * FROM orders WHERE id=? AND customer_id=?',m[1],u.id);if(!o)throw fail(404,'Order not found.');
  if(o.status!=='placed')throw fail(400,'This order is already being prepared. Contact the shop to cancel.');tx(()=>{run("UPDATE orders SET status='cancelled' WHERE id=?",o.id);restock(o.id);});return{ok:true};}],
 ['GET','/api/seller/orders',(b,u)=>({orders:q('SELECT o.*,us.name customer,us.phone customer_phone FROM orders o JOIN users us ON us.id=o.customer_id WHERE business_id=? ORDER BY o.id DESC LIMIT 100',myBiz(u).id).map(o=>({...o,items:q('SELECT name,qty FROM order_items WHERE order_id=?',o.id)}))})],
 ['PATCH',/^\/api\/seller\/orders\/(\d+)\/status$/,(b,u,r,s,m)=>{const biz=myBiz(u),o=one('SELECT * FROM orders WHERE id=? AND business_id=?',m[1],biz.id);if(!o)throw fail(404,'Order not found.');
  if(!(NEXT[o.status]||[]).includes(b.status))throw fail(400,'Cannot change from '+o.status+' to '+b.status+'.');
  tx(()=>{run('UPDATE orders SET status=? WHERE id=?',b.status,o.id);if(b.status==='rejected')restock(o.id);});return{ok:true};}],
 ['GET','/api/admin/orders',(b,u)=>{need(u,'admin');return{orders:q('SELECT o.*,bz.name business FROM orders o JOIN businesses bz ON bz.id=o.business_id ORDER BY o.id DESC LIMIT 200')};}],
 ['PUT','/api/admin/settings',(b,u)=>{need(u,'admin');const f=Math.round(Number(b.delivery_fee)*100);if(!Number.isFinite(f)||f<0||f>1e6)throw fail(400,'Enter a valid delivery fee in ₹.');
  run("INSERT INTO settings VALUES('delivery_fee_paise',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",String(f));audit(u.id,'settings.delivery_fee','settings',{f});return{ok:true};}],
 // ---- Delivery ----
 ['POST','/api/admin/deliveries',(b,u)=>{need(u,'admin');staffOk(b.staff_id);const o=one('SELECT * FROM orders WHERE id=?',b.order_id);if(!o||o.mode!=='delivery')throw fail(400,'Only delivery orders can be assigned.');
  if(!['accepted','preparing','ready'].includes(o.status))throw fail(400,'Order must be accepted by the shop first.');if(one("SELECT 1 x FROM deliveries WHERE order_id=? AND status!='failed'",o.id))throw fail(409,'Already assigned.');
  const d=today(),id=Number(run("INSERT INTO deliveries(kind,order_id,route_date,staff_id,stop_no) VALUES('order',?,?,?,?)",o.id,d,b.staff_id,nextStop(b.staff_id,d)).lastInsertRowid);ev(id,'assigned',null,u.id);audit(u.id,'delivery.assign','order:'+o.id);return{id};}],
 ['POST','/api/admin/deliveries/meals',(b,u)=>{need(u,'admin');staffOk(b.staff_id);const date=str(b.date,10);if(!/^\d{4}-\d\d-\d\d$/.test(date))throw fail(400,'Choose a date.');let n=0;
  tx(()=>{for(const s of q("SELECT * FROM subscriptions WHERE status='active' AND business_id=? AND start_date<=? AND end_date>=?",b.business_id,date,date))
   for(const sl of(s.meal_type==='both'?['lunch','dinner']:s.meal_type.split(','))){
    if(one('SELECT 1 x FROM subscription_skips WHERE subscription_id=? AND meal_date=? AND slot=?',s.id,date,sl)||one('SELECT 1 x FROM deliveries WHERE subscription_id=? AND meal_date=? AND slot=?',s.id,date,sl))continue;
    const id=Number(run("INSERT INTO deliveries(kind,subscription_id,meal_date,slot,route_date,staff_id,stop_no) VALUES('meal',?,?,?,?,?,?)",s.id,date,sl,date,b.staff_id,nextStop(b.staff_id,date)).lastInsertRowid);ev(id,'assigned',null,u.id);n++;}});
  audit(u.id,'delivery.generate_meals','business:'+b.business_id,{date,n});return{created:n};}],
 ['GET','/api/delivery/route',(b,u,req)=>{need(u,'delivery');const date=new URL(req.url,'http://x').searchParams.get('date')||today();
  const stops=q(`SELECT d.*,COALESCE(o.address_id,s.address_id) aid,COALESCE(o.customer_id,s.customer_id) cid,o.total_paise,s.diet FROM deliveries d LEFT JOIN orders o ON o.id=d.order_id LEFT JOIN subscriptions s ON s.id=d.subscription_id
   WHERE d.staff_id=? AND d.route_date=? ORDER BY d.stop_no`,u.id,date).map(d=>{const a=one('SELECT * FROM addresses WHERE id=?',d.aid),c=one('SELECT name,phone FROM users WHERE id=?',d.cid),missing=!a||!a.line1;
    return{id:d.id,stop_no:d.stop_no,kind:d.kind,slot:d.slot,diet:d.diet,status:d.status,customer:c?.name,phone:c?.phone,area:a?.area||null,line1:a?.line1,landmark:a?.landmark,missing_address:missing,
     cod_collect_paise:d.kind==='order'&&one("SELECT 1 x FROM payments WHERE order_id=? AND method='cod' AND status='pending'",d.order_id)?d.total_paise:0,
     maps_url:missing?null:'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination='+encodeURIComponent(mapsQ(a))};});
  const open=stops.filter(s=>!s.missing_address&&!['delivered','failed'].includes(s.status)),addr=s=>decodeURIComponent(s.maps_url.split('destination=')[1]),use=open.slice(0,10);
  const route=use.length?'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination='+encodeURIComponent(addr(use[use.length-1]))+(use.length>1?'&waypoints='+use.slice(0,-1).map(s=>encodeURIComponent(addr(s))).join('%7C'):''):null;
  const byArea={};stops.forEach(s=>{const k=s.area||'No area';byArea[k]=(byArea[k]||0)+1;});
  return{date,stops,by_area:byArea,multi_stop_maps_url:route,note:open.length>10?'Google Maps takes ~10 stops; the link covers the first 10 pending stops.':null};}],
 ['POST','/api/delivery/reorder',(b,u)=>{need(u,'delivery','admin');if(!Array.isArray(b.ids)||b.ids.some(x=>!Number.isInteger(x)))throw fail(400,'Invalid list.');
  const rows=b.ids.map(id=>one('SELECT * FROM deliveries WHERE id=?',id));if(rows.some(r=>!r||(u.role==='delivery'&&r.staff_id!==u.id)))throw fail(403,'You can only reorder your own stops.');
  if(new Set(rows.map(r=>r.staff_id+r.route_date)).size>1)throw fail(400,'Reorder one route at a time.');tx(()=>b.ids.forEach((id,i)=>run('UPDATE deliveries SET stop_no=? WHERE id=?',i+1,id)));return{ok:true};}],
 ['POST',/^\/api\/delivery\/(\d+)\/status$/,(b,u,r,s,m)=>{need(u,'delivery');const d=one('SELECT * FROM deliveries WHERE id=? AND staff_id=?',m[1],u.id);if(!d)throw fail(404,'Stop not found.');
  const ok={assigned:['picked_up','failed'],picked_up:['delivered','failed']};if(!(ok[d.status]||[]).includes(b.status))throw fail(400,'Cannot change from '+d.status+' to '+b.status+'.');
  if(b.status==='failed'&&!str(b.note))throw fail(400,'Add a reason for the failed delivery.');
  tx(()=>{run('UPDATE deliveries SET status=? WHERE id=?',b.status,d.id);ev(d.id,b.status,str(b.note),u.id);
   if(d.kind==='order'){const os={picked_up:'out_for_delivery',delivered:'delivered',failed:'delivery_failed'}[b.status];run('UPDATE orders SET status=? WHERE id=?',os,d.order_id);
    if(b.status==='delivered')run("UPDATE payments SET status='paid',verified_at=datetime('now') WHERE order_id=? AND method='cod' AND status='pending'",d.order_id);}});return{ok:true};}],
];};
