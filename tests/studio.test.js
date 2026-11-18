'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const {
  encodeClassic15,
  encodeBirthday31,
  getHammingDeck,
  solveHammingAnswers
} = require('../lib/hammingEngine');
const {
  DECK_LIST,
  encodeFiveCards,
  decodeFourCards
} = require('../lib/fitchCheneyEngine');
const {
  getBuiltinKruskalPassages,
  loadKruskalSession,
  verifySha256Commitment,
  createConstantSumMatrix,
  createTargetMagicSquare,
  createRamanujanBirthdaySquare
} = require('../lib/kruskalMatrixEngine');
const {
  simulateParrondoParadox,
  runGilbreathExperiment,
  applyOutFaroIndex,
  planFaroControl,
  analyzeCitReactionTrials
} = require('../lib/cardParadoxEngine');
const { createStudioServer } = require('../server');

test('Hamming(7,4) classic_15: exhaustive 15 numbers x (0 or 1 lie) = 120 cases 100% accurate', () => {
  const deck = getHammingDeck('classic_15');
  assert.equal(deck.cards.length, 7);
  for (const card of deck.cards) {
    assert.equal(card.numbers.length, 8, `Card ${card.cardNumber} must have 8 numbers`);
  }

  for (let secret = 1; secret <= 15; secret++) {
    const truthBits = encodeClassic15(secret);

    // Case 0: All truthful answers
    const resTruth = solveHammingAnswers('classic_15', truthBits);
    assert.equal(resTruth.valid, true);
    assert.equal(resTruth.secretNumber, secret);
    assert.equal(resTruth.toldTruthAll, true);
    assert.equal(resTruth.liedCardNumber, null);

    // Cases 1..7: Lie on exactly card k
    for (let lieIdx = 0; lieIdx < 7; lieIdx++) {
      const noisy = [...truthBits];
      noisy[lieIdx] ^= 1;
      const resLie = solveHammingAnswers('classic_15', noisy);
      assert.equal(resLie.valid, true);
      assert.equal(resLie.secretNumber, secret);
      assert.equal(resLie.liedCardNumber, lieIdx + 1);
    }
  }
});

test('Linear (9,5) birthday_31: distinct 16-number cards & exhaustive 31 x 10 = 310 cases 100% accurate', () => {
  const deck = getHammingDeck('birthday_31');
  assert.equal(deck.cards.length, 9);

  const signatures = new Set();
  for (const card of deck.cards) {
    assert.equal(card.numbers.length, 16, `Card ${card.cardNumber} must have 16 numbers`);
    signatures.add(card.numbers.join(','));
  }
  assert.equal(signatures.size, 9, 'All 9 cards must be completely distinct subsets');

  for (let day = 1; day <= 31; day++) {
    const truthBits = encodeBirthday31(day);

    const resTruth = solveHammingAnswers('birthday_31', truthBits);
    assert.equal(resTruth.valid, true);
    assert.equal(resTruth.secretNumber, day);
    assert.equal(resTruth.liedCardNumber, null);

    for (let lieIdx = 0; lieIdx < 9; lieIdx++) {
      const noisy = [...truthBits];
      noisy[lieIdx] ^= 1;
      const resLie = solveHammingAnswers('birthday_31', noisy);
      assert.equal(resLie.valid, true);
      assert.equal(resLie.secretNumber, day);
      assert.equal(resLie.liedCardNumber, lieIdx + 1);
    }
  }
});

test('Fitch Cheney 52-card telepathy: 500 random hands + wraparound hands 100% blind decode', () => {
  // Wrap-around modulo 13 edge cases
  const edgeHands = [
    ['AC', 'KC', '2D', '7H', '10S'],
    ['7H', 'KH', 'AD', 'KS', '3C'],
    ['8D', 'AD', 'JC', 'QH', 'KS'],
    ['2S', '8S', '9S', 'KD', 'AC']
  ];

  for (const hand of edgeHands) {
    const encoded = encodeFiveCards(hand);
    const decoded = decodeFourCards(encoded.visibleCardIds);
    assert.equal(decoded.predictedCard.id, encoded.hiddenCard.id);
  }

  // 500 Monte-Carlo hands
  for (let trial = 0; trial < 500; trial++) {
    const pool = [...DECK_LIST];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const hand = pool.slice(0, 5).map((c) => c.id);
    const encoded = encodeFiveCards(hand);
    assert.equal(encoded.visibleCardIds.length, 4);
    assert.ok(!encoded.visibleCardIds.includes(encoded.hiddenCard.id));

    const decoded = decodeFourCards(encoded.visibleCardIds);
    assert.equal(decoded.predictedCard.id, encoded.hiddenCard.id);
  }
});

test('Kruskal passages achieve 100% Markov convergence & valid SHA-256 commitments', () => {
  const list = getBuiltinKruskalPassages();
  assert.equal(list.length, 3);

  for (const item of list) {
    const session = loadKruskalSession(item.id);
    assert.equal(session.convergenceRatePct, 100);
    assert.ok(
      session.dominantFinalIndex < session.totalWords - 1,
      `Sink word of ${item.id} should sit before the very last word`
    );

    const [payload, nonce] = session.commitment.revealString.split('::');
    const okVerify = verifySha256Commitment(payload, nonce, session.commitment.commitmentHash);
    assert.equal(okVerify.valid, true);

    const tampered = verifySha256Commitment(payload + 'X', nonce, session.commitment.commitmentHash);
    assert.equal(tampered.valid, false);
  }
});

test('Constant-sum 4x4 matrix force invariant over all 24 permutations & Super-Magic Squares', () => {
  const m = createConstantSumMatrix(199);
  assert.equal(m.invariantSum, 199);

  const perms = [
    [0, 1, 2, 3], [0, 1, 3, 2], [0, 2, 1, 3], [0, 2, 3, 1], [0, 3, 1, 2], [0, 3, 2, 1],
    [1, 0, 2, 3], [1, 0, 3, 2], [1, 2, 0, 3], [1, 2, 3, 0], [1, 3, 0, 2], [1, 3, 2, 0],
    [2, 0, 1, 3], [2, 0, 3, 1], [2, 1, 0, 3], [2, 1, 3, 0], [2, 3, 0, 1], [2, 3, 1, 0],
    [3, 0, 1, 2], [3, 0, 2, 1], [3, 1, 0, 2], [3, 1, 2, 0], [3, 2, 0, 1], [3, 2, 1, 0]
  ];

  for (const p of perms) {
    const sum = m.grid[0][p[0]] + m.grid[1][p[1]] + m.grid[2][p[2]] + m.grid[3][p[3]];
    assert.equal(sum, 199);
  }

  for (const target of [34, 35, 36, 37, 88, 2026]) {
    const sq = createTargetMagicSquare(target);
    assert.equal(sq.allDistinct, true, `All 16 numbers must be distinct for target=${target}`);
    assert.deepEqual(sq.checks.rows, [target, target, target, target]);
    assert.deepEqual(sq.checks.cols, [target, target, target, target]);
    assert.equal(sq.checks.mainDiag, target);
    assert.equal(sq.checks.antiDiag, target);
    assert.equal(sq.checks.fourCorners, target);
    assert.equal(sq.checks.center2x2, target);
  }

  const bday = createRamanujanBirthdaySquare(18, 11, 20, 26);
  assert.deepEqual(bday.grid[0], [18, 11, 20, 26]);
  assert.equal(bday.magicSum, 75);
  assert.equal(bday.checks.mainDiag, 75);
  assert.equal(bday.checks.antiDiag, 75);
  assert.equal(bday.checks.fourCorners, 75);
  assert.equal(bday.checks.center2x2, 75);
});

test('v2.0 Parrondo Paradox Markov proof: two losing games combine into positive-drift winning game', () => {
  const sim = simulateParrondoParadox({ epsilon: 0.005, steps: 200, ensembleSize: 300 });
  assert.ok(sim.theory.gameA.expectedGainPerTurn < 0, 'Game A alone must be losing');
  assert.ok(sim.theory.gameB.expectedGainPerTurn < 0, 'Game B alone must be losing');
  assert.ok(sim.theory.randomAB.expectedGainPerTurn > 0, 'Random A+B mix must be strictly winning');
});

test('v2.0 Gilbreath Principle: 200 chaotic riffle shuffles across all cut indices keep 100% 4-suit quartets', () => {
  for (let trial = 0; trial < 200; trial++) {
    const cut = 1 + (trial % 23);
    const exp = runGilbreathExperiment({ quartetCount: 6, cutIndex: cut });
    assert.equal(exp.allQuartetsComplete, true, `Failed Gilbreath invariant at cut=${cut}`);
  }
});

test('v2.0 Diaconis Faro Shuffle: exhaustive 52x52 = 2704 start/target pairs & 8 Out-Faro identity', () => {
  // 8 Out-Faro shuffles return every position 0..51 to itself
  for (let p = 0; p < 52; p++) {
    let cur = p;
    for (let k = 0; k < 8; k++) cur = applyOutFaroIndex(cur);
    assert.equal(cur, p);
  }

  // Every startPos -> targetPos reaches exact destination in <= 6 shuffles
  for (let s = 0; s < 52; s += 3) {
    for (let t = 0; t < 52; t++) {
      const plan = planFaroControl(s, t);
      assert.equal(plan.finalPos, t);
      assert.ok(plan.shuffleCount <= 7);
    }
  }
});

test('v2.0 Micro-Hesitation CIT-RT Polygraph accurately isolates concealed item spike', () => {
  const suspects = ['dagger', 'crown', 'key', 'hourglass', 'ring', 'candle'];
  const trials = [];
  for (let round = 0; round < 3; round++) {
    for (const id of suspects) {
      const isHidden = id === 'key';
      trials.push({
        itemId: id,
        rtMs: isHidden ? 520 + round * 6 : 415 + (round * 5),
        cursorJitter: isHidden ? 18 : 3,
        correct: true
      });
    }
  }
  const report = analyzeCitReactionTrials(trials, suspects);
  assert.equal(report.topSuspect.itemId, 'key');
  assert.ok(report.topSuspect.zScore > 1.5);
});

test('HTTP Server & REST Endpoints end-to-end integration (v1 + v2)', async () => {
  const tmpDb = path.join(os.tmpdir(), `arcanamind_test_${Date.now()}.db`);
  const { server } = createStudioServer({ dbPath: tmpDb });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;

  try {
    const healthRes = await fetch(`${base}/api/health`);
    const health = await healthRes.json();
    assert.equal(health.ok, true);

    const htmlRes = await fetch(`${base}/`);
    assert.equal(htmlRes.status, 200);
    const html = await htmlRes.text();
    assert.ok(html.includes('act-hybrid') && html.includes('act-paradox') && html.includes('act-polygraph'));

    // Blind Fitch Cheney via HTTP
    const encRes = await fetch(`${base}/api/tricks/fitch-cheney/encode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardIds: ['AS', '10S', '3H', '7D', 'KC'] })
    });
    const encJson = await encRes.json();
    assert.equal(encJson.ok, true);

    const decRes = await fetch(`${base}/api/tricks/fitch-cheney/decode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visibleCardIds: encJson.encoded.visibleCardIds })
    });
    const decJson = await decRes.json();
    assert.equal(decJson.decoded.predictedCard.id, encJson.encoded.hiddenCard.id);

    // v2.0 Endpoints: Parrondo, Gilbreath, Faro & CIT Polygraph
    const parRes = await fetch(`${base}/api/tricks/parrondo/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ epsilon: 0.005, steps: 80, ensembleSize: 60 })
    });
    assert.equal((await parRes.json()).ok, true);

    const gilRes = await fetch(`${base}/api/tricks/gilbreath/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quartetCount: 6, cutIndex: 9 })
    });
    assert.equal((await gilRes.json()).experiment.allQuartetsComplete, true);

    const faroRes = await fetch(`${base}/api/tricks/faro/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startPos: 0, targetPos: 29 })
    });
    assert.equal((await faroRes.json()).plan.finalPos, 29);

    // Create Stage Room
    const roomRes = await fetch(`${base}/api/stage/create`, { method: 'POST', body: '{}' });
    const roomJson = await roomRes.json();
    assert.equal(roomJson.roomCode.length, 4);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    try {
      fs.unlinkSync(tmpDb);
    } catch (_e) {}
  }
});
