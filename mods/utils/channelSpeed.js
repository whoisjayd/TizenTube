import { configRead, configWrite } from '../config.js';

const MAX_REMEMBERED_CHANNELS = 200;

// Set from player responses (see adblock.js); identifies the channel of the video being played.
export function setCurrentChannelId(channelId) {
  if (typeof channelId === 'string' && channelId) window.__ttCurrentChannelId = channelId;
}

export function getCurrentChannelId() {
  return window.__ttCurrentChannelId || null;
}

// Speed to apply when a video starts: the channel's remembered speed when the option is on, else the global speed.
export function getSpeedForCurrentChannel() {
  const globalSpeed = configRead('videoSpeed');
  if (!configRead('rememberSpeedPerChannel')) return globalSpeed;
  const channelId = getCurrentChannelId();
  const saved = channelId ? configRead('channelSpeeds')?.[channelId] : undefined;
  return typeof saved === 'number' && saved > 0 ? saved : globalSpeed;
}

export function rememberSpeedForCurrentChannel(speed) {
  if (!configRead('rememberSpeedPerChannel')) return;
  const channelId = getCurrentChannelId();
  if (!channelId || !(speed > 0)) return;
  const speeds = Object.assign({}, configRead('channelSpeeds'));
  delete speeds[channelId]; // re-insert so the most recently used channel is last
  speeds[channelId] = speed;
  const keys = Object.keys(speeds);
  for (let i = 0; i < keys.length - MAX_REMEMBERED_CHANNELS; i++) delete speeds[keys[i]];
  configWrite('channelSpeeds', speeds);
}
