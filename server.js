/**
 * 🎩✨ ArcanaMind — Sân Khấu Ảo Thuật Toán Học, Đọc Vị Suy Nghĩ & Xưởng Ảo Giác Quang Học (Port 4155)
 * Zero-dependency Node.js Server (Native HTTP + Crypto + SQLite WAL + Realtime SSE Stage Link)
 */

'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');

const { getHammingDeck, solveHammingAnswers } = require('./lib/hammingEngine');
const {
  DECK_LIST,
  PERMUTATION_TABLE,
  SUITS,
  RANKS,
  encodeFiveCards,
  decodeFourCards,
  generateTrainerRound
} = require('./lib/fitchCheneyEngine');
const {
  verifySha256Commitment,
  getBuiltinKruskalPassages,
  loadKruskalSession,
  createConstantSumMatrix,
  createTargetMagicSquare,
  createRamanujanBirthdaySquare
} = require('./lib/kruskalMatrixEngine');
const {
  simulateParrondoParadox,
  runGilbreathExperiment,
  planFaroControl,
  analyzeCitReactionTrials
} = require('./lib/cardParadoxEngine');
const { StudioStorage } = require('./lib/storage');

const DEFAULT_PORT = Number(process.env.PORT || 4155);
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readJsonBody(req, maxBytes = 1024 * 512) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let bytes = 0;
    req.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > maxBytes) {
        reject(new Error('Dữ liệu gửi lên vượt quá giới hạn cho phép.'));
        req.destroy();
        return;
      }
      raw += chunk.toString('utf8');
    });
    req.on('end', () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (_err) {
        reject(new Error('Định dạng JSON không hợp lệ.'));
      }
    });
    req.on('error', reject);
  });
}

function createStudioServer(options = {}) {
  const storage = options.storage || new StudioStorage(options.dbPath);
  const startedAt = Date.now();

  // Live Two-Device Telepathy Stage Rooms (RoomCode -> { code, createdAt, state, clients: Set<res> })
  const stageRooms = new Map();

  function broadcastRoom(roomCode, eventName, data) {
    const room = stageRooms.get(roomCode);
    if (!room) return;
    const msg = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const clientRes of room.clients) {
      try {
        clientRes.write(msg);
      } catch (_e) {
        room.clients.delete(clientRes);
      }
    }
  }

  // Cleanup stale rooms older than 4 hours periodically
  const cleanupTimer = setInterval(() => {
    const cutoff = Date.now() - 4 * 3600 * 1000;
    for (const [code, room] of stageRooms.entries()) {
      if (room.createdAt < cutoff) {
        for (const c of room.clients) {
          try {
            c.end();
          } catch (_e) {}
        }
        stageRooms.delete(code);
      }
    }
  }, 10 * 60 * 1000);
  cleanupTimer.unref();

  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end();
        return;
      }

      const urlObj = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const pathname = urlObj.pathname;

      // ======================================================================
      // 1. HEALTH & SYSTEM TELEMETRY
      // ======================================================================
      if (req.method === 'GET' && pathname === '/api/health') {
        const stats = storage.getSummaryStats();
        sendJson(res, 200, {
          ok: true,
          service: 'ArcanaMind — Mentalism & Illusion Studio',
          port: server.address()?.port || DEFAULT_PORT,
          uptimeSec: Math.round((Date.now() - startedAt) / 1000),
          storageEngine: stats.storageEngine,
          activeStageRooms: stageRooms.size
        });
        return;
      }

      // ======================================================================
      // 2. ACT I: HAMMING LIE-DETECTING MIND READER
      // ======================================================================
      if (req.method === 'GET' && pathname === '/api/tricks/hamming/deck') {
        const mode = urlObj.searchParams.get('mode') || 'classic_15';
        const deck = getHammingDeck(mode);
        sendJson(res, 200, { ok: true, deck });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/tricks/hamming/solve') {
        const body = await readJsonBody(req);
        const result = solveHammingAnswers(body.mode || 'classic_15', body.answers);
        if (result.valid && body.saveRecord !== false) {
          storage.addRecord({
            category: 'hamming_mindread',
            playerName: body.playerName || 'Khán Giả Sân Khấu',
            trickMode: result.mode,
            score: 100,
            durationMs: Number(body.durationMs) || 0,
            detail: {
              secretNumber: result.secretNumber,
              liedCardNumber: result.liedCardNumber,
              toldTruthAll: result.toldTruthAll
            }
          });
        }
        if (body.roomCode && stageRooms.has(String(body.roomCode).toUpperCase())) {
          broadcastRoom(String(body.roomCode).toUpperCase(), 'hamming_solved', {
            playerName: body.playerName || 'Khán Giả Từ Xa',
            result
          });
        }
        sendJson(res, 200, { ok: true, result });
        return;
      }

      // ======================================================================
      // 3. ACT II: FITCH CHENEY'S 5-CARD TELEPATHY
      // ======================================================================
      if (req.method === 'GET' && pathname === '/api/tricks/fitch-cheney/deck') {
        sendJson(res, 200, {
          ok: true,
          suits: SUITS,
          ranks: RANKS,
          permutationTable: PERMUTATION_TABLE,
          cards: DECK_LIST
        });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/tricks/fitch-cheney/encode') {
        const body = await readJsonBody(req);
        const encoded = encodeFiveCards(body.cardIds);
        if (body.roomCode && stageRooms.has(String(body.roomCode).toUpperCase())) {
          // Broadcast ONLY the 4 visible cards to the Magician screen!
          broadcastRoom(String(body.roomCode).toUpperCase(), 'fitch_four_cards_placed', {
            visibleCards: encoded.visibleCards,
            visibleCardIds: encoded.visibleCardIds,
            sentAt: new Date().toISOString()
          });
        }
        sendJson(res, 200, { ok: true, encoded });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/tricks/fitch-cheney/decode') {
        const body = await readJsonBody(req);
        // Pure blind decode: ONLY receives the 4 visible card IDs!
        const decoded = decodeFourCards(body.visibleCardIds);
        sendJson(res, 200, { ok: true, decoded });
        return;
      }

      if (req.method === 'GET' && pathname === '/api/tricks/fitch-cheney/trainer-round') {
        const round = generateTrainerRound();
        sendJson(res, 200, { ok: true, round });
        return;
      }

      // ======================================================================
      // 4. ACT III: KRUSKAL MARKOV CONVERGENCE & MAGIC SQUARES
      // ======================================================================
      if (req.method === 'GET' && pathname === '/api/tricks/kruskal/passages') {
        sendJson(res, 200, {
          ok: true,
          passages: getBuiltinKruskalPassages()
        });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/tricks/kruskal/session') {
        const body = await readJsonBody(req);
        const session = body.customText
          ? loadKruskalSession({
              customText: body.customText,
              entryWordCount: body.entryWordCount
            })
          : loadKruskalSession(body.passageId || 'mirror_sanctum');
        sendJson(res, 200, { ok: true, session });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/tricks/commitment/verify') {
        const body = await readJsonBody(req);
        const verification = verifySha256Commitment(
          String(body.secretPayload || ''),
          String(body.nonce || ''),
          String(body.expectedHash || '')
        );
        sendJson(res, 200, { ok: true, verification });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/tricks/matrix-force') {
        const body = await readJsonBody(req);
        const matrix = createConstantSumMatrix(
          body.targetSum !== undefined && body.targetSum !== '' ? Number(body.targetSum) : null
        );
        sendJson(res, 200, { ok: true, matrix });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/tricks/magic-square') {
        const body = await readJsonBody(req);
        if (body.mode === 'ramanujan_birthday') {
          const square = createRamanujanBirthdaySquare(
            body.day ?? 18,
            body.month ?? 11,
            body.century ?? 20,
            body.year ?? 26
          );
          sendJson(res, 200, { ok: true, square });
        } else {
          const square = createTargetMagicSquare(body.targetSum ?? 2026);
          sendJson(res, 200, { ok: true, square });
        }
        return;
      }

      // ======================================================================
      // 4B. ACT VII & VIII (v2.0): PARRONDO, GILBREATH, FARO & CIT POLYGRAPH
      // ======================================================================
      if (req.method === 'POST' && pathname === '/api/tricks/parrondo/simulate') {
        const body = await readJsonBody(req);
        const simulation = simulateParrondoParadox(body);
        sendJson(res, 200, { ok: true, simulation });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/tricks/gilbreath/run') {
        const body = await readJsonBody(req);
        const experiment = runGilbreathExperiment(body);
        sendJson(res, 200, { ok: true, experiment });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/tricks/faro/plan') {
        const body = await readJsonBody(req);
        const plan = planFaroControl(body.startPos ?? 0, body.targetPos ?? 29);
        sendJson(res, 200, { ok: true, plan });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/tricks/cit-polygraph/analyze') {
        const body = await readJsonBody(req);
        const report = analyzeCitReactionTrials(body.trials, body.suspectIds);
        if (body.saveRecord !== false) {
          storage.addRecord({
            category: 'cit_polygraph',
            playerName: body.playerName || 'Đối Tượng Thẩm Vấn',
            trickMode: 'CIT Micro-Hesitation',
            score: report.topSuspect.probabilityPct,
            durationMs: Math.round(report.baselineMedianRtMs),
            detail: {
              predictedId: report.topSuspect.itemId,
              zScore: report.topSuspect.zScore,
              note: `Phát hiện vật giấu "${report.topSuspect.itemId}" (Z=${report.topSuspect.zScore}, P=${report.topSuspect.probabilityPct}%)`
            }
          });
        }
        if (body.roomCode && stageRooms.has(String(body.roomCode).toUpperCase())) {
          broadcastRoom(String(body.roomCode).toUpperCase(), 'cit_solved', {
            playerName: body.playerName || 'Khán Giả Từ Xa',
            report
          });
        }
        sendJson(res, 200, { ok: true, report });
        return;
      }

      // ======================================================================
      // 5. HALL OF RECORDS & CORTEX BIAS BENCHMARKS
      // ======================================================================
      if (req.method === 'GET' && pathname === '/api/records') {
        sendJson(res, 200, {
          ok: true,
          stats: storage.getSummaryStats()
        });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/records') {
        const body = await readJsonBody(req);
        if (!body.category) {
          sendJson(res, 400, { ok: false, error: 'Thiếu trường category.' });
          return;
        }
        const saved = storage.addRecord({
          category: body.category,
          playerName: body.playerName,
          trickMode: body.trickMode,
          score: body.score,
          durationMs: body.durationMs,
          detail: body.detail
        });
        sendJson(res, 201, { ok: true, record: saved, stats: storage.getSummaryStats() });
        return;
      }

      // ======================================================================
      // 6. LIVE TWO-DEVICE TELEPATHY STAGE ROOM (SSE)
      // ======================================================================
      if (req.method === 'POST' && pathname === '/api/stage/create') {
        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 4; i++) {
          code += alphabet[crypto.randomInt(0, alphabet.length)];
        }
        stageRooms.set(code, {
          code,
          createdAt: Date.now(),
          clients: new Set()
        });
        sendJson(res, 201, { ok: true, roomCode: code });
        return;
      }

      if (req.method === 'GET' && pathname === '/api/stage/events') {
        const code = String(urlObj.searchParams.get('room') || '').trim().toUpperCase();
        if (!code || !stageRooms.has(code)) {
          sendJson(res, 404, { ok: false, error: 'Phòng diễn không tồn tại hoặc đã hết hạn.' });
          return;
        }
        const room = stageRooms.get(code);
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'Access-Control-Allow-Origin': '*'
        });
        res.write(`event: connected\ndata: ${JSON.stringify({ roomCode: code, viewers: room.clients.size + 1 })}\n\n`);
        room.clients.add(res);
        broadcastRoom(code, 'presence', { viewers: room.clients.size });

        req.on('close', () => {
          room.clients.delete(res);
          broadcastRoom(code, 'presence', { viewers: room.clients.size });
        });
        return;
      }

      // ======================================================================
      // 7. STATIC FRONTEND SERVER
      // ======================================================================
      let relPath = pathname === '/' ? '/index.html' : pathname;
      relPath = path.normalize(relPath).replace(/^(\.\.[/\\])+/, '');
      const filePath = path.join(PUBLIC_DIR, relPath);

      if (!filePath.startsWith(PUBLIC_DIR)) {
        sendJson(res, 403, { ok: false, error: 'Truy cập bị từ chối.' });
        return;
      }

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': 'no-cache'
        });
        fs.createReadStream(filePath).pipe(res);
        return;
      }

      sendJson(res, 404, { ok: false, error: `Không tìm thấy đường dẫn: ${pathname}` });
    } catch (err) {
      sendJson(res, 400, {
        ok: false,
        error: err.message || 'Lỗi xử lý yêu cầu tại máy chủ ArcanaMind.'
      });
    }
  });

  return { server, storage, stageRooms };
}

if (require.main === module) {
  const { server } = createStudioServer();
  server.listen(DEFAULT_PORT, '0.0.0.0', () => {
    console.log('============================================================');
    console.log(' 🎩✨ ArcanaMind — Mentalism & Optical Illusion Studio');
    console.log(` 🌐 Local URL : http://localhost:${DEFAULT_PORT}`);
    console.log(' 🔦 Modes     : Stage Performance + X-Ray Math Reveal');
    console.log('============================================================');
  });
}

module.exports = { createStudioServer };
