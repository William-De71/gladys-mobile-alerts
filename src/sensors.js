// -----------------------------------------------------------------------------
// The measurements of the Mobile Alerts sensors.
//
// The first two characters of a sensor id give its type (ID01 … ID20 in the
// API documentation). The values are read from the keys of the measurement,
// whatever the type, with these exceptions:
//   - ID17 (temperature and power outage): `t2` is the power (0 on, 1 off),
//     not a temperature: it is never read as one;
//   - 43530 means "probe not connected", 65295 "out of range": no value.
//
// Keys → values (units of Gladys):
//   t1 → temperature; t2, t3, t4 → temperature_2…4 (probes, external sensors);
//   h, h1 → humidity; h2, h3, h4 → humidity_2…4; ppm → co2; ap → pressure (hPa);
//   r → rain_total (mm, a counter since the batteries went in); ws, wg →
//   wind_speed, wind_gust (m/s); wd → wind_direction (0-15 → degrees);
//   w → open (true when the window is open); a1…a4 → smoke (any detector);
//   kp1t/kp1c … kp4t/kp4c → buttons (press type, running counter).
// The alert flags (with a phone id) are read by events.js.
// -----------------------------------------------------------------------------

const NOT_CONNECTED = 43530;
const OUT_OF_RANGE = 65295;

// Type (first two characters of the id) → kind of sensor, for its name.
const KINDS = {
  '01': 'temperature_probe',
  '02': 'temperature',
  '03': 'temperature_humidity',
  '04': 'temperature_humidity_probe',
  '05': 'air_quality',
  '06': 'temperature_humidity_probe',
  '07': 'indoor_outdoor',
  '08': 'rain',
  '09': 'temperature_humidity_probe',
  '0A': 'alarm',
  '0B': 'wind',
  '0E': 'temperature_humidity',
  '0F': 'temperature_probe',
  10: 'contact',
  11: 'multi',
  12: 'humidity_guard',
  15: 'buttons',
  17: 'power',
  18: 'barometer',
  20: 'temperature',
};
const KIND_KEYS = [...new Set(Object.values(KINDS)), 'sensor'];
const BUTTONS = [1, 2, 3, 4];
// Press types of the API → BUTTON_STATUS of Gladys (click, double click, long click).
const PRESS_TYPES = { 1: 'short', 2: 'double', 3: 'long' };
// prettier-ignore
const SECTOR_NAMES = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
];

/**
 * @description The type of a sensor id: its first two characters.
 * @param {string} id - The id.
 * @returns {string} "0E".
 */
const typeOf = (id) =>
  String(id ?? '')
    .slice(0, 2)
    .toUpperCase();

/**
 * @description The kind of a sensor id.
 * @param {string} id - The id.
 * @returns {string} A KIND_KEYS value.
 */
const kindOf = (id) => KINDS[typeOf(id)] ?? 'sensor';

/**
 * @description A measured number, or null when absent, special or not a number.
 * @param {unknown} raw - The value.
 * @returns {number|null} The value.
 */
function number(raw) {
  const value = typeof raw === 'string' ? Number.parseFloat(raw) : raw;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return value === NOT_CONNECTED || value === OUT_OF_RANGE ? null : value;
}

/**
 * @description An instant of the API (seconds) in milliseconds.
 * @param {unknown} raw - The value.
 * @returns {number|null} The instant.
 */
function instant(raw) {
  const value = number(raw);
  return value !== null && value > 0 ? value * 1000 : null;
}

/**
 * @description Read the values of a measurement.
 * @param {string} type - The sensor type.
 * @param {object} measurement - The measurement.
 * @returns {object} The values (only the ones given).
 */
function readValues(type, measurement) {
  const m = measurement ?? {};
  const values = {};
  const set = (key, value) => {
    if (value !== null && value !== undefined) {
      values[key] = value;
    }
  };
  set('temperature', number(m.t1));
  if (type !== '17') {
    set('temperature_2', number(m.t2));
  } else if (number(m.t2) !== null) {
    values.power = number(m.t2) === 0;
  }
  set('temperature_3', number(m.t3));
  set('temperature_4', number(m.t4));
  set('humidity', number(m.h) ?? number(m.h1));
  set('humidity_2', number(m.h2));
  set('humidity_3', number(m.h3));
  set('humidity_4', number(m.h4));
  set('co2', number(m.ppm));
  set('pressure', number(m.ap));
  set('rain_total', number(m.r));
  set('wind_speed', number(m.ws));
  set('wind_gust', number(m.wg));
  const sector = number(m.wd);
  if (sector !== null && sector >= 0 && sector < 16) {
    values.wind_direction = Math.round(sector) * 22.5;
  }
  if (typeof m.w === 'boolean') {
    values.open = m.w;
  }
  const smoke = ['a1', 'a2', 'a3', 'a4'].filter((key) => typeof m[key] === 'boolean');
  if (smoke.length) {
    values.smoke = smoke.some((key) => m[key]);
  }
  return values;
}

/**
 * @description Read the buttons of a measurement (ID15).
 * @param {object} measurement - The measurement.
 * @returns {object|null} button number → `{ press, count }`, null when none.
 */
function readButtons(measurement) {
  const m = measurement ?? {};
  const buttons = {};
  for (const button of BUTTONS) {
    const count = number(m[`kp${button}c`]);
    if (count === null) {
      continue;
    }
    buttons[button] = { press: PRESS_TYPES[number(m[`kp${button}t`])] ?? null, count };
  }
  return Object.keys(buttons).length ? buttons : null;
}

/**
 * @description Read a device of the API answer.
 * @param {object} raw - `{ deviceid, lastseen, lowbattery, measurement }`.
 * @returns {object|null} `{ id, type, kind, lastSeen, lowBattery, idx, at,
 * values, buttons, flags }`, null when it is not a device.
 */
function parseDevice(raw) {
  const id = String(raw?.deviceid ?? '').toUpperCase();
  if (!/^[0-9A-F]{12}$/.test(id)) {
    return null;
  }
  const type = typeOf(id);
  const measurement = raw.measurement && typeof raw.measurement === 'object' ? raw.measurement : {};
  const battery = raw.lowbattery ?? raw.lowbat;
  const flags = Object.fromEntries(
    Object.entries(measurement).filter(([, value]) => typeof value === 'boolean'),
  );
  return {
    id,
    type,
    kind: kindOf(id),
    lastSeen: instant(raw.lastseen),
    lowBattery: typeof battery === 'boolean' ? battery : null,
    idx: number(measurement.idx),
    at: instant(measurement.ts) ?? instant(measurement.c),
    values: readValues(type, measurement),
    buttons: readButtons(measurement),
    flags,
  };
}

/**
 * @description The name of a wind sector (16 of them, N clockwise).
 * @param {number} degrees - The direction.
 * @returns {string} "NNE".
 */
const sectorOf = (degrees) =>
  Number.isFinite(degrees) ? SECTOR_NAMES[Math.round(degrees / 22.5) % 16] : '';

export {
  NOT_CONNECTED,
  OUT_OF_RANGE,
  KINDS,
  KIND_KEYS,
  BUTTONS,
  PRESS_TYPES,
  SECTOR_NAMES,
  typeOf,
  kindOf,
  number,
  readValues,
  readButtons,
  parseDevice,
  sectorOf,
};
