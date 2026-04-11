/**
 * YouTube Audio Proxy v12.0.0
 * Uses Invidious API for reliable extraction
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
app.get("/", (req, res) => res.json({ name: "YouTube Proxy", version: "12.0.0", status: "ok", endpoints: ["/health", "/api/stream"] }));

const INVidious_INSTANCES = [
  "https://yewtu.be",
  "https://invidious.privacyredirect.com",
  "https://vid.puffyan.us",
  "https://invidious.fdn.fr"
];

let currentInstance = 0;

function getNextInstance() {
  const instance = INVidious_INSTANCES[currentInstance];
  currentInstance = (currentInstance + 1) % INVidious_INSTANCES.length;
  return instance;
}

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      return response;
    } catch (error) {
      console.log(`[RETRY] Attempt ${i + 1} failed:`, error.message);
      if (i === retries - 1) throw error;
    }
  }
  throw new Error("All retries failed");
}

app.get("/api/stream", async (req, res) => {
  const { videoId } = req.query;
  
  console.log('[STREAM REQUEST]', videoId);
  
  if (!videoId) {
    return res.status(400).json({ error: "Missing videoId" });
  }
  
  let lastError = null;
  
  for (let attempt = 0; attempt < INVidious_INSTANCES.length; attempt++) {
    const instance = getNextInstance();
    console.log(`[ATTEMPT ${attempt + 1}] Using: ${instance}`);
    
    try {
      const apiUrl = `${instance}/api/v1/videos/${videoId}?fields=videoId,title,thumbnailUrl,adaptiveFormats,lengthSeconds`;
      
      const response = await fetchWithRetry(apiUrl);
      
      if (!response.ok) {
        console.log(`[ERROR] API responded: ${response.status}`);
        lastError = `API returned ${response.status}`;
        continue;
      }
      
      const data = await response.json();
      
      if (data.error) {
        console.log(`[ERROR] Invidious error:`, data.error);
        lastError = data.error;
        continue;
      }
      
      const formats = data.adaptiveFormats || [];
      const audioFormats = formats.filter(f => f.type && f.type.startsWith("audio/"));
      
      if (audioFormats.length === 0) {
        console.log(`[ERROR] No audio formats`);
        lastError = "No audio available";
        continue;
      }
      
      audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
      const bestAudio = audioFormats[0];
      
      if (!bestAudio.url) {
        console.log(`[ERROR] No URL in audio format`);
        lastError = "No stream URL";
        continue;
      }
      
      console.log('[SUCCESS] audioUrl:', bestAudio.url.substring(0, 60) + '...');
      
      return res.json({
        success: true,
        videoId: data.videoId,
        title: data.title || "YouTube Audio",
        thumbnail: data.thumbnailUrl || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        audioUrl: bestAudio.url,
        audioQuality: bestAudio.bitrate ? `${Math.round(bestAudio.bitrate / 1000)}kbps` : "unknown",
        duration: data.lengthSeconds || 0
      });
      
    } catch (error) {
      console.log(`[ERROR] Instance ${instance}:`, error.message);
      lastError = error.message;
    }
  }
  
  console.log('[FAIL] All instances failed');
  return res.status(502).json({ error: lastError || "All Invidious instances failed" });
});

app.get("/api/info", async (req, res) => {
  const { videoId } = req.query;
  
  if (!videoId) {
    return res.status(400).json({ error: "Missing videoId" });
  }
  
  try {
    const instance = getNextInstance();
    const apiUrl = `${instance}/api/v1/videos/${videoId}?fields=videoId,title,author,thumbnailUrl,lengthSeconds,viewCount`;
    
    const response = await fetchWithRetry(apiUrl);
    
    if (!response.ok) {
      return res.status(response.status).json({ error: `API returned ${response.status}` });
    }
    
    const data = await response.json();
    
    return res.json({
      success: true,
      videoId: data.videoId,
      title: data.title,
      channelName: data.author,
      thumbnail: data.thumbnailUrl,
      duration: data.lengthSeconds,
      views: data.viewCount
    });
    
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.use((req, res) => res.status(404).json({ error: "Not found" }));

app.listen(PORT, () => console.log(`Proxy v12.0.0 running on ${PORT}`));
