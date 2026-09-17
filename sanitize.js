// Turn a Google Docs HTML export into clean, safe, theme-able HTML.
// Output is rebuilt tag by tag from an allow-list; nothing from the source is passed through raw.
const BLOCK = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'blockquote', 'pre', 'hr', 'br']);
const INLINE = new Set(['a', 'strong', 'b', 'em', 'i', 'u', 's', 'sup', 'sub', 'code', 'span', 'img']);
const VOID = new Set(['hr', 'br', 'img']);
const DROP_WITH_CONTENT = /<(script|style|head|title|noscript|iframe|object|embed|svg|math|form|template)\b[\s\S]*?<\/\1\s*>/gi;

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ''; }
  return ENT[e.toLowerCase()] ?? m;
});
export const slugify = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

function attrs(raw) {
  const out = {};
  for (const m of raw.matchAll(/([a-zA-Z_:][-\w:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) out[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? '');
  return out;
}
function safeHref(href) {
  let url = (href || '').trim();
  const redirect = /^https?:\/\/(?:www\.)?google\.com\/url\?(.*)$/i.exec(url);
  if (redirect) { const q = new URLSearchParams(redirect[1]).get('q'); if (q) url = q; }
  if (/^#/.test(url)) return url;
  return /^(https?:|mailto:)/i.test(url) ? url : null;
}
function safeImg(src) {
  const s = (src || '').trim();
  return /^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(s) || /^https:\/\/[\w.-]*(googleusercontent|google)\.com\//i.test(s) ? s : null;
}
// Google encodes bold / italic / underline as CSS classes (.c3{font-weight:700}); recover them.
function classStyles(html) {
  const map = {};
  for (const block of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
    for (const rule of block[1].matchAll(/\.([\w-]+)\s*\{([^}]*)\}/g)) {
      const css = rule[2];
      const f = (map[rule[1]] ||= {});
      if (/font-weight\s*:\s*(700|800|900|bold)/i.test(css)) f.b = true;
      if (/font-style\s*:\s*italic/i.test(css)) f.i = true;
      if (/text-decoration[^;]*underline/i.test(css)) f.u = true;
      if (/text-decoration[^;]*line-through/i.test(css)) f.s = true;
    }
  }
  return map;
}

export function sanitizeDoc(html) {
  const styles = classStyles(html);
  const body = (/<body[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? html).replace(DROP_WITH_CONTENT, '').replace(/<!--[\s\S]*?-->/g, '');
  let out = '';
  const stack = [];
  const headings = [];
  const used = new Map();
  let heading = null; // { level, start }
  let title = '';
  let titleOpen = false; // Google's document title is <p class="title">; we promote it to <h1>
  const closeTo = (tag) => {
    const at = stack.lastIndexOf(tag);
    if (at < 0) return;
    while (stack.length > at) out += `</${stack.pop()}>`;
  };
  for (const tok of body.matchAll(/<\/?([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>|([^<]+)|</g)) {
    if (tok[3] != null) { const text = decode(tok[3]); if (heading) heading.text += text; out += esc(text); continue; }
    if (!tok[1]) { out += '&lt;'; continue; }
    let tag = tok[1].toLowerCase();
    const closing = tok[0][1] === '/';
    const a = closing ? {} : attrs(tok[2] || '');
    const cls = (a.class || '').split(/\s+/).filter(Boolean);
    if (tag === 'b') tag = 'strong';
    if (tag === 'i') tag = 'em';
    if (tag === 'div' || tag === 'section' || tag === 'article') continue;
    if (!BLOCK.has(tag) && !INLINE.has(tag)) continue;

    if (closing) {
      if (tag === 'p' && titleOpen) { tag = 'h1'; titleOpen = false; }
      if (tag === 'span') { const top = stack[stack.length - 1]; if (top && top.startsWith('span')) out += `</${stack.pop().split(' ')[0]}>`; continue; }
      if (/^h[1-6]$/.test(tag) && heading) {
        const text = heading.text.replace(/\s+/g, ' ').trim();
        if (text) {
          let id = slugify(text) || 'section';
          const n = (used.get(id) || 0) + 1; used.set(id, n);
          if (n > 1) id = `${id}-${n}`;
          out = out.slice(0, heading.at) + out.slice(heading.at).replace(`<${tag}>`, `<${tag} id="${id}">`);
          headings.push({ id, text, level: Number(tag[1]) });
          if (!title && heading.isTitle) title = text;
        }
        heading = null;
      }
      closeTo(tag);
      continue;
    }

    if (tag === 'span') {
      const f = cls.reduce((acc, c) => Object.assign(acc, styles[c] || {}), {});
      const names = Object.keys(f).filter((k) => f[k]).map((k) => `gd-${k}`);
      out += names.length ? `<span class="${names.join(' ')}">` : '<span>';
      stack.push('span');
      continue;
    }
    const isTitle = tag === 'p' && cls.includes('title');
    if (isTitle) { tag = 'h1'; titleOpen = true; }
    if (tag === 'p' && cls.includes('subtitle')) { out += '<p class="gd-subtitle">'; stack.push('p'); continue; }
    if (tag === 'a') {
      const href = safeHref(a.href);
      if (!href) { if (a.id || a.name) continue; out += '<span>'; stack.push('span'); continue; }
      out += href.startsWith('#') ? `<a href="${esc(href)}">` : `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">`;
      stack.push('a');
      continue;
    }
    if (tag === 'img') { const src = safeImg(a.src); if (src) out += `<img src="${esc(src)}" alt="${esc(a.alt || '')}" loading="lazy">`; continue; }
    if (tag === 'td' || tag === 'th') {
      const span = ['colspan', 'rowspan'].map((k) => (/^\d{1,3}$/.test(a[k] || '') && a[k] !== '1' ? ` ${k}="${a[k]}"` : '')).join('');
      out += `<${tag}${span}>`; stack.push(tag); continue;
    }
    if (tag === 'ol' && /^\d+$/.test(a.start || '') && a.start !== '1') { out += `<ol start="${a.start}">`; stack.push('ol'); continue; }
    if (VOID.has(tag)) { out += `<${tag}>`; continue; }
    if (/^h[1-6]$/.test(tag)) heading = { at: out.length, text: '', isTitle };
    out += `<${tag}>`;
    stack.push(tag);
  }
  while (stack.length) out += `</${stack.pop()}>`;
  // Tidy: drop empty paragraphs/spans that Google uses as spacers, wrap tables for horizontal scroll.
  out = out.replace(/<span>\s*<\/span>/g, '').replace(/<p>(?:\s|&nbsp;| |<span>|<\/span>)*<\/p>/g, '')
    .replace(/<table>/g, '<div class="gd-table"><table>').replace(/<\/table>/g, '</table></div>');
  const text = out.replace(/<[^>]+>/g, ' ');
  return { html: out, headings, title, words: text.split(/\s+/).filter(Boolean).length };
}
