// -----------------------------------------------------------------------------
// Rain of a rain gauge (ID08).
//
// The sensor gives a counter: the rain fallen since its batteries went in
// (`r`, mm, 0.258 mm a flip). The integration keeps the counter of each new
// measurement for 25 hours (in /data) and works out from it:
//   - the rain of the last hour (mm/h) and of the last 24 hours (mm/day);
//   - whether it rains: rain fell within the last 30 minutes;
//   - the rain of each of the last 24 hours, for the widget chart.
// The rain between two measurements counts at the time of the later one. A
// counter that goes down (new batteries) starts again from its new value.
// -----------------------------------------------------------------------------

import { HOUR_MS, MINUTE_MS } from './time.js';

const KEEP_MS = 25 * HOUR_MS;
const RAINING_MS = 30 * MINUTE_MS;
// The rain_started trigger: rain after at least an hour without any.
const DRY_MS = HOUR_MS;
const MAX_SAMPLES = 1000;

/**
 * @description Add the counter of a new measurement to the samples.
 * @param {Array<{ at: number, total: number }>} samples - Oldest first.
 * @param {number} at - The instant of the measurement (ms).
 * @param {number} total - The counter (mm).
 * @param {number} now - Now (ms).
 * @returns {Array<{ at: number, total: number }>} The new samples (older than 25 h dropped).
 */
function addSample(samples, at, total, now) {
  const list = (Array.isArray(samples) ? samples : []).filter(
    (sample) => Number.isFinite(sample?.at) && Number.isFinite(sample?.total),
  );
  if (Number.isFinite(at) && Number.isFinite(total)) {
    const last = list[list.length - 1];
    if (!last || at > last.at) {
      list.push({ at, total });
    }
  }
  return list.filter((sample) => sample.at >= now - KEEP_MS).slice(-MAX_SAMPLES);
}

/**
 * @description The rain between consecutive samples: `{ at, mm }` at the later one.
 * @param {Array<{ at: number, total: number }>} samples - Oldest first.
 * @returns {Array<{ at: number, mm: number }>} The steps.
 */
function steps(samples) {
  const result = [];
  for (let index = 1; index < (samples ?? []).length; index += 1) {
    const mm = samples[index].total - samples[index - 1].total;
    // A counter that went down was reset: no rain counted for that step.
    result.push({ at: samples[index].at, mm: mm > 0 ? Math.round(mm * 1000) / 1000 : 0 });
  }
  return result;
}

/**
 * @description The rain since an instant.
 * @param {Array<{ at: number, total: number }>} samples - Oldest first.
 * @param {number} from - The instant (ms).
 * @returns {number} mm, rounded to 0.1.
 */
function rainSince(samples, from) {
  const mm = steps(samples)
    .filter((step) => step.at > from)
    .reduce((sum, step) => sum + step.mm, 0);
  return Math.round(mm * 10) / 10;
}

/**
 * @description The rain of the last hour, of the last 24 hours, and whether it rains.
 * @param {Array<{ at: number, total: number }>} samples - Oldest first.
 * @param {number} now - Now (ms).
 * @returns {{ hour: number, day: number, raining: boolean }|null} Null with
 * fewer than two samples (nothing to compare yet).
 */
function rainOf(samples, now) {
  if (!Array.isArray(samples) || samples.length < 2) {
    return null;
  }
  return {
    hour: rainSince(samples, now - HOUR_MS),
    day: rainSince(samples, now - 24 * HOUR_MS),
    raining: steps(samples).some((step) => step.mm > 0 && step.at > now - RAINING_MS),
  };
}

/**
 * @description Whether the last sample starts a rain: rain fell since the
 * previous sample, and none in the hour before.
 * @param {Array<{ at: number, total: number }>} samples - Oldest first.
 * @returns {boolean} True when it starts raining.
 */
function rainStarted(samples) {
  const list = steps(samples);
  const last = list[list.length - 1];
  if (!last || last.mm <= 0) {
    return false;
  }
  // The first step after a baseline may be the middle of a rain that started
  // before the integration looked: a start needs two steps at least.
  if (list.length < 2) {
    return false;
  }
  const previous = samples[samples.length - 2];
  return !list.slice(0, -1).some((step) => step.mm > 0 && step.at > previous.at - DRY_MS);
}

/**
 * @description The rain of each of the last 24 hours, for a chart.
 * @param {Array<{ at: number, total: number }>} samples - Oldest first.
 * @param {number} now - Now (ms).
 * @returns {Array<{ at: number, mm: number }>} 24 hours, oldest first; `at`
 * the start of the hour.
 */
function hourlyRain(samples, now) {
  const end = Math.floor(now / HOUR_MS) * HOUR_MS + HOUR_MS;
  const hours = Array.from({ length: 24 }, (unused, index) => ({
    at: end - (24 - index) * HOUR_MS,
    mm: 0,
  }));
  for (const step of steps(samples)) {
    const slot = hours.find((hour) => step.at > hour.at && step.at <= hour.at + HOUR_MS);
    if (slot) {
      slot.mm += step.mm;
    }
  }
  return hours.map((hour) => ({ at: hour.at, mm: Math.round(hour.mm * 10) / 10 }));
}

export {
  KEEP_MS,
  RAINING_MS,
  DRY_MS,
  addSample,
  steps,
  rainSince,
  rainOf,
  rainStarted,
  hourlyRain,
};
