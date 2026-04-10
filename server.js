import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/proxy", async (req, res) => {
  try {
    const { url, videoId } = req.query;
    
    if (!url && !videoId) {
      return res.status(400).json({ error: "Missing url or videoId parameter" });
    }
    
    let targetUrl = url;
    
    if (videoId && !url) {
      targetUrl = `https://www.youtube.com/watch?v=${videoId}`;
    }
    
    console.log(`[proxy] Fetching: ${targetUrl}`);
    
    const response = await fetch(targetUrl);
    const data = await response.text();
    
    res.set("Content-Type", "text/plain");
    res.send(data);
  } catch (err) {
    console.error(`[proxy] Error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (req, res) => {
  res.json({
    name: "YouTube Proxy",
    version: "1.0.0",
    endpoints: {
      proxy: "/proxy?url=VIDEO_URL",
      youtube: "/proxy?videoId=VIDEO_ID"
    },
    example: "/proxy?videoId=dQw4w9WgXcQ"
  });
});

app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});