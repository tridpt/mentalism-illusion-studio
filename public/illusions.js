/**
 * ArcanaMind — Precision Canvas Optical Engines (Act IV Scanimation & Act V Visual/Auditory Cortex)
 */

(function () {
  'use strict';

  // =========================================================================
  // 1. ACT IV: MOIRÉ / SCANIMATION BARRIER-GRID STUDIO
  // =========================================================================
  class ScanimationStudio {
    constructor() {
      this.canvas = document.getElementById('scanimation-canvas');
      this.ctx = this.canvas.getContext('2d');
      this.width = this.canvas.width;
      this.height = this.canvas.height;

      this.interlacedCanvas = document.createElement('canvas');
      this.interlacedCanvas.width = this.width;
      this.interlacedCanvas.height = this.height;
      this.interlacedCtx = this.interlacedCanvas.getContext('2d');

      this.preset = 'gallop_horse';
      this.customWords = ['XIN CHÀO', 'BÍ MẬT', '2026', 'KỲ DIỆU'];
      this.slitWidth = 2;
      this.maskOffset = 0;
      this.autoPlay = true;
      this.speed = 1.0;
      this.maskOpacity = 0.98;
      this.peelHalf = false;
      this.frames = [];
      this.isDragging = false;
      this.dragStartX = 0;
      this.dragStartOffset = 0;

      this._bindEvents();
      this.rebuildFrames();
      this._startLoop();
    }

    _bindEvents() {
      const presetSel = document.getElementById('scan-preset-select');
      const wordsBar = document.getElementById('scan-custom-words-bar');
      const wordsInput = document.getElementById('scan-words-input');
      const buildWordsBtn = document.getElementById('btn-scan-build-words');
      const autoBtn = document.getElementById('btn-scan-autoplay');
      const peelBtn = document.getElementById('btn-scan-peel');
      const offsetSlider = document.getElementById('scan-offset-slider');
      const slitSlider = document.getElementById('scan-slit-slider');
      const speedSlider = document.getElementById('scan-speed-slider');
      const opacitySlider = document.getElementById('scan-opacity-slider');

      presetSel.addEventListener('change', () => {
        this.preset = presetSel.value;
        wordsBar.hidden = this.preset !== 'custom_words';
        this.rebuildFrames();
      });

      buildWordsBtn.addEventListener('click', () => {
        const parts = wordsInput.value
          .split('|')
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 6);
        if (parts.length >= 2) {
          this.customWords = parts;
          this.rebuildFrames();
        }
      });

      autoBtn.addEventListener('click', () => {
        this.autoPlay = !this.autoPlay;
        autoBtn.textContent = this.autoPlay ? '⏸ Đang Tự Trượt' : '▶ Tự Động Trượt';
        autoBtn.classList.toggle('active', this.autoPlay);
      });

      peelBtn.addEventListener('click', () => {
        this.peelHalf = !this.peelHalf;
        peelBtn.textContent = this.peelHalf
          ? '🎞️ Đậy Kín Lại Tấm Phim'
          : '🖐️ Lột Nửa Tấm Phim Soi Ảnh Tĩnh';
      });

      offsetSlider.addEventListener('input', () => {
        this.autoPlay = false;
        autoBtn.textContent = '▶ Tự Động Trượt';
        this.maskOffset = Number(offsetSlider.value);
        document.getElementById('lbl-scan-offset').textContent = `${this.maskOffset.toFixed(1)} px`;
      });

      slitSlider.addEventListener('input', () => {
        this.slitWidth = Number(slitSlider.value);
        document.getElementById('lbl-scan-slit').textContent = `${this.slitWidth} px`;
        this.rebuildInterlacedOnly();
      });

      speedSlider.addEventListener('input', () => {
        this.speed = Number(speedSlider.value);
        document.getElementById('lbl-scan-speed').textContent = `${this.speed.toFixed(1)}x`;
      });

      opacitySlider.addEventListener('input', () => {
        const pct = Number(opacitySlider.value);
        this.maskOpacity = pct / 100;
        document.getElementById('lbl-scan-opacity').textContent = `${pct}%`;
      });

      // Direct mouse/touch dragging on canvas
      const onDown = (clientX) => {
        this.isDragging = true;
        this.autoPlay = false;
        autoBtn.textContent = '▶ Tự Động Trượt';
        this.dragStartX = clientX;
        this.dragStartOffset = this.maskOffset;
      };
      const onMove = (clientX) => {
        if (!this.isDragging) return;
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.width / Math.max(1, rect.width);
        const dx = (clientX - this.dragStartX) * scaleX;
        this.maskOffset = (this.dragStartOffset + dx + 2000) % 200;
        offsetSlider.value = String(this.maskOffset);
        document.getElementById('lbl-scan-offset').textContent = `${this.maskOffset.toFixed(1)} px`;
      };
      const onUp = () => {
        this.isDragging = false;
      };

      this.canvas.addEventListener('mousedown', (e) => onDown(e.clientX));
      window.addEventListener('mousemove', (e) => onMove(e.clientX));
      window.addEventListener('mouseup', onUp);

      this.canvas.addEventListener(
        'touchstart',
        (e) => {
          if (e.touches[0]) onDown(e.touches[0].clientX);
        },
        { passive: true }
      );
      this.canvas.addEventListener(
        'touchmove',
        (e) => {
          if (e.touches[0]) onMove(e.touches[0].clientX);
        },
        { passive: true }
      );
      window.addEventListener('touchend', onUp);

      document.getElementById('btn-scan-export-base').addEventListener('click', () => {
        this._downloadCanvasPng(this.interlacedCanvas, `ArcanaMind_Scanimation_Base_${this.preset}.png`);
      });

      document.getElementById('btn-scan-export-mask').addEventListener('click', () => {
        const maskCanvas = this._buildTransparentMaskCanvas();
        this._downloadCanvasPng(maskCanvas, `ArcanaMind_Barrier_Mask_${this.frames.length}x${this.slitWidth}px.png`);
      });
    }

    rebuildFrames() {
      let frameCount = 6;
      if (this.preset === 'magic_dove' || this.preset === 'beating_heart') frameCount = 5;
      if (this.preset === 'word_morph') frameCount = 4;
      if (this.preset === 'custom_words') frameCount = Math.max(2, Math.min(6, this.customWords.length));

      this.frames = [];
      for (let i = 0; i < frameCount; i++) {
        const fc = document.createElement('canvas');
        fc.width = this.width;
        fc.height = this.height;
        const fctx = fc.getContext('2d');
        this._drawSingleKeyframe(fctx, i, frameCount);
        this.frames.push(fc);
      }

      this._renderThumbnails();
      this.rebuildInterlacedOnly();
    }

    _drawSingleKeyframe(ctx, idx, total) {
      const t = (idx / total) * Math.PI * 2;
      const cx = this.width / 2;
      const cy = this.height / 2;

      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, this.width, this.height);

      ctx.fillStyle = '#09090b';
      ctx.strokeStyle = '#09090b';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (this.preset === 'gallop_horse') {
        // High-contrast kinematic galloping steed + flying turf
        const bob = Math.sin(t) * 14;
        const hx = cx + 10;
        const hy = cy - 10 + bob;

        // Torso
        ctx.save();
        ctx.translate(hx, hy);
        ctx.rotate(Math.sin(t) * 0.08);
        ctx.beginPath();
        ctx.ellipse(0, 0, 108, 44, 0, 0, Math.PI * 2);
        ctx.fill();

        // Neck & Head
        const neckAngle = -0.58 + Math.sin(t + 0.6) * 0.16;
        ctx.save();
        ctx.translate(82, -18);
        ctx.rotate(neckAngle);
        ctx.beginPath();
        ctx.moveTo(-18, 26);
        ctx.lineTo(12, -55);
        ctx.lineTo(44, -46);
        ctx.lineTo(22, 24);
        ctx.closePath();
        ctx.fill();
        // Snout & Ear
        ctx.beginPath();
        ctx.ellipse(38, -42, 28, 15, 0.38, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(12, -54);
        ctx.lineTo(18, -76);
        ctx.lineTo(28, -54);
        ctx.fill();
        ctx.restore();

        // Flowing Tail
        ctx.lineWidth = 18;
        ctx.beginPath();
        ctx.moveTo(-98, -12);
        ctx.quadraticCurveTo(-155, -38 - Math.sin(t) * 26, -188, 12 + Math.cos(t) * 22);
        ctx.stroke();

        // 4 Articulated Galloping Legs
        const legPhases = [0, 0.75, Math.PI + 0.2, Math.PI + 0.95];
        const hipOffsets = [
          [72, 24],
          [54, 26],
          [-72, 22],
          [-88, 24]
        ];
        ctx.lineWidth = 17;
        legPhases.forEach((pOff, li) => {
          const p = t + pOff;
          const thighA = Math.sin(p) * 0.78;
          const kneeBend = Math.max(0.12, (Math.cos(p) + 1) * 0.62);
          const [ox, oy] = hipOffsets[li];
          const kx = ox + Math.sin(thighA) * 58;
          const ky = oy + Math.cos(thighA) * 58;
          const shinA = thighA + (li < 2 ? kneeBend : -kneeBend * 0.85);
          const fx = kx + Math.sin(shinA) * 56;
          const fy = ky + Math.cos(shinA) * 56;
          ctx.beginPath();
          ctx.moveTo(ox, oy);
          ctx.lineTo(kx, ky);
          ctx.lineTo(fx, fy);
          ctx.stroke();
        });
        ctx.restore();

        // Moving ground dashes
        ctx.lineWidth = 7;
        for (let g = -3; g <= 3; g++) {
          const gx = cx + g * 120 - ((idx / total) * 120);
          ctx.beginPath();
          ctx.moveTo(gx, cy + 142);
          ctx.lineTo(gx + 55, cy + 142);
          ctx.stroke();
        }
      } else if (this.preset === 'magic_dove') {
        const lift = Math.sin(t) * 20;
        const wingSwing = Math.sin(t) * 95;
        ctx.save();
        ctx.translate(cx, cy + lift);

        // Body
        ctx.beginPath();
        ctx.ellipse(0, 10, 88, 28, -0.14, 0, Math.PI * 2);
        ctx.fill();
        // Head & beak
        ctx.beginPath();
        ctx.arc(86, -6, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(104, -10);
        ctx.lineTo(132, -2);
        ctx.lineTo(104, 5);
        ctx.fill();
        // Tail fan
        ctx.beginPath();
        ctx.moveTo(-72, 14);
        ctx.lineTo(-148, -6);
        ctx.lineTo(-142, 36);
        ctx.closePath();
        ctx.fill();
        // Sweeping Wings
        ctx.beginPath();
        ctx.moveTo(-18, 2);
        ctx.quadraticCurveTo(22, -95 - wingSwing, -55, -110 - wingSwing);
        ctx.quadraticCurveTo(-68, -28, -32, 10);
        ctx.fill();

        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(10, 4);
        ctx.quadraticCurveTo(54, -65 + wingSwing * 0.85, 4, -85 + wingSwing * 0.85);
        ctx.stroke();
        ctx.restore();
      } else if (this.preset === 'mystic_clock') {
        // Rotating gear + swinging pendulum
        ctx.save();
        ctx.translate(cx, cy - 28);
        const gearAngle = (idx / total) * ((Math.PI * 2) / 8);
        ctx.rotate(gearAngle);
        ctx.lineWidth = 18;
        ctx.beginPath();
        ctx.arc(0, 0, 88, 0, Math.PI * 2);
        ctx.stroke();
        for (let k = 0; k < 8; k++) {
          ctx.save();
          ctx.rotate((k * Math.PI) / 4);
          ctx.fillRect(-14, -118, 28, 30);
          ctx.restore();
        }
        ctx.lineWidth = 12;
        for (let s = 0; s < 4; s++) {
          ctx.save();
          ctx.rotate((s * Math.PI) / 2);
          ctx.beginPath();
          ctx.moveTo(-82, 0);
          ctx.lineTo(82, 0);
          ctx.stroke();
          ctx.restore();
        }
        ctx.restore();

        // Swinging Pendulum from center
        const pendAngle = Math.sin(t) * 0.58;
        ctx.save();
        ctx.translate(cx, cy - 28);
        ctx.rotate(pendAngle);
        ctx.lineWidth = 12;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, 168);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 174, 28, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (this.preset === 'beating_heart') {
        const scale = 1 + Math.sin(t) * 0.28;
        const ringR = 55 + ((idx / total) * 145);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.arc(0, 0, ringR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.scale(scale, scale);
        ctx.beginPath();
        ctx.moveTo(0, 38);
        ctx.bezierCurveTo(-110, -35, -75, -115, 0, -52);
        ctx.bezierCurveTo(75, -115, 110, -35, 0, 38 + 34);
        ctx.fill();
        ctx.restore();
      } else {
        // Word Morph ('word_morph' or 'custom_words')
        const words =
          this.preset === 'word_morph'
            ? ['ẢO GIÁC', 'THUẬT SỐ', 'TÂM TRÍ', 'KỲ DIỆU']
            : this.customWords;
        const word = words[idx % words.length];
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '900 104px "Be Vietnam Pro", sans-serif';
        ctx.fillText(word, cx, cy);

        // Decorative corner stars rotating per frame
        ctx.lineWidth = 12;
        ctx.strokeRect(48 + idx * 4, 48 + idx * 4, this.width - 96 - idx * 8, this.height - 96 - idx * 8);
      }
    }

    rebuildInterlacedOnly() {
      const K = this.frames.length;
      const s = this.slitWidth;
      const period = K * s;

      this.interlacedCtx.clearRect(0, 0, this.width, this.height);
      for (let x = 0; x < this.width; x += s) {
        const frameIdx = Math.floor((x % period) / s) % K;
        const srcCanvas = this.frames[frameIdx];
        const w = Math.min(s, this.width - x);
        this.interlacedCtx.drawImage(srcCanvas, x, 0, w, this.height, x, 0, w, this.height);
      }

      const formulaEl = document.getElementById('scan-xray-formula');
      if (formulaEl) {
        formulaEl.textContent = `P = ${K} × ${s}px = ${period}px`;
      }
    }

    _renderThumbnails() {
      const strip = document.getElementById('scan-frames-strip');
      strip.innerHTML = '';
      this.frames.forEach((fc, idx) => {
        const wrap = document.createElement('div');
        wrap.className = 'frame-thumb-card';
        const mini = document.createElement('canvas');
        mini.width = 190;
        mini.height = 100;
        mini.getContext('2d').drawImage(fc, 0, 0, 190, 100);
        const cap = document.createElement('div');
        cap.textContent = `Pha #${idx + 1}`;
        wrap.appendChild(mini);
        wrap.appendChild(cap);
        strip.appendChild(wrap);
      });
    }

    _buildTransparentMaskCanvas() {
      const mc = document.createElement('canvas');
      mc.width = this.width;
      mc.height = this.height;
      const mctx = mc.getContext('2d');
      const K = this.frames.length;
      const s = this.slitWidth;
      const period = K * s;
      const barWidth = (K - 1) * s;

      mctx.fillStyle = '#000000';
      for (let x = 0; x < this.width + period; x += period) {
        mctx.fillRect(x, 0, barWidth, this.height);
      }
      return mc;
    }

    _downloadCanvasPng(canvasEl, fileName) {
      const link = document.createElement('a');
      link.download = fileName;
      link.href = canvasEl.toDataURL('image/png');
      link.click();
    }

    _startLoop() {
      let lastTs = performance.now();
      const step = (now) => {
        const dt = Math.min(0.05, (now - lastTs) / 1000);
        lastTs = now;

        const panel = document.getElementById('act-scanimation');
        if (panel && panel.classList.contains('active')) {
          if (this.autoPlay && !this.isDragging) {
            const K = this.frames.length;
            const period = K * this.slitWidth;
            this.maskOffset = (this.maskOffset + dt * 16 * this.speed) % period;
          }
          this.renderFrame();
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }

    renderFrame() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.width, this.height);

      // 1. Draw frozen static interlaced image underneath
      ctx.drawImage(this.interlacedCanvas, 0, 0);

      // 2. Draw movable Ronchi Barrier Mask on top
      const K = this.frames.length;
      const s = this.slitWidth;
      const period = K * s;
      const barWidth = (K - 1) * s;
      const startShift = ((this.maskOffset % period) + period) % period;
      const maskLimitX = this.peelHalf ? Math.floor(this.width * 0.54) : this.width;

      if (this.maskOpacity > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, maskLimitX, this.height);
        ctx.clip();

        ctx.fillStyle = `rgba(9, 9, 13, ${this.maskOpacity})`;
        for (let x = -period + startShift; x < maskLimitX + period; x += period) {
          ctx.fillRect(Math.round(x), 0, barWidth, this.height);
        }
        ctx.restore();
      }

      if (this.peelHalf) {
        ctx.save();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(maskLimitX, 0);
        ctx.lineTo(maskLimitX, this.height);
        ctx.stroke();

        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.fillRect(maskLimitX + 12, 14, 240, 32);
        ctx.fillStyle = '#fef08a';
        ctx.font = '700 12px "Be Vietnam Pro", sans-serif';
        ctx.fillText('← Có lưới đen | Ảnh tĩnh thật 100% →', maskLimitX + 20, 34);
        ctx.restore();
      }
    }
  }

  // =========================================================================
  // 2. ACT V: VISUAL CORTEX ILLUSION ENGINE + EYEDROPPER
  // =========================================================================
  class CortexIllusionLab {
    constructor() {
      this.canvas = document.getElementById('cortex-canvas');
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
      this.w = this.canvas.width;
      this.h = this.canvas.height;

      this.activeIllusion = 'adelson';
      this.params = {
        adelsonBridge: 0,       // 0..100%
        steppingContrast: 100,  // 0..100%
        steppingRail: false,
        cafeOffset: 50,         // 0..100%
        cafeLaser: false,
        mibSpeed: 1.4
      };
      this.animTime = 0;

      this._bindTabsAndEyedropper();
      this.renderControls();
      this._startLoop();
    }

    _bindTabsAndEyedropper() {
      document.querySelectorAll('#cortex-illusion-tabs .seg-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('#cortex-illusion-tabs .seg-btn').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          this.activeIllusion = btn.dataset.illusion;
          this.renderControls();
        });
      });

      this.canvas.addEventListener('mousemove', (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const px = Math.max(0, Math.min(this.w - 1, Math.floor(((e.clientX - rect.left) / rect.width) * this.w)));
        const py = Math.max(0, Math.min(this.h - 1, Math.floor(((e.clientY - rect.top) / rect.height) * this.h)));
        const data = this.ctx.getImageData(px, py, 1, 1).data;
        const hex =
          '#' +
          [data[0], data[1], data[2]]
            .map((v) => v.toString(16).padStart(2, '0'))
            .join('')
            .toUpperCase();
        document.getElementById('eyedropper-swatch').style.background = hex;
        document.getElementById('eyedropper-readout').textContent = `Pixel (${px}, ${py}) → RGB(${data[0]}, ${data[1]}, ${data[2]}) • HEX ${hex}`;
      });
    }

    renderControls() {
      const bar = document.getElementById('cortex-controls-bar');
      const exp = document.getElementById('cortex-explanation-box');

      if (this.activeIllusion === 'adelson') {
        bar.innerHTML = `
          <label>
            <span>Bắc Cầu Nối Kiểm Chứng Ô A &amp; Ô B: <strong id="lbl-adelson-br">${this.params.adelsonBridge}%</strong></span>
            <input type="range" id="ctrl-adelson-br" min="0" max="100" value="${this.params.adelsonBridge}" />
          </label>
        `;
        exp.innerHTML = `
          <div class="xray-header"><span>🧠 NGUYÊN LÝ VỎ NÃO THỊ GIÁC V4: BÙ TRỪ ĐỘ SÁNG BỐI CẢNH (LIGHTNESS CONSTANCY)</span></div>
          <p class="xray-explain">
            <strong>Ô A</strong> và <strong>Ô B</strong> đều được tô mã màu <code>RGB(120, 120, 120) / #787878</code> giống hệt nhau từng đơn vị ánh sáng! Vì Ô B nằm trong vùng bóng đổ của khối trụ xanh và được bao quanh bởi các ô tối hơn, vỏ não tự động "cộng bù độ sáng" khiến bạn thề rằng B trắng sáng hơn A. Hãy di chuột hút màu hoặc kéo thanh cầu nối lên 100%!
          </p>
        `;
        document.getElementById('ctrl-adelson-br').addEventListener('input', (e) => {
          this.params.adelsonBridge = Number(e.target.value);
          document.getElementById('lbl-adelson-br').textContent = `${this.params.adelsonBridge}%`;
        });
      } else if (this.activeIllusion === 'stepping') {
        bar.innerHTML = `
          <label>
            <span>Độ tương phản sọc nền đen trắng: <strong id="lbl-step-c">${this.params.steppingContrast}%</strong></span>
            <input type="range" id="ctrl-step-c" min="0" max="100" value="${this.params.steppingContrast}" />
          </label>
          <button type="button" class="btn-secondary small-btn" id="btn-step-rail">📏 Bật/Tắt Thanh Nối Song Hành</button>
        `;
        exp.innerHTML = `
          <div class="xray-header"><span>🧠 NGUYÊN LÝ TẾ BÀO HƯỚNG CHUYỂN ĐỘNG MT/V5 (STUART ANSTIS)</span></div>
          <p class="xray-explain">
            Hai khối xanh đen và vàng tươi đang trôi ngang với <strong>cùng vận tốc không đổi tuyệt đối</strong>! Nhưng khi cạnh trước của khối vàng chạm vạch trắng (tương phản thấp → trông như dừng lại) và chạm vạch đen (tương phản vọt cao → trông như nhảy vọt), não bộ giải mã nhầm độ tương phản biên thành tốc độ bước chân lệch nhịp! Kéo thanh tương phản về 0% để thấy sự thật.
          </p>
        `;
        document.getElementById('ctrl-step-c').addEventListener('input', (e) => {
          this.params.steppingContrast = Number(e.target.value);
          document.getElementById('lbl-step-c').textContent = `${this.params.steppingContrast}%`;
        });
        document.getElementById('btn-step-rail').addEventListener('click', () => {
          this.params.steppingRail = !this.params.steppingRail;
        });
      } else if (this.activeIllusion === 'cafewall') {
        bar.innerHTML = `
          <label>
            <span>Độ trượt lệch hàng gạch: <strong id="lbl-cafe-off">${this.params.cafeOffset}%</strong></span>
            <input type="range" id="ctrl-cafe-off" min="0" max="100" value="${this.params.cafeOffset}" />
          </label>
          <button type="button" class="btn-cyan-glow small-btn" id="btn-cafe-laser">🔴 Bật/Tắt Thước Laser Đỏ 0.00°</button>
        `;
        exp.innerHTML = `
          <div class="xray-header"><span>🧠 NGUYÊN LÝ TƯƠNG TÁC TẾ BÀO ĐƠN GIẢN V1 &amp; MẠCH VỮA TRUNG TÍNH</span></div>
          <p class="xray-explain">
            Toàn bộ các đường vữa ngang trên bức tường đều <strong>song song tuyệt đối 0.00°</strong>! Chính đường vữa xám mỏng nằm kẹp giữa các viên gạch đen/trắng so le đã kích hoạt sự lan truyền sáng-tối chéo ở võng mạc, đánh lừa tế bào phát hiện góc nghiêng ở vùng V1 biến các hàng gạch thành hình thang nghiêng ngả!
          </p>
        `;
        document.getElementById('ctrl-cafe-off').addEventListener('input', (e) => {
          this.params.cafeOffset = Number(e.target.value);
          document.getElementById('lbl-cafe-off').textContent = `${this.params.cafeOffset}%`;
        });
        document.getElementById('btn-cafe-laser').addEventListener('click', () => {
          this.params.cafeLaser = !this.params.cafeLaser;
        });
      } else if (this.activeIllusion === 'mib') {
        bar.innerHTML = `
          <label>
            <span>Tốc độ xoay lưới chữ thập xanh: <strong id="lbl-mib-sp">${this.params.mibSpeed.toFixed(1)}x</strong></span>
            <input type="range" id="ctrl-mib-sp" min="0" max="3.5" step="0.1" value="${this.params.mibSpeed}" />
          </label>
        `;
        exp.innerHTML = `
          <div class="xray-header"><span>🧠 ĐIỂM MÙ CHUYỂN ĐỘNG (MOTION-INDUCED BLINDNESS — NATURE 2001)</span></div>
          <p class="xray-explain">
            <strong>Thử thách 6 giây:</strong> Hãy dán chặt ánh mắt vào <strong>tâm tròn đỏ nhấp nháy ở chính giữa</strong>, tuyệt đối không đảo mắt sang chỗ khác! Chỉ sau 4–6 giây, <strong>3 chấm tròn vàng sáng rực rỡ</strong> xung quanh sẽ tự động bị vỏ não "xóa sổ" biến mất hoàn toàn vào khoảng không đen tuyền — dù chúng chưa từng tắt một mili-giây nào!
          </p>
        `;
        document.getElementById('ctrl-mib-sp').addEventListener('input', (e) => {
          this.params.mibSpeed = Number(e.target.value);
          document.getElementById('lbl-mib-sp').textContent = `${this.params.mibSpeed.toFixed(1)}x`;
        });
      }
    }

    _startLoop() {
      let prev = performance.now();
      const loop = (now) => {
        const dt = Math.min(0.05, (now - prev) / 1000);
        prev = now;
        const panel = document.getElementById('act-cortex');
        if (panel && panel.classList.contains('active')) {
          this.animTime += dt;
          this.draw();
        }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }

    draw() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.w, this.h);

      if (this.activeIllusion === 'adelson') {
        this._drawAdelson(ctx);
      } else if (this.activeIllusion === 'stepping') {
        this._drawSteppingFeet(ctx);
      } else if (this.activeIllusion === 'cafewall') {
        this._drawCafeWall(ctx);
      } else {
        this._drawMIB(ctx);
      }
    }

    _drawAdelson(ctx) {
      // Clean 5x5 isometric/grid checkerboard where Tile A = (1,1) dark-unshadowed and Tile B = (2,2) light-shadowed
      // Exact luminance engineering:
      // Unshadowed: light = 208, dark = 120  --> Tile A (row 1, col 1, dark) = 120!
      // Shadowed (factor = 120/208): light_shadowed = 120, dark_shadowed = 68 --> Tile B (row 2, col 2, light in shadow) = 120!
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, this.w, this.h);

      const cols = 6;
      const rows = 5;
      const tileW = 76;
      const tileH = 56;
      const startX = 88;
      const startY = 58;

      // Soft shadow region polygon Check
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const isDarkSquare = (r + c) % 2 === 0;
          const x = startX + c * tileW;
          const y = startY + r * tileH;

          // Tile A is (r=1, c=1 -> isDarkSquare=true -> 120)
          // Tile B is (r=2, c=3 -> r+c=5 -> isDarkSquare=false, inside cylinder shadow -> 120!)
          const inCoreShadow =
            (r === 2 && c === 3) ||
            (r === 2 && c === 2) ||
            (r === 3 && c === 2) ||
            (r === 3 && c === 3) ||
            (r === 1 && c === 3);

          let gray;
          if (r === 1 && c === 1) {
            gray = 120; // EXACT TILE A
          } else if (r === 2 && c === 3) {
            gray = 120; // EXACT TILE B
          } else if (inCoreShadow) {
            gray = isDarkSquare ? 68 : 120;
          } else {
            gray = isDarkSquare ? 120 : 208;
          }

          ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
          ctx.fillRect(x, y, tileW, tileH);
        }
      }

      // Subtle penumbra frame ONLY along shadow boundary edges (never touching centers of A or B!)
      ctx.save();
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.26)';
      ctx.lineWidth = 10;
      ctx.strokeRect(startX + 2 * tileW, startY + 1 * tileH, tileW * 2, tileH * 3);
      ctx.restore();

      // Green 3D Cylinder on top-right casting the shadow toward bottom-left
      const cylX = startX + 4.45 * tileW;
      const cylY = startY + 1.35 * tileH;
      const grad = ctx.createLinearGradient(cylX - 42, 0, cylX + 42, 0);
      grad.addColorStop(0, '#065f46');
      grad.addColorStop(0.35, '#34d399');
      grad.addColorStop(1, '#064e3b');
      ctx.fillStyle = grad;
      ctx.fillRect(cylX - 42, cylY - 75, 84, 125);
      ctx.beginPath();
      ctx.ellipse(cylX, cylY + 50, 42, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6ee7b7';
      ctx.beginPath();
      ctx.ellipse(cylX, cylY - 75, 42, 16, 0, 0, Math.PI * 2);
      ctx.fill();

      // Corner Badges outside pixel center of A and B so center stays pure #787878
      const ax = startX + 1 * tileW;
      const ay = startY + 1 * tileH;
      const bx = startX + 3 * tileW;
      const by = startY + 2 * tileH;

      ctx.font = '800 16px "JetBrains Mono", monospace';
      ctx.fillStyle = '#f8fafc';
      ctx.fillText('A', ax + 8, ay + 20);
      ctx.fillStyle = '#0f172a';
      ctx.fillText('B', bx + 8, by + 20);

      // Interactive Verification Bridge (pure RGB(120,120,120) connecting A & B!)
      if (this.params.adelsonBridge > 0) {
        const p = this.params.adelsonBridge / 100;
        ctx.fillStyle = 'rgb(120, 120, 120)';
        const startBx = ax + tileW * 0.55;
        const endBx = bx + tileW * 0.45;
        const curEndX = startBx + (endBx - startBx) * p;
        const curEndY = ay + tileH * 0.5 + (by - ay) * p;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(startBx - 12, ay + 14);
        ctx.lineTo(startBx + 16, ay + 14);
        ctx.lineTo(curEndX + 16, curEndY + 28);
        ctx.lineTo(curEndX - 12, curEndY + 28);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    _drawSteppingFeet(ctx) {
      const c = this.params.steppingContrast / 100;
      const lightV = Math.round(128 + 127 * c);
      const darkV = Math.round(128 - 128 * c);
      const stripeW = 18;

      for (let x = 0; x < this.w; x += stripeW) {
        const isLight = Math.floor(x / stripeW) % 2 === 0;
        const v = isLight ? lightV : darkV;
        ctx.fillStyle = `rgb(${v}, ${v}, ${v})`;
        ctx.fillRect(x, 0, stripeW, this.h);
      }

      // Constant velocity horizontal sweep
      const span = this.w - 110;
      const cycle = (this.animTime * 0.22) % 2;
      const norm = cycle <= 1 ? cycle : 2 - cycle;
      const busX = 20 + norm * span;

      // Yellow bus (top) & Dark-blue bus (bottom) at IDENTICAL X!
      ctx.fillStyle = '#fde047';
      ctx.fillRect(busX, 108, 72, 38);

      ctx.fillStyle = '#090d26';
      ctx.fillRect(busX, 224, 72, 38);

      if (this.params.steppingRail) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(busX + 36, 85);
        ctx.lineTo(busX + 36, 285);
        ctx.stroke();
      }
    }

    _drawCafeWall(ctx) {
      ctx.fillStyle = '#808080'; // Critical mid-gray mortar!
      ctx.fillRect(0, 0, this.w, this.h);

      const rowH = 38;
      const mortar = 2.5;
      const tileW = 48;
      const rows = Math.floor(this.h / rowH);
      const shiftMax = tileW * 0.5 * (this.params.cafeOffset / 100);

      for (let r = 0; r < rows; r++) {
        const y = r * rowH + mortar;
        const h = rowH - mortar;
        const phase = (r % 2 === 1 ? 1 : r % 4 === 2 ? 0.5 : 0) * shiftMax * 2;

        for (let c = -2; c < Math.ceil(this.w / tileW) + 2; c++) {
          ctx.fillStyle = c % 2 === 0 ? '#09090b' : '#f8fafc';
          ctx.fillRect(c * tileW + (r % 2 === 0 ? 0 : shiftMax), y, tileW, h);
        }
      }

      if (this.params.cafeLaser) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5;
        for (let r = 1; r < rows; r++) {
          ctx.beginPath();
          ctx.moveTo(0, r * rowH + 1);
          ctx.lineTo(this.w, r * rowH + 1);
          ctx.stroke();
        }
      }
    }

    _drawMIB(ctx) {
      ctx.fillStyle = '#05050a';
      ctx.fillRect(0, 0, this.w, this.h);

      const cx = this.w / 2;
      const cy = this.h / 2;

      // Rotating cloud of blue crosses
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(this.animTime * 0.85 * this.params.mibSpeed);
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 2.4;

      const spacing = 36;
      for (let gx = -260; gx <= 260; gx += spacing) {
        for (let gy = -260; gy <= 260; gy += spacing) {
          if (gx * gx + gy * gy < 250 * 250) {
            ctx.beginPath();
            ctx.moveTo(gx - 7, gy);
            ctx.lineTo(gx + 7, gy);
            ctx.moveTo(gx, gy - 7);
            ctx.lineTo(gx, gy + 7);
            ctx.stroke();
          }
        }
      }
      ctx.restore();

      // 3 Bright Stationary Yellow Targets (100% constant luminance!)
      const rTarget = 92;
      ctx.fillStyle = '#facc15';
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 3;
        const tx = cx + Math.cos(a) * rTarget;
        const ty = cy + Math.sin(a) * rTarget;
        ctx.beginPath();
        ctx.arc(tx, ty, 6.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Blinking Central Fixation Dot
      const blink = Math.sin(this.animTime * 7.5) > 0;
      ctx.fillStyle = blink ? '#ef4444' : '#fca5a5';
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // =========================================================================
  // 3. SHEPARD TONE AUDITORY ILLUSION + CORTEX BIAS BENCHMARK
  // =========================================================================
  class ShepardAndBenchmark {
    constructor(onBenchmarkSaved) {
      this.onBenchmarkSaved = onBenchmarkSaved;
      this.sCanvas = document.getElementById('shepard-canvas');
      this.sCtx = this.sCanvas.getContext('2d');
      this.audioCtx = null;
      this.oscillators = [];
      this.gains = [];
      this.direction = 0; // 1 = up, -1 = down, 0 = stopped
      this.phase = 0;

      this.bmCanvas = document.getElementById('benchmark-canvas');
      this.bmCtx = this.bmCanvas.getContext('2d');
      this.mullerGuess = 42;     // True = 50.0
      this.ebbinghausGuess = 17; // True = 20.0
      this.showRuler = false;

      this._bindShepard();
      this._bindBenchmark();
      this._drawShepardVisualizer();
      this.drawBenchmark();
      this._loop();
    }

    _bindShepard() {
      const btnUp = document.getElementById('btn-shepard-up');
      const btnDown = document.getElementById('btn-shepard-down');
      const btnStop = document.getElementById('btn-shepard-stop');

      btnUp.addEventListener('click', () => {
        this._startAudio(1);
        btnStop.disabled = false;
      });
      btnDown.addEventListener('click', () => {
        this._startAudio(-1);
        btnStop.disabled = false;
      });
      btnStop.addEventListener('click', () => {
        this.stopAudio();
        btnStop.disabled = true;
      });
    }

    _startAudio(dir) {
      this.direction = dir;
      if (!this.audioCtx) {
        const AudioCtor = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioCtor();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      if (this.oscillators.length === 0) {
        const master = this.audioCtx.createGain();
        master.gain.value = 0.14;
        master.connect(this.audioCtx.destination);

        for (let i = 0; i < 6; i++) {
          const osc = this.audioCtx.createOscillator();
          const g = this.audioCtx.createGain();
          osc.type = 'sine';
          g.gain.value = 0;
          osc.connect(g);
          g.connect(master);
          osc.start();
          this.oscillators.push(osc);
          this.gains.push(g);
        }
      }
    }

    stopAudio() {
      this.direction = 0;
      this.gains.forEach((g) => {
        if (this.audioCtx) {
          g.gain.setTargetAtTime(0, this.audioCtx.currentTime, 0.05);
        }
      });
    }

    _updateShepardAudio(dt) {
      if (this.direction === 0 || !this.audioCtx) return;
      this.phase = (this.phase + dt * 0.11 * this.direction + 1) % 1;
      const minOct = 5; // 32 Hz
      const spanOct = 6;

      for (let i = 0; i < 6; i++) {
        const pos = (i + this.phase) % 6; // 0..6 in octave space
        const norm = pos / spanOct; // 0..1
        const freq = Math.pow(2, minOct + pos);
        // Bell-shaped Gaussian envelope peaking at norm = 0.5
        const bell = Math.exp(-Math.pow((norm - 0.5) / 0.22, 2));
        this.oscillators[i].frequency.setValueAtTime(freq, this.audioCtx.currentTime);
        this.gains[i].gain.setTargetAtTime(bell, this.audioCtx.currentTime, 0.03);
      }
    }

    _drawShepardVisualizer() {
      const ctx = this.sCtx;
      const w = this.sCanvas.width;
      const h = this.sCanvas.height;
      ctx.fillStyle = '#090812';
      ctx.fillRect(0, 0, w, h);

      // Draw Gaussian envelope curve
      ctx.strokeStyle = 'rgba(245, 196, 81, 0.45)';
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 4) {
        const norm = x / w;
        const bell = Math.exp(-Math.pow((norm - 0.5) / 0.22, 2));
        const y = h - 18 - bell * (h - 38);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw 6 sliding harmonic octave bars
      for (let i = 0; i < 6; i++) {
        const pos = (i + this.phase) % 6;
        const norm = pos / 6;
        const bell = Math.exp(-Math.pow((norm - 0.5) / 0.22, 2));
        const x = 24 + norm * (w - 48);
        const barH = bell * (h - 42);

        ctx.fillStyle = this.direction !== 0 ? '#22d3ee' : '#64748b';
        ctx.fillRect(x - 6, h - 18 - barH, 12, barH);
        ctx.fillStyle = '#fef08a';
        ctx.font = '10px "JetBrains Mono", monospace';
        const hz = Math.round(Math.pow(2, 5 + pos));
        ctx.fillText(`${hz}Hz`, x - 16, h - 5);
      }
    }

    _bindBenchmark() {
      const mSlider = document.getElementById('bm-muller-slider');
      const eSlider = document.getElementById('bm-ebbinghaus-slider');
      const evalBtn = document.getElementById('btn-bm-evaluate');
      const resetBtn = document.getElementById('btn-bm-reset');
      const resBox = document.getElementById('bm-result-box');

      mSlider.addEventListener('input', () => {
        this.mullerGuess = Number(mSlider.value);
        this.showRuler = false;
        resBox.hidden = true;
        this.drawBenchmark();
      });

      eSlider.addEventListener('input', () => {
        this.ebbinghausGuess = Number(eSlider.value);
        this.showRuler = false;
        resBox.hidden = true;
        this.drawBenchmark();
      });

      evalBtn.addEventListener('click', async () => {
        this.showRuler = true;
        this.drawBenchmark();

        // True midpoint = 50.0; True radius = 20.0
        const mullerErrPct = Number((Math.abs(this.mullerGuess - 50) * 2).toFixed(1));
        const ebbErrPct = Number(((Math.abs(this.ebbinghausGuess - 20) / 20) * 100).toFixed(1));
        const immunity = Number(Math.max(0, 100 - (mullerErrPct + ebbErrPct) / 2).toFixed(1));

        resBox.hidden = false;
        resBox.innerHTML = `
          <strong>🎯 Điểm Kháng Ảo Giác Của Bạn: ${immunity}%</strong><br/>
          • Sai số đoạn thẳng Müller-Lyer: <code>${mullerErrPct}%</code> (Bạn đặt ở ${this.mullerGuess.toFixed(1)}%, tâm thật 50.0%)<br/>
          • Sai số vòng tròn Ebbinghaus: <code>${ebbErrPct}%</code> (Bán kính bạn chọn ${this.ebbinghausGuess.toFixed(1)}px, chuẩn 20.0px)
        `;

        if (typeof this.onBenchmarkSaved === 'function') {
          this.onBenchmarkSaved({
            playerName: document.getElementById('bm-player-name').value || 'Khán Giả Võng Mạc',
            immunity,
            mullerErrPct,
            ebbErrPct
          });
        }
      });

      resetBtn.addEventListener('click', () => {
        this.mullerGuess = 39 + Math.round(Math.random() * 6);
        this.ebbinghausGuess = 16 + Math.round(Math.random() * 3);
        mSlider.value = String(this.mullerGuess);
        eSlider.value = String(this.ebbinghausGuess);
        this.showRuler = false;
        resBox.hidden = true;
        this.drawBenchmark();
      });
    }

    drawBenchmark() {
      const ctx = this.bmCtx;
      const w = this.bmCanvas.width;
      const h = this.bmCanvas.height;
      ctx.fillStyle = '#0d0b18';
      ctx.fillRect(0, 0, w, h);

      // 1. Top Half: Brentano / Müller-Lyer Bisection
      const x1 = 56;
      const x2 = w - 56;
      const yLine = 46;
      const midTrue = (x1 + x2) / 2;
      const midUser = x1 + (x2 - x1) * (this.mullerGuess / 100);

      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x1, yLine);
      ctx.lineTo(x2, yLine);
      ctx.stroke();

      // Left fins pointing OUTWARD (<---), middle fins INWARD (>---<), right fins OUTWARD
      const drawFin = (x, dir) => {
        ctx.beginPath();
        ctx.moveTo(x + dir * 16, yLine - 14);
        ctx.lineTo(x, yLine);
        ctx.lineTo(x + dir * 16, yLine + 14);
        ctx.stroke();
      };
      drawFin(x1, 1);
      drawFin(x2, -1);
      ctx.strokeStyle = '#f43f5e';
      drawFin(midUser, -1);
      ctx.beginPath();
      ctx.arc(midUser, yLine, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#f43f5e';
      ctx.fill();

      // 2. Bottom Half: Ebbinghaus Context Circles
      const cy = 144;
      const leftCx = 132;
      const rightCx = 332;

      // Left surrounds (6 big circles R=24)
      ctx.fillStyle = '#334155';
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI * 2) / 6;
        ctx.beginPath();
        ctx.arc(leftCx + Math.cos(a) * 52, cy + Math.sin(a) * 52, 21, 0, Math.PI * 2);
        ctx.fill();
      }
      // Right surrounds (8 tiny circles R=7)
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI * 2) / 8;
        ctx.beginPath();
        ctx.arc(rightCx + Math.cos(a) * 34, cy + Math.sin(a) * 34, 7, 0, Math.PI * 2);
        ctx.fill();
      }

      // Left target orange circle (R = 20) & Right user orange circle
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(leftCx, cy, 20, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(rightCx, cy, this.ebbinghausGuess, 0, Math.PI * 2);
      ctx.fill();

      // Calibration rulers when evaluated!
      if (this.showRuler) {
        ctx.save();
        ctx.strokeStyle = '#22d3ee';
        ctx.setLineDash([4, 3]);
        ctx.lineWidth = 2;
        // True midpoint vertical line
        ctx.beginPath();
        ctx.moveTo(midTrue, yLine - 24);
        ctx.lineTo(midTrue, yLine + 24);
        ctx.stroke();

        // Parallel tangent lines across the two orange circles
        ctx.beginPath();
        ctx.moveTo(leftCx - 30, cy - 20);
        ctx.lineTo(rightCx + 30, cy - 20);
        ctx.moveTo(leftCx - 30, cy + 20);
        ctx.lineTo(rightCx + 30, cy + 20);
        ctx.stroke();
        ctx.restore();
      }
    }

    _loop() {
      let last = performance.now();
      const tick = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        if (this.direction !== 0) {
          this._updateShepardAudio(dt);
          this._drawShepardVisualizer();
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }

  window.ArcanaIllusions = {
    ScanimationStudio,
    CortexIllusionLab,
    ShepardAndBenchmark
  };
})();
