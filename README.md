# Helios Launch Hub

A password-protected website for the Helios GA launch case study. It reads its data **live from Google Sheets and Google Docs**, so the sheets are the database: edit a cell or a paragraph in Google and the site updates by itself, with no redeploy.

| Tab | What it shows | Live source |
| --- | --- | --- |
| **Pipeline Dashboard** | 7 status tiles ($M), Pipeline Waterfall, Sellable at GA by Industry, Account Scatter, all with toggles | `Target Account List` sheet, tab `TargetAccounts` |
| **CRM** | Account list in 4 views (Target Account Prioritization, By Industry, Wave 1, Wave 2) with search and filters | same sheet |
| **Stakeholder Collaboration** | Interactive 4-week timeline (hover a bar for the detail) and a stakeholder map | `Helios Stakeholder Plan` sheet |
| **Enablement Materials (WIP)** | Launch Materials Center: 9 documents, readable in-site, downloadable, each with a shareable link | 7 Google Docs + AE cards + tracker built from the stakeholder sheet |

There is **no build step and no framework**: static files in `public/`, a few serverless functions in `api/`, and one routing middleware for the password. Nothing to compile means nothing to break on deploy.

---

## 1. One-time setup (about 5 minutes)

### Step 1 · Let the site read your Google files

The site reads Google files the same way an anonymous visitor with the link would. For each file below, open **Share → General access → Anyone with the link → Viewer**. (Fastest: put all nine files in one Drive folder and share the folder that way.)

- Sheets: `Target Account List_vF`, `Helios Stakeholder Plan_vF`
- Docs: “Not at GA” Script, AE & SE Ramp Plan, Launch Narrative & Messaging, Where Helios Fits & Where It Doesn’t, Objection FAQ, Outreach Email Template, Pilot Kit

Visitors never see the Google links' contents directly: the site's own server fetches the files, and the whole site (pages, data and downloads) sits behind the password.

> Until a file is shared, the site keeps working from a built-in snapshot and shows an amber **Snapshot** badge (sheets) or a “can’t be read yet” card (docs). It switches to **Live** by itself once sharing is on.

### Step 2 · Deploy to Vercel from GitHub

1. Push this repository to GitHub (already done if you are reading this on GitHub).
2. Go to **vercel.com → Add New… → Project → Import** this repository.
3. Framework preset: **Other**. Leave *Build Command* and *Output Directory* empty. Click **Deploy**.
4. Every later `git push` to `main` redeploys automatically.

### Step 3 · Password

The site ships with the agreed project password already active (only its SHA-256 hash is stored, in `lib/auth.js`).
To change it, add an environment variable in **Vercel → Project → Settings → Environment Variables** and redeploy:

| Variable | Purpose |
| --- | --- |
| `SITE_PASSWORD` | New password (overrides the default) |
| `SESSION_SECRET` | Any random string. Changing it signs everyone out |
| `ACCOUNTS_SHEET_ID`, `STAKEHOLDER_SHEET_ID` | Point the site at different sheets |
| `CACHE_SECONDS` | How long Vercel may reuse a Google response (default `10`) |

This is an in-app gate, so it works on Vercel's free Hobby plan. (Vercel's own “Password Protection” is a paid add-on; you can switch that on as well, but it is not required.)

---

## 2. How “live” works

```
Google Sheets / Docs ──(export, on demand)──▶ /api/* on Vercel ──(JSON, every 15 s)──▶ browser
```

- The browser asks the site for fresh data **every 15 seconds**, whenever the tab regains focus, and when you click the status pill (top right), which forces an uncached read.
- The API fetches the sheet from Google on demand. Vercel may reuse one response for up to 10 seconds to protect Google's rate limits.
- Net effect: an edit in Google shows up on every open screen in roughly **10–30 seconds**, without a reload. Filters, toggles and scroll position are kept when data refreshes.
- If Google is unreachable, the last good data stays on screen; on a cold start the built-in snapshot is used. **Charts never render empty or broken.**

### What you can safely change in Google

- **Any value** in the `TargetAccounts` tab (status, next steps, $ figures, owners, new rows). Every tile, chart and CRM view recalculates. Columns are found by their **header text**, so you can reorder or add columns; just keep the header names.
- **Any text** in the stakeholder sheet. Tabs are found by their header rows, not by name or position. On the timeline tab keep the `Stakeholder / Task`, `Week 1…4` and `Due` headers, the `HIGH / MEDIUM / LOW URGENCY` band rows and the `↳` task prefix.
- **Anything** in the Google Docs. Headings become the in-page table of contents and shareable section links.

### Where the numbers come from

Nothing is hard-coded. `public/assets/model.js` mirrors the formulas in the sheet's `Dashboard` tab (account bucket, fit, urgency, weighted score, top 20, the de-overlap jitter, in-play pipeline). `npm test` checks these against the values cached in a real export of the sheet, row by row.

---

## 3. Shareable links

Every view has its own address, and links survive the password screen (you land on the exact page and section after signing in).

| Link | Opens |
| --- | --- |
| `/pipeline?addback=EMEA,stalled` | Dashboard with those two filters added back |
| `/crm?view=wave-1&status=Wave%201&industry=FSI&q=harnell` | CRM view with filters and search applied |
| `/stakeholders#timeline`, `/stakeholders#stakeholder-legal-and-privacy` | Timeline, or one stakeholder card opened |
| `/materials/objection-faq` | One document |
| `/materials/objection-faq#<heading>` | A section of a document (hover a heading and click **#** to copy) |
| `/materials/ae-account-cards#crestline-health` | One AE account card |
| `/materials/launch-tracker#risks` | Tracker section (`#milestones`, `#risks`, `#decisions`) |

Downloads: Google Docs as **Word / PDF** (always the latest version, exported on demand), AE cards as **Markdown / HTML**, tracker as **CSV**.

---

## 4. Run it locally

Requires Node 20+. There are no dependencies to install for local preview.

```bash
npm run dev          # http://localhost:3000  (mimics Vercel: rewrites, /api, password gate)
npm test             # calculation + sanitiser tests
npm run snapshot     # refresh the built-in fallback snapshot from the live sheets
```

`AUTH_DISABLED=1 npm run dev` skips the password screen locally.

---

## 5. Project layout

```
public/                 static site (served as-is)
  index.html            app shell: header, 4 tabs
  login.html            password screen
  assets/
    app.js              router + live data stores (polling)
    model.js            all calculations (shared with tests)
    charts.js           SVG charts: waterfall, industry bars, scatter
    views/              pipeline, crm, stakeholders, materials, material
    styles.css          design tokens + layout (Calibri / Carlito, ivory + slate + clay)
  downloads/            original AE account cards file
api/                    Vercel functions: accounts, stakeholders, materials, doc, download, login, logout
lib/
  google.js             fetches Sheets (xlsx) and Docs (html/docx/pdf) exports
  xlsx.js               zero-dependency XLSX reader
  accounts.js           TargetAccounts tab → account records
  stakeholders.js       stakeholder workbook → timeline + map + risks
  sanitize.js           Google Doc HTML → clean, safe HTML with heading anchors
  materials.js          the Launch Materials catalogue (order, titles, doc IDs)
  auth.js               password gate logic
data/                   fallback snapshots + AE card content
middleware.js           runs the password gate in front of every request
vercel.json             clean URLs, SPA rewrites, security headers
```

### Common edits

- **Add or reorder a document:** edit `lib/materials.js` (title, Google Doc ID, order).
- **Use a different sheet:** set `ACCOUNTS_SHEET_ID` / `STAKEHOLDER_SHEET_ID` in Vercel.
- **Colours and type:** the `:root` block at the top of `public/assets/styles.css`.

### Troubleshooting

| Symptom | Fix |
| --- | --- |
| Amber “Snapshot” badge | The sheet is not shared as *Anyone with the link: Viewer*. Fix sharing, then click the badge |
| “This Google Doc can’t be read yet” | Same, for that doc |
| Edit not showing | Wait ~30 s or click the status pill. Google's export can lag an edit by a few seconds |
| Locked out after changing the password | Expected: the old session cookie is invalid. Sign in again |

Design note: Calibri is not a web font, so browsers without it installed fall back to **Carlito**, its metric-compatible open equivalent, loaded from Google Fonts.
