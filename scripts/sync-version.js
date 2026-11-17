// Copy package.json "version" onto the Samsung widget. The Android APK
// reads the same field when a release is built.
const fs = require('fs');
const path = require('path');
const pkg = require('../package.json');

if (!/^(\d)\.(\d)\.(\d)$/.test(pkg.version)) {
    console.error(`Version ${pkg.version} must look like 2.2.0 (one digit each).`);
    process.exit(1);
}

const xmlPath = path.join(__dirname, '../standalone/config.xml');
const xml = fs.readFileSync(xmlPath, 'utf8');
const next = xml.replace(/(<widget\b[^>]*\bversion=")[^"]+(")/, `$1${pkg.version}$2`);
if (!next.includes(`version="${pkg.version}"`)) {
    console.error('Could not update the widget version in standalone/config.xml');
    process.exit(1);
}
if (next !== xml) fs.writeFileSync(xmlPath, next);
console.log(`Samsung widget version set to ${pkg.version}`);
