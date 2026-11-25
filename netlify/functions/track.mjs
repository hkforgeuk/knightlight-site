// Cookie-free analytics: counts page views, buy clicks and sign-ups per day in Netlify Blobs.
// Stores no IP addresses, cookies or personal data – only counts.
import { getStore } from '@netlify/blobs';

const EVENTS = new Set(['view', 'buy', 'signup', 'contact', 'out', 'search']);
const clean = s => String(s || '').toLowerCase().replace(/[^a-z0-9._\/-]/g, '').slice(0, 80);

export default async (req) => {
  if (req.method !== 'POST') return new Response(null, { status: 204 });
  let b; try { b = await req.json(); } catch { return new Response(null, { status: 204 }); }
  const ua = req.headers.get('user-agent') || '';
  if (/bot|crawl|spider|preview|headless|lighthouse/i.test(ua)) return new Response(null, { status: 204 });
  const ev = EVENTS.has(b.e) ? b.e : null; if (!ev) return new Response(null, { status: 204 });

  const day = new Date().toISOString().slice(0, 10);
  const store = getStore({ name: 'analytics', consistency: 'strong' });
  const d = (await store.get(day, { type: 'json' })) || { views: 0, visitors: 0, pages: {}, sources: {}, products: {}, buys: 0, signups: 0, contacts: 0, outbound: {}, devices: {}, searches: 0, revenue_intent: 0 };
  const bump = (o, k, n = 1) => { if (k) o[k] = (o[k] || 0) + n; };
  if (ev === 'view') {
    d.views++; if (b.n) d.visitors++;
    bump(d.pages, clean(b.p) || '/');
    bump(d.sources, clean(b.s) || 'direct');
    bump(d.devices, /mobile|android|iphone/i.test(ua) ? 'mobile' : 'desktop');
    if (b.slug) bump(d.products, clean(b.slug));
  }
  if (ev === 'buy') { d.buys = (d.buys || 0) + 1; bump(d.outbound, 'buy:' + clean(b.to)); }
  if (ev === 'signup') { d.signups = (d.signups || 0) + 1; }
  if (ev === 'contact') d.contacts++;
  if (ev === 'search') d.searches++;
  if (ev === 'out') bump(d.outbound, clean(b.to));
  await store.setJSON(day, d);
  return new Response(null, { status: 204 });
};
