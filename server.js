/**
 * YouTube Audio Proxy Server v5.0.0
 * Provides video info and returns embed-ready URLs for playback
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

app.get("/", (req, res) => {
  res.json({
    name: "YouTube Audio Proxy",
    version: "5.0.0",
    status: "running",
    message: "Returns video metadata and embed URLs for YouTube playback",
    platforms: {
      mobile: "Use youtube_explode_dart package for direct audio URLs",
      web: "Use returned embed URL with WebView or iframe player"
    },
    endpoints: {
      info: "/info?videoId=VIDEO_ID - Get video metadata",
      audio: "/audio?videoId=VIDEO_ID - Get embed URL for playback",
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
    const response = await fetch(oembedUrl);

    if (!response.ok) {
      return res.status(404).json({ error: "Video not found" });
    }

    const data = await response.json();

    res.writeHead(200, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      videoId,
      title: data.title || "Unknown",
      channelName: data.author_name || "Unknown",
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      embedUrl: `https://www.youtube.com/embed/${videoId}?enablejsapi=1&playsinline=1`,
      watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
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
    console.log(`[proxy] Getting audio info for: ${videoId}`);

    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const response = await fetch(oembedUrl);

    if (!response.ok) {
      return res.status(404).json({ error: "Video not found" });
    }

    const data = await response.json();

    const thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    const embedUrl = `https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=1&playsinline=1`;

    res.writeHead(200, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      videoId,
      title: data.title || "Unknown",
      channelName: data.author_name || "Unknown",
      thumbnail,
      embedUrl,
      watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
      message: "For mobile: Use youtube_explode_dart. For web: Use embed URL with YouTube iframe player.",
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
║           YouTube Audio Proxy Server v5.0.0                    ║
║                                                           ║
║  Server running on: http://localhost:${PORT}                  ║
║                                                           ║
║  For direct audio URLs:                                     ║
║    Mobile: Use youtube_explode_dart package                 ║
║    Web: Use YouTube iframe player with embed URL            ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});
