const fs = require('fs');
let serverCode = fs.readFileSync('server.js', 'utf8');

// Purane dummy APIs ko hatana
serverCode = serverCode.replace(/app\.post\('\/api\/subscribe'[\s\S]*?\}\);/g, '');
serverCode = serverCode.replace(/app\.post\('\/api\/order-hul'[\s\S]*?\}\);/g, '');

const liveOrderApis = `
// --- PHASE 6: Live Orders & Payments ---
app.post('/api/subscribe', (req, res) => {
  db.prepare("INSERT INTO meal_subscriptions (customer_phone, plan_days, meal_type, start_date) VALUES (?, ?, ?, ?)").run('Naya Customer', req.body.plan_name, 'Tiffin', new Date().toLocaleDateString());
  console.log("\\n🎉 NEW SUBSCRIPTION:", req.body.plan_name);
  res.json({success: true});
});

app.post('/api/order-hul', (req, res) => {
  const item = req.body.item_name;
  const product = db.prepare("SELECT price FROM hul_products WHERE item_name = ?").get(item);
  const price = product ? product.price : 0;
  db.prepare("INSERT INTO retail_orders (customer_phone, total_amount, payment_status) VALUES (?, ?, 'Pending')").run(item + ' (Order)', price);
  console.log("\\n🛍️ NEW ORDER:", item);
  res.json({success: true});
});

app.get('/api/admin-pending-orders', (req, res) => {
  const tiffin = db.prepare("SELECT id, customer_phone as name, plan_days as detail, 'Tiffin' as type FROM meal_subscriptions").all();
  const retail = db.prepare("SELECT id, customer_phone as name, total_amount as detail, 'HUL' as type FROM retail_orders WHERE payment_status = 'Pending'").all();
  res.json([...tiffin, ...retail]);
});
`;

if (!serverCode.includes('/api/admin-pending-orders')) {
  serverCode = serverCode.replace('app.listen', liveOrderApis + '\napp.listen');
  fs.writeFileSync('server.js', serverCode);
}
console.log('✅ Server Live Orders ke liye ready hai!');
