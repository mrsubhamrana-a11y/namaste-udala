const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('namaste_udala.db'); // Aapka existing database

console.log("Phase 2 Update Start kar rahe hain...");

db.exec(`
  -- HUL aur Daily Needs Items ke liye
  CREATE TABLE IF NOT EXISTS hul_products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_name TEXT NOT NULL,
    price REAL NOT NULL,
    stock INTEGER NOT NULL DEFAULT 10,
    category TEXT DEFAULT 'HUL Daily Needs'
  );

  -- Meal Subscriptions (7, 15, 30 days) ke liye
  CREATE TABLE IF NOT EXISTS meal_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_phone TEXT NOT NULL,
    plan_days INTEGER NOT NULL, 
    meal_type TEXT NOT NULL, -- Veg/Non-Veg
    start_date TEXT NOT NULL,
    status TEXT DEFAULT 'Trial (Day 1)'
  );

  -- HUL aur Daily Needs ke Orders (Cash/UPI on Delivery)
  CREATE TABLE IF NOT EXISTS retail_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_phone TEXT NOT NULL,
    total_amount REAL NOT NULL,
    payment_status TEXT DEFAULT 'Pending (Cash/UPI on Delivery)',
    delivery_status TEXT DEFAULT 'To Deliver'
  );
`);

console.log("✅ Phase 2 Tables Successfully Ban Gayi Hain!");
console.log("✅ HUL Store, Subscription, aur Cash/UPI feature ready hai.");
