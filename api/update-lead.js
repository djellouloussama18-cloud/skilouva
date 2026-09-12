/**
 * Vercel Function: update-lead
 *
 * Proxies a progressive lead save to the Google Apps Script Web App via
 * action=update_lead. Forwards session_id and the funnel data payload from the
 * frontend. The data payload uses the frontend's funnelState field names
 * exactly (camelCase); the GAS FIELD_MAP maps them to sheet columns — no
 * translation happens here.
 *
 * Request:
 *   POST /api/update-lead
 *   { session_id, data: { ...funnelState fields... } }
 *
 * Response (GAS passthrough):
 *   { success: true }
 *   or { success: false, error: "..." }
 */

const gas = require('./_gas');

module.exports = async function (req, res) {
  if (req.method !== 'POST') {
    return gas.jsonResponse(res, 405, { error: 'Method not allowed' });
  }

  var payload;
  if (req.body === undefined || req.body === null) {
    payload = {};
  } else if (typeof req.body === 'object') {
    payload = req.body;
  } else {
    return gas.jsonResponse(res, 400, { error: 'Invalid JSON body' });
  }

  if (!payload.session_id) {
    return gas.jsonResponse(res, 400, { error: 'Missing session_id' });
  }

  var result = await gas.callGasApp('update_lead', payload);

  if (!result.ok) {
    return gas.jsonResponse(res, result.statusCode, result.body);
  }

  return gas.jsonResponse(res, 200, result.body);
};