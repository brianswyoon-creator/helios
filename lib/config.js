// Central configuration. Every value can be overridden with a Vercel environment variable.
export const ACCOUNTS_SHEET_ID = process.env.ACCOUNTS_SHEET_ID || '1zu2eIaj6M4w65MPN6kSnnBcDRfUNgb59yYreXcfs8Yk';
export const STAKEHOLDER_SHEET_ID = process.env.STAKEHOLDER_SHEET_ID || '1cT9X4r2FzvuqfeWYpl2zaACtUBWe8dbOWHIC90NssKc';
// Seconds the CDN may reuse an API response before asking Google again.
export const CACHE_SECONDS = Number(process.env.CACHE_SECONDS || 10);
export const FETCH_TIMEOUT_MS = Number(process.env.FETCH_TIMEOUT_MS || 12000);

export const sheetUrl = (id) => `https://docs.google.com/spreadsheets/d/${id}/edit`;
export const docUrl = (id) => `https://docs.google.com/document/d/${id}/edit`;
