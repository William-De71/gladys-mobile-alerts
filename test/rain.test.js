import { test } from 'node:test';
import assert from 'node:assert/strict';

import { addSample, rainOf, rainStarted, hourlyRain, steps } from '../src/rain.js';

const NOW = Date.parse('2026-11-04T17:00:00Z');
const MIN = 60000;
const HOUR = 60 * MIN;

test('samples: newer only, 25 hours kept', () => {
  let samples = addSample([], NOW - 26 * HOUR, 1, NOW - 26 * HOUR);
  samples = addSample(samples, NOW - HOUR, 2, NOW);
  assert.deepEqual(samples, [{ at: NOW - HOUR, total: 2 }]);
  assert.deepEqual(addSample(samples, NOW - 2 * HOUR, 3, NOW), samples, 'older one ignored');
});

test('rain of the last hour and 24 hours, raining, a reset counter', () => {
  const samples = [
    { at: NOW - 3 * HOUR, total: 10 },
    { at: NOW - 2 * HOUR, total: 12.5 },
    { at: NOW - 50 * MIN, total: 13 },
    { at: NOW - 40 * MIN, total: 0.2 },
    { at: NOW - 10 * MIN, total: 0.7 },
  ];
  assert.deepEqual(
    steps(samples).map((s) => s.mm),
    [2.5, 0.5, 0, 0.5],
  );
  assert.deepEqual(rainOf(samples, NOW), { hour: 1, day: 3.5, raining: true });
  assert.equal(rainOf(samples.slice(0, 1), NOW), null);
});

test('rain starts after an hour without any, never on the first step', () => {
  const dry = [
    { at: NOW - 3 * HOUR, total: 10 },
    { at: NOW - 2 * HOUR, total: 10 },
    { at: NOW - 30 * MIN, total: 10 },
  ];
  assert.equal(rainStarted([...dry, { at: NOW, total: 10.3 }]), true);
  assert.equal(rainStarted([...dry, { at: NOW, total: 10 }]), false);
  const wet = [...dry.slice(0, 2), { at: NOW - 30 * MIN, total: 10.5 }, { at: NOW, total: 11 }];
  assert.equal(rainStarted(wet), false);
  assert.equal(
    rainStarted([
      { at: NOW - HOUR, total: 1 },
      { at: NOW, total: 2 },
    ]),
    false,
  );
});

test('rain of each of the last 24 hours', () => {
  const samples = [
    { at: NOW - 3 * HOUR - 30 * MIN, total: 10 },
    { at: NOW - 2 * HOUR - 30 * MIN, total: 12 },
    { at: NOW - 20 * MIN, total: 12.4 },
  ];
  const hours = hourlyRain(samples, NOW);
  assert.equal(hours.length, 24);
  assert.equal(hours[23].at, NOW);
  assert.equal(hours.reduce((sum, hour) => sum + hour.mm, 0).toFixed(1), '2.4');
  assert.equal(hours.find((hour) => hour.mm === 2).at, NOW - 3 * HOUR);
});
