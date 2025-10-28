import fetch from "node-fetch";

export default async function handler(req, res) {
  const refresh_token = process.env.SPOTIFY_REFRESH_TOKEN;
  const client_id = process.env.SPOTIFY_CLIENT_ID;
  const client_secret = process.env.SPOTIFY_CLIENT_SECRET;

  const basic = Buffer.from(`${client_id}:${client_secret}`).toString("base64");

  // Request a new access token
  const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token,
    }),
  });

  const tokenData = await tokenResponse.json();
  const access_token = tokenData.access_token;

  // Request currently playing track
  const nowPlayingResponse = await fetch(
    "https://api.spotify.com/v1/me/player/currently-playing",
    { headers: { Authorization: `Bearer ${access_token}` } }
  );

  if (nowPlayingResponse.status === 204 || nowPlayingResponse.status > 400) {
    res.setHeader("Content-Type", "image/svg+xml");
    res.status(200).send(`
      <svg xmlns="http://www.w3.org/2000/svg" width="400" height="60">
        <text x="10" y="35" font-size="16" fill="#999">Nothing playing right now 🎧</text>
      </svg>
    `);
    return;
  }

  const song = await nowPlayingResponse.json();
  const title = song.item.name;
  const artist = song.item.artists.map(a => a.name).join(", ");

  res.setHeader("Content-Type", "image/svg+xml");
  res.status(200).send(`
    <svg xmlns="http://www.w3.org/2000/svg" width="500" height="60">
      <text x="10" y="25" font-size="16" font-weight="bold" fill="#1DB954">${title}</text>
      <text x="10" y="45" font-size="14" fill="#ccc">by ${artist}</text>
    </svg>
  `);
}