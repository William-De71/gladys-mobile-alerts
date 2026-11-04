// -----------------------------------------------------------------------------
// HTTP client of the Mobile Alerts REST API (https://www.data199.com/api/pv1,
// reference: "Mobile Alerts REST API", public_server_api_documentation.pdf).
//
//   POST /device/lastmeasurement   deviceids=<id>,<id>…[&phoneid=<id>]
//                                  the last measurement of each sensor
// Requests are form-encoded, answers JSON: `{ success, devices: [...] }`.
// No key: the ids of the sensors (12 hexadecimal characters on the sticker of
// the sensor) are the access. The phone id of the app adds the alerts set in
// the app to the measurements.
//
// What the server does, checked on 2026-11-04:
//   - one unknown id, or an unknown phone id, fails the WHOLE request with a
//     400 `{"Message":"Request parameters invalid"}`;
//   - more than 5 invalid requests from an IP within 15 minutes block that IP
//     for the rest of the 15 minutes: 403;
//   - more than 3 requests for a sensor within a minute block that sensor for
//     7 minutes: 429;
//   - the battery flag is `lowbattery` (the documentation says `lowbat`).
// -----------------------------------------------------------------------------

const BASE_URL = 'https://www.data199.com/api/pv1';
const TIMEOUT_MS = 20000;
// Sensors per request: the documentation gives no bound, the URL stays short.
const CHUNK = 20;

/**
 * @description An error of the Mobile Alerts API, with a kind the messages can tell apart.
 */
class MobileAlertsError extends Error {
  /**
   * @param {string} kind - `invalid` (400: an unknown id), `blocked` (403),
   * `rate_limit` (429), `unreachable`, `failed`.
   * @param {string} message - The message (never a sensor id nor the phone id).
   * @param {number} [status] - The HTTP status.
   */
  constructor(kind, message, status) {
    super(message);
    this.name = 'MobileAlertsError';
    this.kind = kind;
    this.status = status;
  }
}

/**
 * @description The kind of an HTTP status.
 * @param {number} status - The status.
 * @returns {string} The kind.
 */
function kindOf(status) {
  if (status === 400) {
    return 'invalid';
  }
  if (status === 403) {
    return 'blocked';
  }
  if (status === 429) {
    return 'rate_limit';
  }
  return 'failed';
}

/**
 * @description The message of an error answer, without any id.
 * @param {string} body - The body.
 * @returns {string} The detail, '' when none.
 */
function detailOf(body) {
  try {
    const parsed = JSON.parse(body);
    return String(parsed?.Message ?? parsed?.errormessage ?? parsed?.message ?? '')
      .replace(/[0-9A-Fa-f]{12}/g, '…')
      .replace(/[0-9]{6,}/g, '…')
      .slice(0, 120);
  } catch {
    return '';
  }
}

/**
 * @description The Mobile Alerts client.
 * @param {object} options - Options.
 * @param {string} [options.userAgent] - The User-Agent header.
 * @param {Function} [options.onRequest] - `() => void`, before each request.
 * @param {Function} [options.fetch] - The fetch implementation (tests).
 * @param {string} [options.baseUrl] - The API root.
 * @returns {object} The client.
 */
function createMobileAlertsClient({
  userAgent = 'gladys-mobile-alerts',
  onRequest = () => {},
  fetch: fetchFn = globalThis.fetch,
  baseUrl = BASE_URL,
} = {}) {
  /**
   * @description The last measurement of some sensors, in one request.
   * @param {string[]} ids - The sensor ids (12 uppercase hexadecimal characters).
   * @param {object} [options] - `{ phoneId }`.
   * @returns {Promise<object[]>} The raw devices of the answer.
   * @throws {MobileAlertsError} When the request failed.
   */
  async function lastMeasurements(ids, { phoneId = '' } = {}) {
    if (ids.length === 0) {
      return [];
    }
    const body = new URLSearchParams({ deviceids: ids.join(',') });
    if (phoneId) {
      body.set('phoneid', phoneId);
    }
    onRequest();
    let response;
    try {
      response = await fetchFn(`${baseUrl}/device/lastmeasurement`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          'User-Agent': userAgent,
        },
        body: body.toString(),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new MobileAlertsError(
        'unreachable',
        err?.name === 'TimeoutError' ? 'Timeout' : String(err?.message ?? err).slice(0, 120),
      );
    }
    const text = await response.text().catch(() => '');
    if (!response.ok) {
      const detail = detailOf(text);
      throw new MobileAlertsError(
        response.status >= 500 ? 'failed' : kindOf(response.status),
        `HTTP ${response.status}${detail ? `: ${detail}` : ''}`,
        response.status,
      );
    }
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new MobileAlertsError('failed', 'The answer is not JSON', response.status);
    }
    if (parsed?.success !== true || !Array.isArray(parsed.devices)) {
      throw new MobileAlertsError(
        'failed',
        `Unsuccessful answer${detailOf(text) ? `: ${detailOf(text)}` : ''}`,
        response.status,
      );
    }
    return parsed.devices;
  }

  return { lastMeasurements };
}

/**
 * @description Cut a list in chunks.
 * @param {Array} list - The list.
 * @param {number} [size] - The chunk size.
 * @returns {Array<Array>} The chunks.
 */
function chunks(list, size = CHUNK) {
  const result = [];
  for (let index = 0; index < list.length; index += size) {
    result.push(list.slice(index, index + size));
  }
  return result;
}

export { BASE_URL, TIMEOUT_MS, CHUNK, MobileAlertsError, createMobileAlertsClient, chunks };
