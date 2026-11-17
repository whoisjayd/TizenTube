import { configRead } from '../config.js';
import { deArrowCacheLimit, deArrowFetchConcurrencyFor, deArrowWaitMs, getDeviceBudget } from '../utils/deviceBudget.js';

// DeArrow (https://dearrow.ajay.app/) titles and thumbnails.
//
// YouTube TV renders a tile as soon as it parses the API response, so branding that arrives later never shows.
// To get it in first, browse/search/next responses are held until branding arrives, bounded by the device budget.
// Lean TVs do not wait: a 2s hold plus a full JSON walk of the home feed is what makes those sets hitch.

const HELD_URL = /\/youtubei\/v1\/(browse|search|next)\b/;
const HELD_EVENTS = ['readystatechange', 'load', 'loadend'];
const CONTENT_ID = /"contentId"\s*:\s*"([A-Za-z0-9_-]{11})"/g;

const branding = new Map();  // videoID -> DeArrow branding response
const inFlight = new Map();  // videoID -> Promise of it
const fetchQueue = [];
let activeFetches = 0;

function remember(videoID, data) {
  if (!data || typeof data !== 'object') return;
  if (branding.has(videoID)) branding.delete(videoID);
  branding.set(videoID, data);
  const limit = deArrowCacheLimit();
  while (branding.size > limit) branding.delete(branding.keys().next().value);
}

function pumpFetches() {
  const max = deArrowFetchConcurrencyFor(getDeviceBudget());
  while (activeFetches < max && fetchQueue.length) {
    const job = fetchQueue.shift();
    activeFetches++;
    fetch(`https://sponsor.ajay.app/api/branding?videoID=${job.videoID}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        remember(job.videoID, data);
        return data || null;
      })
      .catch(() => null)
      .then(data => {
        inFlight.delete(job.videoID);
        activeFetches--;
        job.resolve(data);
        pumpFetches();
      });
  }
}

function fetchBranding(videoID) {
  if (branding.has(videoID)) return Promise.resolve(branding.get(videoID));
  if (inFlight.has(videoID)) return inFlight.get(videoID);
  const request = new Promise(resolve => {
    fetchQueue.push({ videoID, resolve });
    pumpFetches();
  });
  inFlight.set(videoID, request);
  return request;
}

function videoIdOf(item) {
  return item?.tileRenderer?.contentId || item?.lockupViewModel?.contentId;
}

function applyBranding(item, videoID, data) {
  // Like the thumbnails below, a title that was voted down (and is not locked) must not be shown.
  const usableTitles = data.titles?.filter(title => title.locked || title.votes >= 0) || [];
  if (usableTitles.length > 0) {
    const mostVoted = usableTitles.reduce((max, title) => max.votes > title.votes ? max : title);
    item.tileRenderer ?
      item.tileRenderer.metadata.tileMetadataRenderer.title.simpleText = mostVoted.title
      : item.lockupViewModel.metadata.lockupMetadataViewModel.title.content = mostVoted.title;
  }

  if (configRead('enableDeArrowThumbnails') && isVideo(item)) {
    const time = thumbnailTime(data);
    if (time != null) {
      const thumbnails = [
        {
          url: `https://dearrow-thumb.ajay.app/api/v1/getThumbnail?videoID=${videoID}&time=${time}`,
          width: 1280,
          height: 640
        }
      ];
      item.tileRenderer ?
        item.tileRenderer.header.tileHeaderRenderer.thumbnail.thumbnails = thumbnails
        : item.lockupViewModel.contentImage.thumbnailViewModel.image.sources = thumbnails;
    }
  }
}

function isVideo(item) {
  return item.tileRenderer
    ? !item.tileRenderer.contentType || item.tileRenderer.contentType === 'TILE_CONTENT_TYPE_VIDEO'
    : item.lockupViewModel?.contentType === 'LOCKUP_CONTENT_TYPE_VIDEO';
}

// The video time of the thumbnail to show, or null to keep the original. Like DeArrow's default ("random time"
// fallback), a video without a usable submitted thumbnail gets the frame at the random time the API picked for it.
// Videos the API has no record of keep their thumbnail: the thumbnail server has no frame for them yet.
function thumbnailTime(data) {
  const best = data.thumbnails?.length > 0
    ? data.thumbnails.reduce((max, thumbnail) => max.votes > thumbnail.votes ? max : thumbnail)
    : null;
  if (best && (best.locked || best.votes >= 0)) return best.original ? null : best.timestamp ?? null;
  if (data.randomTime != null && data.videoDuration > 0) return data.randomTime * data.videoDuration;
  return null;
}

/** Applies DeArrow branding to a tile or lockup, right away when it was prefetched, otherwise once it arrives. */
export function deArrowItem(item) {
  if (!configRead('enableDeArrow')) return;
  const videoID = videoIdOf(item);
  if (!videoID) return;
  const apply = data => {
    try {
      if (data) applyBranding(item, videoID, data);
    } catch (e) { }
  };
  if (branding.has(videoID)) apply(branding.get(videoID));
  else fetchBranding(videoID).then(apply);
}

function idsFromText(text) {
  const ids = [];
  if (!text) return ids;
  // Scanning the whole home-feed string still beats a second JSON.parse of it.
  const sample = text.length > 1500000 ? text.slice(0, 1500000) : text;
  const cap = deArrowWaitMs() === 0 ? 8 : 30;
  const seen = new Set();
  CONTENT_ID.lastIndex = 0;
  let match;
  while (ids.length < cap && (match = CONTENT_ID.exec(sample))) {
    const id = match[1];
    if (seen.has(id) || branding.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  CONTENT_ID.lastIndex = 0;
  return ids;
}

function prefetchFor(xhr) {
  if (xhr.__deArrowPrefetch) return xhr.__deArrowPrefetch;
  let ids = [];
  try {
    if (xhr.responseType === '' || xhr.responseType === 'text') ids = idsFromText(xhr.responseText);
  } catch (e) { }
  const wait = deArrowWaitMs();
  if (!ids.length || wait === 0) {
    for (let i = 0; i < ids.length; i++) fetchBranding(ids[i]);
    xhr.__deArrowPrefetch = Promise.resolve();
    return xhr.__deArrowPrefetch;
  }
  const fetched = Promise.all(ids.map(fetchBranding));
  const timeout = new Promise(resolve => setTimeout(resolve, wait));
  xhr.__deArrowPrefetch = Promise.race([fetched, timeout]);
  return xhr.__deArrowPrefetch;
}

const holders = new WeakMap();  // listener -> its holding wrapper

function holding(listener) {
  if (typeof listener !== 'function') return listener;
  let wrapper = holders.get(listener);
  if (!wrapper) {
    wrapper = function (event) {
      const xhr = this instanceof XMLHttpRequest ? this : event?.target;
      if (!xhr?.__deArrowHold || xhr.readyState !== 4) return listener.apply(this, arguments);
      const self = this, args = arguments;
      const pending = prefetchFor(xhr);
      // Lean budget: start the fetches, but do not delay YouTube's own listener.
      if (deArrowWaitMs() === 0) return listener.apply(self, args);
      pending.then(() => listener.apply(self, args));
    };
    wrapper.__deArrowListener = listener;
    holders.set(listener, wrapper);
  }
  return wrapper;
}

function holdTileResponses() {
  const proto = window.XMLHttpRequest?.prototype;
  if (!proto) return;

  const open = proto.open;
  proto.open = function (method, url) {
    this.__deArrowHold = configRead('enableDeArrow') && HELD_URL.test(String(url));
    return open.apply(this, arguments);
  };

  const add = proto.addEventListener;
  const remove = proto.removeEventListener;
  proto.addEventListener = function (type, listener, options) {
    return add.call(this, type, HELD_EVENTS.includes(type) ? holding(listener) : listener, options);
  };
  proto.removeEventListener = function (type, listener, options) {
    const wrapper = HELD_EVENTS.includes(type) && holders.get(listener);
    return remove.call(this, type, wrapper || listener, options);
  };

  for (const type of HELD_EVENTS) {
    const name = 'on' + type;
    let owner = proto;
    while (owner && !Object.getOwnPropertyDescriptor(owner, name)) owner = Object.getPrototypeOf(owner);
    const descriptor = owner && Object.getOwnPropertyDescriptor(owner, name);
    if (!descriptor?.get || !descriptor?.set) continue;
    Object.defineProperty(proto, name, {
      configurable: true,
      enumerable: descriptor.enumerable,
      get() {
        const wrapper = descriptor.get.call(this);
        return wrapper?.__deArrowListener || wrapper;
      },
      set(listener) {
        descriptor.set.call(this, holding(listener));
      }
    });
  }
}

holdTileResponses();
