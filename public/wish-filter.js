/**
 * Bộ lọc từ ngữ cho sổ lưu bút.
 *
 * QUY TẮC: lời chúc (và tên hiển thị) KHÔNG được chứa
 *   1) từ tục tĩu, chửi thề, từ nhạy cảm về tình dục, lời lăng mạ nặng;
 *   2) từ ngữ nói về tình yêu / thương yêu (yêu, thương, love, 爱, 사랑, ...), kể cả trái tim.
 * Áp dụng cho MỌI ngôn ngữ, viết tắt, viết không dấu, tách chữ, thay ký tự, kéo dài chữ.
 *
 * File này là một ES module dùng chung:
 *   - server.js (SQLite) và api/wishes.js (Vercel) import để kiểm tra bắt buộc;
 *   - guestbook.js nạp bằng import() để báo lỗi ngay trên trình duyệt.
 * Muốn thêm/bớt từ: sửa các danh sách trong phần "TỪ ĐIỂN" bên dưới, rồi chạy `npm test`.
 */

/* ============================== TỪ ĐIỂN ============================== */
/*
 * Cách ghi:
 *   strict : so khớp CẢ TỪ, nhạy dấu. "thương" chỉ khớp "thương" hoặc "thuong" (không dấu),
 *            KHÔNG khớp "thường", "thượng". Dùng cho từ tiếng Việt dễ trùng khi bỏ dấu.
 *            Tiền tố "~" = chỉ khớp bản có dấu (bản không dấu trùng từ lành như "cut", "men").
 *   word   : so khớp CẢ TỪ, không phân biệt dấu (chữ Latin).
 *   loose  : tìm trong chuỗi đã dán liền (bắt "cailon", "ditmemay", "i love you"...). Chỉ dùng
 *            cho từ đủ đặc trưng để không bắt nhầm từ lành.
 *   phrase : cụm từ, từng từ so khớp kiểu strict.
 *   sub    : chữ Hán, Nhật, Hàn, Thái... tìm theo chuỗi con (các chữ này không chia từ bằng dấu cách).
 *   nword  : từ nguyên chữ gốc (Ả Rập, Do Thái, Hy Lạp, Devanagari...), so khớp cả từ.
 *   npre   : tiền tố nguyên chữ gốc (Cyrillic) vì tiếng Nga biến cách nhiều.
 *   lpre   : tiền tố chữ Latin (phiên âm tiếng Nga...).
 */
const LEXICON = {
  vulgar: {
    strict: [
      // Tiếng Việt – và các dạng viết tắt phổ biến
      'địt', 'đít', 'đit', 'đjt', 'dịt', '~đụ', 'đéo', 'đếch', 'cặc', 'cặk', 'kẹc', 'kẹk', 'buồi', 'lồn', 'lôn', 'lìn',
      'đm', 'đmm', 'đcm', 'đkm', 'đcmm', 'đcl', 'đcmn', 'dm', 'dmm', 'dcm', 'dkm', 'dcl', 'vcl', 'vkl', 'vl', 'vcc',
      'clgt', 'cmm', 'cmn', 'cmnr', 'clm', 'cc', 'lol', 'lolz', 'loz', 'lz',
      '~đĩ', '~điếm', '~cứt', '~ỉa', '~đái', '~dái', '~chịch', '~nứng', '~dâm đãng',
      'địch mẹ', 'đjt mẹ',
      // Tình dục, lăng mạ nặng
      'đụ má', 'sex', 'sexy', 'xxx', 'porn', 'porno', 'thủ dâm', 'hiếp dâm', 'mại dâm', 'dương vật', 'âm đạo', 'âm hộ',
      'súc vật', 'súc sinh', 'khốn nạn', 'mất dạy', 'óc chó'
    ],
    word: [
      // Tiếng Anh
      'fuck', 'fucks', 'fucked', 'fucker', 'fuckin', 'fucking', 'fck', 'fuk', 'fuq', 'fvck', 'fcuk', 'phuck', 'effing',
      'shit', 'shits', 'shitty', 'sht', 'bitch', 'bitches', 'bastard', 'bastards', 'asshole', 'assholes', 'arsehole', 'arse', 'ass', 'asses',
      'dumbass', 'jackass', 'dick', 'dicks', 'dickhead', 'cock', 'cocks', 'pussy', 'pussies', 'cunt', 'cunts', 'twat', 'wank', 'wanker',
      'wankers', 'bollocks', 'bugger', 'piss', 'pissed', 'pissing', 'prick', 'douche', 'douchebag', 'skank', 'slut', 'sluts', 'slutty',
      'whore', 'whores', 'hoe', 'milf', 'fap', 'jizz', 'sperm', 'semen', 'penis', 'vagina', 'clit', 'clitoris', 'orgasm', 'horny',
      'boob', 'boobs', 'tit', 'tits', 'titty', 'titties', 'dildo', 'blowjob', 'handjob', 'anal', 'nude', 'nudes', 'naked',
      'sexting', 'sext', 'sexual', 'sexually', 'sexe', 'wtf', 'stfu', 'gtfo', 'omfg', 'fml', 'kys', 'retard', 'retarded', 'retards',
      'nigger', 'niggers', 'nigga', 'niggas', 'faggot', 'faggots', 'fag', 'fags', 'tranny', 'chink', 'kike', 'spic', 'paki',
      // Tây Ban Nha / Bồ Đào Nha
      'puta', 'puto', 'putas', 'putos', 'mierda', 'joder', 'jodete', 'cabron', 'cabrón', 'pendejo', 'pendeja', 'verga', 'chingar',
      'chingada', 'chingado', 'culero', 'coño', 'carajo', 'hijueputa', 'hdp', 'ctm', 'ptm', 'concha', 'polla', 'gilipollas', 'maricon',
      'caralho', 'foda', 'foder', 'porra', 'buceta', 'viado', 'cacete', 'filhodaputa', 'vsf', 'pqp',
      // Pháp
      'merde', 'putain', 'ptn', 'connard', 'connasse', 'salope', 'enculé', 'encule', 'enculer', 'niquer', 'nique', 'ntm', 'fdp',
      'couille', 'couilles', 'batard', 'bâtard', 'foutre',
      // Đức
      'scheisse', 'scheiße', 'scheiss', 'arschloch', 'fotze', 'wichser', 'hurensohn', 'schlampe', 'ficken', 'fick', 'ficker',
      // Ý
      'cazzo', 'merda', 'vaffanculo', 'stronzo', 'stronza', 'puttana', 'troia', 'minchia', 'figa', 'coglione', 'culo', 'porcodio',
      // Nga (phiên âm)
      'blyat', 'blyad', 'blyatb', 'suka', 'cyka', 'pizda', 'pizdec', 'nahuy', 'nahui', 'ebat', 'ebal', 'eblan', 'mudak', 'pidor',
      'pidar', 'pidr', 'gavno', 'zalupa',
      // Indonesia / Malaysia / Philippines / Ấn Độ / Thổ Nhĩ Kỳ / Ả Rập (phiên âm)
      'kontol', 'memek', 'ngentot', 'jancok', 'jancuk', 'bangsat', 'anjing', 'bajingan', 'goblok', 'asu', 'puki', 'pukimak',
      'putangina', 'tangina', 'gago', 'tarantado', 'pakyu', 'kantot',
      'chutiya', 'madarchod', 'behenchod', 'bhenchod', 'bhosdi', 'bhosdike', 'gand', 'gaand', 'lund', 'randi', 'harami', 'saala',
      'orospu', 'siktir', 'amk', 'aq', 'yarrak', 'amcik', 'pezevenk', 'ibne', 'sik', 'sikik', 'sharmouta', 'sharmuta', 'kosomak',
      // Trung / Nhật / Hàn (phiên âm)
      'caonima', 'cnm', 'nmsl', 'tmd', 'shabi', 'shab', 'jiba', 'wocao', 'tamade', 'tamadi', 'kuso', 'chikusho', 'chinko', 'manko',
      'ssibal', 'sibal', 'ssival', 'gaesaekki', 'gaesekki', 'byungshin', 'byeongsin', 'jiral', 'jotna'
    ],
    loose: [
      'fuck', 'shit', 'bitch', 'bastard', 'asshole', 'cocksuck', 'dickhead', 'pussy', 'whore', 'slut', 'nigger', 'nigga', 'faggot',
      'motherfuck', 'bullshit', 'masturbat', 'dildo', 'blowjob', 'handjob', 'bollocks', 'porn', 'vaffanculo', 'hurensohn',
      'cailon', 'caideoma', 'caiditme', 'ditme', 'ditmemay', 'ditconme', 'ditcume', 'dumemay', 'dumamay', 'concac', 'conkec',
      'conlon', 'deomay', 'deoma', 'deome', 'ditmay', 'phimsex', 'chatsex',
      'caonima', 'tamade', 'sharmouta', 'putamadre', 'hijodeputa', 'hijueputa', 'filhodaputa', 'sonofabitch'
    ],
    phrase: [
      ['địt', 'mẹ'], ['địt', 'con'], ['địt', 'cụ'], ['địt', 'bà'], ['đụ', 'mẹ'], ['đụ', 'mày'], ['đụ', 'má'],
      ['con', 'cặc'], ['cái', 'cặc'], ['cái', 'lồn'], ['con', 'lồn'], ['cái', 'đéo'], ['đéo', 'mẹ'], ['đéo', 'má'], ['đéo', 'biết'],
      ['vãi', 'lồn'], ['vãi', 'cặc'], ['vãi', 'lìn'], ['vãi', 'đái'], ['bú', 'cu'], ['bú', 'cặc'], ['bú', 'buồi'], ['bú', 'lồn'],
      ['liếm', 'lồn'], ['liếm', 'cặc'], ['làm', 'tình'], ['phim', 'sex'], ['gái', 'gọi'], ['chó', 'đẻ'], ['chó', 'chết'], ['đồ', 'chó'],
      ['mẹ', 'mày'], ['mẹ', 'kiếp'], ['con', 'mẹ', 'nó'], ['nứng', 'lồn'], ['chich', 'nhau'], ['son', 'of', 'a', 'bitch'],
      ['son', 'of', 'bitch'], ['mother', 'fucker'], ['hijo', 'de', 'puta'], ['hija', 'de', 'puta'], ['hijo', 'de', 'tu', 'madre'],
      ['puta', 'madre'], ['filho', 'da', 'puta'], ['fils', 'de', 'pute'], ['va', 'te', 'faire'], ['jerk', 'off'], ['suck', 'my'],
      ['blow', 'job'], ['hand', 'job'], ['cao', 'ni', 'ma'], ['ta', 'ma', 'de'], ['ni', 'ma', 'si', 'le'], ['gan', 'ni', 'niang']
    ],
    sub: [
      // Trung
      '操你', '肏', '他妈的', '他媽的', '妈的', '媽的', '傻逼', '傻屄', '鸡巴', '雞巴', '屌', '艹', '尼玛', '你妈', '你媽', '我操',
      '我草', '卧槽', '臥槽', '草泥马', '草泥馬', '婊子', '贱人', '賤人', '骚货', '騷貨', '干你娘', '幹你娘', '干你妈', '幹你媽', '日你',
      // Nhật
      'くそ', 'クソ', 'ちんこ', 'チンコ', 'まんこ', 'マンコ', 'ちんぽ', 'チンポ', '死ね', 'しね', 'ふぁっく', 'ファック',
      // Hàn
      '씨발', '시발', '씨팔', '시팔', '좆', '개새끼', '병신', '지랄', 'ㅅㅂ', 'ㅆㅂ', 'ㅂㅅ', 'ㅈㄹ', '씹새', '씹할',
      // Thái
      'ควย', 'เหี้ย', 'เย็ด', 'สัส', 'ไอ้สัตว์', 'หำ'
    ],
    nword: [
      // Ả Rập, Do Thái, Hy Lạp, Hindi
      'شرموطة', 'شرموطه', 'منيك', 'منيوك', 'قحبة', 'قحبه', 'عاهرة', 'كسمك', 'كس', 'زب', 'ابن الكلب',
      'זונה', 'שרמוטה', 'כוס', 'זין', 'בן זונה',
      'πούτσα', 'πουτσα', 'γαμώ', 'γαμω', 'μαλάκας', 'μαλακας', 'πούστης', 'πουστης', 'γαμημένος', 'γαμημενος',
      'चूतिया', 'मादरचोद', 'बहनचोद', 'भोसड़ी', 'भोसडीके', 'लंड', 'रंडी', 'गांड', 'हरामी', 'कुत्ता', 'साला'
    ],
    npre: [
      'хуй', 'хуе', 'хуя', 'хуи', 'хуев', 'хуёв', 'нахуй', 'нахер', 'похуй', 'охуе', 'охуи', 'пизд', 'бляд', 'блят', 'блять', 'бля',
      'ебат', 'ебан', 'ебал', 'ебну', 'ебуч', 'ебёт', 'ебет', 'заеб', 'уеб', 'долбоеб', 'долбоёб', 'сука', 'суки', 'сучк', 'сучар',
      'мудак', 'мудил', 'пидор', 'пидар', 'пидр', 'говн', 'залуп', 'жопа', 'жопу', 'шлюх', 'гандон',
      'їбат', 'йоб', 'курва', 'сран', 'срак'
    ],
    lpre: []
  },
  love: {
    strict: [
      // Tiếng Việt
      'yêu', 'iu', 'thương', 'ny', 'nyc', '~mến', '~ghệ',
      // Viết tắt, tiếng lóng quốc tế
      'crush', 'bae', 'babe', 'luv', 'ily', 'ilu', 'ilysm', 'ily2', 'ilyt', 'muah', 'mwah', 'xoxo'
    ],
    word: [
      // Tiếng Anh
      'love', 'loved', 'loves', 'lover', 'lovers', 'loving', 'lovely', 'lovable', 'lovin', 'lovey', 'lov', 'lub', 'lurve', 'luvs',
      'luvv', 'luvu', 'luvya', 'loveu', 'loveyou', 'iloveu', 'iloveyou', 'iluvu', 'ilovu', 'ilovyou', 'luvyou', 'mylove', 'myluv',
      'adore', 'adores', 'adored', 'adoring', 'adoration', 'sweetheart', 'sweetie', 'darling', 'beloved', 'soulmate', 'soulmates',
      'romance', 'romantic', 'romantically', 'crushes', 'kiss', 'kisses', 'kissing', 'kissed', 'boyfriend', 'girlfriend', 'bf', 'gf',
      'valentine', 'valentines', 'infatuated', 'infatuation', 'affection', 'passion', 'passionate',
      // Tây Ban Nha / Bồ Đào Nha / Ý
      'amor', 'amar', 'amo', 'amore', 'amour', 'amoureux', 'amoureuse', 'amote', 'teamo', 'tamo', 'tiamo', 'tequiero', 'teadoro',
      'euteamo', 'tivogliobene', 'cariño', 'querido', 'querida', 'enamorado', 'enamorada', 'innamorato', 'innamorata', 'apaixonado',
      'apaixonada',
      // Pháp
      'aimer', 'jaime', 'taime', 'jtm', 'jetaime', 'jtaime', 'chéri', 'chérie',
      // Đức, Hà Lan, Bắc Âu
      'liebe', 'lieben', 'liebling', 'liebste', 'geliebte', 'ild', 'ichliebedich', 'liefde', 'houvanjou',
      'älskar', 'kärlek', 'elsker', 'kjærlighet', 'kaerlighed', 'kjaerlighet', 'alskar', 'karlek',
      // Slav, Rumani, Hungary, Phần Lan
      'kocham', 'kochanie', 'miłość', 'milosc', 'miluji', 'miluju', 'iubesc', 'iubire', 'dragoste', 'teiubesc', 'szeretlek', 'szerelem',
      'rakastan', 'rakkaus',
      // Nga (phiên âm)
      'lyublyu', 'lyubov', 'lubov', 'lublyu', 'lyubimaya', 'lyubimyy', 'lyubimiy',
      // Indonesia / Malaysia / Philippines / Swahili
      'cinta', 'cintaku', 'mencintai', 'tercinta', 'sayang', 'sayangku', 'kekasih', 'iniibig', 'minamahal', 'pagibig', 'mahalkita',
      'nakupenda', 'mapenzi',
      // Ấn Độ, Thổ Nhĩ Kỳ, Ả Rập, Hy Lạp, Do Thái, Hàn, Nhật, Trung (phiên âm)
      'pyar', 'pyaar', 'pyara', 'ishq', 'ishk', 'mohabbat', 'mohabat',
      'seviyorum', 'sevgi', 'sevgili', 'aşkım', 'askim', 'aşk',
      'habibi', 'habibti', 'habibty', 'ahebak', 'ahebbak', 'uhibbuka', 'uhibbuki', 'eshgh', 'doostdaram',
      'sagapo', 'agapi', 'agapo', 'agapw', 'ahava',
      'saranghae', 'saranghaeyo', 'saranghaeo', 'sarangheyo', 'borahae', 'saranghanda',
      'aishiteru', 'aishiteiru', 'daisuki', 'woaini', 'aini', 'wuaini',
      // Mã số tình yêu
      '520', '521', '5201314'
    ],
    loose: [
      'iloveyou', 'iloveu', 'luvyou', 'loveyou', 'ilovyou', 'ilysm', 'tinhyeu', 'nguoiyeu', 'yeuthuong', 'thuongyeu', 'thuongnhau',
      'yeunhau', 'yeuemnhieu', 'tequiero', 'jetaime', 'jtaime', 'ichliebedich', 'tivogliobene', 'teadoro', 'euteamo', 'houvanje',
      'saranghae', 'aishiteru', 'woaini', 'lyublyu', 'lyubov', 'ahebbak', 'uhibbuka', 'seniseviyorum', 'tiamo', 'aimetoujours'
    ],
    phrase: [
      ['tình', 'yêu'], ['tình', 'ái'], ['ái', 'tình'], ['ái', 'ân'], ['tình', 'nhân'], ['tình', 'tứ'], ['mối', 'tình'], ['si', 'tình'],
      ['đa', 'tình'], ['tương', 'tư'], ['say', 'đắm'], ['đắm', 'đuối'], ['si', 'mê'], ['tỏ', 'tình'], ['thả', 'thính'], ['hẹn', 'hò'],
      ['lãng', 'mạn'], ['nụ', 'hôn'], ['người', 'yêu'], ['trái', 'tim', 'yêu'], ['tình', 'iu'], ['nguoi', 'iu'],
      ['i', 'love'], ['in', 'love'], ['fall', 'in', 'love'], ['make', 'love'], ['true', 'love'], ['my', 'love'],
      ['te', 'amo'], ['te', 'quiero'], ['te', 'adoro'], ['mi', 'amor'], ['ti', 'amo'], ['ti', 'voglio', 'bene'], ['eu', 'te', 'amo'],
      ['je', 't', 'aime'], ['je', 'taime'], ['je', 't', 'adore'], ['ich', 'liebe', 'dich'], ['hou', 'van', 'je'], ['ik', 'hou', 'van'],
      ['seni', 'seviyorum'], ['wo', 'ai', 'ni'], ['ai', 'ni'], ['ya', 'tebya', 'lyublyu'], ['aku', 'cinta', 'kamu'], ['mahal', 'kita'],
      ['saya', 'cinta'], ['ana', 'behebak'], ['ani', 'ohev'], ['s', 'agapo'], ['je', 'taime']
    ],
    sub: [
      '爱', '愛', '恋', '戀', '喜欢', '喜歡', '好き', '大好き', '愛してる', '사랑', '좋아해', '좋아하', 'รัก'
    ],
    nword: [
      'حب', 'حبي', 'حبيبي', 'حبيبتي', 'أحبك', 'احبك', 'بحبك', 'عشق', 'عشقي', 'دوستت', 'אהבה', 'אוהב', 'אוהבת', 'אהבתי', 'אהובי',
      'αγάπη', 'αγαπη', 'αγαπώ', 'αγαπω', 'αγαπάω', 'αγαπαω', 'प्यार', 'प्रेम', 'इश्क', 'इश्क़', 'मोहब्बत', 'любов',
      'любовь', 'любви', 'любовью', 'люблю', 'любишь', 'любит', 'любим', 'любимый', 'любимая', 'любимое', 'любимые', 'кохаю', 'кохання'
    ],
    npre: ['любов', 'любим', 'люблю', 'любит', 'любл', 'влюбл', 'кохан', 'кохаю', 'обожа'],
    lpre: ['lyubov', 'lyublyu', 'lyubim', 'lubov', 'lublyu', 'saranghae', 'borahae']
  }
};

// Từ vốn là TÊN NGƯỜI phổ biến: được phép trong ô "Tên của bạn" (không được phép trong lời chúc).
const NAME_ALLOWED = new Set(['thương', 'ny', 'mến']);

// Biểu tượng tình yêu: trái tim, mặt yêu, hôn... và dạng "<3".
const LOVE_SYMBOLS = /[♡♥❤❣❥❦❧💓💔💕💖💗💘💙💚💛💜💝💞💟🧡🤍🤎🖤🩷🩵🩶💌💑💏😍🥰😘😗😙😚😻😽💋🫶]|<\/?3|&lt;\/?3|&#?(?:9829|10084|128149|128150|128151|128152);?/u;

/* ============================== CHUẨN HOÁ ============================== */

const FOLD_EXTRA = { đ: 'd', ð: 'd', ø: 'o', ł: 'l', ß: 'ss', æ: 'ae', œ: 'oe', ı: 'i', þ: 'th' };
const nfc = (s) => s.normalize('NFC');
const fold = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').replace(/[đðøłßæœıþ]/gu, (c) => FOLD_EXTRA[c]);

// Chữ Cyrillic/Hy Lạp giống chữ Latin (dùng để lách luật).
const HOMOGLYPH = {
  а: 'a', в: 'b', с: 'c', е: 'e', н: 'h', к: 'k', м: 'm', о: 'o', р: 'p', т: 't', у: 'y', х: 'x', і: 'i', ѕ: 's', ј: 'j', ѡ: 'w',
  α: 'a', β: 'b', ε: 'e', ι: 'i', κ: 'k', ν: 'v', ο: 'o', ρ: 'p', τ: 't', υ: 'u', χ: 'x', ϲ: 'c'
};
const homoglyph = (s) => s.replace(/[авсенкморутхіѕјѡαβειкνορτυχϲ]/gu, (c) => HOMOGLYPH[c] ?? c);

const LEET = { 0: 'o', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's', '!': 'i', '|': 'l', '€': 'e', '¡': 'i', '£': 'l' };
const LEET_CHARS = /[013457@$!|€¡£]/gu;
const leetOnce = (s, one) => s.replace(LEET_CHARS, (c) => (c === '1' ? one : LEET[c] ?? c));
const hasLeet = (s) => /[013457@$!|€¡£]/u.test(s) && /\p{L}/u.test(s);

const collapse3 = (s) => s.replace(/(.)\1{2,}/gu, '$1');
const collapse3to2 = (s) => s.replace(/(.)\1{2,}/gu, '$1$1');
const collapseAll = (s) => s.replace(/(.)\1+/gu, '$1');

/** Chuẩn bị: NFKC (chữ rộng, chữ đậm toán học...), bỏ ký tự vô hình, chữ thường, NFC. */
function prepare(text) {
  return nfc(
    String(text)
      .normalize('NFKC')
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/[\p{Cf}\p{Cc}­ㅤᅟᅠ]/gu, '')
      .toLowerCase()
  );
}

/** a (từ trong văn bản, đã dạng biến thể) có "bằng" e (từ trong từ điển) không, cho phép kéo dài chữ. */
function same(a, e, eCollapsed) {
  if (a === e) return true;
  if (a.length < 2) return false;
  if (collapse3(a) === e || collapse3to2(a) === e) return true;
  // Gộp mọi chữ lặp chỉ an toàn khi từ gốc không có chữ đôi (tránh "assess" bị nhầm với "asses").
  if (eCollapsed === e && collapseAll(a) === e) return true;
  return false;
}

/* ============================== BIÊN DỊCH TỪ ĐIỂN ============================== */

function compileEntries(list, category) {
  return list.map((raw) => {
    const accentOnly = raw.startsWith('~');
    const text = nfc(accentOnly ? raw.slice(1) : raw);
    const f = fold(text);
    return {
      category, accent: text, folded: f, foldedCollapsed: collapseAll(f), accentCollapsed: collapseAll(text),
      accentOnly, nameOk: NAME_ALLOWED.has(text) || NAME_ALLOWED.has(f)
    };
  });
}
function compilePhrases(list, category) {
  return list.map((parts) => ({ category, parts: parts.map((p) => {
    const text = nfc(p);
    return { accent: text, folded: fold(text), foldedCollapsed: collapseAll(fold(text)) };
  }) }));
}
const compiled = { strict: [], word: [], loose: [], phrase: [], sub: [], nword: [], npre: [], lpre: [] };
for (const [category, groups] of Object.entries(LEXICON)) {
  compiled.strict.push(...compileEntries(groups.strict, category));
  compiled.word.push(...compileEntries(groups.word, category));
  compiled.loose.push(...compileEntries(groups.loose.map((w) => w.replace(/\s+/g, '')), category));
  compiled.phrase.push(...compilePhrases(groups.phrase, category));
  compiled.sub.push(...groups.sub.map((w) => ({ category, text: nfc(w.toLowerCase()) })));
  compiled.nword.push(...groups.nword.map((w) => ({ category, text: nfc(w.toLowerCase()), folded: fold(nfc(w.toLowerCase())) })));
  compiled.npre.push(...groups.npre.map((w) => ({ category, text: nfc(w.toLowerCase()) })));
  compiled.lpre.push(...groups.lpre.map((w) => ({ category, text: w })));
}

/* ============================== TÁCH TỪ ============================== */

const isAscii = (s) => /^[\x00-\x7f]*$/.test(s);

/** Các "từ" cần xét: tách thường, dán chuỗi chữ đơn (c.a.c, l o v e), bỏ dấu chấm gạch giữa chữ (lo.ve). */
function collectTokens(prepared) {
  const split = (s) => s.split(/[^\p{L}\p{N}\p{M}]+/u).filter(Boolean);
  const primary = split(prepared);
  const joinedPunct = prepared.replace(/[.\-_*'’`~^+·•]+/gu, '');
  const joined = split(joinedPunct);
  const merged = [];
  for (const list of [primary, joined]) {
    let run = [];
    const flush = () => { if (run.length >= 2) merged.push(run.join('')); run = []; };
    for (const t of list) { if ([...fold(t)].length === 1) run.push(t); else flush(); }
    flush();
  }
  // Từ có ký tự thay thế dạng @ $ ! | ở giữa (l@n, sh!t, c|c).
  const symbolic = [];
  for (const piece of prepared.split(/\s+/u)) {
    const t = piece.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    if (/[@$!|€¡£]/u.test(t) && /\p{L}/u.test(t)) symbolic.push(t);
  }
  // Từ che bằng * hoặc # (f**k, c*c, đ*t).
  const wild = [];
  for (const piece of prepared.split(/\s+/u)) {
    const t = piece.replace(/^[^\p{L}\p{N}*#]+|[^\p{L}\p{N}*#]+$/gu, '');
    if (/[*#]/u.test(t) && (t.match(/[\p{L}\p{N}]/gu) ?? []).length >= 2 && [...t].length >= 3) wild.push(t);
  }
  return { primary, joined, tokens: [...new Set([...primary, ...joined, ...merged, ...symbolic])], wild };
}

/** Biến thể không dấu của một từ để so khớp (bỏ dấu, đổi ký tự giống chữ, 0->o, 1->i/l...). */
function foldedVariants(t) {
  const f = fold(t);
  const bases = new Set([f, homoglyph(f)]);
  const out = new Set(bases);
  for (const b of bases) {
    if (hasLeet(b)) { out.add(leetOnce(b, 'i')); out.add(leetOnce(b, 'l')); }
  }
  return [...out];
}

/* ============================== SO KHỚP ============================== */

function tokenMatches(t, { name }) {
  const variants = foldedVariants(t);
  const ascii = isAscii(t) || isAscii(homoglyph(t));
  // Dạng giữ dấu: "đ!t" -> "đit"
  const accentForms = hasLeet(t) ? [t, leetOnce(t, 'i'), leetOnce(t, 'l')] : [t];
  const found = [];
  const accept = (entry) => { if (!(name && entry.nameOk)) found.push(entry.category); };

  for (const e of compiled.strict) {
    if (name && e.nameOk) continue;
    if (accentForms.some((a) => same(a, e.accent, e.accentCollapsed))) { accept(e); continue; }
    if (!e.accentOnly && ascii && variants.some((v) => same(v, e.folded, e.foldedCollapsed))) accept(e);
  }
  for (const e of compiled.word) {
    if (name && e.nameOk) continue;
    if (variants.some((v) => same(v, e.folded, e.foldedCollapsed))) accept(e);
  }
  for (const e of compiled.nword) {
    if (t === e.text || fold(t) === e.folded) found.push(e.category);
  }
  for (const e of compiled.npre) if (t.startsWith(e.text)) found.push(e.category);
  for (const e of compiled.lpre) if (variants.some((v) => v.startsWith(e.text))) found.push(e.category);
  return found;
}

function wildMatches(w, { name }) {
  const found = [];
  const f = fold(w);
  const pattern = new RegExp('^' + [...f].map((c) => (c === '*' || c === '#' ? '.' : c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('') + '$', 'u');
  for (const e of [...compiled.strict, ...compiled.word]) {
    if (e.folded.length < 3 || (name && e.nameOk)) continue;
    if (pattern.test(e.folded)) found.push(e.category);
  }
  return found;
}

function phraseMatches(tokenLists, { name }) {
  const found = [];
  const partMatches = (token, part) => {
    if (same(token, part.accent, collapseAll(part.accent))) return true;
    return isAscii(token) && foldedVariants(token).some((v) => same(v, part.folded, part.foldedCollapsed));
  };
  for (const tokens of tokenLists) {
    for (const p of compiled.phrase) {
      if (name && p.parts.every((x) => NAME_ALLOWED.has(x.accent))) continue;
      for (let i = 0; i + p.parts.length <= tokens.length; i++) {
        if (p.parts.every((part, k) => partMatches(tokens[i + k], part))) { found.push(p.category); break; }
      }
    }
  }
  return found;
}

function looseMatches(prepared) {
  const found = [];
  const base = fold(prepared);
  const strings = new Set();
  for (const b of new Set([base, homoglyph(base)])) {
    for (const one of ['i', 'l']) strings.add(leetOnce(b, one).replace(/[^a-z]/g, ''));
  }
  for (const s of strings) {
    const s3 = collapse3(s), sAll = collapseAll(s);
    for (const e of compiled.loose) {
      if (e.folded.length < 4) continue;
      if (s.includes(e.folded) || s3.includes(e.folded) || (e.foldedCollapsed === e.folded && e.folded.length >= 5 && sAll.includes(e.folded))) {
        found.push(e.category);
      }
    }
  }
  return found;
}

function subMatches(prepared) {
  const found = [];
  const packed = prepared.replace(/[^\p{L}\p{N}\p{M}]+/gu, '');
  for (const e of compiled.sub) if (packed.includes(e.text) || prepared.includes(e.text)) found.push(e.category);
  return found;
}

/* ============================== API ============================== */

export const WISH_RULE_MESSAGE = 'Lời chúc chưa phù hợp: vui lòng không dùng từ tục tĩu hoặc từ ngữ nói về tình yêu (kể cả viết tắt, tiếng nước ngoài, trái tim). Nếu bạn gõ không dấu, hãy thêm dấu tiếng Việt rồi gửi lại nhé.';
export const NAME_RULE_MESSAGE = 'Tên chưa phù hợp. Bạn nhập lại tên của mình giúp nhé.';

/**
 * Kiểm tra một đoạn văn bản.
 * @returns {{ ok: true } | { ok: false, category: 'vulgar' | 'love' }}
 */
export function checkText(text, { name = false } = {}) {
  const prepared = prepare(text);
  if (!prepared.trim()) return { ok: true };
  const opts = { name };
  const hits = [];
  if (LOVE_SYMBOLS.test(prepared)) hits.push('love');
  const { primary, joined, tokens, wild } = collectTokens(prepared);
  for (const t of tokens) hits.push(...tokenMatches(t, opts));
  for (const w of wild) hits.push(...wildMatches(w, opts));
  hits.push(...phraseMatches([primary, joined], opts));
  hits.push(...looseMatches(prepared));
  hits.push(...subMatches(prepared));
  if (!hits.length) return { ok: true };
  return { ok: false, category: hits.includes('vulgar') ? 'vulgar' : 'love' };
}

/** Kiểm tra cả tên và lời chúc. Trả về thông báo tiếng Việt khi vi phạm. */
export function checkWish({ name = '', message = '' } = {}) {
  const m = checkText(message);
  if (!m.ok) return { ok: false, field: 'message', category: m.category, error: WISH_RULE_MESSAGE };
  const n = checkText(name, { name: true });
  if (!n.ok) return { ok: false, field: 'name', category: n.category, error: NAME_RULE_MESSAGE };
  return { ok: true };
}
