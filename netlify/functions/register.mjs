import { forwardRegistration } from '../../register-proxy.mjs';

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

/**
 * Netlify Function handler forwarding POST /api/register submissions to Google Sheets.
 */
export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: JSON_HEADERS,
      body: JSON.stringify({ ok: false, error: 'Method not allowed' }),
    };
  }

  const result = await forwardRegistration(event.body || '{}');
  return {
    statusCode: result.status,
    headers: JSON_HEADERS,
    body: JSON.stringify(result.data),
  };
}
