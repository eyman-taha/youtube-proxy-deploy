/**
 * YouTube Audio Proxy Server v8.0.0
 * Streams audio through the server to bypass CORS on all platforms
 */

import express from "express";
import cors from "cors";
import playdl from "play-dl";

const { video_info } = playdl;

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all origins
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
}));

app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.json({
    name: "YouTube Audio Proxy",
    version: "8.0.0",
    status: "running",
    description: "Streams audio through server to bypass CORS",
    endpoints: {
      health: "/health",
      audio: "/api/audio?videoId=VIDEO_ID - Get audio stream URL",
      stream: "/api/stream?videoId=VIDEO_ID - Stream audio directly"
    }
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Get audio URL (returns direct URL - works on mobile)
app.get("/api/audio", async (req, res) => {
  const { videoId } = req.query;

  if (!videoId) {
    return res.status(400).json({ error: "Missing videoId parameter" });
  }

  try {
    console.log(`[proxy] Getting audio URL for: ${videoId}`);

    const info = await video_info(`https://www.youtube.com/watch?v=${videoId}`);
    const videoData = info.video_details;
    
    // Find best format with audio
    let bestFormat = null;
    for (const format of info.format) {
      if (format.url && format.audioChannels && format.audioChannels > 0) {
        if (!bestFormat || (format.bitrate && bestFormat.bitrate && format.bitrate > bestFormat.bitrate)) {
          bestFormat = format;
        }
      }
    }
    
    if (!bestFormat) {
      bestFormat = info.format.find(f => f.url && f.audioQuality);
    }
    
    if (!bestFormat) {
      bestFormat = info.format.find(f => f.url);
    }

    if (!bestFormat || !bestFormat.url) {
      return res.status(404).json({ error: "No playable format found" });
    }

    res.json({
      success: true,
      videoId,
      title: videoData.title || "Unknown",
      channelName: videoData.channel?.name || "Unknown",
      thumbnail: videoData.thumbnails?.[0]?.url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      duration: videoData.durationInSec || 0,
      audioUrl: bestFormat.url,
      audioQuality: bestFormat.audioQuality || "AUDIO_QUALITY_MEDIUM",
      itag: bestFormat.itag,
      streamType: "direct"
    });

  } catch (error) {
    console.error(`[proxy] Error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Stream audio directly through the server (bypasses CORS for web)
app.get("/api/stream", async (req, res) => {
  const { videoId } = req.query;

  if (!videoId) {
    return res.status(400).json({ error: "Missing videoId parameter" });
  }

  try {
    console.log(`[proxy] Streaming audio for: ${videoId}`);

    const info = await video_info(`https://www.youtube.com/watch?v=${videoId}`);
    
    // Find best audio format
    let bestFormat = null;
    for (const format of info.format) {
      if (format.url && format.audioChannels && format.audioChannels > 0) {
        if (!bestFormat || (format.bitrate && bestFormat.bitrate && format.bitrate > bestFormat.bitrate)) {
          bestFormat = format;
        }
      }
    }
    
    if (!bestFormat) {
      bestFormat = info.format.find(f => f.url && f.audioQuality);
    }
    
    if (!bestFormat) {
      bestFormat = info.format.find(f => f.url);
    }

    if (!bestFormat || !bestFormat.url) {
      return res.status(404).json({ error: "No playable format found" });
    }

    const audioUrl = bestFormat.url;
    const videoData = info.video_details;

    // Set CORS headers for the stream
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
    res.setHeader('Content-Type', 'audio/mp4');
    res.setHeader('Accept-Ranges', 'bytes');

    console.log(`[proxy] Forwarding stream from: ${audioUrl.substring(0, 80)}...`);

    // Stream the audio through the server
    const streamResponse = await fetch(audioUrl);
    
    if (!streamResponse.ok) {
      console.log(`[proxy] Stream fetch failed: ${streamResponse.status}`);
      return res.status(502).json({ error: "Failed to fetch audio stream" });
    }

    // Pipe the stream to response
    res.setHeader('Content-Length', streamResponse.headers.get('content-length'));
    
    streamResponse.body.pipe(res);

  } catch (error) {
    console.error(`[proxy] Stream error: ${error.message}`);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

app.use((err, req, res, next) => {
  console.error(`[proxy] Server error: ${err.message}`);
  if (!res.headersSent) {
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════════════╗
║              YouTube Audio Proxy Server v8.0.0                        ║
║  Server running on: http://localhost:${PORT}                              ║
║                                                                       ║
║  Endpoints:                                                          ║
║    GET /health              - Health check                            ║
║    GET /api/audio?videoId= - Get audio URL (for mobile)              ║
║    GET /api/stream?videoId= - Stream audio (for web)                ║
╚═══════════════════════════════════════════════════════════════════════╝
  `);
});
