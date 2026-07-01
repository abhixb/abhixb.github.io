(() => {
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

  const NOISE = [232, 176, 75];   // amber  (high t, pure noise)
  const CLEAN = [94, 243, 140];   // green  (t=0, clean data)
  const STEPS = 50;

  function faceTargets(W, H) {
    const pts = [];
    const cx = W / 2, cy = H * 0.46, r = Math.min(W, H) * 0.34;
    for (let i = 0; i < 130; i++) {
      const a = (i / 130) * Math.PI * 2;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    for (const ex of [-0.36, 0.36]) {
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        pts.push([cx + ex * r + Math.cos(a) * r * 0.11, cy - r * 0.2 + Math.sin(a) * r * 0.11]);
      }
    }
    for (let i = 0; i <= 30; i++) {
      const a = Math.PI * 0.18 + (i / 30) * Math.PI * 0.64;
      pts.push([cx + Math.cos(a) * r * 0.58, cy + Math.sin(a) * r * 0.58]);
    }
    return pts;
  }

  // 3D trajectory: reach (x) -> lift (y up) -> with depth sweep (z)
  function traj3D() {
    const pts = [];
    const N = 150;
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      pts.push([
        -0.5 + t,                                // x
        0.5 - 0.85 * Math.sin(t * Math.PI),      // y (0.5 floor -> rises up)
        -0.45 + 0.9 * smooth((t - 0.15) / 0.7)   // z (sweeps in depth)
      ]);
    }
    return pts;
  }

  function init(canvas) {
    const ctx = canvas.getContext('2d');
    const is3D = (canvas.dataset.shape === 'trajectory');
    let W, H, dpr, targets, base3d, particles;
    const mouse = { x: -9999, y: -9999 };
    let rotY = -0.7, drag = false, lastX = 0;

    function build() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (is3D) base3d = traj3D();
      else targets = faceTargets(W, H);

      const n = is3D ? base3d.length : targets.length;
      if (!particles || particles.length !== n) {
        particles = Array.from({ length: n }, () => ({
          nx: Math.random(), ny: Math.random(), ph: Math.random() * Math.PI * 2
        }));
      }
    }

    function progress() {
      const rect = canvas.getBoundingClientRect();
      const vh = window.innerHeight;
      const cy = rect.top + rect.height / 2;
      return clamp((vh - cy) / (vh * 0.62), 0, 1);
    }

    // rotate around Y, tilt around X, perspective project
    function project(p, S, cx, cy) {
      const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
      const x = p[0] * cosY - p[2] * sinY;
      const z = p[0] * sinY + p[2] * cosY;
      const tilt = 0.5, cosX = Math.cos(tilt), sinX = Math.sin(tilt);
      const y2 = p[1] * cosX - z * sinX;
      const z2 = p[1] * sinX + z * cosX;
      const persp = 2.6 / (2.6 + z2);
      return [cx + x * persp * S, cy + y2 * persp * S, persp];
    }

    function frame(time) {
      const e = smooth(progress());
      const t = time * 0.001;
      ctx.clearRect(0, 0, W, H);

      if (is3D) {
        const S = Math.min(W * 0.46, H * 0.82);
        const cx = W / 2, cy = H * 0.42;
        const P = (p) => project(p, S, cx, cy);

        drawFloor(P);
        drawAxes(P);

        const proj = base3d.map(P);
        if (e > 0.35) {
          const baseA = (e - 0.35) / 0.65;
          for (let i = 1; i < proj.length; i++) {
            const a = proj[i - 1], b = proj[i];
            ctx.beginPath();
            ctx.moveTo(a[0], a[1]);
            ctx.lineTo(b[0], b[1]);
            ctx.strokeStyle = `rgba(94,243,140,${baseA * clamp(b[2] - 0.5, 0.15, 0.75)})`;
            ctx.lineWidth = b[2] * 2.2;
            ctx.stroke();
          }
        }
        for (let i = 0; i < particles.length; i++) {
          drawParticle(particles[i], proj[i][0], proj[i][1], e, t, proj[i][2], false);
        }
        if (e > 0.5) {
          const a = (e - 0.5) / 0.5;
          drawMarker(proj[0], 'home', '#e8b04b', a);
          drawMarker(proj[proj.length - 1], 'target', '#5ef38c', a);
        }
      } else {
        for (let i = 0; i < particles.length; i++) {
          drawParticle(particles[i], targets[i][0], targets[i][1], e, t, 1, true);
        }
      }

      const step = Math.round((1 - e) * STEPS);
      ctx.font = '12px ui-monospace, Menlo, monospace';
      ctx.fillStyle = step === 0 ? '#5ef38c' : '#e8b04b';
      ctx.textAlign = 'left';
      ctx.fillText(step === 0 ? 't = 0  (clean)' : `t = ${step}  (denoising)`, 8, 18);

      requestAnimationFrame(frame);
    }

    function drawFloor(P) {
      const n = 6;
      ctx.strokeStyle = 'rgba(94,243,140,0.10)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= n; i++) {
        const f = -0.5 + i / n;
        let a = P([f, 0.5, -0.5]), b = P([f, 0.5, 0.5]);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        a = P([-0.5, 0.5, f]); b = P([0.5, 0.5, f]);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
    }

    function drawAxes(P) {
      const O = [-0.5, 0.5, -0.5];
      const axes = [
        [[0.62, 0.5, -0.5], '#e8b04b', 'x'],
        [[-0.5, -0.62, -0.5], '#9db5a4', 'y'],
        [[-0.5, 0.5, 0.62], '#7fe0a0', 'z']
      ];
      const o = P(O);
      ctx.lineWidth = 1.5;
      ctx.font = '11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      for (const [end, col, label] of axes) {
        const p = P(end);
        ctx.beginPath(); ctx.moveTo(o[0], o[1]); ctx.lineTo(p[0], p[1]);
        ctx.strokeStyle = col; ctx.stroke();
        ctx.fillStyle = col;
        ctx.fillText(label, p[0], p[1] - 4);
      }
    }

    function drawMarker(p, label, col, alpha) {
      ctx.globalAlpha = alpha;
      ctx.beginPath(); ctx.arc(p[0], p[1], 6, 0, Math.PI * 2);
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.arc(p[0], p[1], 2.2, 0, Math.PI * 2);
      ctx.fillStyle = col; ctx.fill();
      ctx.font = '11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(label, p[0], p[1] - 12);
      ctx.globalAlpha = 1;
    }

    function drawParticle(pt, tx, ty, e, t, depth, repel) {
      const nx = pt.nx * W, ny = pt.ny * H;
      const jit = (1 - e) * 7;
      let x = lerp(nx, tx, e) + Math.sin(t * 1.6 + pt.ph) * jit;
      let y = lerp(ny, ty, e) + Math.cos(t * 1.4 + pt.ph) * jit;

      if (repel) {
        const dx = x - mouse.x, dy = y - mouse.y, d2 = dx * dx + dy * dy;
        if (d2 < 6400) { const d = Math.sqrt(d2) || 1, f = (1 - d / 80) * 26; x += (dx / d) * f; y += (dy / d) * f; }
      }

      const r = Math.round(lerp(NOISE[0], CLEAN[0], e));
      const g = Math.round(lerp(NOISE[1], CLEAN[1], e));
      const b = Math.round(lerp(NOISE[2], CLEAN[2], e));
      ctx.beginPath();
      ctx.arc(x, y, 1.4 + depth * 1.2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${lerp(0.5, 0.95, e) * clamp(depth, 0.5, 1)})`;
      ctx.fill();
    }

    canvas.addEventListener('mousemove', (ev) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = ev.clientX - r.left; mouse.y = ev.clientY - r.top;
      if (drag) { rotY += (ev.clientX - lastX) * 0.01; lastX = ev.clientX; }
    });
    canvas.addEventListener('mouseleave', () => { mouse.x = -9999; mouse.y = -9999; drag = false; });
    if (is3D) {
      canvas.addEventListener('mousedown', (ev) => { drag = true; lastX = ev.clientX; });
      window.addEventListener('mouseup', () => { drag = false; });
    }
    window.addEventListener('resize', build);

    build();
    requestAnimationFrame(frame);
  }

  document.querySelectorAll('.diffusion-canvas').forEach(init);
})();
