/* === NAMASTE UDALA v6 — PRODUCTION UPGRADE PATCH === */
(function () {
  const APP_VERSION = '6.0';

  window.addEventListener('error', e => {
    console.error('[NU-ERR]', e.message, e.filename, e.lineno);
  });
  window.addEventListener('unhandledrejection', e => {
    console.error('[NU-PROMISE]', e.reason);
  });

  window.safeUrl = function (u, fallback = '') {
    const s = String(u || '').trim();
    return /^https?:\/\//i.test(s) ? s : fallback;
  };

  window.cleanUTR = function (raw) {
    return String(raw || '').replace(/\D/g, '').slice(0, 12);
  };

  window.localDate = function (str) {
    if (!str) return new Date();
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
  };

  window.haptic = function (ms = 20) {
    if (navigator.vibrate) try { navigator.vibrate(ms); } catch (e) {}
  };

  window.nextInvoiceNo = function () {
    S.cfg.invSeq = (+S.cfg.invSeq || 0) + 1;
    const yr = new Date().getFullYear();
    return `NU-${yr}-${String(S.cfg.invSeq).padStart(4, '0')}`;
  };

  window.recordLedger = function (type, amt, refId, note) {
    S.ledger = S.ledger || [];
    const exists = S.ledger.some(l => l.refId === refId && l.type === type);
    if (exists || !(amt > 0)) return;
    S.ledger.push({
      id: 'lg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
      ts: Date.now(),
      date: iso(D0()),
      type,
      amt: +amt,
      refId,
      note: note || ''
    });
  };

  window.autoArchiveProof = function (item) {
    if (item && +item.paid && item.proof) {
      item.proof = '';
      item.proofMeta = '[Verified & Auto-Archived]';
    }
  };

  window.pruneExpiredAutoAmt = function () {
    if (!S.auto_amt) return;
    const now = Date.now();
    Object.keys(S.auto_amt).forEach(k => {
      const val = S.auto_amt[k];
      if (typeof val === 'number' && val > 1000000000 && now - val > 30 * 60 * 1000) {
        delete S.auto_amt[k];
      }
    });
  };

  const _origFinalize = window.finalizeOrder;
  let _inFlightTrId = null;

  if (typeof _origFinalize === 'function') {
    window.finalizeOrder = function (isPaid, vStat, modeLabel, refNo) {
      if (!PAY_BOX) return;
      const trId = PAY_BOX.trId;

      if (_inFlightTrId === trId) return;
      const dupOrd = (S.orders || []).some(o => o.trId === trId);
      const dupSub = (S.subs || []).some(s => s.trId === trId);
      if (dupOrd || dupSub) {
        toast('Order already submitted!');
        setPayBox(null);
        render();
        return;
      }

      const cleanP = ph(F.phone);
      const tenMinAgo = Date.now() - 10 * 60 * 1000;
      const recentUnpaid = (S.orders || []).filter(
        o => ph(o.phone) === cleanP && !o.paid && (o.ts || 0) > tenMinAgo
      ).length;
      if (!isPaid && recentUnpaid >= 3) {
        toast('Too many pending orders. Please wait 10 minutes or verify previous order.');
        return;
      }

      _inFlightTrId = trId;
      const cleanRef = PAY_MODE === 'cod' ? refNo : cleanUTR(refNo);

      try {
        _origFinalize(isPaid, vStat, modeLabel, cleanRef);
        const latest = PAY_BOX?.kind === 'sub' ? S.subs[S.subs.length - 1] : S.orders[S.orders.length - 1];
        if (latest) {
          latest.trId = trId;
          latest.invNo = nextInvoiceNo();
          latest.updatedAt = Date.now();
          if (isPaid) {
            recordLedger('CR', latest.total || latest.price, latest.id, latest.invNo);
            autoArchiveProof(latest);
          }
        }
        haptic(35);
      } finally {
        setTimeout(() => { _inFlightTrId = null; }, 2500);
      }
    };
  }

  window.openMultiStopRoute = function (stops) {
    const valid = (stops || []).filter(x => x.lat && x.lng).slice(0, 9);
    if (!valid.length) { toast('No GPS coordinates available for stops.'); return; }
    const dest = valid[valid.length - 1];
    const wp = valid.slice(0, -1).map(s => `${s.lat},${s.lng}`).join('|');
    const url = `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}${wp ? '&waypoints=' + encodeURIComponent(wp) : ''}&travelmode=two-wheeler`;
    window.open(url, '_blank');
  };

  window.exportSalesCSV = function () {
    const rows = [['Invoice', 'Date', 'Type', 'Customer', 'Phone', 'Area', 'Amount', 'Status', 'UTR']];
    (S.orders || []).forEach(o => {
      rows.push([o.invNo || o.id, o.date, 'Shop', o.name, o.phone, o.area, o.total, o.paid ? 'Paid' : o.vStat, o.utr || '']);
    });
    (S.subs || []).forEach(s => {
      rows.push([s.invNo || s.id, s.start, `Tiffin-${s.days}d`, s.name, s.phone, s.area, s.price, s.paid ? 'Paid' : s.vStat, s.utr || '']);
    });
    const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `namaste-udala-sales-${iso(D0())}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('CSV Sales Report Downloaded');
  };

  if (localStorage.getItem('nu_lite') === '1') {
    document.body.classList.add('no-imgs');
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js?v=' + APP_VERSION).catch(() => {});
    });
  }
})();
