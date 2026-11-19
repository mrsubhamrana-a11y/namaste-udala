/* === NAMASTE UDALA v6 — JIO UPI QR + UTR + SERVICES + 3D MOTION === */
(function () {
  const MY_UPI_ID = '9583937047@jio';
  const MY_UPI_NAME = 'Namaste Udala';
  const MY_WA_PHONE = '919583937047';

  document.head.insertAdjacentHTML('beforeend', `
    <style>
      @keyframes nuFloat3d {
        0%, 100% { transform: translateY(0px) rotate(-2deg) scale(1); }
        50% { transform: translateY(-9px) rotate(3deg) scale(1.04); }
      }
      .hero3d { perspective: 800px; }
      .hero-3d-plate {
        position: absolute; right: 10px; top: 50%; margin-top: -46px;
        width: 92px; height: 92px; border-radius: 50%;
        border: 3px solid rgba(255,255,255,.35);
        box-shadow: 0 14px 26px rgba(0,0,0,.4), inset 0 2px 6px rgba(255,255,255,.4);
        animation: nuFloat3d 4s ease-in-out infinite;
        object-fit: cover;
      }
      .p-tier, .card { transition: transform .2s ease, box-shadow .2s ease; }
      .p-tier:active, .btn:active { transform: translateY(3px) scale(0.98); }
      .qr-box { background:#fff; padding:12px; border-radius:18px; display:inline-block; box-shadow:0 8px 20px rgba(0,0,0,.12); margin:10px 0; }
    </style>
  `);

  const SERVICES = [
    { id: 'sv1', n: '20L RO Water Can', p: 40, desc: 'Subah-Shaam Fast Home Delivery', ic: '💧' },
    { id: 'sv2', n: 'LPG Gas Cylinder Help', p: 50, desc: 'Booking & Doorstep Exchange', ic: '🔥' },
    { id: 'sv3', n: 'Electrician Visit', p: 149, desc: 'Fan, Switch, Inverter Repair', ic: '⚡' },
    { id: 'sv4', n: 'Plumber Visit', p: 149, desc: 'Tap, Pipe, Motor Fitting', ic: '🔧' },
    { id: 'sv5', n: 'Party / Bulk Catering', p: 99, desc: 'Per Plate · Udala Local Catering', ic: '🍛' }
  ];

  window.vServices = function () {
    return `
    <div class="hero3d" style="background:linear-gradient(132deg,#0f2942,#1e4d7b)">
      <span class="hero-pill">UDALA LOCAL SERVICES</span>
      <h2>Home Services & Daily Help</h2>
      <p>Verified Local Staff · Fast Response</p>
    </div>
    ${SERVICES.map(s => `
      <div class="card" style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="font-size:26px;background:var(--sf2);width:48px;height:48px;border-radius:14px;display:grid;place-items:center">${s.ic}</div>
          <div>
            <b style="font-size:14px">${s.n}</b>
            <div style="font-size:11px;color:var(--mu)">${s.desc}</div>
            <div style="font-size:13px;font-weight:800;color:var(--o);margin-top:2px">${inr(s.p)}</div>
          </div>
        </div>
        <button class="btn g sm" onclick="bookService('${s.n}', ${s.p})">Book ✓</button>
      </div>
    `).join('')}`;
  };

  window.bookService = function (name, price) {
    const msg = encodeURIComponent(`Namaste Udala! Mujhe *${name}* (₹${price}) service chahiye.\nNaam: ${F.name}\nPhone: ${F.phone}\nAddress: ${F.addr}`);
    window.open(`https://wa.me/${MY_WA_PHONE}?text=${msg}`, '_blank');
  };

  window.PAY_BOX = null;
  window.PAY_MODE = 'upi';

  window.openUpiPopup = function (kind, title, amt, payload) {
    window.PAY_BOX = { kind, title, amt, payload, trId: 'NU' + Date.now().toString().slice(-6) };
    window.PAY_MODE = 'upi';
    render();
  };

  window.closePayBox = function () {
    window.PAY_BOX = null;
    render();
  };

  window.setPayMode = function (m) {
    window.PAY_MODE = m;
    render();
  };

  window.confirmUpiOrder = function () {
    if (!window.PAY_BOX) return;
    let utr = '';
    if (window.PAY_MODE === 'upi') {
      const inp = document.getElementById('nu_utr_inp');
      utr = String(inp ? inp.value : '').replace(/\D/g, '');
      if (utr.length !== 12) {
        toast('⚠️ Sahi 12-digit UTR / Ref Number daalein!');
        return;
      }
    } else {
      utr = 'COD-' + window.PAY_BOX.trId;
    }

    const { kind, payload } = window.PAY_BOX;
    const isUpi = window.PAY_MODE === 'upi';
    const record = {
      ...payload,
      paid: isUpi ? 1 : 0,
      vStat: isUpi ? 'pending_verify' : 'cod',
      utr,
      pMode: isUpi ? 'Direct UPI (Jio)' : 'Doorstep Cash',
      ts: Date.now()
    };

    if (kind === 'sub') S.subs.push(record);
    else S.orders.push(record);

    window.PAY_BOX = null;
    saveAll();
    toast(isUpi ? '✅ Order Submitted! UTR Verification Pending' : '✅ Cash on Delivery Order Confirmed!');
  };

  window.bookPlan = function () {
    F.name = ($('#uName')?.value || '').trim() || F.name;
    F.phone = ($('#uPhone')?.value || '').trim() || F.phone;
    F.addr = ($('#uAddr')?.value || '').trim() || F.addr;
    if (!isValidPhone(F.phone)) { toast('Sahi 10-digit mobile number daalein!'); return; }
    const price = F.days === 30 ? 2899 : F.days === 15 ? 1499 : 749;
    openUpiPopup('sub', `${F.days} Din ${F.type === 'nv' ? 'Non-Veg' : 'Veg'} Tiffin Plan`, price, {
      id: uid('s'), name: F.name, phone: F.phone, area: F.area, addr: F.addr,
      type: F.type, days: F.days, times: F.times, start: iso(new Date()), price,
      lunch: 'chawal', dinner: 'roti', extraRoti: 0, skip: []
    });
  };

  window.addShop = function (id) {
    const p = S.prod.find(x => x.id === id);
    if (!p) return;
    openUpiPopup('ord', p.n, p.p, {
      id: uid('o'), date: iso(new Date()), name: F.name, phone: F.phone, area: F.area, addr: F.addr,
      items: [{ n: p.n, q: 1, p: p.p }], total: p.p, packed: 0, dlv: 0
    });
  };

  const _prevRender = window.render;
  window.render = function () {
    _prevRender();

    const nav = $('#nav');
    if (nav && !nav.querySelector('[data-v="services"]')) {
      const shopBtn = nav.querySelector('[data-v="shop"]');
      const svcBtn = document.createElement('button');
      svcBtn.dataset.v = 'services';
      svcBtn.className = tab === 'services' ? 'on' : '';
      svcBtn.setAttribute('onclick', "setTab('services')");
      svcBtn.innerHTML = `<svg class="ic" viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg><span class="nl">Services</span>`;
      if (shopBtn) shopBtn.insertAdjacentElement('afterend', svcBtn);
      else nav.appendChild(svcBtn);
    }

    if (tab === 'services') {
      $('#v').innerHTML = vServices();
    }

    const hero = document.querySelector('.hero3d');
    if (hero && !hero.querySelector('.hero-3d-plate')) {
      const imgUrl = tab === 'shop'
        ? 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=240&q=70'
        : 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=240&q=70';
      hero.insertAdjacentHTML('beforeend', `<img class="hero-3d-plate" src="${imgUrl}" alt="Thali">`);
    }

    if (window.PAY_BOX) {
      const { title, amt, trId } = window.PAY_BOX;
      const upiLink = `upi://pay?pa=${encodeURIComponent(MY_UPI_ID)}&pn=${encodeURIComponent(MY_UPI_NAME)}&am=${amt}&cu=INR&tn=${encodeURIComponent(trId)}`;
      const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(upiLink)}`;

      $('#sheet').innerHTML = `
      <div class="ov"><div class="sh" style="text-align:center">
        <h3 style="justify-content:center">💳 Payment — ${inr(amt)}</h3>
        <p style="font-size:12px;color:var(--mu);margin-bottom:10px">${esc(title)}</p>
        <div class="seg" style="margin-bottom:12px">
          <button class="${PAY_MODE==='upi'?'on':''}" onclick="setPayMode('upi')">⚡ Direct UPI (₹0 Fee)</button>
          <button class="${PAY_MODE==='cod'?'on':''}" onclick="setPayMode('cod')">💵 Cash on Delivery</button>
        </div>
        ${PAY_MODE === 'upi' ? `
          <div class="qr-box"><img src="${qrImg}" width="170" height="170" alt="UPI QR"></div>
          <div style="font-size:12px;font-weight:800;margin-bottom:8px">Jio UPI ID: <span style="color:var(--o)">${MY_UPI_ID}</span></div>
          <a href="${upiLink}" class="btn g" style="text-decoration:none;margin-bottom:10px">📲 Open PhonePe / GPay / Paytm</a>
          <input class="inp" id="nu_utr_inp" type="tel" maxlength="12" placeholder="Payment ke baad 12-digit UTR daalein" style="text-align:center;letter-spacing:2px">
        ` : `
          <div class="card" style="background:var(--sf2);margin:10px 0;font-size:12px;font-weight:700">
            Delivery boy ko doorstep par cash (${inr(amt)}) dena hoga.
          </div>
        `}
        <button class="btn" onclick="confirmUpiOrder()">Confirm Order ✓</button>
        <button class="btn w sm" style="margin-top:8px" onclick="closePayBox()">Cancel</button>
      </div></div>`;
    }
  };

  render();
})();
