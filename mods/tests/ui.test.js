import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import { parseTimestamps } from '../ui/chapters.js';

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

// A fully loaded page, same shape as the one in startup.test.js.
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
    const context = vm.createContext({
        ...eventTarget(),
        document,
        navigator: { language: 'en-US', userAgent: 'Tizen' },
        location: { hostname: 'www.youtube.com', href: 'https://www.youtube.com/tv', hash: '' },
        localStorage: { 'ytaf-configuration': JSON.stringify(config) },
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
    return context;
}

test('the global JSON.parse hook passes through JSON that is not a guide response', () => {
    const context = page();
    for (const text of ['null', '0', 'true', '"x"', '[]', '{}', '{"items":[]}', '{"items":[1,null]}']) {
        context.text = text;
        assert.doesNotThrow(() => vm.runInContext('JSON.parse(text)', context), `JSON.parse(${text})`);
    }
    context.text = '{"items":[]}';
    assert.deepEqual(JSON.parse(JSON.stringify(vm.runInContext('JSON.parse(text)', context))), { items: [] });
});

test('guide responses with a non-section entry after the first section survive the hook', () => {
    const context = page({ sidebarContentsOrder: [] });
    context.text = JSON.stringify({
        items: [
            { guideSectionRenderer: { items: [
                { guideEntryRenderer: { navigationEndpoint: { browseEndpoint: { browseId: 'FEwhat_to_watch' } } } },
            ] } },
            { guideCollapsibleSectionRenderer: {} },
        ],
    });
    const guide = vm.runInContext('JSON.parse(text)', context);
    assert.equal(guide.items.length, 2);
    assert.equal(guide.items[0].guideSectionRenderer.items.length, 1);
});

test('chapter timestamps: m:ss and h:mm:ss are both parsed to the right time', () => {
    const chapters = parseTimestamps([
        '0:00 Intro',
        '12:34 Middle',
        '1:02:30 Long section',
        '10:05:09 Very long',
        'not a timestamp',
    ].join('\n'));
    assert.deepEqual(chapters.map(c => c.time), [0, 754000, 3750000, 36309000]);
    assert.deepEqual(chapters.map(c => c.name), ['Intro', 'Middle', 'Long section', 'Very long']);
});
