// Drops skippable segments shorter than minSeconds. Highlights (poi_highlight) are a single point and are always kept.
export function filterShortSegments(segments, minSeconds) {
  const min = Number(minSeconds);
  if (!(min > 0)) return segments;
  return segments.filter((segment) => {
    if (segment.category === 'poi_highlight') return true;
    const [start, end] = segment.segment;
    return end - start >= min;
  });
}
