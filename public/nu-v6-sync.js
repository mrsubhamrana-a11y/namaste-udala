/* === NAMASTE UDALA v6 — FIREBASE REALTIME LIVE SYNC === */
(function () {
  const DB_URL = 'https://namaste-udala-default-rtdb.asia-southeast1.firebasedatabase.app';
  const NODE = `${DB_URL}/namaste_udala.json`;
  let _syncing = false;

  async function pullFromCloud() {
    if (_syncing) return;
    try {
      const res = await fetch(NODE);
      if (!res.ok) return;
      const data = await res.json();
      if (data && (data.subs || data.orders)) {
        S.subs = Array.isArray(data.subs) ? data.subs : Object.values(data.subs || {});
        S.orders = Array.isArray(data.orders) ? data.orders : Object.values(data.orders || {});
        if (data.prod) S.prod = Array.isArray(data.prod) ? data.prod : Object.values(data.prod);
        if (data.exp) S.exp = Array.isArray(data.exp) ? data.exp : Object.values(data.exp);
        localStorage.setItem('nu_master_v3', JSON.stringify(S));
        if (typeof render === 'function') render();
      }
    } catch (e) {}
  }

  const _origSaveAll = window.saveAll;
  if (typeof _origSaveAll === 'function') {
    window.saveAll = function () {
      _origSaveAll();
      _syncing = true;
      fetch(NODE, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(S)
      })
        .catch(() => {})
        .finally(() => { _syncing = false; });
    };
  }

  pullFromCloud();
  setInterval(pullFromCloud, 15000);
})();
