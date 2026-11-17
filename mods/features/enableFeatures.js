// Enable features that aren't enabled by default due to YT seeing the TV as a low-end device.
// The same flag is used on Samsung Tizen and on Android TV Cobalt.
import { configRead, configChangeEmitter } from '../config.js';

configChangeEmitter.addEventListener('configChange', (event) => {
    enableFeatures();
});


function enableFeatures() {
    if (!window._yttv) return setTimeout(enableFeatures, 1000);
    const yttvValues = Object.values(window._yttv);
    yttvValues.find(a => a instanceof Map && a.has("ENABLE_PREVIEWS_WITH_SOUND"))?.set("ENABLE_PREVIEWS_WITH_SOUND", configRead('enablePreviews'));
}

if (document.readyState === 'complete') {
    enableFeatures();
} else window.addEventListener('load', enableFeatures);