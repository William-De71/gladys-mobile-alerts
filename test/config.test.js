import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeConfig,
  readSensorIds,
  readPhoneId,
  readLanguage,
  MAX_SENSORS,
} from '../src/config.js';

test('sensor ids: uppercase, separators, duplicates, typos cut to 6 characters', () => {
  assert.deepEqual(readSensorIds('0e7ea4a71203, 09265A8A3503\n0E7EA4A71203;bad-id-here'), {
    ids: ['0E7EA4A71203', '09265A8A3503'],
    invalid: ['bad-id'],
    extra: 0,
  });
  assert.deepEqual(readSensorIds(undefined), { ids: [], invalid: [], extra: 0 });
  assert.deepEqual(readSensorIds('0E:7E:A4:A7:12:03').ids, ['0E7EA4A71203']);
});

test(`at most ${MAX_SENSORS} sensors`, () => {
  const ids = Array.from({ length: 53 }, (_, i) => `03${String(i).padStart(10, '0')}`);
  const read = readSensorIds(ids.join(','));
  assert.equal(read.ids.length, MAX_SENSORS);
  assert.equal(read.extra, 3);
});

test('phone id: digits only, empty is none', () => {
  assert.deepEqual(readPhoneId(' 880071013613 '), { phoneId: '880071013613', phoneInvalid: false });
  assert.deepEqual(readPhoneId(''), { phoneId: '', phoneInvalid: false });
  assert.deepEqual(readPhoneId('abc'), { phoneId: '', phoneInvalid: true });
});

test('defaults: every 2 minutes, automatic language', () => {
  const config = normalizeConfig();
  assert.equal(config.refreshMinutes, 2);
  assert.equal(config.language, 'auto');
  assert.equal(normalizeConfig({ refresh: '10' }).refreshMinutes, 10);
  assert.equal(normalizeConfig({ refresh: '3' }).refreshMinutes, 2);
  assert.equal(normalizeConfig({ language: 'fr' }).language, 'fr');
  assert.equal(readLanguage({ last_language: 'de' }, 'en'), 'de');
  assert.equal(readLanguage({ last_language: 'xyz' }, 'en'), 'en');
});
