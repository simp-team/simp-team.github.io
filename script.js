(() => {
  const canvas = document.getElementById('arenaCanvas');
  const ctx = canvas.getContext('2d');

  const participantsInput = document.getElementById('participantsInput');
  const initialHpInput = document.getElementById('initialHp');
  const damagePerHitInput = document.getElementById('damagePerHit');
  const eggsCountInput = document.getElementById('eggsCount');
  const speedMultiplierInput = document.getElementById('speedMultiplier');

  const startBtn = document.getElementById('startBtn');
  const resetBtn = document.getElementById('resetBtn');
  const playAgainBtn = document.getElementById('playAgainBtn');

  const scoreboardList = document.getElementById('scoreboardList');

  const winnerOverlay = document.getElementById('winnerOverlay');
  const winnerNameEl = document.getElementById('winnerName');

  let eggs = [];
  let running = false;
  let rafId = null;
  const hitCooldownMs = 300;
  const lastHitMap = new Map();

  function resizeCanvas({ rescaleEggs = true } = {}) {
    const arena = document.querySelector('.arena');
    const rect = arena.getBoundingClientRect();

    const prevW = canvas.width;
    const prevH = canvas.height;
    const newW = Math.floor(rect.width);
    const newH = Math.floor(rect.height);

    canvas.width = newW;
    canvas.height = newH;

    if (rescaleEggs && eggs.length && prevW && prevH) {
      const sx = newW / prevW;
      const sy = newH / prevH;
      for (const e of eggs) {
        e.x *= sx;
        e.y *= sy;
        e.x = Math.min(Math.max(e.r, e.x), newW - e.r);
        e.y = Math.min(Math.max(e.r, e.y), newH - e.r);
      }
    }
  }
  window.addEventListener('resize', () => {
    resizeCanvas({ rescaleEggs: true });
  });

  function randomPastel() {
    const h = Math.floor(Math.random() * 360);
    const s = 70 + Math.floor(Math.random() * 20);
    const l = 60 + Math.floor(Math.random() * 10);
    return { h, s, l, css: `hsl(${h} ${s}% ${l}%)` };
  }

  function parseParticipants() {
    const raw = participantsInput.value || '';
    const names = raw
      .split(/\n|\r/)
      .map(s => s.trim())
      .filter(Boolean);

    const count = Math.max(2, Number(eggsCountInput.value || 10));

    if (names.length >= 2) return names;
    if (names.length === 1) {
      const extras = Array.from({ length: count - 1 }, (_, i) => `蛋 ${i + 1}`);
      return [names[0], ...extras];
    }
    return Array.from({ length: count }, (_, i) => `蛋 ${i + 1}`);
  }

  function createEggs() {
    const names = parseParticipants();
    const initialHp = Math.max(10, Number(initialHpInput.value || 100));
    const speedMul = Number(speedMultiplierInput.value || 1.0);

    const radius = 18;
    const speedBase = 1.4 * speedMul;

    const w = canvas.width;
    const h = canvas.height;

    lastHitMap.clear();

    eggs = names.map((name, idx) => {
      const color = randomPastel();
      const x = Math.random() * (w - 2 * radius) + radius;
      const y = Math.random() * (h - 2 * radius) + radius;
      const ang = Math.random() * Math.PI * 2;
      const vx = Math.cos(ang) * speedBase;
      const vy = Math.sin(ang) * speedBase;

      return {
        id: idx,
        name,
        hp: initialHp,
        maxHp: initialHp,
        x,
        y,
        vx,
        vy,
        r: radius,
        color,
        alive: true,
      };
    });
  }

  function pairKey(a, b) {
    return a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`;
  }

  function applyCollision(a, b, now, damage) {
    const key = pairKey(a, b);
    const last = lastHitMap.get(key) || 0;
    if (now - last < hitCooldownMs) return;

    a.hp = Math.max(0, a.hp - damage);
    b.hp = Math.max(0, b.hp - damage);
    lastHitMap.set(key, now);

    const nx = a.x - b.x;
    const ny = a.y - b.y;
    const dist = Math.hypot(nx, ny) || 1;
    const overlap = a.r + b.r - dist;
    if (overlap > 0) {
      const ux = nx / dist;
      const uy = ny / dist;
      a.x += ux * (overlap / 2);
      a.y += uy * (overlap / 2);
      b.x -= ux * (overlap / 2);
      b.y -= uy * (overlap / 2);
    }
    a.vx *= -1;
    a.vy *= -1;
    b.vx *= -1;
    b.vy *= -1;
  }

  function step() {
    if (!running) return;
    const now = performance.now();

    const w = canvas.width;
    const h = canvas.height;

    for (const e of eggs) {
      if (!e.alive) continue;
      e.x += e.vx;
      e.y += e.vy;
      if (e.x - e.r < 0) { e.x = e.r; e.vx *= -1; }
      if (e.x + e.r > w) { e.x = w - e.r; e.vx *= -1; }
      if (e.y - e.r < 0) { e.y = e.r; e.vy *= -1; }
      if (e.y + e.r > h) { e.y = h - e.r; e.vy *= -1; }
    }

    const damage = Math.max(1, Number(damagePerHitInput.value || 10));
    for (let i = 0; i < eggs.length; i++) {
      const a = eggs[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < eggs.length; j++) {
        const b = eggs[j];
        if (!b.alive) continue;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.hypot(dx, dy);
        if (dist < a.r + b.r) {
          applyCollision(a, b, now, damage);
        }
      }
    }

    let aliveCount = 0;
    for (const e of eggs) {
      if (e.hp <= 0 && e.alive) {
        e.alive = false;
      }
      if (e.alive) aliveCount++;
    }

    ctx.clearRect(0, 0, w, h);
    for (const e of eggs) {
      if (!e.alive) continue;
      ctx.beginPath();
      const grad = ctx.createRadialGradient(e.x - e.r * 0.3, e.y - e.r * 0.3, e.r * 0.2, e.x, e.y, e.r);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(1, e.color.css);
      ctx.fillStyle = grad;
      ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(17,24,39,0.2)';
      ctx.stroke();
      ctx.fillStyle = '#111827';
      ctx.font = '12px Segoe UI, system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(e.name, e.x, e.y - e.r - 10);
      ctx.fillStyle = '#374151';
      ctx.font = '11px Segoe UI, system-ui';
      ctx.fillText(`HP: ${e.hp}`, e.x, e.y + e.r + 10);
    }

    renderScoreboard();

    if (running && aliveCount <= 1) {
      const winner = eggs.find(e => e.alive);
      endSimulation(winner);
      return;
    }

    rafId = requestAnimationFrame(step);
  }

  function renderScoreboard() {
    const items = eggs
      .filter(e => e.alive)
      .slice()
      .sort((a, b) => b.hp - a.hp);
    scoreboardList.innerHTML = '';
    for (const e of items) {
      const li = document.createElement('li');
      li.className = 'score-item';
      const name = document.createElement('span');
      name.className = 'score-name';
      name.textContent = e.name;
      const hp = document.createElement('span');
      hp.className = 'score-hp';
      hp.textContent = e.hp;
      const bar = document.createElement('div');
      bar.className = 'score-bar';
      const inner = document.createElement('span');
      inner.style.width = `${Math.max(0, Math.min(100, Math.round((e.hp / e.maxHp) * 100)))}%`;
      bar.appendChild(inner);
      li.appendChild(name);
      li.appendChild(hp);
      li.appendChild(bar);
      scoreboardList.appendChild(li);
    }
  }

  function startSimulation() {
    resizeCanvas({ rescaleEggs: false });
    createEggs();
    running = true;
    winnerOverlay.hidden = true;
    if (rafId) cancelAnimationFrame(rafId);
    step();
  }

  function endSimulation(winner) {
    running = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    winnerNameEl.textContent = winner ? winner.name : '平手';
    winnerOverlay.hidden = false;
  }

  function resetSimulation() {
    running = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    eggs = [];
    lastHitMap.clear();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    scoreboardList.innerHTML = '';
    winnerOverlay.hidden = true;
  }

  startBtn.addEventListener('click', () => {
    startSimulation();
  });
  resetBtn.addEventListener('click', () => {
    resetSimulation();
  });
  playAgainBtn.addEventListener('click', () => {
    resetSimulation();
    startSimulation();
  });

  resizeCanvas({ rescaleEggs: false });
})();