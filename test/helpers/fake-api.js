// A fake Mobile Alerts server for the tests, served through the `fetch` option
// of the integration. It behaves like the real one (checked on 2026-11-04):
//   - POST /device/lastmeasurement, form-encoded `deviceids` and `phoneid`;
//   - one unknown id, or an unknown phone id, fails the whole request with a
//     400 `{"Message":"Request parameters invalid"}`;
//   - the battery flag is `lowbattery`;
//   - the alert flags only come with a known phone id.
// The measurements follow the examples of the API documentation. Tests never
// touch the network.

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// 2026-11-04 18:20 in Paris (CET).
const NOW = Date.parse('2026-11-04T17:20:00Z');
const TZ = 'Europe/Paris';
const PHONE = '880071013613';
// Sensor ids: the first two characters give the type.
const THERMO = '0E7EA4A71203';
const PROBE = '09265A8A3503';
const RAIN = '08A1B2C3D4E5';
const WIND = '0B1122334455';
const CONTACT = '10AABBCCDDEE';
const SWITCH = '15FEDCBA9876';
const ALARM = '0A0102030405';
const BARO = '18C0FFEE0001';
const POWER = '17ABCDEF0123';
const UNKNOWN = '03DEADBEEF00';

const clone = (value) => JSON.parse(JSON.stringify(value));
const silent = { info() {}, warn() {}, error() {}, debug() {} };
const seconds = (ms) => Math.round(ms / 1000);

/**
 * @description The measurements of the test sensors, as the server gives them,
 * measured one minute before `now`.
 * @param {number} [now] - Now (ms).
 * @returns {object} id → `{ lastseen, lowbattery, measurement, alerts }`;
 * `alerts` the flags added with a phone id.
 */
function sensorsAt(now = NOW) {
  const at = seconds(now - 60000);
  const base = (idx, values, alerts = {}, lowbattery = false) => ({
    lastseen: at,
    lowbattery,
    measurement: { idx, ts: at, c: at + 5, ...values },
    alerts,
  });
  return {
    [THERMO]: base(162994, { t1: 21.4, h: 54.0 }, { t1hi: false, t1lo: false }),
    [PROBE]: base(1285075, { t1: 19.5, t2: 43530.0, h: 37.0 }),
    [RAIN]: base(5001, { t1: 8.2, r: 11.352, rf: 44 }),
    [WIND]: base(7001, { ws: 3.4, wg: 6.1, wd: 15 }),
    [CONTACT]: base(9001, { w: false }),
    [SWITCH]: base(4001, {
      kp1t: 1,
      kp1c: 22,
      kp2t: 0,
      kp2c: 13,
      kp3t: 0,
      kp3c: 7,
      kp4t: 0,
      kp4c: 8,
      sc: true,
    }),
    [ALARM]: base(3001, { t1: 20.3 }, { a1: false, a2: false, a3: false, a4: false }),
    [BARO]: base(2001, { t1: 23.4, h: 53.8, ap: 1019.8 }, {}, true),
    [POWER]: base(1001, { t1: 26.9, t2: 0.0 }),
  };
}

/**
 * @description A fake fetch serving the Mobile Alerts API.
 * @param {object} [options] - `{ now, phones }`.
 * @returns {Function} The fetch, with `sensors`, `calls`, `phones` and `fail`.
 */
function fakeMobileAlerts({ now = NOW, phones = [PHONE] } = {}) {
  const api = async (url, init = {}) => {
    const body = new URLSearchParams(String(init.body ?? ''));
    const ids = (body.get('deviceids') ?? '').split(',').filter(Boolean);
    const phone = body.get('phoneid') ?? '';
    api.calls.push({ url, ids, phone, userAgent: init.headers?.['User-Agent'] });
    const answer = (status, payload) => ({
      ok: status >= 200 && status < 300,
      status,
      text: async () => JSON.stringify(payload),
    });
    if (api.fail.length) {
      const next = api.fail.shift();
      if (next === 'network') {
        throw new TypeError('fetch failed');
      }
      return answer(next, { Message: `Forced ${next}` });
    }
    if (!url.endsWith('/device/lastmeasurement') || init.method !== 'POST') {
      return answer(404, { Message: 'Not found' });
    }
    if (ids.some((id) => !api.sensors[id]) || (phone && !api.phones.includes(phone))) {
      return answer(400, { Message: 'Request parameters invalid' });
    }
    return answer(200, {
      devices: ids.map((id) => {
        const sensor = api.sensors[id];
        return {
          deviceid: id,
          lastseen: sensor.lastseen,
          lowbattery: sensor.lowbattery,
          measurement: { ...sensor.measurement, ...(phone ? sensor.alerts : {}) },
        };
      }),
      success: true,
      ...(phone ? { phoneid: phone } : {}),
    });
  };
  api.sensors = sensorsAt(now);
  api.calls = [];
  api.phones = phones;
  // Statuses (or 'network') to answer to the next requests, in order.
  api.fail = [];
  return api;
}

/**
 * @description A new measurement of a sensor.
 * @param {Function} api - The fake API.
 * @param {string} id - The sensor id.
 * @param {number} now - Now (ms): the measurement is one minute older.
 * @param {object} [values] - Keys of the measurement to change.
 * @param {object} [alerts] - Alert flags to change.
 */
function measure(api, id, now, values = {}, alerts = {}) {
  const sensor = api.sensors[id];
  const at = seconds(now - 60000);
  sensor.lastseen = at;
  sensor.measurement = {
    ...sensor.measurement,
    ...values,
    idx: sensor.measurement.idx + 1,
    ts: at,
    c: at + 5,
  };
  sensor.alerts = { ...sensor.alerts, ...alerts };
}

/**
 * @description A new file in a new temporary folder for the store.
 * @returns {string} The path.
 */
const storePath = () => join(mkdtempSync(join(tmpdir(), 'mobile-alerts-')), 'mobile-alerts.json');

export {
  NOW,
  TZ,
  PHONE,
  THERMO,
  PROBE,
  RAIN,
  WIND,
  CONTACT,
  SWITCH,
  ALARM,
  BARO,
  POWER,
  UNKNOWN,
  clone,
  silent,
  sensorsAt,
  fakeMobileAlerts,
  measure,
  storePath,
};
