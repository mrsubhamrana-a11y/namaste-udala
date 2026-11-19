
/* === NAMASTE UDALA v6 — PART 3: ODIA / HINGLISH / ENGLISH TOGGLE === */
(function () {
  const DICT = {
    en: {
      plans: 'Plans', shop: 'Shop', services: 'Services', profile: 'Profile',
      heroTitle: 'Monthly · 15 Days · 7 Days Tiffin Plan',
      heroSub: '3-Time Home-Style Hot Meals · Free Home Delivery'
    },
    hi: {
      plans: 'Plans', shop: 'Shop', services: 'Services', profile: 'Profile',
      heroTitle: 'Monthly · 15 Din · 7 Din Tiffin Plan',
      heroSub: '3-Time Ghar Jaisa Garma-Garam Khana · Free Home Delivery'
    },
    or: {
      plans: 'ଟିଫିନ୍', shop: 'ଦୋକାନ', services: 'ସେବା', profile: 'ପ୍ରୋଫାଇଲ୍',
      heroTitle: 'ମାସିକ · ୧୫ ଦିନ · ୭ ଦିନ ଟିଫିନ୍ ପ୍ଲାନ୍',
      heroSub: '୩ ବେଳା ଘରୋଇ ଗରମ ଖାଦ୍ୟ · ମାଗଣା ହୋମ୍ ଡେଲିଭରି'
    }
  };

  window.NU_LANG = localStorage.getItem('nu_lang') || 'hi';

  window.setAppLang = function (lang) {
    window.NU_LANG = DICT[lang] ? lang : 'hi';
    localStorage.setItem('nu_lang', window.NU_LANG);
    if (typeof render === 'function') render();
  };

  function applyLangOverlay() {
    const t = DICT[window.NU_LANG] || DICT.hi;
    const v = typeof $ === 'function' ? $('#v') : document.getElementById('v');
    if (v && !document.getElementById('nu_lang_bar')) {
      v.insertAdjacentHTML('afterbegin', `
        <div id="nu_lang_bar" style="display:flex;justify-content:flex-end;gap:5px;margin-bottom:8px">
          ${[['hi', 'Hinglish'], ['or', 'ଓଡ଼ିଆ'], ['en', 'English']].map(([k, lbl]) => `
            <button type="button" onclick="setAppLang('${k}')"
              style="padding:4px 9px;border-radius:99px;font-size:11px;font-weight:800;border:1px solid var(--ln);cursor:pointer;
              background:${window.NU_LANG === k ? 'var(--g)' : 'var(--sf)'};
              color:${window.NU_LANG === k ? '#fff' : 'var(--ink)'}">${lbl}</button>
          `).join('')}
        </div>
      `);
    }

    const navMap = { plan: t.plans, shop: t.shop, services: t.services, profile: t.profile };
    document.querySelectorAll('#nav button').forEach(btn => {
      const key = btn.dataset.v;
      const nl = btn.querySelector('.nl');
      if (nl && navMap[key]) nl.textContent = navMap[key];
    });

    if (typeof tab !== 'undefined' && tab === 'plan' && v) {
      const h2 = v.querySelector('.hero3d h2');
      const p = v.querySelector('.hero3d p');
      if (h2) h2.textContent = t.heroTitle;
      if (p) p.textContent = t.heroSub;
    }
  }

  const _prevRender = window.render;
  if (typeof _prevRender === 'function') {
    window.render = function () {
      _prevRender();
      applyLangOverlay();
    };
    render();
  }
})();
