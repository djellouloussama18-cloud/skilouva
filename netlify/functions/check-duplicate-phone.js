/**
 * Netlify Function: check-duplicate-phone
 *
 * Proxies a duplicate-phone check to the Google Apps Script Web App via
 * action=check_duplicate_phone. Forwards phone_number.
 *
 * Request:
 *   POST /.netlify/functions/check-duplicate-phone
 *   { data: { phone: "055... / +213..." } }
 *
 * Response (GAS passthrough):
 *   { success: true, isDuplicate: true|false }
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
  if (!data.phone) {
    return gas.jsonResponse(400, { error: 'Missing phone' });
  }

  var result = await gas.callGasApp('check_duplicate_phone', payload);

  if (!result.ok) {
    return gas.jsonResponse(result.statusCode, result.body);
  }

  return gas.jsonResponse(200, result.body);
};
