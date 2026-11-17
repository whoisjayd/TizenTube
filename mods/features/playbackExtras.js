// Playback extras that use the same <video> element on Samsung Tizen and Android TV Cobalt.
import { configRead, configWrite, configChangeEmitter } from '../config.js';
import { showToast } from '../ui/ytUI.js';
import { t } from 'i18next';
import { formatCount, formatEndTime, videoIdFromLocation } from '../utils/playbackFormat.js';

const DISLIKE_API = 'https://returnyoutubedislikeapi.com/votes?videoId=';
const dislikeCache = new Map();
let sleepTimer = null;
let lastVideoId = '';
let endTimeNode = null;
let dislikeNode = null;

function cornerNode(id, top) {
    let node = document.getElementById(id);
    if (node) return node;
    node = document.createElement('div');
    node.id = id;
    node.style.position = 'absolute';
    node.style.zIndex = '9999';
    node.style.left = '4%';
    node.style.top = top;
    node.style.fontSize = '1.4em';
    node.style.color = '#fff';
    node.style.textShadow = '0 1px 4px #000';
    node.style.pointerEvents = 'none';
    if (document.body) document.body.appendChild(node);
    return node;
}

function currentVideoId() {
    return videoIdFromLocation(location.hash, location.search);
}

function updateEndTime() {
    if (!endTimeNode) endTimeNode = cornerNode('tizentube-end-time', '2%');
    if (!configRead('showVideoEndTime')) {
        endTimeNode.style.display = 'none';
        return;
    }
    const video = document.querySelector('video');
    if (!video || !isFinite(video.duration) || video.duration <= 0) {
        endTimeNode.style.display = 'none';
        return;
    }
    const rate = video.playbackRate > 0 ? video.playbackRate : 1;
    const remaining = (video.duration - video.currentTime) / rate;
    const time = formatEndTime(new Date(), remaining, configRead('isClock12HourFormat'));
    endTimeNode.textContent = t('player.endsAt', { time });
    endTimeNode.style.display = 'block';
}

function rememberDislikes(id, data) {
    if (dislikeCache.has(id)) dislikeCache.delete(id);
    dislikeCache.set(id, data);
    while (dislikeCache.size > 50) dislikeCache.delete(dislikeCache.keys().next().value);
}

function updateDislikes() {
    if (!dislikeNode) dislikeNode = cornerNode('tizentube-dislikes', '6%');
    if (!configRead('showDislikes')) {
        dislikeNode.style.display = 'none';
        return;
    }
    const id = currentVideoId();
    if (!id) {
        dislikeNode.style.display = 'none';
        return;
    }
    const apply = (data) => {
        if (!data || currentVideoId() !== id) return;
        const likes = formatCount(data.likes);
        const dislikes = formatCount(data.dislikes);
        if (!likes && !dislikes) {
            dislikeNode.style.display = 'none';
            return;
        }
        dislikeNode.textContent = t('player.likes', { likes, dislikes });
        dislikeNode.style.display = 'block';
    };
    if (dislikeCache.has(id)) {
        apply(dislikeCache.get(id));
        return;
    }
    fetch(DISLIKE_API + encodeURIComponent(id))
        .then((res) => res.ok ? res.json() : null)
        .then((data) => {
            if (data) rememberDislikes(id, data);
            apply(data);
        })
        .catch(() => {});
}

function armSleepTimer(minutes, schedule, pause) {
    if (sleepTimer) clearTimeout(sleepTimer);
    sleepTimer = null;
    const wait = Number(minutes) || 0;
    if (wait <= 0) return;
    sleepTimer = schedule(() => {
        sleepTimer = null;
        pause();
        showToast('TizenTube', t('toasts.sleepTimerDone'));
        configWrite('sleepTimerMinutes', 0);
    }, wait * 60 * 1000);
}

function armFromConfig() {
    armSleepTimer(configRead('sleepTimerMinutes'), setTimeout, () => {
        const video = document.querySelector('video');
        if (video) video.pause();
    });
}

function refresh() {
    const id = currentVideoId();
    updateEndTime();
    if (id !== lastVideoId) {
        lastVideoId = id;
        updateDislikes();
    }
}

configChangeEmitter.addEventListener('configChange', (event) => {
    const key = event.detail?.key;
    if (key === 'sleepTimerMinutes') armFromConfig();
    if (key === 'showVideoEndTime' || key === 'showDislikes' || key === 'isClock12HourFormat') refresh();
});

function startPlaybackExtras() {
    if (typeof window === 'undefined' || typeof document === 'undefined' || typeof location === 'undefined') return;
    armFromConfig();
    setInterval(refresh, 10000);
    window.addEventListener('hashchange', refresh);
    if (document.readyState === 'complete') refresh();
    else window.addEventListener('load', refresh);
}

startPlaybackExtras();
