import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApp } from '../server.js';

async function fixture(t) {
  const dataDir = await mkdtemp(join(tmpdir(), 'thiep-vu-'));
  let app, base, open = false;
  const start = async () => {
    app = createApp({ dataDir, trustProxy: false });
    await new Promise((resolve, reject) => {
      app.server.once('error', reject);
      app.server.listen(0, '127.0.0.1', resolve);
    });
    base = `http://127.0.0.1:${app.server.address().port}`;
    open = true;
  };
  const close = async () => {
    if (!open) return;
    await new Promise((resolve, reject) => app.server.close(error => error ? reject(error) : resolve()));
    open = false;
  };
  await start();
  t.after(async () => { await close(); await rm(dataDir, { recursive: true, force: true }); });
  return {
    get db() { return app.database; }, get base() { return base; }, close, start,
    async get(path = '/api/wishes') { return fetch(base + path); },
    async post(body, extraHeaders = {}) {
      return fetch(base + '/api/wishes', {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', Origin: base, ...extraHeaders },
        body: JSON.stringify(body)
      });
    }
  };
}

const wish = (overrides = {}) => ({ id: randomUUID(), name: 'Nguyễn Ánh', message: 'Chúc Vũ tốt nghiệp thật vui! 🎓', website: '', ...overrides });

test('Phục vụ đủ HTML, CSS, JavaScript, font; không để lộ mã máy chủ hoặc cơ sở dữ liệu', async t => {
  const f = await fixture(t);
  const response = await f.get('/');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^text\/html; charset=utf-8/);
  const html = await response.text();
  assert.match(html, /<html lang="vi">/);
  assert.doesNotMatch(html, /class="round-seal"|<header\b/);
  for (const path of ['style.css', 'event-config.js', 'app.js', 'experience.js', 'guestbook.js', 'assets/lora-variable.ttf', 'assets/dancing-script-variable.ttf', 'assets/sans.ttf', 'assets/favicon.svg']) {
    const file = await f.get('/' + path);
    assert.equal(file.status, 200, path);
    assert.ok(Number(file.headers.get('content-length')) > 0, path);
    await file.arrayBuffer();
  }
  for (const path of ['/server.js', '/data/wishes.sqlite', '/package.json', '/%2e%2e%2fserver.js', '/.git/config']) {
    const blocked = await f.get(path);
    assert.equal(blocked.status, 404, path);
    await blocked.text();
  }
});

test('Lưu tiếng Việt dạng tổ hợp, emoji, xuống dòng; gửi lại không trùng và ID khác nội dung bị từ chối', async t => {
  const f = await fixture(t);
  const input = wish({ name: '  Nguyễn   Ánh  '.normalize('NFD'), message: 'Chúc Vũ tốt nghiệp! 🎓\r\nHẹn gặp ở Tòa E.'.normalize('NFD') });
  const saved = await f.post(input);
  assert.equal(saved.status, 201);
  const data = await saved.json();
  assert.equal(data.wish.name, 'Nguyễn Ánh');
  assert.equal(data.wish.message, 'Chúc Vũ tốt nghiệp! 🎓\nHẹn gặp ở Tòa E.');
  const repeated = await f.post(input);
  assert.equal(repeated.status, 200);
  assert.deepEqual(await repeated.json(), data);
  const conflicting = await f.post({ ...input, message: 'Một nội dung khác' });
  assert.equal(conflicting.status, 409);
  const list = await (await f.get()).json();
  assert.equal(list.total, 1);
  assert.deepEqual(list.wishes, [data.wish]);
  assert.equal(list.next, null);
});

test('Từ chối nội dung rỗng, quá dài, ký tự điều khiển, bẫy spam và gửi từ trang khác', async t => {
  const f = await fixture(t);
  for (const input of [
    wish({ name: '   ' }), wish({ name: 'a'.repeat(61) }),
    wish({ message: '  ' }), wish({ message: 'a'.repeat(501) }),
    wish({ name: 'Tên\u0000' }), wish({ message: 'Chúc\u0007mừng' }),
    wish({ id: 'khong-phai-uuid' }), wish({ website: 'https://spam.invalid' }),
    null, [], { message: 'Thiếu tên' }
  ]) {
    const response = await f.post(input);
    assert.equal(response.status, 400);
    await response.json();
  }
  assert.equal((await f.post(wish(), { Origin: 'https://khac.invalid' })).status, 403);
  assert.equal((await f.post(wish(), { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  assert.equal((await f.post(wish(), { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await f.get('/api/wishes?before=invalid')).status, 400);
  assert.equal((await (await f.get()).json()).total, 0);
});

test('Đúng 500 chữ Việt sau chuẩn hóa được lưu; 501 bị từ chối', async t => {
  const f = await fixture(t);
  const tooLong = await f.post(wish({ message: 'ấ'.repeat(501).normalize('NFD') }));
  assert.equal(tooLong.status, 400);
  const exact = await f.post(wish({ message: 'ấ'.repeat(500).normalize('NFD') }));
  assert.equal(exact.status, 201);
  assert.equal((await exact.json()).wish.message, 'ấ'.repeat(500));
});

test('Giới hạn gửi 15 giây và cho phép gửi tiếp sau khoảng chờ', async t => {
  const f = await fixture(t);
  const first = wish();
  assert.equal((await f.post(first)).status, 201);
  assert.equal((await f.post(first)).status, 200);
  const second = wish();
  const limited = await f.post(second);
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('retry-after'), '15');
  f.db.prepare('UPDATE wish_limits SET last_post = ?').run(Date.now() - 15_100);
  assert.equal((await f.post(second)).status, 201);
  assert.equal((await (await f.get()).json()).total, 2);
});

test('Phân trang ổn định ngay cả khi nhiều lời chúc có cùng thời điểm', async t => {
  const f = await fixture(t);
  const insert = f.db.prepare('INSERT INTO wishes(id,name,message,created_at) VALUES(?,?,?,?)');
  const now = Date.now();
  for (let i = 0; i < 31; i++) insert.run(randomUUID(), 'Người gửi ' + i, 'Chúc mừng tốt nghiệp!', now - Math.floor(i / 5));
  const expected = f.db.prepare('SELECT id FROM wishes ORDER BY created_at DESC, id DESC').all().map(row => row.id);
  const actual = []; let cursor = null; let pages = 0;
  do {
    const data = await (await f.get('/api/wishes' + (cursor ? '?before=' + encodeURIComponent(cursor) : ''))).json();
    assert.equal(data.total, 31);
    assert.ok(data.wishes.length <= 12);
    actual.push(...data.wishes.map(row => row.id));
    cursor = data.next;
    assert.ok(++pages < 10);
  } while (cursor);
  assert.deepEqual(actual, expected);
  assert.equal(new Set(actual).size, 31);
});

test('Lời chúc vẫn còn khi tắt và khởi động lại máy chủ', async t => {
  const f = await fixture(t);
  const input = wish({ message: '<img src=x onerror=alert(1)> Chúc mừng Vũ!' });
  assert.equal((await f.post(input)).status, 201);
  await f.close(); await f.start();
  const data = await (await f.get()).json();
  assert.equal(data.total, 1);
  assert.equal(data.wishes[0].message, input.message);
  assert.equal(data.wishes[0].id, input.id);
});

test('Từ chối JSON lỗi, UTF-8 lỗi và phần thân quá lớn mà không ghi dữ liệu', async t => {
  const f = await fixture(t);
  for (const [body, expected] of [
    ['{not-json', 400], [Buffer.from([0xff, 0xfe]), 400],
    [JSON.stringify(wish({ message: 'a'.repeat(8100) })), 413]
  ]) {
    const response = await fetch(f.base + '/api/wishes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    assert.equal(response.status, expected);
    await response.json();
  }
  assert.equal((await (await f.get()).json()).total, 0);
});
