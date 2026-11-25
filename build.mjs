// Knightlight Books – static site builder.
// Reads content/*.json (edited in /admin) and writes finished HTML pages to dist/.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(ROOT, 'dist');
const rd = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const dir = d => fs.existsSync(path.join(ROOT, d)) ? fs.readdirSync(path.join(ROOT, d)).filter(f => f.endsWith('.json')).map(f => rd(path.join(d, f))) : [];

const S = rd('content/settings.json');
const genres = dir('content/genres').sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
const series = dir('content/series').filter(s => s.active !== false);
const books = dir('content/books').filter(b => b.active !== false);
const stories = dir('content/stories').filter(s => s.active !== false).sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
const pages = Object.fromEntries(dir('content/pages').map(p => [p.slug, p]));
for (const g of genres) if (typeof g.subgenres === 'string') g.subgenres = JSON.parse(g.subgenres || '[]');
for (const g of genres) g.subgenres = g.subgenres || [];

// ---------- helpers ----------
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fill = s => String(s ?? '').replace(/\{\{email\}\}/g, S.email).replace(/\{\{address\}\}/g, S.address);
const inline = s => esc(fill(s))
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\*(.+?)\*/g, '<em>$1</em>')
  .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
  .replace(/([\w.+-]+@[\w-]+\.[\w.]+)/g, '<a href="mailto:$1">$1</a>');
const md = src => String(src || '').trim().split(/\n\s*\n/).map(block => {
  const lines = block.split('\n');
  if (/^##\s/.test(block)) return `<h2>${inline(block.replace(/^##\s*/, ''))}</h2>`;
  if (lines.every(l => /^\s*-\s/.test(l))) return `<ul>${lines.map(l => `<li>${inline(l.replace(/^\s*-\s*/, ''))}</li>`).join('')}</ul>`;
  return `<p>${lines.map(inline).join('<br>')}</p>`;
}).join('\n');
const money = n => '£' + Number(n || 0).toFixed(2);
const genreBy = Object.fromEntries(genres.map(g => [g.slug, g]));
const seriesBy = Object.fromEntries(series.map(s => [s.slug, s]));
const subOf = (g, sub) => (genreBy[g]?.subgenres || []).find(x => x.slug === sub);
const bookSeries = b => seriesBy[b.series];
const bookGenre = b => genreBy[bookSeries(b)?.genre || b.genre];
const isAdult = b => { const s = bookSeries(b); return !!(b.adult || (s && subOf(s.genre, s.subgenre)?.adult)); };
const seriesBooks = s => books.filter(b => b.series === s.slug).sort((a, b) => (a.number || 0) - (b.number || 0));
const STATUS = { available: 'Out now', coming_soon: 'Coming soon', in_progress: 'In progress', planned: 'Planned' };
const ord = n => ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'][n] || n;
const IG = Object.fromEntries(genres.filter(g => g.instagram).map(g => [g.imprint, g.instagram]));

// ---------- building blocks ----------
const lamp = `<svg class="lamp" width="44" height="54" viewBox="0 0 44 54" aria-hidden="true"><line x1="22" y1="0" x2="22" y2="22" stroke="#6E6470" stroke-width="1.2"/><path class="shade" d="M9 36 Q22 16 35 36 Z"/><circle class="bulb" cx="22" cy="37" r="3.5" fill="#F6D893"/></svg><span class="glow"></span>`;

const coverImg = (b, cls = 'cv') => b.cover_front
  ? (cls === 'cv' ? `<span class="cvbox"><img class="cv" src="${esc(b.cover_front)}" alt="${esc(b.title)} cover" loading="lazy"></span>` : `<img class="${cls}" src="${esc(b.cover_front)}" alt="${esc(b.title)} cover" loading="lazy">`)
  : `<span class="${cls} typecover"><small>${esc(bookSeries(b)?.title || '')}</small><b>${esc(b.title)}</b><small>${esc(b.author)}</small></span>`;

const bookCard = (b, opts = {}) => {
  const s = bookSeries(b);
  return `<a class="lc" href="/books/${b.slug}/" data-title="${esc((b.title + ' ' + (s?.title || '')).toLowerCase())}" data-status="${b.status}" data-genre="${esc(s?.genre || '')}">${lamp}${coverImg(b)}
<span class="lc-meta">${s ? `${esc(s.title)} · Book ${ord(b.number)}` : ''}</span>
<span class="lc-title">${esc(b.title)}</span>
<span class="lc-status s-${b.status}">${b.status === 'available' && b.price && !b.kdp ? money(b.price) : (b.kdp && b.status === 'available' ? 'On Amazon' : STATUS[b.status] || '')}</span></a>`;
};

const signup = ({ heading = 'Join the Knightlight reading list', text = 'New releases, free short stories and launch-day offers. Pick the genres you love, nothing else.', book = null, genre = null, compact = false } = {}) => {
  const id = 'f' + Math.random().toString(36).slice(2, 8);
  const boxes = (book || genre) ? '' : `<fieldset class="genres"><legend>I'm interested in</legend>${genres.filter(g => g.slug).map(g => `<label><input type="checkbox" name="genres" value="${g.slug}"> ${esc(g.name)}</label>`).join('')}</fieldset>`;
  return `<form class="signup${compact ? ' compact' : ''}" name="reading-list" method="POST" data-netlify="true" netlify-honeypot="company" action="/thanks/">
<input type="hidden" name="form-name" value="reading-list">
<input type="hidden" name="book" value="${esc(book?.slug || '')}"><input type="hidden" name="genre" value="${esc(genre || (book ? bookGenre(book)?.slug : '') || '')}">
<p class="hp"><label>Leave blank <input name="company"></label></p>
${heading ? `<h3>${esc(heading)}</h3>` : ''}${text ? `<p class="muted">${esc(text)}</p>` : ''}${boxes}
<div class="row"><label for="${id}" class="sr">Email address</label><input id="${id}" type="email" name="email" required placeholder="Your email address" autocomplete="email"><button class="btn" type="submit">${book ? 'Notify me' : 'Subscribe'}</button></div>
<p class="ok" hidden>Thank you. You're on the list.</p></form>`;
};

const buyBox = b => {
  const out = [];
  const stores = [['Kobo', b.kobo_url], ['Google Play Books', b.google_url], ['Amazon', !b.kdp && b.amazon_url]].filter(x => x[1]);
  if (b.status === 'available' && b.kdp) {
    out.push(`<div class="price"><span>Kindle e-book</span></div>`);
    out.push(b.amazon_url ? `<a class="btn btn-lg" data-buy="amazon" href="${esc(b.amazon_url)}" rel="noopener">Buy on Amazon</a>` : `<span class="btn btn-lg disabled">Coming soon to Amazon</span>`);
  } else if (b.status === 'available') {
    out.push(`<div class="price"><b>${money(b.price)}</b><span>${esc(b.format || 'ePub')} · instant download</span></div>`);
    out.push(`<a class="btn btn-lg" data-buy="payhip" href="${esc(b.payhip_url || S.links.payhip)}" rel="noopener">Buy the ePub direct</a>`);
    out.push(`<p class="muted small">Secure checkout by Payhip. Reads on Kindle (via Send to Kindle), Kobo, Apple Books, Google Play Books and most e-readers.</p>`);
    if (stores.length) out.push(`<div class="also"><p class="eyebrow-s">Also available at</p><div class="chips">${stores.map(([n, u]) => `<a class="chip" data-buy="${n.toLowerCase().split(' ')[0]}" href="${esc(u)}" rel="noopener">${n}</a>`).join('')}</div></div>`);
  } else {
    out.push(`<div class="price"><b>${STATUS[b.status]}</b><span>${b.kdp ? 'Coming to Amazon Kindle' : esc(b.format || 'ePub')}</span></div>`);
    out.push(signup({ heading: 'Get notified on release day', text: '', book: b, compact: true }));
  }
  return `<div class="buybox">${out.join('\n')}</div>`;
};

const hkStrip = text => S.links.hkforge ? `<a class="hk" href="${esc(S.links.hkforge)}" rel="noopener"><span><span class="hk-tag">From our sister workshop · HK Forge</span><br>${esc(text || S.hkforge_strip)}</span><span class="hk-go">Visit hkforge.co.uk →</span></a>` : '';

// ---------- page shell ----------
const nav = () => `<header class="site"><div class="wrap bar">
<a class="brand" href="/"><img src="/img/logo-k.jpg" alt="" width="44" height="44"><span>Knightlight Books</span></a>
<button class="menu" aria-expanded="false" aria-controls="nav" aria-label="Menu"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg></button>
<nav id="nav"><div class="dd"><a href="/genres/">Genres</a><div class="ddm">${genres.map(g => `<a href="/genres/${g.slug}/">${esc(g.name)}</a>`).join('')}</div></div>
<a href="/books/">All books</a><a href="/free-stories/">Free stories</a><a href="/about/">About</a><a href="/faq/">FAQs</a><a href="/contact/">Contact</a></nav>
<form class="search" action="/books/" role="search"><label class="sr" for="q">Search</label><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><input id="q" name="q" placeholder="Search books" autocomplete="off"></form>
</div></header>`;

const foot = () => `<footer class="site"><div class="wrap cols">
<div><img src="/img/logo-k.jpg" alt="Knightlight Books" width="64" height="64" class="round"><p>${esc(S.tagline)}</p></div>
<div><b>Books</b><a href="/books/">All books</a>${genres.map(g => `<a href="/genres/${g.slug}/">${esc(g.name)}</a>`).join('')}<a href="/free-stories/">Free short stories</a></div>
<div><b>Help</b><a href="/about/">About us</a><a href="/faq/">FAQs</a><a href="/contact/">Contact</a><a href="/legal/">Legal</a></div>
<div><b>Follow</b>${S.links.instagram ? `<a href="${esc(S.links.instagram)}" rel="noopener">Instagram</a>` : ''}${Object.entries(IG).map(([n, u]) => `<a href="${esc(u)}" rel="noopener">${esc(n.replace('Knightlight ', ''))} on Instagram</a>`).join('')}${S.links.linktree ? `<a href="${esc(S.links.linktree)}" rel="noopener">Linktree</a>` : ''}</div>
<div><b>Also on</b>${S.links.payhip ? `<a href="${esc(S.links.payhip)}" rel="noopener">Payhip store</a>` : ''}${S.links.kobo ? `<a href="${esc(S.links.kobo)}" rel="noopener">Kobo</a>` : ''}${S.links.google_play ? `<a href="${esc(S.links.google_play)}" rel="noopener">Google Play Books</a>` : ''}${S.links.amazon ? `<a href="${esc(S.links.amazon)}" rel="noopener">Amazon</a>` : ''}${S.links.hkforge ? `<a href="${esc(S.links.hkforge)}" rel="noopener">HK Forge (3D prints)</a>` : ''}</div>
</div><div class="wrap legal"><span>© ${new Date().getFullYear()} Knightlight Books, a trading name of ${esc(S.legal_name)} (sole trader), United Kingdom.</span><span><a href="/terms/">Terms</a><a href="/refunds/">Refunds</a><a href="/privacy/">Privacy</a><a href="/cookies/">Cookies</a></span></div></footer>`;

const ageGate = () => `<div class="agegate" id="agegate" hidden><div role="dialog" aria-modal="true" aria-labelledby="agetitle" class="agebox">
<img src="/img/logo-k.jpg" alt="" width="72" height="72" class="round"><p class="eyebrow">Knightlight Romance</p><h2 id="agetitle">Are you 18 or over?</h2>
<p class="muted">This section contains adult romance with mature themes and explicit content. Please confirm your age to continue.</p>
<button class="btn btn-lg" data-age="yes">I'm 18 or over, enter</button><button class="btn-o btn-lg" data-age="no">Take me back</button>
<p class="small muted">We remember your answer on this device only. See our <a href="/terms/">terms</a>.</p></div></div>`;

const page = ({ url, title, desc = S.intro, body, adult = false, image = '/img/logo-main.jpg', type = 'website' }) => {
  const canon = S.url.replace(/\/$/, '') + url;
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}">
${S.launched ? `<link rel="canonical" href="${canon}">` : '<meta name="robots" content="noindex,nofollow">'}
<meta property="og:type" content="${type}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:image" content="${S.url.replace(/\/$/, '')}${image}"><meta property="og:site_name" content="Knightlight Books">
<meta name="theme-color" content="#111013"><link rel="icon" href="/img/icon-k-400.jpg">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Inter:wght@400;500;600&display=swap">
<link rel="stylesheet" href="/assets/site.css"></head>
<body${adult ? ' data-adult="1"' : ''}><a class="skip" href="#main">Skip to content</a>${nav()}<main id="main">${body}</main>${foot()}${adult ? ageGate() : ''}
<script>window.KL_KIT=${JSON.stringify(S.kit_forms || {})};</script><script src="/assets/site.js" defer></script></body></html>`;
};

const crumbs = list => `<p class="crumbs">${list.map(([t, u]) => u ? `<a href="${u}">${esc(t)}</a>` : `<span>${esc(t)}</span>`).join(' / ')}</p>`;

// ---------- write ----------
fs.rmSync(OUT, { recursive: true, force: true });
const write = (rel, html) => { const f = path.join(OUT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, html); };
const urls = [];
const emit = (url, opts) => { write(url.endsWith('/') ? url + 'index.html' : url, page({ url, ...opts })); if (!opts.noindex) urls.push(url); };
for (const d of ['assets', 'img', 'admin']) if (fs.existsSync(path.join(ROOT, d))) fs.cpSync(path.join(ROOT, d), path.join(OUT, d), { recursive: true });

const publicBooks = books.filter(b => !isAdult(b));
const featured = books.find(b => b.slug === S.featured_book) || books.find(b => b.featured && b.status === 'available');
const soon = publicBooks.filter(b => b.status !== 'available' && b.cover_front).sort((a, b) => (a.number || 0) - (b.number || 0) || a.title.localeCompare(b.title));
// interleave series so the row shows variety
const bySer = {}; for (const b of soon) (bySer[b.series] ||= []).push(b);
const mixed = []; for (let i = 0; mixed.length < soon.length; i++) for (const k of Object.keys(bySer)) if (bySer[k][i]) mixed.push(bySer[k][i]);

// HOME
emit('/', { title: 'Knightlight Books · Stories worth getting lost in', body: `
<section class="hero"${S.hero_image ? ` style="background-image:linear-gradient(90deg,rgba(17,16,19,.94),rgba(17,16,19,.55)),url('${esc(S.hero_image)}')"` : ''}><div class="wrap hero-in">
<div class="hero-copy"><p class="eyebrow">Independent publishing house</p><h1>${esc(S.tagline)}</h1><p class="lead">${esc(S.intro)} Buy the ePub direct and read it on any device.</p>
<div class="btns"><a class="btn btn-lg" href="/books/">Browse the books</a><a class="btn-o btn-lg" href="#reading-list">Join the reading list</a></div></div>
<img class="hero-logo" src="/img/logo-main.jpg" alt="Knightlight Books, Publishing House" width="1200" height="505"></div></section>
<section class="trust"><div class="wrap grid3"><span>Buy direct: instant ePub download</span><span>Reads on Kindle, Kobo, Apple Books and more</span><span>Also on Kobo, Google Play and Amazon</span></div></section>
${featured ? `<section class="wrap sec"><p class="eyebrow">New release</p><div class="feature">
<a class="lc lc-big lit" href="/books/${featured.slug}/">${lamp}${coverImg(featured)}</a>
<div><p class="muted">${esc(bookSeries(featured)?.title || '')} · Book ${ord(featured.number)}</p><h2 class="h1">${esc(featured.title)}</h2><p class="gold">${esc(featured.author)}</p>
${featured.tagline ? `<p class="tagline">${esc(featured.tagline)}</p>` : ''}<p class="muted">${esc((featured.blurb || '').split('\n\n')[0])}</p>
<div class="btns"><a class="btn btn-lg" data-buy="payhip" href="${esc(featured.payhip_url || S.links.payhip)}" rel="noopener">Buy ePub · ${money(featured.price)}</a><a href="/books/${featured.slug}/">Read more →</a></div></div></div></section>` : ''}
<section class="wrap sec"><div class="sec-h"><h2>Explore by genre</h2><a href="/genres/">All genres →</a></div><div class="tiles">
${genres.map(g => { const gb = books.filter(b => bookSeries(b)?.genre === g.slug && !isAdult(b)); const live = gb.filter(b => b.status === 'available').length; const covers = gb.filter(b => b.cover_front).slice(0, 3);
  return `<a class="tile" href="/genres/${g.slug}/"><span class="tile-covers">${covers.map(b => `<img src="${esc(b.cover_front)}" alt="" loading="lazy">`).join('')}</span><span class="tile-name">${esc(g.name)}</span><span class="muted small">${esc(g.subgenres.map(s => s.name.replace(/ \(.*\)/, '')).join(' · ') || g.tagline)}</span><span class="gold small">${live ? `${live} out now` : gb.length ? `${gb.length} coming soon` : 'Coming soon'}</span></a>`; }).join('')}
</div></section>
${mixed.length ? `<section class="wrap sec"><div class="sec-h"><h2>Coming soon</h2><a href="/books/?status=coming_soon">See all →</a></div><p class="muted small hint">Hover over a book to switch its lamp on.</p><div class="shelf">${mixed.slice(0, 8).map(b => bookCard(b)).join('')}</div></section>` : ''}
${stories.length ? `<section class="wrap sec" id="free-stories"><p class="eyebrow">Free short stories</p><div class="sec-h"><h2>Step into our worlds, free</h2><a href="/free-stories/">All free stories →</a></div><div class="stories">${stories.map(storyCard).join('')}</div></section>` : ''}
<section class="band" id="reading-list"><div class="wrap narrow center">${signup()}</div></section>
<section class="wrap sec">${hkStrip()}</section>` });

function storyCard(s) { const ser = seriesBy[s.series];
  return `<div class="story"><img src="${esc(s.cover)}" alt="" loading="lazy"><div><p class="muted small">${esc(ser?.title || '')}${ser ? ' · ' + esc(genreBy[ser.genre]?.name || '') : ''}</p><h3>${esc(s.title)}</h3><p class="muted">${esc(s.hook)}</p>
${s.signup_url ? `<a class="btn" href="${esc(s.signup_url)}" rel="noopener" data-buy="free-story">Get it free</a>` : `<a class="btn" href="/free-stories/#get">Get it free</a>`}</div></div>`; }

// ALL BOOKS
emit('/books/', { title: 'All books · Knightlight Books', desc: 'Every Knightlight book: out now and coming soon.', body: `
<section class="wrap sec">${crumbs([['Home', '/'], ['All books']])}<h1>All books</h1>
<div class="filters"><input id="bq" type="search" placeholder="Search by title or series" aria-label="Search books">
<div class="chips" id="bf"><button class="chip on" data-f="all">All</button><button class="chip" data-f="available">Out now</button><button class="chip" data-f="coming_soon">Coming soon</button>${genres.map(g => `<button class="chip" data-g="${g.slug}">${esc(g.name)}</button>`).join('')}</div></div>
<div class="shelf" id="allbooks">${publicBooks.sort((a, b) => (a.status === 'available' ? 0 : 1) - (b.status === 'available' ? 0 : 1) || (bookSeries(a)?.title || '').localeCompare(bookSeries(b)?.title || '') || a.number - b.number).map(b => bookCard(b)).join('')}</div>
<p id="none" class="muted" hidden>No books match that search.</p></section>` });

// GENRES INDEX
emit('/genres/', { title: 'Genres · Knightlight Books', body: `<section class="wrap sec">${crumbs([['Home', '/'], ['Genres']])}<h1>Genres</h1><div class="tiles">
${genres.map(g => `<a class="tile" href="/genres/${g.slug}/"><span class="tile-name">${esc(g.name)}</span><span class="muted small">${esc(g.description)}</span><span class="gold small">${esc(g.imprint)}</span></a>`).join('')}</div></section>` });

const seriesCard = s => { const sb = seriesBooks(s); const live = sb.filter(b => b.status === 'available').length;
  return `<a class="scard" href="/series/${s.slug}/"><span class="scovers">${sb.filter(b => b.cover_front).slice(0, 4).map(b => `<img src="${esc(b.cover_front)}" alt="" loading="lazy">`).join('') || `<span class="typecover"><b>${esc(s.title)}</b></span>`}</span>
<span class="sbody"><span class="eyebrow-s">Series${s.planned_books ? ` · ${s.planned_books} books planned` : ''}</span><span class="sname">${esc(s.title)}</span><span class="muted">${esc(s.description)}</span>
<span class="small"><span class="muted">${live ? `${live} of ${Math.max(sb.length, s.planned_books || 0)} out now` : s.status === 'in_development' ? 'In development' : 'Coming soon'}</span> &nbsp; <span class="gold">View series →</span></span></span></a>`; };

const sidebar = (g, sub) => `<aside class="side"><p class="eyebrow-s">Genres</p>${genres.map(x => `<a class="${x.slug === g.slug && !sub ? 'on' : ''}" href="/genres/${x.slug}/">${esc(x.name)}</a>${x.slug === g.slug ? x.subgenres.map(s => `<a class="subl ${sub === s.slug ? 'on' : ''}" href="/genres/${x.slug}/${s.slug}/">${esc(s.name)}${s.adult ? ' · 18+' : ''}</a>`).join('') : ''}`).join('')}</aside>`;

for (const g of genres) {
  const gs = series.filter(s => s.genre === g.slug).sort((a, b) => (a.order ?? 9) - (b.order ?? 9));
  const subsec = g.subgenres.map(sub => {
    const ss = gs.filter(s => s.subgenre === sub.slug);
    const head = `<h2>${esc(sub.name)}${sub.adult ? ' <span class="badge">18+</span>' : ''}</h2><p class="muted">${esc(sub.description)}</p>`;
    if (sub.adult) return `<section id="${sub.slug}" class="subsec">${head}<div class="empty"><span class="muted">${ss.length ? `${ss.length} series` : 'New titles are on the way.'} Readers confirm they're 18 or over before entering.</span><a class="btn-o" href="/genres/${g.slug}/${sub.slug}/">Enter ${esc(sub.name)} (18+)</a></div></section>`;
    return `<section id="${sub.slug}" class="subsec">${head}${ss.length ? ss.map(seriesCard).join('') : `<div class="empty"><span class="muted">New titles are on the way.</span><a class="btn-o" href="#reading-list">Notify me</a></div>`}</section>`;
  }).join('');
  emit(`/genres/${g.slug}/`, { title: `${g.name} · Knightlight Books`, desc: g.description, body: `
<section class="ghero"><div class="wrap">${crumbs([['Home', '/'], ['Genres', '/genres/'], [g.name]])}<p class="eyebrow">${esc(g.imprint)}</p><h1>${esc(g.tagline)}</h1><p class="lead">${esc(g.description)}</p></div></section>
<div class="wrap withside">${sidebar(g)}<div class="mainc">${g.subgenres.length > 1 ? `<div class="chips">${g.subgenres.map(s => `<a class="chip" href="#${s.slug}">${esc(s.name)}</a>`).join('')}</div>` : ''}
${subsec || `<div class="empty"><span class="muted">Our first ${esc(g.name.toLowerCase())} titles are on the way.</span></div>`}
<div class="band-in" id="reading-list">${signup({ heading: `Hear about new ${g.name} first`, text: '', genre: g.slug })}</div></div></div>` });
  for (const sub of g.subgenres) {
    const ss = gs.filter(s => s.subgenre === sub.slug);
    emit(`/genres/${g.slug}/${sub.slug}/`, { adult: !!sub.adult, title: `${sub.name} · ${g.name} · Knightlight Books`, desc: sub.description, body: `
<section class="ghero"><div class="wrap">${crumbs([['Home', '/'], ['Genres', '/genres/'], [g.name, `/genres/${g.slug}/`], [sub.name]])}<p class="eyebrow">${esc(g.imprint)}</p><h1>${esc(sub.name)}${sub.adult ? ' <span class="badge">18+</span>' : ''}</h1><p class="lead">${esc(sub.description)}</p></div></section>
<div class="wrap withside">${sidebar(g, sub.slug)}<div class="mainc">${ss.length ? ss.map(s => `<section class="subsec"><h2><a href="/series/${s.slug}/">${esc(s.title)}</a></h2><p class="muted">${esc(s.description)}</p><div class="shelf">${seriesBooks(s).map(b => bookCard(b)).join('')}</div></section>`).join('') : `<div class="empty"><span class="muted">New titles are on the way.</span></div>`}
<div class="band-in" id="reading-list">${signup({ heading: `Hear about new ${sub.name} first`, text: '', genre: g.slug })}</div></div></div>` });
  }
}

// SERIES
for (const s of series) {
  const g = genreBy[s.genre]; const sub = subOf(s.genre, s.subgenre); const sb = seriesBooks(s);
  const slots = [...sb]; for (let n = sb.length + 1; n <= (s.planned_books || 0) && n <= 12; n++) slots.push({ planned: true, number: n });
  const first = sb.find(b => b.status === 'available') || sb[0];
  emit(`/series/${s.slug}/`, { adult: !!sub?.adult, title: `${s.title} · Knightlight Books`, desc: s.description, image: sb[0]?.cover_front || '/img/logo-main.jpg', body: `
<section class="shero${s.banner ? ' hasbg' : ''}"${s.banner ? ` style="--bg-img:url('${esc(s.banner)}')"` : ''}><div class="wrap">
${crumbs([['Home', '/'], [g?.name || 'Genres', `/genres/${s.genre}/`], [sub?.name || '', sub ? `/genres/${s.genre}/${sub.slug}/` : ''], [s.title]].filter(x => x[0]))}
<p class="eyebrow">${esc(sub?.name || g?.name || '')} series by ${esc(s.author)}</p><h1>${esc(s.title)}</h1><p class="lead">${esc(s.description)}</p>
<div class="btns">${first ? `<a class="btn btn-lg" href="/books/${first.slug}/">${first.status === 'available' ? 'Start with Book One' : 'See Book One'}</a>` : ''}<a class="btn-o btn-lg" href="#reading-list">Get release news</a></div></div></section>
<section class="wrap sec"><div class="sec-h"><h2>Reading order</h2><span class="muted small">${sb.filter(b => b.status === 'available').length} of ${slots.length} available</span></div>
<div class="shelf">${slots.map(b => b.planned ? `<div class="lc planned">${lamp}<span class="cv typecover"><small>${esc(s.title)}</small><b>Book ${ord(b.number)}</b></span><span class="lc-meta">Book ${ord(b.number)}</span><span class="lc-title">Title to be announced</span><span class="lc-status">Planned</span></div>` : bookCard(b)).join('')}</div></section>
<section class="band" id="reading-list"><div class="wrap narrow center">${signup({ heading: `Never miss a ${s.title} release`, text: 'One email when each new book lands. Nothing else.', genre: s.genre })}</div></section>` });
}

// BOOKS
for (const b of books) {
  const s = bookSeries(b); const g = bookGenre(b); const sub = s && subOf(s.genre, s.subgenre); const sb = s ? seriesBooks(s) : [];
  const i = sb.findIndex(x => x.slug === b.slug); const prev = sb[i - 1], next = sb[i + 1];
  const details = [['Series', s ? `${s.title} #${b.number}` : ''], ['Genre', sub?.name || g?.name], ['Format', b.format], ['Length', b.pages ? b.pages + ' pages' : ''], ['Ages', b.age], ['Language', b.language], ['Publisher', 'Knightlight Books' + (b.published ? ', ' + b.published : '')]].filter(x => x[1]);
  emit(`/books/${b.slug}/`, { adult: isAdult(b), type: 'book', title: `${b.title} by ${b.author} · Knightlight Books`, desc: b.tagline || (b.blurb || s?.description || '').split('\n')[0], image: b.cover_front || '/img/logo-main.jpg', body: `
<div class="wrap">${crumbs([['Home', '/'], [g?.name || '', g ? `/genres/${g.slug}/` : ''], [s?.title || '', s ? `/series/${s.slug}/` : ''], [b.title]].filter(x => x[0]))}</div>
<section class="wrap book">
<div class="gallery">${b.cover_front ? `<div class="stage"><img id="cvbig" src="${esc(b.cover_front)}" alt="${esc(b.title)} front cover" width="600" height="900"></div>
${b.cover_back ? `<div class="thumbs"><button class="on" data-src="${esc(b.cover_front)}" data-alt="${esc(b.title)} front cover"><img src="${esc(b.cover_front)}" alt="">Front</button><button data-src="${esc(b.cover_back)}" data-alt="${esc(b.title)} back cover"><img src="${esc(b.cover_back)}" alt="">Back</button></div>` : ''}` : `<div class="stage">${coverImg(b, 'typecover big')}</div>`}
${b.sample_url ? `<a class="btn-o" href="${esc(b.sample_url)}" rel="noopener">Read a free sample</a>` : ''}</div>
<div class="bmain">${s ? `<a class="eyebrow" href="/series/${s.slug}/">${esc(s.title)} · Book ${ord(b.number)}</a>` : ''}
<h1>${esc(b.title)}</h1><p class="byline">by <span class="gold">${esc(b.author)}</span></p>
${buyBox(b)}
${b.tagline ? `<p class="tagline">${esc(b.tagline)}</p>` : ''}
${b.blurb ? `<h2 class="h3">About the book</h2><div class="prose">${md(b.blurb)}</div>` : (s ? `<h2 class="h3">About the series</h2><p class="muted">${esc(s.description)}</p>` : '')}
<dl class="details">${details.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></div></section>
${(prev || next) ? `<section class="seriesnav"><div class="wrap">${prev ? `<a href="/books/${prev.slug}/"><span class="muted small">← Previous · Book ${ord(prev.number)}</span><b>${esc(prev.title)}</b></a>` : '<span></span>'}${next ? `<a class="r" href="/books/${next.slug}/"><span class="muted small">Next · Book ${ord(next.number)} →</span><b>${esc(next.title)}</b></a>` : ''}</div></section>` : ''}
${sb.length > 1 ? `<section class="wrap sec"><div class="sec-h"><h2>More in ${esc(s.title)}</h2><a href="/series/${s.slug}/">View series →</a></div><div class="shelf">${sb.filter(x => x.slug !== b.slug).slice(0, 4).map(x => bookCard(x)).join('')}</div></section>` : ''}
<section class="wrap sec">${hkStrip(g?.slug === 'kids' ? 'Handmade 3D-printed gifts and room décor from our sister workshop in Buckinghamshire.' : 'Reading nook upgrade? Handmade 3D-printed bookends, bookmarks and lamps from our sister workshop.')}</section>` });
}

// FREE STORIES
emit('/free-stories/', { title: 'Free short stories · Knightlight Books', desc: 'Free prequel short stories set in our series.', body: `
<section class="ghero"><div class="wrap">${crumbs([['Home', '/'], ['Free short stories']])}<p class="eyebrow">Free short stories</p><h1>Step into our worlds, free</h1><p class="lead">Prequel stories set in our series, sent straight to your inbox. New ones are added as they're released.</p></div></section>
<section class="wrap sec"><div class="stories">${stories.map(storyCard).join('')}</div></section>
<section class="band" id="get"><div class="wrap narrow center">${signup({ heading: 'Get new free stories as they\'re released', text: 'We\'ll email you each new free short story the day it comes out.', genre: 'free-stories' })}</div></section>` });

// TEXT PAGES
const textPage = (slug, extra = '') => { const p = pages[slug]; if (!p) return;
  emit(`/${slug}/`, { title: `${p.title} · Knightlight Books`, desc: p.intro, body: `<section class="ghero"><div class="wrap narrow">${crumbs([['Home', '/'], [p.title]])}<h1>${esc(p.title)}</h1><p class="lead">${esc(fill(p.intro))}</p></div></section><section class="wrap narrow sec prose">${md(p.body)}${extra}</section>` }); };
textPage('about', `<div class="btns"><a class="btn" href="/books/">Browse the books</a><a class="btn-o" href="/contact/">Get in touch</a></div>`);
textPage('faq'); textPage('terms'); textPage('refunds'); textPage('privacy'); textPage('cookies');
textPage('contact', `<form class="contact" name="contact" method="POST" data-netlify="true" netlify-honeypot="company" action="/thanks/">
<input type="hidden" name="form-name" value="contact"><p class="hp"><label>Leave blank <input name="company"></label></p>
<label>Your name<input name="name" required autocomplete="name"></label><label>Email<input type="email" name="email" required autocomplete="email"></label>
<label>What's it about?<select name="topic"><option>A book or my order</option><option>Rights, press or bookshops</option><option>Something else</option></select></label>
<label>Message<textarea name="message" rows="6" required></textarea></label><button class="btn btn-lg" type="submit">Send message</button>
<p class="small muted">Or email <a href="mailto:${esc(S.email)}">${esc(S.email)}</a>. We usually reply within a couple of working days. See our <a href="/privacy/">privacy notice</a>.</p></form>`);
emit('/legal/', { title: 'Legal · Knightlight Books', body: `<section class="wrap narrow sec">${crumbs([['Home', '/'], ['Legal']])}<h1>Legal</h1><div class="tiles two">${['terms', 'refunds', 'privacy', 'cookies'].map(k => `<a class="tile" href="/${k}/"><span class="tile-name">${esc(pages[k].title)}</span><span class="muted small">${esc(fill(pages[k].intro))}</span></a>`).join('')}</div>
<p class="muted small">Knightlight Books is a trading name of ${esc(S.legal_name)}, sole trader. ${esc(S.address)}. ${esc(S.email)}</p></section>` });
emit('/thanks/', { noindex: true, title: 'Thank you · Knightlight Books', body: `<section class="wrap narrow sec center"><h1>Thank you</h1><p class="lead">We've got it. If you joined the reading list, look out for our next email.</p><a class="btn" href="/books/">Back to the books</a></section>` });
write('404.html', page({ url: '/404.html', title: 'Page not found · Knightlight Books', body: `<section class="wrap narrow sec center"><h1>This page has wandered off</h1><p class="lead">The page you were looking for isn't here.</p><a class="btn" href="/books/">Browse the books</a></section>` }));

// SEO files
const base = S.url.replace(/\/$/, '');
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(u => `<url><loc>${base}${u}</loc></url>`).join('')}</urlset>`);
write('robots.txt', S.launched ? `User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: ${base}/sitemap.xml\n` : `User-agent: *\nDisallow: /\n`);
console.log(`Built ${urls.length} pages, ${books.length} books, ${series.length} series → dist/`);
