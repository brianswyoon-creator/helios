// Minimal PDF writer (no dependencies): Letter pages, Helvetica / Helvetica-Bold, word wrapping, bullets.
// Enough for a clean one-account PDF; not a general document engine.
const PAGE = { w: 612, h: 792, margin: 54 };
// Helvetica advance widths (per 1000 em) for ASCII 32–126, from the standard AFM.
const W = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
// Characters outside ASCII that WinAnsiEncoding can show, with their byte and width.
const EXTRA = { '—': [0x97, 1000], '–': [0x96, 556], '’': [0x92, 222], '‘': [0x91, 222], '“': [0x93, 333], '”': [0x94, 333], '•': [0x95, 350], '÷': [0xf7, 584], '×': [0xd7, 584], '…': [0x85, 1000], ' ': [0x20, 278], '·': [0xb7, 278], '®': [0xae, 737], '©': [0xa9, 737], '→': [0x2d, 333], 'é': [0xe9, 556], 'ü': [0xfc, 556] };

function encode(text) {
  const bytes = [];
  let width = 0;
  for (const ch of String(text)) {
    const c = ch.codePointAt(0);
    if (c >= 32 && c <= 126) { bytes.push(c); width += W[c - 32]; }
    else if (EXTRA[ch]) { bytes.push(EXTRA[ch][0]); width += EXTRA[ch][1]; }
    else if (c === 9 || c === 10 || c === 13) { bytes.push(32); width += 278; }
    else { bytes.push(63); width += 556; }
  }
  return { bytes, width };
}
const textWidth = (text, size, bold) => (encode(text).width / 1000) * size * (bold ? 1.04 : 1);
const pdfString = (bytes) => '(' + bytes.map((b) => (b === 40 || b === 41 || b === 92 ? `\\${String.fromCharCode(b)}` : b < 32 || b > 126 ? `\\${b.toString(8).padStart(3, '0')}` : String.fromCharCode(b))).join('') + ')';

function wrap(text, size, bold, maxWidth) {
  const lines = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (textWidth(next, size, bold) <= maxWidth || !line) line = next; else { lines.push(line); line = word; }
    }
    lines.push(line);
  }
  return lines;
}

/** blocks: [{ type: 'title'|'h2'|'p'|'li'|'meta'|'rule'|'gap', text }] */
export function buildPdf(blocks, { title = 'Document' } = {}) {
  const pages = [];
  let ops = [], y = PAGE.h - PAGE.margin;
  const width = PAGE.w - 2 * PAGE.margin;
  const newPage = () => { if (ops.length) pages.push(ops); ops = []; y = PAGE.h - PAGE.margin; };
  const need = (h) => { if (y - h < PAGE.margin) newPage(); };
  const line = (text, { size = 10.5, bold = false, x = PAGE.margin, color = '0 0 0', lead = 1.35 } = {}) => {
    const { bytes } = encode(text);
    need(size * lead);
    y -= size * lead;
    ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${color} rg ${x.toFixed(1)} ${y.toFixed(1)} Td ${pdfString(bytes)} Tj ET`);
  };
  const para = (text, opts = {}, indent = 0) => wrap(text, opts.size || 10.5, opts.bold, width - indent).forEach((l) => line(l, { ...opts, x: PAGE.margin + indent }));
  for (const b of blocks) {
    if (b.type === 'title') { y -= 4; para(b.text, { size: 20, bold: true }); y -= 6; }
    else if (b.type === 'h2') { need(30); y -= 10; para(b.text.toUpperCase(), { size: 9, bold: true, color: '0.31 0.31 0.29' }); y -= 2; }
    else if (b.type === 'meta') para(b.text, { size: 10, color: '0.31 0.31 0.29' });
    else if (b.type === 'li') { const lines = wrap(b.text, 10.5, false, width - 16); need(10.5 * 1.35); lines.forEach((l, i) => { line(l, { x: PAGE.margin + 16 }); if (i === 0) ops.push(`BT /F1 10.5 Tf 0 0 0 rg ${(PAGE.margin + 4).toFixed(1)} ${y.toFixed(1)} Td (\\225) Tj ET`); }); }
    else if (b.type === 'rule') { need(14); y -= 8; ops.push(`0.81 0.80 0.75 RG 0.6 w ${PAGE.margin} ${y.toFixed(1)} m ${(PAGE.w - PAGE.margin).toFixed(1)} ${y.toFixed(1)} l S`); y -= 4; }
    else if (b.type === 'gap') y -= b.size || 8;
    else para(b.text || '');
  }
  newPage();

  // Assemble objects: 1 catalog, 2 pages, 3 F1, 4 F2, then per page: page object + content stream.
  const objs = [];
  const add = (body) => { objs.push(body); return objs.length; };
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add('PAGES');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const pageIds = [];
  for (const p of pages) {
    const stream = p.join('\n');
    const len = Buffer.byteLength(stream, 'latin1');
    const contentId = add(`<< /Length ${len} >>\nstream\n${stream}\nendstream`);
    pageIds.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.w} ${PAGE.h}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`));
  }
  objs[1] = `<< /Type /Pages /Kids [${pageIds.map((i) => `${i} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  const infoId = add(`<< /Title ${pdfString(encode(title).bytes)} /Producer (Helios Launch Hub) >>`);

  let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets = [];
  objs.forEach((body, i) => { offsets.push(Buffer.byteLength(out, 'latin1')); out += `${i + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info ${infoId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}
