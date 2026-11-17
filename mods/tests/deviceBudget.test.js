import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    applyRuntimeBudget,
    classifyDevice,
    deArrowCacheLimitFor,
    deArrowWaitMsFor,
    isAndroidTvRuntime,
    isBackKey,
    isSelectKey,
    previewLimitsFor,
} from '../utils/deviceBudget.js';

test('unknown and current TVs stay on the full budget', () => {
    assert.equal(classifyDevice(undefined, undefined), 'full');
    assert.equal(classifyDevice({ userAgent: 'Tizen' }, undefined), 'full');
    assert.equal(classifyDevice({ userAgent: 'Mozilla/5.0 (SMART-TV; LINUX; Tizen 6.5)', deviceMemory: 4 }, undefined), 'full');
    assert.equal(classifyDevice({ deviceMemory: 8 }, { memory: { jsHeapSizeLimit: 1024 * 1024 * 1024 } }), 'full');
});

test('Tizen 4 and 1 GB sets are lean, Tizen 5 and 2 GB sets are balanced', () => {
    assert.equal(classifyDevice({ userAgent: 'Mozilla/5.0 (SMART-TV; LINUX; Tizen 4.0)' }, undefined), 'lean');
    assert.equal(classifyDevice({ userAgent: 'Tizen/3.0', deviceMemory: 4 }, undefined), 'lean');
    assert.equal(classifyDevice({ deviceMemory: 1 }, undefined), 'lean');
    assert.equal(classifyDevice({ deviceMemory: 0.5 }, { memory: { jsHeapSizeLimit: 128 * 1024 * 1024 } }), 'lean');
    assert.equal(classifyDevice({ userAgent: 'Tizen 5.5', deviceMemory: 4 }, undefined), 'balanced');
    assert.equal(classifyDevice({ deviceMemory: 2 }, undefined), 'balanced');
    assert.equal(classifyDevice({ deviceMemory: 8 }, { memory: { jsHeapSizeLimit: 200 * 1024 * 1024 } }), 'balanced');
});

test('previews and DeArrow stay on for every budget, including Android TV', () => {
    assert.equal(previewLimitsFor('lean').durationMs, 40000);
    assert.equal(previewLimitsFor('lean').muted, false);
    assert.equal(previewLimitsFor('balanced').durationMs, 40000);
    assert.equal(deArrowWaitMsFor('lean'), 2000);
    assert.equal(deArrowWaitMsFor('full'), 2000);
    assert.equal(deArrowCacheLimitFor('lean'), 40);
});

test('Android TV Cobalt is recognized, and a Samsung Tizen UA is not', () => {
    assert.equal(isAndroidTvRuntime({ userAgent: 'Mozilla/5.0 (Linux; Android 9; AFTMM) Cobalt/25' }, undefined), true);
    assert.equal(isAndroidTvRuntime({ userAgent: 'Mozilla/5.0 (Linux; Android 11; SHIELD Android TV)' }, undefined), true);
    assert.equal(isAndroidTvRuntime({ userAgent: 'Tizen' }, { h5vcc: {} }), true);
    assert.equal(isAndroidTvRuntime({ userAgent: 'Mozilla/5.0 (SMART-TV; LINUX; Tizen 6.5)' }, undefined), false);
    assert.equal(isBackKey(4), true);
    assert.equal(isBackKey(27), true);
    assert.equal(isBackKey(37), false);
    assert.equal(isSelectKey(23), true);
    assert.equal(isSelectKey(13), true);
});

test('Fix UI requests the full layout on a small TV and on a large one', () => {
    const lean = {
        tectonicConfig: { featureSwitches: { enableAnimations: false, isLimitedMemory: true }, clientData: {} },
    };
    const full = {
        tectonicConfig: { featureSwitches: {}, clientData: {} },
    };
    applyRuntimeBudget(lean, 'lean');
    applyRuntimeBudget(full, 'full');
    assert.equal(lean.tectonicConfig.featureSwitches.isLimitedMemory, false);
    assert.equal(lean.tectonicConfig.featureSwitches.enableAnimations, true);
    assert.equal(lean.tectonicConfig.featureSwitches.enableListAnimations, true);
    assert.equal(lean.tectonicConfig.clientData.legacyApplicationQuality, 'full-animation');
    assert.equal(full.tectonicConfig.featureSwitches.enableAnimations, true);
    assert.equal(full.tectonicConfig.clientData.legacyApplicationQuality, 'full-animation');
});
