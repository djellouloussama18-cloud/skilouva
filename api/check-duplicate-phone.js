/**
 * Vercel Function: check-duplicate-phone
 *
 * Proxies a duplicate-phone check to the Google Apps Script Web App via
 * action=check_duplicate_phone. Forwards phone_number.
 *
 * Request:
 *   POST /api/check-duplicate-phone
 *   { data: { phone: "055... / +213..." } }
 *
 * Response (GAS passthrough):
 *   { success: true, isDuplicate: true|false }
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

  var data = payload.data || {};
  if (!data.phone) {
    return gas.jsonResponse(res, 400, { error: 'Missing phone' });
  }

  var result = await gas.callGasApp('check_duplicate_phone', payload);

  if (!result.ok) {
    return gas.jsonResponse(res, result.statusCode, result.body);
  }

  return gas.jsonResponse(res, 200, result.body);
};