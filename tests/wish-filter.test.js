import test from 'node:test';
import assert from 'node:assert/strict';
import { checkText, checkWish } from '../public/wish-filter.js';

const blocked = (list, options) => {
  for (const text of list) assert.equal(checkText(text, options).ok, false, `Phải chặn: ${JSON.stringify(text)}`);
};
const allowed = (list, options) => {
  for (const text of list) assert.equal(checkText(text, options).ok, true, `Không được chặn nhầm: ${JSON.stringify(text)}`);
};

test('Chặn từ tục tĩu tiếng Việt, viết tắt, không dấu, tách chữ, thay ký tự, kéo dài chữ', () => {
  blocked([
    'Cặc', 'kẹc', 'lol', 'LOL', 'lồn', 'cailon', 'cai lon', 'caideoma', 'cái đéo mà', 'đụ má mày', 'địt mẹ', 'ditme', 'dit me',
    'd.i.t m.e', 'đ m', 'đm', 'dcm', 'vcl', 'vl', 'vui vl', 'l ồ n', 'đ*t', 'c*c', 'l*n', 'cặc cặc', 'l0l', 'đ!t', 'c-ặ-c',
    'Chúc bạn thành công, địt mẹ nó', 'concac', 'cmn', 'cc', 'địtttt', 'đéo'
  ]);
});

test('Chặn từ tục tĩu tiếng nước ngoài', () => {
  blocked([
    'fuck', 'F U C K', 'f*ck', 'f**k', 'fuuuuck', 'sh1t', 'b!tch', 'fvck', 'wtf', 'stfu', 'p0rn', 'sex', 'S.E.X', 'asshole', 'motherfucker',
    'хуй', 'блять', 'сука', 'пизда', 'cуka', '操你妈', '他妈的', '傻逼', '씨발', '좆', 'ควย', 'putain', 'merde', 'scheisse', 'cazzo',
    'mierda', 'puta', 'kontol', 'anjing', 'orospu', 'siktir', 'chutiya', 'madarchod', 'caonima'
  ]);
});

test('Chặn mọi từ nói về tình yêu và thương yêu, kể cả viết tắt', () => {
  blocked([
    'Yêu', 'yêu', 'yeu', 'YÊU', 'y e u', 'y.ê.u', 'yêuuuu', 'y3u', 'iu', 'iuuu', 'em iu anh', 'Thương', 'thương', 'thuong', 'thương yêu',
    'yêu thương', 'tình yêu', 'tinh yeu', 'người yêu', 'nguoi yeu', 'ny', 'nyc', 'thả thính', 'tỏ tình', 'hẹn hò', 'lãng mạn',
    'Chúc bạn thành công và hạnh phúc, thương lắm', 'Chúc Vũ tốt nghiệp, yêu đời nhé'
  ]);
  blocked([
    'love', 'LOVE', 'l0ve', 'l o v e', 'l.o.v.e', 'loooove', 'luv', 'i love you', 'iloveyou', 'ily', 'kiss', 'crush', 'bae', 'romantic', 'lovely',
    'te amo', 'te quiero', 'amor', "je t'aime", 'jtm', 'ich liebe dich', 'Liebe', 'ti amo', 'я тебя люблю', 'любовь', 'люблю',
    '爱你', '我爱你', '愛', '사랑해', '사랑', '愛してる', '大好き', 'รักนะ', 'cinta', 'sayang', 'aku cinta kamu', 'mahal kita', 'pyar',
    'प्यार', 'ishq', 'aşk', 'seviyorum', 'habibi', 'أحبك', 'אהבה', 'αγάπη', 'saranghae', 'woaini', 'wo ai ni', '5201314', '520'
  ]);
});

test('Chặn trái tim, mặt yêu và dấu <3', () => {
  blocked(['<3', '❤️', '♡', '💕', '😍', '😘', '🥰', 'Chúc vui nhé ♥', 'Chúc vui nhé 💖']);
});

test('Không chặn nhầm lời chúc bình thường (có dấu, không dấu, nhiều ngôn ngữ)', () => {
  allowed([
    'Chúc Vũ tốt nghiệp thật vui! 🎓', 'Chúc mừng bạn tốt nghiệp, chúc bạn luôn thành công và hạnh phúc.', 'Hẹn gặp ở Tòa E nhé.',
    'Chúc bạn thường xuyên gặp may mắn', 'Chúc bạn thượng lộ bình an, thưởng thức thành quả', 'Chúc các bạn một ngày thật tuyệt vời!',
    'Chúc bạn lớn nhanh, ngày càng lớn mạnh', 'Buổi lễ tốt nghiệp thật ý nghĩa', 'Điểm số cao', 'Tình bạn đẹp', 'Tình nguyện viên',
    'Nhiệt tình giúp đỡ', 'Yếu đuối cũng không sao', 'Đeo mũ tốt nghiệp thật đẹp', 'Dẻo dai, đeo kính', 'Dũng cảm bước tiếp',
    'du lich du hoc thanh cong', 'chuc mung tot nghiep nhe', 'chuc ban thanh cong', 'Chuc ban thanh cong tren con duong moi',
    'Congratulations on your graduation!', 'Wishing you all the best', 'Summa cum laude', 'Class of 2026', 'Glove', 'Assessment complete',
    'Scunthorpe', 'Bass guitar', 'Classic', 'Cocktail', 'Dickens', 'Pass, class, glass, assess, assume', 'Hello world',
    'Felicidades por tu graduación', 'Félicitations', 'Herzlichen Glückwunsch', 'Поздравляю с выпуском', '祝你毕业快乐', '졸업 축하해요',
    '卒業おめでとう', 'Selamat lulus', 'Phòng A1 lúc 8h30 ngày 20/11', 'Nhớ mang theo CCCD nhé', 'MC dẫn chương trình'
  ]);
});

test('Từ không dấu có thể trùng từ cấm bị chặn; bản có dấu đúng nghĩa vẫn được dùng', () => {
  // "buoi", "cac", "thuong" không dấu không phân biệt được với từ cấm nên bị chặn, người dùng thêm dấu là gửi được.
  blocked(['buoi le', 'chuc cac ban', 'thuong xuyen']);
  allowed(['buổi lễ', 'chúc các bạn', 'thường xuyên']);
});

test('Ô tên cho phép tên riêng như Thương, Ny, Mến nhưng vẫn chặn từ cấm', () => {
  allowed(['Nguyễn Thị Thương', 'Nguyen Thi Thuong', 'Phương Ny', 'Mến', 'Trần Văn Dũng', 'Lê Quang Huy'], { name: true });
  blocked(['Yêu Em', 'Địt Mẹ', 'Love', 'Thương Yêu', 'fuck bạn', '❤ Vũ'], { name: true });
  // Từ "thương" không được dùng trong lời chúc dù được dùng làm tên.
  assert.equal(checkWish({ name: 'Thị Thương', message: 'Chúc bạn thành công' }).ok, true);
  assert.equal(checkWish({ name: 'Thị Thương', message: 'Thương bạn nhiều' }).ok, false);
});

test('Thông báo lỗi không nêu ra từ vi phạm', () => {
  const result = checkWish({ name: 'Bạn', message: 'địt mẹ' });
  assert.equal(result.ok, false);
  assert.equal(result.field, 'message');
  assert.doesNotMatch(result.error, /địt|mẹ/i);
});
