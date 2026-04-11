/**
 * YouTube Audio Proxy v14.0.0
 * Uses ytdl-core for reliable extraction
 */

import express from "express";
import cors from "cors";
import ytdl from "ytdl-core";

const app = express();
const PORT = process.env.PORT || 3000;

process.on('uncaughtException', (err) => console.error('[FATAL]', err.message));
process.on('unhandledRejection', (reason) => console.error('[REJECTION]', reason));

app.use(cors({ origin: "*", methods: ["GET", "OPTIONS"], allowedHeaders: ["*"] }));
app.use(express.json());

app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));
app.get("/", (req, res) => res.json({ name: "YouTube Proxy", version: "14.0.0", status: "ok" }));

app.get("/api/stream", async (req, res) => {
  const { videoId } = req.query;
  
  console.log('[STREAM REQUEST]', videoId);
  
  if (!videoId) {
    return res.status(400).json({ error: "Missing videoId" });
  }
  
  try {
    console.log('[EXTRACTING] Using ytdl-core for:', videoId);
    
    const info = await ytdl.getInfo(videoId);
    console.log('[TITLE]', info.videoDetails.title);
    
    const formats = ytdl.filterFormats(info.formats, 'audioonly');
    
    if (formats.length === 0) {
      console.log('[ERROR] No audio formats found');
      return res.status(404).json({ error: "No audio format available" });
    }
    
    formats.sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0));
    const bestAudio = formats[0];
    
    console.log('[SUCCESS] audioUrl:', bestAudio.url.substring(0, 60) + '...');
    console.log('[QUALITY]', bestAudio.audioBitrate ? `${bestAudio.audioBitrate}kbps` : 'unknown');
    
    res.json({
      success: true,
      videoId,
      title: info.videoDetails.title,
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      audioUrl: bestAudio.url,
      audioQuality: bestAudio.audioBitrate ? `${bestAudio.audioBitrate}kbps` : "unknown",
      duration: parseInt(info.videoDetails.lengthSeconds) || 0
    });
    
  } catch (error) {
    console.error('[ERROR]', error.message);
    return res.status(500).json({ error: error.message || "audio extraction failed" });
  }
});

app.use((req, res) => res.status(404).json({ error: "Not found" }));

app.listen(PORT, () => console.log(`Proxy v14.0.0 running on ${PORT}`));
