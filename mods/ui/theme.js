import { configRead } from '../config.js';

const style = document.createElement('style');
let css = '';
let appendedCss = '';

function updateStyle() {
    css = `
    ytlr-guide-response yt-focus-container {
        background-color: ${configRead('focusContainerColor')};
    }

    #container {
        background-color: ${configRead('trueBlackBackground') ? '#000000' : configRead('routeColor')} !important;
    }
`;
    if (configRead('trueBlackBackground')) {
        css += `
    ytlr-guide-response yt-focus-container {
        background-color: #000000;
    }
`;
    }
    const progressBarColor = configRead('progressBarColor');
    // Only accept plain CSS colours so a bad config value can't inject other rules.
    if (progressBarColor && /^#[0-9a-fA-F]{3,8}$/.test(progressBarColor)) {
        css += `
    .ytLrProgressBarPlayed {
        background-color: ${progressBarColor} !important;
    }
    .ytLrProgressBarPlayhead {
        background-color: ${progressBarColor} !important;
    }
`;
    }
    const existingStyle = document.querySelector('style[nonce]');
    if (existingStyle) {
        // Replace our previous block instead of appending again on every colour change.
        if (appendedCss) existingStyle.textContent = existingStyle.textContent.split(appendedCss).join('');
        existingStyle.textContent += css;
        appendedCss = css;
    } else {
        style.textContent = css;
    }
};

if (document.head) {
    document.head.appendChild(style);
} else {
    document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
}
updateStyle();
export default updateStyle;
