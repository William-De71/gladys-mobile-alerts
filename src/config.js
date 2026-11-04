// -----------------------------------------------------------------------------
// Configuration of the Mobile Alerts integration.
//
// Fields of the config_schema:
//   - `sensors`    the ids of the sensors, 12 hexadecimal characters each (on
//                  the sticker of the sensor and in the Mobile Alerts app),
//                  separated by commas, spaces or new lines; up to 50;
//   - `phone_id`   optional: the phone id of the Mobile Alerts app (Settings
//                  of the app). With it, the server adds the alerts set in the
//                  app to the readings (and the smoke alarms of the alarm
//                  detectors). A `secret`: never sent back to the UI, never
//                  logged;
//   - `refresh`    minutes between two readings (1, 2, 5 or 10);
//   - `language`   language of the texts Gladys does not ask for in a
//                  language (device names, scene texts): `auto` follows the
//                  language of the last widget request.
//
// Internal key, outside the config_schema (never shown in the UI):
//   - `last_language`    language of the last widget request.
// -----------------------------------------------------------------------------

import { isLanguage } from './i18n.js';

const MAX_SENSORS = 50;
const AUTO_LANGUAGE = 'auto';
const INTERNAL_KEYS = { language: 'last_language' };
const REFRESH_MINUTES = ['1', '2', '5', '10'];
const DEFAULT_REFRESH = '2';

const readString = (raw) =>
  typeof raw === 'string' ? raw.trim() : typeof raw === 'number' ? String(raw) : '';

/**
 * @description Read the sensor ids typed by hand.
 * @param {unknown} raw - "0E7EA4A71203, 09265a8a3503".
 * @returns {{ ids: string[], invalid: string[], extra: number }} The ids,
 * uppercase, without duplicates (the first 50); the pieces that are not ids
 * (cut to 6 characters: enough to recognize a typo); how many were dropped
 * past 50.
 * @example
 * readSensorIds('0e7ea4a71203'); // -> { ids: ['0E7EA4A71203'], invalid: [], extra: 0 }
 */
function readSensorIds(raw) {
  const ids = [];
  const invalid = [];
  for (const piece of readString(raw).split(/[\s,;]+/)) {
    if (!piece) {
      continue;
    }
    const id = piece.toUpperCase().replace(/[-:]/g, '');
    if (!/^[0-9A-F]{12}$/.test(id)) {
      invalid.push(piece.slice(0, 6));
      continue;
    }
    if (!ids.includes(id)) {
      ids.push(id);
    }
  }
  return {
    ids: ids.slice(0, MAX_SENSORS),
    invalid,
    extra: Math.max(0, ids.length - MAX_SENSORS),
  };
}

/**
 * @description Read the phone id of the app.
 * @param {unknown} raw - The value.
 * @returns {{ phoneId: string, phoneInvalid: boolean }} The id ('' when none
 * or not one), and whether something that is not a phone id was given.
 */
function readPhoneId(raw) {
  const value = readString(raw).replace(/\s/g, '');
  if (!value) {
    return { phoneId: '', phoneInvalid: false };
  }
  return /^[0-9]{6,20}$/.test(value)
    ? { phoneId: value, phoneInvalid: false }
    : { phoneId: '', phoneInvalid: true };
}

/**
 * @description Normalize the raw config object from the host API.
 * @param {object} [rawConfig] - The raw config values.
 * @returns {object} `{ ids, invalid, extra, phoneId, phoneInvalid, refreshMinutes, language }`.
 * @example
 * normalizeConfig({ sensors: '0E7EA4A71203', refresh: '5' });
 */
function normalizeConfig(rawConfig = {}) {
  const config = rawConfig ?? {};
  const { ids, invalid, extra } = readSensorIds(config.sensors);
  const refresh = readString(config.refresh);
  return {
    ids,
    invalid,
    extra,
    ...readPhoneId(config.phone_id),
    refreshMinutes: Number(REFRESH_MINUTES.includes(refresh) ? refresh : DEFAULT_REFRESH),
    language: isLanguage(config.language) ? config.language : AUTO_LANGUAGE,
  };
}

/**
 * @description Read the stored language of the last request.
 * @param {object} [rawConfig] - The raw config values.
 * @param {string} fallback - The language to keep when nothing valid is stored.
 * @returns {string} The language.
 */
function readLanguage(rawConfig, fallback) {
  const language = (rawConfig ?? {})[INTERNAL_KEYS.language];
  return typeof language === 'string' && /^[a-z]{2}$/.test(language) ? language : fallback;
}

export {
  MAX_SENSORS,
  AUTO_LANGUAGE,
  INTERNAL_KEYS,
  REFRESH_MINUTES,
  DEFAULT_REFRESH,
  readSensorIds,
  readPhoneId,
  normalizeConfig,
  readLanguage,
};
