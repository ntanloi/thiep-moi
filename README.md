# Thiệp tốt nghiệp Trường Vũ — HTML, CSS và JavaScript

Bản đầy đủ của mẫu thiệp Trần Lê Trường Vũ, IUH, Tòa E. Không dùng React, TypeScript hay dịch vụ có khóa API. Không cần chạy `npm install`.

## Mở và sử dụng

1. Cài **Node.js từ 22.13.0 trở lên** để có SQLite tích hợp.
2. Giải nén toàn bộ ZIP. Trên Windows, bấm đúp `MO_THIEP_WINDOWS.bat`.
3. Hoặc mở Terminal ngay trong thư mục có `package.json`, chạy:

   ```sh
   npm start
   ```

4. Mở **http://127.0.0.1:3000** trong trình duyệt. Giữ cửa sổ Terminal mở khi đang dùng. Nhấn Ctrl+C để dừng.

**Mở trực tiếp `public/index.html` chỉ xem được giao diện và hiệu ứng.** Gửi và đọc lời chúc cần máy chủ JavaScript đi kèm; đây là phần giúp lời chúc được lưu thật và dùng chung qua một địa chỉ web.

## Chức năng đã có

- Thiệp xanh đậm – kem – vàng, chữ rõ nét, font hỗ trợ tiếng Việt lưu sẵn trong `public/assets/`.
- Không có thanh header hay huy hiệu tròn TV.
- Mũ tốt nghiệp, bằng tốt nghiệp, vòng nguyệt quế; hiệu ứng lơ lửng, thiệp nghiêng và ánh sáng theo chuột, nút tương tác và thông tin xuất hiện khi cuộn.
- Giao diện tự đổi theo điện thoại và máy tính; hỗ trợ người bật giảm chuyển động.
- Google Maps đến cổng IUH, hướng dẫn tiếp đến Nhà E, sao chép địa chỉ.
- Biểu mẫu tiếng Việt có dấu, tương thích bộ gõ Telex/VNI và Unicode tổ hợp; tên tối đa 60 ký tự, lời chúc 3–500 ký tự sau chuẩn hóa.
- Lời chúc thật hiển thị bên dưới, lưu SQLite, tải thêm theo trang, cập nhật mỗi 30 giây khi mở trang. Không có lời chúc mẫu hay lời chúc kiểm thử cài sẵn.
- Giữ nội dung nếu gửi lỗi; gửi lại cùng lần gửi không tạo bản ghi trùng; giới hạn 15 giây giữa hai lời chúc từ cùng địa chỉ mạng.
- Nội dung lời chúc được hiển thị bằng `textContent`, không thực thi HTML người dùng nhập.
- **Quy tắc nội dung:** lời chúc (và tên hiển thị) không được chứa từ tục tĩu hoặc từ ngữ nói về tình yêu/thương yêu (yêu, thương, love, 爱, 사랑, trái tim ❤...), dưới mọi hình thức: viết tắt, không dấu, tách chữ, thay ký tự, kéo dài chữ, mọi ngôn ngữ. Kiểm tra ngay trên trình duyệt và kiểm tra lại bắt buộc ở máy chủ. Tên riêng như Thương, Ny, Mến vẫn được dùng ở ô tên. Xem mục "Quy tắc từ ngữ" bên dưới.
- Chia sẻ thiệp hoặc sao chép liên kết; lời mời theo tên người nhận bằng `?guest=...`.
- Đếm ngược và tải lịch `.ics` sau khi bạn điền ngày giờ chính thức.

## Sửa thông tin của bạn

Mở **`public/event-config.js`** bằng VS Code hoặc trình soạn thảo UTF-8.

- `fullName`, `shortName`: tên của bạn.
- `year`: năm tốt nghiệp.
- `start`: thời điểm bắt đầu theo định dạng `YYYY-MM-DDTHH:mm:ss+07:00`.
- `end`: giờ kết thúc cùng định dạng, có thể để trống.
- `venue`, `address`, `meetingPoint`: địa điểm và điểm hẹn.
- `phone`: số liên hệ, có thể để trống; khi có số hợp lệ sẽ hiện nút liên hệ.
- `mapsQuery`: cụm tìm kiếm Google Maps.

`start` và `end` hiện để trống vì chưa có lịch chính thức. Trang sẽ ghi “Sẽ thông báo”; đếm ngược và nút lưu lịch tự hoạt động khi `start` hợp lệ. Ví dụ trong chú thích là ví dụ cú pháp, không phải lịch thật.

Muốn thay nội dung cố định, sửa `public/index.html`; màu sắc, font và độ đậm sửa `public/style.css`. Nội dung chỉ đường chuyên cho IUH nằm trong cả `index.html` và `app.js`.

Ví dụ thiệp gửi riêng cho một người: mở `http://127.0.0.1:3000/?guest=Minh%20Anh`. Khi đã đưa lên máy chủ, thay phần địa chỉ bằng tên miền thật của bạn.

## Để bạn bè cùng gửi lời chúc

Bạn cần chạy gói này trên **một máy chủ có Node.js**, gắn một địa chỉ web mà mọi người truy cập được. Đưa riêng thư mục `public/` lên hosting HTML tĩnh sẽ không có API lưu lời chúc.

- Lệnh chạy: `npm start` hoặc `node server.js`.
- Dùng các biến môi trường do dịch vụ hosting cung cấp:

  | Biến | Mặc định | Tác dụng |
  | --- | --- | --- |
  | `HOST` | `127.0.0.1` | Đặt `0.0.0.0` khi hosting cần mở cổng ra ngoài. |
  | `PORT` | `3000` | Cổng máy chủ. |
  | `DATA_DIR` | Thư mục `data/` cạnh `server.js` | Đường dẫn lưu SQLite; dùng ổ đĩa bền vững của hosting. |
  | `TRUST_PROXY` | Tắt | Chỉ đặt `1` nếu reverse proxy của bạn ghi đè chính xác `X-Forwarded-For`. |

- Reverse proxy phải giữ header `Host` trùng tên miền khách đang mở. Nên phục vụ bằng HTTPS để chia sẻ và sao chép thuận tiện trên điện thoại.
- Giữ một tiến trình máy chủ và một thư mục dữ liệu chung. Gói này phù hợp thiệp cá nhân, không bao gồm hệ thống nhiều máy chủ.
- Khi máy chủ đang chạy và dữ liệu còn trên ổ đĩa, mọi người dùng cùng đường link sẽ thấy cùng danh sách lời chúc.
- Bản đồ cần Internet. Không cần khóa Google Maps riêng cho đường dẫn và iframe đang dùng.

Để thử trên điện thoại cùng Wi-Fi, chạy bằng PowerShell:

```powershell
$env:HOST="0.0.0.0"
npm start
```

Sau đó mở `http://DIA_CHI_IP_MAY_TINH:3000` trên điện thoại. Đây là địa chỉ mạng nội bộ; gửi bạn bè ở nơi khác cần triển khai lên hosting như phần trên.

## Lời chúc được lưu ở đâu?

Máy chủ tự tạo **`data/wishes.sqlite`** lần đầu chạy. Tắt rồi mở lại máy chủ vẫn giữ lời chúc. Không có bảng dữ liệu người dùng trong ZIP này.

Muốn sao lưu, dừng máy chủ rồi sao chép toàn bộ thư mục `data/`. Khi chuyển máy, dừng cả hai máy chủ rồi chuyển thư mục đó sang vị trí tương ứng. Khi hosting có ổ đĩa tạm, phải gắn ổ đĩa bền vững và đặt `DATA_DIR` đến ổ đó để tránh mất lời chúc lúc khởi động lại hoặc triển khai lại.

## Cấu trúc mã nguồn

```text
Thiep_tot_nghiep_Truong_Vu_Full/
  public/
    index.html        Giao diện thiệp, chỉ đường và sổ lưu bút
    style.css         Màu, font, bố cục, hiệu ứng và responsive
    event-config.js   Thông tin cá nhân và ngày giờ
    app.js            Bản đồ, chia sẻ, sao chép, đếm ngược, lịch
    experience.js     Chuyển động khi cuộn và tương tác chuột
    guestbook.js      Form tiếng Việt và danh sách lời chúc
    wish-filter.js    Quy tắc từ ngữ (chặn từ tục tĩu và từ về tình yêu)
    assets/           Font, biểu tượng và giấy phép font
  server.js           Máy chủ JavaScript và API SQLite
  package.json        Lệnh khởi động và kiểm tra
  MO_THIEP_WINDOWS.bat
  tests/              Kiểm tra độc lập bằng dữ liệu tạm
  README.md
```

Chạy `npm test` nếu muốn kiểm tra API. Các bài kiểm tra dùng thư mục tạm và không ghi vào sổ lưu bút thật.

## Quy tắc từ ngữ trong lời chúc

- Toàn bộ nằm trong **`public/wish-filter.js`** (một file dùng chung cho trình duyệt, `server.js` và `api/wishes.js`). Muốn thêm hoặc bớt từ, sửa các danh sách trong phần `LEXICON`, rồi chạy `npm test`.
- Bị chặn: từ tục tĩu, chửi thề, tình dục, lăng mạ nặng; từ nói về tình yêu như yêu, thương, iu, ny, love, luv, ily, amor, 爱, 사랑...; trái tim ❤ ♡ 💕, `<3`; mã số tình yêu như 520.
- Nhận diện cả: viết hoa/thường, không dấu, tách chữ (`l o v e`, `c.ặ.c`), thay ký tự (`l0ve`, `sh!t`, `f*ck`), kéo dài chữ (`yêuuuu`), chữ giống nhau của bảng chữ cái khác, và nhiều ngôn ngữ.
- Từ tiếng Việt chỉ bị chặn đúng dấu: `thương` bị chặn nhưng `thường`, `thượng` thì không; `yêu` bị chặn nhưng `yếu` thì không. Riêng bản **không dấu** (`thuong`, `yeu`, `buoi`, `cac`, `lon`...) không phân biệt được nên bị chặn; người dùng chỉ cần gõ có dấu.
- Ô **tên** được phép dùng tên riêng `Thương`, `Ny`, `Mến`.
- Thông báo lỗi không nêu từ vi phạm. Máy chủ trả mã 400 và lời chúc không được lưu.
- Danh sách không thể đầy đủ mãi mãi; nếu gặp từ lọt qua, thêm từ đó vào `LEXICON`.

## Đưa lên Vercel (có sổ lưu bút)

- `public/` là giao diện; `api/wishes.js` là sổ lưu bút chạy trên Vercel, lưu vào Upstash Redis.
- `vercel.json` chỉ định Vercel phục vụ `public/`, đặt máy chủ ở Singapore (`sin1`) và thêm các header bảo mật.
- `server.js` + SQLite chỉ dùng khi chạy trên máy bạn (`npm start`); Vercel bỏ qua file này.
- Cần 2 biến môi trường trên Vercel: `UPSTASH_REDIS_REST_URL` và `UPSTASH_REDIS_REST_TOKEN`
  (hoặc `KV_REST_API_URL` và `KV_REST_API_TOKEN`; Vercel tự thêm khi bạn kết nối Upstash).
- Sau khi thêm biến môi trường, phải **Redeploy** để có hiệu lực.
- Kiểm thử: `npm test` (không cần Redis thật).
