(() => {
  const canvas = document.getElementById('grid-bg');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let w, h, dpr;
  const cell = 55;
  const mouse = { x: -9999, y: -9999 };
  const target = { x: -9999, y: -9999 };

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', (e) => {
    target.x = e.clientX;
    target.y = e.clientY;
  }, { passive: true });
  window.addEventListener('mouseleave', () => {
    target.x = -9999;
    target.y = -9999;
  });

  resize();

  function offset(x, y, t) {
    const ox = Math.sin(x * 0.012 + t * 0.0004) * 7
             + Math.sin(y * 0.018 + t * 0.0003) * 5;
    const oy = Math.cos(y * 0.012 + t * 0.0004) * 7
             + Math.cos(x * 0.018 - t * 0.0003) * 5;

    const dx = x - mouse.x;
    const dy = y - mouse.y;
    const r = 220;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      const d = Math.sqrt(d2) || 1;
      const f = 1 - d / r;
      const push = f * f * 55;
      return [x + ox + (dx / d) * push, y + oy + (dy / d) * push];
    }
    return [x + ox, y + oy];
  }

  function frame(t) {
    mouse.x += (target.x - mouse.x) * 0.15;
    mouse.y += (target.y - mouse.y) * 0.15;

    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)';
    ctx.lineWidth = 1;

    const cols = Math.ceil(w / cell) + 4;
    const rows = Math.ceil(h / cell) + 4;
    const startX = -cell * 2;
    const startY = -cell * 2;

    const pts = [];
    for (let j = 0; j <= rows; j++) {
      const row = [];
      for (let i = 0; i <= cols; i++) {
        row.push(offset(startX + i * cell, startY + j * cell, t));
      }
      pts.push(row);
    }

    for (let j = 0; j <= rows; j++) {
      const row = pts[j];
      ctx.beginPath();
      ctx.moveTo(row[0][0], row[0][1]);
      for (let i = 1; i < row.length - 1; i++) {
        const mx = (row[i][0] + row[i + 1][0]) / 2;
        const my = (row[i][1] + row[i + 1][1]) / 2;
        ctx.quadraticCurveTo(row[i][0], row[i][1], mx, my);
      }
      const last = row[row.length - 1];
      ctx.lineTo(last[0], last[1]);
      ctx.stroke();
    }

    for (let i = 0; i <= cols; i++) {
      ctx.beginPath();
      ctx.moveTo(pts[0][i][0], pts[0][i][1]);
      for (let j = 1; j < rows; j++) {
        const mx = (pts[j][i][0] + pts[j + 1][i][0]) / 2;
        const my = (pts[j][i][1] + pts[j + 1][i][1]) / 2;
        ctx.quadraticCurveTo(pts[j][i][0], pts[j][i][1], mx, my);
      }
      ctx.lineTo(pts[rows][i][0], pts[rows][i][1]);
      ctx.stroke();
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
