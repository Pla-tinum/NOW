const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const android = path.join(root, 'android/app/src/main/AndroidManifest.xml');
const ios = path.join(root, 'ios/App/App/Info.plist');
for (const [file, key] of [[android, 'ADMOB_ANDROID_APP_ID'], [ios, 'ADMOB_IOS_APP_ID']]) {
  const value = process.env[key];
  if (!value) continue;
  if (!/^ca-app-pub-\d+~\d+$/.test(value)) throw new Error(key + ' must be an AdMob app ID');
  const source = fs.readFileSync(file, 'utf8');
  const updated = source.replace(/ca-app-pub-\d+~\d+/, value);
  if (source === updated) throw new Error('AdMob app ID not found in ' + file);
  fs.writeFileSync(file, updated);
}
console.log('Native AdMob app identifiers configured where provided');
