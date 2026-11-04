// -----------------------------------------------------------------------------
// Dashboard widgets of the Mobile Alerts integration.
//
//   - `sensors`   every sensor at a glance: a list with its main values
//                 (temperature, humidity, rain, wind, window…) and a badge
//                 (offline, smoke, battery low, alert of the app, or the hour
//                 of the measurement), and a Refresh button;
//   - `weather`   the rain gauge and the anemometer: rain of the last hour and
//                 of the last 24 hours, wind, gusts and direction, and the
//                 rain of each of the last 24 hours as bars.
// Both credit Mobile Alerts. The weather widget takes the first rain gauge and
// the first anemometer unless the settings choose them.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { t, all, decimal, sectorText } from './i18n.js';
import { formatTime } from './time.js';

const WIDGETS = { SENSORS: 'sensors', WEATHER: 'weather' };
const WIDGET_ACTIONS = { REFRESH: 'refresh' };
const TTL_SECONDS = { content: 60, message: 300 };
const MAX_ITEMS = 12;
const KMH = 3.6;

/**
 * @description Truncate a text to a bound, with an ellipsis.
 * @param {string} value - The text.
 * @param {number} max - The bound.
 * @returns {string} The text.
 */
function clip(value, max) {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * @description A sensor name without the brand, which the caption already gives.
 * @param {string} name - "Mobile Alerts rain gauge D4E5".
 * @returns {string} "rain gauge D4E5", capitalized: "Rain gauge D4E5".
 */
function shortName(name) {
  const short = String(name ?? '').replace(/^Mobile Alerts /, '');
  return short.charAt(0).toLocaleUpperCase() + short.slice(1);
}

/**
 * @description The Refresh button.
 * @returns {object} The button.
 */
const refreshButton = () => ({
  type: 'button',
  label: all('buttonRefresh'),
  icon: 'refresh-cw',
  action: { key: WIDGET_ACTIONS.REFRESH },
});

/**
 * @description A widget content made of one message.
 * @param {string} message - The message.
 * @param {object} [options] - `{ ttl, refresh }`.
 * @returns {object} The content.
 */
function messageContent(message, { ttl = TTL_SECONDS.message, refresh = false } = {}) {
  const components = [{ type: 'text', variant: 'body', text: clip(message, 300) }];
  if (refresh) {
    components.push(refreshButton());
  }
  return { ttl_seconds: ttl, components };
}

/**
 * @description A wind speed in km/h, for a person.
 * @param {number} metersPerSecond - The speed.
 * @param {string} language - The language.
 * @returns {string} "12 km/h".
 */
const windText = (metersPerSecond, language) =>
  `${decimal(metersPerSecond * KMH, language, 0)} km/h`;

/**
 * @description The main values of a sensor, on one line.
 * @param {object} sensor - `{ reading, lastPress }`.
 * @param {string} language - The language.
 * @returns {string} "21,4 °C · 54 %".
 */
function valuesLine(sensor, language) {
  const reading = sensor.reading;
  const v = reading?.values ?? {};
  const parts = [];
  if (Number.isFinite(v.temperature)) {
    parts.push(`${decimal(v.temperature, language)} °C`);
  }
  if (Number.isFinite(v.humidity)) {
    parts.push(`${decimal(v.humidity, language, 0)} %`);
  }
  for (const probe of [2, 3, 4]) {
    if (Number.isFinite(v[`temperature_${probe}`])) {
      parts.push(
        t('probeValue', language, {
          probe,
          value: `${decimal(v[`temperature_${probe}`], language)} °C`,
        }),
      );
    }
  }
  if (Number.isFinite(v.co2)) {
    parts.push(`${decimal(v.co2, language, 0)} ppm`);
  }
  if (Number.isFinite(v.pressure)) {
    parts.push(`${decimal(v.pressure, language, 0)} hPa`);
  }
  if (reading?.rain) {
    parts.push(t('rainValue', language, { value: decimal(reading.rain.day, language) }));
  }
  if (Number.isFinite(v.wind_speed)) {
    parts.push(
      [windText(v.wind_speed, language), sectorText(v.wind_direction, language)]
        .filter(Boolean)
        .join(' '),
    );
  }
  if (typeof v.open === 'boolean') {
    parts.push(t(v.open ? 'windowOpen' : 'windowClosed', language));
  }
  if (sensor.lastPress) {
    parts.push(
      t('lastPress', language, {
        button: sensor.lastPress.button,
        press: t(`press_${sensor.lastPress.press}`, language).toLocaleLowerCase(language),
      }),
    );
  }
  return parts.join(' · ');
}

/**
 * @description The badge of a sensor in the list.
 * @param {object} sensor - `{ reading, online, alerts }`.
 * @param {object} options - `{ language, timeZone }`.
 * @returns {object|undefined} `{ text, color }`.
 */
function badgeOf(sensor, { language, timeZone }) {
  const reading = sensor.reading;
  if (sensor.online === false) {
    return { text: clip(t('badgeOffline', language), 16), color: WIDGET_COLORS.DANGER };
  }
  if (reading?.values?.smoke === true) {
    return { text: clip(t('badgeSmoke', language), 16), color: WIDGET_COLORS.DANGER };
  }
  if (reading?.lowBattery === true) {
    return { text: clip(t('badgeBattery', language), 16), color: WIDGET_COLORS.WARNING };
  }
  if ((sensor.alerts ?? []).length > 0) {
    return { text: clip(t('badgeAlert', language), 16), color: WIDGET_COLORS.WARNING };
  }
  const time = formatTime(reading?.at, { language, timeZone });
  return time ? { text: time, color: WIDGET_COLORS.NEUTRAL } : undefined;
}

/**
 * @description The "sensors" widget.
 * @param {object} options - Options.
 * @param {object[]} options.sensors - `{ name, reading, online, alerts, lastPress, error }`.
 * @param {string} options.language - The user language.
 * @param {string} [options.timeZone] - IANA timezone.
 * @returns {object} The content.
 */
function buildSensorsWidget({ sensors, language, timeZone }) {
  const items = sensors.slice(0, MAX_ITEMS).map((sensor) => {
    const item = {
      title: clip(shortName(sensor.name), 60),
      subtitle: clip(
        sensor.reading ? valuesLine(sensor, language) || '–' : t('noReadingShort', language),
        60,
      ),
    };
    const badge = sensor.reading
      ? badgeOf(sensor, { language, timeZone })
      : sensor.error
        ? { text: clip(t('badgeError', language), 16), color: WIDGET_COLORS.DANGER }
        : undefined;
    if (badge) {
      item.badge = badge;
    }
    return item;
  });
  const extra = sensors.length - items.length;
  return {
    ttl_seconds: TTL_SECONDS.content,
    components: [
      {
        type: 'text',
        variant: 'caption',
        text: clip(
          `${t('sensorsCount', language, { count: sensors.length })}${
            extra > 0 ? ` (${t('moreSensors', language, { count: extra })})` : ''
          } · Mobile Alerts`,
          80,
        ),
      },
      { type: 'card-list', display: 'list', items },
      refreshButton(),
    ],
  };
}

/**
 * @description The "weather" widget.
 * @param {object} options - Options.
 * @param {object|null} options.rain - `{ name, reading, hourly }`: the rain
 * gauge, `hourly` the rain of each of the last 24 hours (rain.js).
 * @param {object|null} options.wind - `{ name, reading }`: the anemometer.
 * @param {string} options.language - The user language.
 * @param {string} [options.timeZone] - IANA timezone.
 * @returns {object} The content.
 */
function buildWeatherWidget({ rain, wind, language, timeZone }) {
  if (!rain && !wind) {
    return messageContent(t('noWeatherSensor', language));
  }
  const at = Math.max(rain?.reading?.at ?? 0, wind?.reading?.at ?? 0) || null;
  const time = formatTime(at, { language, timeZone });
  const names = [rain?.name, wind?.name].filter(Boolean).map(shortName).join(' · ');
  const head = `Mobile Alerts${time ? ` · ${t('measuredAt', language, { time })}` : ''}`;
  const components = [{ type: 'text', variant: 'caption', text: clip(`${head} · ${names}`, 80) }];
  const measured = rain?.reading?.rain;
  if (rain) {
    components.push(
      {
        type: 'value',
        value: measured ? decimal(measured.hour, language) : '–',
        unit: 'mm',
        label: clip(t('tileRainHour', language), 24),
        icon: 'cloud-rain',
        ...(measured?.raining ? { color: WIDGET_COLORS.INFO } : {}),
      },
      {
        type: 'value',
        value: measured ? decimal(measured.day, language) : '–',
        unit: 'mm',
        label: clip(t('tileRainDay', language), 24),
      },
    );
  }
  const v = wind?.reading?.values ?? {};
  if (wind) {
    components.push({
      type: 'value',
      value: Number.isFinite(v.wind_speed) ? decimal(v.wind_speed * KMH, language, 0) : '–',
      unit: 'km/h',
      label: clip(t('tileWind', language), 24),
      icon: 'wind',
    });
    if (Number.isFinite(v.wind_gust)) {
      components.push({
        type: 'value',
        value: decimal(v.wind_gust * KMH, language, 0),
        unit: 'km/h',
        label: clip(t('tileGust', language), 24),
      });
    }
    if (Number.isFinite(v.wind_direction)) {
      components.push({
        type: 'value',
        value: sectorText(v.wind_direction, language),
        label: clip(t('tileDirection', language), 24),
        icon: 'navigation',
      });
    }
  }
  if (rain && measured) {
    components.push({
      type: 'chart',
      chart_type: 'bar',
      unit: 'mm',
      series: [
        {
          name: clip(t('seriesRain', language), 24),
          points: (rain.hourly ?? []).map((hour) => ({
            t: new Date(hour.at).toISOString(),
            v: hour.mm,
          })),
        },
      ],
    });
  } else if (rain) {
    components.push({ type: 'text', variant: 'body', text: clip(t('rainWaiting', language), 300) });
  }
  return { ttl_seconds: TTL_SECONDS.content, components };
}

export {
  WIDGETS,
  WIDGET_ACTIONS,
  TTL_SECONDS,
  MAX_ITEMS,
  clip,
  shortName,
  messageContent,
  valuesLine,
  badgeOf,
  buildSensorsWidget,
  buildWeatherWidget,
};
