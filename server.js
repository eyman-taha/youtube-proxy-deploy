/**
 * YouTube Audio Proxy Server v6.0.0
 * Uses ytdl-core to extract audio URLs server-side (bypasses CORS)
 * 
 * Deploy to Render.com for free hosting
 */

import express from "express";
import cors from "cors";
import ytdl from "ytdl-core";

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all origins
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
}));

app.use(express.json());

// In-memory cache for audio URLs
const audioCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

function cleanExpiredCache() {
  const now = Date.now();
  for (const [key, value] of audioCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      audioCache.delete(key);
    }
  }
}

// Clean cache every 10 minutes
setInterval(cleanExpiredCache, 10 * 60 * 1000);

// Health check endpoint
app.get("/", (req, res) => {
  res.json({
    name: "YouTube Audio Proxy",
    version: "6.0.0",
    status: "running",
    description: "Server-side YouTube audio extraction - bypasses CORS",
    endpoints: {
      health: "/health",
      audio: "/api/audio?videoId=VIDEO_ID",
      info: "/api/info?videoId=VIDEO_ID",
      formats: "/api/formats?videoId=VIDEO_ID"
    },
    cache: {
      size: audioCache.size,
      ttlMinutes: 30
    }
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Get video info
app.get("/api/info", async (req, res) => {
  const { videoId } = req.query;

  if (!videoId) {
    return res.status(400).json({ error: "Missing videoId parameter" });
  }

  try {
    console.log(`[proxy] Getting info for: ${videoId}`);
    
    const info = await ytdl.getInfo(videoId);
    const videoDetails = info.videoDetails;
    
    // Get best thumbnail
    let thumbnail = "";
    if (videoDetails.thumbnails && videoDetails.thumbnails.length > 0) {
      thumbnail = videoDetails.thumbnails[videoDetails.thumbnails.length - 1].url;
    }
    if (!thumbnail) {
      thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    }

    res.json({
      success: true,
      videoId,
      title: videoDetails.title || "Unknown",
      channelName: videoDetails.author?.name || videoDetails.author || "Unknown",
      thumbnail,
      duration: parseInt(videoDetails.lengthSeconds) || 0,
      viewCount: parseInt(videoDetails.viewCount) || 0,
      description: videoDetails.description || ""
    });
  } catch (error) {
    console.error(`[proxy] Error getting info: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Get audio URL - main endpoint
app.get("/api/audio", async (req, res) => {
  const { videoId, quality = "high" } = req.query;

  if (!videoId) {
    return res.status(400).json({ error: "Missing videoId parameter" });
  }

  const cacheKey = `${videoId}_${quality}`;
  const cached = audioCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[proxy] Cache hit for: ${videoId}`);
    return res.json(cached.data);
  }

  try {
    console.log(`[proxy] Extracting audio for: ${videoId}`);

    const info = await ytdl.getInfo(videoId);
    const videoDetails = info.videoDetails;

    // Get best audio format based on quality preference
    const formats = info.formats;
    let audioFormat;

    if (quality === "low") {
      // Prefer smaller audio for slow connections
      audioFormat = formats
        .filter(f => f.hasAudio && !f.hasVideo)
        .sort((a, b) => (parseInt(a.bitrate) || 0) - (parseInt(b.bitrate) || 0))[0];
    } else if (quality === "high") {
      // Get highest bitrate audio
      audioFormat = formats
        .filter(f => f.hasAudio && !f.hasVideo)
        .sort((a, b) => (parseInt(b.bitrate) || 0) - (parseInt(a.bitrate) || 0))[0];
    } else {
      // Default: highest bitrate audio
      audioFormat = formats
        .filter(f => f.hasAudio && !f.hasVideo)
        .sort((a, b) => (parseInt(b.bitrate) || 0) - (parseInt(a.bitrate) || 0))[0];
    }

    if (!audioFormat) {
      console.log(`[proxy] No audio format found for: ${videoId}`);
      return res.status(404).json({ error: "No audio format available" });
    }

    // Get thumbnail
    let thumbnail = "";
    if (videoDetails.thumbnails && videoDetails.thumbnails.length > 0) {
      thumbnail = videoDetails.thumbnails[videoDetails.thumbnails.length - 1].url;
    }
    if (!thumbnail) {
      thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    }

    const result = {
      success: true,
      videoId,
      title: videoDetails.title || "Unknown",
      channelName: videoDetails.author?.name || videoDetails.author || "Unknown",
      thumbnail,
      duration: parseInt(videoDetails.lengthSeconds) || 0,
      audioUrl: audioFormat.url,
      audioQuality: audioFormat.audioBitrate ? `${audioFormat.audioBitrate}kbps` : "best",
      audioCodec: audioFormat.audioCodec || "unknown",
      container: audioFormat.container || "unknown",
      itag: audioFormat.itag
    };

    // Cache the result
    audioCache.set(cacheKey, { data: result, timestamp: Date.now() });

    console.log(`[proxy] Success! Quality: ${result.audioQuality}, Codec: ${result.audioCodec}`);
    res.json(result);

  } catch (error) {
    console.error(`[proxy] Error: ${error.message}`);
    
    // Handle specific errors
    if (error.message.includes("Video unavailable")) {
      return res.status(404).json({ error: "Video is unavailable or has been removed" });
    }
    if (error.message.includes("private")) {
      return res.status(403).json({ error: "This video is private" });
    }
    if (error.message.includes("age")) {
      return res.status(403).json({ error: "This video is age-restricted" });
    }
    
    res.status(500).json({ error: error.message });
  }
});

// Get all available formats
app.get("/api/formats", async (req, res) => {
  const { videoId } = req.query;

  if (!videoId) {
    return res.status(400).json({ error: "Missing videoId parameter" });
  }

  try {
    console.log(`[proxy] Getting formats for: ${videoId}`);

    const info = await ytdl.getInfo(videoId);
    const formats = info.formats;

    // Separate audio and video formats
    const audioFormats = formats
      .filter(f => f.hasAudio && !f.hasVideo)
      .map(f => ({
        itag: f.itag,
        quality: f.qualityLabel || f.quality,
        bitrate: f.audioBitrate ? `${f.audioBitrate}kbps` : "unknown",
        container: f.container,
        codec: f.audioCodec
      }));

    const videoFormats = formats
      .filter(f => f.hasVideo)
      .map(f => ({
        itag: f.itag,
        quality: f.qualityLabel || f.quality,
        container: f.container,
        codec: f.videoCodec
      }));

    res.json({
      success: true,
      videoId,
      audioFormats,
      videoFormats
    });

  } catch (error) {
    console.error(`[proxy] Error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Clear cache endpoint
app.post("/api/cache/clear", (req, res) => {
  audioCache.clear();
  res.json({ success: true, message: "Cache cleared" });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(`[proxy] Server error: ${err.message}`);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════════════╗
║              YouTube Audio Proxy Server v6.0.0                        ║
║                                                                       ║
║  Server running on: http://localhost:${PORT}                              ║
║                                                                       ║
║  Endpoints:                                                          ║
║    GET /health              - Health check                            ║
║    GET /api/info?videoId=   - Get video metadata                      ║
║    GET /api/audio?videoId=  - Get best audio URL                     ║
║    GET /api/formats?videoId=- Get all available formats               ║
║                                                                       ║
║  Features:                                                            ║
║    ✓ Server-side extraction (bypasses CORS)                          ║
║    ✓ Automatic redirect following                                     ║
║    ✓ 30-minute URL caching                                           ║
║    ✓ Quality options: low, high                                       ║
║                                                                       ║
║  Deploy to Render.com:                                               ║
║    1. Create new Web Service                                          ║
║    2. Connect GitHub repo                                             ║
║    3. Set build command: npm install                                  ║
║    4. Set start command: npm start                                   ║
║    5. Deploy!                                                         ║
╚═══════════════════════════════════════════════════════════════════════╝
  `);
});
