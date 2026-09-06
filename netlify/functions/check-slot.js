/**
 * Netlify Function: check-slot
 *
 * Proxies a single slot-availability check to the Google Apps Script Web App
 * via action=check_slot. Forwards date and time.
 *
 * Request:
 *   POST /.netlify/functions/check-slot
 *   { data: { date: "YYYY-MM-DD", time: "HH:MM" } }
 *
 * Response (GAS passthrough):
 *   { success: true, available: true|false }
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

  var data = payload.data || {};
  if (!data.date || !data.time) {
    return gas.jsonResponse(400, { error: 'Missing date or time' });
  }

  var result = await gas.callGasApp('check_slot', payload);

  if (!result.ok) {
    return gas.jsonResponse(result.statusCode, result.body);
  }

  return gas.jsonResponse(200, result.body);
};
