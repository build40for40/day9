// Fits the comeback model and writes public/forecast.json.
//
// Each trend's periods (any region) are merged into waves. A wave either never
// returns or returns after a lognormal gap: a mixture cure survival model,
// fitted by grid-search maximum likelihood on every start-to-start gap, with
// one censored observation per trend for the time since its latest wave began.
// A trend with a single wave has no gap to learn from, so it stays "unknown".
//
// Usage, from the repo root: node datasets/fashion/scripts/forecast.mjs
// Node with no dependencies. Deterministic for the same fashion.json.

import { readFileSync, writeFileSync } from 'node:fs';

const data = JSON.parse(readFileSync('public/fashion.json', 'utf8'));
const FROM = data.meta.years.from;
const NOW = data.meta.years.to;
const HORIZON = [NOW + 1, NOW + 2, NOW + 3];
const SHRINK = 2;
const BANDS = { likely: 0.14, possible: 0.07 };

const erf = (x) => {
  const s = Math.sign(x);
  x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  return s * (1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x));
};
const cdf = (t, mu, sd) => (t <= 0 ? 0 : 0.5 * (1 + erf((Math.log(t) - mu) / (sd * Math.SQRT2))));
const pdf = (t, mu, sd) => Math.exp(-((Math.log(t) - mu) ** 2) / (2 * sd * sd)) / (t * sd * Math.sqrt(2 * Math.PI));
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const round = (x, d = 3) => +x.toFixed(d);

function wavesOf(trend) {
  const spans = trend.periods
    .map((p) => [Math.max(FROM, p.start), Math.min(NOW, p.end)])
    .filter(([s, e]) => e >= s)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const waves = [];
  for (const [s, e] of spans) {
    const last = waves[waves.length - 1];
    if (last && s <= last[1] + 1) last[1] = Math.max(last[1], e);
    else waves.push([s, e]);
  }
  return waves;
}

const trends = data.trends.map((t) => ({ id: t.id, waves: wavesOf(t) })).filter((t) => t.waves.length);

function fit(asOf) {
  const gaps = [];
  const censored = [];
  for (const t of trends) {
    const starts = t.waves.map((w) => w[0]).filter((s) => s <= asOf);
    if (!starts.length) continue;
    for (let i = 1; i < starts.length; i++) gaps.push(starts[i] - starts[i - 1]);
    const c = asOf - starts[starts.length - 1];
    if (c > 0) censored.push(c);
  }
  let best = { ll: -Infinity };
  for (let cure = 0.3; cure <= 1.0001; cure += 0.02)
    for (let mu = 2.0; mu <= 4.2; mu += 0.02)
      for (let sd = 0.2; sd <= 1.4; sd += 0.02) {
        let ll = 0;
        for (const g of gaps) ll += Math.log(cure * pdf(g, mu, sd));
        for (const c of censored) ll += Math.log(1 - cure + cure * (1 - cdf(c, mu, sd)));
        if (ll > best.ll) best = { ll, cure, mu, sd };
      }
  return { ...best, gaps: gaps.length, censored: censored.length };
}

function forecast(t, m, asOf, years) {
  const waves = t.waves.filter((w) => w[0] <= asOf);
  if (!waves.length) return null;
  const last = waves[waves.length - 1];
  const inNow = last[1] >= asOf;
  if (waves.length < 2) return { status: 'unknown', inNow };
  const own = waves.slice(1).map((w, i) => Math.log(w[0] - waves[i][0]));
  const mu = m.mu + (own.length / (own.length + SHRINK)) * (mean(own) - m.mu);
  const t0 = asOf - last[0];
  const alive = 1 - m.cure + m.cure * (1 - cdf(t0, mu, m.sd));
  const cum = years.map((y) => (m.cure * (cdf(y - last[0], mu, m.sd) - cdf(t0, mu, m.sd))) / alive);
  const quantile = (q) => {
    const target = cdf(t0, mu, m.sd) + q * (1 - cdf(t0, mu, m.sd));
    let lo = t0;
    let hi = 400;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (cdf(mid, mu, m.sd) < target) lo = mid;
      else hi = mid;
    }
    return Math.round(last[0] + hi);
  };
  return { status: inNow ? 'in' : 'out', inNow, last, cum, typicalGap: Math.round(Math.exp(mu)), median: quantile(0.5), range: [quantile(0.1), quantile(0.9)] };
}

const model = fit(NOW);

const finished = trends.flatMap((t) => t.waves.filter((w) => w[1] < NOW).map((w) => w[1] - w[0] + 1));
const dMu = mean(finished.map(Math.log));
const dSd = Math.sqrt(mean(finished.map((d) => (Math.log(d) - dMu) ** 2)));
const lasting = (d) => 1 - cdf(d, dMu, dSd);

const out = {};
const counts = { in: 0, out: 0, unknown: 0 };
for (const t of trends) {
  const f = forecast(t, model, NOW, HORIZON);
  counts[f.status]++;
  const entry = { waves: t.waves, status: f.status };
  if (f.status === 'unknown') entry.inNow = f.inNow;
  if (f.status === 'in') {
    const d0 = NOW - f.last[0] + 1;
    entry.typicalGap = f.typicalGap;
    entry.stillIn = Object.fromEntries(HORIZON.map((y) => [y, round(Math.min(1, lasting(y - f.last[0] + 1) / lasting(d0)))]));
  }
  if (f.status === 'out') {
    entry.typicalGap = f.typicalGap;
    entry.comebackBy = Object.fromEntries(HORIZON.map((y, i) => [y, round(f.cum[i])]));
    entry.verdict = f.cum[2] >= BANDS.likely ? 'likely' : f.cum[2] >= BANDS.possible ? 'possible' : 'unlikely';
    entry.medianReturn = f.median;
    entry.returnRange = f.range;
  }
  out[t.id] = entry;
}

// Backtest: stand at year Y knowing only the waves that had started by then,
// and ask which out-of-fashion trends start a new wave within three years.
const rows = [];
for (let Y = 1990; Y <= NOW - 3; Y += 4) {
  const m = fit(Y);
  for (const t of trends) {
    const f = forecast(t, m, Y, [Y + 1, Y + 2, Y + 3]);
    if (!f || f.status !== 'out') continue;
    rows.push({ p: f.cum[2], actual: t.waves.some((w) => w[0] > Y && w[0] <= Y + 3) ? 1 : 0 });
  }
}
const base = mean(rows.map((r) => r.actual));
const brier = mean(rows.map((r) => (r.p - r.actual) ** 2));
const brierBase = mean(rows.map((r) => (base - r.actual) ** 2));
const pos = rows.filter((r) => r.actual);
const neg = rows.filter((r) => !r.actual);
let wins = 0;
for (const a of pos) for (const b of neg) wins += a.p > b.p ? 1 : a.p === b.p ? 0.5 : 0;

const BUCKET = 0.05;
const buckets = new Map();
for (const r of rows) {
  const i = Math.floor(r.p / BUCKET);
  buckets.set(i, [...(buckets.get(i) ?? []), r]);
}
const calibration = [...buckets.entries()]
  .sort((a, b) => a[0] - b[0])
  .map(([i, rs]) => ({ from: round(i * BUCKET, 2), to: round((i + 1) * BUCKET, 2), guesses: rs.length, predicted: round(mean(rs.map((r) => r.p))), observed: round(mean(rs.map((r) => r.actual))) }));

const result = {
  meta: {
    now: NOW,
    horizon: HORIZON,
    summary:
      'Each wave of a trend either never returns or returns after a gap. The model learns the gaps from every trend that came back, then gives the chance a new wave starts in each of the next three years. One recorded wave means no gap to learn from, so that trend is unknown.',
    params: { returnShare: round(model.cure, 2), medianGapYears: round(Math.exp(model.mu), 1), logMu: round(model.mu, 2), logSd: round(model.sd, 2), medianWaveYears: round(Math.exp(dMu), 1) },
    counts: { trends: trends.length, gaps: model.gaps, ...counts },
    bands: BANDS,
    backtest: { guesses: rows.length, baseRate: round(base), brier: round(brier, 4), brierBaseRate: round(brierBase, 4), skill: round(1 - brier / brierBase), auc: round(wins / (pos.length * neg.length)), calibration },
  },
  trends: out,
};

writeFileSync('public/forecast.json', JSON.stringify(result));
console.log(JSON.stringify(result.meta, null, 1));
const due = Object.entries(out).filter(([, f]) => f.status === 'out').sort((a, b) => b[1].comebackBy[HORIZON[2]] - a[1].comebackBy[HORIZON[2]]);
console.log('most due:', due.slice(0, 12).map(([id, f]) => `${id} ${f.comebackBy[HORIZON[2]]}`).join(', '));
