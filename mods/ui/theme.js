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
        background-color: ${configRead('routeColor')} !important;
    }
`;
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
