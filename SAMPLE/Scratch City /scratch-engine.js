(function () {
  const reduce = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function attach(canvas, o) {
    const opt = Object.assign({ brush: 30, threshold: 0.55, label: 'SCRATCH HERE', sub: '' }, o || {});
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let w = 0, h = 0, dpr = 1, drawing = false, last = null, done = false, dirty = false, lastCheck = 0, touched = false, anim = null;

    function size() {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = r.width; h = r.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function paint() {
      if (anim) { anim.cancel(); anim = null; }
      size(); done = false; touched = false; drawing = false;
      canvas.style.opacity = '1'; canvas.style.pointerEvents = 'auto';
      ctx.globalCompositeOperation = 'source-over';
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#8d8c93'); g.addColorStop(0.35, '#d9d8de'); g.addColorStop(0.5, '#f4f3f7');
      g.addColorStop(0.65, '#bdbcc3'); g.addColorStop(1, '#7c7b82');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(0,0,0,.07)'; ctx.lineWidth = 1;
      for (let x = -h; x < w; x += 7) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + h, h); ctx.stroke(); }
      const n = (w * h) / 28;
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.12)';
        ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1);
      }
      ctx.fillStyle = 'rgba(20,20,24,.82)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const fs = Math.max(16, Math.min(h * 0.24, w * 0.085));
      ctx.font = fs + 'px Anton, Impact, sans-serif';
      ctx.fillText(opt.label, w / 2, h / 2 - (opt.sub ? fs * 0.3 : 0));
      if (opt.sub) {
        ctx.font = '700 ' + Math.max(10, fs * 0.3) + 'px "Space Mono", monospace';
        ctx.fillText(opt.sub, w / 2, h / 2 + fs * 0.6);
      }
      ctx.setLineDash([6, 5]); ctx.strokeStyle = 'rgba(20,20,24,.35)'; ctx.lineWidth = 1.5;
      ctx.strokeRect(6, 6, w - 12, h - 12); ctx.setLineDash([]);
    }
    const pos = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    function stroke(a, b, touch) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.lineWidth = touch ? opt.brush * 1.4 : opt.brush;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x + 0.01, b.y); ctx.stroke();
      dirty = true;
    }
    function check(force) {
      const now = performance.now();
      if (!dirty || (!force && now - lastCheck < 120)) return;
      lastCheck = now; dirty = false;
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let c = 0, t = 0;
      for (let i = 3; i < d.length; i += 64) { t++; if (d[i] < 128) c++; }
      const p = c / t;
      opt.onProgress && opt.onProgress(p);
      if (p >= opt.threshold) reveal();
    }
    function down(e) {
      if (done) return;
      drawing = true;
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      last = pos(e); stroke(last, last, e.pointerType !== 'mouse');
      if (!touched) { touched = true; opt.onStart && opt.onStart(); }
      if (navigator.vibrate && e.pointerType === 'touch') navigator.vibrate(8);
    }
    function move(e) { if (!drawing || done) return; const p = pos(e); stroke(last, p, e.pointerType !== 'mouse'); last = p; check(); }
    function up() { if (!drawing) return; drawing = false; check(true); }
    function reveal() {
      if (done) return;
      done = true; drawing = false; canvas.style.pointerEvents = 'none';
      opt.onProgress && opt.onProgress(1);
      anim = canvas.animate([{ opacity: 1 }, { opacity: 0 }], { duration: reduce() ? 1 : 380, easing: 'ease-out', fill: 'forwards' });
      anim.onfinish = () => {
        ctx.clearRect(0, 0, w, h); canvas.style.opacity = '0';
        if (anim) { anim.cancel(); anim = null; }
        opt.onReveal && opt.onReveal();
      };
    }
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    paint();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!touched && !done) paint(); });
    return {
      canvas, reveal, reset: paint,
      set(o2) { Object.assign(opt, o2); },
      destroy() {
        canvas.removeEventListener('pointerdown', down);
        canvas.removeEventListener('pointermove', move);
        canvas.removeEventListener('pointerup', up);
        canvas.removeEventListener('pointercancel', up);
      }
    };
  }

  let bc = null, bctx = null, parts = [], raf = 0;
  function fire(x, y, colors, n) {
    if (!bc) {
      bc = document.createElement('canvas');
      Object.assign(bc.style, { position: 'fixed', left: '0', top: '0', width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: '1100' });
      document.body.appendChild(bc);
      bctx = bc.getContext('2d');
    }
    const d = Math.min(2, window.devicePixelRatio || 1);
    bc.width = innerWidth * d; bc.height = innerHeight * d; bctx.setTransform(d, 0, 0, d, 0, 0);
    n = n || (reduce() ? 24 : 150);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 4 + Math.random() * 11;
      const r = Math.random();
      parts.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 6, g: 0.26 + Math.random() * 0.12,
        life: 1, decay: 0.007 + Math.random() * 0.011, size: 3 + Math.random() * 7,
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: colors[i % colors.length],
        shape: r < 0.3 ? 'spark' : r < 0.6 ? 'circle' : 'rect'
      });
    }
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function tick() {
    bctx.clearRect(0, 0, innerWidth, innerHeight);
    parts = parts.filter(p => p.life > 0 && p.y < innerHeight + 40);
    for (const p of parts) {
      p.vx *= 0.985; p.vy = p.vy * 0.985 + p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life -= p.decay;
      bctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.4));
      bctx.fillStyle = p.c;
      bctx.save(); bctx.translate(p.x, p.y); bctx.rotate(p.rot);
      if (p.shape === 'circle') { bctx.beginPath(); bctx.arc(0, 0, p.size / 2, 0, Math.PI * 2); bctx.fill(); }
      else if (p.shape === 'rect') bctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      else { bctx.fillRect(-p.size, -0.8, p.size * 2, 1.6); bctx.fillRect(-0.8, -p.size, 1.6, p.size * 2); }
      bctx.restore();
    }
    bctx.globalAlpha = 1;
    if (parts.length) raf = requestAnimationFrame(tick); else { raf = 0; bctx.clearRect(0, 0, innerWidth, innerHeight); }
  }

  window.ScratchEngine = { attach };
  window.ScBurst = { fire };
})();
