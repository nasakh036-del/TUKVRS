// ============================================================================
// Vercel + Cloudflare Proxy Relay
// Supports: Domain Fronting, Any Cloudflare CDN Domain
// Author: MasterHttpRelayVPN
// ============================================================================

/**
 * پروکسی کامل برای عبور از Cloudflare و Vercel
 * پشتیبانی از:
 * - HTTP/HTTPS
 * - WebSocket (partial)
 * - Streaming responses
 * - CORS
 * - Large file downloads
 */

export default async function handler(req, res) {
  // ==================== 1. Method Validation ====================
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are accepted'
    });
  }

  // ==================== 2. Parse Request Body ====================
  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const { 
    m: method = 'GET',           // HTTP method
    u: url,                       // Target URL
    h: headers = {},              // Request headers
    b: bodyData,                  // Base64 encoded body
    ct: contentType,              // Content-Type
    t: timeout = 30000,           // Timeout in ms (default 30s)
    f: followRedirect = true      // Follow redirects
  } = body;

  // ==================== 3. URL Validation ====================
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid URL (u parameter)' });
  }

  // فقط HTTP/HTTPS مجاز هستند
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return res.status(400).json({ error: 'Only HTTP/HTTPS URLs are allowed' });
  }

  // ==================== 4. Block Dangerous URLs ====================
  const blockedDomains = [
    'localhost', '127.0.0.1', '::1', '0.0.0.0',
    'metadata.google.internal', '169.254.169.254'
  ];
  
  try {
    const urlObj = new URL(url);
    if (blockedDomains.some(domain => urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain))) {
      return res.status(403).json({ error: 'Access to internal addresses is forbidden' });
    }
  } catch (e) {
    // Invalid URL already handled above
  }

  // ==================== 5. Prepare Fetch Headers ====================
  const fetchHeaders = new Headers();
  
  // هدرهای مهم و ضروری
  const importantHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9,fa;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive'
  };

  // اضافه کردن هدرهای مهم
  Object.entries(importantHeaders).forEach(([key, value]) => {
    fetchHeaders.set(key, value);
  });

  // اضافه کردن هدرهای درخواست کلاینت (با فیلتر امنیتی)
  const blockedHeaders = [
    'host', 'connection', 'content-length', 'transfer-encoding',
    'accept-encoding', 'proxy-connection', 'proxy-authorization',
    'x-forwarded-for', 'x-real-ip', 'cf-connecting-ip'
  ];

  if (headers && typeof headers === 'object') {
    Object.entries(headers).forEach(([key, value]) => {
      const lowerKey = key.toLowerCase();
      if (!blockedHeaders.includes(lowerKey) && typeof value === 'string') {
        fetchHeaders.set(key, value);
      }
    });
  }

  // ==================== 6. Prepare Request Body ====================
  let requestBody = undefined;
  if (bodyData) {
    try {
      requestBody = Buffer.from(bodyData, 'base64');
      if (contentType) {
        fetchHeaders.set('Content-Type', contentType);
      }
    } catch (e) {
      return res.status(400).json({ error: 'Invalid base64 body data' });
    }
  }

  // ==================== 7. Prepare Request Options ====================
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const fetchOptions = {
    method: method.toUpperCase(),
    headers: fetchHeaders,
    signal: controller.signal,
    redirect: followRedirect ? 'follow' : 'manual'
  };

  if (requestBody) {
    fetchOptions.body = requestBody;
  }

  // ==================== 8. Make Request ====================
  let response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (error) {
    clearTimeout(timeoutId);
    console.error(`Fetch error for ${url}:`, error);
    
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'Request timeout' });
    }
    
    return res.status(502).json({ 
      error: 'Failed to fetch target URL',
      details: error.message 
    });
  }

  clearTimeout(timeoutId);

  // ==================== 9. Handle Redirects (manual mode) ====================
  if (!followRedirect && (response.status === 301 || response.status === 302 || response.status === 307 || response.status === 308)) {
    const location = response.headers.get('location');
    return res.status(response.status).json({
      s: response.status,
      redirect: location,
      h: Object.fromEntries(response.headers)
    });
  }

  // ==================== 10. Read Response Body ====================
  let responseBody;
  try {
    responseBody = await response.arrayBuffer();
  } catch (error) {
    console.error(`Failed to read response body for ${url}:`, error);
    return res.status(502).json({ error: 'Failed to read response body' });
  }

  // ==================== 11. Filter Response Headers ====================
  const responseHeaders = {};
  const filteredHeaders = [
    'content-encoding', 'transfer-encoding', 'connection',
    'keep-alive', 'proxy-authenticate', 'proxy-connection',
    'upgrade', 'cf-ray', 'cf-cache-status'
  ];

  response.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (!filteredHeaders.includes(lowerKey) && !lowerKey.startsWith('cf-')) {
      responseHeaders[key] = value;
    }
  });

  // ==================== 12. Add CORS Headers ====================
  const origin = headers?.origin || headers?.Origin || '*';
  responseHeaders['Access-Control-Allow-Origin'] = origin;
  responseHeaders['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, PATCH, OPTIONS';
  responseHeaders['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With';
  responseHeaders['Access-Control-Allow-Credentials'] = 'true';
  responseHeaders['Vary'] = 'Origin';

  // ==================== 13. Add Content-Length ====================
  responseHeaders['Content-Length'] = responseBody.byteLength.toString();

  // ==================== 14. Return Response ====================
  return res.status(200).json({
    s: response.status,
    h: responseHeaders,
    b: Buffer.from(responseBody).toString('base64')
  });
}
