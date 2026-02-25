export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { url } = req.query;
  if (!url) {
    res.status(400).json({ error: 'Missing ?url= parameter' });
    return;
  }

  let targetUrl;
  try {
    targetUrl = decodeURIComponent(url);
    new URL(targetUrl);
  } catch {
    res.status(400).json({ error: 'Invalid URL' });
    return;
  }

  const ALLOWED_HOSTS = [
    'fogtwist21.xyz', 'fogtwist.xyz',
    'cloudburst82.xyz', 'cloudburst.xyz',
    'eno.tendoloads.com',
    'megacloud.blog', 'megacloud.tv',
    'rapid-cloud.co',
    'vidstreaming.io',
    'gogocdn.net', 'gogoplay.io',
    'allanimeapi.com',
  ];
  const parsedHost = new URL(targetUrl).hostname;
  if (!ALLOWED_HOSTS.some(h => parsedHost === h || parsedHost.endsWith('.' + h))) {
    res.status(403).json({ error: `Host ${parsedHost} not in allowlist` });
    return;
  }

  try {
    const upstream = await fetch(targetUrl, {
      headers: {
        'Referer': 'https://hianime.to/',
        'Origin': 'https://hianime.to',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ...(req.headers['range'] ? { 'Range': req.headers['range'] } : {}),
      },
    });

    if (!upstream.ok && upstream.status !== 206) {
      res.status(upstream.status).json({ error: `Upstream returned ${upstream.status}` });
      return;
    }

    const contentType = upstream.headers.get('content-type') || '';
    const isM3U8 = targetUrl.includes('.m3u8') || contentType.includes('mpegurl') || contentType.includes('x-mpegURL');

    const passthroughHeaders = ['content-length', 'content-range', 'accept-ranges'];
    passthroughHeaders.forEach(h => {
      const v = upstream.headers.get(h);
      if (v) res.setHeader(h, v);
    });

    if (isM3U8) {
      const text = await upstream.text();
      const base = new URL(targetUrl);

      const rewritten = text.split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return line;

        let absoluteUrl;
        try {
          absoluteUrl = new URL(trimmed, base).toString();
        } catch {
          return line;
        }

        return `/api/stream?url=${encodeURIComponent(absoluteUrl)}`;
      }).join('\n');

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'no-cache');
      res.status(upstream.status).send(rewritten);
    } else {
      res.setHeader('Content-Type', contentType || 'application/octet-stream');
      res.setHeader('Cache-Control', 'public, max-age=3600');

      const buffer = await upstream.arrayBuffer();
      res.status(upstream.status).send(Buffer.from(buffer));
    }
  } catch (err) {
    console.error('Proxy error:', err);
    res.status(502).json({ error: 'Upstream fetch failed', detail: err.message });
  }
      }
