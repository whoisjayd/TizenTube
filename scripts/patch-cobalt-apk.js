// Point a TizenTube Cobalt APK at this repository and stamp the shared version.
// The userscript URL and the player version name stay the same length, so the
// native library and the binary manifest stay valid. uber-apk-signer realigns
// and signs the rewritten archive.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const pkg = require('../package.json');
const VERSION = pkg.version;
const COBALT_VERSION = '2.0.3';

// One digit per part so the text fits the fixed Cobalt version field.
// 2.2.0 -> 20200, 2.2.1 -> 20201. Android compares this integer.
function versionCode(version) {
    const parts = /^(\d)\.(\d)\.(\d)$/.exec(version);
    if (!parts) {
        throw new Error(`Version ${version} must look like 2.2.0 (one digit each). That width fits the Android manifest.`);
    }
    return Number(parts[1]) * 10000 + Number(parts[2]) * 100 + Number(parts[3]);
}

const VERSION_CODE = versionCode(VERSION);
const FROM = Buffer.from('https://cdn.jsdelivr.net/npm/@foxreis/tizentube/dist/userScript.js');
const TO = Buffer.from('https://cdn.jsdelivr.net/gh/whoisjayd/TizenTube/dist/userScript.js');

if (FROM.length !== TO.length) {
    throw new Error('Replacement URL must stay the same length as the one baked into Cobalt');
}
if (Buffer.from(VERSION, 'utf16le').length !== Buffer.from(COBALT_VERSION, 'utf16le').length) {
    throw new Error(`Version ${VERSION} must be the same width as Cobalt ${COBALT_VERSION}`);
}

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        table[n] = c >>> 0;
    }
    return table;
})();

function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
}

function readZip(buf) {
    const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    if (eocd < 0) throw new Error('not a zip archive');
    const count = buf.readUInt16LE(eocd + 10);
    let cursor = buf.readUInt32LE(eocd + 16);
    const entries = [];

    for (let index = 0; index < count; index++) {
        if (buf.readUInt32LE(cursor) !== 0x02014b50) throw new Error('bad central directory');
        const versionMade = buf.readUInt16LE(cursor + 4);
        const versionNeeded = buf.readUInt16LE(cursor + 6);
        const flags = buf.readUInt16LE(cursor + 8);
        const method = buf.readUInt16LE(cursor + 10);
        const time = buf.readUInt16LE(cursor + 12);
        const date = buf.readUInt16LE(cursor + 14);
        const compressedSize = buf.readUInt32LE(cursor + 20);
        const uncompressedSize = buf.readUInt32LE(cursor + 24);
        const nameLength = buf.readUInt16LE(cursor + 28);
        const extraLength = buf.readUInt16LE(cursor + 30);
        const commentLength = buf.readUInt16LE(cursor + 32);
        const externalAttr = buf.readUInt32LE(cursor + 38);
        const localOffset = buf.readUInt32LE(cursor + 42);
        const name = buf.subarray(cursor + 46, cursor + 46 + nameLength);
        const comment = buf.subarray(cursor + 46 + nameLength + extraLength, cursor + 46 + nameLength + extraLength + commentLength);
        const localNameLength = buf.readUInt16LE(localOffset + 26);
        const localExtraLength = buf.readUInt16LE(localOffset + 28);
        const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
        entries.push({
            name,
            comment,
            method,
            flags: flags & ~0x8,
            time,
            date,
            versionMade,
            versionNeeded,
            externalAttr,
            uncompressedSize,
            compressed: Buffer.from(buf.subarray(dataOffset, dataOffset + compressedSize))
        });
        cursor += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
}

function writeZip(entries) {
    const parts = [];
    let offset = 0;
    for (const entry of entries) {
        entry.localOffset = offset;
        const header = Buffer.alloc(30);
        header.writeUInt32LE(0x04034b50, 0);
        header.writeUInt16LE(entry.versionNeeded, 4);
        header.writeUInt16LE(entry.flags, 6);
        header.writeUInt16LE(entry.method, 8);
        header.writeUInt16LE(entry.time, 10);
        header.writeUInt16LE(entry.date, 12);
        header.writeUInt32LE(entry.crc, 14);
        header.writeUInt32LE(entry.compressed.length, 18);
        header.writeUInt32LE(entry.uncompressedSize, 22);
        header.writeUInt16LE(entry.name.length, 26);
        header.writeUInt16LE(0, 28);
        parts.push(header, entry.name, entry.compressed);
        offset += header.length + entry.name.length + entry.compressed.length;
    }

    const centralOffset = offset;
    for (const entry of entries) {
        const header = Buffer.alloc(46);
        header.writeUInt32LE(0x02014b50, 0);
        header.writeUInt16LE(entry.versionMade, 4);
        header.writeUInt16LE(entry.versionNeeded, 6);
        header.writeUInt16LE(entry.flags, 8);
        header.writeUInt16LE(entry.method, 10);
        header.writeUInt16LE(entry.time, 12);
        header.writeUInt16LE(entry.date, 14);
        header.writeUInt32LE(entry.crc, 16);
        header.writeUInt32LE(entry.compressed.length, 20);
        header.writeUInt32LE(entry.uncompressedSize, 24);
        header.writeUInt16LE(entry.name.length, 28);
        header.writeUInt16LE(0, 30);
        header.writeUInt16LE(entry.comment.length, 32);
        header.writeUInt32LE(entry.externalAttr, 38);
        header.writeUInt32LE(entry.localOffset, 42);
        parts.push(header, entry.name, entry.comment);
        offset += header.length + entry.name.length + entry.comment.length;
    }

    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(entries.length, 8);
    eocd.writeUInt16LE(entries.length, 10);
    eocd.writeUInt32LE(offset - centralOffset, 12);
    eocd.writeUInt32LE(centralOffset, 16);
    parts.push(eocd);
    return Buffer.concat(parts);
}

function stored(entry) {
    if (entry.method === 0) return entry.compressed;
    if (entry.method === 8) return zlib.inflateRawSync(entry.compressed);
    throw new Error(`Unsupported compression ${entry.method}`);
}

function store(entry, data, method) {
    entry.uncompressedSize = data.length;
    entry.crc = crc32(data);
    entry.method = method;
    entry.compressed = method === 0 ? data : zlib.deflateRawSync(data);
}

function manifestStrings(manifest) {
    const strings = [];
    let cursor = 8;
    while (cursor + 8 <= manifest.length) {
        const type = manifest.readUInt16LE(cursor);
        const headerSize = manifest.readUInt16LE(cursor + 2);
        const size = manifest.readUInt32LE(cursor + 4);
        if (!size) break;
        if (type === 1) {
            const count = manifest.readUInt32LE(cursor + 8);
            const flags = manifest.readUInt32LE(cursor + 16);
            const stringsStart = manifest.readUInt32LE(cursor + 20);
            const base = cursor + stringsStart;
            const utf8 = flags & 0x100;
            for (let index = 0; index < count; index++) {
                let at = base + manifest.readUInt32LE(cursor + headerSize + index * 4);
                if (utf8) {
                    let mark = manifest[at];
                    at += mark & 0x80 ? 2 : 1;
                    mark = manifest[at];
                    const length = mark & 0x7f;
                    at += mark & 0x80 ? 2 : 1;
                    strings.push(manifest.subarray(at, at + length).toString());
                } else {
                    let length = manifest.readUInt16LE(at);
                    at += 2;
                    if (length & 0x8000) {
                        length = ((length & 0x7fff) << 16) | manifest.readUInt16LE(at);
                        at += 2;
                    }
                    strings.push(manifest.subarray(at, at + length * 2).toString('utf16le'));
                }
            }
            break;
        }
        cursor += size;
    }
    return strings;
}

function setPlayerVersion(manifest) {
    const from = Buffer.from(COBALT_VERSION, 'utf16le');
    const to = Buffer.from(VERSION, 'utf16le');
    const at = manifest.indexOf(from);
    if (at < 0 || manifest.indexOf(from, at + from.length) !== -1) {
        throw new Error(`Expected one ${COBALT_VERSION} version name in AndroidManifest.xml`);
    }
    to.copy(manifest, at);

    const nameIndex = manifestStrings(manifest).indexOf('versionCode');
    if (nameIndex < 0) throw new Error('AndroidManifest.xml has no versionCode');
    const name = Buffer.alloc(4);
    name.writeUInt32LE(nameIndex);
    let cursor = 0;
    while ((cursor = manifest.indexOf(name, cursor)) !== -1) {
        if (manifest.readUInt32LE(cursor + 4) === 0xffffffff && manifest[cursor + 11] === 0x10) {
            manifest.writeUInt32LE(VERSION_CODE, cursor + 12);
            return;
        }
        cursor += 4;
    }
    throw new Error('AndroidManifest.xml versionCode field was not found');
}

function patch(input, output) {
    const entries = readZip(fs.readFileSync(input));
    let urls = 0;
    let versioned = false;

    for (const entry of entries) {
        const name = entry.name.toString();
        if (entry.method === 0 && entry.compressed.includes(FROM)) {
            const data = entry.compressed;
            let at = 0;
            while ((at = data.indexOf(FROM, at)) !== -1) {
                TO.copy(data, at);
                at += FROM.length;
                urls++;
            }
            store(entry, data, 0);
        } else if (name === 'AndroidManifest.xml') {
            const manifest = stored(entry);
            setPlayerVersion(manifest);
            store(entry, manifest, 8);
            versioned = true;
        }
    }

    if (!urls) throw new Error(`${input} does not contain the Cobalt userscript URL`);
    if (!versioned) throw new Error(`${input} has no AndroidManifest.xml`);

    const packed = writeZip(entries);
    if (packed.includes(FROM)) throw new Error(`${input} still points at the upstream userscript`);
    if (!packed.includes(TO)) throw new Error(`${input} is missing this repository's userscript URL`);
    if (packed.includes(Buffer.from(COBALT_VERSION, 'utf16le'))) {
        throw new Error(`${input} still reports Cobalt ${COBALT_VERSION}`);
    }

    fs.writeFileSync(output, packed);
    console.log(`${path.basename(output)}: version ${VERSION} (${VERSION_CODE}), ${urls} userscript URL(s)`);
}

const [input, output] = process.argv.slice(2);
if (!input || !output) {
    console.error('Usage: node scripts/patch-cobalt-apk.js <input.apk> <output.apk>');
    process.exit(1);
}
patch(input, output);
