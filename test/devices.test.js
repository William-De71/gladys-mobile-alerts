// The discovered devices, checked like the host API checks them (the fake
// Gladys of the SDK) and against the pitfalls of the forum (11005): every
// feature has min / max / read_only / has_feedback, category / type pairs of
// the SDK, units allowed for their category, no poll frequency.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
} from '@gladysassistant/integration-sdk';

import {
  buildDevice,
  buildStates,
  buttonStates,
  givenKeysOf,
  deviceKey,
  keyOfExternalId,
  FEATURE_KEYS,
  FEATURES,
  OPENING,
} from '../src/device.js';
import { parseDevice } from '../src/sensors.js';
import { LANGUAGES } from '../src/i18n.js';

const gladys = createFakeGladys();
const all = {
  key: deviceKey('0E7EA4A71203'),
  kind: 'temperature_humidity',
  type: '0E',
  suffix: '1203',
};

test('every feature: a known category / type pair, bounds, read only, no feedback', () => {
  const categories = new Set(Object.values(CATEGORIES));
  const device = buildDevice(gladys, { ...all, features: FEATURE_KEYS }, 'en');
  assert.equal(device.should_poll, false);
  assert.equal(device.poll_frequency, undefined);
  assert.equal(device.features.length, FEATURE_KEYS.length);
  for (const feature of device.features) {
    assert.ok(categories.has(feature.category), feature.external_id);
    const types = Object.values(
      TYPES[Object.keys(CATEGORIES).find((k) => CATEGORIES[k] === feature.category)] ?? {},
    );
    assert.ok(
      types.includes(feature.type) || Object.values(TYPES.SENSOR).includes(feature.type),
      `${feature.external_id}: ${feature.type}`,
    );
    for (const key of ['min', 'max', 'read_only', 'has_feedback']) {
      assert.notEqual(feature[key], undefined, `${feature.external_id}.${key}`);
    }
    assert.equal(feature.read_only, true);
    assert.ok(feature.name.length > 0);
  }
  assert.equal(new Set(device.features.map((f) => f.external_id)).size, device.features.length);
});

test('the fake Gladys accepts the devices in every language', async () => {
  for (const language of LANGUAGES) {
    const fake = createFakeGladys();
    await fake.connect();
    await fake.publishDiscoveredDevices([
      buildDevice(fake, { ...all, features: FEATURE_KEYS }, language),
    ]);
  }
});

test('names: the kind and the end of the id, in the language', () => {
  assert.equal(
    buildDevice(gladys, { ...all, features: [] }, 'fr').name,
    'Mobile Alerts thermo-hygromètre 1203',
  );
  assert.equal(buildDevice(gladys, { ...all, features: [] }, 'en').model, 'Mobile Alerts ID0E');
  const button = buildDevice(gladys, { ...all, features: ['button_3'] }, 'de').features[0];
  assert.equal(button.name, 'Taste 3');
});

test('features of a reading: only the values given', () => {
  const thermo = parseDevice({
    deviceid: '0E7EA4A71203',
    lowbattery: false,
    measurement: { t1: 21, h: 50 },
  });
  assert.deepEqual(givenKeysOf(thermo), ['temperature', 'humidity', 'battery_low']);
  const rain = parseDevice({ deviceid: '08A1B2C3D4E5', measurement: { r: 1 } });
  assert.deepEqual(givenKeysOf(rain), ['rain_1h', 'rain_24h', 'raining']);
  const button = parseDevice({
    deviceid: '15FEDCBA9876',
    measurement: { kp1t: 0, kp1c: 1, kp2t: 0, kp2c: 0 },
  });
  assert.deepEqual(givenKeysOf(button), ['button_1', 'button_2']);
  assert.deepEqual(givenKeysOf(null), []);
});

test('states: window 0 open / 1 closed, battery, rain, clamped, nothing for absent values', () => {
  const features = ['open', 'battery_low', 'rain_1h', 'rain_24h', 'raining', 'temperature'];
  const states = buildStates(
    gladys,
    { key: all.key, features },
    {
      values: { open: true },
      lowBattery: true,
      rain: { hour: 600, day: 2.5, raining: false },
    },
  );
  const byKey = Object.fromEntries(
    states.map((s) => [s.device_feature_external_id.split(':').pop(), s.state]),
  );
  assert.deepEqual(byKey, {
    open: OPENING.OPEN,
    battery_low: 1,
    rain_1h: 500,
    rain_24h: 2.5,
    raining: 0,
  });
  assert.deepEqual(buildStates(gladys, { key: all.key, features }, null), []);
});

test('button presses as Gladys button states', () => {
  assert.deepEqual(
    buttonStates(gladys, all.key, [
      { button: 1, press: 'short' },
      { button: 2, press: 'double' },
      { button: 4, press: 'long' },
    ]).map((s) => s.state),
    [1, 2, 6],
  );
});

test('external ids: the hash of the id, never the id', () => {
  const device = buildDevice(gladys, { ...all, features: FEATURE_KEYS }, 'en');
  assert.doesNotMatch(JSON.stringify(device), /0E7EA4A71203/i);
  assert.equal(keyOfExternalId(device.features[0].external_id), all.key);
  assert.equal(keyOfExternalId('nope'), null);
  assert.equal(FEATURES.filter((f) => f.key.startsWith('button_')).length, 4);
});
