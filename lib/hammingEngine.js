/**
 * ArcanaMind — Hamming Error-Correcting Mind-Reader & Lie Detector Engine
 * Supports:
 *  - Mode 'classic_15': Standard Hamming(7,4) over {1..15} (7 cards, 8 numbers/card)
 *  - Mode 'birthday_31': Distinct-Column Linear (9,5) SEC Code over {1..31} (9 cards, 16 numbers/card)
 * Both modes allow the spectator to think of a number IN THEIR HEAD (never typed!)
 * and optionally LIE on up to 1 question. Syndrome decoding pinpoints the exact lie and secret number.
 */

'use strict';

const TAROT_TITLES_7 = [
  { roman: 'I', name: 'The Magician', viName: 'Nhà Ảo Thuật', role: 'Parity P1', symbol: '☿' },
  { roman: 'II', name: 'The High Priestess', viName: 'Nữ Tư Tế', role: 'Parity P2', symbol: '☽' },
  { roman: 'III', name: 'The Empress', viName: 'Hoàng Hậu', role: 'Data D1 (2⁰)', symbol: '♀' },
  { roman: 'IV', name: 'The Emperor', viName: 'Hoàng Đế', role: 'Parity P4', symbol: '♈' },
  { roman: 'V', name: 'The Hierophant', viName: 'Giáo Hoàng', role: 'Data D2 (2¹)', symbol: '♉' },
  { roman: 'VI', name: 'The Lovers', viName: 'Tình Nhân', role: 'Data D3 (2²)', symbol: '♊' },
  { roman: 'VII', name: 'The Chariot', viName: 'Chiến Xa', role: 'Data D4 (2³)', symbol: '♋' }
];

const TAROT_TITLES_9 = [
  { roman: 'I', name: 'Luna Veil', viName: 'Mặt Trăng Khuyết', role: 'Parity P1', symbol: '☽' },
  { roman: 'II', name: 'Twin Mirrors', viName: 'Song Kính', role: 'Parity P2', symbol: '♊' },
  { roman: 'III', name: 'Four Pillars', viName: 'Tứ Trụ Tinh', role: 'Parity P4', symbol: '♃' },
  { roman: 'IV', name: 'Octagon Seal', viName: 'Bát Giác Ấn', role: 'Parity P8', symbol: '☸' },
  { roman: 'V', name: 'Spark of One', viName: 'Khởi Nguyên (2⁰)', role: 'Data D1', symbol: '✦' },
  { roman: 'VI', name: 'Dual Flame', viName: 'Lưỡng Nghi (2¹)', role: 'Data D2', symbol: '🜂' },
  { roman: 'VII', name: 'Quadra Star', viName: 'Tứ Tượng (2²)', role: 'Data D3', symbol: '✧' },
  { roman: 'VIII', name: 'Crown of Eight', viName: 'Bát Quái (2³)', role: 'Data D4', symbol: '✵' },
  { roman: 'IX', name: 'Solar Zenith', viName: 'Thiên Đỉnh (2⁴)', role: 'Data D5', symbol: '☉' }
];

/**
 * Parity-check matrix H for (9,5) code (4 rows x 9 cols).
 * Columns 1..4 are identity parity columns [1, 2, 4, 8].
 * Columns 5..9 are distinct weight>=3 columns [11, 13, 14, 7, 15] for data bits d1..d5.
 * Every parity row involves 4 data bits => all 9 cards have 16 distinct sets of numbers in 1..31!
 */
const H9_COLUMNS = [
  1,  // Card 1 (P1): 0001
  2,  // Card 2 (P2): 0010
  4,  // Card 3 (P4): 0100
  8,  // Card 4 (P8): 1000
  11, // Card 5 (D1, weight 1):  1011 = 1 + 2 + 8
  13, // Card 6 (D2, weight 2):  1101 = 1 + 4 + 8
  14, // Card 7 (D3, weight 4):  1110 = 2 + 4 + 8
  7,  // Card 8 (D4, weight 8):  0111 = 1 + 2 + 4
  15  // Card 9 (D5, weight 16): 1111 = 1 + 2 + 4 + 8
];

function encodeClassic15(n) {
  const d1 = (n >> 0) & 1;
  const d2 = (n >> 1) & 1;
  const d3 = (n >> 2) & 1;
  const d4 = (n >> 3) & 1;

  const c3 = d1;
  const c5 = d2;
  const c6 = d3;
  const c7 = d4;
  const c1 = c3 ^ c5 ^ c7;
  const c2 = c3 ^ c6 ^ c7;
  const c4 = c5 ^ c6 ^ c7;

  return [c1, c2, c3, c4, c5, c6, c7];
}

function encodeBirthday31(n) {
  const d = [
    (n >> 0) & 1, // d1 (1) -> col 5 (mask 11 = 1|2|8)
    (n >> 1) & 1, // d2 (2) -> col 6 (mask 13 = 1|4|8)
    (n >> 2) & 1, // d3 (4) -> col 7 (mask 14 = 2|4|8)
    (n >> 3) & 1, // d4 (8) -> col 8 (mask 7  = 1|2|4)
    (n >> 4) & 1  // d5 (16)-> col 9 (mask 15 = 1|2|4|8)
  ];

  // For each parity row r in {0..3} (mask = 1<<r), parity bit equals XOR of d[i] whose column has bit r set
  const dataMasks = H9_COLUMNS.slice(4);
  const p = [0, 1, 2, 3].map((bitIdx) => {
    const bitMask = 1 << bitIdx;
    let parity = 0;
    for (let i = 0; i < 5; i++) {
      if (dataMasks[i] & bitMask) {
        parity ^= d[i];
      }
    }
    return parity;
  });

  return [p[0], p[1], p[2], p[3], d[0], d[1], d[2], d[3], d[4]];
}

function getHammingDeck(mode = 'classic_15') {
  const is31 = mode === 'birthday_31';
  const maxNumber = is31 ? 31 : 15;
  const cardCount = is31 ? 9 : 7;
  const titles = is31 ? TAROT_TITLES_9 : TAROT_TITLES_7;
  const encoder = is31 ? encodeBirthday31 : encodeClassic15;
  const columns = is31 ? H9_COLUMNS : [1, 2, 3, 4, 5, 6, 7];
  const parityBits = is31 ? 4 : 3;

  const cards = Array.from({ length: cardCount }, (_, idx) => ({
    cardNumber: idx + 1,
    syndromeMask: columns[idx],
    syndromeBinary: columns[idx].toString(2).padStart(parityBits, '0'),
    ...titles[idx],
    numbers: []
  }));

  for (let n = 1; n <= maxNumber; n++) {
    const cw = encoder(n);
    for (let i = 0; i < cardCount; i++) {
      if (cw[i] === 1) {
        cards[i].numbers.push(n);
      }
    }
  }

  // Build full H matrix rows (for X-Ray Blueprint display)
  const hMatrix = Array.from({ length: parityBits }, (_, rowIdx) => {
    const mask = 1 << rowIdx;
    return columns.map((colVal) => ((colVal & mask) !== 0 ? 1 : 0));
  });

  return {
    mode: is31 ? 'birthday_31' : 'classic_15',
    title: is31
      ? 'Đại Kiện Tướng: Đọc Vị Ngày Sinh (1–31) & Bắt Nói Dối [Mã Tuyến Tính (9,5)]'
      : 'Cổ Điển: Đọc Suy Nghĩ (1–15) & Bắt Quả Tang Nói Dối [Mã Hamming(7,4)]',
    minNumber: 1,
    maxNumber,
    cardCount,
    numbersPerCard: is31 ? 16 : 8,
    maxLiesAllowed: 1,
    parityBits,
    hMatrix,
    cards
  };
}

function solveHammingAnswers(mode = 'classic_15', answers = []) {
  const is31 = mode === 'birthday_31';
  const expectedLen = is31 ? 9 : 7;
  if (!Array.isArray(answers) || answers.length !== expectedLen) {
    throw new Error(`Cần đúng ${expectedLen} câu trả lời (0 hoặc 1) cho chế độ ${mode}.`);
  }

  const received = answers.map((v) => (v ? 1 : 0));
  const columns = is31 ? H9_COLUMNS : [1, 2, 3, 4, 5, 6, 7];
  const parityBits = is31 ? 4 : 3;

  // Compute syndrome vector s = H * r^T (mod 2)
  const syndromeChecks = [];
  let syndromeMask = 0;

  for (let rowIdx = 0; rowIdx < parityBits; rowIdx++) {
    const bitWeight = 1 << rowIdx;
    const involvedCards = [];
    let xorVal = 0;
    for (let colIdx = 0; colIdx < expectedLen; colIdx++) {
      if (columns[colIdx] & bitWeight) {
        involvedCards.push({
          cardNumber: colIdx + 1,
          answer: received[colIdx]
        });
        xorVal ^= received[colIdx];
      }
    }
    if (xorVal === 1) {
      syndromeMask |= bitWeight;
    }
    syndromeChecks.push({
      checkIndex: rowIdx + 1,
      weight: bitWeight,
      label: `S${bitWeight}`,
      involvedCards,
      equation: involvedCards.map((c) => `r${c.cardNumber}(${c.answer})`).join(' ⊕ ') + ` = ${xorVal}`,
      resultBit: xorVal
    });
  }

  const corrected = [...received];
  let liedCardNumber = null;
  let anomalyMultiLie = false;

  if (syndromeMask !== 0) {
    const matchedColIdx = columns.findIndex((colVal) => colVal === syndromeMask);
    if (matchedColIdx === -1) {
      anomalyMultiLie = true;
    } else {
      liedCardNumber = matchedColIdx + 1;
      corrected[matchedColIdx] ^= 1;
    }
  }

  let secretNumber = 0;
  let dataBits = [];

  if (!anomalyMultiLie) {
    if (is31) {
      // Data bits are at indices 4, 5, 6, 7, 8 (Cards 5..9)
      dataBits = [corrected[4], corrected[5], corrected[6], corrected[7], corrected[8]];
      secretNumber =
        dataBits[0] * 1 +
        dataBits[1] * 2 +
        dataBits[2] * 4 +
        dataBits[3] * 8 +
        dataBits[4] * 16;
    } else {
      // Data bits are at indices 2, 4, 5, 6 (Cards 3, 5, 6, 7)
      dataBits = [corrected[2], corrected[4], corrected[5], corrected[6]];
      secretNumber =
        dataBits[0] * 1 +
        dataBits[1] * 2 +
        dataBits[2] * 4 +
        dataBits[3] * 8;
    }

    if (secretNumber === 0) {
      // Codeword 000..0 is outside {1..max}, meaning user answered mostly NO with >=2 lies or didn't pick 1..max
      anomalyMultiLie = true;
    }
  }

  const titles = is31 ? TAROT_TITLES_9 : TAROT_TITLES_7;
  const liedCardMeta = liedCardNumber ? titles[liedCardNumber - 1] : null;

  let verdictTitle = '';
  let verdictDetail = '';
  if (anomalyMultiLie) {
    verdictTitle = 'Phát Hiện Nhiễu Vượt Ngưỡng (> 1 Lời Nói Dối)!';
    verdictDetail =
      'Vector Syndrome rơi ra ngoài cầu Hamming bán kính 1 (hoặc khớp vector 0000). Điều này chứng minh toán học rằng bạn đã nói dối từ 2 câu trở lên hoặc chưa chọn số trong miền hợp lệ!';
  } else if (liedCardNumber === null) {
    verdictTitle = `Con số trong đầu bạn là ${secretNumber} — Bạn Đã Nói Thật 100%!`;
    verdictDetail = `Toàn bộ ${parityBits} phương trình kiểm tra chẵn lẻ đều triệt tiêu (Syndrome = ${'0'.repeat(parityBits)}), xác nhận không có bất kỳ bit nhiễu nào trong ${expectedLen} câu trả lời.`;
  } else {
    verdictTitle = `Con số trong đầu bạn là ${secretNumber} — Và bạn đã NÓI DỐI ở Lá Bài số ${liedCardNumber}!`;
    verdictDetail = `Vector Syndrome S = ${syndromeMask.toString(2).padStart(parityBits, '0')}₂ (giá trị ${syndromeMask}) khớp chính xác với cột thứ ${liedCardNumber} (${liedCardMeta.viName}) của ma trận H. Đảo bit r${liedCardNumber} từ ${received[liedCardNumber - 1]} → ${corrected[liedCardNumber - 1]} khôi phục nguyên vẹn số ${secretNumber}!`;
  }

  return {
    mode: is31 ? 'birthday_31' : 'classic_15',
    valid: !anomalyMultiLie,
    anomalyMultiLie,
    secretNumber: anomalyMultiLie ? null : secretNumber,
    toldTruthAll: !anomalyMultiLie && liedCardNumber === null,
    liedCardNumber,
    liedCardName: liedCardMeta ? liedCardMeta.viName : null,
    receivedBits: received,
    correctedBits: anomalyMultiLie ? null : corrected,
    dataBits,
    syndromeMask,
    syndromeBinary: syndromeMask.toString(2).padStart(parityBits, '0'),
    syndromeChecks,
    verdictTitle,
    verdictDetail
  };
}

module.exports = {
  H9_COLUMNS,
  encodeClassic15,
  encodeBirthday31,
  getHammingDeck,
  solveHammingAnswers
};
