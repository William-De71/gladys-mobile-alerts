import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createMobileAlertsClient, chunks, MobileAlertsError } from '../src/mobile-alerts-api.js';
import { fakeMobileAlerts, THERMO, UNKNOWN, PHONE } from './helpers/fake-api.js';

test('one POST, form-encoded, with a User-Agent; the phone id only when given', async () => {
  const fetch = fakeMobileAlerts();
  const api = createMobileAlertsClient({ fetch, userAgent: 'gladys-mobile-alerts/0.1.0' });
  const devices = await api.lastMeasurements([THERMO]);
  assert.equal(devices[0].deviceid, THERMO);
  assert.equal(fetch.calls[0].url, 'https://www.data199.com/api/pv1/device/lastmeasurement');
  assert.equal(fetch.calls[0].phone, '');
  assert.equal(fetch.calls[0].userAgent, 'gladys-mobile-alerts/0.1.0');
  await api.lastMeasurements([THERMO], { phoneId: PHONE });
  assert.equal(fetch.calls[1].phone, PHONE);
  assert.deepEqual(await api.lastMeasurements([]), []);
  assert.equal(fetch.calls.length, 2, 'no request without ids');
});

test('errors by kind, without any id in the message', async () => {
  const fetch = fakeMobileAlerts();
  const api = createMobileAlertsClient({ fetch });
  const kinds = async (ids) => {
    try {
      await api.lastMeasurements(ids);
      return null;
    } catch (err) {
      assert.ok(err instanceof MobileAlertsError);
      assert.doesNotMatch(err.message, new RegExp(UNKNOWN));
      return err.kind;
    }
  };
  assert.equal(await kinds([UNKNOWN, THERMO]), 'invalid');
  fetch.fail.push(403, 429, 502, 'network');
  assert.equal(await kinds([THERMO]), 'blocked');
  assert.equal(await kinds([THERMO]), 'rate_limit');
  assert.equal(await kinds([THERMO]), 'failed');
  assert.equal(await kinds([THERMO]), 'unreachable');
});

test('an answer that is not a success is an error', async () => {
  const api = createMobileAlertsClient({
    fetch: async () => ({
      ok: true,
      status: 200,
      text: async () => '{"success":false,"errorcode":1,"errormessage":"Some error message"}',
    }),
  });
  await assert.rejects(api.lastMeasurements([THERMO]), /Some error message/);
});

test('chunks of 20', () => {
  assert.deepEqual(
    chunks(Array.from({ length: 45 }, (_, i) => i)).map((c) => c.length),
    [20, 20, 5],
  );
});
