/**
 * audio.js — процедурные звуки (Web Audio API).
 */

let audioCtx = null;

function ensure() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (_) {}
  }
  if (audioCtx?.state === "suspended") audioCtx.resume().catch(() => {});
  return audioCtx;
}

function tone(freq, duration, type, vol, slideFreq) {
  const ctx = ensure();
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.connect(g);
  g.connect(ctx.destination);
  o.frequency.setValueAtTime(freq, ctx.currentTime);
  if (slideFreq)
    o.frequency.exponentialRampToValueAtTime(
      slideFreq,
      ctx.currentTime + duration
    );
  o.type = type || "square";
  g.gain.setValueAtTime(vol, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  o.start(ctx.currentTime);
  o.stop(ctx.currentTime + duration);
}

export function playHit() {
  ensure();
  if (audioCtx) tone(120, 0.06, "square", 0.08);
}

export function playJump() {
  tone(280, 0.08, "sine", 0.06, 380);
}

export function playDoubleJump() {
  tone(420, 0.06, "sine", 0.05, 520);
}

export function playDash() {
  tone(180, 0.04, "sawtooth", 0.04, 90);
}

export function playMeleeSwing() {
  tone(90, 0.03, "sawtooth", 0.05);
}

export function playMeleeHit() {
  tone(150, 0.05, "square", 0.06, 100);
}

export function playKill() {
  tone(200, 0.1, "square", 0.07, 80);
}

export function playGroundPound() {
  tone(70, 0.12, "sine", 0.1, 45);
}

export function playUpgrade() {
  tone(330, 0.06, "sine", 0.05, 440);
  setTimeout(() => {
    if (audioCtx) tone(440, 0.08, "sine", 0.05, 550);
  }, 80);
}

export function playWave() {
  tone(220, 0.1, "square", 0.06, 180);
}

export function playPickUpgrade() {
  tone(520, 0.05, "sine", 0.06, 660);
}
