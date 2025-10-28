import fetch from "node-fetch";

export default async function handler(req, res) {
  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN } = process.env;

  // Refresh Spotify access token
  const auth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64");
  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: SPOTIFY_REFRESH_TOKEN,
    }),
  });

  const tokenData = await tokenRes.json();
  const access_token = tokenData.access_token;

  // Fetch currently playing song
  const playingRes = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  res.setHeader("Content-Type", "image/svg+xml");

  // Handle "nothing playing"
  if (playingRes.status === 204 || playingRes.status > 400) {
    return res.status(200).send(`
      <svg xmlns="http://www.w3.org/2000/svg" width="400" height="28" role="img">
        <rect width="400" height="28" fill="#1DB954" rx="5"/>
        <text x="50%" y="50%" fill="#ffffff" font-size="13" font-family="Arial" text-anchor="middle" alignment-baseline="middle">
          🎧 Nothing playing right now
        </text>
      </svg>
    `);
  }

  const data = await playingRes.json();
  const title = data?.item?.name || "Unknown";
  const artist = data?.item?.artists?.map(a => a.name).join(", ") || "Unknown Artist";
  const text = `🎵 ${title} — ${artist}`.replace(/&/g, "&amp;");

  // SVG width and animation duration
  const width = 400;
  const duration = Math.min(20 + text.length / 4, 30);

  res.status(200).send(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="28" role="img">
      <style>
        @keyframes scroll {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .marquee {
          animation: scroll ${duration}s linear infinite;
        }
      </style>
      <rect width="${width}" height="28" fill="#1DB954" rx="5"/>
      <clipPath id="clip">
        <rect x="5" y="0" width="${width - 10}" height="28" />
      </clipPath>
      <g clip-path="url(#clip)">
        <text x="100%" y="50%" fill="#ffffff" font-size="13" font-family="Arial" alignment-baseline="middle" class="marquee">
          ${text}
        </text>
      </g>
    </svg>
  `);
}