import type { CapacitorConfig } from '@capacitor/cli';

// Сам код PWA (index.html, app.js, style.css, manifest.json, service-worker.js)
// не меняется: Capacitor просто упаковывает готовую папку www/ в WebView.
// Папка www/ генерируется скриптом scripts/build-www.js при каждой сборке.
const config: CapacitorConfig = {
  appId: 'com.gypopo118.calculator',
  appName: 'Калькулятор',
  webDir: 'www',
  backgroundColor: '#000000',
};

export default config;
