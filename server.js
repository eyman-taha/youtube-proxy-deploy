/**
 * YouTube Audio Proxy - v10.0.0
 * Stable version for Render deployment
 */

import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

// Crash prevention
process.on('uncaughtException', (err) => console.error('[FATAL]', err.message));
process.on('unhandledRejection', (reason) => console.error('[REJECTION]', reason));

app.use(cors({ origin: "*", methods: ["GET", "OPTIONS"], allowedHeaders: ["*"] }));
app.use(express.json());

app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));
app.get("/", (req, res) => res.json({ name: "YouTube Proxy", version: "10.0.0", status: "ok" }));

app.get("/api/audio", async (req, res) => {
  const { videoId } = req.query;
  if (!videoId) return res.status(400).json({ error: "Missing videoId" });
  
  console.log('[REQUEST]', videoId);
  
  try {
    // YouTube video page
    const response = await fetch(
      `https://www.youtube.com/watch?v=${videoId}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      }
    );
    
    if (!response.ok) {
      return res.status(502).json({ error: "YouTube unavailable" });
    }
    
    const html = await response.text();
    
    // Extract player response JSON
    const match = html.match(/"streamingData":(\{.*?\})/s);
    if (!match) {
      return res.status(404).json({ error: "No stream data" });
    }
    
    let streamingData;
    try {
      streamingData = JSON.parse(match[1]);
    } catch {
      return res.status(500).json({ error: "Parse error" });
    }
    
    const formats = streamingData.formats || [];
    const audioFormats = formats.filter(f => f.audioCodec);
    
    if (audioFormats.length === 0) {
      return res.status(404).json({ error: "No audio" });
    }
    
    // Best audio
    audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
    const best = audioFormats[0];
    
    console.log('[SUCCESS]', videoId, 'itag:', best.itag);
    
    res.json({
      success: true,
      videoId,
      title: "YouTube Audio",
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      audioUrl: best.url,
      audioQuality: best.bitrate ? `${Math.round(best.bitrate/1000)}kbps` : "unknown",
      itag: best.itag
    });
    
  } catch (error) {
    console.error('[ERROR]', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.use((req, res) => res.status(404).json({ error: "Not found" }));

app.listen(PORT, () => console.log(`Proxy running on ${PORT}`));
