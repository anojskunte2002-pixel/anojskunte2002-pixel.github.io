/* Arka demo player: the real Arka screens, answered from sample data recorded for each role,
   with no server behind them. Nothing is saved. Choose whose view to see with ?as=<role>
   in the link, or with the bar at the bottom of the page. */
(function () {
  'use strict';
  var DATA = '/demo-data/';
  var STORE = 'arka-demo-as';
  var API = /^\/(auth|perf|fit|admin|manual)(\/|$)/;
  var WINDOW_PARAMS = ['due_from', 'due_to'];
  var NOT_SAVED = 'This is a demo with sample data, so changes are not saved.';
  var realFetch = window.fetch.bind(window);

  function remember(key) { try { localStorage.setItem(STORE, key); } catch (e) { /* private window */ } }
  function remembered() { try { return localStorage.getItem(STORE); } catch (e) { return null; } }

  // ?as=qc picks the role, then leaves the address so the app never sees it.
  var here = new URL(location.href);
  var asked = here.searchParams.get('as');
  if (asked) {
    remember(asked);
    here.searchParams.delete('as');
    history.replaceState(history.state, '', here.pathname + here.search + here.hash);
  }
  var role = asked || remembered() || 'admin';

  var personas = realFetch(DATA + 'personas.json').then(function (r) { return r.json(); });
  var index = realFetch(DATA + encodeURIComponent(role) + '/index.json')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (idx) {
      if (idx) return idx;
      role = 'admin';
      remember(role);
      return realFetch(DATA + 'admin/index.json').then(function (r) { return r.json(); });
    });
  var shards = {};
  function shard(hash) {
    var k = hash.slice(0, 2);
    if (!shards[k]) shards[k] = realFetch(DATA + 'b/' + k + '.json').then(function (r) { return r.json(); });
    return shards[k];
  }

  function canon(path, params) {
    var q = [];
    params.forEach(function (v, k) { if (v !== '') q.push([k, v]); });
    q.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0; });
    return path + (q.length ? '?' + q.map(function (p) { return p[0] + '=' + p[1]; }).join('&') : '');
  }
  // The exact question first; then without a Pulse date window; then with or without the
  // default plan, since the app asks both ways.
  function candidates(path, params) {
    var plain = new URLSearchParams(params);
    WINDOW_PARAMS.forEach(function (k) { plain.delete(k); });
    var plan = new URLSearchParams(plain);
    if (plan.get('plan') === 'departments') plan.delete('plan');
    else if (!plan.has('plan')) plan.set('plan', 'departments');
    return [canon(path, params), canon(path, plain), canon(path, plan)];
  }
  function reply(status, body) {
    return new Response(typeof body === 'string' ? body : JSON.stringify(body),
      { status: status, headers: { 'content-type': 'application/json' } });
  }
  function write(path) {
    if (path === '/auth/logout') {
      setTimeout(function () { location.href = '/'; }, 50);
      return reply(200, { ok: true });
    }
    return reply(403, { detail: NOT_SAVED });
  }

  window.fetch = function (input, init) {
    var req = typeof input === 'string' || input instanceof URL ? null : input;
    var u = new URL(req ? req.url : String(input), location.href);
    if (u.origin !== location.origin || !API.test(u.pathname)) return realFetch(input, init);
    var method = String((init && init.method) || (req && req.method) || 'GET').toUpperCase();
    if (method !== 'GET') return Promise.resolve(write(u.pathname));
    return index.then(function (idx) {
      var keys = candidates(decodeURIComponent(u.pathname), u.searchParams);
      for (var i = 0; i < keys.length; i++) {
        var hit = idx[keys[i]];
        if (hit) return shard(hit[1]).then(function (s) { return reply(hit[0], s[hit[1]]); });
      }
      if (window.console) console.info('[Arka demo] not recorded:', keys[0]);
      return reply(404, { detail: 'This part is not in the demo.' });
    });
  };

  // Downloads (Excel, CSV, files) are plain links to the server, which the demo does not have.
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var u = new URL(a.href, location.href);
    if (u.origin === location.origin && API.test(u.pathname)) {
      e.preventDefault();
      say('Downloads are not part of the demo.');
    }
  }, true);

  // ---------------------------------------------------------------- the demo bar
  var bar, note;
  function say(text) {
    if (!note) return;
    note.textContent = text;
    clearTimeout(say.t);
    say.t = setTimeout(function () { note.textContent = 'Sample data · nothing is saved'; }, 4000);
  }
  function el(tag, css, text) {
    var n = document.createElement(tag);
    if (css) n.style.cssText = css;
    if (text) n.textContent = text;
    return n;
  }
  function mount(list) {
    bar = el('div', 'position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:2147483000;' +
      'display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:center;max-width:calc(100vw - 24px);' +
      'padding:6px 8px 6px 12px;border-radius:999px;background:rgba(17,24,39,.94);color:#f9fafb;' +
      'font:500 12.5px/1.3 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.35)');
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Demo');
    bar.appendChild(el('b', 'background:#f59e0b;color:#111827;border-radius:999px;padding:2px 8px;font-size:11px;letter-spacing:.06em', 'DEMO'));
    note = el('span', 'opacity:.85', 'Sample data · nothing is saved');
    bar.appendChild(note);
    var label = el('label', 'display:flex;align-items:center;gap:6px');
    label.appendChild(el('span', 'opacity:.85', 'Viewing as'));
    var pick = el('select', 'background:#1f2937;color:#f9fafb;border:1px solid #4b5563;border-radius:8px;padding:3px 6px;font:inherit');
    list.forEach(function (p) {
      var o = el('option', '', p.label);
      o.value = p.key;
      if (p.key === role) o.selected = true;
      pick.appendChild(o);
    });
    pick.addEventListener('change', function () { remember(pick.value); location.reload(); });
    label.appendChild(pick);
    bar.appendChild(label);
    var map = el('a', 'color:#93c5fd;text-decoration:underline', 'Access map');
    map.href = '/';
    bar.appendChild(map);
    var hide = el('button', 'background:none;border:0;color:#9ca3af;font:inherit;font-size:15px;cursor:pointer;padding:0 4px', '×');
    hide.setAttribute('aria-label', 'Hide the demo bar');
    hide.addEventListener('click', function () { bar.style.display = 'none'; });
    bar.appendChild(hide);
    document.body.appendChild(bar);
  }
  function start() { personas.then(mount, function () { mount([{ key: role, label: role }]); }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
