import dns from 'dns';

// Force IPv4 resolution first so Apps Script 302 redirects do not stall on broken IPv6 routes.
dns.setDefaultResultOrder('ipv4first');

export const GOOGLE_SCRIPT_URL =
  process.env.GOOGLE_SCRIPT_URL ||
  'https://script.google.com/macros/s/AKfycbwiFiCJpIpfPags4Wh1Qf_0Wk7xA4rlQSPomN8kQ-_nHw3YxR5weYNK50qpEXCesZ_zHw/exec';

/**
 * Forwards a raw JSON registration body to the deployed Google Apps Script Web App.
 * @param {string} rawBody
 * @returns {Promise<{ status: number, data: unknown }>}
 */
export async function forwardRegistration(rawBody) {
  try {
    const upstream = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: rawBody || '{}',
      signal: AbortSignal.timeout(15000),
    });

    const text = await upstream.text();
    try {
      return { status: upstream.ok ? 200 : upstream.status, data: JSON.parse(text) };
    } catch {
      return {
        status: 502,
        data: { ok: false, error: `Unexpected upstream response (HTTP ${upstream.status}).` },
      };
    }
  } catch (err) {
    return {
      status: 502,
      data: { ok: false, error: err instanceof Error ? err.message : String(err) },
    };
  }
}

