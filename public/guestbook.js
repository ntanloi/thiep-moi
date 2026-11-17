(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const form = $('wish-form');
  if (!form) return;
  const entries = new Map();
  let next = null, total = 0, loading = false, loaded = false, sending = false, pendingId = null, fetchController;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const nameField = $('wish-name'), messageField = $('wish-message'), feedback = $('wish-feedback');
  const vietnameseText = (value) => value.normalize('NFC').replace(/\r\n?/g, '\n');
  // randomUUID cần HTTPS; getRandomValues vẫn dùng được khi xem qua mạng LAN.
  const newId = () => {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };
  const connectionMessage = (error) => location.protocol === 'file:'
    ? 'Bạn chạy máy chủ đi kèm rồi mở http://127.0.0.1:3000 để dùng sổ lưu bút nhé.'
    : error instanceof TypeError ? 'Chưa kết nối được sổ lưu bút. Bạn thử lại nhé.' : error.message;
  let composing = false;
  const validateVietnamese = () => {
    const nameLength = vietnameseText(nameField.value).trim().replace(/\s+/g, ' ').length;
    const messageLength = vietnameseText(messageField.value).trim().length;
    const trimmedLength = vietnameseText(messageField.value).trim().length;
    $('wish-count').textContent = `${messageLength} / 500`;
    nameField.setCustomValidity(nameLength > 60 ? 'Tên của bạn tối đa 60 ký tự nhé.' : nameField.value && !nameLength ? 'Bạn nhập tên của mình nhé.' : '');
    messageField.setCustomValidity(trimmedLength > 500 ? 'Lời chúc tối đa 500 ký tự nhé.' : messageField.value && trimmedLength < 3 ? 'Bạn viết lời chúc từ 3 ký tự nhé.' : '');
  };
  // Keep the browser's Vietnamese IME in control until a syllable is committed.
  form.addEventListener('compositionstart', () => { composing = true; });
  form.addEventListener('compositionend', () => { composing = false; validateVietnamese(); });
  const readResponse = async (response) => {
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || 'Kết nối chưa ổn định. Bạn thử lại nhé.');
    return data;
  };
  const addWish = (wish, fresh = false) => {
    if (!wish || typeof wish.id !== 'string' || entries.has(wish.id)) return false;
    entries.set(wish.id, wish);
    const article = document.createElement('article');
    article.className = 'wish-card' + (fresh && !reduced.matches ? ' wish-new' : '');
    article.dataset.id = wish.id;
    const quote = document.createElement('span'); quote.className = 'wish-quote'; quote.textContent = '“'; quote.setAttribute('aria-hidden', 'true');
    const message = document.createElement('p'); message.className = 'wish-card-message'; message.textContent = wish.message;
    const bottom = document.createElement('div'); bottom.className = 'wish-card-bottom';
    const avatar = document.createElement('span'); avatar.className = 'wish-avatar'; avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = Array.from(wish.name.trim().split(/\s+/).slice(-2).map(word => Array.from(word)[0]).join('')).join('').toLocaleUpperCase('vi-VN');
    const author = document.createElement('div');
    const name = document.createElement('h4'); name.textContent = wish.name;
    const date = document.createElement('time'); date.dateTime = new Date(wish.createdAt).toISOString();
    date.textContent = new Date(wish.createdAt).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' });
    author.append(name, date); bottom.append(avatar, author); article.append(quote, message, bottom);
    const newerThan = Array.from($('wish-wall').children).find((node) => {
      const other = entries.get(node.dataset.id);
      return other && (wish.createdAt > other.createdAt || (wish.createdAt === other.createdAt && wish.id > other.id));
    });
    $('wish-wall').insertBefore(article, newerThan || null);
    return true;
  };
  const syncStatus = () => {
    $('wish-total').textContent = `${total} lời chúc`;
    $('wish-empty').hidden = entries.size > 0 || !loaded;
    $('wish-load-more').hidden = !next;
    $('wish-wall').setAttribute('aria-busy', String(loading));
  };
  async function loadWishes({ append = false, refresh = false } = {}) {
    if (loading) return;
    loading = true; $('wish-wall').setAttribute('aria-busy', 'true');
    $('wish-load-more').disabled = true; $('wish-retry').disabled = true;
    fetchController = new AbortController();
    const timeout = setTimeout(() => fetchController.abort(), 12000);
    try {
      const url = '/api/wishes' + (append && next ? `?before=${encodeURIComponent(next)}` : '');
      const data = await fetch(url, { signal: fetchController.signal, cache: 'no-store' }).then(readResponse);
      // Trang đầu là dữ liệu thật của máy chủ: bỏ bản ghi cũ đã bị xóa.
      if (!append) {
        const ids = new Set(data.wishes.map(wish => wish.id));
        const oldest = data.wishes.at(-1);
        for (const [id, wish] of entries) {
          const inPage = !data.next || !oldest || wish.createdAt > oldest.createdAt ||
            (wish.createdAt === oldest.createdAt && wish.id >= oldest.id);
          if (inPage && !ids.has(id)) {
            entries.delete(id);
            Array.from($('wish-wall').children).find(node => node.dataset.id === id)?.remove();
          }
        }
      }
      data.wishes.forEach((wish) => addWish(wish, loaded && !append));
      total = data.total;
      if (!refresh || entries.size <= 12) next = data.next;
      loaded = true; $('wish-load-error').hidden = true;
    } catch (error) {
      if (!refresh || !loaded) {
        $('wish-load-error').hidden = false;
        $('wish-load-error').querySelector('p').textContent = error.name === 'AbortError' ? 'Kết nối đang chậm. Bạn thử tải lại lời chúc nhé.' : connectionMessage(error);
      }
      if (!loaded) $('wish-total').textContent = 'Sổ lưu bút đang chờ kết nối';
    } finally {
      clearTimeout(timeout); loading = false;
      $('wish-wall').setAttribute('aria-busy', 'false');
      $('wish-load-more').disabled = false; $('wish-retry').disabled = false;
      if (loaded) syncStatus();
    }
  }
  form.addEventListener('input', (event) => {
    pendingId = null;
    if (composing || event.isComposing) return;
    validateVietnamese();
    if (!sending) { feedback.textContent = ''; feedback.className = 'wish-feedback'; }
  });
  const celebrate = () => {
    if (reduced.matches) return;
    const host = document.createElement('div'); host.className = 'wish-confetti'; host.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 24; i++) {
      const piece = document.createElement('i');
      piece.style.setProperty('--confetti-x', `${(Math.random() - .5) * 440}px`);
      piece.style.setProperty('--confetti-y', `${80 + Math.random() * 200}px`);
      piece.style.setProperty('--confetti-turn', `${Math.random() * 720}deg`);
      piece.style.animationDelay = `${Math.random() * 140}ms`; host.append(piece);
    }
    form.append(host); setTimeout(() => host.remove(), 2000);
  };
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (sending || composing) return;
    validateVietnamese();
    if (!form.reportValidity()) return;
    sending = true; $('wish-submit').disabled = true;
    $('wish-submit').querySelector('span').textContent = 'Đang gửi yêu thương…';
    feedback.textContent = ''; feedback.className = 'wish-feedback';
    pendingId ||= newId();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    nameField.readOnly = true; messageField.readOnly = true;
    try {
      const data = await fetch('/api/wishes', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ id: pendingId, name: vietnameseText(nameField.value), message: vietnameseText(messageField.value), website: $('wish-website').value }), signal: controller.signal }).then(readResponse);
      if (addWish(data.wish, true)) total++;
      loaded = true; syncStatus(); $('wish-load-error').hidden = true;
      messageField.value = ''; $('wish-count').textContent = '0 / 500'; pendingId = null;
      feedback.textContent = 'Đã gửi lời chúc. Cảm ơn bạn! ♡';
      feedback.classList.add('success'); celebrate();
      loadWishes({ refresh: true });
    } catch (error) {
      feedback.textContent = error.name === 'AbortError' ? 'Chưa nhận được xác nhận. Nội dung vẫn còn; bạn có thể bấm gửi lại.' : connectionMessage(error);
      feedback.classList.add('error');
    } finally {
      clearTimeout(timeout); sending = false; $('wish-submit').disabled = false;
      $('wish-submit').querySelector('span').textContent = 'Gửi lời chúc';
      nameField.readOnly = false; messageField.readOnly = false;
    }
  });
  $('wish-load-more').addEventListener('click', () => loadWishes({ append: true }));
  $('wish-retry').addEventListener('click', () => loadWishes());
  loadWishes();
  setInterval(() => { if (!document.hidden && !sending && loaded) loadWishes({ refresh: true }); }, 30000);
})();
