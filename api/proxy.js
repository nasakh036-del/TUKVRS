export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { m: method, u: url, h: headers, b: body, ct: contentType } = req.body;

    if (!url || !url.startsWith('http')) {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    const fetchHeaders = new Headers();
    if (headers) {
      Object.entries(headers).forEach(([key, value]) => {
        if (!['host', 'connection', 'content-length', 'transfer-encoding'].includes(key.toLowerCase())) {
          fetchHeaders.set(key, value);
        }
      });
    }

    let bodyData = undefined;
    if (body) {
      bodyData = Buffer.from(body, 'base64');
      if (contentType) {
        fetchHeaders.set('Content-Type', contentType);
      }
    }

    const response = await fetch(url, {
      method: method || 'GET',
      headers: fetchHeaders,
      body: bodyData,
    });

    const responseBody = await response.arrayBuffer();
    const responseHeaders = {};
    response.headers.forEach((value, key) => {
      if (!['content-encoding', 'transfer-encoding'].includes(key.toLowerCase())) {
        responseHeaders[key] = value;
      }
    });

    return res.status(200).json({
      s: response.status,
      h: responseHeaders,
      b: Buffer.from(responseBody).toString('base64')
    });

  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ error: error.message });
  }
}
