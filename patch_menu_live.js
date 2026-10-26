const fs = require('fs');

// 1. Server mein Live Menu API jodna
let serverCode = fs.readFileSync('server.js', 'utf8');
serverCode = serverCode.replace(/app\.post\('\/api\/set-menu'[\s\S]*?\}\);/, '');

const newMenuApi = `
db.exec("CREATE TABLE IF NOT EXISTS daily_menu (id INTEGER PRIMARY KEY, menu_text TEXT)");
try {
  const count = db.prepare("SELECT COUNT(*) as count FROM daily_menu").get().count;
  if(count === 0) db.prepare("INSERT INTO daily_menu (id, menu_text) VALUES (1, 'Paneer Masala, Dal, Roti, Rice')").run();
} catch(e) {}

app.post('/api/set-menu', (req, res) => {
  const { menu_text } = req.body;
  if(!menu_text) return res.status(400).json({error: "Menu khali hai"});
  db.prepare("UPDATE daily_menu SET menu_text = ? WHERE id = 1").run(menu_text);
  console.log("\\n🔔 NOTIFICATION: Aaj ka naya menu set hua ->", menu_text);
  res.json({success: true});
});

app.get('/api/get-menu', (req, res) => {
  const menu = db.prepare("SELECT menu_text FROM daily_menu WHERE id = 1").get();
  res.json(menu || {menu_text: "Menu abhi update nahi hua hai."});
});

app.post('/api/skip-meal', (req, res) => {
  console.log("\\n🚫 MEAL SKIPPED: Ek customer ne aaj ka khana cancel kiya hai.");
  res.json({success: true});
});
`;

if (!serverCode.includes('/api/get-menu')) {
  serverCode = serverCode.replace('app.listen', newMenuApi + '\\napp.listen');
  fs.writeFileSync('server.js', serverCode);
}

// 2. Customer App (index.html) ko update karna
let htmlCode = fs.readFileSync('public/index.html', 'utf8');
htmlCode = htmlCode.replace('<p id="live-menu-text" style="margin-top: 0; font-size: 18px; font-weight: bold; color: #1f2937;">Loading menu...</p>', '<p style="margin-top: 0; font-size: 18px; font-weight: bold; color: #1f2937;">Paneer Masala, Dal, Roti, Rice</p>'); // Fallback for clean replace
htmlCode = htmlCode.replace('<p style="margin-top: 0; font-size: 18px; font-weight: bold; color: #1f2937;">Paneer Masala, Dal, Roti, Rice</p>', '<p id="live-menu-text" style="margin-top: 0; font-size: 18px; font-weight: bold; color: #1f2937;">Loading menu...</p>');
htmlCode = htmlCode.replace(`onclick="alert('Meal skipped! Aaj ka khana cancel kar diya gaya hai.')"`, `onclick="skipMeal()"`);

const newScript = `
    async function loadMenu() {
      try {
        const res = await fetch('/api/get-menu');
        const data = await res.json();
        document.getElementById('live-menu-text').innerText = data.menu_text;
      } catch(e) {
        document.getElementById('live-menu-text').innerText = "Menu load nahi ho paya.";
      }
    }
    
    async function skipMeal() {
      const res = await fetch('/api/skip-meal', { method: 'POST' });
      if(res.ok) alert('Meal skipped! Aaj ka khana cancel kar diya gaya hai.');
    }

    window.onload = () => {
      loadHulProducts();
      loadMenu();
    };
  </script>
`;
htmlCode = htmlCode.replace('window.onload = loadHulProducts;', '');
htmlCode = htmlCode.replace('</script>', newScript);
fs.writeFileSync('public/index.html', htmlCode);

console.log('✅ Tiffin Menu System ab 100% Dynamic aur Live hai!');
