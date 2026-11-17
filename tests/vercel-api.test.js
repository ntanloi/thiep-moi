import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import handler from '../api/wishes.js';

// Upstash REST giả, chỉ đủ các lệnh mà api/wishes.js dùng.
function fakeUpstash() {
  const hashes = new Map(), zsets = new Map(), strings = new Set();
  const run = ([cmd, ...a]) => {
    switch (String(cmd).toUpperCase()) {
      case 'HGET': return hashes.get(a[0])?.get(a[1]) ?? null;
      case 'HMGET': return a.slice(1).map(f => hashes.get(a[0])?.get(f) ?? null);
      case 'HSETNX': { const h = hashes.get(a[0]) ?? new Map(); hashes.set(a[0], h); if (h.has(a[1])) return 0; h.set(a[1], a[2]); return 1; }
      case 'ZADD': { const z = zsets.get(a[0]) ?? new Set(); zsets.set(a[0], z); const had = z.has(a[2]); z.add(a[2]); return had ? 0 : 1; }
      case 'ZCARD': return zsets.get(a[0])?.size ?? 0;
      case 'SET': { if (strings.has(a[0])) return null; strings.add(a[0]); return 'OK'; }
      case 'ZRANGE': {
        const key = a[0], max = a[1], limitCount = a[7];
        let list = [...(zsets.get(key) ?? [])].sort().reverse();
        if (max.startsWith('(')) list = list.filter(m => m < max.slice(1));
        return list.slice(0, Number(limitCount));
      }
      default: throw new Error('Lệnh chưa hỗ trợ: ' + cmd);
    }
  };
  return createServer((req, res) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const commands = JSON.parse(Buffer.concat(chunks));
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(commands.map(c => { try { return { result: run(c) }; } catch (e) { return { error: e.message }; } })));
    });
  });
}

async function fixture(t) {
  const redisServer = fakeUpstash();
  await new Promise(r => redisServer.listen(0, '127.0.0.1', r));
  process.env.UPSTASH_REDIS_REST_URL = `http://127.0.0.1:${redisServer.address().port}`;
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test';
  const app = createServer((req, res) => handler(req, res));
  await new Promise(r => app.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.address().port}`;
  t.after(() => { app.close(); redisServer.close(); });
  return {
    get: (q = '') => fetch(`${base}/api/wishes${q}`),
    post: (body, headers = {}) => fetch(`${base}/api/wishes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', Origin: base, ...headers, 'X-Forwarded-For': headers.ip ?? randomUUID() },
      body: typeof body === 'string' ? body : JSON.stringify(body)
    })
  };
}
const wish = (o = {}) => ({ id: randomUUID(), name: 'Nguyễn Ánh', message: 'Chúc Vũ tốt nghiệp thật vui! 🎓', website: '', ...o });

test('Lúc đầu chưa có lời chúc', async t => {
  const f = await fixture(t);
  const r = await f.get();
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { wishes: [], total: 0, next: null });
});

test('Gửi lời chúc tiếng Việt rồi đọc lại; gửi lại cùng id không tạo trùng', async t => {
  const f = await fixture(t);
  const w = wish();
  const created = await f.post(w);
  assert.equal(created.status, 201);
  const body = await created.json();
  assert.equal(body.wish.name, 'Nguyễn Ánh');
  const again = await f.post(w);
  assert.equal(again.status, 200);
  const list = await (await f.get()).json();
  assert.equal(list.total, 1);
  assert.equal(list.wishes[0].message, 'Chúc Vũ tốt nghiệp thật vui! 🎓');
  const conflict = await f.post({ ...w, message: 'Nội dung khác hẳn' });
  assert.equal(conflict.status, 409);
});

test('Giới hạn 15 giây cho cùng địa chỉ mạng', async t => {
  const f = await fixture(t);
  assert.equal((await f.post(wish(), { ip: '1.2.3.4' })).status, 201);
  const second = await f.post(wish(), { ip: '1.2.3.4' });
  assert.equal(second.status, 429);
  assert.equal(second.headers.get('retry-after'), '15');
});

test('Từ chối dữ liệu sai', async t => {
  const f = await fixture(t);
  assert.equal((await f.post(wish({ message: 'ab' }))).status, 400);
  assert.equal((await f.post(wish({ name: '   ' }))).status, 400);
  assert.equal((await f.post(wish({ website: 'spam' }))).status, 400);
  assert.equal((await f.post(wish({ id: 'khong-hop-le' }))).status, 400);
  assert.equal((await f.post('{khong phai json')).status, 400);
  assert.equal((await f.post(wish(), { Origin: 'https://trang-la.example' })).status, 403);
  assert.equal((await f.post(wish({ message: 'a'.repeat(501) }))).status, 400);
});

test('Phân trang: 12 lời chúc mỗi trang, mới nhất trước, không trùng', async t => {
  const f = await fixture(t);
  for (let i = 0; i < 30; i++) {
    const r = await f.post(wish({ message: `Lời chúc số ${i}` }));
    assert.equal(r.status, 201);
    await new Promise(r => setTimeout(r, 2));
  }
  const seen = [];
  let q = '', pages = 0;
  while (true) {
    const data = await (await f.get(q)).json();
    pages++;
    assert.equal(data.total, 30);
    seen.push(...data.wishes.map(w => w.message));
    if (!data.next) break;
    q = `?before=${encodeURIComponent(data.next)}`;
  }
  assert.equal(pages, 3);
  assert.equal(seen.length, 30);
  assert.equal(new Set(seen).size, 30);
  assert.equal(seen[0], 'Lời chúc số 29');
  assert.equal(seen[29], 'Lời chúc số 0');
  assert.equal((await f.get('?before=hong')).status, 400);
});

test('Báo lỗi rõ ràng khi chưa cấu hình database', async t => {
  const f = await fixture(t);
  delete process.env.UPSTASH_REDIS_REST_URL; delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.KV_REST_API_URL; delete process.env.KV_REST_API_TOKEN;
  const r = await f.get();
  assert.equal(r.status, 503);
  assert.match((await r.json()).error, /chưa được cấu hình/);
});
