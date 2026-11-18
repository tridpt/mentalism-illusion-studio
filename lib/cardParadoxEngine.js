/**
 * ArcanaMind v2.0 — Probability Paradoxes, Card Shuffle Invariants & CIT Polygraph Engine
 * Modules:
 *  1. Parrondo's Paradox (1996): Exact Z_3 Markov stationary analysis + Monte-Carlo trajectories
 *  2. Gilbreath's Principle (1958): Arbitrary cut + reversal + chaotic riffle shuffle -> 100% quartet invariant
 *  3. Faro Shuffle Controller (Persi Diaconis): Exact minimal Out/In-Faro sequence moving any card i -> j
 *  4. Micro-Hesitation CIT-RT Analyzer: Sub-millisecond reaction time & cursor kinematics Bayesian scorer
 */

'use strict';

const { DECK_LIST } = require('./fitchCheneyEngine');

// ============================================================================
// 1. PARRONDO'S PARADOX ENGINE (LOSING + LOSING = WINNING!)
// ============================================================================

/**
 * Solves exact stationary distribution pi = [pi0, pi1, pi2] on capital mod 3
 * for a transition step with win probability w[r] (r = 0,1,2) and loss 1 - w[r].
 */
function solveMod3Stationary(winProbs) {
  // Transition matrix P[i][j] = P(X_{t+1} = j | X_t = i) on {0, 1, 2}
  const P = [0, 1, 2].map((r) => {
    const row = [0, 0, 0];
    const pWin = winProbs[r];
    const pLose = 1 - pWin;
    row[(r + 1) % 3] += pWin;
    row[(r + 2) % 3] += pLose;
    return row;
  });

  // Power iteration (converges to machine precision in ~60 steps on ergodic 3-state chain)
  let pi = [1 / 3, 1 / 3, 1 / 3];
  for (let iter = 0; iter < 200; iter++) {
    const next = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        next[j] += pi[i] * P[i][j];
      }
    }
    pi = next;
  }

  const expectedDrift =
    pi[0] * (2 * winProbs[0] - 1) +
    pi[1] * (2 * winProbs[1] - 1) +
    pi[2] * (2 * winProbs[2] - 1);

  return {
    stationaryPi: pi.map((v) => Number(v.toFixed(5))),
    expectedGainPerTurn: Number(expectedDrift.toFixed(5))
  };
}

function simulateParrondoParadox(options = {}) {
  const epsilon = Math.max(0.001, Math.min(0.03, Number(options.epsilon ?? 0.005)));
  const steps = Math.max(40, Math.min(600, Math.round(Number(options.steps ?? 200))));
  const ensembleSize = Math.max(20, Math.min(500, Math.round(Number(options.ensembleSize ?? 250))));

  const pA = 0.5 - epsilon;
  const pB0 = 0.1 - epsilon; // Bad coin when capital % 3 === 0
  const pB1 = 0.75 - epsilon; // Good coin when capital % 3 !== 0

  // Exact theoretical Markov analysis
  const theoryA = solveMod3Stationary([pA, pA, pA]);
  const theoryB = solveMod3Stationary([pB0, pB1, pB1]);
  const pMix = [0.5 * (pA + pB0), 0.5 * (pA + pB1), 0.5 * (pA + pB1)];
  const theoryRandomMix = solveMod3Stationary(pMix);

  function playStep(cap, mode, turnIdx) {
    let useA = false;
    if (mode === 'pure_A') useA = true;
    else if (mode === 'pure_B') useA = false;
    else if (mode === 'random_AB') useA = Math.random() < 0.5;
    else if (mode === 'periodic_AABB') useA = turnIdx % 4 < 2;

    const mod3 = ((cap % 3) + 3) % 3;
    const winProb = useA ? pA : mod3 === 0 ? pB0 : pB1;
    return cap + (Math.random() < winProb ? 1 : -1);
  }

  function runEnsemble(mode) {
    const avgCurve = new Array(steps + 1).fill(0);
    const sampleCurve = [0];
    let finalWinners = 0;

    for (let p = 0; p < ensembleSize; p++) {
      let cap = 0;
      for (let t = 1; t <= steps; t++) {
        cap = playStep(cap, mode, t - 1);
        avgCurve[t] += cap;
        if (p === 0) sampleCurve.push(cap);
      }
      if (cap > 0) finalWinners++;
    }

    return {
      avgCurve: avgCurve.map((sum) => Number((sum / ensembleSize).toFixed(2))),
      sampleCurve,
      finalAvgProfit: Number((avgCurve[steps] / ensembleSize).toFixed(2)),
      profitablePlayersPct: Number(((finalWinners / ensembleSize) * 100).toFixed(1))
    };
  }

  const simA = runEnsemble('pure_A');
  const simB = runEnsemble('pure_B');
  const simAABB = runEnsemble('periodic_AABB');
  const simRand = runEnsemble('random_AB');

  return {
    params: {
      epsilon,
      steps,
      ensembleSize,
      pA: Number((pA * 100).toFixed(2)),
      pB0: Number((pB0 * 100).toFixed(2)),
      pB1: Number((pB1 * 100).toFixed(2))
    },
    theory: {
      gameA: theoryA,
      gameB: theoryB,
      randomAB: theoryRandomMix
    },
    simulations: {
      pure_A: simA,
      pure_B: simB,
      periodic_AABB: simAABB,
      random_AB: simRand
    }
  };
}

// ============================================================================
// 2. GILBREATH'S PRINCIPLE (CHAOTIC RIFFLE SHUFFLE INVARIANT)
// ============================================================================

function runGilbreathExperiment(options = {}) {
  // Build 24-card (6 quartets) or 52-card (13 quartets) cyclic suit deck: C, D, H, S, C, D, H, S...
  const quartetCount = options.quartetCount === 13 ? 13 : 6;
  const totalCards = quartetCount * 4;

  const suitsCycle = ['C', 'D', 'H', 'S'];
  const ranksPool = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const initialDeck = [];

  for (let q = 0; q < quartetCount; q++) {
    for (let s = 0; s < 4; s++) {
      const id = `${ranksPool[q % 13]}${suitsCycle[s]}`;
      const card = DECK_LIST.find((c) => c.id === id);
      initialDeck.push(card);
    }
  }

  const rawCut = Number(options.cutIndex);
  const cutIndex =
    Number.isFinite(rawCut) && rawCut >= 1 && rawCut < totalCards
      ? Math.round(rawCut)
      : Math.floor(totalCards * (0.35 + Math.random() * 0.3));

  // Step 1: Cut into Top Packet (0..cutIndex-1) and Bottom Packet (cutIndex..end)
  // Step 2: Deal Top Packet one-by-one onto table => reverses order of Top Packet!
  const packetLeft = initialDeck.slice(0, cutIndex).reverse();
  const packetRight = initialDeck.slice(cutIndex);

  // Step 3: Genuine Chaotic Riffle Shuffle (interleave randomly at arbitrary packet proportions!)
  const shuffled = [];
  const riffleChoices = [];
  let i = 0;
  let j = 0;
  while (i < packetLeft.length || j < packetRight.length) {
    let pickLeft;
    if (i >= packetLeft.length) {
      pickLeft = false;
    } else if (j >= packetRight.length) {
      pickLeft = true;
    } else {
      // Weighted by remaining packet sizes (Gilbert-Shannon-Reeds natural riffle model!)
      const probLeft = (packetLeft.length - i) / (packetLeft.length - i + (packetRight.length - j));
      pickLeft = Math.random() < probLeft;
    }

    if (pickLeft) {
      shuffled.push({ ...packetLeft[i], sourcePacket: 'L' });
      riffleChoices.push('L');
      i++;
    } else {
      shuffled.push({ ...packetRight[j], sourcePacket: 'R' });
      riffleChoices.push('R');
      j++;
    }
  }

  // Step 4: Partition into consecutive groups of 4 cards and verify Gilbreath Invariant!
  const quartets = [];
  let allQuartetsComplete = true;

  for (let q = 0; q < quartetCount; q++) {
    const group = shuffled.slice(q * 4, q * 4 + 4);
    const suitSet = new Set(group.map((c) => c.suit));
    const hasAllFourSuits = suitSet.size === 4;
    if (!hasAllFourSuits) allQuartetsComplete = false;
    quartets.push({
      quartetNumber: q + 1,
      cards: group,
      hasAllFourSuits
    });
  }

  return {
    totalCards,
    quartetCount,
    cutIndex,
    leftReversedTop: packetLeft.slice(0, 6).map((c) => c.display),
    rightOriginalTop: packetRight.slice(0, 6).map((c) => c.display),
    rifflePatternPreview: riffleChoices.slice(0, 24).join(''),
    allQuartetsComplete,
    quartets
  };
}

// ============================================================================
// 3. FARO SHUFFLE BINARY POSITION CONTROLLER (PERSI DIACONIS)
// ============================================================================

function applyOutFaroIndex(pos) {
  // 52-card Out-Faro: Top(0) and Bottom(51) stay fixed; pos -> (2 * pos) mod 51 for 0..50
  if (pos === 51) return 51;
  return (2 * pos) % 51;
}

function applyInFaroIndex(pos) {
  // 52-card In-Faro: Bottom half goes on top at index 0; pos -> (2 * pos + 1) mod 53 - 1?
  // Exact physicalweave: Top half T[0..25] lands at odd indices 1,3,...,51 (2*i + 1)
  // Bottom half B[26..51] (let k = pos - 26 in 0..25) lands at even indices 0,2,...,50 (2*k)
  if (pos < 26) {
    return 2 * pos + 1;
  }
  return 2 * (pos - 26);
}

function applyFaroToDeck(deck, type) {
  const next = new Array(52);
  for (let idx = 0; idx < 52; idx++) {
    const dest = type === 'IN' ? applyInFaroIndex(idx) : applyOutFaroIndex(idx);
    next[dest] = deck[idx];
  }
  return next;
}

/**
 * Finds minimal sequence of Out-Faro and In-Faro shuffles moving card at startPos -> targetPos.
 */
function planFaroControl(startPos = 0, targetPos = 29) {
  const s = Math.max(0, Math.min(51, Math.round(Number(startPos))));
  const t = Math.max(0, Math.min(51, Math.round(Number(targetPos))));

  // BFS on {0..51}
  const queue = [{ pos: s, moves: [] }];
  const visited = new Set([s]);
  let winningMoves = [];

  while (queue.length > 0) {
    const cur = queue.shift();
    if (cur.pos === t) {
      winningMoves = cur.moves;
      break;
    }
    for (const type of ['OUT', 'IN']) {
      const nextPos = type === 'IN' ? applyInFaroIndex(cur.pos) : applyOutFaroIndex(cur.pos);
      if (!visited.has(nextPos)) {
        visited.add(nextPos);
        queue.push({ pos: nextPos, moves: [...cur.moves, type] });
      }
    }
  }

  let deck = [...DECK_LIST];
  const trackedCard = deck[s];
  const timeline = [
    {
      step: 0,
      shuffleType: 'INIT',
      labelVi: 'Vị trí xuất phát ban đầu',
      cardPosition: s,
      formula: `Vị trí = ${s}`
    }
  ];

  let curPos = s;
  winningMoves.forEach((move, idx) => {
    const prev = curPos;
    deck = applyFaroToDeck(deck, move);
    curPos = deck.findIndex((c) => c.id === trackedCard.id);
    timeline.push({
      step: idx + 1,
      shuffleType: move,
      labelVi: move === 'IN' ? 'In-Faro (Bit 1 — Kẹp vào trong)' : 'Out-Faro (Bit 0 — Giữ lá đầu)',
      cardPosition: curPos,
      formula:
        move === 'IN'
          ? prev < 26
            ? `2×${prev} + 1 = ${curPos}`
            : `2×(${prev} − 26) = ${curPos}`
          : prev === 51
          ? '51 (Cố định đáy)'
          : `(2×${prev}) mod 51 = ${curPos}`
    });
  });

  return {
    trackedCard,
    startPos: s,
    targetPos: t,
    finalPos: curPos,
    shuffleCount: winningMoves.length,
    binaryTarget: t.toString(2).padStart(6, '0'),
    moves: winningMoves,
    timeline
  };
}

// ============================================================================
// 4. MICRO-HESITATION & CONCEALED INFORMATION POLYGRAPH (CIT-RT)
// ============================================================================

function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function analyzeCitReactionTrials(trials = [], suspectIds = []) {
  if (!Array.isArray(trials) || trials.length < 6 || !Array.isArray(suspectIds) || suspectIds.length < 2) {
    throw new Error('Cần dữ liệu phản xạ của tối thiểu 6 lượt đo để phân tích sinh trắc học.');
  }

  // Filter valid non-target probe trials (exclude accidental errors or > 3000ms timeouts)
  const cleanTrials = trials.filter(
    (t) =>
      suspectIds.includes(t.itemId) &&
      t.correct !== false &&
      Number(t.rtMs) >= 120 &&
      Number(t.rtMs) <= 3200
  );

  const allRts = cleanTrials.map((t) => Number(t.rtMs));
  const globalMed = median(allRts) || 450;
  const absDevs = allRts.map((x) => Math.abs(x - globalMed));
  const mad = Math.max(12, median(absDevs) * 1.4826);

  const profiles = suspectIds.map((id) => {
    const itemTrials = cleanTrials.filter((t) => t.itemId === id);
    const rts = itemTrials.map((t) => Number(t.rtMs));
    const curvatures = itemTrials.map((t) => Number(t.cursorJitter || 0));
    const medRt = rts.length ? median(rts) : globalMed;
    const meanRt = rts.length ? rts.reduce((a, b) => a + b, 0) / rts.length : globalMed;
    const blendedRt = 0.6 * medRt + 0.4 * meanRt;
    const avgJitter = curvatures.length
      ? curvatures.reduce((a, b) => a + b, 0) / curvatures.length
      : 0;

    // Concealed items trigger involuntary inhibition delay (+RT) and slight cursor hesitation (+jitter)
    const zRt = (blendedRt - globalMed) / mad;
    const compositeScore = zRt + Math.min(1.5, avgJitter * 0.015);

    return {
      itemId: id,
      sampleCount: rts.length,
      medianRtMs: Number(medRt.toFixed(1)),
      meanRtMs: Number(meanRt.toFixed(1)),
      deltaFromBaselineMs: Number((blendedRt - globalMed).toFixed(1)),
      zScore: Number(zRt.toFixed(2)),
      avgCursorJitterPx: Number(avgJitter.toFixed(1)),
      compositeScore: Number(compositeScore.toFixed(3))
    };
  });

  // Softmax probabilities over compositeScore (temperature = 0.75)
  const maxC = Math.max(...profiles.map((p) => p.compositeScore));
  const weights = profiles.map((p) => Math.exp((p.compositeScore - maxC) / 0.75));
  const sumW = weights.reduce((a, b) => a + b, 0) || 1;

  const ranked = profiles
    .map((p, idx) => ({
      ...p,
      probabilityPct: Number(((weights[idx] / sumW) * 100).toFixed(1))
    }))
    .sort((a, b) => b.compositeScore - a.compositeScore);

  return {
    baselineMedianRtMs: Number(globalMed.toFixed(1)),
    madScaleMs: Number(mad.toFixed(1)),
    topSuspect: ranked[0],
    runnerUpSuspect: ranked[1] || null,
    rankedProfiles: ranked
  };
}

module.exports = {
  simulateParrondoParadox,
  runGilbreathExperiment,
  applyOutFaroIndex,
  applyInFaroIndex,
  planFaroControl,
  analyzeCitReactionTrials
};
