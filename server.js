/**
 * YouTube Audio Proxy Server v7.0.0
 * Uses play-dl to extract audio URLs server-side (bypasses CORS)
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

// In-memory cache for audio URLs
const audioCache = new Map();
const CACHE_TTL = 25 * 60 * 1000; // 25 minutes

function cleanExpiredCache() {
  const now = Date.now();
  for (const [key, value] of audioCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      audioCache.delete(key);
    }
  }
}

setInterval(cleanExpiredCache, 5 * 60 * 1000);

// Health check
app.get("/", (req, res) => {
  res.json({
    name: "YouTube Audio Proxy",
    version: "7.0.0",
    status: "running",
    library: "play-dl",
    endpoints: {
      health: "/health",
      audio: "/api/audio?videoId=VIDEO_ID",
      info: "/api/info?videoId=VIDEO_ID"
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
    
    const info = await video_info(`https://www.youtube.com/watch?v=${videoId}`);
    const videoData = info.video_details;
    
    res.json({
      success: true,
      videoId,
      title: videoData.title || "Unknown",
      channelName: videoData.channel?.name || "Unknown",
      thumbnail: videoData.thumbnails?.[0]?.url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      duration: videoData.durationInSec || 0,
      views: videoData.views || 0
    });
  } catch (error) {
    console.error(`[proxy] Error getting info: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Get audio URL - main endpoint
app.get("/api/audio", async (req, res) => {
  const { videoId } = req.query;

  if (!videoId) {
    return res.status(400).json({ error: "Missing videoId parameter" });
  }

  const cacheKey = videoId;
  const cached = audioCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[proxy] Cache hit for: ${videoId}`);
    return res.json(cached.data);
  }

  try {
    console.log(`[proxy] Extracting audio for: ${videoId}`);

    // Get video info
    const info = await video_info(`https://www.youtube.com/watch?v=${videoId}`);
    const videoData = info.video_details;
    
    // Get thumbnail
    const thumbnail = videoData.thumbnails?.[0]?.url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    
    // Find best format with audio (prefer smaller formats that have audio)
    // Look for formats with audioChannels property (indicates audio)
    let bestAudioFormat = null;
    
    for (const format of info.format) {
      if (format.url && format.audioChannels && format.audioChannels > 0) {
        if (!bestAudioFormat || (format.bitrate && bestAudioFormat.bitrate && format.bitrate > bestAudioFormat.bitrate)) {
          bestAudioFormat = format;
        }
      }
    }
    
    // If no audio-only, get muxed video with audio
    if (!bestAudioFormat) {
      for (const format of info.format) {
        if (format.url && format.audioQuality) {
          if (!bestAudioFormat || (format.bitrate && bestAudioFormat.bitrate && format.bitrate > bestAudioFormat.bitrate)) {
            bestAudioFormat = format;
          }
        }
      }
    }
    
    // Fallback to any format with URL
    if (!bestAudioFormat) {
      bestAudioFormat = info.format.find(f => f.url);
    }
    
    if (!bestAudioFormat || !bestAudioFormat.url) {
      console.log(`[proxy] No playable format found`);
      return res.status(404).json({ error: "No playable format found" });
    }

    const result = {
      success: true,
      videoId,
      title: videoData.title || "Unknown",
      channelName: videoData.channel?.name || "Unknown",
      thumbnail,
      duration: videoData.durationInSec || 0,
      audioUrl: bestAudioFormat.url,
      audioQuality: bestAudioFormat.audioQuality || "AUDIO_QUALITY_MEDIUM",
      itag: bestAudioFormat.itag,
      mimeType: bestAudioFormat.mimeType || ""
    };

    // Cache result
    audioCache.set(cacheKey, { data: result, timestamp: Date.now() });

    console.log(`[proxy] Success! Itag: ${result.itag}, Quality: ${result.audioQuality}`);
    res.json(result);

  } catch (error) {
    console.error(`[proxy] Error: ${error.message}`);
    
    let statusCode = 500;
    let errorMessage = error.message;
    
    if (errorMessage.includes("Video unavailable") || errorMessage.includes("NOT_FOUND")) {
      statusCode = 404;
      errorMessage = "Video is unavailable or has been removed";
    } else if (errorMessage.includes("private")) {
      statusCode = 403;
      errorMessage = "This video is private";
    } else if (errorMessage.includes("age")) {
      statusCode = 403;
      errorMessage = "This video is age-restricted";
    }
    
    res.status(statusCode).json({ error: errorMessage });
  }
});

app.post("/api/cache/clear", (req, res) => {
  audioCache.clear();
  res.json({ success: true, message: "Cache cleared" });
});

app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

app.use((err, req, res, next) => {
  console.error(`[proxy] Server error: ${err.message}`);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════════════╗
║              YouTube Audio Proxy Server v7.0.0                        ║
║  Library: play-dl                                                    ║
║  Server running on: http://localhost:${PORT}                              ║
║  Endpoints:                                                          ║
║    GET /health              - Health check                            ║
║    GET /api/info?videoId=   - Get video metadata                      ║
║    GET /api/audio?videoId= - Get audio stream URL                    ║
╚═══════════════════════════════════════════════════════════════════════╝
  `);
});
