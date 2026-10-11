// Kamera-Look (wird in mehrere Effekte eingebunden): Lichthof um helle Stellen, Körnung wie bei Video bei wenig Licht,
// Randabdunklung und ein ganz leichtes Wackeln wie aus der Hand gefilmt.
function makeCamera() {
  let W = 1, H = 1, b1 = null, b2 = null, x1 = null, x2 = null, grainC = null, pat = null, patCtx = null, vig = null, vigA = -1;
  function genGrain() {
    const n = 256, c = mk(n, n), x = c.getContext('2d'), img = x.createImageData(n, n), d = img.data;
    for (let i = 0; i < n * n; i++) {
      const v = Math.random(), g = v * v * 255, tint = Math.random();
      d[i * 4] = g * (0.9 + 0.2 * tint); d[i * 4 + 1] = g; d[i * 4 + 2] = g * (1.1 - 0.2 * tint); d[i * 4 + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    return c;
  }
  return {
    resize(w, h) {
      W = w; H = h;
      b1 = mk(Math.max(1, w >> 2), Math.max(1, h >> 2)); x1 = b1.getContext('2d');
      b2 = mk(Math.max(1, w >> 3), Math.max(1, h >> 3)); x2 = b2.getContext('2d');
      if (!grainC) grainC = genGrain();
      pat = null; vig = null;
    },
    // kleine Verschiebung wie bei einer Handkamera (in Gerätepixeln)
    shake(t, amount, dpr) {
      const a = amount * dpr;
      return [a * (Math.sin(t * 0.71) * 0.8 + Math.sin(t * 1.93 + 1) * 0.35), a * (Math.sin(t * 0.53 + 2) * 0.7 + Math.sin(t * 2.31) * 0.3)];
    },
    // Lichthof: verkleinerte, dadurch weiche Kopie des Bilds dazuaddieren. Die Kopie wird vorher mit sich selbst
    // multipliziert (Helligkeit hoch 2 bzw. hoch 4), damit nur helle Stellen strahlen und das Dunkle nicht milchig wird.
    bloom(ctx, strength, sharp) {
      if (!b1 || strength <= 0) return;
      x1.globalCompositeOperation = 'copy'; x1.imageSmoothingEnabled = true; x1.drawImage(ctx.canvas, 0, 0, b1.width, b1.height);
      x1.globalCompositeOperation = 'multiply';
      for (let i = 0; i < (sharp == null ? 1 : sharp); i++) x1.drawImage(b1, 0, 0);
      x2.globalCompositeOperation = 'copy'; x2.imageSmoothingEnabled = true; x2.drawImage(b1, 0, 0, b2.width, b2.height);
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'lighter'; ctx.imageSmoothingEnabled = true;
      ctx.globalAlpha = Math.min(1, strength * 0.5); ctx.drawImage(b1, 0, 0, W, H);
      ctx.globalAlpha = Math.min(1, strength); ctx.drawImage(b2, 0, 0, W, H);
      ctx.restore();
    },
    vignette(ctx, amount) {
      if (amount <= 0) return;
      if (!vig || vigA !== amount) {
        vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.62);
        vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,' + amount + ')'); vigA = amount;
      }
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H); ctx.restore();
    },
    // Körnung: bei jedem Bild an anderer Stelle, damit sie lebt
    grain(ctx, amount, dpr) {
      if (amount <= 0 || !grainC) return;
      if (!pat || patCtx !== ctx) { pat = ctx.createPattern(grainC, 'repeat'); patCtx = ctx; }
      const s = Math.max(1, dpr * 0.75);
      ctx.save(); ctx.setTransform(s, 0, 0, s, -Math.random() * 256 * s, -Math.random() * 256 * s);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = amount;
      ctx.fillStyle = pat; ctx.fillRect(0, 0, W / s + 256, H / s + 256);
      ctx.restore();
    },
  };
}
