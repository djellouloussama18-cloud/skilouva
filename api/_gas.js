/**
 * Vercel Function shared helper: _gas
 *
 * Central helper used by all SKILLOVA Vercel backend functions to call the
 * single Google Apps Script Web App with the shared-secret auth.
 * (Filename starts with an underscore, so Vercel does not expose it as a route.)
 *
 * Environment variables required (server-side only — never exposed to client):
 *   GAS_WEBAPP_URL    -> deployed Google Apps Script Web App URL
 *   GAS_SHARED_SECRET -> must EXACTLY match the Script Property GAS_SHARED_SECRET
 *
 * POSTs a JSON body to the Web App:
 *   { action, session_id?, data?, shared_secret }
 *
 * Never logs or returns the shared secret value.
 */

async function callGasApp(action, payload) {
  var gasUrl = process.env.GAS_WEBAPP_URL;
  var secret = process.env.GAS_SHARED_SECRET;

  if (!gasUrl) {
    return { ok: false, statusCode: 500, body: { error: 'GAS_WEBAPP_URL environment variable is not configured' } };
  }
  if (!secret) {
    return { ok: false, statusCode: 500, body: { error: 'GAS_SHARED_SECRET environment variable is not configured' } };
  }

  var bodyOut = { action: action, shared_secret: secret };
  if (payload && payload.session_id !== undefined) bodyOut.session_id = payload.session_id;
  if (payload && payload.data !== undefined) bodyOut.data = payload.data;

  var controller = new AbortController();
  var timeoutId = setTimeout(function () { controller.abort(); }, 10000);

  try {
    var res = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyOut),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    var text = await res.text();
    var json;
    try {
      json = JSON.parse(text);
    } catch (err) {
      json = { success: false, error: 'BAD_GAS_RESPONSE' };
    }

    if (!res.ok) {
      return { ok: false, statusCode: 502, body: { error: 'Google Apps Script returned an error: ' + text } };
    }
    return { ok: true, statusCode: 200, body: json };
  } catch (err) {
    clearTimeout(timeoutId);
    var message = err.name === 'AbortError'
      ? 'Google Apps Script request timed out'
      : 'Failed to reach Google Apps Script: ' + err.message;
    return { ok: false, statusCode: 502, body: { error: message } };
  }
}

/*
 * jsonResponse — Vercel version. Writes the response directly to the
 * res object (instead of returning a Netlify-style { statusCode, headers, body }).
 */
function jsonResponse(res, statusCode, body) {
  res.status(statusCode).setHeader('Cache-Control', 'no-store').json(body);
}

module.exports = { callGasApp: callGasApp, jsonResponse: jsonResponse };