// Builds the widget contents of the illustrations with the integration's own
// code: node gen.mjs <repo> <out.json> (run by render.sh)
//
// The two widgets for a home with eight Mobile Alerts sensors, on 2026-11-04
// at 18:20 in Paris: the measurements are the ones of the fake server of the
// tests (after the examples of the API documentation), parsed by the real
// parser (src/sensors.js); the rain gauge counted an afternoon shower, worked
// out by src/rain.js from a counter read every 10 minutes for 25 hours.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const [repo, out] = process.argv.slice(2);
const load = (path) => import(pathToFileURL(`${repo}/${path}`).href);
const { buildSensorsWidget, buildWeatherWidget } = await load('src/widgets.js');
const { parseDevice } = await load('src/sensors.js');
const { addSample, rainOf, hourlyRain } = await load('src/rain.js');
const { sensorName } = await load('src/device.js');
const { LANGUAGES } = await load('src/i18n.js');
const fake = await load('test/helpers/fake-api.js');
const { NOW, TZ } = fake;
const manifest = JSON.parse(readFileSync(`${repo}/gladys-assistant-integration.json`, 'utf8'));

const api = fake.fakeMobileAlerts();
// Illustration: a window left open, the last press of the switch, the probe
// of the cellar connected.
fake.measure(api, fake.CONTACT, NOW, { w: true });
fake.measure(api, fake.PROBE, NOW, { t2: 12.4 });
const raw = await (
  await api('https://www.data199.com/api/pv1/device/lastmeasurement', {
    method: 'POST',
    body: `deviceids=${Object.keys(api.sensors).join(',')}`,
  })
).text();
const devices = JSON.parse(raw).devices.map(parseDevice);

// The rain counter, every 10 minutes: a shower between 14:00 and 16:30.
let samples = [];
let total = 11.352;
for (let at = NOW - 25 * 3600000; at <= NOW - 60000; at += 600000) {
  const hour = new Date(at).getUTCHours() + new Date(at).getUTCMinutes() / 60;
  if (hour >= 13 && hour < 15.5) {
    total += 0.258 * (hour < 14 ? 1 : 2);
  }
  samples = addSample(samples, at, Math.round(total * 1000) / 1000, NOW);
}

const contents = {};
for (const language of LANGUAGES) {
  const sensors = devices.map((device) => {
    const reading = { ...device };
    if (Number.isFinite(device.values.rain_total)) {
      reading.rain = rainOf(samples, NOW);
    }
    return {
      name: sensorName({ kind: device.kind, suffix: device.id.slice(-4) }, language),
      reading,
      online: true,
      alerts: device.id === fake.CONTACT ? ['window_open:1'] : [],
      lastPress: device.id === fake.SWITCH ? { button: 2, press: 'double' } : null,
    };
  });
  const find = (id) => sensors[devices.findIndex((device) => device.id === id)];
  contents[language] = {
    sensors: buildSensorsWidget({ sensors, language, timeZone: TZ }),
    weather: buildWeatherWidget({
      rain: { ...find(fake.RAIN), hourly: hourlyRain(samples, NOW) },
      wind: find(fake.WIND),
      language,
      timeZone: TZ,
    }),
  };
}
const widgets = Object.fromEntries(
  manifest.widgets.map((w) => [w.key, { icon: w.icon, label: w.label }]),
);
writeFileSync(out, JSON.stringify({ now: NOW, widgets, contents }));
