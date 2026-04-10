/**
 * YouTube Audio Proxy Server v4.0.0
 * Uses YouTube's internal API to extract audio URLs
 */

import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range, accept',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range',
};

const YOUTUBEI_BASE = 'https://www.youtube.com/youtubei/v1';

const PAYLOAD_TEMPLATE = {
  context: {
    client: {
      hl: 'en',
      gl: 'US',
      clientName: 'IOS',
      clientVersion: '19.45.4',
      androidSdkVersion: '34',
    },
    user: {
      lockedSafetyMode: false,
    },
  },
};

app.get("/", (req, res) => {
  res.json({
    name: "YouTube Audio Proxy",
    version: "4.0.0",
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

  try {
    console.log(`[proxy] Getting info for: ${videoId}`);

    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const oembedResponse = await fetch(oembedUrl);

    if (!oembedResponse.ok) {
      return res.status(404).json({ error: "Video not found" });
    }

    const oembed = await oembedResponse.json();

    res.writeHead(200, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      videoId,
      title: oembed.title || "Unknown",
      channelName: oembed.author_name || "Unknown",
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    }));
  } catch (err) {
    console.error(`[proxy] Error: ${err.message}`);
    res.writeHead(500, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
});

app.get("/audio", async (req, res) => {
  const { videoId } = req.query;

  if (!videoId) {
    return res.status(400).json({ error: "Missing videoId parameter" });
  }

  try {
    console.log(`[proxy] Getting audio URL for: ${videoId}`);

    const payload = {
      ...PAYLOAD_TEMPLATE,
      videoId,
    };

    const response = await fetch(`${YOUTUBEI_BASE}/player`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'com.google.ios.youtube/19.45.4 (iPhone; iOS 17.4; gzip)',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.log(`[proxy] YouTube API error: ${response.status}`);
      return res.status(response.status).json({ error: "Failed to get video info" });
    }

    const data = await response.json();

    if (data.playabilityStatus?.status !== 'OK') {
      console.log(`[proxy] Video not playable: ${data.playabilityStatus?.status}`);
      return res.status(403).json({
        error: "Video is not playable",
        reason: data.playabilityStatus?.reason || "Unknown",
      });
    }

    const streamingData = data.streamingData;
    if (!streamingData) {
      console.log(`[proxy] No streaming data available`);
      return res.status(404).json({ error: "No streaming data available" });
    }

    const adaptiveFormats = streamingData.adaptiveFormats || [];
    const audioFormats = adaptiveFormats.filter(
      (f) => f.mimeType && f.mimeType.includes('audio')
    );

    if (audioFormats.length === 0) {
      console.log(`[proxy] No audio formats found`);
      return res.status(404).json({ error: "No audio formats found" });
    }

    audioFormats.sort((a, b) => {
      const bitrateA = parseInt(a.bitrate) || 0;
      const bitrateB = parseInt(b.bitrate) || 0;
      return bitrateB - bitrateA;
    });

    const bestAudio = audioFormats[0];
    const bitrate = parseInt(bestAudio.bitrate) || 0;
    const quality = bitrate > 0 ? `${Math.round(bitrate / 1000)}kbps` : 'best';

    console.log(`[proxy] Success! Audio quality: ${quality}`);

    res.writeHead(200, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      videoId,
      title: data.videoDetails?.title || "Unknown",
      channelName: data.microformat?.playerMicroformatRenderer?.ownerChannelName || data.videoDetails?.author || "Unknown",
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      durationSeconds: parseInt(data.microformat?.playerMicroformatRenderer?.lengthSeconds) || parseInt(data.videoDetails?.lengthSeconds) || 0,
      audioUrl: bestAudio.url,
      audioQuality: quality,
      expiresIn: bestAudio.expiresInSeconds ? parseInt(bestAudio.expiresInSeconds) : 0,
    }));
  } catch (err) {
    console.error(`[proxy] Error: ${err.message}`);
    res.writeHead(500, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
});

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║           YouTube Audio Proxy Server v4.0.0                    ║
║                                                           ║
║  Server running on: http://localhost:${PORT}                  ║
║                                                           ║
║  Test: http://localhost:${PORT}/audio?videoId=dQw4w9WgXcQ    ║
║                                                           ║
║  Using YouTube internal API for audio extraction!            ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});
