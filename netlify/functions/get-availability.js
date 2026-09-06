/**
 * Netlify Function: get-availability
 *
 * Proxies a request to the Google Apps Script Web App to retrieve the full
 * availability map for all dates (NOT per-date), via action=get_availability.
 *
 * Method: GET (no body required).
 *
 * RESPONSE SHAPE CHANGE (vs. previous version):
 *   Previously: GET ?date=YYYY-MM-DD -> { date, bookedSlots: [...] } (slots for ONE date)
 *   Now:        GET (no date param)  -> { success, availability: { "YYYY-MM-DD": ["08:00", ...] , ... } }
 *   The availability object maps every date key to its list of AVAILABLE (open)
 *   start times. Dates/times that are booked (or past) are simply absent.
 *
 *   NOTE: js/main.js Step-8 calendar logic currently consumes the OLD
 *   bookedSlots shape and will need to be updated in a future prompt to parse
 *   this new per-date available-slots shape.
 */

const gas = require('./_gas');

exports.handler = async function (event) {
  /* Only allow GET */
  if (event.httpMethod !== 'GET') {
    return gas.jsonResponse(405, { error: 'Method not allowed' });
  }

  var result = await gas.callGasApp('get_availability', {});

  if (!result.ok) {
    return gas.jsonResponse(result.statusCode, result.body);
  }

  return gas.jsonResponse(200, result.body);
};
