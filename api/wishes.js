/**
 * Sổ lưu bút chạy trên Vercel (Serverless Function) + Upstash Redis.
 * Không cần cài thư viện npm: gọi Redis qua REST bằng fetch.
 *
 * Biến môi trường (Vercel tự thêm khi bạn kết nối Upstash, hoặc bạn tự thêm):
 *   UPSTASH_REDIS_REST_URL  và  UPSTASH_REDIS_REST_TOKEN
 *   (hoặc KV_REST_API_URL và KV_REST_API_TOKEN)
 */
import { createHash } from 'node:crypto';
import { checkWish } from '../public/wish-filter.js';

const PAGE_SIZE = 12;
const MAX_BODY_BYTES = 8000;
const COOLDOWN_SECONDS = 15;
const KEY_LIST = 'thiep:wishes:list';   // sorted set (điểm 0) -> sắp xếp theo "thờiGian:id"
const KEY_DATA = 'thiep:wishes:data';   // hash: id -> JSON lời chúc
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const controls = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;

function send(res, status, body, extraHeaders = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders
  });
  res.end(JSON.stringify(body));
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

/** Gọi Redis theo lô (pipeline). Trả về mảng kết quả theo thứ tự lệnh. */
async function redis(commands) {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw httpError(503, 'Sổ lưu bút chưa được cấu hình cơ sở dữ liệu.');
  const response = await fetch(`${url.replace(/\/$/, '')}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error(`Redis HTTP ${response.status}`);
  const items = await response.json();
  return items.map((item) => {
    if (item.error) throw new Error(`Redis: ${item.error}`);
    return item.result;
  });
}

async function readJson(req) {
  const length = req.headers['content-length'];
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES)) {
    throw httpError(413, 'Nội dung gửi quá dài.');
  }
  let body;
  try { body = req.body; } catch { throw httpError(400, 'Nội dung gửi chưa hợp lệ.'); }
  if (body === undefined) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) throw httpError(413, 'Nội dung gửi quá dài.');
      chunks.push(chunk);
    }
    body = Buffer.concat(chunks);
  }
  if (Buffer.isBuffer(body)) {
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body)); }
    catch { throw httpError(400, 'Nội dung gửi chưa hợp lệ.'); }
  }
  if (typeof body === 'string') {
    try { return JSON.parse(body); }
    catch { throw httpError(400, 'Nội dung gửi chưa hợp lệ.'); }
  }
  return body;
}

const parseWish = (raw) => {
  try {
    const wish = JSON.parse(raw);
    return { id: wish.id, name: wish.name.normalize('NFC'), message: wish.message.normalize('NFC'), createdAt: wish.createdAt };
  } catch { return null; }
};

async function listWishes(req, res, url) {
  const before = url.searchParams.get('before');
  let max = '+';
  if (before !== null) {
    const match = /^(\d{13}):([a-f0-9-]{36})$/i.exec(before);
    if (!match || !uuidV4.test(match[2])) {
      return send(res, 400, { error: 'Mốc tải lời chúc không hợp lệ.' });
    }
    max = `(${match[1]}:${match[2].toLowerCase()}`;
  }
  const [members, total] = await redis([
    ['ZRANGE', KEY_LIST, max, '-', 'BYLEX', 'REV', 'LIMIT', 0, PAGE_SIZE + 1],
    ['ZCARD', KEY_LIST]
  ]);
  const more = members.length > PAGE_SIZE;
  const page = members.slice(0, PAGE_SIZE);
  let wishes = [];
  if (page.length) {
    const [rows] = await redis([['HMGET', KEY_DATA, ...page.map((member) => member.slice(14))]]);
    wishes = rows.map((raw) => (raw ? parseWish(raw) : null)).filter(Boolean);
  }
  return send(res, 200, { wishes, total: Number(total) || 0, next: more && page.length ? page.at(-1) : null });
}

async function createWish(req, res) {
  // Chỉ nhận gửi lời chúc từ chính trang này.
  const origin = req.headers.origin;
  let sameOrigin = true;
  if (origin) {
    try {
      const parsed = new URL(origin);
      sameOrigin = ['http:', 'https:'].includes(parsed.protocol) && parsed.host === req.headers.host;
    } catch { sameOrigin = false; }
  }
  if (!sameOrigin || req.headers['sec-fetch-site'] === 'cross-site') {
    return send(res, 403, { error: 'Bạn mở thiệp mời rồi gửi lời chúc tại đó nhé.' });
  }
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) {
    return send(res, 415, { error: 'Nội dung gửi cần ở định dạng JSON.' });
  }
  const input = await readJson(req);
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      typeof input.name !== 'string' || typeof input.message !== 'string' ||
      typeof input.id !== 'string' || !uuidV4.test(input.id) ||
      (input.website !== undefined && input.website !== '')) {
    return send(res, 400, { error: 'Bạn kiểm tra lại tên và lời chúc nhé.' });
  }
  const id = input.id.toLowerCase();
  const name = input.name.normalize('NFC').trim().replace(/\s+/gu, ' ');
  const message = input.message.normalize('NFC').replace(/\r\n?/g, '\n').trim();
  if (name.length < 1 || name.length > 60 || message.length < 3 || message.length > 500 ||
      controls.test(input.name) || controls.test(message)) {
    return send(res, 400, { error: 'Tên từ 1–60 ký tự; lời chúc từ 3–500 ký tự nhé.' });
  }
  // Quy tắc nội dung: không từ tục tĩu, không từ ngữ về tình yêu (xem public/wish-filter.js).
  const rule = checkWish({ name, message });
  if (!rule.ok) return send(res, 400, { error: rule.error });

  // Gửi lại cùng một lần (mất mạng rồi thử lại): trả lại bản ghi cũ, không tạo trùng.
  const replay = async (raw) => {
    const existing = parseWish(raw);
    if (existing && existing.name === name && existing.message === message) {
      await redis([['ZADD', KEY_LIST, 0, `${existing.createdAt}:${id}`]]); // sửa lại nếu lần trước dang dở
      return send(res, 200, { wish: existing });
    }
    return send(res, 409, { error: 'Lần gửi này đã được dùng. Bạn tải lại trang rồi thử nhé.' });
  };
  const [existingRaw] = await redis([['HGET', KEY_DATA, id]]);
  if (existingRaw) return replay(existingRaw);

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  const key = createHash('sha256').update(ip).digest('hex');
  const [allowed] = await redis([['SET', `thiep:wishes:rate:${key}`, '1', 'NX', 'EX', COOLDOWN_SECONDS]]);
  if (allowed !== 'OK') {
    return send(res, 429, { error: `Bạn chờ ${COOLDOWN_SECONDS} giây trước khi gửi thêm lời chúc nhé.` }, { 'Retry-After': String(COOLDOWN_SECONDS) });
  }

  const now = Date.now();
  const wish = { id, name, message, createdAt: now };
  const [created] = await redis([['HSETNX', KEY_DATA, id, JSON.stringify(wish)]]);
  if (Number(created) === 0) {
    const [raw] = await redis([['HGET', KEY_DATA, id]]);
    return replay(raw);
  }
  await redis([['ZADD', KEY_LIST, 0, `${now}:${id}`]]);
  return send(res, 201, { wish });
}

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'GET') return await listWishes(req, res, url);
    if (req.method === 'POST') return await createWish(req, res);
    return send(res, 405, { error: 'Phương thức không được hỗ trợ.' }, { Allow: 'GET, POST' });
  } catch (error) {
    if (error.status && error.status < 500) return send(res, error.status, { error: error.message });
    console.error('[thiep-moi]', error.message);
    if (!res.headersSent) {
      return send(res, error.status || 503, { error: error.status ? error.message : 'Chưa lưu được lời chúc. Nội dung vẫn còn; bạn thử lại nhé.' });
    }
    res.end();
  }
}
