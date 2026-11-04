import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';

import {
  buildSensorsWidget,
  buildWeatherWidget,
  messageContent,
  valuesLine,
  badgeOf,
  MAX_ITEMS,
} from '../src/widgets.js';
import { hourlyRain } from '../src/rain.js';
import { LANGUAGES, TEXTS } from '../src/i18n.js';

const NOW = Date.parse('2026-11-04T17:20:00Z');
const TZ = 'Europe/Paris';
const HOUR = 3600000;
const reading = (values, extra = {}) => ({
  at: NOW - 60000,
  lastSeen: NOW - 60000,
  values,
  ...extra,
});
const SENSORS = [
  {
    name: 'Mobile Alerts thermo-hygrometer 1203',
    reading: reading({ temperature: 21.4, humidity: 54 }),
    online: true,
    alerts: [],
  },
  {
    name: 'Mobile Alerts rain gauge D4E5',
    reading: reading(
      { temperature: 8.2, rain_total: 11.4 },
      { rain: { hour: 0.5, day: 3.1, raining: true } },
    ),
    online: true,
    alerts: [],
  },
  {
    name: 'Mobile Alerts anemometer 4455',
    reading: reading({ wind_speed: 3.4, wind_gust: 6.1, wind_direction: 337.5 }),
    online: false,
    alerts: [],
  },
  {
    name: 'Mobile Alerts window contact DDEE',
    reading: reading({ open: true }),
    online: true,
    alerts: ['window_open:1'],
  },
  {
    name: 'Mobile Alerts wireless switch 9876',
    reading: reading({}),
    online: true,
    alerts: [],
    lastPress: { button: 2, press: 'double' },
  },
  {
    name: 'Mobile Alerts thermo-hygro-barometer 0001',
    reading: reading({ temperature: 23.4, humidity: 53.8, pressure: 1019.8 }, { lowBattery: true }),
    online: true,
    alerts: [],
  },
  { name: 'Mobile Alerts sensor 0000', reading: null, error: { kind: 'unknown' } },
];

test('the sensors widget is valid in every language, with the right badges', () => {
  for (const language of LANGUAGES) {
    const content = buildSensorsWidget({ sensors: SENSORS, language, timeZone: TZ });
    const errors = validateWidgetContent(content);
    assert.deepEqual(errors, [], language);
    const items = content.components.find((c) => c.type === 'card-list').items;
    assert.equal(items.length, SENSORS.length);
    assert.equal(items[0].badge.text, language === 'en' ? '6:19 PM' : '18:19');
    assert.equal(items[2].badge.color, 'danger', 'offline');
    assert.equal(items[3].badge.color, 'warning', 'alert');
    assert.equal(items[5].badge.color, 'warning', 'battery');
    assert.equal(items[6].badge.color, 'danger', 'unknown id');
  }
});

test('values on one line, in the words of the language', () => {
  assert.equal(valuesLine(SENSORS[0], 'fr'), '21,4 °C · 54 %');
  assert.equal(valuesLine(SENSORS[1], 'en'), '8.2 °C · 3.1 mm in 24 h');
  assert.equal(valuesLine(SENSORS[2], 'fr'), '12 km/h NNO');
  assert.equal(valuesLine(SENSORS[3], 'de'), 'Offen');
  assert.equal(valuesLine(SENSORS[4], 'es'), 'botón 2: doble pulsación');
  assert.equal(
    badgeOf({ reading: reading({ smoke: true }) }, { language: 'en', timeZone: TZ }).text,
    'Smoke',
  );
});

test(`at most ${MAX_ITEMS} sensors listed`, () => {
  const many = Array.from({ length: 15 }, (_, i) => ({ ...SENSORS[0], name: `S${i}` }));
  const content = buildSensorsWidget({ sensors: many, language: 'en', timeZone: TZ });
  assert.equal(content.components[1].items.length, MAX_ITEMS);
  assert.match(content.components[0].text, /15 sensor\(s\) \(3 not shown\)/);
});

test('the weather widget: tiles, hourly bars, valid; a message without a gauge', () => {
  const samples = Array.from({ length: 30 }, (_, i) => ({
    at: NOW - (29 - i) * HOUR,
    total: 10 + (i % 5 === 0 ? i / 10 : 0),
  }));
  for (const language of LANGUAGES) {
    const content = buildWeatherWidget({
      rain: {
        name: SENSORS[1].name,
        reading: SENSORS[1].reading,
        hourly: hourlyRain(samples, NOW),
      },
      wind: { name: SENSORS[2].name, reading: SENSORS[2].reading },
      language,
      timeZone: TZ,
    });
    const errors = validateWidgetContent(content);
    assert.deepEqual(errors, [], language);
    assert.equal(content.components.filter((c) => c.type === 'value').length, 5);
    assert.equal(content.components.find((c) => c.type === 'chart').series[0].points.length, 24);
  }
  const waiting = buildWeatherWidget({
    rain: { name: 'r', reading: reading({ rain_total: 1 }), hourly: [] },
    wind: null,
    language: 'en',
  });
  assert.match(waiting.components.at(-1).text, /two measurements/);
  assert.deepEqual(validateWidgetContent(waiting), []);
  const none = buildWeatherWidget({ rain: null, wind: null, language: 'fr' });
  assert.match(none.components[0].text, /pluviomètre/);
});

test('messages and runtime labels fit the bounds of the widgets', () => {
  assert.deepEqual(validateWidgetContent(messageContent('x', { refresh: true })), []);
  for (const language of LANGUAGES) {
    for (const key of [
      'buttonRefresh',
      'tileRainHour',
      'tileRainDay',
      'tileWind',
      'tileGust',
      'tileDirection',
      'seriesRain',
    ]) {
      assert.ok(TEXTS[key][language].length <= 24, `${key}.${language}`);
    }
    for (const key of ['badgeOffline', 'badgeSmoke', 'badgeBattery', 'badgeAlert', 'badgeError']) {
      assert.ok(TEXTS[key][language].length <= 16, `${key}.${language}`);
    }
  }
});
