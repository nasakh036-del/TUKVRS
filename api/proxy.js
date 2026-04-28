// api/proxy.js
export default async function handler(req, res) {
  // فقط درخواست‌های POST را قبول کن
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { m: method, u: url, h: headers, b: body, ct: contentType } = req.body;

    // اعتبارسنجی URL
    if (!url || !url.startsWith('http')) {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    // آماده‌سازی هدرها
    const fetchHeaders = new Headers();
    if (headers) {
      Object.entries(headers).forEach(([key, value]) => {
        // فیلتر کردن هدرهای مشکل‌دار
        if (!['host', 'connection', 'content-length', 'transfer-encoding'].includes(key.toLowerCase())) {
          fetchHeaders.set(key, value);
        }
      });
    }

    // آماده‌سازی body
    let bodyData = undefined;
    if (body) {
      bodyData = Buffer.from(body, 'base64');
      if (contentType) {
        fetchHeaders.set('Content-Type', contentType);
      }
    }

    // ارسال درخواست به سرور مقصد
    const response = await fetch(url, {
      method: method || 'GET',
      headers: fetchHeaders,
      body: bodyData,
    });

    // دریافت پاسخ
    const responseBody = await response.arrayBuffer();
    const responseHeaders = {};
    response.headers.forEach((value, key) => {
      if (!['content-encoding', 'transfer-encoding'].includes(key.toLowerCase())) {
        responseHeaders[key] = value;
      }
    });

    // بازگرداندن پاسخ
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
