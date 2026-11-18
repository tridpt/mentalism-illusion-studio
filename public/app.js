/**
 * 🎩✨ ArcanaMind — Main Theatrical Stage Controller & X-Ray Blueprint Visualizer
 */

(function () {
  'use strict';

  const state = {
    xrayMode: false,
    soundEnabled: true,
    roomCode: null,
    sseSource: null,

    // Act I: Hamming
    hammingMode: 'classic_15',
    hammingDeck: null,
    hammingAnswers: [],
    hammingStartedAt: 0,

    // Act II: Fitch Cheney
    fitchMode: 'spectator',
    fullDeck: [],
    selectedFiveIds: [],
    encodedStage: null,
    trainerRound: null,
    trainerSuit: null,
    trainerRank: null,
    trainerStreak: 0,
    trainerStartMs: 0,
    trainerTimerId: null,

    // Act III: Kruskal & Squares
    kruskalSession: null,
    kruskalUnsealed: false,
    matrixForce: null,
    matrixPicked: [], // [{ r, c, val }]
    magicSquareMode: 'ramanujan_birthday',
    magicSquareData: null,
    magicHighlight: 'row0'
  };

  // =========================================================================
  // 1. WEB AUDIO STAGE SOUND FX
  // =========================================================================
  let fxCtx = null;
  function playStageFx(kind = 'click') {
    if (!state.soundEnabled) return;
    try {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!fxCtx) fxCtx = new AudioCtor();
      if (fxCtx.state === 'suspended') fxCtx.resume();

      const now = fxCtx.currentTime;
      const notes =
        kind === 'reveal'
          ? [523.25, 659.25, 783.99, 1046.5]
          : kind === 'warn'
          ? [311.13, 277.18]
          : [587.33];

      notes.forEach((freq, i) => {
        const osc = fxCtx.createOscillator();
        const gain = fxCtx.createGain();
        osc.type = kind === 'reveal' ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.065);
        gain.gain.setValueAtTime(0.08, now + i * 0.065);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.065 + 0.28);
        osc.connect(gain);
        gain.connect(fxCtx.destination);
        osc.start(now + i * 0.065);
        osc.stop(now + i * 0.065 + 0.3);
      });
    } catch (_e) {}
  }

  function showToast(msg) {
    const stack = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = 'toast-msg';
    el.textContent = msg;
    stack.appendChild(el);
    setTimeout(() => el.remove(), 3400);
  }

  async function apiFetch(url, options = {}) {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    const data = await res.json();
    if (!res.ok || data.ok === false) {
      throw new Error(data.error || 'Yêu cầu thất bại');
    }
    return data;
  }

  // =========================================================================
  // 2. HEADER, GLOBAL X-RAY & NAVIGATION
  // =========================================================================
  function toggleXrayMode(forceValue) {
    state.xrayMode = typeof forceValue === 'boolean' ? forceValue : !state.xrayMode;
    document.body.classList.toggle('xray-active', state.xrayMode);
    document.getElementById('xray-state-label').textContent = state.xrayMode ? 'ĐANG BẬT' : 'TẮT';
    playStageFx('click');
    showToast(
      state.xrayMode
        ? '🔦 Đã bật chế độ X-Ray: Hiển thị toàn bộ ma trận và bản vẽ toán học hậu trường!'
        : '🎩 Đã trở về Chế độ Biểu diễn Sân khấu.'
    );
  }

  function bindGlobalControls() {
    document.getElementById('btn-xray-global').addEventListener('click', () => toggleXrayMode());

    window.addEventListener('keydown', (e) => {
      if (
        e.key.toLowerCase() === 'x' &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
      ) {
        toggleXrayMode();
      }
    });

    document.getElementById('btn-audio-toggle').addEventListener('click', () => {
      state.soundEnabled = !state.soundEnabled;
      document.getElementById('audio-icon').textContent = state.soundEnabled ? '🔊' : '🔇';
      document.getElementById('btn-audio-toggle').classList.toggle('active', state.soundEnabled);
    });

    // Act Tabs
    document.querySelectorAll('.act-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.act-tab').forEach((t) => t.classList.remove('active'));
        document.querySelectorAll('.act-panel').forEach((p) => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.act).classList.add('active');
        playStageFx('click');
      });
    });

    // Modals
    document.getElementById('btn-live-stage').addEventListener('click', () => {
      document.getElementById('modal-live-stage').hidden = false;
    });
    document.getElementById('btn-guide-modal').addEventListener('click', () => {
      document.getElementById('modal-guide').hidden = false;
    });
    document.getElementById('btn-hall-records').addEventListener('click', async () => {
      await refreshRecordsModal();
      document.getElementById('modal-records').hidden = false;
    });

    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.getElementById(btn.dataset.closeModal).hidden = true;
      });
    });
    document.querySelectorAll('.modal-backdrop').forEach((bd) => {
      bd.addEventListener('click', (e) => {
        if (e.target === bd) bd.hidden = true;
      });
    });
  }

  async function refreshHeaderMetrics() {
    try {
      const { stats } = await apiFetch('/api/records');
      document.getElementById('hdr-streak').textContent = `${stats.topMagicianStreak} ván`;
      document.getElementById('hdr-immunity').textContent = `${stats.avgCortexImmunityPct}%`;
    } catch (_e) {}
  }

  async function refreshRecordsModal() {
    const box = document.getElementById('records-modal-content');
    try {
      const { stats } = await apiFetch('/api/records');
      const rowsHtml = stats.recentRecords
        .map(
          (r) => `
          <tr>
            <td><strong>${escapeHtml(r.playerName)}</strong></td>
            <td><code>${escapeHtml(r.category)}</code></td>
            <td>${escapeHtml(r.trickMode)}</td>
            <td><strong>${r.score}</strong></td>
            <td>${escapeHtml(r.detail?.note || JSON.stringify(r.detail))}</td>
          </tr>
        `
        )
        .join('');

      box.innerHTML = `
        <div class="header-metrics" style="margin-bottom:12px;">
          <span class="metric-pill"><span class="m-label">Lưu trữ:</span> <strong>${escapeHtml(stats.storageEngine)}</strong></span>
          <span class="metric-pill"><span class="m-label">Tổng phiên ghi nhận:</span> <strong>${stats.totalSessionsRecorded}</strong></span>
          <span class="metric-pill"><span class="m-label">Độ kháng ảo giác TB:</span> <strong>${stats.avgCortexImmunityPct}%</strong></span>
        </div>
        <table class="records-table">
          <thead>
            <tr>
              <th>Người Chơi</th>
              <th>Hạng Mục</th>
              <th>Chế Độ</th>
              <th>Điểm / Chuỗi</th>
              <th>Chi Tiết Pháp Y Toán Học</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      `;
    } catch (err) {
      box.innerHTML = `<p>${escapeHtml(err.message)}</p>`;
    }
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // =========================================================================
  // 3. ACT I: HAMMING MIND READER & LIE DETECTOR
  // =========================================================================
  async function loadHammingMode(mode) {
    state.hammingMode = mode;
    const { deck } = await apiFetch(`/api/tricks/hamming/deck?mode=${encodeURIComponent(mode)}`);
    state.hammingDeck = deck;
    state.hammingAnswers = new Array(deck.cardCount).fill(null);
    state.hammingStartedAt = Date.now();

    document.getElementById('hamming-mode-heading').textContent = deck.title;
    document.getElementById('hamming-placeholder').hidden = false;
    document.getElementById('hamming-result').hidden = true;
    renderHammingCards();
    renderHammingXrayMatrix(null);
  }

  function renderHammingCards(liedCardNumber = null) {
    const deck = state.hammingDeck;
    const container = document.getElementById('hamming-cards-container');
    container.innerHTML = '';

    let answered = 0;
    deck.cards.forEach((card, idx) => {
      const ans = state.hammingAnswers[idx];
      if (ans !== null) answered++;

      const cardEl = document.createElement('div');
      cardEl.className = 'tarot-card';
      if (ans === 1) cardEl.classList.add('answered-yes');
      if (ans === 0) cardEl.classList.add('answered-no');
      if (liedCardNumber === card.cardNumber) cardEl.classList.add('lied-highlight');

      const numsHtml = card.numbers.map((n) => `<span class="t-num-cell">${n}</span>`).join('');

      cardEl.innerHTML = `
        <div>
          <div class="tarot-top">
            <span class="tarot-roman">${card.symbol} LÁ ${card.roman} (#${card.cardNumber})</span>
            <span class="tarot-role-tag">${card.role} [${card.syndromeBinary}]</span>
          </div>
          <div class="tarot-name">${card.viName}</div>
        </div>
        <div class="tarot-num-grid">${numsHtml}</div>
        <div class="tarot-yn-btns">
          <button type="button" class="yn-btn yes ${ans === 1 ? 'selected' : ''}" data-idx="${idx}" data-val="1">✔ CÓ MẶT</button>
          <button type="button" class="yn-btn no ${ans === 0 ? 'selected' : ''}" data-idx="${idx}" data-val="0">✕ KHÔNG CÓ</button>
        </div>
      `;
      container.appendChild(cardEl);
    });

    container.querySelectorAll('.yn-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = Number(btn.dataset.idx);
        const v = Number(btn.dataset.val);
        state.hammingAnswers[i] = v;
        playStageFx('click');
        renderHammingCards();
        renderHammingXrayMatrix(null);
      });
    });

    document.getElementById('hamming-answered-count').textContent = `${answered}/${deck.cardCount}`;
    document.getElementById('btn-hamming-solve').disabled = answered < deck.cardCount;
  }

  function renderHammingXrayMatrix(solveRes) {
    const deck = state.hammingDeck;
    if (!deck) return;
    const wrap = document.getElementById('hamming-xray-matrix-wrap');
    const liedCol = solveRes?.liedCardNumber ? solveRes.liedCardNumber - 1 : -1;

    const headers = deck.cards
      .map((c, idx) => `<th class="${idx === liedCol ? 'lied-col' : ''}">C${c.cardNumber}</th>`)
      .join('');

    const ansRow = state.hammingAnswers
      .map(
        (a, idx) =>
          `<td class="${idx === liedCol ? 'lied-col' : ''}">${a === null ? '·' : a}</td>`
      )
      .join('');

    const hRows = deck.hMatrix
      .map((row, rIdx) => {
        const cells = row
          .map((bit, cIdx) => `<td class="${cIdx === liedCol ? 'lied-col' : ''}">${bit}</td>`)
          .join('');
        return `<tr><th>S${1 << rIdx}</th>${cells}</tr>`;
      })
      .join('');

    const eqHtml = solveRes
      ? solveRes.syndromeChecks
          .map((chk) => `<div class="xor-eq-line"><strong>${chk.label}:</strong> ${chk.equation}</div>`)
          .join('')
      : `<div class="xor-eq-line">Trả lời đủ ${deck.cardCount} lá bài để tính Syndrome S = H · rᵀ (mod 2) trực tiếp.</div>`;

    wrap.innerHTML = `
      <table class="h-matrix-table">
        <thead>
          <tr><th>Ma trận H</th>${headers}</tr>
        </thead>
        <tbody>
          <tr><th>Vector r</th>${ansRow}</tr>
          ${hRows}
        </tbody>
      </table>
      ${eqHtml}
    `;
  }

  function bindAct1Hamming() {
    document.querySelectorAll('[data-hamming-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-hamming-mode]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        loadHammingMode(btn.dataset.hammingMode);
      });
    });

    document.getElementById('btn-hamming-reset').addEventListener('click', () => {
      loadHammingMode(state.hammingMode);
    });

    document.getElementById('btn-hamming-solve').addEventListener('click', async () => {
      try {
        const durationMs = Date.now() - state.hammingStartedAt;
        const playerName = document.getElementById('hamming-player-name').value;
        const { result } = await apiFetch('/api/tricks/hamming/solve', {
          method: 'POST',
          body: JSON.stringify({
            mode: state.hammingMode,
            answers: state.hammingAnswers,
            playerName,
            durationMs,
            roomCode: state.roomCode
          })
        });

        document.getElementById('hamming-placeholder').hidden = true;
        const resEl = document.getElementById('hamming-result');
        resEl.hidden = false;

        if (result.anomalyMultiLie) {
          playStageFx('warn');
          document.getElementById('hamming-lie-badge').textContent = '⚠ CẢNH BÁO NHIỄU ĐA BIT';
          document.getElementById('hamming-secret-number').textContent = '≠';
        } else {
          playStageFx('reveal');
          document.getElementById('hamming-lie-badge').textContent = result.liedCardNumber
            ? `🚨 BẮT QUẢ TANG NÓI DỐI Ở LÁ SỐ ${result.liedCardNumber}!`
            : '✨ TÂM TRÍ TRUNG THỰC 100%';
          document.getElementById('hamming-secret-number').textContent = String(result.secretNumber);
        }

        document.getElementById('hamming-verdict-title').textContent = result.verdictTitle;
        document.getElementById('hamming-verdict-detail').textContent = result.verdictDetail;

        renderHammingCards(result.liedCardNumber);
        renderHammingXrayMatrix(result);
        refreshHeaderMetrics();
      } catch (err) {
        showToast(err.message);
      }
    });
  }

  // =========================================================================
  // 4. ACT II: FITCH CHENEY 52-CARD TELEPATHY & SPEED TRAINER
  // =========================================================================
  function renderPlayingCardHtml(card, caption = '', extraClass = '') {
    return `
      <div>
        <div class="playing-card ${card.color === 'red' ? 'red' : ''} ${extraClass}">
          <div class="pc-corner">${card.rank}<br/>${card.suitSymbol}</div>
          <div class="pc-center-suit">${card.suitSymbol}</div>
          <div class="pc-corner" style="align-self:flex-end; transform:rotate(180deg);">${card.rank}<br/>${card.suitSymbol}</div>
        </div>
        ${caption ? `<div class="pc-slot-caption">${caption}</div>` : ''}
      </div>
    `;
  }

  async function initAct2Fitch() {
    const data = await apiFetch('/api/tricks/fitch-cheney/deck');
    state.fullDeck = data.cards;
    renderFullDeckPicker();
    renderTrainerRankButtons(data.ranks);
  }

  function renderFullDeckPicker() {
    const grid = document.getElementById('fitch-full-deck-grid');
    grid.innerHTML = '';
    const suitOrder = ['S', 'H', 'D', 'C'];

    suitOrder.forEach((sCode) => {
      const row = document.createElement('div');
      row.className = 'suit-row';
      const suitCards = state.fullDeck.filter((c) => c.suit === sCode);
      suitCards.forEach((card) => {
        const picked = state.selectedFiveIds.includes(card.id);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `deck-mini-card ${card.color === 'red' ? 'red' : ''} ${picked ? 'picked' : ''}`;
        btn.textContent = card.display;
        btn.addEventListener('click', () => togglePickCard(card.id));
        row.appendChild(btn);
      });
      grid.appendChild(row);
    });

    document.getElementById('fitch-picked-count').textContent = `${state.selectedFiveIds.length} / 5`;
    const pills = document.getElementById('fitch-selected-pills');
    pills.innerHTML = state.selectedFiveIds
      .map((id) => {
        const c = state.fullDeck.find((x) => x.id === id);
        return `<span class="mini-card-pill ${c.color === 'red' ? 'red' : ''}">${c.display}</span>`;
      })
      .join('');

    document.getElementById('btn-fitch-encode').disabled = state.selectedFiveIds.length !== 5;
  }

  function togglePickCard(cardId) {
    const idx = state.selectedFiveIds.indexOf(cardId);
    if (idx >= 0) {
      state.selectedFiveIds.splice(idx, 1);
    } else {
      if (state.selectedFiveIds.length >= 5) {
        showToast('Bạn đã chọn đủ 5 lá bài! Hãy giao cho Luna hoặc bỏ bớt 1 lá.');
        return;
      }
      state.selectedFiveIds.push(cardId);
    }
    playStageFx('click');
    renderFullDeckPicker();
  }

  function renderMod13ClockSvg(anchorVal, targetVal, delta, suitSymbol) {
    const labels = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const cx = 110;
    const cy = 110;
    const r = 82;

    const posFor = (val) => {
      const angle = -Math.PI / 2 + ((val - 1) / 13) * Math.PI * 2;
      return {
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        angle
      };
    };

    let arcNodes = '';
    for (let step = 0; step <= delta; step++) {
      const curVal = ((anchorVal - 1 + step) % 13) + 1;
      const p = posFor(curVal);
      if (step > 0) {
        const prevVal = ((anchorVal - 1 + step - 1) % 13) + 1;
        const prevP = posFor(prevVal);
        arcNodes += `<line x1="${prevP.x.toFixed(1)}" y1="${prevP.y.toFixed(1)}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" stroke="#fde047" stroke-width="3" />`;
      }
    }

    const circles = labels
      .map((lbl, i) => {
        const val = i + 1;
        const p = posFor(val);
        const isAnchor = val === anchorVal;
        const isTarget = val === targetVal;
        const fill = isTarget ? '#f43f5e' : isAnchor ? '#22d3ee' : '#1e293b';
        return `
          <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="13" fill="${fill}" stroke="#94a3b8" stroke-width="1.2" />
          <text x="${p.x.toFixed(1)}" y="${(p.y + 4).toFixed(1)}" text-anchor="middle" fill="#ffffff" font-size="10" font-weight="700">${lbl}</text>
        `;
      })
      .join('');

    return `
      <svg width="220" height="220" viewBox="0 0 220 220">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(34,211,238,0.28)" stroke-dasharray="4 3" />
        ${arcNodes}
        ${circles}
        <text x="${cx}" y="${cy - 4}" text-anchor="middle" fill="#fef08a" font-size="15" font-weight="800">${suitSymbol} +${delta}</text>
        <text x="${cx}" y="${cy + 14}" text-anchor="middle" fill="#94a3b8" font-size="10">mod 13</text>
      </svg>
    `;
  }

  function bindAct2Fitch() {
    document.querySelectorAll('[data-fitch-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-fitch-mode]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.fitchMode = btn.dataset.fitchMode;
        document.getElementById('fitch-spectator-view').hidden = state.fitchMode !== 'spectator';
        document.getElementById('fitch-trainer-view').hidden = state.fitchMode !== 'trainer';
        if (state.fitchMode === 'trainer' && !state.trainerRound) {
          startNewTrainerRound();
        }
      });
    });

    document.getElementById('btn-fitch-random5').addEventListener('click', () => {
      const copy = [...state.fullDeck];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      state.selectedFiveIds = copy.slice(0, 5).map((c) => c.id);
      playStageFx('click');
      renderFullDeckPicker();
    });

    document.getElementById('btn-fitch-clear5').addEventListener('click', () => {
      state.selectedFiveIds = [];
      state.encodedStage = null;
      document.getElementById('fitch-table-slots').innerHTML =
        '<div class="empty-velvet-msg">Hãy chọn đủ 5 lá bài bên trái để bắt đầu màn diễn.</div>';
      document.getElementById('btn-fitch-blind-decode').disabled = true;
      document.getElementById('fitch-decode-banner').hidden = true;
      renderFullDeckPicker();
    });

    document.getElementById('btn-fitch-encode').addEventListener('click', async () => {
      const { encoded } = await apiFetch('/api/tricks/fitch-cheney/encode', {
        method: 'POST',
        body: JSON.stringify({
          cardIds: state.selectedFiveIds,
          roomCode: state.roomCode
        })
      });
      state.encodedStage = encoded;
      playStageFx('click');

      const slotsHtml =
        encoded.visibleCards
          .map((c, idx) =>
            renderPlayingCardHtml(c, idx === 0 ? 'Lá #1 (Mốc)' : `Lá #${idx + 1}`)
          )
          .join('') +
        `
        <div>
          <div class="playing-card face-down" id="fitch-hidden-slot">
            <div>🔒<br/><small>LÁ ẨN #5</small></div>
          </div>
          <div class="pc-slot-caption">Đang Úp Kín</div>
        </div>
      `;

      document.getElementById('fitch-table-slots').innerHTML = slotsHtml;
      document.getElementById('btn-fitch-blind-decode').disabled = false;
      document.getElementById('fitch-decode-banner').hidden = true;
    });

    document.getElementById('btn-fitch-blind-decode').addEventListener('click', async () => {
      if (!state.encodedStage) return;
      // Notice: ONLY sends visibleCardIds!
      const { decoded } = await apiFetch('/api/tricks/fitch-cheney/decode', {
        method: 'POST',
        body: JSON.stringify({ visibleCardIds: state.encodedStage.visibleCardIds })
      });

      playStageFx('reveal');
      const p = decoded.predictedCard;

      const slotsHtml =
        decoded.visibleCards
          .map((c, idx) => {
            const role = idx === 0 ? 'Mốc Chất' : `Tín hiệu ${decoded.xrayProof.labeledSignal[idx - 1].role}`;
            return renderPlayingCardHtml(c, `Lá #${idx + 1} (${role})`);
          })
          .join('') + renderPlayingCardHtml(p, '✨ ĐÃ ĐỌC VỊ!', 'revealed-glow');

      document.getElementById('fitch-table-slots').innerHTML = slotsHtml;

      const banner = document.getElementById('fitch-decode-banner');
      banner.hidden = false;
      banner.innerHTML = `
        <strong>🎩 Pháp sư Orion tuyên bố:</strong> Lá bài thứ 5 đang úp chính xác là <strong>${p.fullNameVi}</strong>!
        <br/><small>Payload gửi tới API giải mã mù: <code>${JSON.stringify({ visibleCardIds: state.encodedStage.visibleCardIds })}</code> (Không hề chứa lá thứ 5!)</small>
      `;

      document.getElementById('fitch-clock-svg-wrap').innerHTML = renderMod13ClockSvg(
        decoded.xrayProof.anchorRankValue,
        decoded.xrayProof.targetRankValue,
        decoded.xrayProof.delta,
        p.suitSymbol
      );

      document.getElementById('fitch-steps-trace').innerHTML = [
        decoded.xrayProof.step1SuitAndBase,
        decoded.xrayProof.step2TripletRanking,
        decoded.xrayProof.step3Permutation,
        decoded.xrayProof.step4ModularClock
      ]
        .map((line) => `<div class="trace-item">${escapeHtml(line)}</div>`)
        .join('');
    });

    // Trainer Mode Controls
    document.getElementById('btn-trainer-deal').addEventListener('click', startNewTrainerRound);

    document.querySelectorAll('#trainer-suit-btns .suit-pick-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#trainer-suit-btns .suit-pick-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.trainerSuit = btn.dataset.suit;
        updateTrainerSubmitState();
      });
    });

    document.getElementById('btn-trainer-submit').addEventListener('click', submitTrainerGuess);
  }

  function renderTrainerRankButtons(ranks) {
    const wrap = document.getElementById('trainer-rank-btns');
    wrap.innerHTML = '';
    ranks.forEach((r) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'rank-pick-btn';
      btn.textContent = r.label;
      btn.dataset.rank = r.code;
      btn.addEventListener('click', () => {
        wrap.querySelectorAll('.rank-pick-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.trainerRank = r.code;
        updateTrainerSubmitState();
      });
      wrap.appendChild(btn);
    });
  }

  function updateTrainerSubmitState() {
    document.getElementById('btn-trainer-submit').disabled = !(
      state.trainerRound &&
      state.trainerSuit &&
      state.trainerRank
    );
  }

  async function startNewTrainerRound() {
    const { round } = await apiFetch('/api/tricks/fitch-cheney/trainer-round');
    state.trainerRound = round;
    state.trainerSuit = null;
    state.trainerRank = null;
    document.querySelectorAll('.suit-pick-btn, .rank-pick-btn').forEach((b) => b.classList.remove('active'));
    document.getElementById('trainer-feedback').hidden = true;
    updateTrainerSubmitState();

    document.getElementById('trainer-four-cards').innerHTML = round.visibleCards
      .map((c, i) => renderPlayingCardHtml(c, `Lá #${i + 1}`))
      .join('');

    state.trainerStartMs = performance.now();
    clearInterval(state.trainerTimerId);
    state.trainerTimerId = setInterval(() => {
      const sec = ((performance.now() - state.trainerStartMs) / 1000).toFixed(1);
      document.getElementById('trainer-timer').textContent = `${sec}s`;
    }, 100);
  }

  async function submitTrainerGuess() {
    clearInterval(state.trainerTimerId);
    const elapsedMs = Math.round(performance.now() - state.trainerStartMs);
    const guessId = `${state.trainerRank}${state.trainerSuit}`;
    const { decoded } = await apiFetch('/api/tricks/fitch-cheney/decode', {
      method: 'POST',
      body: JSON.stringify({ visibleCardIds: state.trainerRound.visibleCardIds })
    });

    const correct = decoded.predictedCard.id === guessId;
    const fb = document.getElementById('trainer-feedback');
    fb.hidden = false;

    if (correct) {
      state.trainerStreak += 1;
      playStageFx('reveal');
      fb.classList.remove('warn');
      fb.innerHTML = `🎉 <strong>CHÍNH XÁC TUYỆT ĐỐI!</strong> Lá ẩn là <strong>${decoded.predictedCard.fullNameVi}</strong> (Giải mã trong ${(elapsedMs / 1000).toFixed(2)}s • Chuỗi thắng: ${state.trainerStreak}).`;
      await apiFetch('/api/records', {
        method: 'POST',
        body: JSON.stringify({
          category: 'fitch_trainer',
          playerName: document.getElementById('trainer-player-name').value || 'Đệ Tử Pháp Sư',
          trickMode: '52-Card Blind Trainer',
          score: state.trainerStreak,
          durationMs: elapsedMs,
          detail: { card: decoded.predictedCard.display, note: `Giải mã ${decoded.predictedCard.display} trong ${(elapsedMs / 1000).toFixed(2)}s` }
        })
      });
      refreshHeaderMetrics();
    } else {
      state.trainerStreak = 0;
      playStageFx('warn');
      fb.classList.add('warn');
      fb.innerHTML = `❌ Chưa khớp! Bạn đoán <code>${guessId}</code> nhưng lá ẩn thật là <strong>${decoded.predictedCard.fullNameVi}</strong>.<br/><small>${escapeHtml(decoded.xrayProof.step3Permutation)} → ${escapeHtml(decoded.xrayProof.step4ModularClock)}</small>`;
    }
    document.getElementById('trainer-streak').textContent = String(state.trainerStreak);
  }

  // =========================================================================
  // 5. ACT III: KRUSKAL MARKOV CONVERGENCE & MAGIC SQUARES
  // =========================================================================
  async function loadKruskalPassage(payload) {
    const { session } = await apiFetch('/api/tricks/kruskal/session', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    state.kruskalSession = session;
    state.kruskalUnsealed = false;

    document.getElementById('kruskal-sha-hash').textContent = session.commitment.commitmentHash;
    document.getElementById('kruskal-sealed-view').hidden = false;
    document.getElementById('kruskal-unsealed-view').hidden = true;
    document.getElementById('kruskal-verify-badge').hidden = true;
    document.getElementById('kruskal-step-caption').hidden = true;
    document.getElementById('kruskal-convergence-badge').textContent = `Hội tụ: ${session.convergenceRatePct}%`;

    renderKruskalWords();
    renderKruskalMarkovGraph();
  }

  function renderKruskalWords(highlightSteps = []) {
    const s = state.kruskalSession;
    const board = document.getElementById('kruskal-words-board');
    const traceMode = document.getElementById('kruskal-trace-toggle').checked;
    board.classList.toggle('show-len-sups', traceMode);
    board.innerHTML = '';

    const hopSet = new Set(highlightSteps);

    s.nodes.forEach((node) => {
      const span = document.createElement('span');
      span.className = 'k-word';
      if (node.isEntryCandidate) span.classList.add('entry-word');
      if (node.isSink) span.classList.add('is-sink');
      if (node.isCouplingPoint) span.classList.add('is-coupling');
      if (state.kruskalUnsealed && node.isSink) span.classList.add('sink-revealed');
      if (hopSet.has(node.index)) span.classList.add('trace-hop');
      if (traceMode) span.classList.add('trace-clickable');

      span.innerHTML = `${escapeHtml(node.word)}<sup class="k-len-sup">${node.letterCount}</sup>`;

      span.addEventListener('click', () => {
        if (!document.getElementById('kruskal-trace-toggle').checked && !state.xrayMode) return;
        traceFromWord(node.index);
      });
      board.appendChild(span);
    });
  }

  function traceFromWord(startIndex) {
    const s = state.kruskalSession;
    const steps = [];
    let cur = startIndex;
    const seen = new Set();
    while (cur !== null && !seen.has(cur)) {
      seen.add(cur);
      steps.push(cur);
      cur = s.nodes[cur].nextIndex;
    }
    playStageFx('click');
    renderKruskalWords(steps);

    const cap = document.getElementById('kruskal-step-caption');
    cap.hidden = false;
    cap.textContent =
      'Quỹ đạo nhảy: ' +
      steps.map((idx) => `${s.nodes[idx].cleanWord}(+${s.nodes[idx].letterCount})`).join(' ➔ ') +
      ` ➔ DỪNG TẠI "${s.nodes[steps.at(-1)].cleanWord.toUpperCase()}"!`;
  }

  function renderKruskalMarkovGraph() {
    const s = state.kruskalSession;
    const wrap = document.getElementById('kruskal-graph-svg-wrap');
    const W = 500;
    const H = 175;
    const cols = 12;
    const rows = Math.ceil(s.totalWords / cols);

    const pt = (idx) => {
      const r = Math.floor(idx / cols);
      const c = idx % cols;
      return {
        x: 24 + (c / Math.max(1, cols - 1)) * (W - 48),
        y: 22 + (r / Math.max(1, rows - 1)) * (H - 44)
      };
    };

    let edges = '';
    const drawnPairs = new Set();
    s.entryPaths.forEach((ep) => {
      for (let i = 0; i < ep.steps.length - 1; i++) {
        const a = ep.steps[i];
        const b = ep.steps[i + 1];
        const key = `${a}->${b}`;
        if (drawnPairs.has(key)) continue;
        drawnPairs.add(key);
        const p1 = pt(a);
        const p2 = pt(b);
        edges += `<path d="M${p1.x.toFixed(1)},${p1.y.toFixed(1)} Q${((p1.x + p2.x) / 2).toFixed(1)},${(Math.min(p1.y, p2.y) - 12).toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}" fill="none" stroke="rgba(34,211,238,0.55)" stroke-width="1.6" />`;
      }
    });

    const dots = s.nodes
      .map((n) => {
        const p = pt(n.index);
        const color = n.isSink
          ? '#f43f5e'
          : n.isCouplingPoint
          ? '#10b981'
          : n.isEntryCandidate
          ? '#f5c451'
          : n.hitCount > 0
          ? '#22d3ee'
          : '#334155';
        const rad = n.isSink ? 6.5 : n.isCouplingPoint ? 5.5 : n.hitCount > 0 ? 4 : 2.5;
        return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${rad}" fill="${color}" />`;
      })
      .join('');

    wrap.innerHTML = `
      <svg width="100%" viewBox="0 0 ${W} ${H}">
        ${edges}
        ${dots}
      </svg>
      <div style="font-size:0.73rem; color:#94a3b8; display:flex; gap:12px; flex-wrap:wrap; margin-top:4px;">
        <span>🟡 12 Từ khởi hành</span>
        <span>🟢 Điểm hợp lưu đầu tiên (#${s.firstCouplingIndex + 1}: "${escapeHtml(s.nodes[s.firstCouplingIndex].cleanWord)}")</span>
        <span>🔴 Hố đen kết thúc (#${s.dominantFinalIndex + 1}: "${escapeHtml(s.predictedWord)}")</span>
      </div>
    `;
  }

  async function initMatrixForce() {
    const { matrix } = await apiFetch('/api/tricks/matrix-force', {
      method: 'POST',
      body: JSON.stringify({})
    });
    state.matrixForce = matrix;
    state.matrixPicked = [];
    document.getElementById('matrix-sha-hash').textContent = matrix.commitment.commitmentHash;
    document.getElementById('matrix-reveal-banner').hidden = true;
    renderMatrixForceBoard();
  }

  function renderMatrixForceBoard() {
    const m = state.matrixForce;
    const board = document.getElementById('matrix-force-board');
    board.innerHTML = '';

    const usedRows = new Set(state.matrixPicked.map((p) => p.r));
    const usedCols = new Set(state.matrixPicked.map((p) => p.c));

    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const isPicked = state.matrixPicked.some((p) => p.r === r && p.c === c);
        const isLocked = !isPicked && (usedRows.has(r) || usedCols.has(c));
        const val = m.grid[r][c];

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `matrix-cell ${isPicked ? 'picked' : ''} ${isLocked ? 'locked' : ''}`;
        btn.disabled = isLocked;
        btn.innerHTML = `
          <div>${val}</div>
          <div class="cell-xray-decomp">${m.rowGenerators[r]} + ${m.colGenerators[c]}</div>
        `;
        btn.addEventListener('click', () => {
          if (isPicked) {
            state.matrixPicked = state.matrixPicked.filter((p) => !(p.r === r && p.c === c));
          } else if (state.matrixPicked.length < 4) {
            state.matrixPicked.push({ r, c, val });
          }
          playStageFx('click');
          renderMatrixForceBoard();
        });
        board.appendChild(btn);
      }
    }

    const liveSum = state.matrixPicked.reduce((acc, p) => acc + p.val, 0);
    document.getElementById('matrix-picked-info').textContent = `${state.matrixPicked.length} / 4 ô`;
    document.getElementById('matrix-live-sum').textContent =
      state.matrixPicked.length > 0 ? String(liveSum) : '?';
    document.getElementById('btn-matrix-reveal').disabled = state.matrixPicked.length !== 4;
  }

  async function generateMagicSquare() {
    const payload =
      state.magicSquareMode === 'ramanujan_birthday'
        ? {
            mode: 'ramanujan_birthday',
            day: Number(document.getElementById('msq-day').value),
            month: Number(document.getElementById('msq-month').value),
            century: Number(document.getElementById('msq-century').value),
            year: Number(document.getElementById('msq-year').value)
          }
        : {
            mode: 'target_sum',
            targetSum: Number(document.getElementById('msq-target-sum').value)
          };

    try {
      const { square } = await apiFetch('/api/tricks/magic-square', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      state.magicSquareData = square;
      renderMagicSquareDisplay();
    } catch (err) {
      showToast(err.message);
    }
  }

  function isCellHighlighted(r, c, hlMode) {
    if (hlMode === 'row0') return r === 0;
    if (hlMode === 'col0') return c === 0;
    if (hlMode === 'diag1') return r === c;
    if (hlMode === 'diag2') return r + c === 3;
    if (hlMode === 'corners') return (r === 0 || r === 3) && (c === 0 || c === 3);
    if (hlMode === 'center') return (r === 1 || r === 2) && (c === 1 || c === 2);
    return false;
  }

  function renderMagicSquareDisplay() {
    const sq = state.magicSquareData;
    if (!sq) return;
    const sumVal = sq.mode === 'ramanujan_birthday' ? sq.magicSum : sq.targetSum;
    const cells = [];
    const highlightedValues = [];

    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const hl = isCellHighlighted(r, c, state.magicHighlight);
        if (hl) highlightedValues.push(sq.grid[r][c]);
        cells.push(`<div class="msq-tile ${hl ? 'hl-active' : ''}">${sq.grid[r][c]}</div>`);
      }
    }

    document.getElementById('magic-square-display').innerHTML = `
      <div class="msq-grid">${cells.join('')}</div>
      <div class="msq-sum-caption">
        Phép kiểm chứng đang soi: <code>${highlightedValues.join(' + ')} = ${sumVal}</code> ✨ (Mọi hàng, cột, chéo, 4 góc, tâm 2×2 đều = <strong>${sumVal}</strong>!)
      </div>
    `;
  }

  function exportMagicSquarePng() {
    const sq = state.magicSquareData;
    if (!sq) return;
    const sumVal = sq.mode === 'ramanujan_birthday' ? sq.magicSum : sq.targetSum;
    const c = document.createElement('canvas');
    c.width = 640;
    c.height = 680;
    const ctx = c.getContext('2d');

    ctx.fillStyle = '#110d20';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = '#f5c451';
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, 600, 640);

    ctx.fillStyle = '#fef08a';
    ctx.textAlign = 'center';
    ctx.font = '700 26px "Be Vietnam Pro", sans-serif';
    ctx.fillText('BÙA MA PHƯƠNG ĐỊNH MỆNH • ARCANAMIND', 320, 72);
    ctx.font = '600 18px "JetBrains Mono", monospace';
    ctx.fillStyle = '#22d3ee';
    ctx.fillText(`HẰNG SỐ KỲ DIỆU = ${sumVal}`, 320, 106);

    const startX = 80;
    const startY = 140;
    const cellS = 115;
    for (let r = 0; r < 4; r++) {
      for (let col = 0; col < 4; col++) {
        const x = startX + col * (cellS + 6);
        const y = startY + r * (cellS + 6);
        ctx.fillStyle = r === 0 && sq.mode === 'ramanujan_birthday' ? 'rgba(245,196,81,0.22)' : '#1d1734';
        ctx.fillRect(x, y, cellS, cellS);
        ctx.strokeStyle = 'rgba(245,196,81,0.5)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, cellS, cellS);

        ctx.fillStyle = '#ffffff';
        ctx.font = '800 34px "JetBrains Mono", monospace';
        ctx.fillText(String(sq.grid[r][col]), x + cellS / 2, y + 68);
      }
    }

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '500 14px "Be Vietnam Pro", sans-serif';
    ctx.fillText('Tổng mọi Hàng ngang • Cột dọc • 2 Đường chéo • 4 Góc • Tâm 2×2 đều bằng ' + sumVal, 320, 642);

    const a = document.createElement('a');
    a.download = `ArcanaMind_MagicSquare_${sumVal}.png`;
    a.href = c.toDataURL('image/png');
    a.click();
  }

  function bindAct3KruskalAndSquares() {
    document.querySelectorAll('[data-act3-sub]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-act3-sub]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const sub = btn.dataset.act3Sub;
        document.getElementById('act3-kruskal-view').hidden = sub !== 'kruskal';
        document.getElementById('act3-squares-view').hidden = sub !== 'squares';
      });
    });

    const pSelect = document.getElementById('kruskal-passage-select');
    pSelect.addEventListener('change', () => {
      const val = pSelect.value;
      document.getElementById('kruskal-custom-box').hidden = val !== 'custom';
      if (val !== 'custom') {
        loadKruskalPassage({ passageId: val });
      }
    });

    document.getElementById('kruskal-trace-toggle').addEventListener('change', () => {
      renderKruskalWords();
    });

    document.getElementById('btn-kruskal-analyze-custom').addEventListener('click', async () => {
      const txt = document.getElementById('kruskal-custom-input').value;
      try {
        await loadKruskalPassage({ customText: txt, entryWordCount: 10 });
        showToast('🔬 Đã phân tích Xích Markov và khóa niêm phong SHA-256!');
      } catch (err) {
        showToast(err.message);
      }
    });

    document.getElementById('btn-kruskal-unseal').addEventListener('click', () => {
      if (!state.kruskalSession) return;
      state.kruskalUnsealed = true;
      playStageFx('reveal');
      document.getElementById('kruskal-sealed-view').hidden = true;
      document.getElementById('kruskal-unsealed-view').hidden = false;
      document.getElementById('kruskal-revealed-word').textContent = state.kruskalSession.predictedWord;
      document.getElementById('kruskal-reveal-raw').textContent =
        state.kruskalSession.commitment.revealString;
      renderKruskalWords();
    });

    document.getElementById('btn-kruskal-verify-sha').addEventListener('click', async () => {
      const c = state.kruskalSession.commitment;
      const [secretPayload, nonce] = c.revealString.split('::');
      const { verification } = await apiFetch('/api/tricks/commitment/verify', {
        method: 'POST',
        body: JSON.stringify({
          secretPayload,
          nonce,
          expectedHash: c.commitmentHash
        })
      });
      const badge = document.getElementById('kruskal-verify-badge');
      badge.hidden = false;
      badge.textContent = verification.valid
        ? '✔ SHA-256 KHỚP 100% — CHỨNG MINH KHÔNG HỀ ĐỔI ĐÁP ÁN SAU KHI CHƠI!'
        : '❌ Sai lệch chữ ký!';
    });

    document.getElementById('btn-kruskal-reseal').addEventListener('click', () => {
      const val = pSelect.value;
      if (val === 'custom') {
        loadKruskalPassage({
          customText: document.getElementById('kruskal-custom-input').value,
          entryWordCount: 10
        });
      } else {
        loadKruskalPassage({ passageId: val });
      }
    });

    // Matrix Force
    document.getElementById('btn-matrix-new').addEventListener('click', initMatrixForce);
    document.getElementById('btn-matrix-reveal').addEventListener('click', () => {
      const m = state.matrixForce;
      const userSum = state.matrixPicked.reduce((a, p) => a + p.val, 0);
      playStageFx('reveal');
      const banner = document.getElementById('matrix-reveal-banner');
      banner.hidden = false;
      banner.innerHTML = `
        ✨ <strong>TRÙNG KHỚP TUYỆT ĐỐI!</strong> Tổng 4 ô bạn tự chọn là <strong>${userSum}</strong> — khớp 100% với lời tiên tri đã khóa SHA-256: <code>${escapeHtml(m.commitment.revealString)}</code>!
      `;
    });

    // Magic Squares
    document.querySelectorAll('[data-msq-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-msq-mode]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.magicSquareMode = btn.dataset.msqMode;
        document.getElementById('msq-birthday-inputs').hidden =
          state.magicSquareMode !== 'ramanujan_birthday';
        document.getElementById('msq-target-inputs').hidden =
          state.magicSquareMode !== 'target_sum';
        generateMagicSquare();
      });
    });

    document.getElementById('btn-msq-generate-bday').addEventListener('click', () => {
      playStageFx('reveal');
      generateMagicSquare();
    });
    document.getElementById('btn-msq-generate-target').addEventListener('click', () => {
      playStageFx('reveal');
      generateMagicSquare();
    });

    document.querySelectorAll('#msq-highlight-btns .mini-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('#msq-highlight-btns .mini-pill').forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        state.magicHighlight = pill.dataset.hl;
        renderMagicSquareDisplay();
      });
    });

    document.getElementById('btn-msq-export-png').addEventListener('click', exportMagicSquarePng);
  }

  // =========================================================================
  // 6. LIVE TWO-DEVICE TELEPATHY STAGE ROOM (SSE)
  // =========================================================================
  function appendRoomLog(text) {
    const feed = document.getElementById('live-room-feed');
    const div = document.createElement('div');
    div.className = 'log-line';
    div.textContent = `[${new Date().toLocaleTimeString('vi-VN')}] ${text}`;
    feed.prepend(div);
  }

  function connectStageRoom(code) {
    const clean = String(code || '').trim().toUpperCase();
    if (!clean) return;
    if (state.sseSource) state.sseSource.close();

    const es = new EventSource(`/api/stage/events?room=${encodeURIComponent(clean)}`);
    state.sseSource = es;
    state.roomCode = clean;

    document.getElementById('live-room-details').hidden = false;
    document.getElementById('modal-room-code').textContent = clean;
    document.getElementById('hdr-room-code').textContent = clean;
    document.getElementById('live-room-indicator').hidden = false;

    const shareUrl = `${window.location.origin}/?room=${clean}`;
    document.getElementById('modal-room-url').value = shareUrl;

    es.addEventListener('connected', (ev) => {
      const d = JSON.parse(ev.data);
      document.getElementById('modal-room-viewers').textContent = String(d.viewers);
      appendRoomLog(`Đã kết nối thành công vào phòng diễn ${clean}.`);
    });

    es.addEventListener('presence', (ev) => {
      const d = JSON.parse(ev.data);
      document.getElementById('modal-room-viewers').textContent = String(d.viewers);
    });

    es.addEventListener('hamming_solved', (ev) => {
      const d = JSON.parse(ev.data);
      playStageFx('reveal');
      const msg = d.result.valid
        ? `🔮 Tín hiệu từ ${d.playerName}: Nghĩ số ${d.result.secretNumber} (${d.result.liedCardNumber ? 'Nói dối ở Lá #' + d.result.liedCardNumber : 'Nói thật 100%'})!`
        : `⚠ Khán giả ${d.playerName} đã nói dối nhiều hơn 1 lần!`;
      appendRoomLog(msg);
      showToast(msg);
    });

    es.addEventListener('fitch_four_cards_placed', (ev) => {
      const d = JSON.parse(ev.data);
      playStageFx('reveal');
      const cardsText = d.visibleCards.map((c) => c.display).join('  ');
      appendRoomLog(`🃏 Trợ lý từ xa vừa đặt 4 lá ngửa: [ ${cardsText} ]!`);
      showToast(`🃏 Đã nhận 4 lá bài từ xa: ${cardsText}`);
    });
  }

  function bindLiveStageModal() {
    document.getElementById('btn-create-room').addEventListener('click', async () => {
      const { roomCode } = await apiFetch('/api/stage/create', { method: 'POST', body: '{}' });
      connectStageRoom(roomCode);
    });

    document.getElementById('btn-join-room').addEventListener('click', () => {
      const code = document.getElementById('input-join-room').value;
      connectStageRoom(code);
    });

    document.getElementById('btn-copy-room-url').addEventListener('click', () => {
      const urlInput = document.getElementById('modal-room-url');
      navigator.clipboard?.writeText(urlInput.value);
      showToast('📋 Đã sao chép đường dẫn Phòng diễn đôi!');
    });

    const urlRoom = new URLSearchParams(window.location.search).get('room');
    if (urlRoom) {
      connectStageRoom(urlRoom);
    }
  }

  // =========================================================================
  // 7. BOOTSTRAP STUDIO
  // =========================================================================
  async function boot() {
    bindGlobalControls();
    bindAct1Hamming();
    bindAct2Fitch();
    bindAct3KruskalAndSquares();
    bindLiveStageModal();

    // Initialize Canvas Optical Engines (Acts IV & V)
    new window.ArcanaIllusions.ScanimationStudio();
    new window.ArcanaIllusions.CortexIllusionLab();
    new window.ArcanaIllusions.ShepardAndBenchmark(async (bm) => {
      playStageFx('reveal');
      await apiFetch('/api/records', {
        method: 'POST',
        body: JSON.stringify({
          category: 'cortex_benchmark',
          playerName: bm.playerName,
          trickMode: 'Müller-Lyer + Ebbinghaus',
          score: bm.immunity,
          durationMs: 0,
          detail: {
            mullerErrorPct: bm.mullerErrPct,
            ebbinghausErrorPct: bm.ebbErrPct,
            note: `Độ kháng ảo giác ${bm.immunity}%`
          }
        })
      });
      refreshHeaderMetrics();
    });

    await Promise.all([
      loadHammingMode('classic_15'),
      initAct2Fitch(),
      loadKruskalPassage({ passageId: 'mirror_sanctum' }),
      initMatrixForce(),
      generateMagicSquare(),
      refreshHeaderMetrics()
    ]);
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
