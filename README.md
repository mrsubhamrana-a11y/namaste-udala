# Namaste Udala (Phase 1)
Requires Node >= 22.13 (built-in node:sqlite). No npm install needed.

    ADMIN_PHONE=98XXXXXXXX ADMIN_PASSWORD='choose-a-strong-one' SESSION_SECRET=$(openssl rand -hex 32) node server.js
    node test.js        # runs 16 automated checks against a temporary DB

- Admin is created only from the env vars above (first run, if no admin exists). There is no default password.
- Data lives in data.db (SQLite). Back it up; put it on persistent storage when hosting.
- Serve over HTTPS in production (add `Secure` to the cookie) and set SESSION_SECRET.
- Not yet built: sellers, products, cart, orders, delivery, payments, reports (Phases 2-6).
- UPI needs a real gateway account (e.g. Razorpay/Cashfree) with merchant KYC: Phase 5.
- APK: not generated. Phase 6 will document Capacitor packaging; Play Store needs a developer account (one-time fee).
