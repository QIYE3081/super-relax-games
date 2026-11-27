/**
 * 高压冲洗小游戏引擎 v3
 * ------------------------------------------------------------
 * 视觉：真实 3D 素材图，正/反两面。净图作底，脏图为可擦除上层。
 * 交互：水龙头固定在右下角；按住水龙头出水、松开停；水流为射线，
 *       可冲到被冲洗物之外；按住时移动鼠标/手指控制水龙头方向。
 *       点"翻面"旋转物体，轮流冲洗两面；两面都洗净才完成。
 *
 * config:
 *   canvasId, progressFillId, progressTextId, flipBtnId, muteBtnId,
 *   doneOverlayId, thanksTextId, doneEmojiId,
 *   sides: [{clean, dirty}, {clean, dirty}],  brush, thanks, doneEmoji, onComplete
 */
(function (global) {
  'use strict';

  var R = 560;
  var DPR = Math.min(global.devicePixelRatio || 1, 2);
  var TAU = Math.PI * 2;

  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function rand(a, b) { return a + Math.random() * (b - a); }

  // ---------- 音效 ----------
  function AudioKit() {
    this.ctx = null; this.muted = false; this.waterGain = null; this.waterSrc = null;
  }
  AudioKit.prototype._ensure = function () {
    if (this.ctx) return;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    var len = this.ctx.sampleRate * 2;
    var buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
  };
  AudioKit.prototype.resume = function () {
    this._ensure();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  };
  AudioKit.prototype.startWater = function () {
    this.resume();
    if (!this.ctx || this.muted || this.waterSrc) return;
    var src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    var bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 0.6;
    var g = this.ctx.createGain(); g.gain.value = 0.0001;
    src.connect(bp); bp.connect(g); g.connect(this.ctx.destination);
    src.start();
    g.gain.exponentialRampToValueAtTime(0.13, this.ctx.currentTime + 0.1);
    this.waterSrc = src; this.waterGain = g;
  };
  AudioKit.prototype.stopWater = function () {
    if (!this.waterSrc || !this.ctx) return;
    var src = this.waterSrc, g = this.waterGain;
    try {
      g.gain.cancelScheduledValues(this.ctx.currentTime);
      g.gain.setValueAtTime(g.gain.value, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.12);
      src.stop(this.ctx.currentTime + 0.14);
    } catch (e) {}
    this.waterSrc = null; this.waterGain = null;
  };
  AudioKit.prototype.success = function () {
    this.resume();
    if (!this.ctx || this.muted) return;
    var self = this;
    [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) {
      var o = self.ctx.createOscillator(), g = self.ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      var t = self.ctx.currentTime + i * 0.12;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.22, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(g); g.connect(self.ctx.destination);
      o.start(t); o.stop(t + 0.4);
    });
  };
  AudioKit.prototype.toggleMute = function () {
    this.muted = !this.muted;
    if (this.muted) this.stopWater();
    return this.muted;
  };

  // ---------- 主引擎 ----------
  function create(config) {
    var canvas = $(config.canvasId);
    if (!canvas) { console.error('CleanWash: canvas not found', config.canvasId); return null; }
    var ctx = canvas.getContext('2d');
    canvas.width = R * DPR; canvas.height = R * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    var audio = new AudioKit();

    var TAP_X = R - 62, TAP_Y = R - 62;   // 水龙头中心（右下角固定）
    var TAP_R = 56;                        // 水龙头可点击半径

    var state = {
      side: 0,                 // 当前面 0/1
      flip: 0,                 // 翻面动画进度 0..1
      flipping: false,
      spraying: false,
      aimX: R * 0.42, aimY: R * 0.4,
      particles: [], droplets: [], mists: [], confetti: [],
      t: 0, lastTs: 0,
      brush: config.brush || 26,
      done: false, doneAt: 0,
      ready: false
    };

    function makeSide(cfg) {
      var c = document.createElement('canvas');
      c.width = R * DPR; c.height = R * DPR;
      var cc = c.getContext('2d', { willReadFrequently: true });
      cc.setTransform(DPR, 0, 0, DPR, 0, 0);
      return { canvas: c, ctx: cc, clean: null, dirty: null, cfg: cfg,
               initialDirt: 1, progress: 0, doneAt: 0 };
    }
    var sides = [makeSide(config.sides[0]), makeSide(config.sides[1])];

    function loadImage(src) {
      return new Promise(function (res, rej) {
        var im = new Image();
        im.onload = function () { res(im); };
        im.onerror = function () { rej(new Error('图片加载失败: ' + src)); };
        im.src = src;
      });
    }

    function buildSide(sd) {
      sd.ctx.save();
      sd.ctx.setTransform(1, 0, 0, 1, 0, 0);
      sd.ctx.clearRect(0, 0, sd.canvas.width, sd.canvas.height);
      sd.ctx.restore();
      if (sd.dirty) sd.ctx.drawImage(sd.dirty, 0, 0, R, R);
      sd.initialDirt = countDirt(sd.ctx);
      sd.progress = 0;
      updateProgressUI();
    }
    function countDirt(cc) {
      var img = cc.getImageData(0, 0, R * DPR, R * DPR).data;
      var count = 0, step = 4 * DPR;
      for (var y = 0; y < R * DPR; y += step)
        for (var x = 0; x < R * DPR; x += step)
          if (img[(y * R * DPR + x) * 4 + 3] > 40) count++;
      return Math.max(count, 1);
    }
    function measureClean(sd) {
      var img = sd.ctx.getImageData(0, 0, R * DPR, R * DPR).data;
      var count = 0, step = 4 * DPR;
      for (var y = 0; y < R * DPR; y += step)
        for (var x = 0; x < R * DPR; x += step)
          if (img[(y * R * DPR + x) * 4 + 3] > 40) count++;
      return 1 - count / sd.initialDirt;
    }

    // 沿射线擦除：从水龙头口射向 aim，贯穿并延伸到画布外
    function eraseRay(sd) {
      var ox = TAP_X, oy = TAP_Y;
      var dx = state.aimX - ox, dy = state.aimY - oy;
      var len = Math.hypot(dx, dy) || 1;
      var ux = dx / len, uy = dy / len;
      var reach = Math.hypot(R, R) * 1.4;   // 射程足够远，冲出画布
      var steps = Math.ceil(reach / (state.brush * 0.35));
      sd.ctx.save();
      sd.ctx.globalCompositeOperation = 'destination-out';
      for (var i = 0; i <= steps; i++) {
        var d = i * state.brush * 0.35;
        var x = ox + ux * d, y = oy + uy * d;
        var g = sd.ctx.createRadialGradient(x, y, state.brush * 0.2, x, y, state.brush);
        // 顽固污垢：每次只擦除一小部分，需持续冲洗约3秒以上才逐渐干净
        g.addColorStop(0, 'rgba(0,0,0,0.10)');
        g.addColorStop(0.6, 'rgba(0,0,0,0.07)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        sd.ctx.fillStyle = g;
        sd.ctx.beginPath(); sd.ctx.arc(x, y, state.brush, 0, TAU); sd.ctx.fill();
      }
      sd.ctx.restore();
      // 沿整条射流生成水雾微粒，营造真实水流质感
      for (var k = 0; k < 8; k++) {
        var dd = rand(20, Math.min(reach * 0.75, R * 1.2));
        spawnMist(ox + ux * dd, oy + uy * dd, ux, uy);
      }
      // 命中物体区域时溅起水花
      if (len > 40) {
        for (var k2 = 0; k2 < 2; k2++) spawnSplash(ox + ux * Math.min(len, R), oy + uy * Math.min(len, R));
      }
    }
    function spawnMist(x, y, ux, uy) {
      state.mists.push({
        x: x + rand(-6, 6), y: y + rand(-6, 6),
        vx: ux * rand(1, 4) + rand(-1.2, 1.2),
        vy: uy * rand(1, 4) + rand(-1.2, 1.2),
        r: rand(0.8, 2.6), life: 1, decay: rand(0.05, 0.1)
      });
      if (state.mists.length > 260) state.mists.splice(0, state.mists.length - 260);
    }

    function spawnSplash(sx, sy) {
      state.particles.push({
        x: sx, y: sy, vx: rand(-2.6, 2.6), vy: rand(-3.6, -0.6),
        r: rand(1.5, 4.2), life: 1, decay: rand(0.025, 0.05)
      });
      if (state.particles.length > 320) state.particles.splice(0, state.particles.length - 320);
      if (Math.random() < 0.4) {
        state.droplets.push({ x: sx, y: sy, life: 1 });
        if (state.droplets.length > 50) state.droplets.shift();
      }
    }
    function spawnConfetti() {
      var colors = ['#FF6B8A', '#FFD166', '#5BD6A8', '#7FC8F8', '#C7A7F7'];
      for (var i = 0; i < 110; i++) {
        state.confetti.push({
          x: rand(0, R), y: rand(-R * 0.6, 0),
          vx: rand(-1.4, 1.4), vy: rand(1.4, 4.2),
          w: rand(6, 12), h: rand(9, 18), rot: rand(0, TAU), vr: rand(-0.16, 0.16),
          color: colors[i % colors.length], heart: i % 4 === 0
        });
      }
    }

    function updateAim(clientX, clientY) {
      var rect = canvas.getBoundingClientRect();
      var px = clamp((clientX - rect.left) / rect.width * R, -R, R * 2);
      var py = clamp((clientY - rect.top) / rect.height * R, -R, R * 2);
      // 限制扫动范围：水龙头在右下角，水流只能朝画面内部的左上90°扇形
      // （沿右边界向上 -90° ~ 沿下边界向左 180°/-180°）
      var dx = px - TAP_X, dy = py - TAP_Y;
      var ang = Math.atan2(dy, dx); // -π..π
      // 目标扇形：角度在 [-π, -π/2]（左上象限，dy<0 且 dx<0）
      ang = clamp(ang, -Math.PI, -Math.PI / 2);
      var dist = Math.hypot(dx, dy) || 1;
      state.aimX = TAP_X + Math.cos(ang) * dist;
      state.aimY = TAP_Y + Math.sin(ang) * dist;
    }
    // 当前射流的单位方向与角度（供水柱/水龙头/擦除共用一致朝向）
    function flowDir() {
      var dx = state.aimX - TAP_X, dy = state.aimY - TAP_Y;
      var len = Math.hypot(dx, dy);
      if (len < 5) { dx = -1; dy = -1; len = Math.SQRT2; } // 默认朝画面左上
      return { ux: dx / len, uy: dy / len, ang: Math.atan2(dy, dx), len: len };
    }

    function startSpray() {
      if (state.done || !state.ready || state.flipping) return;
      audio.resume(); state.spraying = true; audio.startWater();
    }
    function stopSpray() {
      if (!state.spraying) return;
      state.spraying = false; audio.stopWater(); maybeMeasure();
    }

    function flip() {
      if (state.flipping || !state.ready) return;
      stopSpray();
      state.flipping = true; state.flip = 0;
      audio.resume();
    }

    var lastMeasure = 0;
    function maybeMeasure() {
      var now = performance.now();
      if (now - lastMeasure < 90) return;
      lastMeasure = now;
      var sd = sides[state.side];
      sd.progress = Math.max(sd.progress, measureClean(sd));
      updateProgressUI();
      checkComplete();
    }
    function updateProgressUI() {
      var sd = sides[state.side];
      var fill = $(config.progressFillId), txt = $(config.progressTextId);
      var pct = Math.round(Math.min(1, sd.progress) * 100);
      if (fill) fill.style.width = pct + '%';
      var label = (state.side === 0 ? '正面' : '背面') + '清洁度 ' + pct + '%';
      if (txt) txt.textContent = label;
      var f = $(config.faceTagId);
      if (f) f.textContent = state.side === 0 ? '第 1 面 / 共 2 面' : '第 2 面 / 共 2 面';
    }
    function checkComplete() {
      if (state.done) return;
      var a = sides[0].progress >= 0.82, b = sides[1].progress >= 0.82;
      if (a && b) complete();
    }
    function complete() {
      state.done = true; state.doneAt = state.t;
      state.spraying = false; state.progress = 1;
      audio.stopWater(); audio.success(); spawnConfetti();
      var overlay = $(config.doneOverlayId);
      if (overlay) {
        var w = $(config.thanksTextId);
        if (w) w.textContent = config.thanks || '谢谢你把我洗得干干净净！';
        var em = $(config.doneEmojiId);
        if (em) em.textContent = config.doneEmoji || '✨';
        overlay.classList.add('show');
      }
      if (config.onComplete) config.onComplete();
    }

    function drawFrame(ts) {
      var dt = Math.min((ts - state.lastTs) / 16.67 || 1, 3);
      state.lastTs = ts; state.t += dt;

      // 翻面动画
      if (state.flipping) {
        state.flip += 0.055 * dt;
        if (state.flip >= 1) {
          state.flip = 0; state.flipping = false;
          state.side = state.side === 0 ? 1 : 0;
          updateProgressUI();
        }
      }

      // 冲洗（仅当前面、非翻面中）
      if (state.spraying && !state.done && !state.flipping && state.ready) {
        eraseRay(sides[state.side]);
        maybeMeasure();
      }

      ctx.save();
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, R, R);

      // 物体随翻面绕垂直轴旋转：scaleX = cos(pi * flip)，中点翻转面
      var sd = sides[state.side];
      var scaleX;
      var midFlip = state.flipping && state.flip >= 0.5;
      var shownSide = midFlip ? sides[state.side === 0 ? 1 : 0] : sd;
      if (state.flipping) {
        var ang = Math.PI * state.flip;
        scaleX = Math.cos(ang);
      } else scaleX = 1;

      ctx.save();
      ctx.translate(R / 2, R / 2);
      ctx.scale(scaleX, 1);
      ctx.translate(-R / 2, -R / 2);
      // 净图底
      if (shownSide.clean) ctx.drawImage(shownSide.clean, 0, 0, R, R);
      // 脏图上层（擦除部分露出净图）
      if (state.ready) {
        ctx.save();
        var fade = 1;
        if (state.done) fade = clamp(1 - (state.t - state.doneAt) / 24, 0, 1);
        ctx.globalAlpha = fade;
        ctx.drawImage(shownSide.canvas, 0, 0, R, R);
        ctx.restore();
      }
      ctx.restore();

      drawWaterJet();
      drawFaucet();
      drawParticles(dt);
      drawConfetti(dt);
      ctx.restore();
      requestAnimationFrame(drawFrame);
    }

    // 真实高压水流：多股半透明水丝 + 微小抖动 + 雾化，避免激光感
    function drawWaterJet() {
      if (!state.spraying || state.done || state.flipping) return;
      var f = flowDir();
      var ox = TAP_X + f.ux * 34, oy = TAP_Y + f.uy * 34; // 枪口
      var px = -f.uy, py = f.ux;                          // 垂直方向
      var reach = Math.hypot(R, R) * 1.35;
      var wob = Math.sin(state.t * 0.6) * 2.2;           // 水流抖动
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      // 外层水雾带（宽、极淡、渐变消散）
      var halo = ctx.createLinearGradient(ox, oy, ox + f.ux * reach, oy + f.uy * reach);
      halo.addColorStop(0, 'rgba(170,220,255,0.20)');
      halo.addColorStop(0.45, 'rgba(190,232,255,0.12)');
      halo.addColorStop(1, 'rgba(210,240,255,0)');
      ctx.strokeStyle = halo; ctx.lineWidth = 26;
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + f.ux * reach, oy + f.uy * reach); ctx.stroke();
      // 多股水丝：每股有独立偏移、粗细和透明度，末端收束消散
      var strands = 7;
      for (var i = 0; i < strands; i++) {
        var t = i / (strands - 1) - 0.5;            // -0.5..0.5
        var spread = t * 15;                         // 横向分布
        var wobble = Math.sin(state.t * 0.8 + i * 1.7) * (1.4 + Math.abs(t) * 2);
        var alpha = 0.42 - Math.abs(t) * 0.34 + wob * 0.01;
        var seg = ctx.createLinearGradient(ox, oy, ox + f.ux * reach, oy + f.uy * reach);
        seg.addColorStop(0, 'rgba(225,245,255,' + alpha.toFixed(3) + ')');
        seg.addColorStop(0.55, 'rgba(205,238,255,' + (alpha * 0.7).toFixed(3) + ')');
        seg.addColorStop(1, 'rgba(220,245,255,0)');
        ctx.strokeStyle = seg;
        ctx.lineWidth = 2 + (1 - Math.abs(t)) * 3.5;
        ctx.beginPath();
        ctx.moveTo(ox + px * spread, oy + py * spread);
        var midX = ox + f.ux * reach * 0.5 + px * (spread + wobble);
        var midY = oy + f.uy * reach * 0.5 + py * (spread + wobble);
        var endX = ox + f.ux * reach + px * (spread * 1.6 + wobble * 2);
        var endY = oy + f.uy * reach + py * (spread * 1.6 + wobble * 2);
        ctx.quadraticCurveTo(midX, midY, endX, endY);
        ctx.stroke();
      }
      ctx.restore();
      // 枪口处的白色水花核心
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#EAF8FF';
      ctx.beginPath(); ctx.arc(ox, oy, 6 + Math.sin(state.t) * 1.5, 0, TAU); ctx.fill();
      ctx.restore();
    }

    function drawFaucet() {
      var ox = TAP_X, oy = TAP_Y;
      var ang = flowDir().ang;
      ctx.save();
      ctx.translate(ox, oy);
      // 底座
      ctx.fillStyle = 'rgba(40,70,100,0.18)';
      ctx.beginPath(); ctx.arc(0, 6, TAP_R * 0.62, 0, TAU); ctx.fill();
      // 旋转部分
      ctx.rotate(ang);
      ctx.fillStyle = state.spraying ? '#1E5FC0' : '#2E6FE8';
      roundRect(ctx, -30, -20, 46, 40, 12); ctx.fill();
      ctx.fillStyle = '#4A8BF5';
      roundRect(ctx, 6, -13, 30, 26, 9); ctx.fill();
      ctx.fillStyle = '#BFE4FF';
      roundRect(ctx, 30, -9, 10, 18, 4); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      roundRect(ctx, -24, -14, 16, 8, 4); ctx.fill();
      ctx.restore();
      // 提示环
      ctx.save();
      ctx.strokeStyle = state.spraying ? 'rgba(46,160,255,0.9)' : 'rgba(90,130,170,0.45)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(ox, oy, TAP_R * 0.72, 0, TAU); ctx.stroke();
      ctx.restore();
    }

    function drawParticles(dt) {
      ctx.save();
      for (var i = state.particles.length - 1; i >= 0; i--) {
        var p = state.particles[i];
        p.vy += 0.13 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= p.decay * dt;
        if (p.life <= 0) { state.particles.splice(i, 1); continue; }
        ctx.globalAlpha = Math.max(0, p.life) * 0.85;
        ctx.fillStyle = '#EAF7FF';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
      }
      for (var j = state.droplets.length - 1; j >= 0; j--) {
        var d = state.droplets[j];
        d.life -= 0.09 * dt;
        if (d.life <= 0) { state.droplets.splice(j, 1); continue; }
        ctx.globalAlpha = d.life * 0.5;
        ctx.strokeStyle = '#BFE6FF'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(d.x, d.y, (1 - d.life) * 20 + 2, 0, TAU); ctx.stroke();
      }
      // 水雾微粒：细小、半透明、随水流方向飞散
      for (var m = state.mists.length - 1; m >= 0; m--) {
        var w = state.mists[m];
        w.x += w.vx * dt; w.y += w.vy * dt; w.vy += 0.05 * dt; w.life -= w.decay * dt;
        if (w.life <= 0) { state.mists.splice(m, 1); continue; }
        ctx.globalAlpha = Math.max(0, w.life) * 0.5;
        ctx.fillStyle = '#DDF1FF';
        ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
    function drawConfetti(dt) {
      if (!state.confetti.length) return;
      ctx.save();
      for (var i = state.confetti.length - 1; i >= 0; i--) {
        var c = state.confetti[i];
        c.vy += 0.06 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.rot += c.vr * dt;
        if (c.y > R + 30) { state.confetti.splice(i, 1); continue; }
        ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot); ctx.fillStyle = c.color;
        if (c.heart) {
          ctx.scale(c.w / 16, c.w / 16);
          ctx.beginPath(); ctx.moveTo(0, 6);
          ctx.bezierCurveTo(-16, -4, -10, -18, 0, -9);
          ctx.bezierCurveTo(10, -18, 16, -4, 0, 6); ctx.fill();
        } else ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
        ctx.restore();
      }
      ctx.restore();
    }
    function roundRect(c, x, y, w, h, r) {
      c.beginPath();
      c.moveTo(x + r, y);
      c.arcTo(x + w, y, x + w, y + h, r);
      c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r);
      c.arcTo(x, y, x + w, y, r);
      c.closePath();
    }

    // ---------- 事件 ----------
    function isOnFaucet(clientX, clientY) {
      var rect = canvas.getBoundingClientRect();
      var x = (clientX - rect.left) / rect.width * R;
      var y = (clientY - rect.top) / rect.height * R;
      return Math.hypot(x - TAP_X, y - TAP_Y) <= TAP_R;
    }
    canvas.addEventListener('pointerdown', function (e) {
      updateAim(e.clientX, e.clientY);
      if (isOnFaucet(e.clientX, e.clientY)) {
        startSpray();
        if (canvas.setPointerCapture && e.pointerId != null) {
          try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
        }
      }
      e.preventDefault();
    });
    canvas.addEventListener('pointermove', function (e) {
      updateAim(e.clientX, e.clientY);
      e.preventDefault();
    });
    global.addEventListener('pointerup', stopSpray);
    global.addEventListener('pointercancel', stopSpray);
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    var flipBtn = $(config.flipBtnId);
    if (flipBtn) flipBtn.addEventListener('click', flip);
    // 完成后"翻面欣赏"：关闭小卡片并翻面，让游戏者欣赏成果
    var enjoyBtn = $('enjoyBtn');
    if (enjoyBtn) enjoyBtn.addEventListener('click', function () {
      var overlay = $(config.doneOverlayId);
      if (overlay) overlay.classList.remove('show');
      flip();
    });
    var resetBtns = document.querySelectorAll('[data-action="reset"]');
    resetBtns.forEach(function (b) { b.addEventListener('click', reset); });
    var muteBtn = $(config.muteBtnId);
    if (muteBtn) muteBtn.addEventListener('click', function () {
      var muted = audio.toggleMute();
      muteBtn.textContent = muted ? '🔇 音效关' : '🔊 音效开';
    });

    function reset() {
      state.done = false; state.spraying = false;
      state.side = 0; state.flip = 0; state.flipping = false;
      state.particles = []; state.droplets = []; state.mists = []; state.confetti = [];
      audio.stopWater();
      buildSide(sides[0]); buildSide(sides[1]);
      updateProgressUI();
      var overlay = $(config.doneOverlayId);
      if (overlay) overlay.classList.remove('show');
    }

    // ---------- 启动 ----------
    Promise.all([
      loadImage(config.sides[0].clean).then(function (im) { sides[0].clean = im; }),
      loadImage(config.sides[0].dirty).then(function (im) { sides[0].dirty = im; }),
      loadImage(config.sides[1].clean).then(function (im) { sides[1].clean = im; }),
      loadImage(config.sides[1].dirty).then(function (im) { sides[1].dirty = im; })
    ]).then(function () {
      buildSide(sides[0]); buildSide(sides[1]);
      state.ready = true;
      updateProgressUI();
    }).catch(function (err) { console.error('CleanWash init error:', err); });
    requestAnimationFrame(function (ts) { state.lastTs = ts; drawFrame(ts); });

    return { state: state, reset: reset, audio: audio, flip: flip, sides: sides };
  }

  global.CleanWash = { create: create };
})(window);
