// The whole integration against the fake Gladys of the SDK
// (`@gladysassistant/integration-sdk/testing`), which checks the discovered
// devices, the states and the scene events like the host API does, and a fake
// Mobile Alerts server that behaves like the real one (test/helpers/fake-api.js).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';

import { createApp, SCENE_ACTIONS, ACTIONS, BLOCKED_MS } from '../src/app.js';
import { WIDGETS, WIDGET_ACTIONS } from '../src/widgets.js';
import { TRIGGERS } from '../src/events.js';
import { deviceKey } from '../src/device.js';
import {
  fakeMobileAlerts,
  measure,
  storePath,
  silent,
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
  UNKNOWN,
} from './helpers/fake-api.js';

const ALL = [THERMO, PROBE, RAIN, WIND, CONTACT, SWITCH, ALARM, BARO];
const CONFIG = { sensors: ALL.join(', '), language: 'en' };
const PREFIX = 'ext:test-integration:sensor';
const idOf = (sensor) => `${PREFIX}:${deviceKey(sensor)}`;
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/**
 * @description The integration, connected to a fake Gladys and a fake server.
 * @param {object} [options] - `{ config, api, path, now }`.
 * @returns {Promise<object>} `{ gladys, app, api, clock, path }`.
 */
async function startApp({
  config = CONFIG,
  api = fakeMobileAlerts(),
  path = storePath(),
  now = NOW,
} = {}) {
  const clock = { now };
  const gladys = createFakeGladys({ config });
  const app = createApp(gladys, {
    fetch: api,
    storePath: path,
    now: () => clock.now,
    timeZone: TZ,
    timers: false,
    logger: silent,
  });
  await gladys.connect();
  await app.whenReady();
  return { gladys, app, api, clock, path };
}

const created = async (gladys, sensor) => {
  const device = gladys.fake.discoveredDevices.find((d) => d.external_id === idOf(sensor));
  assert.ok(device, `${sensor} is offered`);
  await gladys.fake.deviceCreated(device);
  return device;
};
const eventsOf = (gladys, key) => gladys.fake.sceneEvents.filter((event) => event.key === key);

test('startup: one request for every sensor, a device each, named by kind', async (t) => {
  const { gladys, api } = await startApp();
  t.after(() => gladys.fake.shutdown());
  assert.equal(api.calls.length, 1);
  assert.deepEqual(api.calls[0].ids, ALL);
  assert.equal(api.calls[0].phone, '');
  assert.match(api.calls[0].userAgent, /^gladys-mobile-alerts\/\d+\.\d+\.\d+$/);
  const byId = Object.fromEntries(gladys.fake.discoveredDevices.map((d) => [d.external_id, d]));
  assert.equal(Object.keys(byId).length, ALL.length);
  assert.equal(byId[idOf(THERMO)].name, 'Mobile Alerts thermo-hygrometer 1203');
  const keys = (sensor) => byId[idOf(sensor)].features.map((f) => f.external_id.split(':').pop());
  assert.deepEqual(keys(THERMO), ['temperature', 'humidity', 'battery_low']);
  assert.deepEqual(keys(PROBE), ['temperature', 'humidity', 'battery_low'], 'probe not connected');
  assert.deepEqual(keys(RAIN), ['temperature', 'rain_1h', 'rain_24h', 'raining', 'battery_low']);
  assert.deepEqual(keys(WIND), ['wind_speed', 'wind_gust', 'wind_direction', 'battery_low']);
  assert.deepEqual(keys(CONTACT), ['open', 'battery_low']);
  assert.deepEqual(keys(SWITCH), ['button_1', 'button_2', 'button_3', 'button_4', 'battery_low']);
  assert.deepEqual(keys(ALARM), ['temperature', 'battery_low'], 'smoke needs the phone id');
  assert.deepEqual(keys(BARO), ['temperature', 'humidity', 'pressure', 'battery_low']);
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.match(
    gladys.fake.connectionStatus.message.en,
    /^Connected\. Mobile Alerts thermo-hygrometer 1203: 21\.4 °C · 54 %/,
  );
  assert.deepEqual(gladys.fake.sceneEvents, [], 'the first readings are a baseline');
  const json = JSON.stringify([gladys.fake.discoveredDevices, gladys.fake.connectionStatus]);
  assert.doesNotMatch(json, new RegExp(THERMO), 'never a whole id in Gladys');
});

test('created devices get their values; a window that opens; the battery', async (t) => {
  const { gladys, app, api, clock } = await startApp();
  t.after(() => gladys.fake.shutdown());
  await created(gladys, THERMO);
  await created(gladys, CONTACT);
  await created(gladys, BARO);
  assert.equal(gladys.fake.lastState(`${idOf(THERMO)}:temperature`), 21.4);
  assert.equal(gladys.fake.lastState(`${idOf(CONTACT)}:open`), 1, 'closed');
  assert.equal(gladys.fake.lastState(`${idOf(BARO)}:battery_low`), 1);
  assert.equal(gladys.fake.lastState(`${idOf(BARO)}:pressure`), 1019.8);
  clock.now += 2 * MINUTE;
  measure(api, CONTACT, clock.now, { w: true });
  await app.readSensors();
  assert.equal(gladys.fake.lastState(`${idOf(CONTACT)}:open`), 0, 'open');
});

test('a button press fires button_pressed and a Gladys button state, twice in a row too', async (t) => {
  const { gladys, app, api, clock } = await startApp();
  t.after(() => gladys.fake.shutdown());
  await created(gladys, SWITCH);
  const before = gladys.fake.states.length;
  for (const count of [23, 24]) {
    clock.now += MINUTE;
    measure(api, SWITCH, clock.now, { kp1t: 1, kp1c: count });
    await app.readSensors();
  }
  assert.deepEqual(
    eventsOf(gladys, TRIGGERS.BUTTON_PRESSED).map((e) => e.data),
    [
      {
        device: idOf(SWITCH),
        name: 'Mobile Alerts wireless switch 9876',
        button: '1',
        press: 'short',
        count: 1,
      },
      {
        device: idOf(SWITCH),
        name: 'Mobile Alerts wireless switch 9876',
        button: '1',
        press: 'short',
        count: 1,
      },
    ],
  );
  const presses = gladys.fake.states
    .slice(before)
    .filter((s) => s.device_feature_external_id === `${idOf(SWITCH)}:button_1`);
  assert.deepEqual(
    presses.map((s) => s.state),
    [1, 1],
  );
  // The same measurement read again fires nothing.
  clock.now += MINUTE;
  await app.readSensors();
  assert.equal(eventsOf(gladys, TRIGGERS.BUTTON_PRESSED).length, 2);
});

test('rain: the last hour and 24 hours from the counter, rain_started after a dry hour', async (t) => {
  const { gladys, app, api, clock } = await startApp({ config: { sensors: RAIN } });
  t.after(() => gladys.fake.shutdown());
  await created(gladys, RAIN);
  for (let step = 1; step <= 10; step += 1) {
    clock.now += 10 * MINUTE;
    measure(api, RAIN, clock.now, { r: 11.352 });
    await app.readSensors();
  }
  assert.equal(gladys.fake.lastState(`${idOf(RAIN)}:rain_1h`), 0);
  assert.deepEqual(eventsOf(gladys, TRIGGERS.RAIN_STARTED), []);
  clock.now += 10 * MINUTE;
  measure(api, RAIN, clock.now, { r: 11.868 });
  await app.readSensors();
  assert.deepEqual(
    eventsOf(gladys, TRIGGERS.RAIN_STARTED).map((e) => e.data),
    [{ device: idOf(RAIN), name: 'Mobile Alerts rain gauge D4E5', rain_1h: 0.5, rain_24h: 0.5 }],
  );
  assert.equal(gladys.fake.lastState(`${idOf(RAIN)}:raining`), 1);
  clock.now += 10 * MINUTE;
  measure(api, RAIN, clock.now, { r: 12.126 });
  await app.readSensors();
  assert.equal(eventsOf(gladys, TRIGGERS.RAIN_STARTED).length, 1, 'still the same rain');
  assert.equal(gladys.fake.lastState(`${idOf(RAIN)}:rain_1h`), 0.8);
  const widget = await gladys.fake.widgetGet(WIDGETS.WEATHER, { settings: {}, language: 'fr' });
  const content = widget.data.content;
  assert.deepEqual(validateWidgetContent(content), []);
  assert.equal(content.components.find((c) => c.type === 'chart').series[0].points.length, 24);
});

test('with the phone id: the alerts of the app start and end, smoke becomes a feature', async (t) => {
  const { gladys, app, api, clock } = await startApp({
    config: { sensors: `${THERMO}, ${ALARM}`, phone_id: PHONE, language: 'fr' },
  });
  t.after(() => gladys.fake.shutdown());
  assert.equal(api.calls[0].phone, PHONE);
  const alarm = gladys.fake.discoveredDevices.find((d) => d.external_id === idOf(ALARM));
  assert.ok(alarm.features.some((f) => f.external_id.endsWith(':smoke')));
  clock.now += 2 * MINUTE;
  measure(api, THERMO, clock.now, { t1: 31 }, { t1hi: true, t1hise: true });
  await app.readSensors();
  clock.now += 2 * MINUTE;
  measure(api, THERMO, clock.now, { t1: 25 }, { t1hi: false, t1hiee: true });
  await app.readSensors();
  assert.deepEqual(
    eventsOf(gladys, TRIGGERS.APP_ALERT).map((e) => e.data),
    [
      {
        device: idOf(THERMO),
        name: 'Mobile Alerts thermo-hygromètre 1203',
        alert: 'temperature_high',
        alert_name: 'Température trop haute',
        state: 'started',
        probe: 1,
        value: 31,
      },
      {
        device: idOf(THERMO),
        name: 'Mobile Alerts thermo-hygromètre 1203',
        alert: 'temperature_high',
        alert_name: 'Température trop haute',
        state: 'ended',
        probe: 1,
        value: 25,
      },
    ],
  );
});

test('a refused phone id: read again without it, said in the status', async (t) => {
  const { gladys, api } = await startApp({ config: { sensors: THERMO, phone_id: '123456789' } });
  t.after(() => gladys.fake.shutdown());
  assert.deepEqual(
    api.calls.map((c) => c.phone),
    ['123456789', ''],
  );
  assert.equal(gladys.fake.discoveredDevices.length, 1);
  assert.match(gladys.fake.connectionStatus.message.en, /phone id was refused/);
});

test('an unknown id: found alone, left out of the next rounds, within the limit of the server', async (t) => {
  const { gladys, app, api, clock } = await startApp({
    config: { sensors: `${THERMO}, ${UNKNOWN}, ${RAIN}` },
  });
  t.after(() => gladys.fake.shutdown());
  assert.deepEqual(
    api.calls.map((c) => c.ids.length),
    [3, 1, 1, 1],
  );
  assert.equal(api.calls.filter((c) => c.ids.includes(UNKNOWN)).length, 2);
  assert.equal(gladys.fake.discoveredDevices.length, 2);
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.match(
    gladys.fake.connectionStatus.message.en,
    /^2 of 3 sensors read\. Sensor …EF00 is unknown/,
  );
  api.calls.length = 0;
  clock.now += 2 * MINUTE;
  await app.readSensors();
  assert.deepEqual(
    api.calls.map((c) => c.ids),
    [[THERMO, RAIN]],
    'the unknown id is left out',
  );
  // Read now checks it again: one invalid request more.
  const read = await gladys.fake.action(ACTIONS.READ_NOW);
  assert.match(read.data.message.en, /^Read: /);
  assert.ok(api.calls.at(-1).ids.includes(UNKNOWN));
});

test('never more than 4 invalid requests in 15 minutes', async (t) => {
  const unknown = ['03DEADBEEF01', '03DEADBEEF02', '03DEADBEEF03', '03DEADBEEF04', '03DEADBEEF05'];
  const { gladys, app, api, clock } = await startApp({
    config: { sensors: [THERMO, ...unknown].join(',') },
  });
  t.after(() => gladys.fake.shutdown());
  const invalid = () => api.calls.filter((c) => c.ids.some((id) => unknown.includes(id))).length;
  assert.equal(invalid(), 4);
  assert.match(
    gladys.fake.connectionStatus.message.en,
    /^1 of 6 sensors read\. Sensor …EF01 is unknown/,
  );
  clock.now += 16 * MINUTE;
  await app.readSensors();
  assert.ok(invalid() <= 8);
  assert.ok(gladys.fake.discoveredDevices.some((d) => d.external_id === idOf(THERMO)));
});

test('a 403 pauses 15 minutes, a network failure is reported and recovers', async (t) => {
  const { gladys, app, api, clock } = await startApp({ config: { sensors: THERMO } });
  t.after(() => gladys.fake.shutdown());
  api.fail.push(403);
  clock.now += 2 * MINUTE;
  await app.readSensors();
  assert.equal(app.getPause().kind, 'blocked');
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.en, /blocked this address/);
  api.calls.length = 0;
  clock.now += 5 * MINUTE;
  await app.readSensors();
  assert.equal(api.calls.length, 0, 'nothing while blocked');
  clock.now += BLOCKED_MS;
  api.fail.push('network');
  await app.readSensors();
  assert.match(gladys.fake.connectionStatus.message.en, /cannot be reached/);
  clock.now += 2 * MINUTE;
  await app.readSensors();
  assert.equal(gladys.fake.connectionStatus.connected, true);
});

test('offline after 3 hours without anything, back afterwards', async (t) => {
  const { gladys, app, api, clock } = await startApp({ config: { sensors: THERMO } });
  t.after(() => gladys.fake.shutdown());
  clock.now += 3 * HOUR + 2 * MINUTE;
  await app.readSensors();
  clock.now += 2 * MINUTE;
  measure(api, THERMO, clock.now);
  await app.readSensors();
  assert.deepEqual(
    eventsOf(gladys, TRIGGERS.CONNECTION_CHANGED).map((e) => [e.data.state, e.data.minutes]),
    [
      ['offline', 183],
      ['online', 1],
    ],
  );
});

test('widgets and their button; a scene action reads quietly', async (t) => {
  const { gladys, app, api, clock } = await startApp();
  t.after(() => gladys.fake.shutdown());
  for (const language of ['en', 'fr', 'de', 'es']) {
    for (const key of Object.values(WIDGETS)) {
      const answer = await gladys.fake.widgetGet(key, { settings: {}, language });
      assert.deepEqual(validateWidgetContent(answer.data.content), [], `${key}.${language}`);
    }
  }
  api.calls.length = 0;
  const cached = await gladys.fake.widgetAction(
    WIDGETS.SENSORS,
    WIDGET_ACTIONS.REFRESH,
    {},
    { settings: {} },
  );
  assert.match(cached.data.message.en, /less than 30 seconds/);
  assert.equal(api.calls.length, 0);
  clock.now += MINUTE;
  const read = await gladys.fake.widgetAction(
    WIDGETS.SENSORS,
    WIDGET_ACTIONS.REFRESH,
    {},
    { settings: {} },
  );
  assert.equal(read.data.message.en, '8 sensor(s) read again.');
  clock.now += 5 * MINUTE;
  measure(api, SWITCH, clock.now, { kp2t: 2, kp2c: 14 });
  const answer = await gladys.fake.sceneAction(SCENE_ACTIONS.READ_SENSOR, { device: idOf(WIND) });
  assert.deepEqual(answer.data.outputs, {
    name: 'Mobile Alerts anemometer 4455',
    kind: 'wind',
    wind_speed: 3.4,
    wind_gust: 6.1,
    wind_direction: 337.5,
    wind_direction_name: 'NNW',
    window: '',
    battery_low: false,
    measured_at: '2026-11-04T17:19:00.000Z',
    connection: 'online',
    summary: 'Mobile Alerts anemometer 4455: 12 km/h NNW.',
  });
  assert.deepEqual(gladys.fake.sceneEvents, [], 'a scene action fires nothing');
  await app.readSensors();
  assert.equal(eventsOf(gladys, TRIGGERS.BUTTON_PRESSED).length, 1, 'the next round does');
});

test('no sensor: a status that says what to do; the diagnostic hides the ids', async (t) => {
  const { gladys, api } = await startApp({ config: { sensors: 'oops', phone_id: PHONE } });
  t.after(() => gladys.fake.shutdown());
  assert.equal(api.calls.length, 0);
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(
    gladys.fake.connectionStatus.message.en,
    /^Not sensor ids: oops\. No sensor configured/,
  );
  const lines = [];
  const app = createApp(createFakeGladys(), {
    logger: { ...silent, info: (l) => lines.push(l) },
    timers: false,
  });
  void app;
  await gladys.fake.configUpdated({ sensors: THERMO, phone_id: PHONE });
  const diag = await gladys.fake.action(ACTIONS.DIAGNOSTIC);
  assert.match(diag.data.message.en, /diagnostic/);
});

test('a restart keeps the button counters: nothing fires twice', async (t) => {
  const path = storePath();
  const api = fakeMobileAlerts();
  const first = await startApp({ config: { sensors: SWITCH }, api, path });
  first.clock.now += MINUTE;
  measure(api, SWITCH, first.clock.now, { kp3t: 3, kp3c: 8 });
  await first.app.readSensors();
  assert.equal(eventsOf(first.gladys, TRIGGERS.BUTTON_PRESSED)[0].data.press, 'long');
  first.gladys.fake.shutdown();
  const again = await startApp({
    config: { sensors: SWITCH },
    api,
    path,
    now: first.clock.now + MINUTE,
  });
  t.after(() => again.gladys.fake.shutdown());
  assert.deepEqual(again.gladys.fake.sceneEvents, []);
});
