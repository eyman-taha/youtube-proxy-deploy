import express from "express";
import { execSync, exec } from "child_process";
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
    status: "running"
  });
});

// Get audio URL using yt-dlp
app.get("/audio", async (req, res) => {
  const { videoId } = req.query;
  
  if (!videoId) {
    return res.status(400).json({ error: "Missing videoId parameter" });
  }
  
  try {
    console.log(`[proxy] Getting audio for: ${videoId}`);
    
    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    // Check if yt-dlp exists
    try {
      execSync("which yt-dlp || echo NOT_FOUND", { stdio: "pipe" });
    } catch (e) {
      console.log("[proxy] yt-dlp not found, installing...");
      execSync("pip3 install yt-dlp", { stdio: "inherit" });
    }
    
    // Run yt-dlp to get audio URL
    const command = `yt-dlp -f "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio" -g --no-playlist --no-warnings "${youtubeUrl}"`;
    
    exec(command, { timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        console.error(`[proxy] Error: ${stderr || error.message}`);
        return res.status(500).json({ 
          error: "Failed to extract audio", 
          details: stderr || error.message 
        });
      }
      
      const audioUrl = stdout.trim();
      
      if (!audioUrl || !audioUrl.startsWith("http")) {
        console.error(`[proxy] Invalid URL: ${audioUrl}`);
        return res.status(500).json({ 
          error: "Invalid audio URL returned",
          raw: stdout
        });
      }
      
      console.log(`[proxy] Success!`);
      
      res.json({
        success: true,
        videoId,
        audioUrl,
        thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
      });
    });
    
  } catch (err) {
    console.error(`[proxy] Exception: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`YouTube Audio Proxy running on port ${PORT}`);
});