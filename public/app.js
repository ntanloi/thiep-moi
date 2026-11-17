(() => {
  'use strict';
  const event = window.GRADUATION;
  if (!event) return;
  const $ = (id) => document.getElementById(id);
  const textAll = (selector, text) => document.querySelectorAll(selector).forEach((node) => { node.textContent = text; });
  textAll('[data-full-name]', event.fullName);
  textAll('[data-short-name]', event.shortName);
  textAll('[data-school]', event.school);
  textAll('[data-year]', event.year);
  document.title = `Ngày mình tốt nghiệp · ${event.shortName}`;
  const guest = new URLSearchParams(location.search).get('guest');
  if (guest && guest.trim()) $('guest-name').textContent = guest.trim().slice(0, 80);
  const query = encodeURIComponent(event.mapsQuery || `${event.venue}, ${event.address}`);
  const routeUrl = `https://www.google.com/maps/dir/?api=1&destination=${query}&travelmode=driving`;
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
  document.querySelectorAll('[data-directions]').forEach((a) => { a.href = routeUrl; });
  document.querySelectorAll('[data-map-search]').forEach((a) => { a.href = mapUrl; });
  $('map-frame').src = `https://maps.google.com/maps?q=${query}&z=16&output=embed`;
  $('address').textContent = event.address;
  $('map-venue').textContent = event.venue;
  $('map-bottom-label').textContent = 'Cổng IUH · Tiếp tục đến Nhà E';
  if (event.venueConfirmed) {
    $('event-venue').textContent = event.venue;
    $('venue-status').textContent = event.address;
    $('location-note').textContent = 'Maps dẫn đến cổng IUH. Vào trường, hỏi bảo vệ lối đến Nhà E.';
  }
  if (event.meetingPoint) {
    $('arrival-meeting').textContent = 'Mốc nhận diện: Phòng Tài chính – Kế toán ở tầng trệt Nhà E.';
  }
  if (event.phone && /^[+\d\s().-]+$/.test(event.phone)) {
    $('contact-link').href = `tel:${event.phone.replace(/[^+\d]/g, '')}`;
    $('contact-link').hidden = false;
  }
  let toastTimer;
  function notify(message) {
    clearTimeout(toastTimer);
    $('toast').textContent = message;
    $('toast').classList.add('visible');
    toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3500);
  }
  async function copyText(value, message) {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(value);
      notify(message);
    } catch {
      $('copy-text').value = value;
      $('copy-dialog').showModal();
      $('copy-text').focus();
      $('copy-text').select();
    }
  }
  $('copy-address').addEventListener('click', () => copyText(`${event.venue}\n${event.address}`, 'Đã sao chép địa chỉ.'));
  $('share-button').addEventListener('click', async () => {
    const shareUrl = new URL(location.href);
    shareUrl.hash = '';
    const data = { title: `Thiệp mời tốt nghiệp · ${event.shortName}`, text: 'Thân mời bạn đến chung vui trong ngày mình tốt nghiệp!', url: shareUrl.href };
    try {
      if (navigator.share) await navigator.share(data);
      else await copyText(shareUrl.href, 'Đã sao chép liên kết thiệp mời.');
    } catch (error) {
      if (error.name !== 'AbortError') await copyText(shareUrl.href, 'Đã sao chép liên kết thiệp mời.');
    }
  });
  const start = event.start ? new Date(event.start) : null;
  if (!start || !Number.isFinite(start.getTime())) return;
  const zone = { timeZone: 'Asia/Ho_Chi_Minh' };
  const dateLabel = start.toLocaleDateString('vi-VN', { ...zone, day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeLabel = start.toLocaleTimeString('vi-VN', { ...zone, hour: '2-digit', minute: '2-digit', hour12: false });
  const weekday = start.toLocaleDateString('vi-VN', { ...zone, weekday: 'long' });
  $('event-date').textContent = dateLabel;
  $('event-time').textContent = `${weekday} · ${timeLabel} (giờ Việt Nam)`;
  $('card-date').textContent = `${timeLabel} · ${dateLabel}`;
  $('event-notice').textContent = event.venueConfirmed ? 'Hẹn gặp bạn trong ngày thật đặc biệt này.' : 'Ngày giờ đã có. Địa điểm buổi lễ cụ thể sẽ được xác nhận.';
  const calendarButton = $('calendar-button');
  calendarButton.disabled = false;
  calendarButton.removeAttribute('title');
  const utcStamp = (date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const icsEscape = (str) => String(str).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
  // RFC 5545 limits content lines to 75 UTF-8 octets, including continuation spaces.
  const foldLine = (line) => {
    const encoder = new TextEncoder();
    const output = []; let current = ''; let bytes = 0;
    for (const char of line) {
      const size = encoder.encode(char).length;
      if (bytes + size > 75) { output.push(current); current = ' '; bytes = 1; }
      current += char; bytes += size;
    }
    output.push(current); return output.join('\r\n');
  };
  calendarButton.addEventListener('click', () => {
    const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Truong Vu//Graduation Invitation//VI','CALSCALE:GREGORIAN','BEGIN:VEVENT',`UID:graduation-${utcStamp(start)}@truong-vu`, `DTSTAMP:${utcStamp(new Date())}`, `DTSTART:${utcStamp(start)}`];
    const end = event.end ? new Date(event.end) : null;
    if (end && Number.isFinite(end.getTime()) && end > start) lines.push(`DTEND:${utcStamp(end)}`);
    lines.push(`SUMMARY:${icsEscape(`Lễ tốt nghiệp · ${event.fullName}`)}`, `LOCATION:${icsEscape(event.venueConfirmed ? `${event.venue}, ${event.address}` : 'Địa điểm cụ thể đang chờ xác nhận')}`, `DESCRIPTION:${icsEscape(event.meetingPoint || 'Xem lại thiệp mời để cập nhật điểm hẹn.')}\\n${icsEscape(location.origin + location.pathname)}`, 'END:VEVENT', 'END:VCALENDAR');
    const objectUrl = URL.createObjectURL(new Blob([lines.map(foldLine).join('\r\n') + '\r\n'], {type: 'text/calendar;charset=utf-8'}));
    const download = document.createElement('a');
    download.href = objectUrl; download.download = 'Lich_tot_nghiep_Truong_Vu.ics';
    document.body.append(download); download.click(); download.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    notify('Đã tạo lịch. Mở tệp để thêm vào lịch của bạn.');
  });
  if (start <= new Date()) return;
  $('countdown').hidden = false;
  let interval;
  const tick = () => {
    const remaining = Math.max(0, Math.floor((start.getTime() - Date.now()) / 1000));
    const values = [Math.floor(remaining / 86400), Math.floor(remaining % 86400 / 3600), Math.floor(remaining % 3600 / 60), remaining % 60];
    ['days','hours','minutes','seconds'].forEach((id, index) => { $(id).textContent = String(values[index]).padStart(2, '0'); });
    if (!remaining) { $('countdown').hidden = true; if (interval) clearInterval(interval); }
  };
  tick(); interval = setInterval(tick, 1000);
})();
