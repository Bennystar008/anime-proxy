// ─────────────────────────────────────────────────────────────────────────────
// api/stream.js  —  add this file to your aniwatch-api GitHub fork
// Path in repo: api/stream.js
// Vercel will serve it at: https://aniwatch-api-tau-ecru.vercel.app/api/stream
//
// Usage: GET /api/stream?url=<encoded-cdn-url>
// Fetches the URL server-side with the correct Referer header and pipes it back
// with CORS headers so the browser can load it from file:// origin.
// ─────────────────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { url } = req.query;
  if (!url) { res.status(400).json({ error: 'Missing url param' }); return; }

  let targetUrl;
  try { targetUrl = decodeURIComponent(url); } 
  catch { res.status(400).json({ error: 'Bad url encoding' }); return; }

  try {
    const upstream = await fetch(targetUrl, {
      headers: {
        'Referer':          'https://hianimez.to/',
        'Origin':           'https://hianimez.to',
        'User-Agent':       'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept':           '*/*',
        'Accept-Language':  'en-US,en;q=0.9',
        'Sec-Fetch-Dest':   'empty',
        'Sec-Fetch-Mode':   'cors',
        'Sec-Fetch-Site':   'cross-site',
      },
      redirect: 'follow',
    });

    if (!upstream.ok) {
      res.status(upstream.status).json({ error: `Upstream ${upstream.status}: ${upstream.statusText}` });
      return;
    }

    const ct = upstream.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'public, max-age=60');

    const buf = await upstream.arrayBuffer();
    res.status(200).send(Buffer.from(buf));

  } catch (e) {
    res.status(502).json({ error: 'Proxy error: ' + e.message });
  }
}
