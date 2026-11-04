# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions
follow [Semantic Versioning](https://semver.org/). This file is generated at
each release from the Conventional Commits: do not edit it by hand.

## [0.1.0] - 2026-11-04

### Added

- **devices:** Mobile Alerts sensors through the official Mobile Alerts REST API, with the ids of the sensors and no account; one device each, offered once it answered, with what it measures: temperatures and humidities (probes and extra sensors included), air quality, pressure, rain of the last hour and of the last 24 hours, wind speed, gusts and direction, window contact, the four keys of a wireless switch, smoke alarms and low battery
- **scenes:** triggers when a key of a wireless switch is pressed (short, double, long), when it starts raining, when an alert set in the Mobile Alerts app starts or ends (with the phone id of the app), and when a sensor goes offline or comes back; an action that reads a sensor, with a ready-made sentence
- **widgets:** every sensor at a glance with its values, battery and alerts, with a Refresh button; rain and wind with the rain of each of the last 24 hours
- **configuration:** sensor ids, optional phone id, reading every 1 to 10 minutes, language, "Read now" and "Diagnostic" buttons; unknown ids are found one by one without ever going past the limits of the server
- **i18n:** English, French, German and Spanish for the manifest, the runtime texts, the documentation and the README

[0.1.0]: https://github.com/William-De71/gladys-mobile-alerts/releases/tag/v0.1.0
