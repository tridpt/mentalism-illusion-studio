/**
 * ArcanaMind — Persistence & Hall of Records Storage (SQLite with JSON Fallback)
 * Stores:
 *  - Mind-reading & Magician Trainer records (Hamming, Fitch Cheney speed runs)
 *  - Visual Cortex Perceptual Bias Benchmarks (Müller-Lyer & Ebbinghaus error %)
 *  - Cryptographic Prophecy Ledger
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

class StudioStorage {
  constructor(dbPath = path.join(DATA_DIR, 'arcanamind.db')) {
    this.dbPath = dbPath;
    this.jsonFallbackPath = path.join(DATA_DIR, 'arcanamind_fallback.json');
    this.db = null;
    this.usingSqlite = false;

    try {
      const { DatabaseSync } = require('node:sqlite');
      this.db = new DatabaseSync(this.dbPath);
      this.db.exec(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          category TEXT NOT NULL,
          player_name TEXT NOT NULL,
          trick_mode TEXT NOT NULL,
          score REAL NOT NULL DEFAULT 0,
          duration_ms INTEGER NOT NULL DEFAULT 0,
          detail_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL
        );
      `);
      this.usingSqlite = true;
      this._seedIfEmpty();
    } catch (_err) {
      this.usingSqlite = false;
      if (!fs.existsSync(this.jsonFallbackPath)) {
        fs.writeFileSync(this.jsonFallbackPath, JSON.stringify({ records: [] }, null, 2), 'utf8');
      }
      this._seedIfEmpty();
    }
  }

  _seedIfEmpty() {
    const current = this.listRecords(null, 5);
    if (current.length > 0) return;

    const seeds = [
      {
        category: 'fitch_trainer',
        playerName: 'Pháp Sư Orion',
        trickMode: '52-Card Blind Decode',
        score: 6,
        durationMs: 4280,
        detail: { streak: 6, note: 'Giải mã 4 lá bài trong 4.28s' }
      },
      {
        category: 'cortex_benchmark',
        playerName: 'Thị Giác Gia Luna',
        trickMode: 'Müller-Lyer + Ebbinghaus',
        score: 96.4,
        durationMs: 12400,
        detail: { mullerErrorPct: 4.1, ebbinghausErrorPct: 3.1, note: 'Độ kháng ảo giác 96.4%' }
      },
      {
        category: 'hamming_mindread',
        playerName: 'Khán Giả Ẩn Danh',
        trickMode: 'birthday_31',
        score: 100,
        durationMs: 18500,
        detail: { secretNumber: 23, liedCardNumber: 6, note: 'Bắt sống lời nói dối ở Lá VI' }
      }
    ];

    for (const s of seeds) {
      this.addRecord(s);
    }
  }

  addRecord({ category, playerName = 'Khán Giả Bí Ẩn', trickMode = 'standard', score = 0, durationMs = 0, detail = {} }) {
    const safeName = String(playerName || 'Khán Giả Bí Ẩn').trim().slice(0, 40) || 'Khán Giả Bí Ẩn';
    const createdAt = new Date().toISOString();
    const detailStr = JSON.stringify(detail || {});

    if (this.usingSqlite) {
      const stmt = this.db.prepare(`
        INSERT INTO records (category, player_name, trick_mode, score, duration_ms, detail_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const info = stmt.run(
        String(category),
        safeName,
        String(trickMode),
        Number(score) || 0,
        Math.round(Number(durationMs) || 0),
        detailStr,
        createdAt
      );
      return {
        id: Number(info.lastInsertRowid),
        category,
        playerName: safeName,
        trickMode,
        score: Number(score) || 0,
        durationMs: Math.round(Number(durationMs) || 0),
        detail,
        createdAt
      };
    }

    const store = JSON.parse(fs.readFileSync(this.jsonFallbackPath, 'utf8'));
    const nextId = (store.records.at(-1)?.id || 0) + 1;
    const rec = {
      id: nextId,
      category: String(category),
      playerName: safeName,
      trickMode: String(trickMode),
      score: Number(score) || 0,
      durationMs: Math.round(Number(durationMs) || 0),
      detail,
      createdAt
    };
    store.records.push(rec);
    fs.writeFileSync(this.jsonFallbackPath, JSON.stringify(store, null, 2), 'utf8');
    return rec;
  }

  listRecords(category = null, limit = 25) {
    const maxRows = Math.max(1, Math.min(100, Number(limit) || 25));
    if (this.usingSqlite) {
      const rows = category
        ? this.db
            .prepare(
              `SELECT * FROM records WHERE category = ? ORDER BY score DESC, duration_ms ASC, id DESC LIMIT ?`
            )
            .all(String(category), maxRows)
        : this.db
            .prepare(`SELECT * FROM records ORDER BY id DESC LIMIT ?`)
            .all(maxRows);

      return rows.map((r) => ({
        id: r.id,
        category: r.category,
        playerName: r.player_name,
        trickMode: r.trick_mode,
        score: r.score,
        durationMs: r.duration_ms,
        detail: JSON.parse(r.detail_json || '{}'),
        createdAt: r.created_at
      }));
    }

    const store = JSON.parse(fs.readFileSync(this.jsonFallbackPath, 'utf8'));
    let list = [...store.records];
    if (category) {
      list = list.filter((r) => r.category === category).sort((a, b) => b.score - a.score || a.durationMs - b.durationMs);
    } else {
      list.reverse();
    }
    return list.slice(0, maxRows);
  }

  getSummaryStats() {
    const all = this.listRecords(null, 100);
    const fitch = this.listRecords('fitch_trainer', 10);
    const cortex = this.listRecords('cortex_benchmark', 10);
    const avgCortexScore =
      cortex.length > 0
        ? Number((cortex.reduce((acc, r) => acc + r.score, 0) / cortex.length).toFixed(1))
        : 95.0;

    return {
      storageEngine: this.usingSqlite ? 'SQLite Native (WAL)' : 'JSON Atomic Fallback',
      totalSessionsRecorded: all.length,
      topMagicianStreak: fitch[0]?.score || 0,
      fastestDecodeMs: fitch[0]?.durationMs || 0,
      avgCortexImmunityPct: avgCortexScore,
      recentRecords: all.slice(0, 12),
      fitchLeaderboard: fitch,
      cortexLeaderboard: cortex
    };
  }
}

module.exports = { StudioStorage };
