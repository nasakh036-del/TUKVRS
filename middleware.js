export default async function middleware(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const search = url.search;
  const headers = new Headers(request.headers);
  
  headers.delete('x-forwarded-host');
  
  // اگر مسیر /login باشه، به backboard پروکسی کن
  if (pathname.startsWith('/login')) {
    headers.set('host', 'backboard.vercel.app');
    try {
      const res = await fetch(`https://backboard.vercel.app${pathname}${search}`, {
        method: request.method,
        headers: headers,
        body: request.body,
        redirect: 'manual'
      });
      
      if (res.status === 302 || res.status === 301) {
        const location = res.headers.get('location');
        if (location && location.includes('github.com')) {
          const newLocation = location.replace(
            'https://github.com',
            'https://tukvrs-2.vercel.app'
          );
          return new Response(null, {
            status: res.status,
            headers: { 'Location': newLocation }
          });
        }
        return res;
      }
      return res;
    } catch (e) {
      return new Response('Error: ' + e.message, { status: 500 });
    }
  }
  
  // callback از گیت‌هاب
  if (pathname.startsWith('/login/oauth')) {
    headers.set('host', 'github.com');
    return fetch(`https://tukvrs-2.vercel.app${pathname}${search}`, {
      method: request.method,
      headers: headers,
      body: request.body,
      redirect: 'manual'
    });
  }
  
  // بقیه مسیرها به Railway
  headers.set('host', 'railway.com');
  return fetch(`https://railway.com${pathname}${search}`, {
    method: request.method,
    headers: headers,
    body: request.body
  });
}

export const config = {
  matcher: '/(.*)',
};
