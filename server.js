import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.json({
    name: "YouTube Audio Proxy",
    version: "1.0.0",
    status: "running",
    endpoints: {
      audio: "/audio?videoId=VIDEO_ID",
      info: "/info?videoId=VIDEO_ID"
    }
  });
});

// Get video info (title, thumbnail, duration)
app.get("/info", async (req, res) => {
  const { videoId } = req.query;
  
  if (!videoId) {
    return res.status(400).json({ error: "Missing videoId parameter" });
  }
  
  try {
    console.log(`[proxy] Getting info for: ${videoId}`);
    
    // Use YouTube oEmbed API
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const oembedResponse = await fetch(oembedUrl);
    
    if (!oembedResponse.ok) {
      return res.status(404).json({ error: "Video not found" });
    }
    
    const oembed = await oembedResponse.json();
    
    res.json({
      success: true,
      videoId,
      title: oembed.title || "Unknown",
      channelName: oembed.author_name || "Unknown",
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
    });
    
  } catch (err) {
    console.error(`[proxy] Error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// Get audio URL (redirects to actual audio stream)
app.get("/audio", async (req, res) => {
  const { videoId } = req.query;
  
  if (!videoId) {
    return res.status(400).json({ error: "Missing videoId parameter" });
  }
  
  try {
    console.log(`[proxy] Getting audio URL for: ${videoId}`);
    
    // Fetch YouTube video page
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const response = await fetch(videoUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    
    const html = await response.text();
    
    // Look for streaming data in the page
    const playerResponseMatch = html.match(/"playabilityStatus":\{.*?"configs":\{"playerMicroformatRenderer":(\{.*?\})\}/s);
    
    // Try to extract streaming URL from page
    // Look for adaptiveFormats with audio
    const streamingMatch = html.match(/"streamingData":\{([^}]+(?:\}[^,])*)/);
    
    if (streamingMatch) {
      const streamingJson = "{" + streamingMatch[1];
      try {
        const streaming = JSON.parse(streamingJson);
        const formats = streaming.formats || streaming.adaptiveFormats || [];
        const audioFormats = formats.filter(f => f.audioCodec);
        
        if (audioFormats.length > 0) {
          const bestAudio = audioFormats[0];
          return res.json({
            success: true,
            videoId,
            audioUrl: bestAudio.url,
            thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
          });
        }
      } catch (e) {
        console.log("[proxy] Could not parse streaming data");
      }
    }
    
    // Fallback: redirect to YouTube embed
    res.json({
      success: true,
      videoId,
      audioUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1`,
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      isEmbed: true
    });
    
  } catch (err) {
    console.error(`[proxy] Error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`YouTube Audio Proxy running on port ${PORT}`);
});