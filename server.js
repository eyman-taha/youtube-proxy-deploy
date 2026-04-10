/**
 * YouTube Audio Proxy Server
 * Uses Invidious API to extract audio URLs from YouTube videos
 */

import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const INVIDIOUS_INSTANCES = [
  "https://yewtu.be",
  "https://invidious.privacyredirect.com",
  "https://invidious.fdn.fr",
  "https://vid.puffyan.us",
];

let currentInstanceIndex = 0;

function getNextInvidiousInstance() {
  const instance = INVIDIOUS_INSTANCES[currentInstanceIndex];
  currentInstanceIndex = (currentInstanceIndex + 1) % INVIDIOUS_INSTANCES.length;
  return instance;
}

async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(15000),
      });
      return response;
    } catch (error) {
      console.log(`[proxy] Fetch attempt ${i + 1} failed: ${error.message}`);
      if (i === retries - 1) throw error;
    }
  }
}

app.get("/", (req, res) => {
  res.json({
    name: "YouTube Audio Proxy",
    version: "2.0.0",
    status: "running",
    endpoints: {
      audio: "/audio?videoId=VIDEO_ID",
      info: "/info?videoId=VIDEO_ID",
    },
  });
});

app.get("/info", async (req, res) => {
  const { videoId } = req.query;

  if (!videoId) {
    return res.status(400).json({ error: "Missing videoId parameter" });
  }

  let lastError = null;

  for (let attempt = 0; attempt < INVIDIOUS_INSTANCES.length; attempt++) {
    const instance = getNextInvidiousInstance();

    try {
      console.log(`[proxy] Getting info from ${instance} for: ${videoId}`);

      const response = await fetchWithRetry(
        `${instance}/api/v1/videos/${videoId}?fields=title,videoId,author,authorId,lengthSeconds,thumbnailUrl,adaptiveFormats`
      );

      if (!response.ok) {
        console.log(`[proxy] Response not OK: ${response.status}`);
        continue;
      }

      const data = await response.json();

      if (data.error) {
        console.log(`[proxy] API error: ${data.error}`);
        continue;
      }

      return res.json({
        success: true,
        videoId: data.videoId,
        title: data.title || "Unknown",
        channelName: data.author || "Unknown",
        thumbnail: data.thumbnailUrl || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        durationSeconds: data.lengthSeconds || 0,
      });
    } catch (error) {
      console.log(`[proxy] Error with ${instance}: ${error.message}`);
      lastError = error;
    }
  }

  res.status(500).json({
    error: lastError?.message || "Could not fetch video info",
    code: "INFO_FAILED",
  });
});

app.get("/audio", async (req, res) => {
  const { videoId } = req.query;

  if (!videoId) {
    return res.status(400).json({ error: "Missing videoId parameter" });
  }

  let lastError = null;

  for (let attempt = 0; attempt < INVIDIOUS_INSTANCES.length; attempt++) {
    const instance = getNextInvidiousInstance();

    try {
      console.log(`[proxy] Getting audio from ${instance} for: ${videoId}`);

      const response = await fetchWithRetry(
        `${instance}/api/v1/videos/${videoId}?fields=title,videoId,author,authorId,lengthSeconds,thumbnailUrl,adaptiveFormats`
      );

      if (!response.ok) {
        console.log(`[proxy] Response not OK: ${response.status}`);
        continue;
      }

      const data = await response.json();

      if (data.error) {
        console.log(`[proxy] API error: ${data.error}`);
        continue;
      }

      if (!data.adaptiveFormats || data.adaptiveFormats.length === 0) {
        console.log(`[proxy] No adaptive formats found`);
        continue;
      }

      const audioFormats = data.adaptiveFormats
        .filter((f) => f.type && f.type.startsWith("audio/"))
        .sort((a, b) => {
          const bitrateA = parseInt(a.bitrate) || 0;
          const bitrateB = parseInt(b.bitrate) || 0;
          return bitrateB - bitrateA;
        });

      if (audioFormats.length === 0) {
        console.log(`[proxy] No audio formats found`);
        continue;
      }

      const bestAudio = audioFormats[0];
      let audioUrl = bestAudio.url;

      if (!audioUrl || audioUrl.length < 20) {
        console.log(`[proxy] Audio URL too short, trying alternate`);
        const alternateAudio = audioFormats.find((f) => f.url && f.url.length > 50);
        if (alternateAudio) {
          audioUrl = alternateAudio.url;
        }
      }

      if (!audioUrl || audioUrl.length < 20) {
        console.log(`[proxy] Still no valid audio URL, trying HLS streams`);
        if (data.hlsUrl) {
          audioUrl = data.hlsUrl;
        }
      }

      if (!audioUrl || audioUrl.length < 20) {
        console.log(`[proxy] Could not find valid audio URL`);
        continue;
      }

      const bitrate = parseInt(bestAudio.bitrate) || 0;
      const quality = bitrate > 0 ? `${Math.round(bitrate / 1000)}kbps` : "best";

      console.log(`[proxy] Success! Got audio URL (quality: ${quality})`);

      return res.json({
        success: true,
        videoId: data.videoId,
        title: data.title || "Unknown",
        channelName: data.author || "Unknown",
        thumbnail: data.thumbnailUrl || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        durationSeconds: data.lengthSeconds || 0,
        audioUrl: audioUrl,
        audioQuality: quality,
        expiresAt: bestAudio.expiresInSeconds
          ? new Date(Date.now() + bestAudio.expiresInSeconds * 1000).toISOString()
          : null,
      });
    } catch (error) {
      console.log(`[proxy] Error with ${instance}: ${error.message}`);
      lastError = error;
    }
  }

  res.status(500).json({
    error: lastError?.message || "Could not get audio URL. All Invidious instances failed.",
    code: "NO_AUDIO",
    videoId,
  });
});

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║           YouTube Audio Proxy Server (Invidious)              ║
║                                                           ║
║  Server running on: http://localhost:${PORT}                  ║
║                                                           ║
║  Test: http://localhost:${PORT}/audio?videoId=dQw4w9WgXcQ    ║
║                                                           ║
║  Using multiple Invidious instances for reliability!         ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});
