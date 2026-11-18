/**
 * ArcanaMind — Fitch Cheney's 5-Card Trick Engine (52-Card Telepathy)
 * Pure mathematical implementation:
 *  - Pigeonhole Principle guarantees >=2 of 5 cards share a Suit.
 *  - Modular Clock Z_13 guarantees clockwise distance delta in {1..6} in one direction.
 *  - S_3 Permutations (3! = 6) of the remaining 3 ordered cards encode delta.
 *  - Blind Decoder receives ONLY the 4 ordered cards and reconstructs the 5th hidden card.
 */

'use strict';

const SUITS = [
  { code: 'C', symbol: '♣', nameVi: 'Chuồn (Tép)', color: 'black', order: 0 },
  { code: 'D', symbol: '♦', nameVi: 'Rô', color: 'red', order: 1 },
  { code: 'H', symbol: '♥', nameVi: 'Cơ', color: 'red', order: 2 },
  { code: 'S', symbol: '♠', nameVi: 'Bích', color: 'black', order: 3 }
];

const RANKS = [
  { code: 'A', value: 1, label: 'A' },
  { code: '2', value: 2, label: '2' },
  { code: '3', value: 3, label: '3' },
  { code: '4', value: 4, label: '4' },
  { code: '5', value: 5, label: '5' },
  { code: '6', value: 6, label: '6' },
  { code: '7', value: 7, label: '7' },
  { code: '8', value: 8, label: '8' },
  { code: '9', value: 9, label: '9' },
  { code: '10', value: 10, label: '10' },
  { code: 'J', value: 11, label: 'J' },
  { code: 'Q', value: 12, label: 'Q' },
  { code: 'K', value: 13, label: 'K' }
];

const PERMUTATION_TABLE = [
  { delta: 1, pattern: 'L-M-H', indices: [0, 1, 2], labelVi: 'Thấp → Trung → Cao (+1)' },
  { delta: 2, pattern: 'L-H-M', indices: [0, 2, 1], labelVi: 'Thấp → Cao → Trung (+2)' },
  { delta: 3, pattern: 'M-L-H', indices: [1, 0, 2], labelVi: 'Trung → Thấp → Cao (+3)' },
  { delta: 4, pattern: 'M-H-L', indices: [1, 2, 0], labelVi: 'Trung → Cao → Thấp (+4)' },
  { delta: 5, pattern: 'H-L-M', indices: [2, 0, 1], labelVi: 'Cao → Thấp → Trung (+5)' },
  { delta: 6, pattern: 'H-M-L', indices: [2, 1, 0], labelVi: 'Cao → Trung → Thấp (+6)' }
];

function buildFullDeck() {
  const deck = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      const totalOrder = (rank.value - 1) * 4 + suit.order; // 0..51 strict total order
      deck.push({
        id: `${rank.code}${suit.code}`,
        rank: rank.code,
        rankValue: rank.value,
        suit: suit.code,
        suitSymbol: suit.symbol,
        suitNameVi: suit.nameVi,
        color: suit.color,
        suitOrder: suit.order,
        totalOrder,
        display: `${rank.code}${suit.symbol}`,
        fullNameVi: `${rank.code} ${suit.nameVi} (${rank.code}${suit.symbol})`
      });
    }
  }
  return deck;
}

const DECK_LIST = buildFullDeck();
const DECK_BY_ID = new Map(DECK_LIST.map((c) => [c.id, c]));

function parseCard(cardId) {
  const normalized = String(cardId || '').trim().toUpperCase();
  const card = DECK_BY_ID.get(normalized);
  if (!card) {
    throw new Error(`Lá bài không hợp lệ: "${cardId}"`);
  }
  return card;
}

/**
 * Assistant Luna: Takes 5 distinct cards, selects 1 hidden card and orders the other 4.
 */
function encodeFiveCards(cardIds) {
  if (!Array.isArray(cardIds) || cardIds.length !== 5) {
    throw new Error('Cần chọn đúng 5 lá bài khác nhau từ bộ 52 lá.');
  }
  const cards = cardIds.map(parseCard);
  const uniqueCheck = new Set(cards.map((c) => c.id));
  if (uniqueCheck.size !== 5) {
    throw new Error('5 lá bài phải hoàn toàn khác nhau (không trùng lá).');
  }

  // Step 1: Group by suit (Pigeonhole principle guarantees at least one group has >= 2 cards)
  const bySuit = new Map();
  for (const c of cards) {
    if (!bySuit.has(c.suit)) bySuit.set(c.suit, []);
    bySuit.get(c.suit).push(c);
  }

  let chosenPair = null;
  for (const suitMeta of SUITS) {
    const group = bySuit.get(suitMeta.code) || [];
    if (group.length >= 2) {
      // Sort deterministically by rankValue
      const sortedGroup = [...group].sort((a, b) => a.rankValue - b.rankValue);
      chosenPair = [sortedGroup[0], sortedGroup[1]];
      break;
    }
  }

  const [cardA, cardB] = chosenPair;
  const clockwiseAB = (cardB.rankValue - cardA.rankValue + 13) % 13;

  let anchorCard;
  let hiddenCard;
  let delta;

  if (clockwiseAB >= 1 && clockwiseAB <= 6) {
    anchorCard = cardA;
    hiddenCard = cardB;
    delta = clockwiseAB;
  } else {
    anchorCard = cardB;
    hiddenCard = cardA;
    delta = 13 - clockwiseAB;
  }

  // Remaining 3 cards sorted strictly by totalOrder -> [L, M, H]
  const remaining3 = cards
    .filter((c) => c.id !== anchorCard.id && c.id !== hiddenCard.id)
    .sort((a, b) => a.totalOrder - b.totalOrder);

  const permRule = PERMUTATION_TABLE[delta - 1];
  const encodedSignalCards = permRule.indices.map((idx) => remaining3[idx]);
  const visibleCards = [anchorCard, ...encodedSignalCards];

  return {
    inputCards: cards,
    visibleCards,
    visibleCardIds: visibleCards.map((c) => c.id),
    hiddenCard,
    assistantTrace: {
      pigeonholeSuit: anchorCard.suit,
      pigeonholeSuitName: anchorCard.suitNameVi,
      suitPair: [cardA.display, cardB.display],
      anchorCard: anchorCard.display,
      hiddenCard: hiddenCard.display,
      delta,
      sortedSignalTriplet: {
        L: remaining3[0].display,
        M: remaining3[1].display,
        H: remaining3[2].display
      },
      appliedPermutation: permRule.pattern,
      appliedPermutationVi: permRule.labelVi
    }
  };
}

/**
 * Magician Orion (BLIND DECODER):
 * Receives ONLY the 4 visible cards [c1, c2, c3, c4].
 * Never receives or accesses the 5th card!
 */
function decodeFourCards(visibleCardIds) {
  if (!Array.isArray(visibleCardIds) || visibleCardIds.length !== 4) {
    throw new Error('Cần đúng 4 lá bài ngửa theo thứ tự để giải mã.');
  }
  const visible = visibleCardIds.map(parseCard);
  if (new Set(visible.map((c) => c.id)).size !== 4) {
    throw new Error('4 lá bài ngửa không được trùng nhau.');
  }

  const anchor = visible[0];
  const signal3 = [visible[1], visible[2], visible[3]];
  const sortedSignal = [...signal3].sort((a, b) => a.totalOrder - b.totalOrder);

  const roleMap = new Map([
    [sortedSignal[0].id, 'L'],
    [sortedSignal[1].id, 'M'],
    [sortedSignal[2].id, 'H']
  ]);

  const observedPattern = signal3.map((c) => roleMap.get(c.id)).join('-');
  const permRule = PERMUTATION_TABLE.find((p) => p.pattern === observedPattern);

  const targetRankValue = ((anchor.rankValue - 1 + permRule.delta) % 13) + 1;
  const targetRankCode = RANKS[targetRankValue - 1].code;
  const predictedCard = parseCard(`${targetRankCode}${anchor.suit}`);

  return {
    visibleCards: visible,
    predictedCard,
    xrayProof: {
      step1SuitAndBase: `Lá #1 là ${anchor.display} → Lá bài ẩn chắc chắn mang chất ${anchor.suitNameVi} (${anchor.suitSymbol}) và mốc gốc = ${anchor.rankValue} (${anchor.rank}).`,
      step2TripletRanking: `Xếp hạng 3 lá tín hiệu theo thứ tự tuyệt đối (A♣ nhỏ nhất → K♠ lớn nhất): L = ${sortedSignal[0].display} (#${sortedSignal[0].totalOrder}), M = ${sortedSignal[1].display} (#${sortedSignal[1].totalOrder}), H = ${sortedSignal[2].display} (#${sortedSignal[2].totalOrder}).`,
      step3Permutation: `Thứ tự đặt trên bàn [${signal3.map((c) => c.display).join(' → ')}] tương ứng mẫu hoán vị ${observedPattern} ⇒ Độ lệch Δ = +${permRule.delta}.`,
      step4ModularClock: `Cộng trên đồng hồ Modulo 13: (${anchor.rankValue} + ${permRule.delta}) mod 13 ⇒ Bậc ${targetRankValue} (${targetRankCode}) ⇒ Lá bài ẩn là ${predictedCard.display}!`,
      anchorRankValue: anchor.rankValue,
      targetRankValue,
      delta: permRule.delta,
      pattern: observedPattern,
      labeledSignal: signal3.map((c) => ({
        ...c,
        role: roleMap.get(c.id)
      })),
      permutationTable: PERMUTATION_TABLE
    }
  };
}

/**
 * Generates a random 5-card hand and encodes it into 4 visible cards for Magician Speed-Training.
 */
function generateTrainerRound() {
  const pool = [...DECK_LIST];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const picked5 = pool.slice(0, 5).map((c) => c.id);
  const encoded = encodeFiveCards(picked5);
  return {
    visibleCards: encoded.visibleCards,
    visibleCardIds: encoded.visibleCardIds,
    // Keep answer hash or server-checkable ID; frontend trainer verifies via /decode or local check
    hiddenCardId: encoded.hiddenCard.id
  };
}

module.exports = {
  SUITS,
  RANKS,
  PERMUTATION_TABLE,
  DECK_LIST,
  parseCard,
  encodeFiveCards,
  decodeFourCards,
  generateTrainerRound
};
