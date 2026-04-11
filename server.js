/**
 * YouTube Audio Proxy v13.0.0
 * Uses yt.lemnoslife.com API
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
app.get("/", (req, res) => res.json({ name: "YouTube Proxy", version: "13.0.0", status: "ok" }));

app.get("/api/stream", async (req, res) => {
  const { videoId } = req.query;
  
  console.log('[STREAM REQUEST]', videoId);
  
  if (!videoId) {
    return res.status(400).json({ error: "Missing videoId" });
  }
  
  try {
    console.log('[FETCHING] https://yt.lemnoslife.com/videos?part=player&id=' + videoId);
    
    const response = await fetch(
      `https://yt.lemnoslife.com/videos?part=player&id=${videoId}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 15000
      }
    );
    
    console.log('[RESPONSE STATUS]', response.status);
    
    if (!response.ok) {
      return res.status(502).json({ error: "fetch failed" });
    }
    
    const data = await response.json();
    console.log('[DATA]', JSON.stringify(data).substring(0, 200));
    
    const streamingData = data?.streamingData || data?.data?.streamingData;
    
    if (!streamingData) {
      console.log('[ERROR] No streamingData found');
      return res.status(404).json({ error: "No streaming data" });
    }
    
    const formats = streamingData.formats || [];
    const adaptiveFormats = streamingData.adaptiveFormats || [];
    const allFormats = [...formats, ...adaptiveFormats];
    
    const audioFormats = allFormats.filter(f => f.audioCodec && !f.videoCodec);
    
    if (audioFormats.length === 0) {
      const muxedWithAudio = allFormats.filter(f => f.audioCodec);
      if (muxedWithAudio.length > 0) {
        muxedWithAudio.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
        const best = muxedWithAudio[0];
        console.log('[SUCCESS] Found muxed audio, itag:', best.itag);
        return res.json({
          success: true,
          videoId,
          title: data.title || "YouTube Audio",
          thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          audioUrl: best.url,
          audioQuality: best.bitrate ? `${Math.round(best.bitrate/1000)}kbps` : "unknown"
        });
      }
      return res.status(404).json({ error: "No audio format" });
    }
    
    audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
    const best = audioFormats[0];
    
    console.log('[SUCCESS] audioUrl:', best.url.substring(0, 60) + '...');
    
    res.json({
      success: true,
      videoId,
      title: data.title || "YouTube Audio",
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      audioUrl: best.url,
      audioQuality: best.bitrate ? `${Math.round(best.bitrate/1000)}kbps` : "unknown"
    });
    
  } catch (error) {
    console.error('[ERROR]', error.message);
    res.status(500).json({ error: "fetch failed" });
  }
});

app.use((req, res) => res.status(404).json({ error: "Not found" }));

app.listen(PORT, () => console.log(`Proxy v13.0.0 running on ${PORT}`));
