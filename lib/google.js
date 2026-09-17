// Fetch live exports from Google. Files must be shared "Anyone with the link: Viewer".
import { FETCH_TIMEOUT_MS } from './config.js';

export class GoogleAccessError extends Error {}

// Local development only: HELIOS_FIXTURES=<dir> reads <dir>/<fileId>.xlsx|.html instead of calling Google.
async function fixture(id, ext) {
  const dir = process.env.HELIOS_FIXTURES;
  if (!dir) return null;
  const { readFile } = await import('node:fs/promises');
  try { return await readFile(`${dir}/${id}.${ext}`); } catch { throw new GoogleAccessError(`No fixture for ${id}.${ext}`); }
}

async function get(url, accept) {
  const res = await fetch(url, {
    redirect: 'follow',
    cache: 'no-store',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { 'user-agent': 'helios-launch-hub/1.0' },
  });
  const type = res.headers.get('content-type') || '';
  // A private file redirects to a Google sign-in page (HTML) instead of the export.
  if (!res.ok || res.url.includes('accounts.google.com') || (accept && !type.includes(accept))) {
    throw new GoogleAccessError(
      res.status === 404 ? 'File not found' :
      `Google did not return the file (HTTP ${res.status}). Check it is shared as "Anyone with the link: Viewer".`);
  }
  return res;
}

export async function fetchSheetXlsx(id) {
  const local = await fixture(id, 'xlsx');
  if (local) return local;
  const res = await get(`https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`, 'spreadsheetml');
  return Buffer.from(await res.arrayBuffer());
}

export async function fetchDocHtml(id) {
  const local = await fixture(id, 'html');
  if (local) return local.toString('utf8');
  const res = await get(`https://docs.google.com/document/d/${id}/export?format=html`, 'text/html');
  return res.text();
}

const DOWNLOAD_TYPES = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
};
export async function fetchDocDownload(id, format) {
  if (!DOWNLOAD_TYPES[format]) throw new Error('Unsupported format');
  const res = await get(`https://docs.google.com/document/d/${id}/export?format=${format}`, null);
  const type = res.headers.get('content-type') || '';
  if (type.includes('text/html')) throw new GoogleAccessError('Google returned a sign-in page instead of the file.');
  return { body: Buffer.from(await res.arrayBuffer()), type: DOWNLOAD_TYPES[format] };
}
