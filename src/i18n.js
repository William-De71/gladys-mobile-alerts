// -----------------------------------------------------------------------------
// Texts of the integration, in English, French, German and Spanish (English
// fallback).
//
// The manifest carries its own labels; these are the texts the code writes at
// runtime: device and feature names, widget contents, statuses, scene texts.
// Vocabulary of the Gladys interface (appareil / Gerät / dispositivo); German
// says "du", Spanish "usted".
// -----------------------------------------------------------------------------

const LANGUAGES = ['en', 'fr', 'de', 'es'];

const TEXTS = {
  // devices
  deviceName: {
    en: 'Mobile Alerts {kind} {suffix}',
    fr: 'Mobile Alerts {kind} {suffix}',
    de: 'Mobile Alerts {kind} {suffix}',
    es: 'Mobile Alerts {kind} {suffix}',
  },
  kind_temperature: { en: 'thermometer', fr: 'thermomètre', de: 'Thermometer', es: 'termómetro' },
  kind_temperature_probe: {
    en: 'thermometer with probe',
    fr: 'thermomètre à sonde',
    de: 'Thermometer mit Fühler',
    es: 'termómetro con sonda',
  },
  kind_temperature_humidity: {
    en: 'thermo-hygrometer',
    fr: 'thermo-hygromètre',
    de: 'Thermo-Hygrometer',
    es: 'termohigrómetro',
  },
  kind_temperature_humidity_probe: {
    en: 'thermo-hygrometer with probe',
    fr: 'thermo-hygromètre à sonde',
    de: 'Thermo-Hygrometer mit Fühler',
    es: 'termohigrómetro con sonda',
  },
  kind_air_quality: {
    en: 'air quality sensor',
    fr: 'capteur de qualité de l’air',
    de: 'Luftgütesensor',
    es: 'sensor de calidad del aire',
  },
  kind_indoor_outdoor: {
    en: 'indoor/outdoor sensor',
    fr: 'capteur intérieur/extérieur',
    de: 'Innen-/Außensensor',
    es: 'sensor interior/exterior',
  },
  kind_rain: { en: 'rain gauge', fr: 'pluviomètre', de: 'Regenmesser', es: 'pluviómetro' },
  kind_alarm: {
    en: 'alarm detector',
    fr: 'détecteur d’alarme',
    de: 'Alarmmelder',
    es: 'detector de alarma',
  },
  kind_wind: { en: 'anemometer', fr: 'anémomètre', de: 'Windmesser', es: 'anemómetro' },
  kind_contact: {
    en: 'window contact',
    fr: 'contact de fenêtre',
    de: 'Fensterkontakt',
    es: 'contacto de ventana',
  },
  kind_multi: {
    en: 'multi-sensor',
    fr: 'capteur multiple',
    de: 'Mehrfachsensor',
    es: 'sensor múltiple',
  },
  kind_humidity_guard: {
    en: 'humidity guard',
    fr: 'contrôleur d’humidité',
    de: 'Feuchtewächter',
    es: 'control de humedad',
  },
  kind_buttons: {
    en: 'wireless switch',
    fr: 'interrupteur sans fil',
    de: 'Funkschalter',
    es: 'interruptor inalámbrico',
  },
  kind_power: {
    en: 'power outage sensor',
    fr: 'détecteur de coupure de courant',
    de: 'Stromausfallmelder',
    es: 'detector de corte de corriente',
  },
  kind_barometer: {
    en: 'thermo-hygro-barometer',
    fr: 'thermo-hygro-baromètre',
    de: 'Thermo-Hygro-Barometer',
    es: 'termo-higro-barómetro',
  },
  kind_sensor: { en: 'sensor', fr: 'capteur', de: 'Sensor', es: 'sensor' },
  featureTemperature: {
    en: 'Temperature',
    fr: 'Température',
    de: 'Temperatur',
    es: 'Temperatura',
  },
  featureTemperature2: {
    en: 'Temperature (probe 2)',
    fr: 'Température (sonde 2)',
    de: 'Temperatur (Fühler 2)',
    es: 'Temperatura (sonda 2)',
  },
  featureTemperature3: {
    en: 'Temperature (probe 3)',
    fr: 'Température (sonde 3)',
    de: 'Temperatur (Fühler 3)',
    es: 'Temperatura (sonda 3)',
  },
  featureTemperature4: {
    en: 'Temperature (probe 4)',
    fr: 'Température (sonde 4)',
    de: 'Temperatur (Fühler 4)',
    es: 'Temperatura (sonda 4)',
  },
  featureHumidity: { en: 'Humidity', fr: 'Humidité', de: 'Luftfeuchtigkeit', es: 'Humedad' },
  featureHumidity2: {
    en: 'Humidity (probe 2)',
    fr: 'Humidité (sonde 2)',
    de: 'Luftfeuchtigkeit (Fühler 2)',
    es: 'Humedad (sonda 2)',
  },
  featureHumidity3: {
    en: 'Humidity (probe 3)',
    fr: 'Humidité (sonde 3)',
    de: 'Luftfeuchtigkeit (Fühler 3)',
    es: 'Humedad (sonda 3)',
  },
  featureHumidity4: {
    en: 'Humidity (probe 4)',
    fr: 'Humidité (sonde 4)',
    de: 'Luftfeuchtigkeit (Fühler 4)',
    es: 'Humedad (sonda 4)',
  },
  featureCo2: {
    en: 'Air quality (CO₂ equivalent)',
    fr: 'Qualité de l’air (équivalent CO₂)',
    de: 'Luftqualität (CO₂-Äquivalent)',
    es: 'Calidad del aire (equivalente de CO₂)',
  },
  featurePressure: {
    en: 'Atmospheric pressure',
    fr: 'Pression atmosphérique',
    de: 'Luftdruck',
    es: 'Presión atmosférica',
  },
  featureRain1h: {
    en: 'Rain, last hour',
    fr: 'Pluie de la dernière heure',
    de: 'Regen der letzten Stunde',
    es: 'Lluvia de la última hora',
  },
  featureRain24h: {
    en: 'Rain, last 24 hours',
    fr: 'Pluie des dernières 24 heures',
    de: 'Regen der letzten 24 Stunden',
    es: 'Lluvia de las últimas 24 horas',
  },
  featureRaining: { en: 'Raining', fr: 'Pluie en cours', de: 'Regen', es: 'Lloviendo' },
  featureWindSpeed: {
    en: 'Wind speed',
    fr: 'Vitesse du vent',
    de: 'Windgeschwindigkeit',
    es: 'Velocidad del viento',
  },
  featureWindGust: { en: 'Wind gusts', fr: 'Rafales', de: 'Böen', es: 'Ráfagas' },
  featureWindDirection: {
    en: 'Wind direction',
    fr: 'Direction du vent',
    de: 'Windrichtung',
    es: 'Dirección del viento',
  },
  featureOpen: { en: 'Window', fr: 'Fenêtre', de: 'Fenster', es: 'Ventana' },
  featureSmoke: { en: 'Smoke', fr: 'Fumée', de: 'Rauch', es: 'Humo' },
  featureButton: {
    en: 'Button {button}',
    fr: 'Bouton {button}',
    de: 'Taste {button}',
    es: 'Botón {button}',
  },
  featureBatteryLow: {
    en: 'Battery low',
    fr: 'Pile faible',
    de: 'Batterie schwach',
    es: 'Pila baja',
  },

  // widgets
  buttonRefresh: { en: 'Refresh', fr: 'Actualiser', de: 'Aktualisieren', es: 'Actualizar' },
  probeValue: {
    en: 'probe {probe} {value}',
    fr: 'sonde {probe} {value}',
    de: 'Fühler {probe} {value}',
    es: 'sonda {probe} {value}',
  },
  rainValue: {
    en: '{value} mm in 24 h',
    fr: '{value} mm en 24 h',
    de: '{value} mm in 24 Std.',
    es: '{value} mm en 24 h',
  },
  windowOpen: { en: 'Open', fr: 'Ouverte', de: 'Offen', es: 'Abierta' },
  windowClosed: { en: 'Closed', fr: 'Fermée', de: 'Geschlossen', es: 'Cerrada' },
  lastPress: {
    en: 'button {button}: {press}',
    fr: 'bouton {button} : {press}',
    de: 'Taste {button}: {press}',
    es: 'botón {button}: {press}',
  },
  press_short: { en: 'Short press', fr: 'Appui court', de: 'Kurz gedrückt', es: 'Pulsación corta' },
  press_double: {
    en: 'Double press',
    fr: 'Double appui',
    de: 'Doppelt gedrückt',
    es: 'Doble pulsación',
  },
  press_long: { en: 'Long press', fr: 'Appui long', de: 'Lang gedrückt', es: 'Pulsación larga' },
  badgeOffline: { en: 'Offline', fr: 'Hors ligne', de: 'Offline', es: 'Sin señal' },
  badgeSmoke: { en: 'Smoke', fr: 'Fumée', de: 'Rauch', es: 'Humo' },
  badgeBattery: { en: 'Battery low', fr: 'Pile faible', de: 'Batterie', es: 'Pila baja' },
  badgeAlert: { en: 'Alert', fr: 'Alerte', de: 'Alarm', es: 'Alerta' },
  badgeError: { en: 'Error', fr: 'Erreur', de: 'Fehler', es: 'Error' },
  noReadingShort: {
    en: 'No measurement yet',
    fr: 'Pas encore de mesure',
    de: 'Noch keine Messung',
    es: 'Sin medición todavía',
  },
  sensorsCount: {
    en: '{count} sensor(s)',
    fr: '{count} capteur(s)',
    de: '{count} Sensor(en)',
    es: '{count} sensor(es)',
  },
  moreSensors: {
    en: '{count} not shown',
    fr: '{count} non affiché(s)',
    de: '{count} nicht angezeigt',
    es: '{count} no mostrado(s)',
  },
  noSensorWidget: {
    en: 'No Mobile Alerts sensor yet: add the ids of your sensors in the configuration of the integration.',
    fr: 'Pas encore de capteur Mobile Alerts : ajoutez les identifiants de vos capteurs dans la configuration de l’intégration.',
    de: 'Noch kein Mobile-Alerts-Sensor: Füge die IDs deiner Sensoren in der Konfiguration der Integration hinzu.',
    es: 'Todavía no hay ningún sensor Mobile Alerts: añada los identificadores de sus sensores en la configuración de la integración.',
  },
  noWeatherSensor: {
    en: 'This card shows a rain gauge (sensor id starting with 08) or an anemometer (0B). None is configured.',
    fr: 'Cette carte affiche un pluviomètre (identifiant commençant par 08) ou un anémomètre (0B). Aucun n’est configuré.',
    de: 'Diese Karte zeigt einen Regenmesser (ID beginnt mit 08) oder einen Windmesser (0B). Keiner ist konfiguriert.',
    es: 'Esta tarjeta muestra un pluviómetro (identificador que empieza por 08) o un anemómetro (0B). No hay ninguno configurado.',
  },
  measuredAt: { en: 'at {time}', fr: 'à {time}', de: 'um {time}', es: 'a las {time}' },
  tileRainHour: { en: 'Rain, 1 h', fr: 'Pluie, 1 h', de: 'Regen, 1 Std.', es: 'Lluvia, 1 h' },
  tileRainDay: { en: 'Rain, 24 h', fr: 'Pluie, 24 h', de: 'Regen, 24 Std.', es: 'Lluvia, 24 h' },
  tileWind: { en: 'Wind', fr: 'Vent', de: 'Wind', es: 'Viento' },
  tileGust: { en: 'Gusts', fr: 'Rafales', de: 'Böen', es: 'Ráfagas' },
  tileDirection: { en: 'Direction', fr: 'Direction', de: 'Richtung', es: 'Dirección' },
  seriesRain: {
    en: 'Rain per hour',
    fr: 'Pluie par heure',
    de: 'Regen pro Stunde',
    es: 'Lluvia por hora',
  },
  rainWaiting: {
    en: 'The rain is worked out from two measurements of the gauge: it shows after the next one.',
    fr: 'La pluie se calcule à partir de deux mesures du pluviomètre : elle s’affiche après la prochaine.',
    de: 'Der Regen wird aus zwei Messungen des Regenmessers berechnet: Er erscheint nach der nächsten.',
    es: 'La lluvia se calcula a partir de dos mediciones del pluviómetro: aparecerá tras la próxima.',
  },

  // alerts of the app
  alert_temperature_high: {
    en: 'Temperature too high',
    fr: 'Température trop haute',
    de: 'Temperatur zu hoch',
    es: 'Temperatura demasiado alta',
  },
  alert_temperature_low: {
    en: 'Temperature too low',
    fr: 'Température trop basse',
    de: 'Temperatur zu niedrig',
    es: 'Temperatura demasiado baja',
  },
  alert_humidity_high: {
    en: 'Humidity too high',
    fr: 'Humidité trop haute',
    de: 'Luftfeuchtigkeit zu hoch',
    es: 'Humedad demasiado alta',
  },
  alert_humidity_low: {
    en: 'Humidity too low',
    fr: 'Humidité trop basse',
    de: 'Luftfeuchtigkeit zu niedrig',
    es: 'Humedad demasiado baja',
  },
  alert_humidity_average_high: {
    en: 'Average humidity too high',
    fr: 'Humidité moyenne trop haute',
    de: 'Mittlere Luftfeuchtigkeit zu hoch',
    es: 'Humedad media demasiado alta',
  },
  alert_humidity_average_low: {
    en: 'Average humidity too low',
    fr: 'Humidité moyenne trop basse',
    de: 'Mittlere Luftfeuchtigkeit zu niedrig',
    es: 'Humedad media demasiado baja',
  },
  alert_co2_high: {
    en: 'Poor air quality',
    fr: 'Mauvaise qualité de l’air',
    de: 'Schlechte Luftqualität',
    es: 'Mala calidad del aire',
  },
  alert_pressure_high: {
    en: 'Pressure too high',
    fr: 'Pression trop haute',
    de: 'Luftdruck zu hoch',
    es: 'Presión demasiado alta',
  },
  alert_pressure_low: {
    en: 'Pressure too low',
    fr: 'Pression trop basse',
    de: 'Luftdruck zu niedrig',
    es: 'Presión demasiado baja',
  },
  alert_pressure_rising: {
    en: 'Pressure rising fast',
    fr: 'Pression en forte hausse',
    de: 'Luftdruck steigt stark',
    es: 'Presión en fuerte subida',
  },
  alert_pressure_falling: {
    en: 'Pressure falling fast',
    fr: 'Pression en forte baisse',
    de: 'Luftdruck fällt stark',
    es: 'Presión en fuerte bajada',
  },
  alert_rain_heavy: {
    en: 'Heavy rain',
    fr: 'Forte pluie',
    de: 'Starkregen',
    es: 'Lluvia intensa',
  },
  alert_rain_dry: {
    en: 'Long dry spell',
    fr: 'Longue période sèche',
    de: 'Lange Trockenheit',
    es: 'Largo periodo seco',
  },
  alert_rain_begin: {
    en: 'Rain begins',
    fr: 'Début de pluie',
    de: 'Regenbeginn',
    es: 'Empieza a llover',
  },
  alert_wind: { en: 'Strong wind', fr: 'Vent fort', de: 'Starker Wind', es: 'Viento fuerte' },
  alert_gust: {
    en: 'Strong gusts',
    fr: 'Fortes rafales',
    de: 'Starke Böen',
    es: 'Ráfagas fuertes',
  },
  alert_window_open: {
    en: 'Window opened',
    fr: 'Fenêtre ouverte',
    de: 'Fenster geöffnet',
    es: 'Ventana abierta',
  },
  alert_window_closed: {
    en: 'Window closed',
    fr: 'Fenêtre fermée',
    de: 'Fenster geschlossen',
    es: 'Ventana cerrada',
  },
  alert_window_open_long: {
    en: 'Window open too long',
    fr: 'Fenêtre ouverte trop longtemps',
    de: 'Fenster zu lange offen',
    es: 'Ventana abierta demasiado tiempo',
  },
  alert_window_closed_long: {
    en: 'Window closed too long',
    fr: 'Fenêtre fermée trop longtemps',
    de: 'Fenster zu lange geschlossen',
    es: 'Ventana cerrada demasiado tiempo',
  },
  alert_smoke: { en: 'Smoke alarm', fr: 'Alarme fumée', de: 'Rauchalarm', es: 'Alarma de humo' },
  alert_power_outage: {
    en: 'Power outage',
    fr: 'Coupure de courant',
    de: 'Stromausfall',
    es: 'Corte de corriente',
  },

  // statuses and messages
  statusConnected: {
    en: 'Connected. {sensors}',
    fr: 'Connecté. {sensors}',
    de: 'Verbunden. {sensors}',
    es: 'Conectado. {sensors}',
  },
  statusSomeFailing: {
    en: '{ok} of {total} sensors read. {detail}',
    fr: '{ok} capteurs lus sur {total}. {detail}',
    de: '{ok} von {total} Sensoren gelesen. {detail}',
    es: '{ok} de {total} sensores leídos. {detail}',
  },
  statusNoSensor: {
    en: 'No sensor configured: add the ids of your sensors (12 characters, on the sticker of each sensor and in the Mobile Alerts app).',
    fr: 'Aucun capteur configuré : ajoutez les identifiants de vos capteurs (12 caractères, sur l’étiquette de chaque capteur et dans l’appli Mobile Alerts).',
    de: 'Kein Sensor konfiguriert: Füge die IDs deiner Sensoren hinzu (12 Zeichen, auf dem Aufkleber jedes Sensors und in der Mobile-Alerts-App).',
    es: 'Ningún sensor configurado: añada los identificadores de sus sensores (12 caracteres, en la etiqueta de cada sensor y en la app Mobile Alerts).',
  },
  sensorLine: {
    en: '{name}: {values}',
    fr: '{name} : {values}',
    de: '{name}: {values}',
    es: '{name}: {values}',
  },
  sensorOffline: {
    en: '{name} offline',
    fr: '{name} hors ligne',
    de: '{name} offline',
    es: '{name} sin señal',
  },
  errInvalidIds: {
    en: 'Not sensor ids: {list}.',
    fr: 'Pas des identifiants de capteur : {list}.',
    de: 'Keine Sensor-IDs: {list}.',
    es: 'No son identificadores de sensor: {list}.',
  },
  errTooMany: {
    en: '{count} id(s) past the 50th ignored.',
    fr: '{count} identifiant(s) au-delà du 50e ignoré(s).',
    de: '{count} ID(s) nach der 50. ignoriert.',
    es: '{count} identificador(es) más allá del 50.º ignorado(s).',
  },
  errUnknown: {
    en: 'Sensor …{suffix} is unknown to the Mobile Alerts server: check its id (a new sensor must first send a measurement through the gateway).',
    fr: 'Le capteur …{suffix} est inconnu du serveur Mobile Alerts : vérifiez son identifiant (un nouveau capteur doit d’abord envoyer une mesure par la passerelle).',
    de: 'Der Sensor …{suffix} ist dem Mobile-Alerts-Server unbekannt: Prüfe seine ID (ein neuer Sensor muss erst eine Messung über das Gateway senden).',
    es: 'El sensor …{suffix} es desconocido para el servidor Mobile Alerts: compruebe su identificador (un sensor nuevo debe enviar primero una medición por la pasarela).',
  },
  errChecking: {
    en: 'The ids are being checked one by one, a few every 15 minutes, within the limits of the server.',
    fr: 'Les identifiants sont vérifiés un par un, quelques-uns toutes les 15 minutes, dans les limites du serveur.',
    de: 'Die IDs werden einzeln geprüft, einige alle 15 Minuten, im Rahmen der Grenzen des Servers.',
    es: 'Los identificadores se comprueban uno a uno, unos pocos cada 15 minutos, dentro de los límites del servidor.',
  },
  errPhone: {
    en: 'The phone id was refused: the alerts of the app are not read. Copy it again from the settings of the app.',
    fr: 'Le Phone ID a été refusé : les alertes de l’appli ne sont pas lues. Recopiez-le depuis les réglages de l’appli.',
    de: 'Die Phone-ID wurde abgelehnt: Die Alarme der App werden nicht gelesen. Kopier sie erneut aus den Einstellungen der App.',
    es: 'El Phone ID fue rechazado: las alertas de la app no se leen. Cópielo de nuevo desde los ajustes de la app.',
  },
  errPhoneFormat: {
    en: 'The phone id is made of digits only (settings of the Mobile Alerts app).',
    fr: 'Le Phone ID ne contient que des chiffres (réglages de l’appli Mobile Alerts).',
    de: 'Die Phone-ID besteht nur aus Ziffern (Einstellungen der Mobile-Alerts-App).',
    es: 'El Phone ID solo contiene cifras (ajustes de la app Mobile Alerts).',
  },
  errBlocked: {
    en: 'The Mobile Alerts server blocked this address for 15 minutes after invalid requests. Next reading at {time}.',
    fr: 'Le serveur Mobile Alerts a bloqué cette adresse 15 minutes après des requêtes invalides. Prochaine lecture à {time}.',
    de: 'Der Mobile-Alerts-Server hat diese Adresse nach ungültigen Anfragen für 15 Minuten gesperrt. Nächste Messung um {time}.',
    es: 'El servidor Mobile Alerts bloqueó esta dirección 15 minutos tras peticiones no válidas. Próxima lectura a las {time}.',
  },
  errRateLimit: {
    en: 'Too many requests: the Mobile Alerts server asks to wait 7 minutes. Next reading at {time}.',
    fr: 'Trop de requêtes : le serveur Mobile Alerts demande d’attendre 7 minutes. Prochaine lecture à {time}.',
    de: 'Zu viele Anfragen: Der Mobile-Alerts-Server bittet, 7 Minuten zu warten. Nächste Messung um {time}.',
    es: 'Demasiadas peticiones: el servidor Mobile Alerts pide esperar 7 minutos. Próxima lectura a las {time}.',
  },
  errUnreachable: {
    en: 'The Mobile Alerts server cannot be reached ({detail}).',
    fr: 'Le serveur Mobile Alerts est injoignable ({detail}).',
    de: 'Der Mobile-Alerts-Server ist nicht erreichbar ({detail}).',
    es: 'No se puede contactar con el servidor Mobile Alerts ({detail}).',
  },
  errFailed: {
    en: 'Mobile Alerts answered with an error ({detail}).',
    fr: 'Mobile Alerts a répondu par une erreur ({detail}).',
    de: 'Mobile Alerts hat mit einem Fehler geantwortet ({detail}).',
    es: 'Mobile Alerts respondió con un error ({detail}).',
  },
  readDone: {
    en: 'Read: {sensors}',
    fr: 'Lu : {sensors}',
    de: 'Gelesen: {sensors}',
    es: 'Leído: {sensors}',
  },
  refreshCached: {
    en: 'Read less than 30 seconds ago.',
    fr: 'Lu il y a moins de 30 secondes.',
    de: 'Vor weniger als 30 Sekunden gelesen.',
    es: 'Leído hace menos de 30 segundos.',
  },
  refreshDone: {
    en: '{count} sensor(s) read again.',
    fr: '{count} capteur(s) relu(s).',
    de: '{count} Sensor(en) neu gelesen.',
    es: '{count} sensor(es) leído(s) de nuevo.',
  },
  diagnosticDone: {
    en: 'The diagnostic is in the logs of the integration ({count} line(s) “Mobile Alerts diagnostic”).',
    fr: 'Le diagnostic est dans les journaux de l’intégration ({count} ligne(s) « Mobile Alerts diagnostic »).',
    de: 'Die Diagnose steht in den Logs der Integration ({count} Zeile(n) „Mobile Alerts diagnostic“).',
    es: 'El diagnóstico está en los registros de la integración ({count} línea(s) «Mobile Alerts diagnostic»).',
  },
  summaryBattery: {
    en: 'Battery low.',
    fr: 'Pile faible.',
    de: 'Batterie schwach.',
    es: 'Pila baja.',
  },
  summaryOffline: {
    en: 'Not seen by the server since {time}.',
    fr: 'Pas vu par le serveur depuis {time}.',
    de: 'Seit {time} nicht mehr vom Server gesehen.',
    es: 'No visto por el servidor desde las {time}.',
  },
};

// Wind sectors: N, NNE … in the letters of each language.
const SECTORS = {
  en: 'N NNE NE ENE E ESE SE SSE S SSW SW WSW W WNW NW NNW',
  fr: 'N NNE NE ENE E ESE SE SSE S SSO SO OSO O ONO NO NNO',
  de: 'N NNO NO ONO O OSO SO SSO S SSW SW WSW W WNW NW NNW',
  es: 'N NNE NE ENE E ESE SE SSE S SSO SO OSO O ONO NO NNO',
};

/**
 * @description Whether a value is one of the four languages.
 * @param {unknown} value - The value.
 * @returns {boolean} True for en, fr, de, es.
 */
function isLanguage(value) {
  return LANGUAGES.includes(value);
}

/**
 * @description A text in a language, its placeholders filled.
 * @param {string} key - A TEXTS key.
 * @param {string} language - The language (English when unknown).
 * @param {object} [values] - The placeholder values.
 * @returns {string} The text.
 * @example
 * t('readDone', 'fr', { sensors: '…' }); // 'Lu : …'
 */
function t(key, language, values = {}) {
  const entry = TEXTS[key];
  if (!entry) {
    return key;
  }
  const template = entry[isLanguage(language) ? language : 'en'] ?? entry.en;
  return template.replace(/\{(\w+)\}/g, (whole, name) =>
    values[name] === undefined || values[name] === null ? '' : String(values[name]),
  );
}

/**
 * @description A text in the four languages.
 * @param {string} key - A TEXTS key.
 * @param {object|Function} [values] - The values, or `(language) => values`.
 * @returns {object} `{ en, fr, de, es }`.
 */
function all(key, values = {}) {
  return Object.fromEntries(
    LANGUAGES.map((language) => [
      language,
      t(key, language, typeof values === 'function' ? values(language) : values),
    ]),
  );
}

/**
 * @description A decimal written the way of a language: "4,4" in French.
 * @param {number} value - The value.
 * @param {string} language - The language.
 * @param {number} [digits] - Fraction digits at most.
 * @returns {string} The text.
 */
const decimal = (value, language, digits = 1) =>
  new Intl.NumberFormat(isLanguage(language) ? language : 'en', {
    maximumFractionDigits: digits,
  }).format(value);

/**
 * @description The wind sector of a direction, in the letters of a language.
 * @param {number} degrees - The direction (0 north, clockwise).
 * @param {string} language - The language.
 * @returns {string} "NNO" in French for 337.5°, '' without a direction.
 */
function sectorText(degrees, language) {
  if (!Number.isFinite(degrees)) {
    return '';
  }
  const names = SECTORS[isLanguage(language) ? language : 'en'].split(' ');
  return names[((Math.round(degrees / 22.5) % 16) + 16) % 16];
}

export { LANGUAGES, TEXTS, SECTORS, isLanguage, t, all, decimal, sectorText };
