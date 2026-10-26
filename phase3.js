// Phase 3 (tiffin): prepaid packs (7/15/30 day), one free trial meal, skip before 9 PM, kitchen count.
module.exports=({db,q,one,run,audit,need,fail,str})=>{
try{db.exec('ALTER TABLE businesses ADD COLUMN trial_enabled INTEGER DEFAULT 0')}catch{}
db.exec(`CREATE TABLE IF NOT EXISTS tiffin_packs(id INTEGER PRIMARY KEY,business_id INTEGER NOT NULL REFERENCES businesses(id),name TEXT,days INTEGER NOT NULL,price_paise INTEGER NOT NULL,meal_type TEXT NOT NULL,diet TEXT NOT NULL,active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS subscriptions(id INTEGER PRIMARY KEY,created_at TEXT DEFAULT CURRENT_TIMESTAMP,customer_id INTEGER NOT NULL REFERENCES users(id),business_id INTEGER NOT NULL REFERENCES businesses(id),pack_id INTEGER,is_trial INTEGER DEFAULT 0,
 address_id INTEGER NOT NULL REFERENCES addresses(id),diet TEXT,meal_type TEXT,start_date TEXT,end_date TEXT,price_paise INTEGER,status TEXT DEFAULT 'pending_payment',credit_paise INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS subscription_skips(id INTEGER PRIMARY KEY,subscription_id INTEGER NOT NULL REFERENCES subscriptions(id),meal_date TEXT,slot TEXT,credit_paise INTEGER,UNIQUE(subscription_id,meal_date,slot));
CREATE TABLE IF NOT EXISTS subscription_payments(id INTEGER PRIMARY KEY,created_at TEXT DEFAULT CURRENT_TIMESTAMP,subscription_id INTEGER NOT NULL REFERENCES subscriptions(id),method TEXT,amount_paise INTEGER,confirmed_by INTEGER);`);
db.exec(`CREATE TABLE IF NOT EXISTS meal_rates(business_id INTEGER NOT NULL REFERENCES businesses(id),slot TEXT NOT NULL,diet TEXT NOT NULL,price_paise INTEGER NOT NULL,PRIMARY KEY(business_id,slot,diet))`);
try{db.exec('ALTER TABLE subscriptions ADD COLUMN rates_json TEXT')}catch{}
const SL=['morning','lunch','dinner'],rate=(biz,sl,d)=>one('SELECT price_paise p FROM meal_rates WHERE business_id=? AND slot=? AND diet=?',biz,sl,d)?.p;
const IST=36e5*5.5,ist=(ms=Date.now())=>new Date(ms+IST).toISOString().slice(0,10);
const addD=(d,n)=>new Date(Date.parse(d+'T00:00:00Z')+n*864e5).toISOString().slice(0,10);
const cutoffMs=d=>Date.parse(d+'T00:00:00+05:30')-3*36e5; // 9 PM IST the evening before
const earliest=()=>cutoffMs(addD(ist(),1))>Date.now()?addD(ist(),1):addD(ist(),2);
const myBiz=u=>{need(u,'seller');const b=one("SELECT * FROM businesses WHERE owner_id=? AND status='approved'",u.id);if(!b)throw fail(403,'Your business is not approved yet.');return b;};
const sub=(id)=>one('SELECT * FROM subscriptions WHERE id=?',id);
const slots=s=>s.meal_type==='both'?['lunch','dinner']:s.meal_type.split(',');
const rupees=v=>{const n=Math.round(Number(v)*100);if(!Number.isFinite(n)||n<=0||n>1e7)throw fail(400,'Enter a valid price in ₹.');return n;};
return[
 ['POST','/api/seller/packs',(b,u)=>{const biz=myBiz(u),days=parseInt(b.days);if(![7,15,30].includes(days))throw fail(400,'Pack must be 7, 15 or 30 days.');
  const raw=b.meal_type==='both'?'lunch,dinner':String(b.meal_type||''),ms=SL.filter(x=>raw.split(',').includes(x));
  if(!ms.length||!['veg','nonveg'].includes(b.diet))throw fail(400,'Choose meals (morning, lunch, dinner) and veg / non-veg.');
  let price;if(b.price!=null&&b.price!=='')price=rupees(b.price);else{const r=ms.map(sl=>rate(biz.id,sl,b.diet));if(r.some(x=>!x))throw fail(400,'Set your meal rates first, or enter a pack price.');price=r.reduce((a,x)=>a+x,0)*days;}
  return{id:Number(run('INSERT INTO tiffin_packs(business_id,name,days,price_paise,meal_type,diet) VALUES(?,?,?,?,?,?)',biz.id,str(b.name,60)||days+'-day pack',days,price,ms.join(','),b.diet).lastInsertRowid),price_paise:price};}],
 ['PUT','/api/seller/rates',(b,u)=>{const biz=myBiz(u);const list=b.preset==='suggested'?[['morning','veg',40],['lunch','veg',50],['dinner','veg',60],['morning','nonveg',60],['lunch','nonveg',80],['dinner','nonveg',100]].map(([slot,diet,price])=>({slot,diet,price})):b.rates;
  if(!Array.isArray(list)||!list.length)throw fail(400,'Send rates.');for(const r of list)if(!SL.includes(r.slot)||!['veg','nonveg'].includes(r.diet))throw fail(400,'Invalid meal or diet.');
  for(const r of list)run('INSERT INTO meal_rates VALUES(?,?,?,?) ON CONFLICT(business_id,slot,diet) DO UPDATE SET price_paise=excluded.price_paise',biz.id,r.slot,r.diet,rupees(r.price));return{ok:true};}],
 ['GET','/api/rates',(b,u,req)=>({rates:q('SELECT slot,diet,price_paise FROM meal_rates WHERE business_id=?',new URL(req.url,'http://x').searchParams.get('business_id'))})],
 ['POST','/api/seller/trial',(b,u)=>{const biz=myBiz(u);run('UPDATE businesses SET trial_enabled=? WHERE id=?',b.enabled?1:0,biz.id);return{ok:true};}],
 ['GET','/api/packs',(b,u,req)=>{const id=new URL(req.url,'http://x').searchParams.get('business_id');
  const bz=one("SELECT id,name,trial_enabled FROM businesses WHERE id=? AND status='approved'",id);if(!bz)throw fail(404,'Business not found.');
  return{business:bz,packs:q('SELECT * FROM tiffin_packs WHERE business_id=? AND active=1',bz.id),earliest_start:earliest()};}],
 ['POST','/api/subscriptions',(b,u)=>{need(u);const addr=one('SELECT * FROM addresses WHERE id=? AND user_id=?',b.address_id,u.id);if(!addr||!addr.line1)throw fail(400,'Choose a delivery address first.');
  const start=str(b.start_date,10)||earliest();if(!/^\d{4}-\d\d-\d\d$/.test(start)||start<earliest())throw fail(400,'Start date must be '+earliest()+' or later (order before 9 PM the evening before).');
  let biz,pack=null,days=1,price=0,trial=0,diet=b.diet,meal=b.meal_type;
  if(b.trial){biz=one("SELECT * FROM businesses WHERE id=? AND status='approved' AND trial_enabled=1",b.business_id);if(!biz)throw fail(400,'This kitchen does not offer a free trial.');
   if(one('SELECT 1 x FROM subscriptions WHERE customer_id=? AND business_id=? AND is_trial=1 AND status!=\'cancelled\'',u.id,biz.id))throw fail(409,'You have already used the free trial for this kitchen.');
   if(!SL.includes(meal)||!['veg','nonveg'].includes(diet))throw fail(400,'Choose lunch or dinner, and veg or non-veg.');trial=1;}
  else{pack=one('SELECT * FROM tiffin_packs WHERE id=? AND active=1',b.pack_id);if(!pack)throw fail(404,'Pack not found.');
   biz=one("SELECT * FROM businesses WHERE id=? AND status='approved'",pack.business_id);if(!biz)throw fail(400,'This kitchen is not available.');days=pack.days;price=pack.price_paise;diet=pack.diet;meal=pack.meal_type;}
  const id=Number(run('INSERT INTO subscriptions(customer_id,business_id,pack_id,is_trial,address_id,diet,meal_type,start_date,end_date,price_paise,status) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
   u.id,biz.id,pack?.id??null,trial,addr.id,diet,meal,start,addD(start,days-1),price,trial?'active':'pending_payment').lastInsertRowid);
  if(pack){const rj={},full=slots(pack).reduce((t,sl)=>t+(rate(biz.id,sl,pack.diet)||0),0)*pack.days,f=full?pack.price_paise/full:0; // scale credits to what the customer actually paid
  if(full)slots(pack).forEach(sl=>{const p=rate(biz.id,sl,pack.diet);if(p)rj[sl]=Math.round(p*f);});run('UPDATE subscriptions SET rates_json=? WHERE id=?',JSON.stringify(rj),id);}
  audit(u.id,'subscription.create','subscription:'+id);return{id,status:trial?'active':'pending_payment',price_paise:price,end_date:addD(start,days-1)};}],
 ['GET','/api/subscriptions',(b,u)=>{need(u);return{subscriptions:q('SELECT s.*,b.name business FROM subscriptions s JOIN businesses b ON b.id=s.business_id WHERE customer_id=? ORDER BY s.id DESC',u.id)};}],
 ['POST',/^\/api\/subscriptions\/(\d+)\/skip$/,(b,u,r,s,m)=>{need(u);const x=sub(m[1]);if(!x||x.customer_id!==u.id)throw fail(404,'Plan not found.');
  if(x.status!=='active')throw fail(400,'This plan is not active.');const d=str(b.date,10);if(d<x.start_date||d>x.end_date)throw fail(400,'That date is outside your plan.');
  if(!slots(x).includes(b.slot))throw fail(400,'That meal is not part of your plan.');
  if(Date.now()>=cutoffMs(d))throw fail(400,'Skip time is over. Skips close at 9 PM the evening before.');
  const per=x.is_trial?0:(JSON.parse(x.rates_json||'{}')[b.slot]??Math.round(x.price_paise/(((Date.parse(x.end_date)-Date.parse(x.start_date))/864e5+1)*slots(x).length)));
  try{run('INSERT INTO subscription_skips(subscription_id,meal_date,slot,credit_paise) VALUES(?,?,?,?)',x.id,d,b.slot,per);}catch{throw fail(409,'Already skipped.');}
  run('UPDATE subscriptions SET credit_paise=credit_paise+? WHERE id=?',per,x.id);return{credit_paise:per};}],
 ['POST',/^\/api\/seller\/subscriptions\/(\d+)\/confirm-cash$/,(b,u,r,s,m)=>{const biz=myBiz(u),x=sub(m[1]);if(!x||x.business_id!==biz.id)throw fail(404,'Plan not found.');
  if(x.status!=='pending_payment')throw fail(400,'Already confirmed.');run('INSERT INTO subscription_payments(subscription_id,method,amount_paise,confirmed_by) VALUES(?,?,?,?)',x.id,'cash',x.price_paise,u.id);
  run("UPDATE subscriptions SET status='active' WHERE id=?",x.id);audit(u.id,'subscription.cash_confirmed','subscription:'+x.id);return{ok:true};}],
 ['GET','/api/seller/count',(b,u,req)=>{const biz=myBiz(u),d=new URL(req.url,'http://x').searchParams.get('date')||earliest();
  const subs=q("SELECT * FROM subscriptions WHERE business_id=? AND status='active' AND start_date<=? AND end_date>=?",biz.id,d,d),out={date:d,locked:Date.now()>=cutoffMs(d),morning:{veg:0,nonveg:0,skipped:0},lunch:{veg:0,nonveg:0,skipped:0},dinner:{veg:0,nonveg:0,skipped:0}};
  for(const x of subs)for(const sl of slots(x)){if(one('SELECT 1 x FROM subscription_skips WHERE subscription_id=? AND meal_date=? AND slot=?',x.id,d,sl))out[sl].skipped++;else out[sl][x.diet]++;}
  return out;}],
];};
