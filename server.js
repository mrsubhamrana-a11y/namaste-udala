// Namaste Udala - Phase 1 server. Zero dependencies: Node >=22.13 (node:sqlite).
const http=require('http'),fs=require('fs'),path=require('path'),c=require('crypto');
const {DatabaseSync}=require('node:sqlite');
const PORT=process.env.PORT||8081, DB=process.env.DB_FILE||path.join(__dirname,'data.db');
const db=new DatabaseSync(DB); db.exec('PRAGMA foreign_keys=ON;PRAGMA journal_mode=WAL;');
const T="id INTEGER PRIMARY KEY, created_at TEXT DEFAULT CURRENT_TIMESTAMP";
db.exec(`
CREATE TABLE IF NOT EXISTS users(${T},phone TEXT UNIQUE NOT NULL,name TEXT NOT NULL,pw TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'customer' CHECK(role IN('customer','seller','delivery','admin')),
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN('active','suspended')));
CREATE TABLE IF NOT EXISTS addresses(${T},user_id INTEGER NOT NULL REFERENCES users(id),label TEXT,line1 TEXT NOT NULL,landmark TEXT,area TEXT,pincode TEXT);
CREATE TABLE IF NOT EXISTS categories(${T},name TEXT UNIQUE NOT NULL,sort INTEGER DEFAULT 0,active INTEGER DEFAULT 1,regulated INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS businesses(${T},owner_id INTEGER NOT NULL REFERENCES users(id),name TEXT NOT NULL,category_id INTEGER REFERENCES categories(id),
 phone TEXT,address TEXT,license_info TEXT,hours TEXT,service_areas TEXT,status TEXT DEFAULT 'pending' CHECK(status IN('pending','approved','rejected','suspended')),reviewed_by INTEGER,reviewed_at TEXT);
CREATE TABLE IF NOT EXISTS products(${T},business_id INTEGER NOT NULL REFERENCES businesses(id),name TEXT NOT NULL,description TEXT,price_paise INTEGER NOT NULL,unit TEXT,stock INTEGER DEFAULT 0,available INTEGER DEFAULT 1,photo TEXT);
CREATE TABLE IF NOT EXISTS orders(${T},customer_id INTEGER NOT NULL REFERENCES users(id),business_id INTEGER NOT NULL REFERENCES businesses(id),address_id INTEGER REFERENCES addresses(id),
 mode TEXT DEFAULT 'delivery',status TEXT DEFAULT 'placed',subtotal_paise INTEGER,delivery_paise INTEGER DEFAULT 0,total_paise INTEGER);
CREATE TABLE IF NOT EXISTS order_items(${T},order_id INTEGER NOT NULL REFERENCES orders(id),product_id INTEGER REFERENCES products(id),name TEXT,price_paise INTEGER,qty INTEGER);
CREATE TABLE IF NOT EXISTS payments(${T},order_id INTEGER NOT NULL REFERENCES orders(id),method TEXT,status TEXT DEFAULT 'pending',amount_paise INTEGER,gateway_ref TEXT,verified_at TEXT);
CREATE TABLE IF NOT EXISTS refunds(${T},payment_id INTEGER NOT NULL REFERENCES payments(id),amount_paise INTEGER,status TEXT DEFAULT 'requested',gateway_ref TEXT);
CREATE TABLE IF NOT EXISTS delivery_assignments(${T},order_id INTEGER NOT NULL REFERENCES orders(id),staff_id INTEGER NOT NULL REFERENCES users(id),stop_no INTEGER,status TEXT DEFAULT 'assigned');
CREATE TABLE IF NOT EXISTS delivery_status_history(${T},assignment_id INTEGER NOT NULL REFERENCES delivery_assignments(id),status TEXT,note TEXT,by_user INTEGER);
CREATE TABLE IF NOT EXISTS reviews(${T},order_id INTEGER REFERENCES orders(id),user_id INTEGER REFERENCES users(id),business_id INTEGER REFERENCES businesses(id),rating INTEGER CHECK(rating BETWEEN 1 AND 5),body TEXT);
CREATE TABLE IF NOT EXISTS support_requests(${T},user_id INTEGER REFERENCES users(id),order_id INTEGER,subject TEXT,body TEXT,status TEXT DEFAULT 'open');
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT);
CREATE TABLE IF NOT EXISTS audit_logs(${T},actor_id INTEGER,action TEXT,target TEXT,detail TEXT);`);
const q=(s,...a)=>db.prepare(s).all(...a), one=(s,...a)=>db.prepare(s).get(...a), run=(s,...a)=>db.prepare(s).run(...a);
const audit=(u,a,t,d)=>run('INSERT INTO audit_logs(actor_id,action,target,detail) VALUES(?,?,?,?)',u,a,t,d?JSON.stringify(d):null);
// Default categories (admin-editable). No businesses/products are ever seeded.
if(!one('SELECT 1 x FROM categories')) ['Grocery & daily essentials','Vegetables & fruits','Chicken, fish, mutton & eggs','Milk & dairy','Restaurants & tiffin','Household products','Local shops & services']
 .forEach((n,i)=>run('INSERT INTO categories(name,sort,regulated) VALUES(?,?,?)',n,i,i==2?1:0));
// Secrets: SESSION_SECRET env, else generated once and stored.
let SECRET=process.env.SESSION_SECRET||one("SELECT value v FROM settings WHERE key='secret'")?.v;
if(!SECRET){SECRET=c.randomBytes(32).toString('hex');run("INSERT INTO settings VALUES('secret',?)",SECRET);}
// Admin bootstrap: only from env vars, never a default password.
if(process.env.ADMIN_PHONE&&process.env.ADMIN_PASSWORD&&!one("SELECT 1 x FROM users WHERE role='admin'"))
 {run("INSERT INTO users(phone,name,pw,role) VALUES(?,?,?,'admin')",process.env.ADMIN_PHONE,'Administrator',hash(process.env.ADMIN_PASSWORD));console.log('Admin created');}
function hash(p){const s=c.randomBytes(16);return s.toString('hex')+':'+c.scryptSync(p,s,64).toString('hex');}
function verify(p,h){const[s,k]=h.split(':');return c.timingSafeEqual(c.scryptSync(p,Buffer.from(s,'hex'),64),Buffer.from(k,'hex'));}
const sign=v=>c.createHmac('sha256',SECRET).update(v).digest('base64url');
const mint=uid=>{const b=Buffer.from(JSON.stringify({uid,exp:Date.now()+7*864e5})).toString('base64url');return b+'.'+sign(b);};
function sessionUser(req){const m=/(?:^|; )sid=([^;]+)/.exec(req.headers.cookie||'');if(!m)return null;const[b,s]=m[1].split('.');
 if(!s||s.length!==sign(b).length||!c.timingSafeEqual(Buffer.from(s),Buffer.from(sign(b))))return null;
 const p=JSON.parse(Buffer.from(b,'base64url'));if(p.exp<Date.now())return null;
 const u=one('SELECT id,phone,name,role,status FROM users WHERE id=?',p.uid);return u&&u.status==='active'?u:null;}
const tries=new Map();
const fail=(code,msg)=>Object.assign(new Error(msg),{code});
const need=(u,...roles)=>{if(!u)throw fail(401,'Please log in.');if(roles.length&&!roles.includes(u.role))throw fail(403,'You do not have access to this.');};
const str=(v,max=200)=>typeof v==='string'?v.trim().slice(0,max):'';
const cookie=(v,age)=>`sid=${v}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${age}`;
const routes=[
 ['POST','/api/register',(b,u,r,res)=>{const phone=str(b.phone,10),name=str(b.name,80),pw=str(b.password,100);
  if(!/^[6-9]\d{9}$/.test(phone))throw fail(400,'Enter a valid 10-digit Indian mobile number.');
  if(name.length<2)throw fail(400,'Enter your name.');if(pw.length<8)throw fail(400,'Password must be at least 8 characters.');
  if(one('SELECT 1 x FROM users WHERE phone=?',phone))throw fail(409,'This number is already registered. Try logging in.');
  const id=Number(run('INSERT INTO users(phone,name,pw) VALUES(?,?,?)',phone,name,hash(pw)).lastInsertRowid); // role is always customer
  res.setHeader('Set-Cookie',cookie(mint(id),604800));return{user:one('SELECT id,phone,name,role FROM users WHERE id=?',id)};}],
 ['POST','/api/login',(b,u,r,res)=>{const k=r.socket.remoteAddress+str(b.phone,10),t=tries.get(k)||{n:0,at:Date.now()};
  if(Date.now()-t.at>9e5){t.n=0;t.at=Date.now();} if(t.n>=8)throw fail(429,'Too many attempts. Try again in 15 minutes.');
  const x=one('SELECT * FROM users WHERE phone=?',str(b.phone,10));
  if(!x||!verify(str(b.password,100),x.pw)){t.n++;tries.set(k,t);throw fail(401,'Phone number or password is incorrect.');}
  if(x.status!=='active')throw fail(403,'This account is suspended. Contact support.');
  tries.delete(k);res.setHeader('Set-Cookie',cookie(mint(x.id),604800));return{user:{id:x.id,phone:x.phone,name:x.name,role:x.role}};}],
 ['POST','/api/logout',(b,u,r,res)=>{res.setHeader('Set-Cookie',cookie('',0));return{ok:true};}],
 ['GET','/api/me',(b,u)=>{need(u);return{user:u};}],
 ['PATCH','/api/me',(b,u)=>{need(u);const n=str(b.name,80);if(n.length<2)throw fail(400,'Enter your name.');run('UPDATE users SET name=? WHERE id=?',n,u.id);return{ok:true};}],
 ['GET','/api/addresses',(b,u)=>{need(u);return{addresses:q('SELECT * FROM addresses WHERE user_id=? ORDER BY id DESC',u.id)};}],
 ['POST','/api/addresses',(b,u)=>{need(u);const l=str(b.line1);if(!l)throw fail(400,'House / street is required.');
  const id=run('INSERT INTO addresses(user_id,label,line1,landmark,area,pincode) VALUES(?,?,?,?,?,?)',u.id,str(b.label,30),l,str(b.landmark),str(b.area,60),str(b.pincode,6)).lastInsertRowid;return{id:Number(id)};}],
 ['DELETE',/^\/api\/addresses\/(\d+)$/,(b,u,r,res,m)=>{need(u);run('DELETE FROM addresses WHERE id=? AND user_id=?',m[1],u.id);return{ok:true};}],
 ['GET','/api/categories',()=>({categories:q('SELECT id,name,regulated FROM categories WHERE active=1 ORDER BY sort,id')})],
 ['GET','/api/admin/users',(b,u)=>{need(u,'admin');return{users:q('SELECT id,phone,name,role,status,created_at FROM users ORDER BY id DESC LIMIT 200')};}],
 ['PATCH',/^\/api\/admin\/users\/(\d+)$/,(b,u,r,res,m)=>{need(u,'admin');const t=one('SELECT * FROM users WHERE id=?',m[1]);if(!t)throw fail(404,'User not found.');
  if(t.id===u.id)throw fail(400,'You cannot change your own role or status.');
  if(b.role&&!['customer','seller','delivery','admin'].includes(b.role))throw fail(400,'Invalid role.');
  if(b.status&&!['active','suspended'].includes(b.status))throw fail(400,'Invalid status.');
  run('UPDATE users SET role=?,status=? WHERE id=?',b.role||t.role,b.status||t.status,t.id);audit(u.id,'user.update','user:'+t.id,{role:b.role,status:b.status});return{ok:true};}],
 ['POST','/api/admin/categories',(b,u)=>{need(u,'admin');const n=str(b.name,60);if(!n)throw fail(400,'Category name is required.');
  try{const id=run('INSERT INTO categories(name,sort,regulated) VALUES(?,?,?)',n,99,b.regulated?1:0).lastInsertRowid;audit(u.id,'category.create','category:'+id,{n});return{id:Number(id)};}
  catch{throw fail(409,'That category already exists.');}}],
 ['GET','/api/admin/audit',(b,u)=>{need(u,'admin');return{logs:q('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100')};}],
...require('./phase2')({db,q,one,run,audit,need,fail,str}),
 ...require('./phase3')({db,q,one,run,audit,need,fail,str}),
 ...require('./phase4')({db,q,one,run,audit,need,fail,str}),
];
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.css':'text/css'};
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://x'),p=url.pathname;
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:");
 if(p.startsWith('/api/')){let raw='';req.on('data',d=>{raw+=d;if(raw.length>1e5)req.destroy();});req.on('end',()=>{
  res.setHeader('Content-Type','application/json');
  try{let b={};if(req.method!=='GET'){if(!(req.headers['content-type']||'').includes('application/json'))throw fail(415,'JSON required.');b=raw?JSON.parse(raw):{};}
   for(const[m,pat,fn]of routes){if(m!==req.method)continue;const mm=typeof pat==='string'?(pat===p?[]:null):pat.exec(p);if(!mm)continue;
    return res.end(JSON.stringify(fn(b,sessionUser(req),req,res,mm)));}
   throw fail(404,'Not found.');
  }catch(e){const code=e.code>=400&&e.code<600?e.code:(e instanceof SyntaxError?400:500);if(code===500)console.error(e);res.statusCode=code;res.end(JSON.stringify({error:code===500?'Something went wrong. Please try again.':e.message}));}});return;}
 let f=path.join(__dirname,'public',p==='/'?'index.html':p);if(!f.startsWith(path.join(__dirname,'public'))||!fs.existsSync(f)||fs.statSync(f).isDirectory())f=path.join(__dirname,'public','index.html');
 res.setHeader('Content-Type',MIME[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res);});
if(require.main===module)server.listen(PORT,()=>console.log('Namaste Udala on :'+PORT)); module.exports={server};
