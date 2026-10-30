// High-performance procedural Japanese Candlestick Canvas with moving averages and mouse parallax
// Reverse-engineered from SwingExploder core visual engine

export function initTradingCanvas(canvasId = "trading-bg-canvas") {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  let animId = 0;
  let time = 0;
  let candles = [];
  let floatingBadges = [];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Generate procedural candlesticks
    candles = [];
    const baseH = canvas.height * 0.55;
    const amp = canvas.height * 0.3;
    let curr = baseH;
    const numCandles = Math.ceil(canvas.width / 26) + 6;

    for (let i = 0; i < numCandles; i++) {
      const x = 26 * i - 40;
      const step = (Math.random() - 0.48) * amp * 0.08;
      curr = Math.max(baseH - 0.5 * amp, Math.min(baseH + 0.5 * amp, curr + step));
      const bodyH = Math.random() * amp * 0.06 + 0.01 * amp;
      const bullish = step >= 0;
      const open = bullish ? curr : curr + bodyH;
      const close = bullish ? curr + bodyH : curr;
      const wickPad = 0.04 * amp;
      const high = Math.min(open, close) - (Math.random() * wickPad + 3);
      const low = Math.max(open, close) + (Math.random() * wickPad + 3);

      candles.push({ x, open, close, high, low, bullish });
    }

    // Generate floating profit/loss percentages
    floatingBadges = [];
    for (let j = 0; j < 10; j++) {
      const val = (Math.random() * 8 - 1.5).toFixed(1);
      const isPos = parseFloat(val) >= 0;
      floatingBadges.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height * 0.7 + 0.15 * canvas.height,
        text: `${isPos ? "+" : ""}${val}%`,
        speed: 0.25 * Math.random() + 0.1,
        phase: Math.random() * Math.PI * 2,
        bullish: isPos
      });
    }
  }

  function onMouseMove(e) {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    mouse.tx = ((e.clientX - cx) / cx) * 16;
    mouse.ty = ((e.clientY - cy) / cy) * 10;
  }

  function drawSineWave(w, h, t, amp, period, yOffset, color, phaseOffset) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 6]);
    for (let x = 0; x <= w + 20; x += 3) {
      const y = yOffset + Math.sin(x / period * Math.PI * 2 + 0.4 * t + phaseOffset) * amp + Math.sin(x / (0.6 * period) * Math.PI * 2 + 0.25 * t) * amp * 0.35;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function loop() {
    const w = canvas.width;
    const h = canvas.height;

    // Smooth mouse parallax damping
    mouse.x += (mouse.tx - mouse.x) * 0.04;
    mouse.y += (mouse.ty - mouse.y) * 0.04;

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(mouse.x, mouse.y);

    // Subtle grid lines
    ctx.strokeStyle = "rgba(39, 39, 42, 0.4)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 7; i++) {
      const y = (h / 7) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(39, 39, 42, 0.25)";
    for (let j = 1; j < 10; j++) {
      const x = (w / 10) * j;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // Dynamic candlestick drawing
    const pulseAlpha = 0.015 * Math.sin(0.4 * time) + 0.045;
    candles.forEach(c => {
      const col = c.bullish
        ? `rgba(16, 185, 129, ${pulseAlpha})`
        : `rgba(239, 68, 68, ${pulseAlpha})`;
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.2;

      // Wick
      ctx.beginPath();
      ctx.moveTo(c.x + 5, c.high);
      ctx.lineTo(c.x + 5, c.low);
      ctx.stroke();

      // Body
      ctx.fillStyle = col;
      const top = Math.min(c.open, c.close);
      const height = Math.max(Math.abs(c.close - c.open), 1.5);
      ctx.fillRect(c.x, top, 10, height);
    });

    // Moving average glowing sine waves
    const waveAmp1 = 0.08 * h;
    const waveAmp2 = 0.05 * h;
    const waveAlpha = (0.5 * Math.sin(0.5 * time) + 0.5) * 0.12 + 0.08;
    drawSineWave(w, h, time, waveAmp1, 0.35 * w, 0.45 * h, `rgba(99, 102, 241, ${waveAlpha})`, 0);
    drawSineWave(w, h, time, waveAmp2, 0.55 * w, 0.60 * h, `rgba(212, 175, 55, ${waveAlpha * 0.7})`, Math.PI);

    // Floating percentage labels
    ctx.font = "12px 'JetBrains Mono', monospace";
    ctx.textAlign = "left";
    floatingBadges.forEach(b => {
      const tagAlpha = (0.5 * Math.sin(time * b.speed + b.phase) + 0.5) * 0.22;
      ctx.fillStyle = b.bullish ? `rgba(16, 185, 129, ${tagAlpha})` : `rgba(239, 68, 68, ${tagAlpha})`;
      ctx.fillText(b.text, b.x, b.y);
    });

    ctx.restore();
    time += 0.015;
    animId = requestAnimationFrame(loop);
  }

  resize();
  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("mousemove", onMouseMove, { passive: true });
  loop();

  return () => {
    cancelAnimationFrame(animId);
    window.removeEventListener("resize", resize);
    window.removeEventListener("mousemove", onMouseMove);
  };
}
