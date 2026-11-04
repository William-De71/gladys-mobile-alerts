import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  alertOfFlag,
  activeAlerts,
  detectAlerts,
  detectPresses,
  detectConnection,
  alertData,
  ALERT_KINDS,
  OFFLINE_MS,
} from '../src/events.js';

test('alert flags of the documentation', () => {
  assert.deepEqual(alertOfFlag('t1hi', '03'), { kind: 'temperature_high', index: 1 });
  assert.deepEqual(alertOfFlag('t2lo', '04'), { kind: 'temperature_low', index: 2 });
  assert.deepEqual(alertOfFlag('t2hi', '17'), { kind: 'power_outage', index: 1 });
  assert.deepEqual(alertOfFlag('hhi', '03'), { kind: 'humidity_high', index: 1 });
  assert.deepEqual(alertOfFlag('h3lo', '11'), { kind: 'humidity_low', index: 3 });
  assert.deepEqual(alertOfFlag('h24havghi', '12'), { kind: 'humidity_average_high', index: 1 });
  assert.deepEqual(alertOfFlag('a3', '0A'), { kind: 'smoke', index: 3 });
  assert.deepEqual(alertOfFlag('wot', '10'), { kind: 'window_open_long', index: 1 });
  // Flags that are not conditions: setting active, start/end of a condition.
  for (const flag of ['t1hise', 't1hiee', 'wsaactive', 'woa', 'h3havgtactive', 'h3havgnsm', 'sc']) {
    assert.equal(alertOfFlag(flag, '03'), null, flag);
  }
  for (const flag of ['t1hi', 'hlo', 'ppmhi', 'aphi', 'apcf', 'rhi', 'rb', 'wsa', 'wct', 'a1']) {
    assert.ok(ALERT_KINDS.includes(alertOfFlag(flag, '03').kind), flag);
  }
});

test('alerts start and end; one-shot flags only start; the first reading is a baseline', () => {
  const reading = { type: '08', flags: { rb: true, rhi: false, t1hi: true, t1hise: true } };
  assert.deepEqual(activeAlerts(reading), ['rain_begin:1', 'temperature_high:1']);
  assert.deepEqual(detectAlerts(undefined, ['temperature_high:1']), {
    next: ['temperature_high:1'],
    started: [],
    ended: [],
  });
  const step = detectAlerts([], ['rain_begin:1', 'temperature_high:1']);
  assert.deepEqual(step.next, ['temperature_high:1']);
  assert.deepEqual(step.started, [
    { kind: 'rain_begin', index: 1 },
    { kind: 'temperature_high', index: 1 },
  ]);
  assert.deepEqual(detectAlerts(step.next, []).ended, [{ kind: 'temperature_high', index: 1 }]);
});

test('presses: counter moved, wrapped counter, baseline, no press type', () => {
  const baseline = detectPresses(undefined, { 1: { press: 'short', count: 22 } });
  assert.deepEqual(baseline, { next: { 1: 22 }, presses: [] });
  assert.deepEqual(detectPresses({ 1: 22 }, { 1: { press: 'double', count: 24 } }).presses, [
    { button: 1, press: 'double', count: 2 },
  ]);
  assert.deepEqual(detectPresses({ 1: 255 }, { 1: { press: 'long', count: 1 } }).presses, [
    { button: 1, press: 'long', count: 2 },
  ]);
  assert.deepEqual(detectPresses({ 2: 13 }, { 2: { press: null, count: 14 } }).presses, []);
});

test('offline after 3 hours', () => {
  const now = Date.parse('2026-11-04T17:00:00Z');
  assert.deepEqual(detectConnection(undefined, now - OFFLINE_MS - 1, now), {
    online: false,
    changed: false,
  });
  assert.deepEqual(detectConnection(true, now - OFFLINE_MS - 1, now), {
    online: false,
    changed: true,
  });
  assert.deepEqual(detectConnection(false, now, now), { online: true, changed: true });
});

test('alert payloads carry the value the alert is about', () => {
  const data = alertData(
    { deviceId: 'd', name: 'n' },
    { kind: 'humidity_high', index: 2 },
    'started',
    { values: { humidity: 50, humidity_2: 81.26 } },
    (kind) => `label ${kind}`,
  );
  assert.deepEqual(data, {
    device: 'd',
    name: 'n',
    alert: 'humidity_high',
    alert_name: 'label humidity_high',
    state: 'started',
    probe: 2,
    value: 81.3,
  });
  assert.equal(
    alertData({}, { kind: 'window_open', index: 1 }, 'ended', { values: {} }, String).value,
    null,
  );
});
