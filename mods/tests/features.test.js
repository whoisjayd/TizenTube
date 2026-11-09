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

// Loads the shipped bundle into a fresh realm that records fetch() URLs and console.error calls.
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
    const fetched = [];
    const errors = [];
    const context = vm.createContext({
        ...eventTarget(),
        document,
        navigator: { language: 'en-US', userAgent: 'Tizen' },
        location: { hostname: 'www.youtube.com', href: 'https://www.youtube.com/tv', hash: '' },
        localStorage: { 'ytaf-configuration': JSON.stringify(config) },
        console: { log() {}, info() {}, warn() {}, error(...args) { errors.push(args); } },
        setTimeout() {},
        setInterval() {},
        clearTimeout() {},
        clearInterval() {},
        fetch(url) { fetched.push(String(url)); return new Promise(() => {}); },
        MutationObserver: class { observe() {} },
        Element: class {},
        CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
        CSS: { registerProperty() {} },
        getComputedStyle() { return { getPropertyValue: () => '' }; },
    });
    vm.runInContext('window = self = globalThis;', context);
    bundle.runInContext(context);
    return { context, fetched, errors };
}

function parse(context, value) {
    context.payload = JSON.stringify(value);
    return vm.runInContext('JSON.parse(payload)', context);
}

const shelf = (items, type) => ({ shelfRenderer: { tvhtml5ShelfRendererType: type, content: { horizontalListRenderer: { items } } } });
const tile = (contentId) => ({ tileRenderer: { contentId, onSelectCommand: { watchEndpoint: { videoId: contentId } } } });

test('parsing JSON null or a primitive is a quiet no-op', () => {
    const { context, errors } = page();
    assert.equal(vm.runInContext('JSON.parse("null")', context), null);
    assert.equal(vm.runInContext('JSON.parse("5")', context), 5);
    assert.equal(vm.runInContext('JSON.parse(\'"text"\')', context), 'text');
    assert.deepEqual(errors, [], 'no "error occured while processing the JSON" noise');
});

test('parsing an object whose items array is empty or lacks a guide section does not throw', () => {
    const { context } = page();
    assert.equal(parse(context, { items: [] }).items.length, 0);
    assert.equal(parse(context, { items: [{ other: 1 }] }).items.length, 1);
    assert.equal(parse(context, { items: [{ guideSectionRenderer: { items: [] } }, { other: 1 }] }).items.length, 2);
});

test('consecutive shelves that get removed are all processed', () => {
    const { context } = page({ enableShorts: false });
    const shorts = 'TVHTML5_SHELF_RENDERER_TYPE_SHORTS';
    const result = parse(context, { contents: { sectionListRenderer: { contents: [
        shelf([], shorts),
        shelf([], shorts),
        shelf([tile('keep')]),
    ] } } });
    const remaining = result.contents.sectionListRenderer.contents;
    assert.equal(remaining.filter(s => s.shelfRenderer.tvhtml5ShelfRendererType === shorts).length, 0,
        'the shelf after a removed one used to be skipped');
});

test('the tile after an ad slot is still processed by DeArrow', () => {
    // With ad blocking on, stripAdSlots removes the slot first; this is the path used when it is off.
    const { context, fetched } = page({ enableAdBlock: false });
    parse(context, { contents: { sectionListRenderer: { contents: [
        shelf([{ adSlotRenderer: {} }, tile('AAAAAAAAAAA'), tile('BBBBBBBBBBB')]),
    ] } } });
    assert.ok(fetched.some(url => url.includes('AAAAAAAAAAA')), 'tile right after the ad slot');
    assert.ok(fetched.some(url => url.includes('BBBBBBBBBBB')));
});

test('preferred video codec: default keeps every format, a chosen codec filters and tolerates missing mimeType', () => {
    const streamingData = () => ({ streamingData: { adaptiveFormats: [
        { mimeType: 'video/webm; codecs="vp9"' },
        { mimeType: 'video/mp4; codecs="avc1.4d401f"' },
        { mimeType: 'audio/mp4; codecs="mp4a.40.2"' },
        {},
    ] } });

    const { context: defaults, errors } = page();
    assert.equal(parse(defaults, streamingData()).streamingData.adaptiveFormats.length, 4);
    assert.deepEqual(errors, []);

    const { context: vp9, errors: vp9Errors } = page({ preferredVideoCodec: 'vp9' });
    const formats = parse(vp9, streamingData()).streamingData.adaptiveFormats;
    assert.deepEqual(Array.from(formats, f => f.mimeType?.split(';')[0]), ['video/webm', 'audio/mp4', undefined]);  // formats with no mimeType are kept, never filtered out
    assert.deepEqual(vp9Errors, [], 'a format without mimeType must not abort processing');
});
