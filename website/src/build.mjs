/**
 * build.mjs: builds lopentelopen.nl into website/public/ (upload that folder to STRATO).
 *
 *   node website/src/build.mjs
 *
 * No npm dependencies on purpose. Sources:
 *   src/pages/**.html     hand-written pages (front matter + HTML body)
 *   src/content/**.md     articles (front matter + a small Markdown subset)
 *   src/layouts/basis.html  the shared shell (nav, footer, meta)
 *   src/static/**          copied as-is (css, fonts, images, .htaccess)
 *   ../*.html legal pages  copied from the repo root (single source of truth)
 *
 * Front matter is "key: value" lines between two "---" lines. Keys used:
 *   title, description, h1, sectie, kaart (card text in section lists),
 *   antwoord (short answer box), auteur, gepubliceerd, bijgewerkt (YYYY-MM-DD),
 *   volgorde (sort order in lists), schema (article|webapp|none), noindex (ja),
 *   bronnen (" | "-separated "text => url" pairs), campagne (store link tag),
 *   afbeelding (site path of the article photo, used as JSON-LD image).
 */

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const OUT = resolve(HERE, '..', 'public');
const SITE = 'https://lopentelopen.nl';
const TODAY = new Date().toISOString().slice(0, 10);

const APP_STORE = 'https://apps.apple.com/nl/app/lopen-te-lopen/id6789545791';
const PLAY = 'https://play.google.com/store/apps/details?id=com.lopentelopen.app';
const LEGAL_PAGES = ['privacy-policy.html', 'voorwaarden.html', 'account-verwijderen.html'];

const AUTHORS = {
  lars: { name: 'Lars', url: `${SITE}/over-ons/` },
  anne: { name: 'Anne', url: `${SITE}/over-ons/` },
};

const SECTION_NAMES = {
  schemas: "Schema's",
  wedstrijden: 'Wedstrijden',
  tools: 'Tools',
  tips: 'Tips',
  verhalen: 'Verhalen',
};

// ── Helpers ────────────────────────────────────────────────────────────────

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function parseFrontMatter(raw, file) {
  const text = raw.replace(/\r\n/g, '\n');
  if (!text.startsWith('---\n')) throw new Error(`${file}: front matter ontbreekt`);
  const end = text.indexOf('\n---\n', 4);
  const meta = {};
  for (const line of text.slice(4, end).split('\n')) {
    const m = line.match(/^([a-zA-Z0-9]+):\s*(.*)$/);
    if (m) meta[m[1]] = m[2].trim();
  }
  return { meta, body: text.slice(end + 5) };
}

/** src/pages/tools/tempo-calculator.html -> /tools/tempo-calculator/ */
function urlPathFor(relPath) {
  const clean = relPath.split(sep).join('/').replace(/\.(html|md)$/, '');
  if (clean === 'index') return '/';
  return '/' + clean.replace(/\/index$/, '') + '/';
}

function formatDate(iso) {
  const months = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${months[m - 1]} ${y}`;
}

function storeLinks(campaign) {
  const tag = campaign || 'website';
  const play = `${PLAY}&referrer=${encodeURIComponent(`utm_source=website&utm_medium=site&utm_campaign=${tag}`)}`;
  return { appStore: APP_STORE, play };
}

function badgesHtml(campaign) {
  const { appStore, play } = storeLinks(campaign);
  return `<div class="badges">
  <a href="${appStore}" rel="noopener"><img src="/assets/badges/app-store-nl.svg" alt="Download in de App Store" width="144" height="48"></a>
  <a class="play" href="${escapeHtml(play)}" rel="noopener"><img src="/assets/badges/google-play-nl.png" alt="Ontdek het op Google Play" width="212" height="63"></a>
</div>`;
}

// ── Markdown (small, predictable subset) ──────────────────────────────────

function slugify(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/<[^>]+>/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function inline(s) {
  return s
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text, href) => {
      const external = /^https?:/.test(href) && !href.startsWith(SITE);
      return `<a href="${href}"${external ? ' rel="noopener"' : ''}>${text}</a>`;
    });
}

function markdown(src) {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;
  const isBlank = l => l.trim() === '';
  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) { i++; continue; }

    // :::ervaring / :::disclaimer containers
    const box = line.match(/^:::(\w+)\s*(.*)$/);
    if (box) {
      const inner = [];
      i++;
      while (i < lines.length && !lines[i].startsWith(':::')) inner.push(lines[i++]);
      i++;
      const title = box[2] ? `<strong>${inline(box[2])}</strong>` : '';
      out.push(`<div class="${box[1]}">${title}${markdown(inner.join('\n'))}</div>`);
      continue;
    }
    // Raw HTML block: runs until a blank line
    if (line.startsWith('<')) {
      const block = [];
      while (i < lines.length && !isBlank(lines[i])) block.push(lines[i++]);
      out.push(block.join('\n'));
      continue;
    }
    const h = line.match(/^(#{2,3})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      out.push(`<h${level} id="${slugify(h[2])}">${inline(h[2])}</h${level}>`);
      i++;
      continue;
    }
    if (line.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++]);
      const cells = r => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const head = cells(rows[0]);
      const body = rows.slice(2).map(cells);
      out.push(`<div class="tabel-scroll"><table><thead><tr>${head.map(c => `<th scope="col">${inline(c)}</th>`).join('')}</tr></thead><tbody>${
        body.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    if (/^- /.test(line) || /^\d+\. /.test(line)) {
      const ordered = /^\d+\. /.test(line);
      const items = [];
      while (i < lines.length && (ordered ? /^\d+\. /.test(lines[i]) : /^- /.test(lines[i]))) {
        items.push(lines[i].replace(/^(- |\d+\. )/, ''));
        i++;
      }
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>${items.map(it => `<li>${inline(it)}</li>`).join('')}</${tag}>`);
      continue;
    }
    if (line.startsWith('> ')) {
      const q = [];
      while (i < lines.length && lines[i].startsWith('> ')) q.push(lines[i++].slice(2));
      out.push(`<blockquote><p>${inline(q.join(' '))}</p></blockquote>`);
      continue;
    }
    const para = [];
    while (i < lines.length && !isBlank(lines[i]) && !/^(#{2,3} |- |\d+\. |\||> |:::|<)/.test(lines[i])) para.push(lines[i++]);
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }
  return out.join('\n');
}

// ── Collect pages ─────────────────────────────────────────────────────────

const pages = [];
for (const kind of ['pages', 'content']) {
  const base = join(HERE, kind);
  for (const file of walk(base)) {
    if (!/\.(html|md)$/.test(file)) continue;
    const rel = relative(base, file);
    const { meta, body } = parseFrontMatter(readFileSync(file, 'utf8'), rel);
    // Without an explicit h1, fall back to the title minus the brand suffix.
    if (!meta.h1 && meta.title) meta.h1 = meta.title.replace(/\s*[|:]\s*Lopen te Lopen$/, '');
    pages.push({ file: rel, kind, isMd: file.endsWith('.md'), meta, body, path: urlPathFor(rel) });
  }
}

const bySection = section => pages
  .filter(p => p.meta.sectie === section && p.path !== `/${section}/`)
  .sort((a, b) => Number(a.meta.volgorde || 99) - Number(b.meta.volgorde || 99) || a.meta.title.localeCompare(b.meta.title));

function sectionList(section, headingLevel = 2) {
  const items = bySection(section);
  return `<ul class="kaartlijst">${items.map(p => `
  <li><a href="${p.path}"><h${headingLevel}>${escapeHtml(p.meta.h1 || p.meta.title)}</h${headingLevel}><p>${escapeHtml(p.meta.kaart || p.meta.description)}</p></a></li>`).join('')}
</ul>`;
}

// ── JSON-LD ───────────────────────────────────────────────────────────────

const ORG = {
  '@type': 'Organization',
  '@id': `${SITE}/#organisatie`,
  name: 'Lopen te Lopen',
  url: `${SITE}/`,
  logo: `${SITE}/assets/logo-v2.png`,
  founder: { '@type': 'Person', name: 'Lars', url: `${SITE}/over-ons/` },
  sameAs: [APP_STORE, PLAY],
};

function breadcrumbs(page) {
  const crumbs = [{ name: 'Home', url: `${SITE}/` }];
  const section = page.meta.sectie;
  if (section && page.path !== `/${section}/`) crumbs.push({ name: SECTION_NAMES[section], url: `${SITE}/${section}/` });
  if (page.path !== '/') crumbs.push({ name: page.meta.h1 || page.meta.title, url: SITE + page.path });
  return crumbs;
}

function jsonLd(page) {
  const graph = [];
  const url = SITE + page.path;
  const schema = page.meta.schema || (page.isMd ? 'article' : 'none');
  if (schema === 'article') {
    const author = AUTHORS[page.meta.auteur || 'lars'];
    graph.push({
      '@type': 'Article',
      headline: page.meta.h1 || page.meta.title,
      description: page.meta.description,
      inLanguage: 'nl-NL',
      mainEntityOfPage: url,
      datePublished: page.meta.gepubliceerd,
      dateModified: page.meta.bijgewerkt || page.meta.gepubliceerd,
      author: { '@type': 'Person', name: author.name, url: author.url },
      publisher: { '@id': ORG['@id'] },
      image: page.meta.afbeelding ? SITE + page.meta.afbeelding : `${SITE}/assets/og-image.jpg`,
    });
  }
  if (schema === 'webapp') {
    graph.push({
      '@type': 'WebApplication',
      name: page.meta.h1 || page.meta.title,
      url,
      applicationCategory: 'SportsApplication',
      operatingSystem: 'Alle browsers',
      inLanguage: 'nl-NL',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
      publisher: { '@id': ORG['@id'] },
    });
  }
  if (page.path !== '/') {
    graph.push(ORG);
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbs(page).map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.url })),
    });
  }
  if (!graph.length) return '';
  return `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })}</script>`;
}

// ── Render ────────────────────────────────────────────────────────────────

const layout = readFileSync(join(HERE, 'layouts', 'basis.html'), 'utf8');
const cssVersion = createHash('sha1').update(readFileSync(join(HERE, 'static', 'assets', 'site.css'))).digest('hex').slice(0, 8);

function breadcrumbHtml(page) {
  const crumbs = breadcrumbs(page);
  return `<nav class="kruimel" aria-label="Kruimelpad"><ol>${crumbs.map((c, i) => i === crumbs.length - 1
    ? `<li aria-current="page">${escapeHtml(c.name)}</li>`
    : `<li><a href="${c.url.replace(SITE, '')}">${escapeHtml(c.name)}</a></li>`).join('')}</ol></nav>`;
}

function sourcesHtml(meta) {
  if (!meta.bronnen) return '';
  const items = meta.bronnen.split(' | ').map(pair => {
    const [text, href] = pair.split(' => ').map(s => s.trim());
    return `<li><a href="${href}" rel="noopener">${escapeHtml(text)}</a></li>`;
  });
  return `<section class="bronnen" aria-labelledby="bronnen"><h2 id="bronnen">Bronnen</h2><ul>${items.join('')}</ul></section>`;
}

function appBlock(meta) {
  return `<aside class="app-blok" aria-labelledby="app-blok">
  <h2 id="app-blok">${escapeHtml(meta.appKop || 'Train met een coach in je oor')}</h2>
  <p>${escapeHtml(meta.appTekst || 'Lopen te Lopen maakt een schema op jouw datum en jouw trainingsdagen, en een Nederlandse stem praat je tijdens het lopen door elke training. Gratis te gebruiken, zonder account.')}</p>
  ${badgesHtml(meta.campagne || slugify(meta.title))}
</aside>`;
}

function articleBody(page) {
  const m = page.meta;
  const author = AUTHORS[m.auteur || 'lars'];
  const dates = m.bijgewerkt && m.bijgewerkt !== m.gepubliceerd
    ? `Bijgewerkt op <time datetime="${m.bijgewerkt}">${formatDate(m.bijgewerkt)}</time>`
    : m.gepubliceerd ? `Gepubliceerd op <time datetime="${m.gepubliceerd}">${formatDate(m.gepubliceerd)}</time>` : '';
  return `<div class="wrap">
${breadcrumbHtml(page)}
<article class="artikel">
  <header class="artikel-kop">
    <h1>${escapeHtml(m.h1 || m.title)}</h1>
    <p class="artikel-meta">Door <a href="/over-ons/">${author.name}</a>${dates ? `. ${dates}` : ''}.</p>
  </header>
  ${m.antwoord ? `<div class="kort-antwoord"><strong>Kort antwoord</strong>${inline(m.antwoord)}</div>` : ''}
  <div class="prose">
${markdown(page.body)}
${sourcesHtml(m)}
  </div>
  ${appBlock(m)}
</article>
</div>`;
}

function expand(html, page) {
  return html
    .replace(/\{\{badges(?::([\w-]+))?\}\}/g, (_, c) => badgesHtml(c || page.meta.campagne || 'home'))
    .replace(/\{\{lijst:(\w+)(?::(\d))?\}\}/g, (_, s, lvl) => sectionList(s, Number(lvl || 2)))
    .replace(/\{\{kruimel\}\}/g, () => breadcrumbHtml(page))
    .replace(/\{\{markdown\}\}([\s\S]*?)\{\{\/markdown\}\}/g, (_, md) => markdown(md));
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
cpSync(join(HERE, 'static'), OUT, { recursive: true });
for (const legal of LEGAL_PAGES) {
  const src = join(REPO, legal);
  if (existsSync(src)) cpSync(src, join(OUT, legal));
  else console.warn(`Let op: ${legal} niet gevonden in de repo-root`);
}

const sitemap = [];
for (const page of pages) {
  const m = page.meta;
  if (!m.title || !m.description) throw new Error(`${page.file}: title en description zijn verplicht`);
  if (m.description.length > 165) console.warn(`Let op: description van ${page.file} is ${m.description.length} tekens (houd < 160)`);
  const body = page.isMd ? articleBody(page) : expand(page.body, page);
  const url = SITE + page.path;
  const scripts = page.meta.script ? `<script src="/assets/${page.meta.script}" defer></script>` : '';
  const html = layout
    .replace('{{title}}', escapeHtml(m.title))
    .replace('{{description}}', escapeHtml(m.description))
    .replace(/\{\{url\}\}/g, url)
    .replace('{{robots}}', m.noindex === 'ja' ? '<meta name="robots" content="noindex">' : '')
    .replace('{{ogType}}', page.isMd ? 'article' : 'website')
    .replace('{{ogTitle}}', escapeHtml(m.ogTitle || m.h1 || m.title))
    .replace('{{description}}', escapeHtml(m.description))
    .replace('{{cssVersion}}', cssVersion)
    .replace('{{head}}', '')
    .replace('{{jsonld}}', () => (page.path === '/' ? '' : jsonLd(page)))
    .replace('{{downloadHref}}', page.path === '/' ? '#download' : '/#download')
    .replace('{{body}}', () => body)
    .replace('{{year}}', TODAY.slice(0, 4))
    .replace('{{scripts}}', scripts)
    .replace(new RegExp(`<a href="(/${(m.sectie || '___')}/)">`), '<a href="$1" aria-current="page">');
  const target = page.path === '/' ? join(OUT, 'index.html') : join(OUT, ...page.path.split('/').filter(Boolean), 'index.html');
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, html);
  if (m.noindex !== 'ja') sitemap.push({ loc: url, lastmod: m.bijgewerkt || m.gepubliceerd || TODAY });
}

writeFileSync(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemap.sort((a, b) => a.loc.localeCompare(b.loc)).map(s => `  <url><loc>${s.loc}</loc><lastmod>${s.lastmod}</lastmod></url>`).join('\n')}
</urlset>
`);

writeFileSync(join(OUT, 'robots.txt'), `# Alle zoekmachines en AI-zoekbots (o.a. Googlebot, Bingbot, OAI-SearchBot,
# ChatGPT-User, PerplexityBot, ClaudeBot) zijn welkom.
User-agent: *
Allow: /
Disallow: /bevestigd.html

Sitemap: ${SITE}/sitemap.xml
`);

console.log(`Klaar: ${pages.length} pagina's naar ${relative(REPO, OUT)}${sep} (sitemap: ${sitemap.length} URL's)`);
