// api/spotify.js
import fetch from 'node-fetch';

const NOW_PLAYING_URL = 'https://api.spotify.com/v1/me/player/currently-playing';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';

async function refreshToken() {
  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN } = process.env;
  const basic = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: SPOTIFY_REFRESH_TOKEN
    })
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

function svgEscape(text = '') {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderSVG({ title, artist, url }) {
  const display = artist ? `${title} — ${artist}` : title;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="760" height="90" viewBox="0 0 760 90" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Spotify Now Playing">
  <style>
    .card { fill: #121212; }
    .text { font: 600 16px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; fill: #fff; }
    .muted { font: 400 13px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; fill: #b3b3b3; }
    .dot { fill: #1DB954; }
    a { text-decoration: none; }
  </style>
  <rect class="card" x="0" y="0" width="760" height="90" rx="12" />
  <circle class="dot" cx="26" cy="26" r="6"/>
  <text class="text" x="46" y="32">Now Playing</text>
  <a href="${url || '#'}" target="_blank">
    <text class="text" x="26" y="60">${svgEscape(display)}</text>
  </a>
  <text class="muted" x="26" y="78">${svgEscape(url || '')}</text>
</svg>`;
}

export default async function handler(req, res) {
  try {
    const forceJSON = req.query.format === 'json' || /application\/json/i.test(req.headers.accept || '');
    const token = await refreshToken();

    const r = await fetch(NOW_PLAYING_URL, {
      headers: { Authorization: `Bearer ${token}` }
    });

    // 204 = nothing playing
    if (r.status === 204) {
      const payload = { isPlaying: false, title: 'Nothing playing right now' };
      if (forceJSON) {
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json(payload);
      }
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).send(renderSVG({ title: payload.title }));
    }

    const data = await r.json();

    const isPlaying = !!data?.is_playing;
    const title = data?.item?.name || 'Unknown Title';
    const artist = (data?.item?.artists || []).map(a => a.name).join(', ') || '';
    const url = data?.item?.external_urls?.spotify || '';

    const payload = { isPlaying, title, artist, songUrl: url };

    if (forceJSON) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(payload);
    }

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(renderSVG({ title, artist, url }));
  } catch (err) {
    const msg = (err && err.message) ? err.message : String(err);
    const fallback = { isPlaying: false, title: 'Nothing playing right now' };

    // If they asked for JSON, return JSON error shape
    if (req.query.format === 'json' || /application\/json/i.test(req.headers.accept || '')) {
      return res.status(200).json(fallback);
    }

    // Otherwise, SVG fallback
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(renderSVG({ title: fallback.title }));
  }
}