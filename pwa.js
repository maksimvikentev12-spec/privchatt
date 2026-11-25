// Приватка: установка как приложение (PWA). Запускай ВМЕСТО server.js:
//   BOT_TOKEN=токен node pwa.js
// Файл server.js должен лежать рядом, его менять не нужно.
const http = require('http');
const zlib = require('zlib');

// ---------- иконка рисуется кодом ----------
const CRC = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  CRC[n] = c >>> 0;
}
function crc(buf) {
  let c = 0xFFFFFFFF;
  for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body));
  return Buffer.concat([len, body, sum]);
}
// белое облачко сообщения на синем фоне
function bubble(u, v) {
  const x0 = 0.293, x1 = 0.707, y0 = 0.322, y1 = 0.625, r = 0.088;
  const cx = Math.min(Math.max(u, x0 + r), x1 - r);
  const cy = Math.min(Math.max(v, y0 + r), y1 - r);
  if ((u - cx) ** 2 + (v - cy) ** 2 <= r * r) return 1;
  const A = [0.371, 0.605], B = [0.371, 0.723], C = [0.488, 0.610];
  const s = (p, q) => (u - q[0]) * (p[1] - q[1]) - (p[0] - q[0]) * (v - q[1]);
  const d1 = s(A, B), d2 = s(B, C), d3 = s(C, A);
  const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
  return neg && pos ? 0 : 1;
}
function makePng(S) {
  const raw = Buffer.alloc((S * 3 + 1) * S);
  const c1 = [55, 182, 232], c2 = [29, 127, 196];
  let o = 0;
  for (let y = 0; y < S; y++) {
    raw[o++] = 0;
    for (let x = 0; x < S; x++) {
      let f = 0;
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++)
        f += bubble((x + (i + 0.5) / 2) / S, (y + (j + 0.5) / 2) / S);
      f /= 4;
      const t = (x + y) / (2 * S);
      for (let k = 0; k < 3; k++) {
        const bg = c1[k] + (c2[k] - c1[k]) * t;
        raw[o++] = Math.round(bg * (1 - f) + 255 * f);
      }
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))
  ]);
}
const ICON192 = makePng(192);
const ICON512 = makePng(512);

// ---------- манифест и сервис-воркер ----------
const MANIFEST = JSON.stringify({
  name: 'Приватка', short_name: 'Приватка', description: 'Приватный мессенджер',
  start_url: '/', scope: '/', display: 'standalone', orientation: 'portrait',
  background_color: '#181818', theme_color: '#181818', lang: 'ru',
  icons: [
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
  ]
});
const SW = "self.addEventListener('install',function(e){self.skipWaiting()});" +
  "self.addEventListener('activate',function(e){e.waitUntil(self.clients.claim())});" +
  "self.addEventListener('fetch',function(e){});";
const TAGS = '<link rel="manifest" href="/manifest.json">' +
  '<meta name="theme-color" content="#181818">' +
  '<script>if("serviceWorker" in navigator)navigator.serviceWorker.register("/sw.js")</script>';

// ---------- подключаемся к серверу ----------
const orig = http.createServer;
http.createServer = function (handler) {
  return orig.call(http, function (req, res) {
    const path = (req.url || '').split('?')[0];
    if (req.method === 'GET') {
      if (path === '/manifest.json') {
        res.writeHead(200, { 'content-type': 'application/manifest+json; charset=utf-8' });
        return res.end(MANIFEST);
      }
      if (path === '/sw.js') {
        res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-cache' });
        return res.end(SW);
      }
      if (path === '/icon-192.png' || path === '/icon-512.png') {
        res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400' });
        return res.end(path === '/icon-192.png' ? ICON192 : ICON512);
      }
      if (path === '/' || path === '/index.html') {
        const end = res.end.bind(res);
        res.end = function (chunk, ...rest) {
          if (typeof chunk === 'string' && chunk.includes('</head>'))
            chunk = chunk.replace('</head>', TAGS + '</head>');
          return end(chunk, ...rest);
        };
      }
    }
    return handler(req, res);
  });
};

require('./server.js');
