export default function middleware(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const search = url.search;

  // اگر مسیر /login باشه، درخواست رو به backboard پروکسی کن
  if (pathname.startsWith('/login')) {
    return fetch(`https://backboard.vercel.app${pathname}${search}`, {
      method: request.method,
      headers: request.headers,
      body: request.body
    });
  }

  // در غیر این صورت، درخواست رو به Railway پروکسی کن
  return fetch(`https://railway.com${pathname}${search}`, {
    method: request.method,
    headers: request.headers,
    body: request.body
  });
}

export const config = {
  matcher: '/(.*)',
};
