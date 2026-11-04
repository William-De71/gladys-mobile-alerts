// -----------------------------------------------------------------------------
// What the integration keeps across restarts, in /data/mobile-alerts.json (the
// only writable place of the container), by sensor key (the hash of its id,
// never the id itself):
//   - `devices`   the last reading and when it was read, the rain counters of
//                 the last 25 hours (rain gauges), the features the sensor
//                 ever gave (they only grow: a feature never flaps);
//   - `seen`      what the scene triggers already know: the last measurement
//                 handled, the button counters, the active alerts of the app,
//                 online or not. A restart never fires twice.
// -----------------------------------------------------------------------------

import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const DEFAULT_PATH = '/data/mobile-alerts.json';
const SEEN_KEYS = ['idx', 'buttons', 'alerts', 'online'];
const EMPTY = () => ({
  devices: {},
  seen: Object.fromEntries(SEEN_KEYS.map((key) => [key, {}])),
});

/**
 * @description The store.
 * @param {object} [options] - `{ path, logger }`.
 * @returns {object} `{ data, load, save }`.
 */
function createStore({ path = DEFAULT_PATH, logger } = {}) {
  const store = {
    data: EMPTY(),
    /**
     * @description Read the file; an absent or broken file is an empty store.
     * @returns {Promise<void>}
     */
    async load() {
      try {
        const raw = JSON.parse(await readFile(path, 'utf8'));
        const part = (node) =>
          node && typeof node === 'object' && !Array.isArray(node) ? node : {};
        const value = part(raw);
        store.data.devices = { ...part(value.devices) };
        store.data.seen = Object.fromEntries(
          SEEN_KEYS.map((key) => [key, { ...part(part(value.seen)[key]) }]),
        );
      } catch (err) {
        if (err.code !== 'ENOENT') {
          logger?.warn(`Unable to read ${path}: ${err.message}`);
        }
      }
    },
    /**
     * @description Write the file (atomically: a temporary file, then a rename).
     * @returns {Promise<void>}
     */
    async save() {
      try {
        await mkdir(dirname(path), { recursive: true });
        const temporary = `${path}.tmp`;
        await writeFile(temporary, JSON.stringify(store.data));
        await rename(temporary, path);
      } catch (err) {
        logger?.warn(`Unable to write ${path}: ${err.message}`);
      }
    },
  };
  return store;
}

export { DEFAULT_PATH, SEEN_KEYS, createStore };
