// Zero-dependency XLSX reader (ZIP + SpreadsheetML), enough for Google Sheets exports.
// Reads cached cell values; formulas are ignored. Returns { sheets: [{ name, hidden, rows }] }.
import { inflateRawSync } from 'node:zlib';

function unzip(buf) {
  // Locate End Of Central Directory record (signature 0x06054b50), scanning backwards.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a ZIP/XLSX file');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = new Map();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Corrupt ZIP directory');
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const lNameLen = buf.readUInt16LE(local + 26);
    const lExtraLen = buf.readUInt16LE(local + 28);
    const start = local + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(start, start + csize);
    files.set(name, { method, raw });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return {
    has: (name) => files.has(name),
    text(name) {
      const f = files.get(name);
      if (!f) return null;
      const data = f.method === 0 ? f.raw : inflateRawSync(f.raw);
      return data.toString('utf8');
    },
  };
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function unescapeXml(s) {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|\w+);/g, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENT[e] ?? m;
  });
}
function attr(tag, name) {
  const m = new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(tag);
  return m ? unescapeXml(m[1]) : null;
}
function textRuns(xml) {
  // Concatenate <t> runs, skipping phonetic runs (<rPh>).
  const clean = xml.replace(/<rPh[\s\S]*?<\/rPh>/g, '');
  let out = '';
  for (const m of clean.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g)) out += m[1] ?? '';
  return unescapeXml(out);
}
function colIndex(ref) {
  let n = 0;
  for (const ch of ref) {
    const c = ch.charCodeAt(0);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return n - 1;
}

export function readXlsx(buffer) {
  const zip = unzip(Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer));
  const wb = zip.text('xl/workbook.xml');
  const rels = zip.text('xl/_rels/workbook.xml.rels');
  if (!wb || !rels) throw new Error('Not an XLSX workbook');

  const targets = {};
  for (const m of rels.matchAll(/<Relationship\s([^>]*?)\/?>/g)) {
    const id = attr(m[1], 'Id');
    let t = attr(m[1], 'Target') || '';
    t = t.replace(/^\/?(xl\/)?/, 'xl/');
    targets[id] = t;
  }
  const shared = [];
  const sst = zip.text('xl/sharedStrings.xml');
  if (sst) for (const m of sst.matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)) shared.push(textRuns(m[1] ?? ''));

  const sheets = [];
  for (const m of wb.matchAll(/<sheet\s([^>]*?)\/?>/g)) {
    const name = attr(m[1], 'name');
    const hidden = (attr(m[1], 'state') || 'visible') !== 'visible';
    const xml = zip.text(targets[attr(m[1], 'r:id')]);
    const rows = [];
    if (xml) {
      for (const c of xml.matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = attr(c[1], 'r');
        const body = c[2];
        if (!ref || body == null) continue;
        const type = attr(c[1], 't');
        let value = null;
        if (type === 'inlineStr') value = textRuns(body);
        else {
          const v = /<v>([\s\S]*?)<\/v>/.exec(body);
          if (!v) continue;
          const rawV = unescapeXml(v[1]);
          if (type === 's') value = shared[Number(rawV)] ?? '';
          else if (type === 'str' || type === 'e') value = rawV;
          else if (type === 'b') value = rawV === '1';
          else { const num = Number(rawV); value = Number.isFinite(num) ? num : rawV; }
        }
        if (value === '' || value == null) continue;
        const r = parseInt(ref.replace(/^[A-Z]+/, ''), 10) - 1;
        const col = colIndex(ref);
        (rows[r] ||= [])[col] = value;
      }
    }
    // Densify: no holes, so callers can map/iterate safely.
    const dense = [];
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r] || [];
      const out = [];
      for (let i = 0; i < row.length; i++) out.push(row[i] ?? null);
      dense.push(out);
    }
    sheets.push({ name, hidden, rows: dense });
  }
  return { sheets };
}
