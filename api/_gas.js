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
 * Timeout & retry (Hobby-safe):
 *   - Single attempt abort: GAS_TIMEOUT_MS (default 25000; was 10000). This is
 *     the "proxy abort = 25 seconds" requested.
 *   - callGasAppWithRetry: exactly ONE retry, opt-in (update-lead,
 *     confirm-booking only), ONLY when the first attempt timed out or GAS
 *     returned a `{ retryable: true }` body, after a short pause
 *     GAS_RETRY_DELAY_MS (~500 ms). check-duplicate-phone never retries.
 *   - The two attempts share a total deadline GAS_TOTAL_BUDGET_MS (default
 *     28000), UNDER the vercel.json maxDuration (30) for all three api
 *     functions, so a retry can never be killed mid-flight by the platform.
 *
 * Never logs or returns the shared secret value.
 */

var GAS_TIMEOUT_MS = Number(process.env.GAS_TIMEOUT_MS) || 25000;
var GAS_TOTAL_BUDGET_MS = Number(process.env.GAS_TOTAL_BUDGET_MS) || 28000;
var GAS_RETRY_DELAY_MS = Number(process.env.GAS_RETRY_DELAY_MS) || 500;

function buildRequestBody(action, payload) {
  var gasUrl = process.env.GAS_WEBAPP_URL;
  var secret = process.env.GAS_SHARED_SECRET;

  if (!gasUrl) {
    return { error: { ok: false, statusCode: 500, body: { error: 'GAS_WEBAPP_URL environment variable is not configured' } } };
  }
  if (!secret) {
    return { error: { ok: false, statusCode: 500, body: { error: 'GAS_SHARED_SECRET environment variable is not configured' } } };
  }

  var bodyOut = { action: action, shared_secret: secret };
  if (payload && payload.session_id !== undefined) bodyOut.session_id = payload.session_id;
  if (payload && payload.data !== undefined) bodyOut.data = payload.data;
  return { gasUrl: gasUrl, bodyOut: bodyOut };
}

function postOnce(gasUrl, bodyOut, timeoutMs) {
  var controller = new AbortController();
  var timeoutId = setTimeout(function () { controller.abort(); }, timeoutMs);

  return fetch(gasUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bodyOut),
    signal: controller.signal,
  })
    .then(function (res) {
      clearTimeout(timeoutId);
      return res.text().then(function (text) {
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
      });
    })
    .catch(function (err) {
      clearTimeout(timeoutId);
      var aborted = err && (err.name === 'AbortError' || err.name === 'TimeoutError');
      var message = aborted
        ? 'Google Apps Script request timed out'
        : 'Failed to reach Google Apps Script: ' + (err && err.message ? err.message : String(err));
      return { ok: false, statusCode: 502, timedOut: aborted, body: { error: message } };
    });
}

async function callGasApp(action, payload) {
  var req = buildRequestBody(action, payload);
  if (req.error) return req.error;
  return postOnce(req.gasUrl, req.bodyOut, GAS_TIMEOUT_MS);
}

async function callGasAppWithRetry(action, payload) {
  var req = buildRequestBody(action, payload);
  if (req.error) return req.error;

  var startedAt = Date.now();
  var first = await postOnce(req.gasUrl, req.bodyOut, GAS_TIMEOUT_MS);
  if (first.ok) return first;

  var retryable = first.timedOut === true || (first.body && first.body.retryable === true);
  if (!retryable) return first;

  var elapsed = Date.now() - startedAt;
  var remaining = GAS_TOTAL_BUDGET_MS - elapsed - GAS_RETRY_DELAY_MS;
  if (remaining <= 1000) return first;

  await new Promise(function (resolve) { setTimeout(resolve, GAS_RETRY_DELAY_MS); });
  return postOnce(req.gasUrl, req.bodyOut, Math.min(GAS_TIMEOUT_MS, remaining));
}

/*
 * jsonResponse — Vercel version. Writes the response directly to the
 * res object (instead of returning a Netlify-style { statusCode, headers, body }).
 */
function jsonResponse(res, statusCode, body) {
  res.status(statusCode).setHeader('Cache-Control', 'no-store').json(body);
}

module.exports = { callGasApp: callGasApp, callGasAppWithRetry: callGasAppWithRetry, jsonResponse: jsonResponse };