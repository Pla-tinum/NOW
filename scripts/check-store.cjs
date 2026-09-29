const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const required = ['REVENUECAT_ANDROID_PUBLIC_KEY', 'REVENUECAT_IOS_PUBLIC_KEY', 'ADMOB_ANDROID_APP_ID', 'ADMOB_IOS_APP_ID', 'ADMOB_ANDROID_BANNER_UNIT_ID', 'ADMOB_IOS_BANNER_UNIT_ID'];
const errors = required.filter(key => !process.env[key]).map(key => key + ' is missing');
for (const key of ['ADMOB_ANDROID_APP_ID','ADMOB_IOS_APP_ID']) {
  if (process.env[key]?.includes('3940256099942544')) errors.push(key + ' is a Google demo ID');
}
const legal = fs.readFileSync(path.join(root, 'legal.js'), 'utf8');
if (!legal.includes('Valentyn Shemeiko')) errors.push('Legal publisher is missing');
if (!fs.existsSync(path.join(root, 'android')) || !fs.existsSync(path.join(root, 'ios'))) errors.push('Native projects are missing');
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log('Local store configuration is present. Device purchases, signing and console forms still require verification.');
