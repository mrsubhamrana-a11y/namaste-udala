// Phase 2: seller onboarding, products/stock, and next-day (tiffin) menus.
module.exports=({db,q,one,run,audit,need,fail,str})=>{
db.exec(`CREATE TABLE IF NOT EXISTS daily_menus(id INTEGER PRIMARY KEY,created_at TEXT DEFAULT CURRENT_TIMESTAMP,business_id INTEGER NOT NULL REFERENCES businesses(id),
 menu_date TEXT NOT NULL,lunch TEXT,dinner TEXT,vegetables TEXT,price_paise INTEGER,order_cutoff TEXT DEFAULT '21:00',UNIQUE(business_id,menu_date));`);
const istDate=(plus=0)=>new Date(Date.now()+5.5*36e5+plus*864e5).toISOString().slice(0,10);
const myBiz=u=>{need(u,'seller');const b=one("SELECT * FROM businesses WHERE owner_id=? AND status='approved'",u.id);if(!b)throw fail(403,'Your business is not approved yet.');return b;};
const rupees=v=>{const n=Math.round(Number(v)*100);if(!Number.isFinite(n)||n<=0||n>1e7)throw fail(400,'Enter a valid price in ₹.');return n;};
return[
 ['POST','/api/seller/apply',(b,u)=>{need(u);if(one("SELECT 1 x FROM businesses WHERE owner_id=? AND status IN('pending','approved')",u.id))throw fail(409,'You already have an application or business.');
  const n=str(b.name,100);if(n.length<2)throw fail(400,'Enter the business name.');if(!one('SELECT 1 x FROM categories WHERE id=? AND active=1',b.category_id))throw fail(400,'Choose a category.');
  if(one('SELECT regulated r FROM categories WHERE id=?',b.category_id).r&&str(b.license_info).length<3)throw fail(400,'Regulated categories need licence / registration details.');
  const id=run('INSERT INTO businesses(owner_id,name,category_id,phone,address,license_info,hours,service_areas) VALUES(?,?,?,?,?,?,?,?)',u.id,n,b.category_id,str(b.phone,10),str(b.address),str(b.license_info),str(b.hours,100),str(b.service_areas,300)).lastInsertRowid;
  audit(u.id,'seller.apply','business:'+id);return{id:Number(id),status:'pending'};}],
 ['GET','/api/admin/businesses',(b,u)=>{need(u,'admin');return{businesses:q('SELECT b.*,u.name owner_name,u.phone owner_phone FROM businesses b JOIN users u ON u.id=b.owner_id ORDER BY b.status="pending" DESC,b.id DESC')};}],
 ['POST',/^\/api\/admin\/businesses\/(\d+)\/review$/,(b,u,r,s,m)=>{need(u,'admin');const x=one('SELECT * FROM businesses WHERE id=?',m[1]);if(!x)throw fail(404,'Business not found.');
  if(!['approved','rejected','suspended'].includes(b.decision))throw fail(400,'Invalid decision.');
  run("UPDATE businesses SET status=?,reviewed_by=?,reviewed_at=datetime('now') WHERE id=?",b.decision,u.id,x.id);
  if(b.decision==='approved')run("UPDATE users SET role='seller' WHERE id=? AND role='customer'",x.owner_id);
  audit(u.id,'business.'+b.decision,'business:'+x.id);return{ok:true};}],
 ['GET','/api/seller/products',(b,u)=>({products:q('SELECT * FROM products WHERE business_id=? ORDER BY id DESC',myBiz(u).id)})],
 ['POST','/api/seller/products',(b,u)=>{const biz=myBiz(u),n=str(b.name,100);if(!n)throw fail(400,'Enter the product name.');
  const id=run('INSERT INTO products(business_id,name,description,price_paise,unit,stock) VALUES(?,?,?,?,?,?)',biz.id,n,str(b.description,300),rupees(b.price),str(b.unit,20),Math.max(0,parseInt(b.stock)||0)).lastInsertRowid;return{id:Number(id)};}],
 ['PATCH',/^\/api\/seller\/products\/(\d+)$/,(b,u,r,s,m)=>{const biz=myBiz(u),p=one('SELECT * FROM products WHERE id=? AND business_id=?',m[1],biz.id);if(!p)throw fail(404,'Product not found.');
  run('UPDATE products SET price_paise=?,stock=?,available=? WHERE id=?',b.price!=null?rupees(b.price):p.price_paise,b.stock!=null?Math.max(0,parseInt(b.stock)||0):p.stock,b.available!=null?(b.available?1:0):p.available,p.id);return{ok:true};}],
 ['GET','/api/products',(b,u,req)=>{const sp=new URL(req.url,'http://x').searchParams,cat=sp.get('category_id'),s='%'+(sp.get('q')||'').slice(0,50)+'%';
  return{products:q(`SELECT p.id,p.name,p.description,p.price_paise,p.unit,p.stock,b.id business_id,b.name business FROM products p JOIN businesses b ON b.id=p.business_id
   WHERE b.status='approved' AND p.available=1 AND p.stock>0 AND p.name LIKE ? AND (? IS NULL OR b.category_id=?)`,s,cat,cat)};}],
 // Tiffin: menu for a day must be published at least one day ahead (sabzi availability decided the day before).
 ['PUT','/api/seller/menu',(b,u)=>{const biz=myBiz(u),d=str(b.date,10);if(!/^\d{4}-\d\d-\d\d$/.test(d))throw fail(400,'Choose a valid date.');
  if(d<istDate(1))throw fail(400,'Menus must be set at least one day ahead. Choose tomorrow or a later date.');
  if(!str(b.lunch)&&!str(b.dinner))throw fail(400,'Add a lunch or dinner menu.');
  run(`INSERT INTO daily_menus(business_id,menu_date,lunch,dinner,vegetables,price_paise,order_cutoff) VALUES(?,?,?,?,?,?,?)
   ON CONFLICT(business_id,menu_date) DO UPDATE SET lunch=excluded.lunch,dinner=excluded.dinner,vegetables=excluded.vegetables,price_paise=excluded.price_paise,order_cutoff=excluded.order_cutoff`,
   biz.id,d,str(b.lunch),str(b.dinner),str(b.vegetables),rupees(b.price),/^\d\d:\d\d$/.test(b.cutoff)?b.cutoff:'21:00');return{ok:true};}],
 ['GET','/api/menu',(b,u,req)=>{const sp=new URL(req.url,'http://x').searchParams,d=sp.get('date')||istDate(1);
  return{date:d,menus:q(`SELECT m.*,b.name business FROM daily_menus m JOIN businesses b ON b.id=m.business_id WHERE b.status='approved' AND m.menu_date=?`,d)};}],
];};
