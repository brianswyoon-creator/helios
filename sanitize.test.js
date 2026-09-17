import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeDoc } from '../lib/sanitize.js';

const SAMPLE = `<html><head><meta content="text/html"><style type="text/css">.c1{font-weight:700}.c2{font-style:italic;color:#000}.c9{padding:0}ol{margin:0}</style></head>
<body class="c9 doc-content"><p class="c0 title" id="h.t1"><span class="c4">Objection FAQ</span></p>
<h1 class="c5" id="h.abc"><span class="c1">1. Accuracy &amp; proof</span></h1>
<p class="c0"><span class="c1">Bold claim</span><span> and </span><span class="c2">italic</span> <a class="c7" href="https://www.google.com/url?q=https://example.com/a%3Fb%3D1&amp;sa=D&amp;source=editors">link</a></p>
<p class="c0"><span></span></p>
<h1><span>1. Accuracy &amp; proof</span></h1>
<ul class="lst"><li class="c3 li-bullet-0"><span>One</span></li><li><span onclick="x()">Two</span></li></ul>
<table class="c8"><tr><td class="c6" colspan="2" rowspan="1"><p><span>Cell</span></p></td></tr></table>
<script>alert(1)</script><img src="javascript:alert(1)"><a href="javascript:alert(2)">bad</a><img src="x" onerror="alert(3)">
<p>5 < 6 and <unknown attr="1">kept text</unknown></p></body></html>`;

test('google doc export is cleaned, anchored and safe', () => {
  const r = sanitizeDoc(SAMPLE);
  assert.equal(r.title, 'Objection FAQ');
  assert.deepEqual(r.headings.map((h) => h.id), ['objection-faq', '1-accuracy-and-proof', '1-accuracy-and-proof-2']);
  assert.match(r.html, /<h1 id="1-accuracy-and-proof"><span class="gd-b">1\. Accuracy &amp; proof<\/span><\/h1>/);
  assert.match(r.html, /<span class="gd-i">italic<\/span>/);
  assert.match(r.html, /href="https:\/\/example\.com\/a\?b=1" target="_blank" rel="noopener noreferrer"/);
  assert.match(r.html, /<td colspan="2">/);
  assert.match(r.html, /<div class="gd-table"><table>/);
  assert.match(r.html, /5 &lt; 6 and kept text/);
  for (const bad of ['<script', 'alert(1)', 'javascript:', 'onerror', 'onclick', '<style', 'class="c', 'id="h.']) assert.ok(!r.html.includes(bad), `leaked ${bad}`);
  assert.ok(!/<p>\s*<\/p>/.test(r.html));
});
