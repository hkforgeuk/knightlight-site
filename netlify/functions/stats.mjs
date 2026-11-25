// Read-only summary for Knightboard: /.netlify/functions/stats?days=7
// Returns aggregate counts only (no personal data).
import { getStore } from '@netlify/blobs';

export default async (req) => {
  const days = Math.min(90, Math.max(1, parseInt(new URL(req.url).searchParams.get('days')) || 7));
  const store = getStore({ name: 'analytics', consistency: 'strong' });
  const out = { days, from: null, to: null, totals: { views: 0, visitors: 0, buys: 0, signups: 0, contacts: 0, searches: 0 }, pages: {}, sources: {}, books: {}, outbound: {}, devices: {}, daily: [] };
  const add = (a, b) => { for (const [k, v] of Object.entries(b || {})) a[k] = (a[k] || 0) + v; };
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
    out.from ??= day; out.to = day;
    const d = await store.get(day, { type: 'json' });
    if (!d) { out.daily.push({ day, views: 0, visitors: 0 }); continue; }
    for (const k of Object.keys(out.totals)) out.totals[k] += d[k] || 0;
    add(out.pages, d.pages); add(out.sources, d.sources); add(out.books, d.products); add(out.outbound, d.outbound); add(out.devices, d.devices);
    out.daily.push({ day, views: d.views, visitors: d.visitors, buys: d.buys || 0, signups: d.signups || 0 });
  }
  const top = o => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 15));
  out.pages = top(out.pages); out.sources = top(out.sources); out.books = top(out.books); out.outbound = top(out.outbound);
  return new Response(JSON.stringify(out, null, 1), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
};
