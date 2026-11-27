/**
 * 街机小游戏通用工具库（跳一跳/合成/三消/贪吃蛇/打砖块共用）
 * 提供：Web Audio 合成音效、最高分存储、Canvas 高清适配、震动/抖动反馈。
 * 零外部依赖，复制本文件即可复用。
 */
(function (global) {
  'use strict';

  /* ---------- Web Audio 音效 ---------- */
  var ctx = null;
  var muted = false;

  function ac() {
    if (muted) return null;
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { return null; }
    }
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
    return ctx;
  }

  function tone(freq, dur, type, vol, delay, endFreq) {
    var a = ac(); if (!a) return;
    var t = a.currentTime + (delay || 0);
    var o = a.createOscillator();
    var g = a.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol || 0.14, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination);
    o.start(t); o.stop(t + dur + 0.03);
  }

  var SFX = {
    tap:   function () { tone(520, 0.07, 'sine', 0.10); },
    jump:  function () { tone(300, 0.18, 'triangle', 0.16, 0, 720); },
    land:  function () { tone(220, 0.12, 'sine', 0.18, 0, 150); },
    score: function () { tone(660, 0.09, 'sine', 0.12); tone(880, 0.12, 'sine', 0.12, 0.07); },
    eat:   function () { tone(480, 0.08, 'square', 0.09, 0, 640); },
    combo: function (n) { var f = 600 + (n || 1) * 90; tone(f, 0.1, 'sine', 0.13); tone(f * 1.25, 0.12, 'sine', 0.11, 0.06); },
    merge: function (lv) { var f = 320 + (lv || 1) * 60; tone(f, 0.14, 'triangle', 0.14, 0, f * 1.6); },
    fail:  function () { tone(400, 0.35, 'sawtooth', 0.14, 0, 120); },
    win:   function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.16, 'sine', 0.13, i * 0.1); }); },
    click: function () { tone(700, 0.05, 'sine', 0.08); }
  };

  function setMuted(v) { muted = !!v; }
  function isMuted() { return muted; }

  /* ---------- 最高分 ---------- */
  var Best = {
    get: function (key) {
      try { return parseInt(localStorage.getItem('sg_arcade_' + key) || '0', 10) || 0; }
      catch (e) { return 0; }
    },
    set: function (key, val) {
      try { localStorage.setItem('sg_arcade_' + key, String(val)); } catch (e) {}
    }
  };

  /* ---------- Canvas 高清适配 ----------
   * 逻辑坐标固定为 w×h，物理像素按 DPR 放大，CSS 宽度 100% 自适应。
   * 返回已 setTransform 的 2D context，绘图直接用 0..w / 0..h 逻辑坐标。
   */
  function fitCanvas(canvas, w, h) {
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = '100%';
    canvas.style.height = 'auto';
    var c = canvas.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    return c;
  }

  /* ---------- 反馈 ---------- */
  function vibrate(ms) { try { if (navigator.vibrate) navigator.vibrate(ms || 20); } catch (e) {} }
  function shake(el) {
    if (!el) return;
    el.style.transition = 'transform .06s';
    el.style.transform = 'translate(' + (Math.random() * 8 - 4) + 'px,' + (Math.random() * 8 - 4) + 'px)';
    setTimeout(function () { el.style.transform = ''; }, 90);
  }

  /* ---------- 数值 ---------- */
  function rand(a, b) { return a + Math.random() * (b - a); }
  function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* ---------- 绘图工具 ---------- */
  function roundRectPath(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  // 颜色明暗调节：amt>0 变亮，amt<0 变暗。接受 #rrggbb 或 rgb()
  function shade(color, amt) {
    var r, g, b;
    if (color.charAt(0) === '#') {
      var n = parseInt(color.slice(1), 16);
      r = (n >> 16) & 255; g = (n >> 8) & 255; b = n & 255;
    } else {
      var m = color.match(/\d+/g);
      if (!m) return color;
      r = +m[0]; g = +m[1]; b = +m[2];
    }
    function f(v) { return Math.round(amt > 0 ? v + (255 - v) * amt : v * (1 + amt)); }
    return 'rgb(' + clamp(f(r), 0, 255) + ',' + clamp(f(g), 0, 255) + ',' + clamp(f(b), 0, 255) + ')';
  }
  // 发光文字
  function glowText(c, text, x, y, font, color, glow) {
    c.font = font; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.shadowColor = glow || color; c.shadowBlur = 16;
    c.fillStyle = color; c.fillText(text, x, y);
    c.shadowBlur = 0;
  }

  /* ---------- 粒子系统 ---------- */
  function Particles() { this.list = []; }
  Particles.prototype.burst = function (x, y, opt) {
    opt = opt || {};
    var n = opt.count || 12;
    for (var i = 0; i < n; i++) {
      var a = opt.angle !== undefined ? opt.angle + rand(-0.6, 0.6) : rand(0, Math.PI * 2);
      var sp = rand(opt.speedMin || 60, opt.speedMax || 240);
      this.list.push({
        x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: rand(opt.lifeMin || 0.4, opt.lifeMax || 0.9),
        maxLife: 0,
        size: rand(opt.sizeMin || 3, opt.sizeMax || 8),
        color: Array.isArray(opt.colors) ? opt.colors[randInt(0, opt.colors.length - 1)] : (opt.color || '#fff'),
        gravity: opt.gravity === undefined ? 300 : opt.gravity,
        shape: opt.shape || 'circle'
      });
      this.list[this.list.length - 1].maxLife = this.list[this.list.length - 1].life;
    }
  };
  Particles.prototype.update = function (dt) {
    for (var i = this.list.length - 1; i >= 0; i--) {
      var p = this.list[i];
      p.life -= dt;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.life <= 0) this.list.splice(i, 1);
    }
  };
  Particles.prototype.draw = function (c) {
    for (var i = 0; i < this.list.length; i++) {
      var p = this.list[i];
      c.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
      c.fillStyle = p.color;
      if (p.shape === 'rect') {
        c.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      } else {
        c.beginPath(); c.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2); c.fill();
      }
    }
    c.globalAlpha = 1;
  };
  Particles.prototype.clear = function () { this.list.length = 0; };

  // 浮动文字（得分飘字）
  function Floaters() { this.list = []; }
  Floaters.prototype.add = function (x, y, text, color, size) {
    this.list.push({ x: x, y: y, text: text, color: color || '#fff', size: size || 20, life: 1, maxLife: 1 });
  };
  Floaters.prototype.update = function (dt) {
    for (var i = this.list.length - 1; i >= 0; i--) {
      var f = this.list[i];
      f.life -= dt * 1.2; f.y -= 42 * dt;
      if (f.life <= 0) this.list.splice(i, 1);
    }
  };
  Floaters.prototype.draw = function (c) {
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (var i = 0; i < this.list.length; i++) {
      var f = this.list[i];
      c.globalAlpha = clamp(f.life / f.maxLife, 0, 1);
      c.font = 'bold ' + f.size + 'px sans-serif';
      c.shadowColor = f.color; c.shadowBlur = 10;
      c.fillStyle = f.color; c.fillText(f.text, f.x, f.y);
      c.shadowBlur = 0;
    }
    c.globalAlpha = 1;
  };
  Floaters.prototype.clear = function () { this.list.length = 0; };

  global.Arcade = {
    SFX: SFX, Best: Best, fitCanvas: fitCanvas,
    setMuted: setMuted, isMuted: isMuted,
    vibrate: vibrate, shake: shake,
    rand: rand, randInt: randInt, clamp: clamp, lerp: lerp,
    roundRectPath: roundRectPath, shade: shade, glowText: glowText,
    Particles: Particles, Floaters: Floaters
  };
})(window);
