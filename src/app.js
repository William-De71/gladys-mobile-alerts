// -----------------------------------------------------------------------------
// The Mobile Alerts integration: every handler, registered on a Gladys client.
//
// Brings the Mobile Alerts sensors (Technoline, La Crosse, ELV… sold under the
// Mobile Alerts name) into Gladys, through the official Mobile Alerts REST
// API: the sensors send their measurements through the Mobile Alerts gateway
// to the Mobile Alerts server, and the integration reads them there with the
// ids of the sensors.
//   - devices (device.js): one per sensor id, with its temperatures,
//     humidities, rain, wind, window contact, buttons, battery;
//   - scene triggers (events.js): button pressed, rain started, alert of the
//     app started or ended, sensor offline or back;
//   - scene action: read a sensor;
//   - dashboard widgets (widgets.js): every sensor at a glance, rain and wind.
//
// One request every 1 to 10 minutes (the configuration) reads every sensor
// (20 ids a request). The server refuses a whole request for one unknown id
// (400), and blocks the address 15 minutes after 5 invalid requests in 15
// minutes: a refused request is then split, id by id, without ever going past
// 4 invalid requests in 15 minutes; an unknown id is left out until the
// configuration changes or "Read now". Transport: cloud only.
//
// index.js only creates the SDK client; the tests drive this module with the
// fake Gladys of the SDK and a fake Mobile Alerts server (test/helpers/fake-api.js).
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { logger as sdkLogger } from '@gladysassistant/integration-sdk';
import { normalizeConfig, readLanguage, INTERNAL_KEYS, AUTO_LANGUAGE } from './config.js';
import { createMobileAlertsClient, MobileAlertsError, chunks } from './mobile-alerts-api.js';
import { parseDevice, typeOf, kindOf } from './sensors.js';
import { addSample, rainOf, rainStarted, hourlyRain } from './rain.js';
import { createStore, DEFAULT_PATH } from './store.js';
import {
  deviceKey,
  idsOf,
  keyOfExternalId,
  givenKeysOf,
  sensorName,
  buildDevice,
  buildStates,
  buttonStates,
} from './device.js';
import {
  TRIGGERS,
  SENSOR_OUTPUTS,
  OFFLINE_MS,
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
} from './events.js';
import {
  WIDGETS,
  WIDGET_ACTIONS,
  messageContent,
  valuesLine,
  buildSensorsWidget,
  buildWeatherWidget,
} from './widgets.js';
import { defaultTimeZone, formatTime, MINUTE_MS } from './time.js';
import { t, all, sectorText, LANGUAGES } from './i18n.js';

const ACTIONS = { READ_NOW: 'read_now', DIAGNOSTIC: 'diagnostic' };
const SCENE_ACTIONS = { READ_SENSOR: 'read_sensor' };
// The server blocks an address after 5 invalid requests within 15 minutes:
// never go past 4.
const INVALID_WINDOW_MS = 15 * MINUTE_MS;
const INVALID_BUDGET = 4;
const BLOCKED_MS = 15 * MINUTE_MS;
const RATE_LIMIT_MS = 7 * MINUTE_MS;
// The Refresh button and the scene action reuse a reading younger than these.
const REFRESH_MIN_AGE_MS = 30 * 1000;
const FRESH_MS = 2 * MINUTE_MS;
const DIAGNOSTIC_CHUNK = 3000;
const { version: VERSION } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);

/**
 * @description Register every handler of the integration on a Gladys client.
 * @param {object} gladys - A GladysIntegration (or the fake Gladys of the SDK).
 * @param {object} [options] - Options.
 * @param {Function} [options.fetch] - HTTP transport of the Mobile Alerts API (tests).
 * @param {string} [options.baseUrl] - The API root (tests).
 * @param {string} [options.storePath] - The file kept in /data.
 * @param {Function} [options.now] - `() => number` in ms (tests).
 * @param {string} [options.timeZone] - IANA timezone of the texts (TZ by default).
 * @param {boolean} [options.timers] - Arm the reading timer (false in tests).
 * @param {object} [options.logger] - Logger.
 * @returns {object} Handles for the tests.
 */
function createApp(
  gladys,
  {
    fetch: fetchFn,
    baseUrl,
    storePath = DEFAULT_PATH,
    now = () => Date.now(),
    timeZone = defaultTimeZone(),
    timers = true,
    logger = sdkLogger,
  } = {},
) {
  let config = normalizeConfig();
  let language = 'en';
  let createdDevices = new Set();
  // The configured sensors: `{ id, key, position, suffix, type, kind, deviceId, name }`.
  let sensors = [];
  // An error of a whole request (network, server): `{ kind, message }`.
  let roundError = null;
  // A pause asked by the server: `{ until, kind }` (blocked, rate_limit).
  let pause = { until: 0, kind: null };
  let invalidCalls = [];
  let phoneRejected = false;
  let requests = 0;
  let lastStatus = null;
  let lastDiscovery = null;
  let timer = null;
  let reading = null;
  let stopped = false;

  const store = createStore({ path: storePath, logger });

  const api = createMobileAlertsClient({
    userAgent: `gladys-mobile-alerts/${VERSION}`,
    onRequest: () => {
      requests += 1;
    },
    ...(fetchFn ? { fetch: fetchFn } : {}),
    ...(baseUrl ? { baseUrl } : {}),
  });

  /**
   * @description Remember the language of a request, and store it when it changed.
   * @param {string} next - The language.
   */
  function rememberLanguage(next) {
    if (typeof next !== 'string' || !/^[a-z]{2}$/.test(next) || next === language) {
      return;
    }
    language = next;
    gladys
      .setConfig({ [INTERNAL_KEYS.language]: next })
      .catch((err) => logger.warn(`Unable to store the language: ${err.message}`));
  }

  /**
   * @description Language of the texts Gladys does not ask for in a language.
   * @returns {string} The language.
   */
  const textLanguage = () => (config.language === AUTO_LANGUAGE ? language : config.language);

  /**
   * @description What is kept of a sensor.
   * @param {object} sensor - The sensor.
   * @returns {object} `{ reading, readAt, error, unknown, features, rain, lastPress }`.
   */
  function stateOf(sensor) {
    store.data.devices[sensor.key] ??= {};
    return store.data.devices[sensor.key];
  }

  /**
   * @description Whether the server asked to wait (403, 429).
   * @returns {boolean} True while paused.
   */
  const paused = () => now() < pause.until;

  /**
   * @description Whether the phone id adds the alerts of the app.
   * @returns {boolean} True when given and accepted.
   */
  const phoneActive = () => Boolean(config.phoneId) && !phoneRejected;

  /**
   * @description Whether one more invalid request stays within the limit of the server.
   * @returns {boolean} True when it may be risked.
   */
  function invalidBudget() {
    invalidCalls = invalidCalls.filter((at) => at > now() - INVALID_WINDOW_MS);
    return invalidCalls.length < INVALID_BUDGET;
  }

  /**
   * @description Whether the server saw a sensor lately.
   * @param {object} sensor - The sensor.
   * @returns {boolean|null} Online or not, null before any reading.
   */
  function onlineOf(sensor) {
    const seen = stateOf(sensor).reading?.lastSeen;
    return Number.isFinite(seen) ? now() - seen <= OFFLINE_MS : null;
  }

  /**
   * @description The message of an error, for a user.
   * @param {object} err - `{ kind, message }`.
   * @param {string} lang - The language.
   * @param {object} [sensor] - The sensor concerned.
   * @returns {string} The message.
   */
  function errorText(err, lang, sensor) {
    const time = formatTime(pause.until, { language: lang, timeZone });
    const key = {
      unknown: 'errUnknown',
      checking: 'errChecking',
      blocked: 'errBlocked',
      rate_limit: 'errRateLimit',
      unreachable: 'errUnreachable',
    }[err?.kind];
    return t(key ?? 'errFailed', lang, {
      suffix: sensor?.suffix ?? '',
      time,
      detail: String(err?.message ?? '').slice(0, 120),
    });
  }

  /**
   * @description Report the connection status, only when it changed.
   * @param {boolean} connected - Connected or not.
   * @param {object} message - The multi-language message.
   * @returns {Promise<void>}
   */
  async function reportStatus(connected, message) {
    const clipped = Object.fromEntries(
      Object.entries(message).map(([lang, text]) => [lang, text.trim().slice(0, 200)]),
    );
    const signature = JSON.stringify([connected, clipped]);
    if (signature === lastStatus) {
      return;
    }
    lastStatus = signature;
    try {
      await gladys.setConnectionStatus(connected, clipped);
    } catch (err) {
      lastStatus = null;
      logger.error('Unable to report the connection status', err);
    }
  }

  /**
   * @description The view of a sensor the widgets and texts use.
   * @param {object} sensor - The sensor.
   * @returns {object} `{ name, reading, online, alerts, lastPress, error }`.
   */
  function viewOf(sensor) {
    const state = stateOf(sensor);
    return {
      name: sensor.name,
      reading: state.reading ?? null,
      online: onlineOf(sensor),
      alerts: phoneActive() ? (store.data.seen.alerts[sensor.key] ?? []) : [],
      lastPress: state.lastPress ?? null,
      error: state.error ?? null,
    };
  }

  /**
   * @description The line of a sensor in a status: "Mobile Alerts … 3503: 21,4 °C".
   * @param {object} sensor - The sensor.
   * @param {string} lang - The language.
   * @returns {string} The line.
   */
  function sensorLine(sensor, lang) {
    if (onlineOf(sensor) === false) {
      return t('sensorOffline', lang, { name: sensor.name });
    }
    const values = stateOf(sensor).reading ? valuesLine(viewOf(sensor), lang) : '';
    return values ? t('sensorLine', lang, { name: sensor.name, values }) : sensor.name;
  }

  /**
   * @description The problems of the configuration itself.
   * @param {string} lang - The language.
   * @returns {string} The text, '' when none.
   */
  function configProblems(lang) {
    return [
      config.invalid.length ? t('errInvalidIds', lang, { list: config.invalid.join(', ') }) : '',
      config.extra ? t('errTooMany', lang, { count: config.extra }) : '',
      config.phoneInvalid ? t('errPhoneFormat', lang) : '',
      config.phoneId && phoneRejected ? t('errPhone', lang) : '',
    ]
      .filter(Boolean)
      .join(' ');
  }

  /**
   * @description Work out the connection status from the last readings.
   * @returns {Promise<void>}
   */
  async function refreshStatus() {
    const each = (build) => Object.fromEntries(LANGUAGES.map((lang) => [lang, build(lang)]));
    if (sensors.length === 0) {
      await reportStatus(
        false,
        each((lang) => [configProblems(lang), t('statusNoSensor', lang)].filter(Boolean).join(' ')),
      );
      return;
    }
    if (paused()) {
      await reportStatus(
        false,
        each((lang) => errorText({ kind: pause.kind }, lang)),
      );
      return;
    }
    if (roundError) {
      await reportStatus(
        false,
        each((lang) => errorText(roundError, lang)),
      );
      return;
    }
    const failing = sensors.filter((sensor) => stateOf(sensor).error);
    const problems = configProblems('en');
    if (failing.length > 0 || problems) {
      const ok = sensors.length - failing.length;
      await reportStatus(
        ok > 0,
        all('statusSomeFailing', (lang) => ({
          ok,
          total: sensors.length + config.invalid.length,
          detail: [
            failing.length ? errorText(stateOf(failing[0]).error, lang, failing[0]) : '',
            configProblems(lang),
          ]
            .filter(Boolean)
            .join(' '),
        })),
      );
      return;
    }
    await reportStatus(
      true,
      all('statusConnected', (lang) => ({
        sensors: sensors.map((sensor) => sensorLine(sensor, lang)).join(' · '),
      })),
    );
  }

  /**
   * @description Refresh the list of the devices the user created.
   * @returns {Promise<void>}
   */
  async function refreshCreatedDevices() {
    try {
      const list = await gladys.getDevices();
      createdDevices = new Set(list.map((device) => device.external_id));
    } catch (err) {
      logger.warn(`Unable to read the devices: ${err.message}`);
    }
  }

  /**
   * @description Ask the open widgets to pull their content again.
   */
  function refreshWidgets() {
    for (const key of Object.values(WIDGETS)) {
      Promise.resolve(gladys.requestWidgetRefresh(key)).catch(() => {});
    }
  }

  /**
   * @description Publish scene events, one by one.
   * @param {Array<{ key: string, data: object }>} events - The events.
   * @returns {Promise<void>}
   */
  async function publishEvents(events) {
    for (const { key, data } of events) {
      logger.info(
        `Mobile Alerts ${data.name}: ${key} (${data.press ?? data.alert ?? data.state ?? ''})`,
      );
      try {
        await gladys.publishSceneEvent(key, data);
      } catch (err) {
        logger.warn(`Unable to fire ${key}: ${err.message}`);
      }
    }
  }

  // --- Sensors -----------------------------------------------------------------------

  /**
   * @description The configured sensors.
   */
  function resolveSensors() {
    const lang = textLanguage();
    sensors = config.ids.map((id, index) => {
      const key = deviceKey(id);
      const sensor = {
        id,
        key,
        position: index + 1,
        suffix: id.slice(-4),
        type: typeOf(id),
        kind: kindOf(id),
        deviceId: idsOf(gladys, key).device,
      };
      sensor.name = sensorName(sensor, lang);
      return sensor;
    });
  }

  /**
   * @description Offer a device per sensor that answered, when they changed.
   * @param {boolean} [force] - Publish even when unchanged.
   * @returns {Promise<number>} How many devices were offered.
   */
  async function publishDiscoveredDevices(force = false) {
    const lang = textLanguage();
    const list = sensors
      .filter((sensor) => (stateOf(sensor).features ?? []).length > 0)
      .map((sensor) =>
        buildDevice(gladys, { ...sensor, features: stateOf(sensor).features }, lang),
      );
    const signature = JSON.stringify(list);
    if (force || signature !== lastDiscovery) {
      await gladys.publishDiscoveredDevices(list);
      lastDiscovery = signature;
    }
    return list.length;
  }

  /**
   * @description Publish the states of a sensor, when it exists in Gladys.
   * @param {object} sensor - The sensor.
   * @returns {Promise<void>}
   */
  async function publishStates(sensor) {
    if (!createdDevices.has(sensor.deviceId)) {
      return;
    }
    const states = buildStates(
      gladys,
      { key: sensor.key, features: stateOf(sensor).features },
      stateOf(sensor).reading ?? null,
    );
    if (states.length) {
      await gladys
        .publishChangedStates(states)
        .catch((err) =>
          logger.warn(`Unable to publish the states of ${sensor.name}: ${err.message}`),
        );
    }
  }

  // --- Reading -----------------------------------------------------------------------

  /**
   * @description Handle an error that stops the round (network, server, a pause).
   * @param {Error} err - The error.
   * @throws {MobileAlertsError} Always, normalized.
   */
  function roundFailed(err) {
    const error =
      err instanceof MobileAlertsError
        ? err
        : new MobileAlertsError('failed', String(err?.message));
    logger.warn(`Mobile Alerts (${error.kind}): ${error.message}`);
    if (error.kind === 'blocked') {
      pause = { until: now() + BLOCKED_MS, kind: 'blocked' };
      invalidCalls = [];
    } else if (error.kind === 'rate_limit') {
      pause = { until: now() + RATE_LIMIT_MS, kind: 'rate_limit' };
    } else {
      roundError = { kind: error.kind, message: error.message };
    }
    throw error;
  }

  /**
   * @description One request; an invalid one is counted against the limit of the server.
   * @param {string[]} ids - The ids.
   * @param {string} phoneId - The phone id, '' for none.
   * @returns {Promise<object[]>} The raw devices.
   */
  async function request(ids, phoneId) {
    try {
      return await api.lastMeasurements(ids, { phoneId });
    } catch (err) {
      if (err.kind === 'invalid') {
        invalidCalls.push(now());
      }
      throw err;
    }
  }

  /**
   * @description Leave an id the server does not know out of the next rounds.
   * @param {object} sensor - The sensor.
   * @param {string} message - The error message.
   */
  function markUnknown(sensor, message) {
    const state = stateOf(sensor);
    state.unknown = true;
    state.error = { kind: 'unknown', message };
    logger.warn(`Mobile Alerts sensor …${sensor.suffix}: unknown to the server`);
  }

  /**
   * @description Read ids one by one, while the limit of the server allows it.
   * Without the phone id: the alerts of these sensors wait for the next round.
   * @param {object[]} list - The sensors.
   * @returns {Promise<object[]>} The raw devices that answered.
   */
  async function isolate(list) {
    const answered = [];
    for (const sensor of list) {
      const state = stateOf(sensor);
      if (!invalidBudget()) {
        state.error = { kind: 'checking', message: 'Checked later' };
        continue;
      }
      try {
        // Without the phone id: a refused id is then the id itself.
        answered.push(...(await request([sensor.id], '')));
      } catch (err) {
        if (err.kind !== 'invalid') {
          roundFailed(err);
        }
        markUnknown(sensor, err.message);
      }
    }
    return answered;
  }

  /**
   * @description Read some sensors in one request; a refused one is split.
   * @param {object[]} list - The sensors.
   * @returns {Promise<object[]>} The raw devices that answered.
   */
  async function readChunk(list) {
    const ids = list.map((sensor) => sensor.id);
    const phone = phoneActive() ? config.phoneId : '';
    try {
      return await request(ids, phone);
    } catch (err) {
      if (err.kind !== 'invalid') {
        roundFailed(err);
      }
    }
    let withoutPhone = !phone;
    if (phone && invalidBudget()) {
      // The phone id may be the one refused: try once without it.
      try {
        const answered = await request(ids, '');
        phoneRejected = true;
        logger.warn('Mobile Alerts: the phone id was refused, the alerts of the app are not read');
        return answered;
      } catch (err) {
        if (err.kind !== 'invalid') {
          roundFailed(err);
        }
        withoutPhone = true;
      }
    }
    if (list.length === 1 && withoutPhone) {
      // That id alone was refused, with and without a phone id: it is unknown.
      markUnknown(list[0], 'HTTP 400');
      return [];
    }
    return isolate(list);
  }

  /**
   * @description What follows a new reading of a sensor: values, events, states.
   * @param {object} sensor - The sensor.
   * @param {object} parsed - The parsed device (sensors.js).
   * @param {boolean} quiet - Publish the states only: the transitions are left
   * to the next round of the timer (a scene action never fires an event).
   * @returns {Promise<void>}
   */
  async function digest(sensor, parsed, quiet) {
    const state = stateOf(sensor);
    const seen = store.data.seen;
    const fresh =
      (parsed.idx ?? parsed.at) !== seen.idx[sensor.key] && (parsed.idx ?? parsed.at) !== null;
    const live = !quiet && gladys.connected !== false;
    // The id stays out of /data: the hashed key is enough there.
    const kept = { ...parsed };
    delete kept.id;
    if (Number.isFinite(parsed.values.rain_total)) {
      if (live && fresh) {
        state.rain = addSample(state.rain, parsed.at, parsed.values.rain_total, now());
      }
      kept.rain = rainOf(state.rain, now());
    }
    state.reading = kept;
    state.readAt = now();
    state.error = null;
    state.unknown = false;
    state.features = [...new Set([...(state.features ?? []), ...givenKeysOf(kept)])];
    const events = [];
    if (live && fresh) {
      seen.idx[sensor.key] = parsed.idx ?? parsed.at;
      if (parsed.buttons) {
        const { next, presses } = detectPresses(seen.buttons[sensor.key], parsed.buttons);
        seen.buttons[sensor.key] = next;
        if (presses.length) {
          const last = presses[presses.length - 1];
          state.lastPress = { button: last.button, press: last.press, at: parsed.at };
          if (createdDevices.has(sensor.deviceId)) {
            // A press is an event, not a value: two short presses in a row
            // must both reach the scenes, so no deduplication here.
            await gladys
              .publishStates(buttonStates(gladys, sensor.key, presses))
              .catch((err) => logger.warn(`Unable to publish a press: ${err.message}`));
          }
          events.push(
            ...presses.map((press) => ({
              key: TRIGGERS.BUTTON_PRESSED,
              data: pressData(sensor, press),
            })),
          );
        }
      }
      if (kept.rain && rainStarted(state.rain)) {
        events.push({ key: TRIGGERS.RAIN_STARTED, data: rainData(sensor, kept.rain) });
      }
      if (phoneActive()) {
        const alerts = detectAlerts(seen.alerts[sensor.key], activeAlerts(parsed));
        seen.alerts[sensor.key] = alerts.next;
        const lang = textLanguage();
        const label = (kind) => t(`alert_${kind}`, lang);
        for (const [list, name] of [
          [alerts.started, 'started'],
          [alerts.ended, 'ended'],
        ]) {
          events.push(
            ...list.map((alert) => ({
              key: TRIGGERS.APP_ALERT,
              data: alertData(sensor, alert, name, kept, label),
            })),
          );
        }
      } else {
        // Without the phone id, the next alerts start from a new baseline.
        delete seen.alerts[sensor.key];
      }
    }
    await publishEvents(events);
    await publishStates(sensor);
  }

  /**
   * @description Whether each sensor is seen by the server: an event when it stops or starts again.
   * @returns {Promise<void>}
   */
  async function checkConnections() {
    const events = [];
    for (const sensor of sensors) {
      const at = stateOf(sensor).reading?.lastSeen;
      if (!Number.isFinite(at)) {
        continue;
      }
      const seen = store.data.seen.online;
      const connection = detectConnection(seen[sensor.key], at, now());
      seen[sensor.key] = connection.online;
      if (connection.changed && gladys.connected !== false) {
        events.push({
          key: TRIGGERS.CONNECTION_CHANGED,
          data: connectionData(sensor, connection.online, at, {
            language: textLanguage(),
            timeZone,
            now: now(),
          }),
        });
      }
    }
    await publishEvents(events);
  }

  /**
   * @description Read every sensor (one round at a time).
   * @param {object} [options] - `{ user, quiet }`: asked by the user (Read
   * now, a button, a scene action) checks the unknown ids again; `quiet` (a
   * scene action) fires no event.
   * @returns {Promise<number>} How many sensors answered.
   */
  function readSensors({ user = false, quiet = false } = {}) {
    if (!reading) {
      reading = (async () => {
        if (sensors.length === 0 || paused()) {
          await refreshStatus();
          return 0;
        }
        const known = sensors.filter((sensor) => !stateOf(sensor).unknown);
        const unknown = user ? sensors.filter((sensor) => stateOf(sensor).unknown) : [];
        const answered = new Map();
        try {
          for (const list of chunks(known)) {
            for (const raw of await readChunk(list)) {
              const parsed = parseDevice(raw);
              if (parsed) {
                answered.set(parsed.id, parsed);
              }
            }
          }
          for (const raw of await isolate(unknown)) {
            const parsed = parseDevice(raw);
            if (parsed) {
              answered.set(parsed.id, parsed);
            }
          }
          roundError = null;
        } catch {
          // roundFailed logged it and set the status.
        }
        for (const sensor of sensors) {
          const parsed = answered.get(sensor.id);
          if (parsed) {
            await digest(sensor, parsed, quiet);
          }
        }
        if (!quiet) {
          await checkConnections();
        }
        await store.save();
        if (answered.size) {
          await publishDiscoveredDevices().catch((err) =>
            logger.warn(`Unable to offer the devices: ${err.message}`),
          );
          refreshWidgets();
        }
        await refreshStatus();
        return answered.size;
      })().finally(() => {
        reading = null;
      });
    }
    return reading;
  }

  /**
   * @description (Re)arm the reading timer.
   */
  function schedule() {
    clearInterval(timer);
    if (!timers || stopped) {
      return;
    }
    timer = setInterval(() => {
      readSensors().catch((err) => logger.error('Readings', err));
    }, config.refreshMinutes * MINUTE_MS);
    timer.unref?.();
  }

  /**
   * @description Resolve the sensors, read them, offer them.
   * @returns {Promise<void>}
   */
  async function applyConfig() {
    roundError = null;
    resolveSensors();
    logger.info(
      `${sensors.length} sensor(s) configured` +
        (config.invalid.length ? `; ${config.invalid.length} piece(s) are not sensor ids` : '') +
        (config.phoneId ? '; phone id set' : ''),
    );
    await publishDiscoveredDevices().catch((err) =>
      logger.warn(`Unable to offer the devices: ${err.message}`),
    );
    await readSensors();
    for (const sensor of sensors) {
      await publishStates(sensor);
    }
    await refreshStatus();
    schedule();
  }

  /**
   * @description The sensor a widget or a scene action targets.
   * @param {unknown} externalId - The `source: "devices"` value.
   * @param {Function} [fits] - `(sensor) => boolean`: the sensors to fall back on.
   * @returns {object|null} The sensor, the first fitting one by default.
   */
  function target(externalId, fits = () => true) {
    const key = keyOfExternalId(externalId);
    return (
      sensors.find((sensor) => sensor.key === key) ?? sensors.find((sensor) => fits(sensor)) ?? null
    );
  }

  const gives = (feature) => (sensor) => (stateOf(sensor).features ?? []).includes(feature);

  // --- Dashboard widgets -------------------------------------------------------------

  gladys.onWidgetGet(WIDGETS.SENSORS, async ({ language: lang }) => {
    rememberLanguage(lang);
    if (sensors.length === 0) {
      return messageContent(t('noSensorWidget', lang));
    }
    return buildSensorsWidget({
      sensors: sensors.map((sensor) => ({
        ...viewOf(sensor),
        name: sensorName(sensor, lang),
      })),
      language: lang,
      timeZone,
    });
  });

  gladys.onWidgetGet(WIDGETS.WEATHER, async ({ settings = {}, language: lang }) => {
    rememberLanguage(lang);
    const rainSensor = target(settings.rain_device, gives('rain_24h'));
    const windSensor = target(settings.wind_device, gives('wind_speed'));
    const rain = rainSensor && gives('rain_24h')(rainSensor) ? rainSensor : null;
    const wind = windSensor && gives('wind_speed')(windSensor) ? windSensor : null;
    return buildWeatherWidget({
      rain: rain
        ? {
            name: sensorName(rain, lang),
            reading: stateOf(rain).reading,
            hourly: hourlyRain(stateOf(rain).rain, now()),
          }
        : null,
      wind: wind ? { name: sensorName(wind, lang), reading: stateOf(wind).reading } : null,
      language: lang,
      timeZone,
    });
  });

  gladys.onWidgetAction(WIDGETS.SENSORS, async (actionKey) => {
    if (actionKey !== WIDGET_ACTIONS.REFRESH) {
      throw new Error(`Unknown action ${actionKey}`);
    }
    if (sensors.length === 0) {
      return all('noSensorWidget');
    }
    const last = Math.max(...sensors.map((sensor) => stateOf(sensor).readAt ?? 0));
    if (now() - last < REFRESH_MIN_AGE_MS) {
      return all('refreshCached');
    }
    if (paused()) {
      return Object.fromEntries(
        LANGUAGES.map((lang) => [lang, errorText({ kind: pause.kind }, lang).slice(0, 200)]),
      );
    }
    const count = await readSensors({ user: true });
    if (roundError) {
      return Object.fromEntries(
        LANGUAGES.map((lang) => [lang, errorText(roundError, lang).slice(0, 200)]),
      );
    }
    return all('refreshDone', { count });
  });

  // --- Scene action ------------------------------------------------------------------
  gladys.onSceneAction(SCENE_ACTIONS.READ_SENSOR, async (fields = {}) => {
    const sensor = target(fields.device);
    if (!sensor) {
      throw new Error('No Mobile Alerts sensor is configured');
    }
    if (!stateOf(sensor).readAt || now() - stateOf(sensor).readAt > FRESH_MS) {
      await readSensors({ user: true, quiet: true });
    }
    const state = stateOf(sensor);
    const last = state.reading;
    if (!last) {
      throw new Error(
        `Mobile Alerts could not be read: ${state.error?.message ?? roundError?.message ?? 'no reading yet'}`,
      );
    }
    const lang = textLanguage();
    const online = onlineOf(sensor);
    const v = last.values ?? {};
    const summary = [
      `${t('sensorLine', lang, { name: sensor.name, values: valuesLine(viewOf(sensor), lang) || '–' })}.`,
      last.lowBattery ? t('summaryBattery', lang) : '',
      online === false
        ? t('summaryOffline', lang, {
            time: formatTime(last.lastSeen, { language: lang, timeZone }),
          })
        : '',
    ]
      .filter(Boolean)
      .join(' ');
    return pick(
      {
        name: sensor.name,
        kind: sensor.kind,
        temperature: round(v.temperature),
        humidity: round(v.humidity),
        temperature_2: round(v.temperature_2),
        humidity_2: round(v.humidity_2),
        co2: round(v.co2, 0),
        pressure: round(v.pressure),
        rain_1h: round(last.rain?.hour),
        rain_24h: round(last.rain?.day),
        wind_speed: round(v.wind_speed),
        wind_gust: round(v.wind_gust),
        wind_direction: round(v.wind_direction),
        wind_direction_name: sectorText(v.wind_direction, lang),
        window: typeof v.open === 'boolean' ? (v.open ? 'open' : 'closed') : '',
        battery_low: typeof last.lowBattery === 'boolean' ? last.lowBattery : null,
        measured_at: Number.isFinite(last.at) ? new Date(last.at).toISOString() : null,
        connection: online === false ? 'offline' : 'online',
        summary,
      },
      SENSOR_OUTPUTS,
    );
  });

  // --- Configuration screen actions --------------------------------------------------
  gladys.onAction(ACTIONS.READ_NOW, async () => {
    if (sensors.length === 0) {
      return Object.fromEntries(
        LANGUAGES.map((lang) => [
          lang,
          [configProblems(lang), t('statusNoSensor', lang)].filter(Boolean).join(' '),
        ]),
      );
    }
    if (paused()) {
      return Object.fromEntries(
        LANGUAGES.map((lang) => [lang, errorText({ kind: pause.kind }, lang)]),
      );
    }
    await readSensors({ user: true });
    if (paused() || roundError) {
      const err = paused() ? { kind: pause.kind } : roundError;
      return Object.fromEntries(LANGUAGES.map((lang) => [lang, errorText(err, lang)]));
    }
    return Object.fromEntries(
      LANGUAGES.map((lang) => {
        const lines = sensors.map((sensor) => {
          const state = stateOf(sensor);
          return state.error ? errorText(state.error, lang, sensor) : sensorLine(sensor, lang);
        });
        const problems = configProblems(lang);
        return [
          lang,
          `${t('readDone', lang, { sensors: lines.join(' · ') })}${problems ? ` ${problems}` : ''}`.slice(
            0,
            1000,
          ),
        ];
      }),
    );
  });

  gladys.onAction(ACTIONS.DIAGNOSTIC, async () => {
    const report = {
      version: VERSION,
      timeZone: timeZone ?? null,
      language: config.language,
      refreshMinutes: config.refreshMinutes,
      phoneId: config.phoneId ? (phoneRejected ? 'refused' : 'set') : 'none',
      invalidIds: config.invalid.length,
      extraIds: config.extra,
      requests,
      invalidRequests15min: invalidCalls.filter((at) => at > now() - INVALID_WINDOW_MS).length,
      paused: paused() ? `${pause.kind} until ${new Date(pause.until).toISOString()}` : null,
      roundError: roundError ? `${roundError.kind}: ${roundError.message}` : null,
      // Sensors by type and the end of their id: never the whole id.
      sensors: sensors.map((sensor) => {
        const state = stateOf(sensor);
        return {
          position: sensor.position,
          type: sensor.type,
          suffix: sensor.suffix,
          key: sensor.key,
          created: createdDevices.has(sensor.deviceId),
          measuredAt: Number.isFinite(state.reading?.at)
            ? new Date(state.reading.at).toISOString()
            : null,
          lastSeen: Number.isFinite(state.reading?.lastSeen)
            ? new Date(state.reading.lastSeen).toISOString()
            : null,
          values: state.reading ? Object.keys(state.reading.values ?? {}) : null,
          flags: state.reading ? Object.keys(state.reading.flags ?? {}).length : null,
          rainSamples: state.rain?.length ?? 0,
          features: state.features ?? [],
          unknown: Boolean(state.unknown),
          error: state.error ? `${state.error.kind}: ${state.error.message}` : null,
        };
      }),
    };
    const json = JSON.stringify(report);
    const count = Math.max(1, Math.ceil(json.length / DIAGNOSTIC_CHUNK));
    for (let chunk = 0; chunk < count; chunk += 1) {
      logger.info(
        `Mobile Alerts diagnostic ${chunk + 1}/${count}: ${json.slice(chunk * DIAGNOSTIC_CHUNK, (chunk + 1) * DIAGNOSTIC_CHUNK)}`,
      );
    }
    return all('diagnosticDone', { count });
  });

  // --- Devices -----------------------------------------------------------------------
  gladys.onScanRequest(async () => {
    resolveSensors();
    await readSensors({ user: true });
    const count = await publishDiscoveredDevices(true);
    logger.info(`Scan: ${count} device(s) offered`);
  });

  gladys.onDeviceCreated(async () => {
    await refreshCreatedDevices();
    // States sent before the device existed were dropped by Gladys, and the SDK
    // forgot what it sent for this device: send everything known again.
    for (const sensor of sensors) {
      await publishStates(sensor);
    }
    refreshWidgets();
  });

  gladys.onDeviceDeleted(refreshCreatedDevices);

  // --- Configuration -----------------------------------------------------------------

  /**
   * @description Reload the whole config (internal keys included).
   * @param {object} [fallback] - Raw values to use when the read fails.
   * @returns {Promise<void>}
   */
  async function loadConfig(fallback) {
    try {
      const raw = await gladys.getConfig();
      config = normalizeConfig(raw);
      language = readLanguage(raw, language);
    } catch (err) {
      if (fallback) {
        config = normalizeConfig(fallback);
      }
      logger.error('Unable to read the configuration', err);
    }
  }

  gladys.onConfigUpdated(async (rawConfig) => {
    await loadConfig(rawConfig);
    logger.info('Configuration updated');
    lastStatus = null;
    lastDiscovery = null;
    // New ids or a new phone id: check everything again.
    phoneRejected = false;
    for (const state of Object.values(store.data.devices)) {
      state.unknown = false;
      if (state.error?.kind === 'unknown' || state.error?.kind === 'checking') {
        state.error = null;
      }
    }
    await applyConfig();
  });

  // --- Connection lifecycle ----------------------------------------------------------
  // Each (re)connection resynchronizes; the promise lets the tests wait for it.
  let startup = Promise.resolve();
  gladys.on('connected', () => {
    startup = (async () => {
      await loadConfig();
      await store.load();
      await refreshCreatedDevices();
      lastStatus = null;
      lastDiscovery = null;
      await applyConfig();
    })().catch((err) => logger.error('Startup', err));
  });

  // --- Graceful shutdown -------------------------------------------------------------
  gladys.handleShutdown(async (signal) => {
    logger.info(`Received ${signal} -> graceful shutdown`);
    stopped = true;
    clearInterval(timer);
    await store.save();
  });

  return {
    store,
    api,
    readSensors,
    applyConfig,
    getSensors: () => sensors,
    getPause: () => pause,
    whenReady: () => startup,
  };
}

export {
  createApp,
  ACTIONS,
  SCENE_ACTIONS,
  INVALID_WINDOW_MS,
  INVALID_BUDGET,
  BLOCKED_MS,
  RATE_LIMIT_MS,
  REFRESH_MIN_AGE_MS,
  FRESH_MS,
};
