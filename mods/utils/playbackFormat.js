export function formatEndTime(now, remainingSeconds, hour12) {
    if (!isFinite(remainingSeconds) || remainingSeconds < 0) return '';
    const end = new Date(now.getTime() + remainingSeconds * 1000);
    let hours = end.getHours();
    const minutes = String(end.getMinutes()).padStart(2, '0');
    if (hour12) {
        const suffix = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        return `${hours}:${minutes} ${suffix}`;
    }
    return `${String(hours).padStart(2, '0')}:${minutes}`;
}

export function formatCount(value) {
    const n = Number(value);
    if (!isFinite(n) || n < 0) return '';
    if (n >= 1000000) return `${(n / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
    return String(Math.round(n));
}

export function videoIdFromLocation(hash, search) {
    const source = `${hash || ''} ${search || ''}`;
    const match = /[?&]v=([^&#\s]+)/.exec(source);
    return match ? decodeURIComponent(match[1]) : '';
}
