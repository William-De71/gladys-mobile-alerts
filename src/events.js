// -----------------------------------------------------------------------------
// Scene triggers of the Mobile Alerts integration: the transitions between
// two readings, and their payloads (flat, scalar values only).
//
//   - `button_pressed`      a key of a wireless switch (ID15) was pressed: its
//                           running counter moved. The press type is the one
//                           of the last press; `count` says how many presses
//                           happened since the previous reading;
//   - `rain_started`        a rain gauge counts rain after an hour without any
//                           (rain.js);
//   - `app_alert`           an alert set in the Mobile Alerts app started or
//                           ended (needs the phone id): temperature, humidity,
//                           CO₂, pressure, rain, wind, window, smoke, power;
//   - `connection_changed`  the server has not seen a sensor for 3 hours, or
//                           sees it again.
// A first reading is a baseline: nothing fires. A measurement already handled
// (same `idx`) never fires twice; `seen` (in /data) survives restarts.
// -----------------------------------------------------------------------------

import { HOUR_MS, formatTime, minutesBetween } from './time.js';

const TRIGGERS = {
  BUTTON_PRESSED: 'button_pressed',
  RAIN_STARTED: 'rain_started',
  APP_ALERT: 'app_alert',
  CONNECTION_CHANGED: 'connection_changed',
};
const OFFLINE_MS = 3 * HOUR_MS;
const PRESSES = ['short', 'double', 'long'];

// Alert flags of the API → alert kinds. `n`: the probe (1 by default).
const ALERT_KINDS = [
  'temperature_high',
  'temperature_low',
  'humidity_high',
  'humidity_low',
  'humidity_average_high',
  'humidity_average_low',
  'co2_high',
  'pressure_high',
  'pressure_low',
  'pressure_rising',
  'pressure_falling',
  'rain_heavy',
  'rain_dry',
  'rain_begin',
  'wind',
  'gust',
  'window_open',
  'window_closed',
  'window_open_long',
  'window_closed_long',
  'smoke',
  'power_outage',
];
// Flags that tell a measurement triggered something, not a lasting condition:
// they only ever start.
const ONE_SHOT = new Set(['rain_heavy', 'rain_dry', 'rain_begin']);
const FIXED_FLAGS = {
  ppmhi: ['co2_high', 1],
  aphi: ['pressure_high', 1],
  aplo: ['pressure_low', 1],
  apcr: ['pressure_rising', 1],
  apcf: ['pressure_falling', 1],
  rhi: ['rain_heavy', 1],
  rlo: ['rain_dry', 1],
  rb: ['rain_begin', 1],
  wsa: ['wind', 1],
  wga: ['gust', 1],
  wo: ['window_open', 1],
  wc: ['window_closed', 1],
  wot: ['window_open_long', 1],
  wct: ['window_closed_long', 1],
  a1: ['smoke', 1],
  a2: ['smoke', 2],
  a3: ['smoke', 3],
  a4: ['smoke', 4],
};

/**
 * @description The alert of a flag of the API.
 * @param {string} flag - The flag key ("t1hi", "h2lo", "wsa"…).
 * @param {string} type - The sensor type (ID17: t2hi is a power outage).
 * @returns {{ kind: string, index: number }|null} The alert, null for other flags.
 */
function alertOfFlag(flag, type) {
  if (FIXED_FLAGS[flag]) {
    const [kind, index] = FIXED_FLAGS[flag];
    return { kind, index };
  }
  if (type === '17' && flag === 't2hi') {
    return { kind: 'power_outage', index: 1 };
  }
  let match = /^t([1-4])(hi|lo)$/.exec(flag);
  if (match) {
    return { kind: `temperature_${match[2] === 'hi' ? 'high' : 'low'}`, index: +match[1] };
  }
  match = /^h([1-4]?)(hi|lo)$/.exec(flag);
  if (match) {
    return { kind: `humidity_${match[2] === 'hi' ? 'high' : 'low'}`, index: +(match[1] || 1) };
  }
  match = /^h(3h|24h|7d|30d)avg(hi|lo)$/.exec(flag);
  if (match) {
    return { kind: `humidity_average_${match[2] === 'hi' ? 'high' : 'low'}`, index: 1 };
  }
  return null;
}

/**
 * @description The active alerts of a reading: "kind:index", sorted.
 * @param {object} reading - `{ type, flags }`.
 * @returns {string[]} The alerts.
 */
function activeAlerts(reading) {
  const active = new Set();
  for (const [flag, value] of Object.entries(reading?.flags ?? {})) {
    if (value !== true) {
      continue;
    }
    const alert = alertOfFlag(flag, reading.type);
    if (alert) {
      active.add(`${alert.kind}:${alert.index}`);
    }
  }
  return [...active].sort();
}

/**
 * @description The alerts that started and ended since the last reading.
 * @param {string[]|undefined} previous - The alerts active before (undefined: baseline).
 * @param {string[]} current - The alerts active now.
 * @returns {{ next: string[], started: object[], ended: object[] }} The
 * lasting alerts to keep; the alerts that changed, `{ kind, index }`.
 */
function detectAlerts(previous, current) {
  const split = (id) => {
    const [kind, index] = id.split(':');
    return { kind, index: Number(index) };
  };
  const lasting = current.filter((id) => !ONE_SHOT.has(split(id).kind));
  if (!Array.isArray(previous)) {
    return { next: lasting, started: [], ended: [] };
  }
  return {
    next: lasting,
    started: current.filter((id) => !previous.includes(id)).map(split),
    ended: previous.filter((id) => !current.includes(id)).map(split),
  };
}

/**
 * @description The presses since the last reading.
 * @param {object|undefined} previous - button → count (undefined: baseline).
 * @param {object|null} buttons - button → `{ press, count }`.
 * @returns {{ next: object, presses: Array<{ button, press, count }> }} The
 * counters to keep; the buttons pressed.
 */
function detectPresses(previous, buttons) {
  const next = { ...(previous ?? {}) };
  const presses = [];
  for (const [button, { press, count }] of Object.entries(buttons ?? {})) {
    const before = previous?.[button];
    next[button] = count;
    if (Number.isFinite(before) && count !== before && PRESSES.includes(press)) {
      // The counter wraps around (one byte): a smaller value still means presses.
      const delta = count > before ? count - before : count + 256 - before;
      presses.push({ button: Number(button), press, count: Math.max(1, Math.min(delta, 255)) });
    }
  }
  return { next, presses };
}

/**
 * @description Whether a sensor came offline or back.
 * @param {boolean|undefined} previous - Online before (undefined: baseline).
 * @param {number} lastSeen - When the server last saw it (ms).
 * @param {number} now - Now (ms).
 * @returns {{ online: boolean, changed: boolean }} The state, and whether it changed.
 */
function detectConnection(previous, lastSeen, now) {
  const online = now - lastSeen <= OFFLINE_MS;
  return { online, changed: typeof previous === 'boolean' && previous !== online };
}

/**
 * @description Keep the declared keys of an object, without absent values.
 * @param {object} data - The values.
 * @param {string[]} keys - The declared keys.
 * @returns {object} The values.
 */
function pick(data, keys) {
  return Object.fromEntries(
    keys
      .filter((key) => data[key] !== undefined && data[key] !== null)
      .map((key) => [key, typeof data[key] === 'string' ? data[key].slice(0, 1000) : data[key]]),
  );
}

const round = (value, digits = 1) =>
  Number.isFinite(value) ? Math.round(value * 10 ** digits) / 10 ** digits : null;

/**
 * @description The payload of `button_pressed`.
 * @param {object} sensor - `{ deviceId, name }`.
 * @param {object} press - `{ button, press, count }`.
 * @returns {object} The payload.
 */
const pressData = (sensor, press) => ({
  device: sensor.deviceId,
  name: sensor.name,
  button: String(press.button),
  press: press.press,
  count: press.count,
});

/**
 * @description The payload of `rain_started`.
 * @param {object} sensor - `{ deviceId, name }`.
 * @param {object|null} rain - `{ hour, day }`.
 * @returns {object} The payload.
 */
const rainData = (sensor, rain) => ({
  device: sensor.deviceId,
  name: sensor.name,
  rain_1h: round(rain?.hour),
  rain_24h: round(rain?.day),
});

// The value an alert is about, for its payload.
const VALUE_OF = {
  temperature: (values, index) => values[index === 1 ? 'temperature' : `temperature_${index}`],
  humidity: (values, index) => values[index === 1 ? 'humidity' : `humidity_${index}`],
  co2: (values) => values.co2,
  pressure: (values) => values.pressure,
  wind: (values) => values.wind_speed,
  gust: (values) => values.wind_gust,
  rain: (values) => values.rain_total,
};

/**
 * @description The payload of `app_alert`.
 * @param {object} sensor - `{ deviceId, name }`.
 * @param {object} alert - `{ kind, index }`.
 * @param {string} state - `started` or `ended`.
 * @param {object} reading - The reading.
 * @param {Function} label - `(kind) => string`: the name of the alert.
 * @returns {object} The payload.
 */
function alertData(sensor, alert, state, reading, label) {
  const family = alert.kind.split('_')[0];
  const value = VALUE_OF[family]?.(reading.values ?? {}, alert.index);
  return {
    device: sensor.deviceId,
    name: sensor.name,
    alert: alert.kind,
    alert_name: label(alert.kind),
    state,
    probe: alert.index,
    value: round(value),
  };
}

/**
 * @description The payload of `connection_changed`.
 * @param {object} sensor - `{ deviceId, name }`.
 * @param {boolean} online - Online now.
 * @param {number} lastSeen - When the server last saw it (ms).
 * @param {object} options - `{ language, timeZone, now }`.
 * @returns {object} The payload.
 */
const connectionData = (sensor, online, lastSeen, { language, timeZone, now }) => ({
  device: sensor.deviceId,
  name: sensor.name,
  state: online ? 'online' : 'offline',
  last_seen: formatTime(lastSeen, { language, timeZone }),
  minutes: minutesBetween(lastSeen, now),
});

// Outputs of the read_sensor scene action, in the manifest order.
const SENSOR_OUTPUTS = [
  'name',
  'kind',
  'temperature',
  'humidity',
  'temperature_2',
  'humidity_2',
  'co2',
  'pressure',
  'rain_1h',
  'rain_24h',
  'wind_speed',
  'wind_gust',
  'wind_direction',
  'wind_direction_name',
  'window',
  'battery_low',
  'measured_at',
  'connection',
  'summary',
];

export {
  TRIGGERS,
  OFFLINE_MS,
  PRESSES,
  ALERT_KINDS,
  ONE_SHOT,
  SENSOR_OUTPUTS,
  alertOfFlag,
  activeAlerts,
  detectAlerts,
  detectPresses,
  detectConnection,
  pick,
  round,
  pressData,
  rainData,
  alertData,
  connectionData,
};
