const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'dist');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'vendor', 'images'), { recursive: true });
for (const file of ['index.html', 'explore.js', 'native-bootstrap.js']) fs.copyFileSync(path.join(root, file), path.join(out, file));
const publicKeys = { ios: process.env.REVENUECAT_IOS_PUBLIC_KEY || '', android: process.env.REVENUECAT_ANDROID_PUBLIC_KEY || '' };
const adUnits = {
  ios: process.env.ADMOB_IOS_BANNER_UNIT_ID || 'ca-app-pub-3940256099942544/2934735716',
  android: process.env.ADMOB_ANDROID_BANNER_UNIT_ID || 'ca-app-pub-3940256099942544/6300978111'
};
fs.writeFileSync(path.join(out, 'mobile-config.js'), 'window.NOW_RC_PUBLIC_KEYS = ' + JSON.stringify(publicKeys) + ';\nwindow.NOW_AD_UNITS = ' + JSON.stringify(adUnits) + ';\n');
esbuild.buildSync({ entryPoints: [path.join(root, 'mobile-billing-entry.js')], outfile: path.join(out, 'mobile-billing.js'), bundle: true, format: 'iife', platform: 'browser', minify: true });
esbuild.buildSync({ entryPoints: [path.join(root, 'mobile-ads-entry.js')], outfile: path.join(out, 'mobile-ads.js'), bundle: true, format: 'iife', platform: 'browser', minify: true });
const htmlPath = path.join(out, 'index.html');
fs.writeFileSync(htmlPath, fs.readFileSync(htmlPath, 'utf8').replace('</head>', '<script src="/mobile-config.js"></script><script defer src="/mobile-billing.js"></script><script defer src="/mobile-ads.js"></script>\n</head>'));
const leaflet = path.join(root, 'node_modules', 'leaflet', 'dist');
for (const file of ['leaflet.js', 'leaflet.css']) fs.copyFileSync(path.join(leaflet, file), path.join(out, 'vendor', file));
for (const file of fs.readdirSync(path.join(leaflet, 'images'))) fs.copyFileSync(path.join(leaflet, 'images', file), path.join(out, 'vendor', 'images', file));
console.log('Bundled NOW web assets in dist/');
