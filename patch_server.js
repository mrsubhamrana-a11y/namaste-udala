const fs = require('fs');
let serverCode = fs.readFileSync('server.js', 'utf8');

const apiCode = `
// --- PHASE 2: HUL Product API ---
app.post('/api/add-hul-product', (req, res) => {
  const { item_name, price, stock } = req.body;
  if(!item_name || !
[200~cat << 'EOF' > patch_server.js
const fs = require('fs');
let serverCode = fs.readFileSync('server.js', 'utf8');

const apiCode = `
// --- PHASE 2: HUL Product API ---
app.post('/api/add-hul-product', (req, res) => {
  const { item_name, price, stock } = req.body;
  if(!item_name || !price || !stock) return res.status(400).json({error: "Missing data"});
  try {
    const stmt = db.prepare('INSERT INTO hul_products (item_name, price, stock) VALUES (?, ?, ?)');
    stmt.run(item_name, price, stock);
    res.json({success: true});
  } catch (e) {
    res.status(500).json({error: e.message});
  }
});
`;

if (!serverCode.includes('/api/add-hul-product')) {
  if (serverCode.includes('app.listen')) {
    serverCode = serverCode.replace('app.listen', apiCode + '\napp.listen');
  } else {
    serverCode += '\n' + apiCode;
  }
  fs.writeFileSync('server.js', serverCode);
  console.log('✅ Backend API successfully database se jud gayi!');
} else {
  console.log('⚡ API pehle se judi hui hai.');
}
