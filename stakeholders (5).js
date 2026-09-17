// Normalise the "Helios Stakeholder Plan" workbook. Tabs are found by their header row,
// not by name or position, so renaming or re-ordering tabs in Google Sheets is safe.
const str = (v) => (v == null ? '' : String(v).replace(/\r/g, '').trim());
const key = (s) => str(s).toLowerCase().replace(/\s+/g, ' ');
const WEEK = /^week\s*(\d+)/i;

function findHeader(sheet, tests) {
  for (let r = 0; r < Math.min(sheet.rows.length, 20); r++) {
    const row = (sheet.rows[r] || []).map(str);
    const cols = {};
    for (const [name, re] of Object.entries(tests)) {
      const i = row.findIndex((c) => re.test(c));
      if (i >= 0) cols[name] = i;
    }
    if (Object.keys(cols).length === Object.keys(tests).length) return { r, cols, row };
  }
  return null;
}

const bullets = (text) => str(text).split(/\n|\s-\s(?=[A-Z])/).map((s) => s.replace(/^[-•\s\\]+/, '').trim()).filter(Boolean);
// The sheet's task label is a shortened copy of the full text; mark it when it was cut mid-phrase.
const taskLabel = (raw, detail) => {
  if (!raw) return detail;
  if (detail.startsWith(raw) && detail.length > raw.length && !/^(:|\s\()/.test(detail.slice(raw.length))) return `${raw}…`;
  return raw;
};

function parseMap(sheet) {
  const h = findHeader(sheet, { name: /^stakeholder$/i, team: /^team$/i, needs: /^what needs to happen/i, deadline: /^deadline$/i, decisions: /^decisions owned/i, urgency: /^urgency$/i });
  if (!h) return null;
  const out = [];
  for (let r = h.r + 1; r < sheet.rows.length; r++) {
    const row = sheet.rows[r] || [];
    const name = str(row[h.cols.name]);
    if (!name) continue;
    out.push({ name, team: str(row[h.cols.team]), needs: str(row[h.cols.needs]), deadline: str(row[h.cols.deadline]), decisions: bullets(row[h.cols.decisions]), urgency: str(row[h.cols.urgency]) });
  }
  return out;
}

function parseRisks(sheet) {
  const h = findHeader(sheet, { name: /^stakeholder$/i, pushback: /^pushback$/i, resolution: /^resolution$/i, risk: /^risk$/i });
  if (!h) return null;
  const neededBy = h.row.findIndex((c) => /^needed by$/i.test(c));
  const out = [];
  for (let r = h.r + 1; r < sheet.rows.length; r++) {
    const row = sheet.rows[r] || [];
    const name = str(row[h.cols.name]);
    if (!name) continue;
    out.push({ name, pushback: str(row[h.cols.pushback]), resolution: str(row[h.cols.resolution]), neededBy: neededBy >= 0 ? str(row[neededBy]) : '', risk: str(row[h.cols.risk]) });
  }
  return out;
}

function parseTimeline(sheet) {
  const h = findHeader(sheet, { label: /^stakeholder\s*\/\s*task$/i, w1: WEEK });
  if (!h) return null;
  const weeks = [];
  h.row.forEach((c, i) => { const m = WEEK.exec(c); if (m) weeks.push({ n: Number(m[1]), col: i, label: c }); });
  const dueCol = h.row.findIndex((c) => /^due$/i.test(c));
  const groups = [];
  let urgency = '';
  let current = null;
  for (let r = h.r + 1; r < sheet.rows.length; r++) {
    const row = sheet.rows[r] || [];
    const label = str(row[h.cols.label]);
    if (!label) continue;
    const band = /^(high|medium|low)\s+urgency$/i.exec(label);
    if (band) { urgency = band[1][0].toUpperCase() + band[1].slice(1).toLowerCase(); continue; }
    if (/^↳|^[-–>]/.test(label)) {
      if (!current) continue;
      const filled = weeks.filter((w) => str(row[w.col]));
      const due = dueCol >= 0 ? str(row[dueCol]) : '';
      const dueN = Number((/(\d+)/.exec(due) || [])[1]) || null;
      const start = filled.length ? filled[0].n : dueN;
      const end = filled.length ? filled[filled.length - 1].n : dueN;
      if (!start) continue;
      const raw = label.replace(/^[↳\-–>\s]+/, '').trim();
      const detail = filled.length ? str(row[filled[0].col]) : raw;
      current.tasks.push({ label: taskLabel(raw, detail), detail, start, end, due: due || `W${end}` });
    } else {
      const [name, rest] = label.split(/\s+·\s+/);
      current = { name: name.trim(), urgency, decisionsLine: (rest || '').replace(/^decisions:\s*/i, '').trim(), tasks: [] };
      groups.push(current);
    }
  }
  return { weeks: weeks.map(({ n, label }) => ({ n, label })), groups };
}

export function parseStakeholders(workbook) {
  let map = null, risks = null, timeline = null;
  for (const sheet of workbook.sheets) {
    timeline ||= parseTimeline(sheet);
    const asMap = !map && parseMap(sheet);
    if (asMap) { map = asMap; continue; }
    risks ||= parseRisks(sheet);
  }
  if (!timeline && !map) throw new Error('Could not find the stakeholder timeline or stakeholder list tabs.');
  const names = [];
  const index = new Map();
  const upsert = (name) => {
    const k = key(name);
    if (!index.has(k)) { index.set(k, { name: str(name), team: '', needs: '', deadline: '', decisions: [], urgency: '', pushback: '', resolution: '', neededBy: '', risk: '', tasks: [] }); names.push(k); }
    return index.get(k);
  };
  for (const g of timeline?.groups || []) Object.assign(upsert(g.name), { urgency: g.urgency, tasks: g.tasks, decisions: g.decisionsLine ? g.decisionsLine.split(/[,;]\s*/).filter(Boolean) : [] });
  for (const m of map || []) { const s = upsert(m.name); Object.assign(s, { team: m.team, needs: m.needs, deadline: m.deadline, urgency: m.urgency || s.urgency }); if (m.decisions.length) s.decisions = m.decisions; }
  for (const x of risks || []) Object.assign(upsert(x.name), { pushback: x.pushback, resolution: x.resolution, neededBy: x.neededBy, risk: x.risk });
  const weeks = timeline?.weeks?.length ? timeline.weeks : [1, 2, 3, 4].map((n) => ({ n, label: `Week ${n}` }));
  return { weeks, stakeholders: names.map((k) => index.get(k)) };
}
