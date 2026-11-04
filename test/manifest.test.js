// The manifest against the code: the keys it declares are the ones the code
// handles, the store limits hold, the transport and permissions are right.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

import { TRIGGERS, SENSOR_OUTPUTS, ALERT_KINDS, PRESSES } from '../src/events.js';
import { SCENE_ACTIONS, ACTIONS } from '../src/app.js';
import { WIDGETS } from '../src/widgets.js';
import { AUTO_LANGUAGE, INTERNAL_KEYS, REFRESH_MINUTES, DEFAULT_REFRESH } from '../src/config.js';
import { BUTTONS } from '../src/sensors.js';
import { LANGUAGES, TEXTS } from '../src/i18n.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const manifest = read('../gladys-assistant-integration.json');
const pkg = read('../package.json');
const byKey = (list) => new Map(list.map((entry) => [entry.key, entry]));
const values = (field) => field.options.map((option) => option.value);
const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('a device integration, in lockstep with package.json, at 0.x until 1.0.0 is decided', () => {
  assert.equal(manifest.type, 'device');
  assert.equal(manifest.name, 'Mobile Alerts');
  assert.equal(manifest.version, pkg.version);
  assert.equal(manifest.docker_image, `ghcr.io/william-de71/gladys-mobile-alerts:${pkg.version}`);
  assert.equal(
    manifest.cover_image,
    'https://raw.githubusercontent.com/William-De71/gladys-mobile-alerts/main/cover.jpg',
  );
  assert.equal(pkg.license, 'Apache-2.0');
  assert.deepEqual(Object.keys(pkg.dependencies), ['@gladysassistant/integration-sdk']);
});

test('declares the cloud transport only: the Mobile Alerts server, over HTTPS', () => {
  assert.deepEqual(manifest.transports, ['cloud']);
  assert.doesNotMatch(source('../src/app.js'), /publishTransports|GLADYS_PREFER_LOCAL/);
  assert.match(source('../src/mobile-alerts-api.js'), /'https:\/\/www\.data199\.com\/api\/pv1'/);
});

test('requires Gladys 5.3.0 (catalog keywords); no permission', () => {
  assert.equal(manifest.gladys_version, '>=5.3.0');
  assert.deepEqual(manifest.categories, ['environment', 'climate']);
  for (const key of ['location', 'network_wake', 'containers', 'network_discovery', 'webhooks']) {
    assert.equal(manifest[key], undefined, key);
  }
});

test('declares exactly the scene triggers, actions and widgets the code handles', () => {
  assert.deepEqual(
    manifest.scene_triggers.map((x) => x.key).sort(),
    Object.values(TRIGGERS).sort(),
  );
  assert.deepEqual(
    manifest.scene_actions.map((x) => x.key),
    Object.values(SCENE_ACTIONS),
  );
  assert.deepEqual(manifest.widgets.map((x) => x.key).sort(), Object.values(WIDGETS).sort());
  assert.deepEqual(
    manifest.actions.map((x) => x.key),
    Object.values(ACTIONS),
  );
  const app = source('../src/app.js');
  for (const key of Object.keys(WIDGETS)) {
    assert.match(app, new RegExp(`onWidgetGet\\(WIDGETS\\.${key}`), key);
  }
  assert.match(app, /onWidgetAction\(WIDGETS\.SENSORS/);
  assert.doesNotMatch(app, /onWidgetAction\(WIDGETS\.WEATHER/, 'the weather card has no button');
  for (const key of Object.keys(SCENE_ACTIONS)) {
    assert.match(app, new RegExp(`onSceneAction\\(SCENE_ACTIONS\\.${key}`), key);
  }
  for (const key of Object.keys(ACTIONS)) {
    assert.match(app, new RegExp(`onAction\\(ACTIONS\\.${key}`), key);
  }
  assert.deepEqual(
    byKey(manifest.scene_actions)
      .get(SCENE_ACTIONS.READ_SENSOR)
      .outputs.map((o) => o.key),
    SENSOR_OUTPUTS,
  );
});

test('the configuration of the code: ids, the phone id as a secret, the refresh, the language', () => {
  const config = byKey(manifest.config_schema);
  assert.equal(config.get('sensors').type, 'string');
  assert.equal(config.get('phone_id').type, 'secret');
  assert.deepEqual(values(config.get('refresh')), REFRESH_MINUTES);
  assert.equal(config.get('refresh').default, DEFAULT_REFRESH);
  assert.equal(config.get(INTERNAL_KEYS.language), undefined);
  assert.deepEqual(values(config.get('language')), [AUTO_LANGUAGE, ...LANGUAGES]);
  assert.ok(
    config
      .get('intro')
      .links.every((link) => /^https:\/\/mobile-alerts\.eu\//.test(`${link.url}/`)),
  );
});

test('the trigger filters are the values the events carry', () => {
  for (const trigger of manifest.scene_triggers) {
    const fields = byKey(trigger.fields);
    assert.equal(fields.get('device').source, 'devices', trigger.key);
    const variables = trigger.variables.map((v) => v.key);
    for (const key of fields.keys()) {
      assert.ok(variables.includes(key), `${trigger.key}: ${key} is also a variable`);
    }
  }
  const triggers = byKey(manifest.scene_triggers);
  const button = byKey(triggers.get(TRIGGERS.BUTTON_PRESSED).fields);
  assert.deepEqual(values(button.get('button')), BUTTONS.map(String));
  assert.deepEqual(values(button.get('press')), PRESSES);
  const alert = byKey(triggers.get(TRIGGERS.APP_ALERT).fields);
  assert.deepEqual(values(alert.get('alert')), ALERT_KINDS);
  assert.deepEqual(values(alert.get('state')), ['started', 'ended']);
  for (const option of alert.get('alert').options) {
    assert.deepEqual(option.label, TEXTS[`alert_${option.value}`], option.value);
  }
  const connection = byKey(triggers.get(TRIGGERS.CONNECTION_CHANGED).fields);
  assert.deepEqual(values(connection.get('state')), ['offline', 'online']);
});

test('limits of the store: counts, timeouts, sizes, no secret in widget settings', () => {
  assert.ok(manifest.widgets.length >= 1 && manifest.widgets.length <= 5);
  for (const trigger of manifest.scene_triggers) {
    assert.ok(trigger.fields.length <= 10 && trigger.variables.length <= 20);
  }
  for (const action of manifest.scene_actions) {
    assert.ok(action.timeout_seconds >= 5 && action.timeout_seconds <= 120);
    assert.ok(action.outputs.length <= 20);
  }
  for (const widget of manifest.widgets) {
    for (const setting of widget.settings ?? []) {
      assert.ok(!['secret', 'oauth2', 'account_link'].includes(setting.type));
    }
  }
  for (const field of manifest.config_schema.filter((entry) => entry.type === 'section')) {
    for (const text of Object.values(field.description)) {
      assert.ok(text.length <= 1000, field.key);
    }
  }
  const size = statSync(new URL('../gladys-assistant-integration.json', import.meta.url)).size;
  assert.ok(size < 100 * 1024);
  const cover = readFileSync(new URL('../cover.jpg', import.meta.url));
  assert.ok(cover.length < 150 * 1024);
  assert.equal(cover.readUInt16BE(0), 0xffd8);
});

test('catalog of Gladys 5.3.0: search keywords within the store bounds, countries', () => {
  const { keywords } = manifest;
  assert.ok(Array.isArray(keywords) && keywords.length >= 1 && keywords.length <= 10);
  const normalized = keywords.map((keyword) => keyword.trim().toLowerCase());
  for (const keyword of normalized) {
    assert.ok(keyword.length >= 2 && keyword.length <= 30, keyword);
  }
  assert.equal(new Set(normalized).size, normalized.length, 'unique once trimmed and lowercased');
  assert.ok(!normalized.includes(manifest.name.toLowerCase()), 'never the name itself');
  assert.equal(manifest.countries, undefined, 'usable worldwide: no country list');
});
