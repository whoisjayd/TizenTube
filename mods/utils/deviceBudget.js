// Samsung Tizen TVs range from about 1 GB (Tizen 3/4, Chrome 47–56) to 3 GB+.
// YouTube's own leanback client already has a limited-memory mode. This module
// picks a budget once and the hot paths use it so a small TV does less work.

let cachedBudget;

export function classifyDevice(nav, perf) {
    let level = 2; // 0 lean, 1 balanced, 2 full
    try {
        const mem = nav && nav.deviceMemory;
        if (typeof mem === 'number' && mem > 0) {
            if (mem <= 1) level = 0;
            else if (mem <= 2) level = 1;
        }
        const heap = perf && perf.memory && perf.memory.jsHeapSizeLimit;
        if (typeof heap === 'number') {
            if (heap < 192 * 1024 * 1024) level = Math.min(level, 0);
            else if (heap < 384 * 1024 * 1024) level = Math.min(level, 1);
        }
        const ua = (nav && nav.userAgent) || '';
        const match = /Tizen[\/ ](\d+)/i.exec(ua);
        if (match) {
            const major = parseInt(match[1], 10);
            if (major <= 4) level = Math.min(level, 0);
            else if (major === 5) level = Math.min(level, 1);
        }
    } catch (e) { }
    return level === 0 ? 'lean' : level === 1 ? 'balanced' : 'full';
}

export function getDeviceBudget() {
    if (!cachedBudget) {
        cachedBudget = classifyDevice(
            typeof navigator !== 'undefined' ? navigator : undefined,
            typeof performance !== 'undefined' ? performance : undefined
        );
    }
    return cachedBudget;
}

// Previews stay available on every TV, including 1 GB Android TV boxes. The setting
// enablePreviews is the only switch. Budget never turns the feature off.
export function previewLimitsFor() {
    return { delayMs: 3000, durationMs: 40000, muted: false };
}

export function previewLimits() {
    return previewLimitsFor(getDeviceBudget());
}

// DeArrow titles only land if the response is held until branding arrives.
// The same wait is used on Tizen and Android TV so the feature is not dropped on small sets.
export function deArrowWaitMsFor() {
    return 2000;
}

export function deArrowWaitMs() {
    return deArrowWaitMsFor(getDeviceBudget());
}

export function deArrowCacheLimitFor(budget) {
    if (budget === 'lean') return 40;
    if (budget === 'balanced') return 80;
    return 160;
}

export function deArrowCacheLimit() {
    return deArrowCacheLimitFor(getDeviceBudget());
}

export function deArrowFetchConcurrencyFor(budget) {
    if (budget === 'lean') return 2;
    if (budget === 'balanced') return 3;
    return 4;
}

// Cobalt on Android TV (Fire TV, Google TV, Sony, TCL) exposes h5vcc and a Cobalt user agent.
export function isAndroidTvRuntime(nav, root) {
    if (root && root.h5vcc) return true;
    const ua = (nav && nav.userAgent) || '';
    return /Cobalt|Android TV|AFT[A-Z0-9]|BRAVIA|GoogleTV|CrKey|SMART-TV/i.test(ua) && /Android|Cobalt|AFT/i.test(ua);
}

// Samsung Back is 27 or 461. Android TV Back is 4. Both have to close the same menus.
export function isBackKey(code) {
    return code === 27 || code === 4 || code === 461;
}

// Samsung OK is 13. Android TV D-pad center is 23.
export function isSelectKey(code) {
    return code === 13 || code === 23 || code === 32;
}

// "Fix UI" asks YouTube for the full layout. It is called only when that setting is on,
// which defaults off under Cobalt so Android TV keeps YouTube's own layout.
export function applyRuntimeBudget(root, budget = getDeviceBudget()) {
    const tectonic = root && root.tectonicConfig;
    const switches = tectonic && tectonic.featureSwitches;
    if (!switches) return budget;
    try {
        switches.supportsLongPress = true;
        switches.enableCaptionsPersistence = true;
        switches.isLimitedMemory = false;
        switches.enableAnimations = true;
        switches.enableOnScrollLinearAnimation = true;
        switches.enableListAnimations = true;
        if (tectonic.clientData) tectonic.clientData.legacyApplicationQuality = 'full-animation';
    } catch (e) { }
    return budget;
}
