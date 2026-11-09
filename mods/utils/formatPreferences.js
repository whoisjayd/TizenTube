// Picks which adaptiveFormats the player is allowed to see.
//
// Every filter here is "soft": if applying it would leave no video (or no audio) format at all,
// that filter is skipped, so a preference can never make a video unplayable.
// With all preferences at their defaults the input array is returned untouched.

const HIGH_FPS = 50;

function mimeOf(format) {
  return (format && typeof format.mimeType === 'string') ? format.mimeType : '';
}

function isVideo(format) {
  return mimeOf(format).startsWith('video/');
}

function isAudio(format) {
  return mimeOf(format).startsWith('audio/');
}

// Short side of the frame, so 1080x1920 portrait and 2560x1080 ultrawide both count as 1080p.
export function getResolution(format) {
  const width = Number(format?.width);
  const height = Number(format?.height);
  if (width > 0 && height > 0) return Math.min(width, height);
  if (height > 0) return height;
  const match = /(\d{3,4})p/.exec(format?.qualityLabel || '');
  return match ? Number(match[1]) : 0;
}

function bitrateOf(format) {
  return Number(format?.averageBitrate || format?.bitrate) || 0;
}

function audioTrackKey(format) {
  return (format && format.audioTrack && format.audioTrack.id) || '';
}

function filterVideoCodec(formats, codec) {
  if (!codec || codec === 'any') return formats;
  if (!formats.some((f) => mimeOf(f).includes(codec))) return formats;
  return formats.filter((f) => !isVideo(f) || mimeOf(f).includes(codec));
}

function filterMaxResolution(formats, max) {
  const cap = Number(max);
  if (!(cap > 0)) return formats;
  const kept = formats.filter((f) => !isVideo(f) || getResolution(f) <= cap || getResolution(f) === 0);
  return kept.some(isVideo) ? kept : formats;
}

// For every resolution that has a 50/60 fps variant, drop the 24/30 fps variants of that same
// resolution. Resolutions that only exist at 30 fps stay, so the adaptive ladder keeps its low rungs.
function filterHighFrameRate(formats) {
  const highFpsResolutions = {};
  for (const f of formats) {
    if (isVideo(f) && Number(f.fps) >= HIGH_FPS) highFpsResolutions[getResolution(f)] = true;
  }
  return formats.filter((f) => !isVideo(f) || Number(f.fps) >= HIGH_FPS || !highFpsResolutions[getResolution(f)]);
}

// Works per audio track, so a dubbed track that only exists in one codec is never dropped.
function filterAudio(formats, codec, quality) {
  const wantCodec = codec && codec !== 'any';
  const wantHighest = quality === 'highest';
  if (!wantCodec && !wantHighest) return formats;

  const groups = {};
  for (const f of formats) {
    if (!isAudio(f)) continue;
    const key = audioTrackKey(f);
    (groups[key] = groups[key] || []).push(f);
  }

  const keep = new Set();
  for (const key of Object.keys(groups)) {
    let candidates = groups[key];
    if (wantCodec) {
      const preferred = candidates.filter((f) => mimeOf(f).includes(codec));
      if (preferred.length) candidates = preferred;
    }
    if (wantHighest) {
      let best = candidates[0];
      for (const f of candidates) if (bitrateOf(f) > bitrateOf(best)) best = f;
      candidates = [best];
    }
    for (const f of candidates) keep.add(f);
  }

  return formats.filter((f) => !isAudio(f) || keep.has(f));
}

/**
 * @param {Array} formats streamingData.adaptiveFormats
 * @param {{videoCodec?: string, audioCodec?: string, audioQuality?: string,
 *          maxResolution?: string|number, preferHighFrameRate?: boolean}} prefs
 */
export function applyFormatPreferences(formats, prefs) {
  if (!Array.isArray(formats) || formats.length === 0 || !prefs) return formats;

  let result = filterVideoCodec(formats, prefs.videoCodec);
  result = filterMaxResolution(result, prefs.maxResolution);
  if (prefs.preferHighFrameRate) result = filterHighFrameRate(result);
  result = filterAudio(result, prefs.audioCodec, prefs.audioQuality);
  return result;
}
