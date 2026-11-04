import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseDevice, kindOf, typeOf, sectorOf, NOT_CONNECTED } from '../src/sensors.js';

test('the type and the kind come from the first two characters of the id', () => {
  assert.equal(typeOf('0e7ea4a71203'), '0E');
  assert.equal(kindOf('0E7EA4A71203'), 'temperature_humidity');
  assert.equal(kindOf('08A1B2C3D4E5'), 'rain');
  assert.equal(kindOf('15FEDCBA9876'), 'buttons');
  assert.equal(kindOf('99AAAAAAAAAA'), 'sensor');
});

test('a measurement of the documentation, a probe not connected, the real battery flag', () => {
  const device = parseDevice({
    deviceid: '09265A8A3503',
    lastseen: 1513156075,
    lowbattery: false,
    measurement: {
      idx: 1285075,
      ts: 1513159369,
      c: 1513159675,
      t1: 19.5,
      t2: NOT_CONNECTED,
      h: 37,
    },
  });
  assert.equal(device.type, '09');
  assert.equal(device.lastSeen, 1513156075000);
  assert.equal(device.at, 1513159369000);
  assert.equal(device.lowBattery, false);
  assert.deepEqual(device.values, { temperature: 19.5, humidity: 37 });
  assert.equal(parseDevice({ deviceid: 'x' }), null);
  assert.equal(parseDevice({ deviceid: '0E7EA4A71203', lowbat: true }).lowBattery, true);
});

test('wind, rain, window, smoke, buttons, power', () => {
  assert.deepEqual(
    parseDevice({ deviceid: '0B1122334455', measurement: { ws: 3.4, wg: 6.1, wd: 15 } }).values,
    { wind_speed: 3.4, wind_gust: 6.1, wind_direction: 337.5 },
  );
  assert.deepEqual(
    parseDevice({ deviceid: '08A1B2C3D4E5', measurement: { t1: 8, r: 11.352 } }).values,
    {
      temperature: 8,
      rain_total: 11.352,
    },
  );
  assert.equal(
    parseDevice({ deviceid: '10AABBCCDDEE', measurement: { w: true } }).values.open,
    true,
  );
  assert.equal(
    parseDevice({ deviceid: '0A0102030405', measurement: { a1: false, a3: true } }).values.smoke,
    true,
  );
  assert.deepEqual(
    parseDevice({ deviceid: '15FEDCBA9876', measurement: { kp1t: 2, kp1c: 22, kp2t: 0, kp2c: 13 } })
      .buttons,
    { 1: { press: 'double', count: 22 }, 2: { press: null, count: 13 } },
  );
  const power = parseDevice({ deviceid: '17ABCDEF0123', measurement: { t1: 26.9, t2: 0 } });
  assert.deepEqual(power.values, { temperature: 26.9, power: true });
});

test('wind sectors', () => {
  assert.equal(sectorOf(0), 'N');
  assert.equal(sectorOf(337.5), 'NNW');
  assert.equal(sectorOf(359), 'N');
  assert.equal(sectorOf(undefined), '');
});
