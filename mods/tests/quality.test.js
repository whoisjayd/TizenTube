import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import { applyFormatPreferences, getResolution } from '../utils/formatPreferences.js';

const video = (codec, height, fps = 30, extra = {}) => ({
    mimeType: `video/mp4; codecs="${codec}"`, width: Math.round(height * 16 / 9), height, fps, bitrate: height * 1000, ...extra,
});
const audio = (codec, bitrate, extra = {}) => ({
    mimeType: `audio/${codec === 'opus' ? 'webm' : 'mp4'}; codecs="${codec}"`, bitrate, ...extra,
});

const formats = () => [
    video('avc1.640028', 1080, 30), video('avc1.64002a', 1080, 60), video('vp09.00.40', 1080, 60),
    video('avc1.4d401f', 720, 30), video('avc1.4d401f', 480, 30),
    audio('mp4a.40.2', 128000), audio('opus', 160000), audio('opus', 50000),
];
const none = {};

test('default preferences leave the formats untouched', () => {
    const input = formats();
    assert.equal(applyFormatPreferences(input, { videoCodec: 'any', audioCodec: 'any', audioQuality: 'auto', maxResolution: 'auto', preferHighFrameRate: false }), input);
    assert.equal(applyFormatPreferences(input, none).length, input.length);
    assert.equal(applyFormatPreferences(undefined, none), undefined);
    assert.deepEqual(applyFormatPreferences([], { maxResolution: '720' }), []);
});

test('formats without a mimeType do not throw', () => {
    const input = [{}, null, video('avc1', 720), audio('opus', 1)];
    assert.doesNotThrow(() => applyFormatPreferences(input, { videoCodec: 'avc1', audioCodec: 'opus', maxResolution: '1080', preferHighFrameRate: true, audioQuality: 'highest' }));
});

test('video codec keeps audio and only filters when the codec exists', () => {
    const vp9 = applyFormatPreferences(formats(), { videoCodec: 'vp09' });
    assert.deepEqual(vp9.filter((f) => f.mimeType.startsWith('video/')).map((f) => f.height), [1080]);
    assert.equal(vp9.filter((f) => f.mimeType.startsWith('audio/')).length, 3);
    assert.equal(applyFormatPreferences(formats(), { videoCodec: 'av01' }).length, formats().length);
});

test('max resolution drops taller formats but never every video format', () => {
    const capped = applyFormatPreferences(formats(), { maxResolution: '720' });
    assert.deepEqual(capped.filter((f) => f.mimeType.startsWith('video/')).map((f) => f.height), [720, 480]);
    const impossible = [video('avc1', 1080), video('avc1', 2160), audio('opus', 1)];
    assert.equal(applyFormatPreferences(impossible, { maxResolution: '480' }).length, 3);
    assert.equal(applyFormatPreferences(formats(), { maxResolution: 'auto' }).length, formats().length);
});

test('resolution uses the short side so portrait and ultrawide count as their real quality', () => {
    assert.equal(getResolution({ width: 1080, height: 1920 }), 1080);
    assert.equal(getResolution({ width: 2560, height: 1080 }), 1080);
    assert.equal(getResolution({ qualityLabel: '720p60' }), 720);
    assert.equal(getResolution({}), 0);
});

test('prefer 60fps only drops 30fps formats at resolutions that have a 60fps variant', () => {
    const result = applyFormatPreferences(formats(), { preferHighFrameRate: true });
    const videos = result.filter((f) => f.mimeType.startsWith('video/'));
    assert.ok(videos.filter((f) => f.height === 1080).every((f) => f.fps === 60));
    assert.equal(videos.filter((f) => f.height === 1080).length, 2);
    assert.equal(videos.filter((f) => f.height === 720).length, 1, '720p only exists at 30fps and stays');
    assert.equal(videos.filter((f) => f.height === 480).length, 1);
});

test('audio codec preference works per audio track and falls back when a track lacks it', () => {
    const input = [
        audio('opus', 160000, { audioTrack: { id: 'en' } }), audio('mp4a.40.2', 128000, { audioTrack: { id: 'en' } }),
        audio('mp4a.40.2', 128000, { audioTrack: { id: 'de' } }),
        video('avc1', 720),
    ];
    const result = applyFormatPreferences(input, { audioCodec: 'opus' });
    assert.equal(result.filter((f) => f.audioTrack?.id === 'en').length, 1);
    assert.ok(result.find((f) => f.audioTrack?.id === 'en').mimeType.includes('opus'));
    assert.equal(result.filter((f) => f.audioTrack?.id === 'de').length, 1, 'dub with only mp4a is kept');
    assert.equal(result.filter((f) => f.mimeType.startsWith('video/')).length, 1);
});

test('highest audio quality keeps one best-bitrate format per track', () => {
    const result = applyFormatPreferences(formats(), { audioQuality: 'highest' });
    const audios = result.filter((f) => f.mimeType.startsWith('audio/'));
    assert.equal(audios.length, 1);
    assert.equal(audios[0].bitrate, 160000);
    const both = applyFormatPreferences(formats(), { audioQuality: 'highest', audioCodec: 'mp4a' });
    assert.equal(both.filter((f) => f.mimeType.startsWith('audio/'))[0].bitrate, 128000);
});

// ---- bundle-level checks (the shipped IIFE in a fresh realm) ----

const bundle = new vm.Script(readFileSync(
    process.env.TIZENTUBE_TEST_BUNDLE || new URL('../../dist/userScript.js', import.meta.url),
    'utf8'
));

function eventTarget() {
    const listeners = new Map();
    return {
        addEventListener(type, listener) {
            if (!listeners.has(type)) listeners.set(type, []);
            listeners.get(type).push(listener);
        },
        dispatch(type) {
            for (const listener of listeners.get(type) || []) listener();
        },
    };
}

function element() {
    return {
        ...eventTarget(), style: {}, children: [], classList: { contains: () => false },
        appendChild(child) { this.children.push(child); }, setAttribute() {},
    };
}

function page(config = {}) {
    const document = {
        ...eventTarget(), readyState: 'complete', documentElement: element(), head: element(), body: element(),
        createElement: element, querySelector: () => null, getElementById: () => null,
    };
    const observers = [];
    const context = vm.createContext({
        ...eventTarget(), document,
        navigator: { language: 'en-US', userAgent: 'Tizen' },
        location: { hostname: 'www.youtube.com', href: 'https://www.youtube.com/tv', hash: '' },
        localStorage: { 'ytaf-configuration': JSON.stringify(config) },
        console: { log() {}, info() {}, warn() {}, error() {} },
        setTimeout() {}, setInterval() {}, clearTimeout() {}, clearInterval() {}, fetch() {},
        MutationObserver: class {
            constructor() { this.attached = 0; this.disconnected = 0; observers.push(this); }
            observe() { this.attached++; }
            disconnect() { this.disconnected++; }
        },
        Element: class {},
        CSS: { registerProperty() {} },
        getComputedStyle() { return { getPropertyValue: () => '' }; },
    });
    vm.runInContext('window = self = globalThis;', context);
    bundle.runInContext(context);
    return { context, document, observers };
}

function parse(context, value) {
    context.payload = JSON.stringify(value);
    return vm.runInContext('JSON.parse(payload)', context);
}

const streaming = () => ({ streamingData: { adaptiveFormats: formats() } });

test('shipped hook applies the new settings and is a no-op by default', () => {
    const def = parse(page().context, streaming());
    assert.equal(def.streamingData.adaptiveFormats.length, formats().length);

    const tuned = parse(page({
        preferredAudioCodec: 'opus', preferredAudioQuality: 'highest', maxVideoResolution: '720', preferHighFrameRate: true,
    }).context, streaming());
    assert.deepEqual([...tuned.streamingData.adaptiveFormats.filter((f) => f.mimeType.startsWith('video/')).map((f) => f.height)], [720, 480]);
    assert.equal(tuned.streamingData.adaptiveFormats.filter((f) => f.mimeType.startsWith('audio/')).length, 1);
});

test('the hook passes through primitives and null untouched', () => {
    const { context } = page();
    assert.equal(vm.runInContext('JSON.parse("null")', context), null);
    assert.equal(vm.runInContext('JSON.parse("5")', context), 5);
    assert.equal(vm.runInContext('JSON.parse(\'"x"\')', context), 'x');
    assert.equal(vm.runInContext('JSON.parse("true")', context), true);
});

test('PiP observer is only attached while PiP is playing', () => {
    const { context, document, observers } = page();
    const pip = observers.filter((o) => o.attached > 0);
    assert.equal(pip.length, 0, 'no document-wide observer at startup');
    assert.equal(context.isPipPlaying, false);

    context.isPipPlaying = true;
    const attached = observers.filter((o) => o.attached > 0);
    assert.equal(attached.length, 1);
    assert.equal(context.isPipPlaying, true);
    context.isPipPlaying = true;
    assert.equal(attached[0].attached, 1, 'not attached twice');

    context.isPipPlaying = false;
    assert.equal(attached[0].disconnected, 1);
    context.isPipPlaying = true;
    assert.equal(attached[0].attached, 2, 'can re-attach for the next PiP session');
    assert.ok(document.body);
});
