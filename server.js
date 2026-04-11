/**
 * YouTube Audio Proxy - Main Backend
 * Calls yt-dlp microservice for audio extraction
 */

import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

process.on('uncaughtException', (err) => console.error('[FATAL]', err.message));
process.on('unhandledRejection', (reason) => console.error('[REJECTION]', reason));

app.use(cors({ origin: "*", methods: ["GET", "OPTIONS"], allowedHeaders: ["*"] }));
app.use(express.json());

app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));
app.get("/", (req, res) => res.json({ name: "YouTube Proxy", version: "15.0.0", status: "ok" }));

const YTDLP_SERVICE_URL = process.env.YTDLP_SERVICE_URL || 'https://ytdlp-service.onrender.com';

app.get("/api/stream", async (req, res) => {
  const { videoId } = req.query;
  
  console.log('[STREAM REQUEST]', videoId);
  
  if (!videoId) {
    return res.status(400).json({ error: "Missing videoId" });
  }
  
  try {
    const extractUrl = `${YTDLP_SERVICE_URL}/extract?videoId=${videoId}`;
    console.log('[CALLING]', extractUrl);
    
    const response = await fetch(extractUrl, {
      timeout: 30000
    });
    
    const data = await response.json();
    console.log('[RESPONSE]', JSON.stringify(data).substring(0, 100));
    
    if (!response.ok || !data.audioUrl) {
      console.log('[ERROR] Extraction failed:', data.error || 'unknown');
      return res.status(500).json({ error: data.error || "Audio extraction failed" });
    }
    
    console.log('[SUCCESS] Got audioUrl');
    
    res.json({
      success: true,
      videoId,
      title: "YouTube Audio",
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      audioUrl: data.audioUrl
    });
    
  } catch (error) {
    console.error('[ERROR]', error.message);
    res.status(500).json({ error: error.message || "Service unavailable" });
  }
});

app.use((req, res) => res.status(404).json({ error: "Not found" }));

app.listen(PORT, () => console.log(`Proxy v15.0.0 running on ${PORT}`));
