# YouTube Proxy Deploy

A server that extracts audio URLs from YouTube videos using yt-dlp.

## Deploy to Render.com (FREE)

1. Go to: https://render.com
2. Sign up with GitHub
3. Click New > Blueprint
4. Connect your GitHub repo: eyman-taha/youtube-proxy-deploy
5. Render will auto-detect the settings
6. Click Apply

Your URL will be: https://youtube-proxy-deploy.onrender.com

## Test Your Proxy

```
https://youtube-proxy-deploy.onrender.com/?videoId=dQw4w9WgXcQ
```

You should see JSON with audioUrl field.