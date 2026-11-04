# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

A Gladys Assistant **external integration** for the Mobile Alerts sensors
(Technoline, La Crosse, ELV…: temperature and humidity, rain gauges,
anemometers, window contacts, wireless switches, alarm detectors): a Node.js
service (Node 22+, ESM, no build step) that runs in its own sandboxed Docker
container and talks to Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js),
its only runtime dependency. It reads the official Mobile Alerts REST API
(`https://www.data199.com/api/pv1`, `POST /device/lastmeasurement`, no
account: the ids of the sensors, up to 50, and optionally the phone id of the
app for its alerts). Read only. Transport: cloud only. Reference:
https://mobile-alerts.eu/info/public_server_api_documentation.pdf.

What the server really does (checked 2026-11-04): one unknown id or phone id
fails the whole request with a 400; more than 5 invalid requests from an IP in
15 minutes block it (403) for the rest of the 15 minutes; more than 3 requests
for a sensor in a minute block that sensor 7 minutes (429); the battery flag
is `lowbattery`, not `lowbat` as documented.

## Commands

```bash
npm install
npm test                                  # node --test, the built-in runner
node --test test/widgets.test.js          # one file
DEBUG=gladys-integration-sdk npm test     # with the SDK debug logs
UPDATE_BASELINE=1 node --test test/structure.test.js   # ONLY with a documented migration
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npx github:GladysAssistant/integration-store . --skip-image-check   # store checks
scripts/build-cover.sh                    # cover.jpg from docs/assets/cover.svg
docs/illustrations/render.sh              # docs/assets/widgets.<lang>.png
node .github/scripts/release.mjs next     # the version the next release would get
```

## Architecture

```
index.js                  SDK wiring only (new GladysIntegration + createApp)
src/app.js                every handler, registered before connect(); the reading timer,
                          the split of refused requests within the invalid-request budget
src/mobile-alerts-api.js  HTTP client: form-encoded POST, error kinds, chunks of 20
src/sensors.js            sensor types (first two characters of the id), measurement keys -> values
src/rain.js               rain of the last hour / 24 hours from the counter, hourly bars, start of rain
src/events.js             scene trigger transitions (presses, alerts, offline), payloads, outputs
src/device.js             the devices (hashed ids), their features (they only grow) and states
src/widgets.js            "sensors" and "weather" dashboard widgets
src/store.js              /data/mobile-alerts.json: readings, rain counters, features, `seen`
src/time.js               formats in the timezone of Gladys
src/config.js             configuration (ids, phone id, refresh, language)
src/i18n.js               runtime texts, en / fr / de / es
gladys-assistant-integration.json   manifest
docs/{en,fr,de,es}.md     user documentation, re-hosted by the store
docs/illustrations/       generated widget images (render.sh, gen.mjs, render.js)
test/helpers/fake-api.js  the fake Mobile Alerts server behind the `fetch` option
.github/scripts/release.mjs         version, changelog, bump (tested in test/)
```

## Rules

- **External ids are forever**, and so is every key users store: device and
  feature external ids (`sensor:<first 12 hex digits of the SHA-256 of the
sensor id>`: never the id, a name nor a position), the feature keys, feature
  `category` / `type` / `unit` / `min` / `max` / `step`, the alert kinds, the
  keys of `config_schema`, `actions`, the widgets and their settings, scene
  triggers (fields, options, variables) and scene actions (fields, outputs).
  `test/structure.test.js` compares them to
  `test/fixtures/discovery.baseline.json`: never update the baseline to make a
  test pass without a documented migration.
- **Category / type pairs.** Temperature `temperature-sensor/decimal`, probes
  and extra sensors `temperature-sensor/probe`; humidity
  `humidity-sensor/decimal`; air quality `co2-sensor/integer` ppm; pressure
  hPa; rain `precipitation-sensor/decimal` mm/h and mm/day, raining
  `rain-sensor/binary`; wind `speed-sensor/decimal` m/s, direction
  `angle-sensor/decimal` degrees; window `opening-sensor/binary` (1 closed, 0
  open, OPENING_SENSOR_STATE); smoke `smoke-sensor/binary`; keys
  `button/click` (1 click, 2 double, 6 long: BUTTON_STATUS); battery
  `battery-low/binary`. 43530 (probe not connected) and 65295 (out of range)
  are never values. ID17 `t2` is the power, never a temperature.
- **Features never flap.** A device is offered once it answered; its features
  are the ones it ever gave, kept in /data, never removed.
- **Never past the limits of the server.** Every invalid request counts; never
  more than 4 in 15 minutes. A refused request is retried once without the
  phone id, then split id by id (without the phone id). An unknown id is left
  out until the configuration changes or "Read now". A 403 pauses 15 minutes,
  a 429 7 minutes.
- **Button presses are events.** They go out with `publishStates` (no
  deduplication: two short presses in a row must both reach the scenes) and as
  `button_pressed`. All other states go through `publishChangedStates`.
- **`should_poll` stays false**: the integration has its own timer (1, 2, 5 or
  10 minutes).
- **Privacy.** The sensor ids give access to their measurements: messages and
  the diagnostic name a sensor by the last four characters of its id, /data by
  its hashed key. The phone id is a secret, never logged.
- **Events once.** `seen` (in /data) keeps the last measurement handled
  (`idx`), the button counters, the active alerts, online or not. The first
  reading is a baseline. A scene action reads quietly and never fires an
  event: the next round of the timer does; a widget never fires one either.
- **Credit.** "Mobile Alerts" stays visible in the widgets; "Data provided by
  Mobile Alerts" in the README, the docs and NOTICE.
- **The container rootfs is read-only.** Write only under `/data`.
- **Four languages.** Every user-facing text (manifest, runtime messages in
  `src/i18n.js`, `docs/*.md`, README) exists in English, French, German and
  Spanish. `test/i18n.test.js` checks it. German uses "du", Spanish "usted",
  like the Gladys interface. The alert labels of the manifest are the ones of
  `src/i18n.js` (`test/manifest.test.js`).
- **Widget images.** After any change to the content of a widget, run
  `docs/illustrations/render.sh` again and look at the four PNG files.
- **Versions belong to the Release workflow**: never edit `version` in
  `package.json`, the lockfile or the manifest, nor the `docker_image` tag.
  The version stays below 1.0.0 until the maintainer runs the Release workflow
  with `release-as: 1.0.0`.
- **Changelog.** Never edit CHANGELOG.md by hand, it is generated at the
  release. Write the PR title as the line the user will read.
- **Commits and PR titles** follow Conventional Commits, in English: `feat` ->
  minor, `fix` / `perf` -> patch, `!` or `BREAKING CHANGE:` -> major (minor
  below 1.0.0); `docs`, `chore`, `ci`, `test`, `style`, `refactor`, `build`
  release nothing.
- **Manifest.** Texts are objects `{ "en", "fr", "de", "es" }`; the catalog
  `description` holds 10 to 100 characters per language; the file stays under
  100 KB. Transport: `["cloud"]`. No permission.
- **Forum drafts** (`.github/forum-*.md`) are never committed.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why,
  in English. Tests never touch the network (the fake server of
  `test/helpers/fake-api.js`).
