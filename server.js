import { exec } from 'child_process';
import { createServer } from 'http';

const PORT = process.env.PORT || 3000;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  const url = new URL(req.url, http://localhost:);
  const videoId = url.searchParams.get('videoId') || url.searchParams.get('id');

  if (!videoId) {
    res.writeHead(400, { ...CORS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Video ID required' }));
    return;
  }

  console.log([proxy] Getting audio for: );

  try {
    const youtubeUrl = https://www.youtube.com/watch?v=;
    const command = yt-dlp -f "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio" -g --no-playlist --no-warnings "";

    exec(command, { timeout: 30000 }, (error, stdout) => {
      if (error) {
        console.log([proxy] Error: );
        res.writeHead(404, { ...CORS, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Could not extract audio', videoId }));
        return;
      }

      const audioUrl = stdout.trim();
      console.log([proxy] Success!);

      res.writeHead(200, { ...CORS, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        videoId,
        audioUrl,
        thumbnail: https://img.youtube.com/vi//hqdefault.jpg
      }));
    });
  } catch (e) {
    res.writeHead(500, { ...CORS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
});

server.listen(PORT, () => console.log(Proxy running on port ));