/* === NAMASTE UDALA v6 — UI & OPERATIONS (COMPATIBLE WITH MASTER CRM) === */
(function () {
  window.D0 = window.D0 || (() => new Date());
  if (typeof S !== 'undefined') {
    S.cfg = S.cfg || { invSeq: 0 };
    S.exp = S.exp || [];
  }

  // Ensure #printArea and 58mm print CSS exist
  if (!document.getElementById('printArea')) {
    document.body.insertAdjacentHTML('beforeend', `
      <style>
        #printArea { display: none; }
        @media print {
          body > *:not(#printArea) { display: none !important; }
          #printArea { display: block !important; width: 58mm; font-size: 11px; font-family: monospace; color: #000; }
        }
      </style>
      <div id="printArea"></div>
    `);
  }

  window.getDailyClosingHTML = function () {
    const today = iso(D0());
    let upiIn = 0, cashIn = 0;

    (S.orders || []).filter(o => o.date === today && +o.paid).forEach(o => {
      if ((o.pMode || '').toLowerCase().includes('doorstep') || (o.utr || '').startsWith('COD-')) {
        cashIn += (+o.total || 0);
      } else {
        upiIn += (+o.total || 0);
      }
    });

    (S.subs || []).filter(s => (s.start === today || (s.ts && iso(new Date(s.ts)) === today)) && +s.paid).forEach(s => {
      if ((s.pMode || '').toLowerCase().includes('doorstep')) cashIn += (+s.price || 0);
      else upiIn += (+s.price || 0);
    });

    const expToday = (S.exp || []).filter(x => x.d === today).reduce((a, x) => a + (+x.amt || 0), 0);
    const netToday = (upiIn + cashIn) - expToday;

    return `
    <div class="card" style="border:2px solid var(--g2)">
      <h3>🧾 Today's Closing Tally (${today})</h3>
      <div class="kpi" style="margin:6px 0 10px">
        <div><b style="color:#16a34a">${inr(upiIn)}</b><span>UPI Bank</span></div>
        <div><b style="color:#d97706">${inr(cashIn)}</b><span>Cash in Hand</span></div>
        <div><b style="color:#dc2626">${inr(expToday)}</b><span>Expenses</span></div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding-top:6px;border-top:1px dashed var(--ln)">
        <span style="font-size:12px;font-weight:800">Today's Net: <b style="color:${netToday >= 0 ? '#16a34a' : '#dc2626'}">${inr(netToday)}</b></span>
        <button type="button" class="btn sm g" onclick="exportSalesCSV()">⬇ Export Sales CSV</button>
      </div>
    </div>`;
  };

  window.printBulkKOT = function () {
    const today = iso(D0());
    const subs = (S.subs || []).filter(s => s.vStat !== 'bad');
    const ords = (S.orders || []).filter(o => !o.dlv && o.vStat !== 'bad');

    const subLines = subs.map(s => {
      const roti = 4 + (+s.extraRoti || 0);
      return `<div>• ${esc(s.name)} [${s.type === 'nv' ? 'NV' : 'VEG'}] - ${roti} Roti</div>`;
    }).join('') || '<div>None</div>';

    const ordLines = ords.map(o =>
      `<div>• #${String(o.id).slice(-4)} ${esc(o.name)}: ${(o.items || []).map(i => `${i.n} x${i.q}`).join(', ')}</div>`
    ).join('') || '<div>None</div>';

    const pa = document.getElementById('printArea');
    if (pa) {
      pa.innerHTML = `
        <h2>KITCHEN KOT (${K_SLOT.toUpperCase()})</h2>
        <p>${today} · Tiffins: ${subs.length} · Shop: ${ords.length}</p>
        <hr><b>TIFFINS:</b>${subLines}
        <hr><b>SHOP ORDERS:</b>${ordLines}
      `;
      setTimeout(() => window.print(), 80);
    }
  };

  window.getRiderToolsHTML = function () {
    const today = iso(D0());
    const codCollected = (S.orders || [])
      .filter(o => o.date === today && +o.dlv && (o.utr || '').startsWith('COD-'))
      .reduce((a, o) => a + (+o.total || 0), 0);

    return `
    <div class="card" style="background:#fffbeb;border:1.5px solid #f59e0b;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
      <div>
        <div style="font-size:11px;font-weight:800;color:#92400e">RIDER CASH-IN-HAND TODAY</div>
        <b style="font-size:18px;color:#b45309">${inr(codCollected)}</b>
      </div>
      <button type="button" class="btn sm g" onclick="launchAllStopsRoute()">🗺️ Open All Stops in Maps</button>
    </div>`;
  };

  window.launchAllStopsRoute = function () {
    const rawStops = [
      ...(S.subs || []).filter(s => s.vStat !== 'bad'),
      ...(S.orders || []).filter(o => !o.dlv && o.vStat !== 'bad')
    ];
    const coordsMap = (typeof AREA_COORDS !== 'undefined') ? AREA_COORDS : {};
    const stops = rawStops.map(x => {
      if (x.lat && x.lng) return x;
      const c = coordsMap[x.area];
      return c ? { ...x, lat: c[0], lng: c[1] } : x;
    });
    if (typeof openMultiStopRoute === 'function') {
      openMultiStopRoute(stops);
    }
  };

  const _prevRender = window.render;
  if (typeof _prevRender === 'function') {
    window.render = function () {
      _prevRender();
      const v = $('#v');
      if (!v) return;

      if (tab === 'owner') {
        v.insertAdjacentHTML('afterbegin', getDailyClosingHTML());
      } else if (tab === 'kitchen') {
        v.insertAdjacentHTML('afterbegin', `
          <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
            <button type="button" class="btn sm w" onclick="printBulkKOT()">🖨 Print Bulk KOT (${K_SLOT.toUpperCase()})</button>
          </div>
        `);
      } else if (tab === 'route') {
        v.insertAdjacentHTML('afterbegin', getRiderToolsHTML());
      }
    };
    render();
  }
})();
