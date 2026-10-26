const fs = require('fs');
let htmlCode = fs.readFileSync('public/index.html', 'utf8');

// 1. App Header mein Dukaan ka Logo Add karna
if(!htmlCode.includes('3143666.png')) {
    htmlCode = htmlCode.replace('<h1>Namaste Udala</h1>', '<h1 style="display: flex; align-items: center; justify-content: center; gap: 10px;"><img src="https://cdn-icons-png.flaticon.com/512/3143/3143666.png" width="40"> Namaste Udala</h1>');
}

// 2. Payment Modal aur Live QR generator code
const modalHtml = `
    <!-- PHASE 7: Live Payment QR Modal -->
    <div id="paymentModal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:1000; justify-content:center; align-items:center; padding: 20px; box-sizing: border-box;">
      <div style="background:white; padding:25px; border-radius:15px; text-align:center; width: 100%; max-width: 320px; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
        <h2 style="margin-top:0; color:#1f2937; font-size: 22px;">Scan to Pay</h2>
        <p id="payItemText" style="font-weight:bold; color:#d97706; margin-bottom:15px; font-size: 18px;">Item</p>
        
        <!-- Live Generated QR -->
        <img id="qrImage" src="" alt="UPI QR" style="width:200px; height:200px; margin-bottom:15px; border:2px solid #eee; padding:10px; border-radius:10px;">
        
        <p style="font-size:16px; color:#4b5563; margin-bottom:5px;">UPI ID: <b>9583937047@jio</b></p>
        <p style="font-size:14px; color:#6b7280; margin-bottom:20px;">SUBHAM RANA</p>
        <button onclick="document.getElementById('paymentModal').style.display='none'" style="width:100%; padding:14px; background:#16a34a; color:white; border:none; border-radius:8px; font-size:16px; font-weight:bold;">Payment Kar Diya ✅</button>
      </div>
    </div>
    
    <script>
      // QR Code banane ka function
      window.showPaymentQR = function(itemName) {
        // Aapka Asli UPI Link (Amount customer khud daalega)
        const upiUrl = "upi://pay?pa=9583937047@jio&pn=SUBHAM%20RANA&cu=INR&tn=" + encodeURIComponent(itemName);
        const qrApi = "https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=" + encodeURIComponent(upiUrl);
        
        document.getElementById('payItemText').innerText = itemName;
        document.getElementById('qrImage').src = qrApi;
        document.getElementById('paymentModal').style.display = 'flex';
      };

      // Button dabane par QR Popup dikhana
      window.subscribePlan = async function(planName) {
        const res = await fetch('/api/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan_name: planName }) });
        if(res.ok) showPaymentQR("Tiffin: " + planName);
      };
      
      window.buyHulItem = async function(itemName) {
        const res = await fetch('/api/order-hul', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_name: itemName }) });
        if(res.ok) showPaymentQR(itemName);
      };
    </script>
`;

if(!htmlCode.includes('paymentModal')) {
    htmlCode = htmlCode.replace('</body>', modalHtml + '\n</body>');
    fs.writeFileSync('public/index.html', htmlCode);
    console.log('✅ Logo aur Payment QR successfully lag gaye hain!');
}
