/**
 * 🎩✨ ArcanaMind v2.0 — Acts VI, VII & VIII Frontend Engines
 *  - Act VI  : MIT Spatial-Frequency Hybrid Images (Einstein-Marilyn) & 3D Autostereogram + Disparity Decoder
 *  - Act VII : Parrondo's Paradox Casino, Gilbreath's Riffle Invariant & Diaconis Binary Faro Controller
 *  - Act VIII: Cognitive Micro-Hesitation & Concealed Information Polygraph (0.1ms CIT-RT)
 */

(function () {
  'use strict';

  async function postJson(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
    const data = await res.json();
    if (!res.ok || data.ok === false) {
      throw new Error(data.error || 'Lỗi kết nối máy chủ ArcanaMind');
    }
    return data;
  }

  // =========================================================================
  // 1. ACT VI: SPATIAL-FREQUENCY HYBRID IMAGE & 3D AUTOSTEREOGRAM STUDIO
  // =========================================================================
  function buildGaussianKernel(sigma) {
    const s = Math.max(0.6, sigma);
    const radius = Math.min(45, Math.ceil(s * 2.6));
    const size = radius * 2 + 1;
    const kernel = new Float32Array(size);
    let sum = 0;
    for (let i = -radius; i <= radius; i++) {
      const w = Math.exp(-(i * i) / (2 * s * s));
      kernel[i + radius] = w;
      sum += w;
    }
    for (let i = 0; i < size; i++) kernel[i] /= sum;
    return { kernel, radius };
  }

  function gaussianBlurFloat32(src, w, h, sigma) {
    const { kernel, radius } = buildGaussianKernel(sigma);
    const tmp = new Float32Array(w * h);
    const dst = new Float32Array(w * h);

    // Horizontal pass
    for (let y = 0; y < h; y++) {
      const rowOff = y * w;
      for (let x = 0; x < w; x++) {
        let acc = 0;
        for (let k = -radius; k <= radius; k++) {
          const sx = Math.max(0, Math.min(w - 1, x + k));
          acc += src[rowOff + sx] * kernel[k + radius];
        }
        tmp[rowOff + x] = acc;
      }
    }

    // Vertical pass
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let acc = 0;
        for (let k = -radius; k <= radius; k++) {
          const sy = Math.max(0, Math.min(h - 1, y + k));
          acc += tmp[sy * w + x] * kernel[k + radius];
        }
        dst[y * w + x] = acc;
      }
    }
    return dst;
  }

  function canvasToLumaFloat32(canvas) {
    const { width: w, height: h } = canvas;
    const data = canvas.getContext('2d').getImageData(0, 0, w, h).data;
    const out = new Float32Array(w * h);
    for (let i = 0, p = 0; i < out.length; i++, p += 4) {
      out[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
    }
    return out;
  }

  function lumaFloat32ToCanvas(buf, canvas) {
    const { width: w, height: h } = canvas;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let i = 0, p = 0; i < buf.length; i++, p += 4) {
      const v = Math.max(0, Math.min(255, Math.round(buf[i])));
      d[p] = v;
      d[p + 1] = v;
      d[p + 2] = v;
      d[p + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }

  class HybridAndStereogramStudio {
    constructor() {
      this.size = 420;
      this.mainCanvas = document.getElementById('hybrid-main-canvas');
      this.highPreview = document.getElementById('hybrid-high-preview');
      this.lowPreview = document.getElementById('hybrid-low-preview');

      this.nearSource = document.createElement('canvas');
      this.farSource = document.createElement('canvas');
      this.nearSource.width = this.farSource.width = this.size;
      this.nearSource.height = this.farSource.height = this.size;

      this.preset = 'sage_smile';
      this.sigmaLow = 11;
      this.sigmaHigh = 5;
      this.gainHigh = 1.35;
      this.uploadedNearImg = null;
      this.uploadedFarImg = null;

      // Stereogram state
      this.stereoCanvas = document.getElementById('stereogram-canvas');
      this.stereoRawImageData = null;
      this.stereoDecodedMode = false;
      this.stereoShape = 'star3d';

      this._bindEvents();
      this.rebuildSourcesAndSynthesize();
      this.renderStereogram();
    }

    _bindEvents() {
      // Sub-tab switch
      document.querySelectorAll('[data-act6-sub]').forEach((btn) => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('[data-act6-sub]').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          const sub = btn.dataset.act6Sub;
          document.getElementById('act6-hybrid-view').hidden = sub !== 'hybrid';
          document.getElementById('act6-stereogram-view').hidden = sub !== 'stereogram';
        });
      });

      const presetSel = document.getElementById('hybrid-preset-select');
      presetSel.addEventListener('change', () => {
        this.preset = presetSel.value;
        document.getElementById('hybrid-words-bar').hidden = this.preset !== 'secret_words';
        document.getElementById('hybrid-upload-bar').hidden = this.preset !== 'upload_photos';
        if (this.preset !== 'upload_photos') {
          this.rebuildSourcesAndSynthesize();
        }
      });

      document.getElementById('btn-hybrid-render-words').addEventListener('click', () => {
        this.rebuildSourcesAndSynthesize();
      });

      const handlePhotoUpload = (inputEl, isNear) => {
        inputEl.addEventListener('change', (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            const img = new Image();
            img.onload = () => {
              if (isNear) this.uploadedNearImg = img;
              else this.uploadedFarImg = img;
              const readyCount = (this.uploadedNearImg ? 1 : 0) + (this.uploadedFarImg ? 1 : 0);
              document.getElementById('hybrid-upload-status').textContent =
                readyCount === 2 ? '✔ Đã nạp đủ 2 ảnh & trộn phổ thành công!' : `Đã nạp ${readyCount}/2 ảnh...`;
              if (this.uploadedNearImg && this.uploadedFarImg) {
                this.rebuildSourcesAndSynthesize();
              }
            };
            img.src = reader.result;
          };
          reader.readAsDataURL(file);
        });
      };

      handlePhotoUpload(document.getElementById('hybrid-file-near'), true);
      handlePhotoUpload(document.getElementById('hybrid-file-far'), false);

      // Distance & Filter Sliders
      const distSlider = document.getElementById('hybrid-dist-slider');
      distSlider.addEventListener('input', () => {
        const dist = Number(distSlider.value);
        const scale = Math.max(0.14, 0.5 / dist);
        document.getElementById('hybrid-zoom-box').style.transform = `scale(${scale.toFixed(3)})`;
        const tag =
          dist < 0.9 ? '(Nhìn Gần — Thấy Hình A)' : dist > 2.2 ? '(Đứng Xa — Lộ Rõ Hình B!)' : '(Vùng Chuyển Giao)';
        document.getElementById('lbl-hybrid-dist').textContent = `${dist.toFixed(1)} mét ${tag}`;
      });

      document.getElementById('hybrid-low-slider').addEventListener('input', (e) => {
        this.sigmaLow = Number(e.target.value);
        document.getElementById('lbl-hybrid-low').textContent = `${this.sigmaLow} px`;
        this.synthesizeFromSources();
      });

      document.getElementById('hybrid-high-slider').addEventListener('input', (e) => {
        this.sigmaHigh = Number(e.target.value);
        document.getElementById('lbl-hybrid-high').textContent = `${this.sigmaHigh} px`;
        this.synthesizeFromSources();
      });

      document.getElementById('hybrid-gain-slider').addEventListener('input', (e) => {
        this.gainHigh = Number(e.target.value);
        document.getElementById('lbl-hybrid-gain').textContent = `${this.gainHigh.toFixed(2)}x`;
        this.synthesizeFromSources();
      });

      document.getElementById('btn-hybrid-download').addEventListener('click', () => {
        const a = document.createElement('a');
        a.download = `ArcanaMind_Hybrid_${this.preset}.png`;
        a.href = this.mainCanvas.toDataURL('image/png');
        a.click();
      });

      // Stereogram Controls
      const stSel = document.getElementById('stereo-shape-select');
      stSel.addEventListener('change', () => {
        this.stereoShape = stSel.value;
        this.stereoDecodedMode = false;
        document.getElementById('stereo-text-bar').hidden = this.stereoShape !== 'text3d';
        document.getElementById('btn-stereo-decode').textContent = '🔓 Bật Kính Giải Mã X-Ray Tự Động';
        this.renderStereogram();
      });

      document.getElementById('btn-stereo-render-text').addEventListener('click', () => {
        this.stereoDecodedMode = false;
        this.renderStereogram();
      });

      document.getElementById('btn-stereo-decode').addEventListener('click', () => {
        this.stereoDecodedMode = !this.stereoDecodedMode;
        const btn = document.getElementById('btn-stereo-decode');
        if (this.stereoDecodedMode) {
          btn.textContent = '👁️ Quay Lại Tranh Nhiễu 3D Gốc';
          this.decodeStereogramByCrossCorrelation();
        } else {
          btn.textContent = '🔓 Bật Kính Giải Mã X-Ray Tự Động';
          this.stereoCanvas.getContext('2d').putImageData(this.stereoRawImageData, 0, 0);
        }
      });

      document.getElementById('btn-stereo-export').addEventListener('click', () => {
        const a = document.createElement('a');
        a.download = `ArcanaMind_3D_Stereogram_${this.stereoShape}.png`;
        a.href = this.stereoCanvas.toDataURL('image/png');
        a.click();
      });
    }

    _drawCoverImage(ctx, img) {
      const s = this.size;
      const scale = Math.max(s / img.width, s / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      ctx.drawImage(img, (s - dw) / 2, (s - dh) / 2, dw, dh);
    }

    rebuildSourcesAndSynthesize() {
      const s = this.size;
      const nCtx = this.nearSource.getContext('2d');
      const fCtx = this.farSource.getContext('2d');

      nCtx.fillStyle = '#808080';
      nCtx.fillRect(0, 0, s, s);
      fCtx.fillStyle = '#1e1e1e';
      fCtx.fillRect(0, 0, s, s);

      if (this.preset === 'upload_photos' && this.uploadedNearImg && this.uploadedFarImg) {
        this._drawCoverImage(nCtx, this.uploadedNearImg);
        this._drawCoverImage(fCtx, this.uploadedFarImg);
      } else if (this.preset === 'sage_smile') {
        // FAR (B): Broad high-contrast warm smiling face
        fCtx.fillStyle = '#e8e8e8';
        fCtx.beginPath();
        fCtx.arc(210, 215, 145, 0, Math.PI * 2);
        fCtx.fill();

        fCtx.fillStyle = '#121212';
        // Happy arched eyes
        fCtx.lineWidth = 22;
        fCtx.strokeStyle = '#121212';
        fCtx.lineCap = 'round';
        fCtx.beginPath();
        fCtx.arc(152, 182, 28, Math.PI * 1.1, Math.PI * 1.9);
        fCtx.stroke();
        fCtx.beginPath();
        fCtx.arc(268, 182, 28, Math.PI * 1.1, Math.PI * 1.9);
        fCtx.stroke();

        // Big open joyful smile
        fCtx.beginPath();
        fCtx.arc(210, 228, 78, 0.15 * Math.PI, 0.85 * Math.PI, false);
        fCtx.closePath();
        fCtx.fill();

        // NEAR (A): Sharp fine-stroke stern bespectacled professor (wild hair, glasses, frown, mustache)
        nCtx.strokeStyle = '#050505';
        nCtx.lineCap = 'round';
        // Wild Einstein-like hair strands
        nCtx.lineWidth = 3;
        for (let a = -2.6; a <= -0.5; a += 0.09) {
          const r1 = 132;
          const r2 = 185 + Math.sin(a * 19) * 16;
          nCtx.beginPath();
          nCtx.moveTo(210 + Math.cos(a) * r1, 215 + Math.sin(a) * r1);
          nCtx.lineTo(210 + Math.cos(a) * r2, 215 + Math.sin(a) * r2);
          nCtx.stroke();
        }
        // Forehead wrinkles
        for (let wy = 112; wy <= 134; wy += 7) {
          nCtx.beginPath();
          nCtx.moveTo(145, wy);
          nCtx.quadraticCurveTo(210, wy + 5, 275, wy);
          nCtx.stroke();
        }
        // Rectangular spectacles + bridge + stern pupils
        nCtx.lineWidth = 5;
        nCtx.strokeRect(116, 158, 76, 46);
        nCtx.strokeRect(228, 158, 76, 46);
        nCtx.beginPath();
        nCtx.moveTo(192, 178);
        nCtx.lineTo(228, 178);
        // Furrowed angry eyebrows
        nCtx.moveTo(114, 146);
        nCtx.lineTo(194, 160);
        nCtx.moveTo(306, 146);
        nCtx.lineTo(226, 160);
        nCtx.stroke();

        nCtx.fillStyle = '#050505';
        nCtx.beginPath();
        nCtx.arc(154, 181, 8, 0, Math.PI * 2);
        nCtx.arc(266, 181, 8, 0, Math.PI * 2);
        nCtx.fill();

        // Sharp nose + dense bushy mustache + stern downward mouth
        nCtx.lineWidth = 3.5;
        nCtx.beginPath();
        nCtx.moveTo(210, 178);
        nCtx.lineTo(198, 240);
        nCtx.lineTo(224, 244);
        nCtx.stroke();

        for (let mx = 142; mx <= 278; mx += 5) {
          nCtx.beginPath();
          nCtx.moveTo(mx, 258);
          nCtx.lineTo(mx + (mx - 210) * 0.18, 286);
          nCtx.stroke();
        }
        nCtx.lineWidth = 4.5;
        nCtx.beginPath();
        fCtx.strokeStyle = '#050505';
        nCtx.arc(210, 330, 52, Math.PI * 1.2, Math.PI * 1.8);
        nCtx.stroke();
      } else if (this.preset === 'skull_heart') {
        // FAR (B): Glowing giant Heart
        fCtx.fillStyle = '#f5f5f5';
        fCtx.beginPath();
        fCtx.moveTo(210, 355);
        fCtx.bezierCurveTo(45, 235, 85, 70, 210, 148);
        fCtx.bezierCurveTo(335, 70, 375, 235, 210, 355);
        fCtx.fill();

        // NEAR (A): Intricate Skull line etching
        nCtx.strokeStyle = '#050505';
        nCtx.lineWidth = 4;
        nCtx.beginPath();
        nCtx.arc(210, 185, 105, Math.PI * 0.82, Math.PI * 0.18, false);
        nCtx.lineTo(265, 325);
        nCtx.lineTo(155, 325);
        nCtx.closePath();
        nCtx.stroke();
        // Eye sockets & nasal cavity in fine cross-hatching
        nCtx.lineWidth = 4.5;
        nCtx.strokeRect(142, 168, 52, 44);
        nCtx.strokeRect(226, 168, 52, 44);
        nCtx.beginPath();
        nCtx.moveTo(210, 216);
        nCtx.lineTo(194, 256);
        nCtx.lineTo(226, 256);
        nCtx.closePath();
        nCtx.stroke();
        // Teeth grid
        for (let tx = 162; tx <= 258; tx += 12) {
          nCtx.beginPath();
          nCtx.moveTo(tx, 278);
          nCtx.lineTo(tx, 322);
          nCtx.stroke();
        }
        nCtx.beginPath();
        nCtx.moveTo(156, 300);
        nCtx.lineTo(264, 300);
        nCtx.stroke();
      } else if (this.preset === 'cat_owl') {
        // FAR (B): Big Round Owl Silhouette + Huge Moon Eyes
        fCtx.fillStyle = '#eaeaea';
        fCtx.beginPath();
        fCtx.ellipse(210, 225, 130, 150, 0, 0, Math.PI * 2);
        fCtx.fill();
        fCtx.fillStyle = '#111111';
        fCtx.beginPath();
        fCtx.arc(156, 185, 38, 0, Math.PI * 2);
        fCtx.arc(264, 185, 38, 0, Math.PI * 2);
        fCtx.fill();

        // NEAR (A): Sharp Pointy-Eared Whiskered Cat
        nCtx.strokeStyle = '#080808';
        nCtx.lineWidth = 4;
        nCtx.beginPath();
        nCtx.moveTo(115, 195);
        nCtx.lineTo(105, 78);
        nCtx.lineTo(175, 135);
        nCtx.lineTo(245, 135);
        nCtx.lineTo(315, 78);
        nCtx.lineTo(305, 195);
        nCtx.quadraticCurveTo(210, 345, 115, 195);
        nCtx.stroke();
        // Slit cat eyes & long whiskers
        nCtx.beginPath();
        nCtx.moveTo(160, 172);
        nCtx.lineTo(160, 206);
        nCtx.moveTo(260, 172);
        nCtx.lineTo(260, 206);
        for (let wOff = -16; wOff <= 16; wOff += 16) {
          nCtx.moveTo(175, 248 + wOff * 0.4);
          nCtx.lineTo(62, 238 + wOff * 1.4);
          nCtx.moveTo(245, 248 + wOff * 0.4);
          nCtx.lineTo(358, 238 + wOff * 1.4);
        }
        nCtx.stroke();
      } else {
        // 'secret_words': Dual-distance typography!
        const nearWord = (document.getElementById('hybrid-near-word').value || 'GIẢ DỐI').toUpperCase();
        const farWord = (document.getElementById('hybrid-far-word').value || 'SỰ THẬT').toUpperCase();

        // FAR: Huge bold solid white block word on dark background
        fCtx.fillStyle = '#161616';
        fCtx.fillRect(0, 0, s, s);
        fCtx.fillStyle = '#f5f5f5';
        fCtx.textAlign = 'center';
        fCtx.textBaseline = 'middle';
        fCtx.font = '900 84px "Be Vietnam Pro", sans-serif';
        fCtx.fillText(farWord, s / 2, s / 2);

        // NEAR: Fine double-outlined & striped word on neutral gray
        nCtx.fillStyle = '#808080';
        nCtx.fillRect(0, 0, s, s);
        nCtx.strokeStyle = '#050505';
        nCtx.lineWidth = 3.2;
        nCtx.textAlign = 'center';
        nCtx.textBaseline = 'middle';
        nCtx.font = '800 76px "Be Vietnam Pro", sans-serif';
        nCtx.strokeText(nearWord, s / 2, s / 2 - 48);
        nCtx.strokeText(nearWord, s / 2, s / 2 + 48);
        nCtx.strokeStyle = '#f8fafc';
        nCtx.lineWidth = 1.6;
        nCtx.strokeText(nearWord, s / 2 + 2, s / 2 - 46);
        nCtx.strokeText(nearWord, s / 2 + 2, s / 2 + 50);
      }

      this.synthesizeFromSources();
    }

    synthesizeFromSources() {
      const s = this.size;
      const nearLuma = canvasToLumaFloat32(this.nearSource);
      const farLuma = canvasToLumaFloat32(this.farSource);

      const lowFar = gaussianBlurFloat32(farLuma, s, s, this.sigmaLow);
      const lowNear = gaussianBlurFloat32(nearLuma, s, s, this.sigmaHigh);

      const highNearVis = new Float32Array(s * s);
      const hybridOut = new Float32Array(s * s);

      for (let i = 0; i < hybridOut.length; i++) {
        const highDetail = nearLuma[i] - lowNear[i];
        highNearVis[i] = 128 + highDetail * 1.8;
        hybridOut[i] = lowFar[i] + this.gainHigh * highDetail;
      }

      lumaFloat32ToCanvas(hybridOut, this.mainCanvas);

      // Update X-Ray Previews (160x160)
      const tmpH = document.createElement('canvas');
      const tmpL = document.createElement('canvas');
      tmpH.width = tmpL.width = s;
      tmpH.height = tmpL.height = s;
      lumaFloat32ToCanvas(highNearVis, tmpH);
      lumaFloat32ToCanvas(lowFar, tmpL);

      this.highPreview.getContext('2d').drawImage(tmpH, 0, 0, 160, 160);
      this.lowPreview.getContext('2d').drawImage(tmpL, 0, 0, 160, 160);

      // Update Multi-Scale Viewing Pyramid
      const pyr = document.getElementById('hybrid-pyramid-strip');
      pyr.innerHTML = '';
      const scales = [
        { w: 132, label: '0.5m (Gần)' },
        { w: 84, label: '1.4m' },
        { w: 50, label: '2.6m' },
        { w: 28, label: '4.0m (Xa)' }
      ];
      scales.forEach((sc) => {
        const box = document.createElement('div');
        box.className = 'pyr-item';
        const c = document.createElement('canvas');
        c.width = sc.w;
        c.height = sc.w;
        c.getContext('2d').drawImage(this.mainCanvas, 0, 0, sc.w, sc.w);
        const lbl = document.createElement('span');
        lbl.textContent = sc.label;
        box.appendChild(c);
        box.appendChild(lbl);
        pyr.appendChild(box);
      });
    }

    // =======================================================================
    // 6B: 3D AUTOSTEREOGRAM (SIRDS) & CROSS-CORRELATION X-RAY DECODER
    // =======================================================================
    _buildDepthMap(w, h) {
      const dc = document.createElement('canvas');
      dc.width = w;
      dc.height = h;
      const dctx = dc.getContext('2d');
      dctx.fillStyle = '#000000';
      dctx.fillRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;

      if (this.stereoShape === 'star3d') {
        for (let layer = 3; layer >= 1; layer--) {
          const scale = layer / 3;
          const v = Math.round(90 + (3 - layer) * 80);
          dctx.fillStyle = `rgb(${v},${v},${v})`;
          dctx.beginPath();
          for (let i = 0; i < 10; i++) {
            const r = (i % 2 === 0 ? 138 : 58) * scale;
            const a = -Math.PI / 2 + (i * Math.PI) / 5;
            const x = cx + Math.cos(a) * r;
            const y = cy + Math.sin(a) * r;
            if (i === 0) dctx.moveTo(x, y);
            else dctx.lineTo(x, y);
          }
          dctx.closePath();
          dctx.fill();
        }
      } else if (this.stereoShape === 'torus3d') {
        const img = dctx.createImageData(w, h);
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const dist = Math.hypot(x - cx, y - cy);
            const ringDelta = Math.abs(dist - 92);
            if (ringDelta < 44) {
              const z = Math.sqrt(Math.max(0, 1 - Math.pow(ringDelta / 44, 2)));
              const val = Math.round(z * 255);
              const idx = (y * w + x) * 4;
              img.data[idx] = img.data[idx + 1] = img.data[idx + 2] = val;
              img.data[idx + 3] = 255;
            }
          }
        }
        dctx.putImageData(img, 0, 0);
      } else if (this.stereoShape === 'heart3d') {
        dctx.fillStyle = '#dcdcdc';
        dctx.beginPath();
        dctx.moveTo(cx, cy + 120);
        dctx.bezierCurveTo(cx - 165, cy + 10, cx - 115, cy - 135, cx, cy - 55);
        dctx.bezierCurveTo(cx + 115, cy - 135, cx + 165, cy + 10, cx, cy + 120);
        dctx.fill();
        dctx.fillStyle = '#ffffff';
        dctx.save();
        dctx.translate(cx, cy);
        dctx.scale(0.62, 0.62);
        dctx.translate(-cx, -cy);
        dctx.fill();
        dctx.restore();
      } else {
        const txt = (document.getElementById('stereo-custom-text').value || '2026').toUpperCase();
        dctx.fillStyle = '#ffffff';
        dctx.textAlign = 'center';
        dctx.textBaseline = 'middle';
        dctx.font = '900 138px "JetBrains Mono", monospace';
        dctx.fillText(txt, cx, cy);
      }

      const raw = dctx.getImageData(0, 0, w, h).data;
      const depth = new Float32Array(w * h);
      for (let i = 0; i < depth.length; i++) {
        depth[i] = raw[i * 4] / 255;
      }
      return depth;
    }

    renderStereogram() {
      const w = this.stereoCanvas.width;
      const h = this.stereoCanvas.height;
      const ctx = this.stereoCanvas.getContext('2d');
      const depth = this._buildDepthMap(w, h);

      const stripPeriod = 110;
      const maxShift = 24;
      const img = ctx.createImageData(w, h);
      const data = img.data;

      const palette = [
        [245, 196, 81],
        [34, 211, 238],
        [168, 85, 247],
        [16, 185, 129],
        [244, 63, 94],
        [15, 23, 42],
        [248, 250, 252],
        [59, 130, 246]
      ];

      for (let y = 0; y < h; y++) {
        const same = new Int32Array(w);
        for (let x = 0; x < w; x++) same[x] = x;

        for (let x = 0; x < w; x++) {
          const z = depth[y * w + x];
          const sep = Math.round(stripPeriod - z * maxShift);
          const left = x - Math.floor(sep / 2);
          const right = left + sep;
          if (left >= 0 && right < w) {
            let l = left;
            let r = right;
            while (same[l] !== l && same[l] !== r) l = same[l];
            same[r] = l;
          }
        }

        const rowColors = new Array(w);
        for (let x = 0; x < w; x++) {
          if (same[x] === x) {
            rowColors[x] = palette[Math.floor(Math.random() * palette.length)];
          } else {
            rowColors[x] = rowColors[same[x]];
          }
          const p = (y * w + x) * 4;
          data[p] = rowColors[x][0];
          data[p + 1] = rowColors[x][1];
          data[p + 2] = rowColors[x][2];
          data[p + 3] = 255;
        }
      }

      this.stereoRawImageData = img;
      ctx.putImageData(img, 0, 0);
    }

    decodeStereogramByCrossCorrelation() {
      if (!this.stereoRawImageData) return;
      const w = this.stereoCanvas.width;
      const h = this.stereoCanvas.height;
      const src = this.stereoRawImageData.data;
      const ctx = this.stereoCanvas.getContext('2d');
      const out = ctx.createImageData(w, h);
      const dst = out.data;

      const stripPeriod = 110;
      const maxShift = 24;

      // Pure blind disparity search: find smallest lag in [stripPeriod - maxShift .. stripPeriod] with exact RGB match!
      for (let y = 0; y < h; y++) {
        for (let x = 55; x < w - 55; x++) {
          let detectedShift = 0;
          for (let shift = maxShift; shift >= 1; shift--) {
            const sep = stripPeriod - shift;
            const left = x - Math.floor(sep / 2);
            const right = left + sep;
            if (left >= 0 && right < w) {
              const pL = (y * w + left) * 4;
              const pR = (y * w + right) * 4;
              if (src[pL] === src[pR] && src[pL + 1] === src[pR + 1] && src[pL + 2] === src[pR + 2]) {
                detectedShift = shift;
                break;
              }
            }
          }
          const norm = detectedShift / maxShift;
          const p = (y * w + x) * 4;
          dst[p] = Math.round(norm * 34);
          dst[p + 1] = Math.round(norm * 211);
          dst[p + 2] = Math.round(25 + norm * 213);
          dst[p + 3] = 255;
        }
      }
      ctx.putImageData(out, 0, 0);
    }
  }

  // =========================================================================
  // 2. ACT VII: PARRONDO'S PARADOX, GILBREATH & FARO SHUFFLE
  // =========================================================================
  class ParadoxAndCardLab {
    constructor() {
      this._bindEvents();
      this.runParrondo();
      this.runGilbreath();
      this.runFaro();
    }

    _bindEvents() {
      document.querySelectorAll('[data-act7-sub]').forEach((btn) => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('[data-act7-sub]').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          const sub = btn.dataset.act7Sub;
          document.getElementById('act7-parrondo-view').hidden = sub !== 'parrondo';
          document.getElementById('act7-gilbreath-view').hidden = sub !== 'gilbreath';
          document.getElementById('act7-faro-view').hidden = sub !== 'faro';
        });
      });

      document.getElementById('btn-parrondo-run').addEventListener('click', () => this.runParrondo());
      document.getElementById('parrondo-eps-slider').addEventListener('input', (e) => {
        document.getElementById('lbl-parrondo-eps').textContent = Number(e.target.value).toFixed(3);
        this.runParrondo();
      });
      document.getElementById('parrondo-steps-slider').addEventListener('input', (e) => {
        document.getElementById('lbl-parrondo-steps').textContent = `${e.target.value} ván`;
        this.runParrondo();
      });

      document.getElementById('btn-gilbreath-shuffle').addEventListener('click', () => this.runGilbreath());
      document.getElementById('gilbreath-cut-slider').addEventListener('input', (e) => {
        document.getElementById('lbl-gilbreath-cut').textContent = `Lá thứ ${e.target.value} / 24`;
        this.runGilbreath();
      });

      document.getElementById('btn-faro-solve').addEventListener('click', () => this.runFaro());
    }

    async runParrondo() {
      const epsilon = Number(document.getElementById('parrondo-eps-slider').value);
      const steps = Number(document.getElementById('parrondo-steps-slider').value);
      const { simulation } = await postJson('/api/tricks/parrondo/simulate', {
        epsilon,
        steps,
        ensembleSize: 250
      });

      this._drawParrondoChart(simulation);

      const s = simulation.simulations;
      document.getElementById('parrondo-kpi-box').innerHTML = `
        <h3>💰 Bảng Tổng Kết Lợi Nhuận Trung Bình Sau ${steps} Ván</h3>
        <div class="parrondo-kpi-grid">
          <div class="p-kpi-tile lose-tile">
            <small>🔴 Chỉ chơi Bàn A</small><br/>
            <strong>${s.pure_A.finalAvgProfit > 0 ? '+' : ''}${s.pure_A.finalAvgProfit} $</strong>
          </div>
          <div class="p-kpi-tile lose-tile">
            <small>🟠 Chỉ chơi Bàn B</small><br/>
            <strong>${s.pure_B.finalAvgProfit > 0 ? '+' : ''}${s.pure_B.finalAvgProfit} $</strong>
          </div>
          <div class="p-kpi-tile win-tile">
            <small>🟡 Xen kẽ A–A–B–B</small><br/>
            <strong style="color:#fef08a;">+${s.periodic_AABB.finalAvgProfit} $ (LÃI!)</strong>
          </div>
          <div class="p-kpi-tile win-tile">
            <small>🟢 Ngẫu nhiên 50/50 A+B</small><br/>
            <strong style="color:#34d399;">+${s.random_AB.finalAvgProfit} $ (LÃI!)</strong>
          </div>
        </div>
      `;

      const t = simulation.theory;
      document.getElementById('parrondo-xray-math').innerHTML = `
        • <strong>Bàn B đơn độc:</strong> Tỷ lệ rơi vào bẫy chia hết cho 3 là <code>π₀ = ${t.gameB.stationaryPi[0]}</code> (> 1/3!) ⇒ Kỳ vọng mỗi ván <code>E[Δ] = ${t.gameB.expectedGainPerTurn} $</code> (ÂM!).<br/>
        • <strong>Trộn ngẫu nhiên A+B:</strong> Bàn A phá vỡ thế kẹt Markov, kéo <code>π₀</code> xuống <code>${t.randomAB.stationaryPi[0]}</code> ⇒ Kỳ vọng mỗi ván đảo chiều thành <code>E[Δ] = +${t.randomAB.expectedGainPerTurn} $</code> (DƯƠNG!).
      `;
    }

    _drawParrondoChart(sim) {
      const c = document.getElementById('parrondo-chart-canvas');
      const ctx = c.getContext('2d');
      const w = c.width;
      const h = c.height;
      ctx.fillStyle = '#090812';
      ctx.fillRect(0, 0, w, h);

      const curves = [
        { data: sim.simulations.pure_A.avgCurve, color: '#f43f5e', label: 'Chỉ chơi A (Lỗ)' },
        { data: sim.simulations.pure_B.avgCurve, color: '#fb923c', label: 'Chỉ chơi B (Lỗ)' },
        { data: sim.simulations.random_AB.avgCurve, color: '#22d3ee', label: 'Ngẫu nhiên A+B (Lãi!)' },
        { data: sim.simulations.periodic_AABB.avgCurve, color: '#fde047', label: 'Chu kỳ A-A-B-B (Lãi lớn!)' }
      ];

      const allVals = curves.flatMap((x) => x.data);
      const maxAbs = Math.max(4, ...allVals.map((v) => Math.abs(v))) * 1.15;
      const padL = 48;
      const padR = 24;
      const midY = h / 2;

      // Zero baseline
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(padL, midY);
      ctx.lineTo(w - padR, midY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillText('0$', 18, midY + 4);
      ctx.fillText(`+${maxAbs.toFixed(1)}$`, 6, 24);
      ctx.fillText(`-${maxAbs.toFixed(1)}$`, 6, h - 14);

      curves.forEach((curve, idx) => {
        ctx.strokeStyle = curve.color;
        ctx.lineWidth = idx >= 2 ? 3 : 2.2;
        ctx.beginPath();
        curve.data.forEach((val, i) => {
          const x = padL + (i / (curve.data.length - 1)) * (w - padL - padR);
          const y = midY - (val / maxAbs) * (h * 0.42);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Legend at top
        ctx.fillStyle = curve.color;
        ctx.fillRect(padL + idx * 152, 10, 10, 10);
        ctx.fillText(curve.label, padL + 14 + idx * 152, 19);
      });
    }

    async runGilbreath() {
      const cutIndex = Number(document.getElementById('gilbreath-cut-slider').value);
      const { experiment } = await postJson('/api/tricks/gilbreath/run', {
        quartetCount: 6,
        cutIndex
      });

      const grid = document.getElementById('gilbreath-quartets-grid');
      grid.innerHTML = experiment.quartets
        .map(
          (q) => `
          <div class="quartet-pod">
            <div class="quartet-head">
              <span>Cụm 4 Lá #${q.quartetNumber}</span>
              <span>${q.hasAllFourSuits ? '✔ ĐỦ 4 CHẤT ♣♦♥♠' : '✕'}</span>
            </div>
            <div class="quartet-cards-mini">
              ${q.cards
                .map(
                  (c) =>
                    `<div class="q-mini-card ${c.color === 'red' ? 'red' : ''}" title="Từ chồng ${c.sourcePacket}">${c.display}</div>`
                )
                .join('')}
            </div>
          </div>
        `
        )
        .join('');

      document.getElementById('gilbreath-trace-box').innerHTML = `
        <div class="trace-item"><strong>1. Chồng Trái (đã đảo chiều):</strong> ${experiment.leftReversedTop.join(' → ')}...</div>
        <div class="trace-item"><strong>2. Chồng Phải (giữ nguyên):</strong> ${experiment.rightOriginalTop.join(' → ')}...</div>
        <div class="trace-item"><strong>3. Chuỗi thả bài Riffle ngẫu nhiên:</strong> <code>${experiment.rifflePatternPreview}</code></div>
        <div class="trace-item"><strong>4. Kiểm định bất biến:</strong> <code>${experiment.allQuartetsComplete ? '100% TẤT CẢ CÁC BỘ TỨ ĐỀU ĐỦ 4 CHẤT!' : 'Lỗi'}</code></div>
      `;
    }

    async runFaro() {
      const startPos = Number(document.getElementById('faro-start-pos').value);
      const targetPos = Number(document.getElementById('faro-target-pos').value);
      const { plan } = await postJson('/api/tricks/faro/plan', { startPos, targetPos });

      const headerHtml = `
        <div class="decode-announcement" style="margin-bottom:10px;">
          🎯 Đưa lá <strong>${plan.trackedCard.fullNameVi}</strong> từ vị trí <code>#${plan.startPos}</code> tới đúng vị trí <code>#${plan.targetPos}</code> (Nhị phân: <code>${plan.binaryTarget}₂</code>) chỉ sau <strong>${plan.shuffleCount} lần chẻ Faro</strong>!
        </div>
      `;

      const stepsHtml = plan.timeline
        .map(
          (st) => `
          <div class="trace-item">
            <strong>Bước ${st.step} [${st.shuffleType}]:</strong> ${st.labelVi} ⇒ <code>${st.formula}</code> (Đang ở vị trí <strong>#${st.cardPosition}</strong>)
          </div>
        `
        )
        .join('');

      document.getElementById('faro-timeline-box').innerHTML = headerHtml + stepsHtml;
    }
  }

  // =========================================================================
  // 3. ACT VIII: MICRO-HESITATION & CONCEALED INFORMATION POLYGRAPH (CIT-RT)
  // =========================================================================
  const CIT_SUSPECTS = [
    { id: 'dagger', icon: '🗡️', name: 'Đoản Kiếm Cổ' },
    { id: 'crown', icon: '👑', name: 'Vương Miện Vàng' },
    { id: 'key', icon: '🗝️', name: 'Chìa Khóa Mật' },
    { id: 'hourglass', icon: '⏳', name: 'Đồng Hồ Cát' },
    { id: 'ring', icon: '💍', name: 'Nhẫn Lục Bảo' },
    { id: 'candle', icon: '🕯️', name: 'Chân Nến Bạc' }
  ];
  const CIT_CONTROL = { id: 'control_bell', icon: '🔔', name: 'Chuông Kiểm Tra', isControl: true };

  class MicroHesitationPolygraph {
    constructor() {
      this.running = false;
      this.sequence = [];
      this.currentIndex = 0;
      this.trials = [];
      this.stimShownAt = 0;
      this.cursorJitter = 0;
      this.lastMouse = null;

      this._renderSuspectCards();
      this._bindEvents();
    }

    _renderSuspectCards() {
      const grid = document.getElementById('cit-suspects-grid');
      grid.innerHTML = CIT_SUSPECTS.map(
        (s) => `
          <div class="cit-suspect-card">
            <div class="cit-s-icon">${s.icon}</div>
            <div class="cit-s-name">${s.name}</div>
          </div>
        `
      ).join('');
    }

    _bindEvents() {
      document.getElementById('btn-cit-start').addEventListener('click', () => this.startSession());
      document.getElementById('btn-cit-retry').addEventListener('click', () => this.resetToSetup());

      document.getElementById('btn-cit-left').addEventListener('click', () => this.handleAnswer(false));
      document.getElementById('btn-cit-right').addEventListener('click', () => this.handleAnswer(true));

      window.addEventListener('keydown', (e) => {
        if (!this.running) return;
        if (e.key.toLowerCase() === 'a') this.handleAnswer(false);
        if (e.key.toLowerCase() === 'l') this.handleAnswer(true);
      });

      window.addEventListener('mousemove', (e) => {
        if (!this.running) return;
        if (this.lastMouse) {
          this.cursorJitter += Math.hypot(e.clientX - this.lastMouse.x, e.clientY - this.lastMouse.y) * 0.08;
        }
        this.lastMouse = { x: e.clientX, y: e.clientY };
      });
    }

    resetToSetup() {
      this.running = false;
      document.getElementById('cit-phase-setup').hidden = false;
      document.getElementById('cit-phase-arena').hidden = true;
    }

    startSession() {
      // Build 3 balanced blocks of (6 suspects + 1 control bell) = 21 rapid flashes with zero consecutive duplicates
      const seq = [];
      for (let b = 0; b < 3; b++) {
        const block = [...CIT_SUSPECTS, CIT_CONTROL];
        for (let i = block.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [block[i], block[j]] = [block[j], block[i]];
        }
        if (seq.length > 0 && seq.at(-1).id === block[0].id) {
          [block[0], block[1]] = [block[1], block[0]];
        }
        seq.push(...block);
      }

      this.sequence = seq;
      this.currentIndex = 0;
      this.trials = [];
      this.running = true;

      document.getElementById('cit-phase-setup').hidden = true;
      document.getElementById('cit-phase-arena').hidden = false;
      document.getElementById('cit-verdict-placeholder').hidden = false;
      document.getElementById('cit-verdict-result').hidden = true;

      this._presentNextStimulus();
    }

    _presentNextStimulus() {
      if (this.currentIndex >= this.sequence.length) {
        this.finishSession();
        return;
      }

      const item = this.sequence[this.currentIndex];
      document.getElementById('cit-progress-text').textContent = `${this.currentIndex + 1} / ${this.sequence.length}`;
      document.getElementById('cit-flash-icon').textContent = '➕';
      document.getElementById('cit-flash-label').textContent = '...';

      // Brief 260ms fixation cross before stimulus flash
      this.stimShownAt = 0;
      setTimeout(() => {
        if (!this.running) return;
        document.getElementById('cit-flash-icon').textContent = item.icon;
        document.getElementById('cit-flash-label').textContent = item.name.toUpperCase();
        this.cursorJitter = 0;
        this.stimShownAt = performance.now();
      }, 260);
    }

    handleAnswer(pressedControlBell) {
      if (!this.running || this.stimShownAt === 0) return;
      const rtMs = performance.now() - this.stimShownAt;
      const item = this.sequence[this.currentIndex];
      const correct = Boolean(item.isControl) === Boolean(pressedControlBell);

      document.getElementById('cit-live-rt-tag').textContent = `Phản xạ vừa đo: ${rtMs.toFixed(1)} ms ${correct ? '✔' : '⚠ Nhầm nút!'}`;

      this.trials.push({
        itemId: item.id,
        rtMs: Number(rtMs.toFixed(2)),
        cursorJitter: Number(this.cursorJitter.toFixed(1)),
        correct
      });

      this.stimShownAt = 0;
      this.currentIndex += 1;
      this._presentNextStimulus();
    }

    async finishSession() {
      this.running = false;
      document.getElementById('cit-phase-arena').hidden = true;
      document.getElementById('cit-phase-setup').hidden = false;

      const { report } = await postJson('/api/tricks/cit-polygraph/analyze', {
        trials: this.trials,
        suspectIds: CIT_SUSPECTS.map((s) => s.id),
        playerName: document.getElementById('cit-player-name').value || 'Đối Tượng CIT'
      });

      const topMeta = CIT_SUSPECTS.find((s) => s.id === report.topSuspect.itemId);
      const runnerMeta = CIT_SUSPECTS.find((s) => s.id === report.runnerUpSuspect?.itemId);

      document.getElementById('cit-verdict-placeholder').hidden = true;
      document.getElementById('cit-verdict-result').hidden = false;
      document.getElementById('cit-top-suspect-title').textContent = `${topMeta.icon} ${topMeta.name}`;
      document.getElementById('cit-top-suspect-desc').innerHTML = `
        Phân tích điện tâm trí phát hiện đỉnh trễ phản xạ tại <strong>${topMeta.name}</strong> (Trung vị: <code>${report.topSuspect.medianRtMs}ms</code> vs Nền: <code>${report.baselineMedianRtMs}ms</code> • Z-Score: <code>${report.topSuspect.zScore}</code> • Xác suất che giấu: <strong>${report.topSuspect.probabilityPct}%</strong>).
        ${runnerMeta ? `<br/><small>Nghi vấn số 2: ${runnerMeta.icon} ${runnerMeta.name} (${report.runnerUpSuspect.probabilityPct}%)</small>` : ''}
      `;

      this._drawPolygraphBars(report);
    }

    _drawPolygraphBars(report) {
      const c = document.getElementById('cit-polygraph-canvas');
      const ctx = c.getContext('2d');
      const w = c.width;
      const h = c.height;
      ctx.fillStyle = '#090812';
      ctx.fillRect(0, 0, w, h);

      const maxProb = Math.max(35, ...report.rankedProfiles.map((p) => p.probabilityPct));
      const rowH = 30;

      report.rankedProfiles.forEach((prof, idx) => {
        const meta = CIT_SUSPECTS.find((s) => s.id === prof.itemId);
        const y = 14 + idx * rowH;
        const barW = (prof.probabilityPct / maxProb) * (w - 205);

        ctx.fillStyle = idx === 0 ? '#f43f5e' : idx === 1 ? '#f59e0b' : '#334155';
        ctx.fillRect(138, y, Math.max(8, barW), 20);

        ctx.fillStyle = '#f8fafc';
        ctx.font = '700 12px "Be Vietnam Pro", sans-serif';
        ctx.fillText(`${meta.icon} ${meta.name}`, 10, y + 14);

        ctx.fillStyle = '#fef08a';
        ctx.font = '600 11px "JetBrains Mono", monospace';
        ctx.fillText(`${prof.medianRtMs}ms (${prof.probabilityPct}%)`, 144 + barW, y + 14);
      });
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    new HybridAndStereogramStudio();
    new ParadoxAndCardLab();
    new MicroHesitationPolygraph();
  });
})();
