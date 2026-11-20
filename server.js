/**
 * Máy chủ JavaScript thuần, không cần cài thư viện npm.
 * Node.js >= 22.13.0. Chạy: npm start
 * Chỉ thư mục public/ được phục vụ ra trình duyệt.
 */
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { readFile, realpath, stat } from 'node:fs/promises';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkWish } from './public/wish-filter.js';

const root = dirname(fileURLToPath(import.meta.url));
const pageSize = 12;
const maxBodyBytes = 8000;
const cooldown = 15_000;
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const controls = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.ttf': 'font/ttf',
  '.woff2': 'font/woff2', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

function json(response, status, body, extraHeaders = {}) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store', ...extraHeaders
  });
  response.end(JSON.stringify(body));
}

function publicWish(row) {
  return {
    id: row.id, name: row.name.normalize('NFC'),
    message: row.message.normalize('NFC'), createdAt: row.created_at
  };
}

async function readJson(request) {
  const length = request.headers['content-length'];
  if (length && (!/^\d+$/.test(length) || Number(length) > maxBodyBytes)) {
    const error = new Error('Nội dung gửi quá dài.'); error.status = 413; throw error;
  }
  const chunks = []; let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBodyBytes) {
      const error = new Error('Nội dung gửi quá dài.'); error.status = 413; throw error;
    }
    chunks.push(chunk);
  }
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
    return JSON.parse(text);
  } catch {
    const error = new Error('Nội dung gửi chưa hợp lệ.'); error.status = 400; throw error;
  }
}

/** Tạo ứng dụng riêng, cho phép kiểm tra bằng cơ sở dữ liệu tạm. */
export function createApp({
  dataDir = process.env.DATA_DIR || resolve(root, 'data'),
  publicDir = resolve(root, 'public'),
  trustProxy = process.env.TRUST_PROXY === '1'
} = {}) {
  mkdirSync(dataDir, { recursive: true });
  const database = new DatabaseSync(resolve(dataDir, 'wishes.sqlite'));
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS wishes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS wishes_created_index ON wishes(created_at, id);
    CREATE TABLE IF NOT EXISTS wish_limits (
      key TEXT PRIMARY KEY,
      last_post INTEGER NOT NULL
    );
  `);
  const findWish = database.prepare('SELECT * FROM wishes WHERE id = ?');
  const countWishes = database.prepare('SELECT COUNT(*) AS total FROM wishes');
  const firstPage = database.prepare('SELECT * FROM wishes ORDER BY created_at DESC, id DESC LIMIT ?');
  const olderPage = database.prepare(`SELECT * FROM wishes
    WHERE created_at < ? OR (created_at = ? AND id < ?)
    ORDER BY created_at DESC, id DESC LIMIT ?`);
  const insertWish = database.prepare('INSERT INTO wishes(id, name, message, created_at) VALUES (?, ?, ?, ?)');
  const checkRate = database.prepare(`INSERT INTO wish_limits(key, last_post) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET last_post = excluded.last_post
    WHERE wish_limits.last_post <= ? RETURNING key`);
  const cleanRates = database.prepare('DELETE FROM wish_limits WHERE last_post < ?');

  async function wishesApi(request, response, url) {
    if (request.method === 'GET') {
      const before = url.searchParams.get('before');
      let rows;
      if (before !== null) {
        const match = /^(\d{13}):([a-f0-9-]{36})$/i.exec(before);
        if (!match || !uuidV4.test(match[2])) {
          return json(response, 400, { error: 'Mốc tải lời chúc không hợp lệ.' });
        }
        const timestamp = Number(match[1]);
        rows = olderPage.all(timestamp, timestamp, match[2].toLowerCase(), pageSize + 1);
      } else {
        rows = firstPage.all(pageSize + 1);
      }
      const more = rows.length > pageSize;
      const page = rows.slice(0, pageSize);
      const last = page.at(-1);
      return json(response, 200, {
        wishes: page.map(publicWish), total: countWishes.get().total,
        next: more && last ? `${last.created_at}:${last.id}` : null
      });
    }
    if (request.method !== 'POST') {
      return json(response, 405, { error: 'Phương thức không được hỗ trợ.' }, { Allow: 'GET, POST' });
    }

    // Chỉ nhận gửi lời chúc từ chính trang này. Không bật CORS công khai.
    const origin = request.headers.origin;
    let sameOrigin = true;
    if (origin) {
      try {
        const parsed = new URL(origin);
        sameOrigin = ['http:', 'https:'].includes(parsed.protocol) && parsed.host === request.headers.host;
      } catch { sameOrigin = false; }
    }
    if (!sameOrigin || request.headers['sec-fetch-site'] === 'cross-site') {
      return json(response, 403, { error: 'Bạn mở thiệp mời rồi gửi lời chúc tại đó nhé.' });
    }
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] || '')) {
      return json(response, 415, { error: 'Nội dung gửi cần ở định dạng JSON.' });
    }
    let input;
    try { input = await readJson(request); }
    catch (error) { return json(response, error.status || 400, { error: error.message }); }
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
        typeof input.name !== 'string' || typeof input.message !== 'string' ||
        typeof input.id !== 'string' || !uuidV4.test(input.id) ||
        (input.website !== undefined && input.website !== '')) {
      return json(response, 400, { error: 'Bạn kiểm tra lại tên và lời chúc nhé.' });
    }
    const id = input.id.toLowerCase();
    const name = input.name.normalize('NFC').trim().replace(/\s+/gu, ' ');
    const message = input.message.normalize('NFC').replace(/\r\n?/g, '\n').trim();
    if (name.length < 1 || name.length > 60 || message.length < 3 || message.length > 500 ||
        controls.test(input.name) || controls.test(message)) {
      return json(response, 400, { error: 'Tên từ 1–60 ký tự; lời chúc từ 3–500 ký tự nhé.' });
    }
    // Quy tắc nội dung: không từ tục tĩu, không từ ngữ về tình yêu (xem public/wish-filter.js).
    const rule = checkWish({ name, message });
    if (!rule.ok) return json(response, 400, { error: rule.error });
    // Trả lại cùng bản ghi nếu trình duyệt gửi lại sau khi mất kết nối.
    const existing = findWish.get(id);
    if (existing) {
      if (existing.name === name && existing.message === message) {
        return json(response, 200, { wish: publicWish(existing) });
      }
      return json(response, 409, { error: 'Lần gửi này đã được dùng. Bạn tải lại trang rồi thử nhé.' });
    }
    const forwarded = trustProxy ? request.headers['x-forwarded-for']?.split(',')[0]?.trim() : '';
    const ip = forwarded || request.socket.remoteAddress || 'unknown';
    const key = createHash('sha256').update(ip).digest('hex');
    const now = Date.now();
    database.exec('BEGIN IMMEDIATE');
    try {
      if (!checkRate.get(key, now, now - cooldown)) {
        database.exec('ROLLBACK');
        return json(response, 429, { error: 'Bạn chờ 15 giây trước khi gửi thêm lời chúc nhé.' }, { 'Retry-After': '15' });
      }
      insertWish.run(id, name, message, now);
      cleanRates.run(now - 86_400_000);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK'); throw error;
    }
    return json(response, 201, { wish: { id, name, message, createdAt: now } });
  }

  async function staticFile(request, response, pathname) {
    if (!['GET', 'HEAD'].includes(request.method)) {
      return json(response, 405, { error: 'Phương thức không được hỗ trợ.' }, { Allow: 'GET, HEAD' });
    }
    let decoded;
    try { decoded = decodeURIComponent(pathname); }
    catch { return json(response, 400, { error: 'Đường dẫn không hợp lệ.' }); }
    if (decoded.includes('\0') || decoded.includes('\\') || decoded.split('/').some(part => part.startsWith('.'))) {
      return json(response, 404, { error: 'Không tìm thấy trang.' });
    }
    const requested = resolve(publicDir, '.' + (decoded === '/' ? '/index.html' : decoded));
    const base = await realpath(publicDir);
    try {
      const actual = await realpath(requested);
      if (!actual.startsWith(base + sep) || !(await stat(actual)).isFile()) {
        return json(response, 404, { error: 'Không tìm thấy trang.' });
      }
      const contentType = mimeTypes[extname(actual).toLowerCase()];
      if (!contentType) return json(response, 404, { error: 'Không tìm thấy trang.' });
      const body = await readFile(actual);
      response.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': body.length,
        'Cache-Control': ['.ttf', '.woff2'].includes(extname(actual)) ? 'public, max-age=604800' : 'no-cache'
      });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch (error) {
      if (['ENOENT', 'ENOTDIR'].includes(error.code)) return json(response, 404, { error: 'Không tìm thấy trang.' });
      throw error;
    }
  }

  const server = createServer((request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src https://maps.google.com https://www.google.com; frame-ancestors 'self'; base-uri 'self'; form-action 'self'");
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    (async () => {
      const url = new URL(request.url, 'http://localhost');
      if (url.pathname === '/api/wishes') return wishesApi(request, response, url);
      if (url.pathname.startsWith('/api/')) return json(response, 404, { error: 'Không tìm thấy chức năng.' });
      return staticFile(request, response, url.pathname);
    })().catch((error) => {
      console.error('[thiep-moi]', error.message);
      if (!response.headersSent) json(response, 503, { error: 'Chưa lưu được lời chúc. Nội dung vẫn còn; bạn thử lại nhé.' });
      else response.end();
    });
  });
  server.requestTimeout = 20_000;
  server.headersTimeout = 15_000;
  server.on('close', () => database.close());
  return { server, database };
}

// Không khởi động khi được import bởi bộ kiểm tra.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '127.0.0.1';
  const { server } = createApp();
  server.on('error', (error) => { console.error('Không mở được máy chủ:', error.message); process.exitCode = 1; });
  server.listen(port, host, () => console.log(`Thiệp mời: http://${host}:${port}\nNhấn Ctrl+C để dừng. Lời chúc được giữ trong thư mục data/.`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
}
