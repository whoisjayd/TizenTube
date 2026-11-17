import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatCount, formatEndTime, videoIdFromLocation } from '../utils/playbackFormat.js';

test('end time follows the remaining playback, including a faster rate already applied by the caller', () => {
    const now = new Date(2026, 10, 17, 21, 10, 0);
    assert.equal(formatEndTime(now, 31 * 60, false), '21:41');
    assert.equal(formatEndTime(now, 2 * 60 * 60, true), '11:10 PM');
    assert.equal(formatEndTime(now, NaN, false), '');
});

test('counts and video ids are formatted the same on Tizen and Android TV', () => {
    assert.equal(formatCount(980), '980');
    assert.equal(formatCount(1500), '1.5K');
    assert.equal(formatCount(2000000), '2M');
    assert.equal(formatCount(-1), '');
    assert.equal(videoIdFromLocation('#/watch?v=dQw4w9WgXcQ', ''), 'dQw4w9WgXcQ');
    assert.equal(videoIdFromLocation('', '?v=abcdefghijk&t=10'), 'abcdefghijk');
    assert.equal(videoIdFromLocation('#/', ''), '');
});
