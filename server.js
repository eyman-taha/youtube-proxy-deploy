import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Invidious instances
const INVIDIOUS_INSTANCES = [
  "https://invidious.privacyredirect.com",
  "https://invidious.snopyta.org",
  "https://yewtu.be",
  "https://invidious.lunar.icu"
];

// Health check
app.get("/", (req, res) => {
  res.json({
    name: "YouTube Audio Proxy",
    version: "1.0.0",
    status: "running",
    usage: "/audio?videoId=VIDEO_ID"
  });
});

// Get audio URL using Invidious API
app.get("/audio", async (req, res) => {
  const { videoId } = req.query;
  
  if (!videoId) {
    return res.status(400).json({ error: "Missing videoId parameter" });
  }
  
  console.log(`[proxy] Getting audio for: ${videoId}`);
  
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      console.log(`[proxy] Trying: ${instance}`);
      
      const url = `${instance}/api/v1/videos/${videoId}`;
      const response = await fetch(url, { timeout: 10000 });
      
      if (!response.ok) {
        console.log(`[proxy] ${instance} returned ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      
      if (data.error) {
        console.log(`[proxy] ${instance} error: ${data.error}`);
        continue;
      }
      
      // Find best audio format
      const adaptiveFormats = data.adaptiveFormats || [];
      const audioFormats = adaptiveFormats
        .filter(f => f.type && f.type.startsWith("audio/"))
        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
      
      if (audioFormats.length === 0) {
        console.log(`[proxy] No audio formats found`);
        continue;
      }
      
      const bestAudio = audioFormats[0];
      
      console.log(`[proxy] Success from ${instance}!`);
      
      return res.json({
        success: true,
        videoId,
        title: data.title || "Unknown",
        channelName: data.author || "Unknown",
        thumbnail: data.thumbnailUrl || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        durationSeconds: parseInt(data.lengthSeconds) || 0,
        audioUrl: bestAudio.url,
        audioQuality: bestAudio.quality || "audio"
      });
      
    } catch (err) {
      console.log(`[proxy] ${instance} failed: ${err.message}`);
      continue;
    }
  }
  
  console.log(`[proxy] All instances failed`);
  return res.status(500).json({ 
    error: "Could not fetch audio from any Invidious instance",
    videoId 
  });
});

app.listen(PORT, () => {
  console.log(`YouTube Audio Proxy running on port ${PORT}`);
  console.log(`Endpoints: / (health) and /audio?videoId=ID`);
});