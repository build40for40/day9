
const PLACES = {
  uk: ['United Kingdom', [-0.13, 51.51]], us: ['United States', [-74.0, 40.71]], fr: ['France', [2.35, 48.86]], it: ['Italy', [9.19, 45.46]],
  jp: ['Japan', [139.69, 35.69]], mex: ['Mexico City', [-99.13, 19.43]], de: ['Germany', [10.4, 51.1]], mel: ['Melbourne', [144.96, -37.81]],
  su: ['Soviet Union', [37.62, 55.75]], tz: ['Tanzania', [35.7, -6.2]], va: ['Vatican City', [12.45, 41.9]], kr: ['South Korea', [126.98, 37.57]],
  nl: ['Netherlands', [5.3, 52.2]], no: ['Norway', [9.5, 61.0]], ee: ['Estonia', [25.5, 58.7]], lu: ['Luxembourg', [6.13, 49.6]],
  ro: ['Romania', [25.0, 45.9]], se: ['Sweden', [16.0, 60.3]],
};
// The app's four trend families (src/nerds/data.ts), validated for colour blindness on the night background.
const FAMILY = { clothes: '#5b8ef0', scenes: '#e2703a', kit: '#1fa583', face: '#a970da' };
const CAT = { garment: FAMILY.clothes, silhouette: FAMILY.clothes, fabric: FAMILY.clothes, pattern: FAMILY.clothes, colour: FAMILY.clothes, subculture: FAMILY.scenes, accessory: FAMILY.kit, footwear: FAMILY.kit, hair: FAMILY.face, makeup: FAMILY.face };
const HOME = { uk: '#ff6fa8', us: '#5b8ef0', fr: '#e8c27a', it: '#1fa583', jp: '#a970da' };
const CORE = new Set(['uk', 'us', 'fr', 'it']);
Object.assign(PLACES, XPLACES);
// Three ways in from three corners of the map. Everything else is found by typing.
const EXAMPLES = ['miniskirt', 'paisley', 'hawaiian-shirt'];
const FIRST = 1920, LAST = 2026;
TRENDS.sort((a, b) => a.n.localeCompare(b.n));
for (const t of TRENDS) t.col = CAT[t.c] || '#a39fae';
const byId = Object.fromEntries(TRENDS.map((t) => [t.id, t]));
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (id) => document.getElementById(id);
const names = (ids) => ids.map((p) => PLACES[p][0]).join(' and ');
const yr = (d) => (d.dec ? Math.floor(d.y / 10) * 10 + 's' : String(d.y));
$('n-trends').textContent = TRENDS.length;
$('n-src').textContent = TRENDS.filter((t) => t.b).length;
$('n-root').textContent = TRENDS.filter((t) => t.r && t.r.length).length;

// Sourced claims (t.b the birthplace, t.v its rivals, t.r its roots) carry their own name, point and date.
const ord = (n) => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');
function when(c) {
  if (c.y == null) return '';
  if (c.p === 'c') return c.y < 0 ? ord(Math.ceil(-c.y / 100)) + ' century BC' : ord(Math.floor(c.y / 100) + 1) + ' century';
  if (c.p === 'd') return Math.floor(c.y / 10) * 10 + 's';
  return c.y < 0 ? -c.y + ' BC' : String(c.y);
}
const far = (a, b) => d3.geoDistance(a, b) > 0.004;
const bornAt = (t) => (t.b ? t.b.c : t.ro ? t.r[0].c : PLACES[t.o[0]][1]);
const bornName = (t) => (t.b ? t.b.n : t.ro ? t.r[0].n : names(t.o));
// The root a trend goes home to: only when it was born in the West and borrowed from further off.
const rootOf = (t) => (t.r && t.r.length && !t.ro && (!t.b || t.b.west) && far(t.r[0].c, bornAt(t)) ? t.r[0] : null);
// How far the journeys have been pulled back (0 to 1), and how far the trend has gone on to its root.
const pulled = (t) => (t && rootOf(t) ? Math.min(1, S.home * 2) : S.home);
const onward = (t) => (rootOf(t) ? Math.max(0, S.home * 2 - 1) : 0);
// With everything sent home, does this place keep this trend?
const keeps = (t, p) => t.o.includes(p) && !rootOf(t);

const inAny = (list, y) => list.some(([s, e]) => s <= y && y <= e);
const everywhere = (t, y) => inAny(t.g, y);
function active(t, p, y) {
  if (t.ps[p]) return inAny(t.ps[p], y);
  if (t.o.includes(p)) return t.g.length ? everywhere(t, y) : y >= t.y;
  const d = t.de[p];
  return !!d && y >= d.y;
}
const litCount = (t, y) => Object.keys(PLACES).filter((p) => active(t, p, y)).length;
function bestYear(t) {
  let best = t.y, score = -1;
  // Look inside the first wave only, so the globe opens on the original craze, not a later comeback.
  const end = Math.min(LAST, Math.max(t.y + 10, ...t.o.map((p) => (t.ps[p] ? t.ps[p][0][1] : t.y))) + 5);
  for (let y = t.y; y <= end; y++) {
    const s = litCount(t, y) + (everywhere(t, y) ? 0.5 : 0);
    if (s > score) { score = s; best = y; }
  }
  return best;
}

const S = { sel: 'miniskirt', year: 1967, home: 0, city: 'uk', rot: [0, -30, 0], zoom: 1, q: '' };
const facingAt = (c) => [-c[0], -c[1] * 0.6, 0];
const facing = (id) => facingAt(PLACES[id][1]);

const canvas = $('globe'), ctx = canvas.getContext('2d');
const proj = d3.geoOrthographic().clipAngle(90).precision(0.4);
const path = d3.geoPath(proj, ctx);
const land = topojson.feature(LAND, LAND.objects.land);
const grid = d3.geoGraticule10();
let W = 0, dpr = 1;

function size() {
  const r = canvas.getBoundingClientRect();
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = r.width;
  canvas.width = canvas.height = Math.round(W * dpr);
  draw();
}
function arcLine(a, b, frac) {
  const f = d3.geoInterpolate(a, b), n = Math.max(2, Math.ceil(32 * frac)), pts = [];
  for (let i = 0; i <= n; i++) pts.push(f((i / n) * frac));
  return { type: 'LineString', coordinates: pts };
}
const fracOf = (d, t) => Math.max(0, Math.min(1, S.year - (d.y - 1))) * (1 - pulled(t));

// Every journey made by a given year, grouped by route, for the all trends view.
function flows(y) {
  const m = {};
  for (const t of TRENDS) for (const p in t.de) {
    const d = t.de[p];
    if (d.late || d.early || d.y > y) continue;
    const k = t.o[0] + '>' + p;
    m[k] = (m[k] || 0) + 1;
  }
  return m;
}

function draw() {
  if (!W) return;
  const css = getComputedStyle(document.documentElement), v = (n) => css.getPropertyValue(n).trim();
  const R = (W / 2 - 9) * S.zoom, y = Math.floor(S.year + 1e-6), all = S.sel === 'all', t = byId[S.sel];
  proj.translate([W / 2, W / 2]).scale(R).rotate(S.rot);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, W);
  ctx.beginPath(); path({ type: 'Sphere' }); ctx.fillStyle = v('--ocean'); ctx.fill();
  ctx.beginPath(); path(grid); ctx.strokeStyle = v('--grid'); ctx.lineWidth = 0.6; ctx.stroke();
  ctx.beginPath(); path(land); ctx.fillStyle = v('--land'); ctx.fill(); ctx.strokeStyle = v('--land-edge'); ctx.lineWidth = 0.7; ctx.stroke();
  if (!all && S.home < 0.5 && everywhere(t, y)) {
    ctx.beginPath(); ctx.arc(W / 2, W / 2, R + 4, 0, 7); ctx.strokeStyle = t.col; ctx.lineWidth = 4; ctx.globalAlpha = 0.9; ctx.stroke(); ctx.globalAlpha = 1;
  }

  ctx.lineCap = 'round';
  const lit = {}, big = {}, pins = [];
  if (all) {
    const m = flows(y);
    for (const k in m) {
      const [a, b] = k.split('>');
      if (S.home >= 1) break;
      ctx.beginPath(); path(arcLine(PLACES[a][1], PLACES[b][1], 1 - S.home));
      ctx.strokeStyle = HOME[a] || '#a39fae'; ctx.globalAlpha = 0.75; ctx.lineWidth = 1 + Math.sqrt(m[k]) * 1.2; ctx.stroke();
    }
    // What the West borrowed: one dotted line per trend, from its birthplace back to its root.
    for (const x of TRENDS) {
      const r = rootOf(x);
      if (!r) continue;
      ctx.beginPath(); path(arcLine(bornAt(x), r.c, 1));
      ctx.setLineDash([1, 5]); ctx.strokeStyle = v('--q'); ctx.globalAlpha = 0.3 + 0.6 * S.home; ctx.lineWidth = 1.4; ctx.stroke();
      pins.push({ c: r.c, kind: 'root', on: S.home > 0.5 });
    }
    ctx.setLineDash([]);
    for (const p in PLACES) {
      const n = TRENDS.filter((x) => active(x, p, y) && (S.home < 0.5 || keeps(x, p))).length;
      if (n) { lit[p] = HOME[p] || v('--text'); big[p] = 3 + Math.sqrt(n) * 1.1; }
    }
  } else {
    const from = bornAt(t), root = rootOf(t), on = onward(t);
    for (const p in t.de) {
      const d = t.de[p], f = fracOf(d, t);
      if (f <= 0) continue;
      ctx.beginPath(); path(arcLine(from, PLACES[p][1], f));
      ctx.setLineDash(d.late || d.early || d.c === 'low' ? [2, 6] : []);
      ctx.strokeStyle = t.col; ctx.globalAlpha = 0.95; ctx.lineWidth = 2.2; ctx.stroke();
    }
    // Roots: a dotted line from each root to the birthplace. Sending it home walks the first one back.
    for (const r of t.ro ? [] : t.r || []) {
      if (!far(r.c, from)) continue;
      ctx.beginPath(); path(arcLine(r.c, from, 1));
      ctx.setLineDash([1, 5]); ctx.strokeStyle = v('--q'); ctx.globalAlpha = 0.9; ctx.lineWidth = 1.8; ctx.stroke();
    }
    ctx.setLineDash([]);
    if (root && on > 0) {
      ctx.beginPath(); path(arcLine(from, root.c, on));
      ctx.strokeStyle = t.col; ctx.globalAlpha = 0.95; ctx.lineWidth = 3; ctx.stroke();
    }
    for (const p in PLACES) if (active(t, p, y) && (S.home < 0.5 || (t.o.includes(p) && on < 1))) lit[p] = t.col;
    if (t.b && far(t.b.c, PLACES[t.o[0]][1])) pins.push({ c: t.b.c, kind: 'born', label: t.b.n, on: on < 1 });
    for (const r of t.v || []) pins.push({ c: r.c, kind: 'rival', label: far(r.c, from) ? r.n + '?' : '' });
    for (const r of t.r || []) pins.push({ c: r.c, kind: 'root', label: far(r.c, PLACES[t.o[0]][1]) ? r.n : '', on: r === root && on >= 1 });
  }
  ctx.globalAlpha = 1;

  const centre = [-S.rot[0], -S.rot[1]];
  ctx.font = '700 12px ' + v('--font'); ctx.textBaseline = 'middle';
  const labels = [];
  for (const id in PLACES) {
    const c = PLACES[id][1];
    if (d3.geoDistance(c, centre) > Math.PI / 2 - 0.05) continue;
    const [x, yy] = proj(c), isO = !all && t.o.includes(id), isSel = id === S.city;
    if (x < -20 || yy < -20 || x > W + 20 || yy > W + 20) continue;
    ctx.beginPath(); ctx.arc(x, yy, big[id] || (isO ? 6 : 4), 0, 7);
    ctx.fillStyle = lit[id] || v('--muted'); ctx.globalAlpha = lit[id] ? 1 : 0.5; ctx.fill(); ctx.globalAlpha = 1;
    if (isO) { ctx.beginPath(); ctx.arc(x, yy, 10, 0, 7); ctx.strokeStyle = t.col; ctx.lineWidth = 1.5; ctx.stroke(); }
    if (isSel) { ctx.beginPath(); ctx.arc(x, yy, (big[id] || 6) + 7, 0, 7); ctx.strokeStyle = v('--text'); ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]); }
    if (isSel || isO) labels.push([isO && t.b && !far(t.b.c, c) ? t.b.n : PLACES[id][0], x, yy]);
  }
  // Sourced points that are not a place with a wardrobe: the exact birthplace, rival claimants (hollow), roots (diamonds).
  const seen = new Set();
  for (const pin of pins) {
    if (d3.geoDistance(pin.c, centre) > Math.PI / 2 - 0.05) continue;
    const [x, yy] = proj(pin.c);
    ctx.beginPath();
    if (pin.kind === 'root') { ctx.moveTo(x, yy - 7); ctx.lineTo(x + 7, yy); ctx.lineTo(x, yy + 7); ctx.lineTo(x - 7, yy); ctx.closePath(); } else ctx.arc(x, yy, pin.kind === 'born' ? 6 : 5, 0, 7);
    const col = pin.kind === 'root' ? v('--q') : t.col;
    ctx.fillStyle = pin.kind === 'rival' ? v('--bg') : pin.on === false ? v('--muted') : pin.kind === 'root' && pin.on ? t ? t.col : col : col;
    ctx.globalAlpha = pin.kind === 'root' && !pin.on && all ? 0.6 : 1; ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke();
    if (pin.kind === 'born') { ctx.beginPath(); ctx.arc(x, yy, 10, 0, 7); ctx.stroke(); }
    const key = Math.round(x / 8) + ',' + Math.round(yy / 8);
    if (pin.label && !seen.has(key)) { seen.add(key); labels.push([pin.label, x, yy]); }
  }
  for (const [label, x, yy] of labels) {
    const w = ctx.measureText(label).width, left = x + 20 + w > W, tx = left ? x - 20 - w : x + 20;
    ctx.fillStyle = v('--bg'); ctx.globalAlpha = 0.85; ctx.fillRect(tx - 4, yy - 9, w + 8, 18); ctx.globalAlpha = 1;
    ctx.fillStyle = v('--text'); ctx.fillText(label, tx, yy);
  }
}

const tweens = new Map();
function tween(key, to, ms, read, write, linear) {
  const f = d3.interpolate(read(), to);
  if (reduce || ms === 0) { tweens.delete(key); write(to); refresh(); return; }
  tweens.set(key, { t0: performance.now(), ms, f, write, linear });
  if (tweens.size === 1) requestAnimationFrame(tick);
}
function tick(now) {
  for (const [k, t] of tweens) {
    const p = Math.min(1, (now - t.t0) / t.ms);
    t.write(t.f(t.linear ? p : d3.easeCubicInOut(p)));
    if (p >= 1) tweens.delete(k);
  }
  refresh();
  if (tweens.size) requestAnimationFrame(tick);
}

function chip(t, pressed) {
  const el = document.createElement('button');
  el.type = 'button'; el.className = 'chip'; el.dataset.id = t.id; el.setAttribute('aria-pressed', pressed);
  if (t.col) el.innerHTML = '<i style="background:' + t.col + '"></i>';
  el.append(t.n);
  el.addEventListener('click', () => pickTrend(t.id));
  return el;
}
let hitAt = -1;
function matches() {
  const q = S.q.trim().toLowerCase();
  if (!q) return [];
  const rank = (t) => (t.n.toLowerCase().startsWith(q) ? 0 : t.n.toLowerCase().includes(' ' + q) ? 1 : 2);
  return TRENDS.filter((t) => t.n.toLowerCase().includes(q) || t.id.includes(q)).sort((x, y) => rank(x) - rank(y) || x.n.localeCompare(y.n)).slice(0, 8);
}
function drawPicker() {
  const top = $('trends'); top.innerHTML = '';
  const label = document.createElement('span'); label.className = 'try'; label.textContent = 'Or try'; top.append(label);
  for (const id of EXAMPLES) if (byId[id]) top.append(chip(byId[id], S.sel === id));
  const all = document.createElement('button');
  all.type = 'button'; all.className = 'linkbtn'; all.textContent = 'every trend at once'; all.setAttribute('aria-pressed', S.sel === 'all');
  all.addEventListener('click', () => pickTrend('all'));
  top.append(all);
  drawHits();
}
// The list under the search box: it only appears once someone starts typing.
function drawHits() {
  const list = $('hits'), input = $('q'), found = matches();
  list.innerHTML = '';
  const open = S.q.trim() !== '';
  list.hidden = !open; input.setAttribute('aria-expanded', open);
  if (!open) { hitAt = -1; input.removeAttribute('aria-activedescendant'); return; }
  if (!found.length) { const li = document.createElement('li'); li.className = 'none'; li.textContent = 'Not on the globe. Either we have no trend by that name, or nobody can say where it started.'; list.append(li); return; }
  hitAt = Math.min(hitAt, found.length - 1);
  found.forEach((t, i) => {
    const li = document.createElement('li');
    li.id = 'hit-' + i; li.setAttribute('role', 'option'); li.setAttribute('aria-selected', i === hitAt);
    li.innerHTML = '<i style="background:' + t.col + '"></i><span class="n"></span><span class="m"></span>';
    li.children[1].textContent = t.n; li.children[2].textContent = t.c;
    li.addEventListener('pointerdown', (e) => e.preventDefault());
    li.addEventListener('click', () => choose(t));
    list.append(li);
  });
  if (hitAt >= 0) input.setAttribute('aria-activedescendant', 'hit-' + hitAt); else input.removeAttribute('aria-activedescendant');
}
function choose(t) {
  S.q = ''; $('q').value = ''; hitAt = -1;
  pickTrend(t.id);
}

let uiKey = '';
function refresh() {
  draw();
  const y = Math.floor(S.year + 1e-6), homeOn = S.home > 0.5;
  const key = [S.sel, y, homeOn, S.city].join('|');
  if (key === uiKey) return;
  uiKey = key;
  const all = S.sel === 'all';
  $('year').value = y; $('s-year').textContent = y; $('c-year').textContent = y;
  $('home').textContent = homeOn ? 'Let it spread again' : all ? 'Send them all home' : 'Send it home';
  $('log').innerHTML = ''; $('routes').innerHTML = '';
  $('t-pic').hidden = true; $('t-birth').hidden = all; $('t-src').hidden = all; $('t-cat').hidden = all; $('routes').hidden = !all; $('t-back').textContent = '';

  if (all) {
    const m = flows(y), trips = homeOn ? 0 : Object.values(m).reduce((a, b) => a + b, 0);
    const live = TRENDS.filter((t) => everywhere(t, y) || Object.keys(PLACES).some((p) => active(t, p, y))).length;
    $('l-born').textContent = 'Trends in fashion'; $('s-born').textContent = live;
    $('l-count').textContent = 'Journeys so far'; $('s-count').textContent = trips;
    $('t-name').textContent = 'Every trend at once';
    $('t-blurb').textContent = 'Each line is a route, and it gets fatter with every trend that travelled it. Drag the year to see who was dressing whom.';
    $('log-tag').textContent = 'Who dressed whom, by ' + y;
    const rows = Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8);
    if (!rows.length) { const d = document.createElement('div'); d.className = 'more'; d.textContent = 'Nobody has borrowed anything yet.'; $('routes').append(d); }
    for (const [k, n] of rows) {
      const [a, b] = k.split('>'), d = document.createElement('div');
      d.innerHTML = '<i style="background:' + (HOME[a] || '#a39fae') + '"></i><span></span><b></b>';
      d.children[1].textContent = PLACES[a][0] + ' to ' + PLACES[b][0]; d.children[2].textContent = n;
      $('routes').append(d);
    }
  } else {
    const t = byId[S.sel];
    const n = homeOn ? (rootOf(t) ? 0 : t.o.filter((p) => active(t, p, y)).length) : litCount(t, y);
    const root = rootOf(t);
    $('l-born').textContent = homeOn && root ? 'Sent home to' : t.ro ? 'Roots in' : t.v && t.v.length ? 'Born in, they say' : 'Born in';
    $('s-born').textContent = homeOn && root ? root.n : bornName(t);
    $('l-count').textContent = 'In fashion in';
    $('s-count').textContent = !homeOn && everywhere(t, y) ? 'Everywhere' : n + (n === 1 ? ' place' : ' places');
    $('t-name').textContent = t.n; $('t-blurb').textContent = t.d;
    const cat = $('t-cat'); cat.innerHTML = '<i style="background:' + t.col + '"></i>'; cat.append(t.c);
    const th = THUMBS[t.id];
    if (th) {
      $('t-pic').hidden = false; $('t-img').src = th.s; $('t-img').alt = th.t + ', ' + th.y;
      const cap = $('t-cap'); cap.textContent = th.t + (th.by ? ' by ' + th.by.split(', ').reverse().join(' ') : '') + ', ' + th.y + '. © Victoria and Albert Museum, London. ';
      cap.append(link(th.u, 'See it'));
    }
    const src = $('t-src');
    if (t.q) { src.textContent = 'Wikipedia: “' + t.q + '” '; src.append(link(t.u, 'Source')); } else src.hidden = true;
    drawBirth(t);
    $('log-tag').textContent = 'Where it went';
    for (const r of t.ro ? [] : t.r || []) addLog(null, 'From ' + r.n, 'var(--q)', false, true);
    for (const p of t.o) addLog(p, t.b ? (t.b.n + ' ' + when(t.b)).trim() : t.ro ? t.r[0].n + ', its root' : PLACES[p][0] + ' ' + t.y, t.col, !t.b && !t.ro && t.y > y, false);
    Object.entries(t.de).sort((a, b) => a[1].y - b[1].y).forEach(([p, d]) =>
      addLog(p, PLACES[p][0] + ' ' + yr(d) + (d.late ? ', picked up later' : d.early ? ', on record earlier' : ''), t.col, homeOn || d.y > y, d.late || d.early || d.c === 'low'));
    if (t.g.length) addLog(null, 'Everywhere ' + t.g[0][0], t.col, homeOn || t.g[0][0] > y, false);
    const back = [];
    for (const p in t.ps) if (t.ps[p].length > 1) back.push(PLACES[p][0] + ' ' + t.ps[p].slice(1).map(([s, e]) => (s === e ? s : s + ' to ' + e)).join(', '));
    if (t.g.length > 1) back.push('everywhere ' + t.g.slice(1).map(([s, e]) => (s === e ? s : s + ' to ' + e)).join(', '));
    if (back.length) $('t-back').textContent = 'Comebacks: ' + back.join('; ') + '.';
  }

  const p = S.city;
  const recent = (t) => { const ps = t.ps[p]; const hit = ps && ps.find(([s, e]) => s <= y && y <= e); return hit ? hit[0] : t.de[p] ? t.de[p].y : t.y; };
  const here = TRENDS.filter((t) => active(t, p, y)).sort((a, b) => recent(b) - recent(a));
  const own = here.filter((t) => t.o.includes(p)), got = here.filter((t) => !t.o.includes(p));
  const kept = own.filter((t) => keeps(t, p));
  const also = TRENDS.filter((t) => everywhere(t, y) && !active(t, p, y)).length;
  $('c-name').textContent = PLACES[p][0];
  fill($('c-own'), own, (t) => { const r = rootOf(t); return row(t, homeOn && r ? 'sent home to ' + r.n : r ? 'since ' + recent(t) + ', roots in ' + r.n : 'since ' + recent(t), homeOn && !!r, null); }, 'Nothing on record that year.');
  fill($('c-got'), got, (t) => row(t, homeOn ? 'sent home to ' + (rootOf(t) || { n: bornName(t) }).n : 'from ' + bornName(t) + ', ' + recent(t), homeOn, t.de[p]), 'Nothing borrowed that we can prove.');
  const total = here.length;
  $('c-sum').textContent = (!total ? 'Nothing recorded as in fashion here that year.'
    : homeOn ? (kept.length ? 'With the borrowed pieces sent home, it keeps ' + kept.length + ' of ' + total + '.' : 'With the borrowed pieces sent home, it has nothing left to wear. Awkward.')
    : got.length + ' of the ' + total + ' ' + (total === 1 ? 'trend' : 'trends') + ' in fashion here came from somewhere else.')
    + (also ? ' Another ' + also + ' were in fashion everywhere.' : '');
}
// The "where it started" block: a sourced birthplace with its quote, the contenders when
// the claim is disputed, what it was borrowed from, or the old country rule as a fallback.
function drawBirth(t) {
  const box = $('t-birth'); box.innerHTML = '';
  const add = (cls, text) => { const el = document.createElement(cls === 'tag' ? 'div' : 'p'); el.className = cls; el.textContent = text; box.append(el); return el; };
  const pill = (el, text) => { const s = document.createElement('span'); s.className = 'shaky'; s.textContent = text; el.append(' ', s); };
  const one = (c, lead) => {
    const p = add('claim', '');
    const b = document.createElement('b'); b.textContent = [lead + c.n, when(c)].filter(Boolean).join(', '); p.append(b);
    if (c.w) p.append(' · ' + c.w);
    if (c.cf === 'low') pill(p, 'shaky');
    const q = add('ev', 'Wikipedia: “' + c.q + '” '); q.append(link(c.u, 'Source'));
  };
  if (t.b && t.v.length) {
    pill(add('tag', 'Who wore it first? It depends who you ask'), 'sourced');
    [t.b, ...t.v].forEach((c) => one(c, ''));
  } else if (t.b) {
    pill(add('tag', 'Where it started'), 'sourced');
    one(t.b, '');
  } else if (t.ro) {
    pill(add('tag', 'Where it started'), 'roots only');
    add('ev', 'No source names a Western birthplace, so the globe starts it at its root.');
  } else {
    pill(add('tag', 'Where it started'), 'rough guess');
    add('ev', names(t.o) + ', around ' + t.y + '. That is only the first country our dataset records it in. Nobody has checked its own article yet.');
  }
  if (t.r && t.r.length) {
    add('tag', 'Borrowed from');
    t.r.forEach((c) => one(c, ''));
  }
}
function link(url, text) {
  const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = text;
  return a;
}
function addLog(id, text, col, off, low) {
  const el = document.createElement(id ? 'button' : 'span');
  if (id) el.type = 'button';
  el.className = 'chip' + (off ? ' off' : '') + (low ? ' low' : '');
  el.innerHTML = '<i style="background:' + col + '"></i>'; el.append(text);
  if (id) el.addEventListener('click', () => pickCity(id, true)); else el.style.cursor = 'default';
  $('log').append(el);
}
function row(t, meta, gone, d) {
  const li = document.createElement('li'); li.className = 'row' + (gone ? ' gone' : '');
  li.innerHTML = '<div class="top"><i style="background:' + t.col + '"></i><button type="button" class="n"></button><span class="m"></span></div>';
  const b = li.querySelector('.n'); b.textContent = t.n; b.addEventListener('click', () => pickTrend(t.id, true));
  li.querySelector('.m').textContent = meta;
  if (d && d.ev) {
    if (d.c === 'low') { const s = document.createElement('span'); s.className = 'shaky'; s.textContent = 'shaky'; b.after(s); }
    const ev = document.createElement('div'); ev.className = 'ev'; ev.textContent = d.ev + ' '; ev.append(link(d.url, 'Source')); li.append(ev);
  }
  return li;
}
function fill(ul, list, make, empty) {
  ul.innerHTML = '';
  if (!list.length) { const li = document.createElement('li'); li.className = 'more'; li.textContent = empty; ul.append(li); return; }
  ul.append(...list.slice(0, 8).map(make));
  if (list.length > 8) { const li = document.createElement('li'); li.className = 'more'; li.textContent = 'and ' + (list.length - 8) + ' more'; ul.append(li); }
}

function spinAt(c) { tween('rot', facingAt(c), 900, () => S.rot, (r) => { S.rot = r; }); }
function spinTo(id) { spinAt(PLACES[id][1]); }
function pickCity(id, spin) { S.city = id; if (spin) spinTo(id); uiKey = ''; refresh(); }
function pickTrend(id, keepPlace) {
  S.sel = id; tweens.delete('year'); tweens.delete('home'); S.home = 0;
  if (id !== 'all') {
    const t = byId[id];
    if (!keepPlace) { S.year = bestYear(t); S.city = t.o[0]; }
    spinAt(bornAt(t));
  }
  drawPicker(); uiKey = ''; refresh();
}

$('q').addEventListener('input', (e) => { S.q = e.target.value; hitAt = -1; drawHits(); });
$('q').addEventListener('keydown', (e) => {
  const found = matches();
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (!found.length) return;
    e.preventDefault();
    hitAt = (hitAt + (e.key === 'ArrowDown' ? 1 : -1) + found.length) % found.length;
    drawHits();
  } else if (e.key === 'Enter' && found.length) {
    e.preventDefault(); choose(found[Math.max(0, hitAt)]);
  } else if (e.key === 'Escape') {
    S.q = ''; e.target.value = ''; drawHits();
  }
});
$('year').addEventListener('input', (e) => { tweens.delete('year'); S.year = +e.target.value; refresh(); });
$('home').addEventListener('click', () => {
  const t = byId[S.sel], out = S.home > 0.5, root = t && rootOf(t);
  // A trend with a root has further to go: back to its birthplace, then on to where it was borrowed from.
  if (root) spinAt(out ? bornAt(t) : d3.geoInterpolate(bornAt(t), root.c)(0.6));
  tween('home', out ? 0 : 1, root ? 2400 : 1100, () => S.home, (h) => { S.home = h; });
});
$('play').addEventListener('click', () => {
  const a = S.sel === 'all' ? FIRST : Math.max(FIRST, byId[S.sel].y - 1);
  tweens.delete('home'); S.home = 0; S.year = a;
  tween('year', LAST, Math.min(14000, Math.max(4000, (LAST - a) * 170)), () => S.year, (y) => { S.year = y; }, true);
});
const zoomTo = (z) => tween('zoom', Math.max(1, Math.min(4, z)), 350, () => S.zoom, (x) => { S.zoom = x; });
$('zin').addEventListener('click', () => zoomTo(S.zoom * 1.6));
$('zout').addEventListener('click', () => zoomTo(S.zoom / 1.6));

let drag = null;
canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false }; tweens.delete('rot'); canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y, k = 150 / (W || 300) / S.zoom;
  if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 5) drag.moved = true;
  S.rot = [S.rot[0] + dx * k, e.pointerType === 'touch' ? S.rot[1] : Math.max(-80, Math.min(80, S.rot[1] - dy * k)), 0];
  drag.x = e.clientX; drag.y = e.clientY; draw();
});
canvas.addEventListener('pointerup', (e) => {
  if (drag && !drag.moved) {
    const r = canvas.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top, centre = [-S.rot[0], -S.rot[1]];
    let best = null, bd = 22;
    for (const id in PLACES) {
      if (d3.geoDistance(PLACES[id][1], centre) > Math.PI / 2) continue;
      const [x, y] = proj(PLACES[id][1]), d = Math.hypot(x - px, y - py);
      if (d < bd) { bd = d; best = id; }
    }
    if (best) pickCity(best, false);
  }
  drag = null;
});
canvas.addEventListener('pointercancel', () => { drag = null; });
canvas.addEventListener('keydown', (e) => {
  const d = { ArrowLeft: [12, 0], ArrowRight: [-12, 0], ArrowUp: [0, -8], ArrowDown: [0, 8] }[e.key];
  if (!d) return;
  e.preventDefault(); tweens.delete('rot');
  S.rot = [S.rot[0] + d[0] / S.zoom, Math.max(-80, Math.min(80, S.rot[1] + d[1] / S.zoom)), 0]; draw();
});

new ResizeObserver(size).observe(canvas);
new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', draw);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
S.year = bestYear(byId.miniskirt);
S.rot = facing('uk');
drawPicker(); size(); refresh();
</script>
