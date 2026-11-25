// Knightlight Books – small page script (no cookies, no tracking IDs).
(function () {
  // ---- cookie-free visit counts (feeds Knightboard) ----
  function track(e, extra) {
    try {
      var body = JSON.stringify(Object.assign({ e: e }, extra || {}));
      if (navigator.sendBeacon) navigator.sendBeacon('/.netlify/functions/track', new Blob([body], { type: 'application/json' }));
    } catch (_) {}
  }
  var isNew = false;
  try { isNew = !localStorage.getItem('kl_seen'); localStorage.setItem('kl_seen', '1'); } catch (_) {}
  var ref = ''; try { ref = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '') : ''; } catch (_) {}
  if (ref === location.hostname) ref = '';
  var m = location.pathname.match(/^\/books\/([^/]+)/);
  track('view', { p: location.pathname, s: new URLSearchParams(location.search).get('utm_source') || ref || 'direct', n: isNew, slug: m ? m[1] : '' });
  document.addEventListener('click', function (ev) {
    var a = ev.target.closest('a'); if (!a) return;
    if (a.dataset.buy) track('buy', { to: a.dataset.buy, slug: m ? m[1] : '' });
    else if (/^https?:/.test(a.href) && a.hostname !== location.hostname) track('out', { to: a.hostname.replace(/^www\./, '') });
  });

  // ---- mobile menu ----
  var menu = document.querySelector('.menu'), nav = document.getElementById('nav');
  if (menu) menu.addEventListener('click', function () { var o = nav.classList.toggle('open'); menu.setAttribute('aria-expanded', o); });

  // ---- lamps switch on as books scroll into view on touch screens ----
  if (window.matchMedia('(hover: none)').matches && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { e.target.classList.toggle('lit', e.intersectionRatio > 0.6); }); }, { threshold: [0, 0.6, 1] });
    document.querySelectorAll('.lc').forEach(function (c) { io.observe(c); });
  }

  // ---- front / back cover ----
  var big = document.getElementById('cvbig');
  document.querySelectorAll('.thumbs button').forEach(function (b) {
    b.addEventListener('click', function () {
      big.src = b.dataset.src; big.alt = b.dataset.alt;
      document.querySelectorAll('.thumbs button').forEach(function (x) { x.classList.toggle('on', x === b); });
    });
  });

  // ---- 18+ age check ----
  if (document.body.dataset.adult === '1') {
    var ok = false; try { ok = localStorage.getItem('kl18') === 'yes'; } catch (_) {}
    var gate = document.getElementById('agegate');
    if (!ok && gate) {
      gate.hidden = false; document.body.style.overflow = 'hidden';
      gate.querySelector('[data-age=yes]').focus();
      gate.addEventListener('click', function (ev) {
        var b = ev.target.closest('[data-age]'); if (!b) return;
        if (b.dataset.age === 'yes') { try { localStorage.setItem('kl18', 'yes'); } catch (_) {} gate.hidden = true; document.body.style.overflow = ''; }
        else { location.href = '/'; }
      });
    }
  }

  // ---- sign-up forms: Netlify Forms (always) + Kit (when form IDs are set) ----
  var KIT = window.KL_KIT || {};
  function enc(o) { return Object.keys(o).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(o[k]); }).join('&'); }
  document.querySelectorAll('form.signup').forEach(function (f) {
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var fd = new FormData(f), data = {}, picked = fd.getAll('genres');
      fd.forEach(function (v, k) { data[k] = k === 'genres' ? picked.join(',') : v; });
      var email = data.email, ids = [];
      (picked.length ? picked : [data.genre]).forEach(function (g) { if (g && KIT[g]) ids.push(KIT[g]); });
      if (!ids.length && KIT.reading_list) ids.push(KIT.reading_list);
      var jobs = [fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: enc(data) })];
      ids.forEach(function (id) {
        jobs.push(fetch('https://app.kit.com/forms/' + id + '/subscriptions', { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: enc({ email_address: email }) }));
      });
      Promise.all(jobs).then(function () {
        f.querySelector('.row').hidden = true; f.querySelector('.ok').hidden = false;
        track('signup', { to: data.book || data.genre || 'reading-list' });
      }).catch(function () { f.submit(); });
    });
  });

  // ---- all-books search & filters ----
  var list = document.getElementById('allbooks');
  if (list) {
    var q = document.getElementById('bq'), none = document.getElementById('none'), state = { f: 'all', g: '' };
    var params = new URLSearchParams(location.search);
    if (params.get('q')) q.value = params.get('q');
    if (params.get('status')) state.f = params.get('status');
    function apply() {
      var t = q.value.trim().toLowerCase(), shown = 0;
      list.querySelectorAll('.lc').forEach(function (c) {
        var ok = (!t || c.dataset.title.indexOf(t) > -1) && (state.f === 'all' || (state.f === 'available' ? c.dataset.status === 'available' : c.dataset.status !== 'available')) && (!state.g || c.dataset.genre === state.g);
        c.hidden = !ok; if (ok) shown++;
      });
      none.hidden = shown > 0;
      document.querySelectorAll('#bf .chip').forEach(function (b) { b.classList.toggle('on', b.dataset.f ? (b.dataset.f === state.f && !state.g) : b.dataset.g === state.g); });
    }
    document.getElementById('bf').addEventListener('click', function (ev) {
      var b = ev.target.closest('.chip'); if (!b) return;
      if (b.dataset.f) { state.f = b.dataset.f; state.g = ''; } else { state.g = state.g === b.dataset.g ? '' : b.dataset.g; state.f = 'all'; }
      apply();
    });
    q.addEventListener('input', function () { apply(); if (q.value.length > 2) track('search'); });
    apply();
  }
})();
