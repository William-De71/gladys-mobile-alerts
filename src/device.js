// -----------------------------------------------------------------------------
// The devices of the integration, offered on the Discovery screen.
//
// "Mobile Alerts <kind> <last 4 characters of the id>": one per configured
// sensor, offered once it answered. Read-only features (category / type pairs
// of the SDK constants), each one offered once the sensor gave the value it
// needs — they never go away afterwards (a feature that flaps would ask the
// user to update the device):
//   - `temperature`                temperature-sensor / decimal, °C;
//   - `temperature_2` … `_4`       temperature-sensor / probe, °C (cable probe,
//                                  outdoor or extra sensors: kept out of the
//                                  average temperature of the room);
//   - `humidity`, `humidity_2` … `_4`   humidity-sensor / decimal, %;
//   - `co2`                        co2-sensor / integer, ppm (ID05);
//   - `pressure`                   pressure-sensor / decimal, hPa (ID18);
//   - `rain_1h`, `rain_24h`        precipitation-sensor / decimal, mm/h and
//                                  mm/day (rain.js, from the counter);
//   - `raining`                    rain-sensor / binary;
//   - `wind_speed`, `wind_gust`    speed-sensor / decimal, m/s (ID0B);
//   - `wind_direction`             angle-sensor / decimal, degrees;
//   - `open`                       opening-sensor / binary: 1 closed, 0 open
//                                  (OPENING_SENSOR_STATE of Gladys);
//   - `smoke`                      smoke-sensor / binary (alarm detector ID0A,
//                                  with a phone id only);
//   - `button_1` … `button_4`      button / click: 1 click, 2 double click,
//                                  6 long click (BUTTON_STATUS of Gladys);
//   - `battery_low`                battery-low / binary.
//
// External ids: the first 12 hexadecimal digits of the SHA-256 of the sensor
// id — stable, and the id itself (the only access to its measurements) never
// shows in Gladys. `should_poll` stays false: the integration reads on its own
// timer.
// -----------------------------------------------------------------------------

import { createHash } from 'node:crypto';
import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
  DEVICE_FEATURE_UNITS as UNITS,
} from '@gladysassistant/integration-sdk';
import { t } from './i18n.js';
import { BUTTONS } from './sensors.js';

const DEVICE_TYPE = 'sensor';
// BUTTON_STATUS of Gladys.
const BUTTON_STATES = { short: 1, double: 2, long: 6 };
// OPENING_SENSOR_STATE of Gladys.
const OPENING = { OPEN: 0, CLOSED: 1 };

const sensor = (category, type, unit, min, max, history = true) => ({
  category,
  type,
  ...(unit ? { unit } : {}),
  min,
  max,
  read_only: true,
  has_feedback: false,
  keep_history: history,
});
const binary = (category) => sensor(category, TYPES.SENSOR.BINARY, undefined, 0, 1);
const value = (key) => (reading) => reading.values?.[key] ?? null;
const flag = (key) => (reading) =>
  typeof reading.values?.[key] === 'boolean' ? (reading.values[key] ? 1 : 0) : null;
const temperature = (key, name, type) => ({
  key,
  name,
  shape: sensor(CATEGORIES.TEMPERATURE_SENSOR, type, UNITS.CELSIUS, -50, 110),
  state: value(key),
});
const humidity = (key, name) => ({
  key,
  name,
  shape: sensor(CATEGORIES.HUMIDITY_SENSOR, TYPES.SENSOR.DECIMAL, UNITS.PERCENT, 0, 100),
  state: value(key),
});
const hasRain = (reading) => Number.isFinite(reading?.values?.rain_total);

// `given`: whether a reading gives the feature (by default: the value is there).
const FEATURES = [
  temperature('temperature', 'featureTemperature', TYPES.SENSOR.DECIMAL),
  temperature('temperature_2', 'featureTemperature2', TYPES.TEMPERATURE_SENSOR.PROBE),
  temperature('temperature_3', 'featureTemperature3', TYPES.TEMPERATURE_SENSOR.PROBE),
  temperature('temperature_4', 'featureTemperature4', TYPES.TEMPERATURE_SENSOR.PROBE),
  humidity('humidity', 'featureHumidity'),
  humidity('humidity_2', 'featureHumidity2'),
  humidity('humidity_3', 'featureHumidity3'),
  humidity('humidity_4', 'featureHumidity4'),
  {
    key: 'co2',
    name: 'featureCo2',
    shape: sensor(CATEGORIES.CO2_SENSOR, TYPES.SENSOR.INTEGER, UNITS.PPM, 0, 10000),
    state: (reading) =>
      Number.isFinite(reading.values?.co2) ? Math.round(reading.values.co2) : null,
  },
  {
    key: 'pressure',
    name: 'featurePressure',
    shape: sensor(CATEGORIES.PRESSURE_SENSOR, TYPES.SENSOR.DECIMAL, UNITS.HECTO_PASCAL, 300, 1100),
    state: value('pressure'),
  },
  {
    key: 'rain_1h',
    name: 'featureRain1h',
    shape: sensor(
      CATEGORIES.PRECIPITATION_SENSOR,
      TYPES.PRECIPITATION_SENSOR.DECIMAL,
      UNITS.MILLIMETER_PER_HOUR,
      0,
      500,
    ),
    given: hasRain,
    state: (reading) => reading.rain?.hour ?? null,
  },
  {
    key: 'rain_24h',
    name: 'featureRain24h',
    shape: sensor(
      CATEGORIES.PRECIPITATION_SENSOR,
      TYPES.PRECIPITATION_SENSOR.DECIMAL,
      UNITS.MILLIMETER_PER_DAY,
      0,
      2000,
    ),
    given: hasRain,
    state: (reading) => reading.rain?.day ?? null,
  },
  {
    key: 'raining',
    name: 'featureRaining',
    shape: binary(CATEGORIES.RAIN_SENSOR),
    given: hasRain,
    state: (reading) => (typeof reading.rain?.raining === 'boolean' ? +reading.rain.raining : null),
  },
  {
    key: 'wind_speed',
    name: 'featureWindSpeed',
    shape: sensor(
      CATEGORIES.SPEED_SENSOR,
      TYPES.SPEED_SENSOR.DECIMAL,
      UNITS.METER_PER_SECOND,
      0,
      100,
    ),
    state: value('wind_speed'),
  },
  {
    key: 'wind_gust',
    name: 'featureWindGust',
    shape: sensor(
      CATEGORIES.SPEED_SENSOR,
      TYPES.SPEED_SENSOR.DECIMAL,
      UNITS.METER_PER_SECOND,
      0,
      100,
    ),
    state: value('wind_gust'),
  },
  {
    key: 'wind_direction',
    name: 'featureWindDirection',
    shape: sensor(CATEGORIES.ANGLE_SENSOR, TYPES.SENSOR.DECIMAL, UNITS.DEGREE, 0, 360),
    state: value('wind_direction'),
  },
  {
    key: 'open',
    name: 'featureOpen',
    shape: binary(CATEGORIES.OPENING_SENSOR),
    state: (reading) =>
      typeof reading.values?.open === 'boolean'
        ? reading.values.open
          ? OPENING.OPEN
          : OPENING.CLOSED
        : null,
  },
  {
    key: 'smoke',
    name: 'featureSmoke',
    shape: binary(CATEGORIES.SMOKE_SENSOR),
    state: flag('smoke'),
  },
  ...BUTTONS.map((button) => ({
    key: `button_${button}`,
    name: 'featureButton',
    button,
    shape: sensor(CATEGORIES.BUTTON, TYPES.BUTTON.CLICK, undefined, 0, 6, false),
    given: (reading) => Boolean(reading?.buttons?.[button]),
    // A press is published when it happens (events.js), never as a state.
    state: () => null,
  })),
  {
    key: 'battery_low',
    name: 'featureBatteryLow',
    shape: binary(CATEGORIES.BATTERY_LOW),
    given: (reading) => typeof reading?.lowBattery === 'boolean',
    state: (reading) => (typeof reading.lowBattery === 'boolean' ? +reading.lowBattery : null),
  },
];
for (const feature of FEATURES) {
  feature.given ??= (reading) => {
    const given = reading?.values?.[feature.key];
    return Number.isFinite(given) || typeof given === 'boolean';
  };
}
const FEATURE_KEYS = FEATURES.map((feature) => feature.key);

/**
 * @description The key of a sensor: the first 12 hexadecimal digits of the
 * SHA-256 of its id (uppercase).
 * @param {string} id - The sensor id.
 * @returns {string} "3f9c0a…".
 */
const deviceKey = (id) => createHash('sha256').update(id).digest('hex').slice(0, 12);

/**
 * @description The external ids of a sensor.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {string} key - The sensor key.
 * @returns {{ device: string, feature: Function }} The ids.
 */
const idsOf = (gladys, key) => gladys.externalIds(DEVICE_TYPE, key);

/**
 * @description The sensor key of a device (or feature) external id.
 * @param {unknown} externalId - The id.
 * @returns {string|null} The key.
 * @example
 * keyOfExternalId('ext:mobile-alerts:sensor:3f9c0a1b2c3d:open'); // -> '3f9c0a1b2c3d'
 */
function keyOfExternalId(externalId) {
  const match = /:sensor:([0-9a-f]{12})(?::[a-z_0-9]+)?$/.exec(String(externalId ?? ''));
  return match ? match[1] : null;
}

/**
 * @description The features a reading gives.
 * @param {object|null} reading - The reading.
 * @returns {string[]} The feature keys.
 */
const givenKeysOf = (reading) =>
  reading ? FEATURES.filter((feature) => feature.given(reading)).map((feature) => feature.key) : [];

/**
 * @description The name of a sensor: its kind and the end of its id.
 * @param {object} sensor - `{ kind, suffix }`.
 * @param {string} language - The language.
 * @returns {string} "Mobile Alerts rain gauge 3503".
 */
const sensorName = (sensor, language) =>
  t('deviceName', language, { kind: t(`kind_${sensor.kind}`, language), suffix: sensor.suffix });

/**
 * @description Build the device of a sensor.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} device - `{ key, kind, type, suffix, features }`: `features`
 * the feature keys the sensor ever gave.
 * @param {string} [language] - Language of the names.
 * @returns {object} The discovered device.
 */
function buildDevice(gladys, device, language = 'en') {
  const ids = idsOf(gladys, device.key);
  const given = new Set(device.features ?? []);
  return {
    name: sensorName(device, language),
    external_id: ids.device,
    model: `Mobile Alerts ID${device.type}`,
    should_poll: false,
    params: [],
    features: FEATURES.filter((feature) => given.has(feature.key)).map((feature) => ({
      name: t(feature.name, language, { button: feature.button }),
      external_id: ids.feature(feature.key),
      ...feature.shape,
    })),
  };
}

/**
 * @description The states of a sensor. A value the sensor did not give this
 * time is left untouched. Button presses are not states (buttonStates).
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} device - `{ key, features }`.
 * @param {object|null} reading - `{ values, lowBattery, rain }`.
 * @returns {object[]} `{ device_feature_external_id, state }`.
 */
function buildStates(gladys, device, reading) {
  if (!reading) {
    return [];
  }
  const ids = idsOf(gladys, device.key);
  const given = new Set(device.features ?? []);
  const states = [];
  for (const feature of FEATURES) {
    if (!given.has(feature.key)) {
      continue;
    }
    const state = feature.state(reading);
    if (Number.isFinite(state)) {
      states.push({
        device_feature_external_id: ids.feature(feature.key),
        state: Math.min(Math.max(state, feature.shape.min), feature.shape.max),
      });
    }
  }
  return states;
}

/**
 * @description The states of button presses.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {string} key - The sensor key.
 * @param {Array<{ button: number, press: string }>} presses - The presses.
 * @returns {object[]} `{ device_feature_external_id, state }`.
 */
function buttonStates(gladys, key, presses) {
  const ids = idsOf(gladys, key);
  return presses
    .filter((press) => BUTTON_STATES[press.press])
    .map((press) => ({
      device_feature_external_id: ids.feature(`button_${press.button}`),
      state: BUTTON_STATES[press.press],
    }));
}

export {
  DEVICE_TYPE,
  BUTTON_STATES,
  OPENING,
  FEATURES,
  FEATURE_KEYS,
  deviceKey,
  idsOf,
  keyOfExternalId,
  givenKeysOf,
  sensorName,
  buildDevice,
  buildStates,
  buttonStates,
};
