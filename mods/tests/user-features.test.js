import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

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
        ...eventTarget(),
        style: {},
        children: [],
        classList: { contains: () => false },
        appendChild(child) { this.children.push(child); },
        setAttribute() {},
    };
}

// A fully loaded page running the shipped bundle.
function page(config = {}) {
    const document = {
        ...eventTarget(),
        readyState: 'complete',
        documentElement: element(),
        head: element(),
        body: element(),
        createElement: element,
        querySelector: () => null,
        getElementById: () => null,
    };
    const storage = { 'ytaf-configuration': JSON.stringify(config) };
    const context = vm.createContext({
        ...eventTarget(),
        document,
        navigator: { language: 'en-US', userAgent: 'Tizen' },
        location: { hostname: 'www.youtube.com', href: 'https://www.youtube.com/tv', hash: '' },
        localStorage: storage,
        console: { log() {}, info() {}, warn() {}, error() {} },
        setTimeout() {},
        setInterval() {},
        clearTimeout() {},
        clearInterval() {},
        fetch() {},
        CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
        MutationObserver: class { observe() {} },
        Element: class {},
        CSS: { registerProperty() {} },
        getComputedStyle: () => ({ getPropertyValue: () => '' }),
    });
    vm.runInContext('window = self = globalThis;', context);
    bundle.runInContext(context);
    return { context, document, storage };
}

function themeCss(document) {
    return document.head.children.map((child) => child.textContent || '').join('\n');
}

test('defaults keep the existing look: no progress bar override and the configured route colour', () => {
    const { document } = page();
    const css = themeCss(document);
    assert.ok(!css.includes('ytLrProgressBarPlayed'), 'no progress bar rules by default');
    assert.ok(css.includes('#0f0f0f'), 'route colour unchanged');
    assert.ok(!css.includes('#000000'));
});

test('true black background overrides the route colour', () => {
    const { document } = page({ trueBlackBackground: true });
    const css = themeCss(document);
    assert.match(css, /#container\s*{\s*background-color: #000000 !important/);
});

test('progress bar colour applies to the played bar and playhead', () => {
    const { document } = page({ progressBarColor: '#00c853' });
    const css = themeCss(document);
    assert.match(css, /\.ytLrProgressBarPlayed\s*{\s*background-color: #00c853 !important/);
    assert.match(css, /\.ytLrProgressBarPlayhead\s*{\s*background-color: #00c853 !important/);
});

test('progress bar colour ignores values that are not a hex colour', () => {
    const { document } = page({ progressBarColor: 'red; } body { display:none' });
    assert.ok(!themeCss(document).includes('display:none'));
    assert.ok(!themeCss(document).includes('ytLrProgressBarPlayed'));
});

test('the player response hook records the channel of the video being played', () => {
    const { context } = page();
    vm.runInContext(`JSON.parse('{"videoDetails":{"channelId":"UC1","videoId":"a"}}')`, context);
    assert.equal(vm.runInContext('window.__ttCurrentChannelId', context), 'UC1');
});

test('per-channel speed is remembered and restored per channel when enabled', async () => {
    // Exercise the source module directly against a minimal window/localStorage.
    globalThis.window = { localStorage: { 'ytaf-configuration': JSON.stringify({ rememberSpeedPerChannel: true, videoSpeed: 1 }) } };
    const quiet = { log() {}, info() {}, warn() {}, error() {} };
    const realConsole = globalThis.console;
    globalThis.console = Object.assign(Object.create(realConsole), quiet);
    try {
        const speed = await import('../utils/channelSpeed.js');
        assert.equal(speed.getSpeedForCurrentChannel(), 1, 'falls back to the global speed with no channel');

        speed.setCurrentChannelId('UCa');
        speed.rememberSpeedForCurrentChannel(1.75);
        speed.setCurrentChannelId('UCb');
        assert.equal(speed.getSpeedForCurrentChannel(), 1, 'other channels keep the global speed');
        speed.rememberSpeedForCurrentChannel(0.5);

        speed.setCurrentChannelId('UCa');
        assert.equal(speed.getSpeedForCurrentChannel(), 1.75);
        speed.setCurrentChannelId('UCb');
        assert.equal(speed.getSpeedForCurrentChannel(), 0.5);

        speed.rememberSpeedForCurrentChannel(NaN);
        assert.equal(speed.getSpeedForCurrentChannel(), 0.5, 'invalid speeds are ignored');
    } finally {
        globalThis.console = realConsole;
        delete globalThis.window;
    }
});

test('ignore short SponsorBlock segments filters by length and keeps highlights', async () => {
    globalThis.window = { localStorage: {} };
    try {
        const { filterShortSegments } = await import('../utils/sponsorSegments.js');
        const segments = [
            { category: 'sponsor', segment: [10, 12] },
            { category: 'sponsor', segment: [20, 40] },
            { category: 'poi_highlight', segment: [50, 50] },
        ];
        assert.equal(filterShortSegments(segments, 0).length, 3, 'default keeps everything');
        assert.equal(filterShortSegments(segments, undefined).length, 3);
        assert.deepEqual(filterShortSegments(segments, 5).map((s) => s.segment[0]), [20, 50]);
        assert.deepEqual(filterShortSegments(segments, 100).map((s) => s.category), ['poi_highlight']);
    } finally {
        delete globalThis.window;
    }
});

test('new settings all have English strings and safe defaults', () => {
    const en = JSON.parse(readFileSync(new URL('../translations/resources/en.json', import.meta.url), 'utf8'));
    const ui = en.settings.options.uiSettings.options;
    assert.ok(ui.trueBlackBackground && ui.rememberSpeedPerChannel);
    assert.ok(ui.progressBarColor.title && ui.progressBarColor.subtitle);
    for (const id of ['default', 'red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink', 'white']) {
        assert.ok(ui.progressBarColor.colors[id], `colour ${id}`);
    }
    const sb = en.settings.options.sponsorblock.options.minSegmentLength;
    assert.ok(sb.title && sb.subtitle && sb.off);

    const { context } = page();
    for (const [key, expected] of Object.entries({ progressBarColor: '', trueBlackBackground: false, rememberSpeedPerChannel: false, sponsorBlockMinSegmentSeconds: 0 })) {
        assert.ok(readFileSync(new URL('../config.js', import.meta.url), 'utf8').includes(`${key}: ${JSON.stringify(expected).replace(/"/g, "'")}`), key);
    }
    assert.ok(context);
});
