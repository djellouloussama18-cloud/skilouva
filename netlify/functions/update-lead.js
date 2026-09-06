/**
 * Netlify Function: update-lead
 *
 * Proxies a progressive lead save to the Google Apps Script Web App via
 * action=update_lead. Forwards session_id and the funnel data payload from the
 * frontend. The data payload uses the frontend's funnelState field names
 * exactly (camelCase); the GAS FIELD_MAP maps them to sheet columns — no
 * translation happens here.
 *
 * Request:
 *   POST /.netlify/functions/update-lead
 *   { session_id, data: { ...funnelState fields... } }
 *
 * Response (GAS passthrough):
 *   { success: true }
 *   or { success: false, error: "..." }
 */

const gas = require('./_gas');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return gas.jsonResponse(405, { error: 'Method not allowed' });
  }

  var payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (err) {
    return gas.jsonResponse(400, { error: 'Invalid JSON body' });
  }

  if (!payload.session_id) {
    return gas.jsonResponse(400, { error: 'Missing session_id' });
  }

  var result = await gas.callGasApp('update_lead', payload);

  if (!result.ok) {
    return gas.jsonResponse(result.statusCode, result.body);
  }

  return gas.jsonResponse(200, result.body);
};
