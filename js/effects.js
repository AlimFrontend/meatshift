/**
 * effects.js — частицы и спавн эффектов (горо, пыль, кровь). Лимит частиц, пул не используется — только cap.
 */

import { PARTICLES, GROUND_POUND, MELEE } from "./config.js";
import { getGroundY } from "./utils.js";

export function addParticle(particles, p) {
  if (!particles || !Array.isArray(particles)) return;
  if (particles.length >= PARTICLES.MAX_COUNT) particles.shift();
  particles.push(p);
}

export function updateParticles(particles, platforms, floorY) {
  if (!particles?.length) return;
  const { GRAVITY_MUL, REST_FRAMES_MIN, REST_FRAMES_MAX } = PARTICLES;
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    if (p.grounded) {
      p.restLife = (p.restLife ?? 0) - 1;
      if (p.restLife <= 0) particles.splice(i, 1);
      continue;
    }
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 1.0 * GRAVITY_MUL;
    p.vx *= 0.98;
    const r = p.r != null ? p.r : 3;
    const groundY = getGroundY(platforms, p.x, floorY);
    if (p.y + r >= groundY) {
      p.y = groundY - r;
      p.vy = 0;
      p.vx *= 0.3;
      p.grounded = true;
      p.restLife =
        REST_FRAMES_MIN +
        Math.floor(Math.random() * (REST_FRAMES_MAX - REST_FRAMES_MIN + 1));
      p.maxRestLife = p.restLife;
    } else {
      p.life = (p.life != null ? p.life : 30) - 1;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }
}

function _r() {
  return Math.random();
}

export function spawnGroundPoundEffect(particles, x, y) {
  const scale = GROUND_POUND.RADIUS / 60;
  const n = Math.floor(28 * scale) + Math.floor(_r() * 16 * scale);
  const spread = 2 + _r() * 5 * scale;
  const life = Math.round(55 * scale);
  for (let i = 0; i < n; i++) {
    const a = _r() * Math.PI * 2;
    const sp = spread * (0.6 + _r() * 0.8);
    addParticle(particles, {
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 2,
      r: 3 + _r() * 5 * scale,
      life,
      maxLife: life,
      color: i < n / 2 ? "#4a4540" : "#6a2020",
    });
  }
}

export function spawnLandingDust(particles, x, y) {
  const n = 14 + Math.floor(_r() * 8);
  for (let i = 0; i < n; i++) {
    const a = Math.PI * 0.3 + _r() * Math.PI * 0.4;
    const sp = 1.5 + _r() * 3;
    addParticle(particles, {
      x: x + (_r() - 0.5) * 20,
      y,
      vx: Math.cos(a) * sp * (_r() > 0.5 ? 1 : -1),
      vy: -0.5 - _r() * 2,
      r: 4 + _r() * 6,
      life: 50,
      maxLife: 50,
      color: "#4a4540",
    });
  }
}

export function spawnJumpDust(particles, x, y) {
  const n = 10 + Math.floor(_r() * 6);
  for (let i = 0; i < n; i++) {
    const a = Math.PI * 0.5 + _r() * Math.PI * 0.5;
    const sp = 2 + _r() * 4;
    addParticle(particles, {
      x: x + (_r() - 0.5) * 24,
      y,
      vx: Math.cos(a) * sp * (_r() > 0.5 ? 1 : -1),
      vy: -1 - _r() * 3,
      r: 3 + _r() * 5,
      life: 45,
      maxLife: 45,
      color: "#4a4540",
    });
  }
}

export function spawnDoubleJumpParticles(particles, x, y) {
  const n = 12 + Math.floor(_r() * 8);
  for (let i = 0; i < n; i++) {
    const a = _r() * Math.PI * 2;
    const sp = 1.5 + _r() * 3;
    addParticle(particles, {
      x: x + (_r() - 0.5) * 16,
      y: y + (_r() - 0.5) * 8,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 2,
      r: 2 + _r() * 3,
      life: 35,
      maxLife: 35,
      color: i % 3 === 0 ? "#6a6a88" : "#4a4a60",
    });
  }
}

export function spawnDashParticles(particles, x, y, facing) {
  const n = 14 + Math.floor(_r() * 10);
  const a0 = facing > 0 ? Math.PI * 0.3 : Math.PI * 0.5;
  for (let i = 0; i < n; i++) {
    const a = a0 + _r() * 0.4 * Math.PI;
    const sp = 3 + _r() * 5;
    addParticle(particles, {
      x: x + (_r() - 0.5) * 20,
      y: y + (_r() - 0.5) * 12,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp * 0.5,
      r: 2.5 + _r() * 3,
      life: 28,
      maxLife: 28,
      color: i % 2 === 0 ? "#5a5566" : "#3a3540",
    });
  }
}

export function spawnGore(particles, bloodPools, corpses, x, y, size) {
  const n = 25 + Math.floor(_r() * 11);
  for (let i = 0; i < n; i++) {
    const a = _r() * Math.PI * 2;
    const sp = 4 + _r() * 8;
    addParticle(particles, {
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 1,
      r: 2.5 + _r() * 4,
      life: PARTICLES.LIFETIME,
      maxLife: PARTICLES.LIFETIME,
      color: i < n / 3 ? "#3a1818" : i < (n * 2) / 3 ? "#8b2020" : "#cc2244",
    });
  }
  bloodPools.push({ x, y, r: size * 1.5, alpha: 0.65 });
  corpses.push({ x: x - 12, y: y - 8, w: 24, h: 16, alpha: 1, decay: 0.008 });
}

export function spawnMeleeHitParticles(particles, variant, x, y, attackAngle) {
  const n =
    PARTICLES.MELEE_COUNT_MIN +
    Math.floor(
      _r() * (PARTICLES.MELEE_COUNT_MAX - PARTICLES.MELEE_COUNT_MIN + 1)
    );
  const baseAngle = attackAngle != null ? attackAngle : 0;
  const spread = 0.8;
  for (let i = 0; i < n; i++) {
    const a = baseAngle + (_r() - 0.5) * spread;
    const sp = 2 + _r() * 4;
    const color =
      i % 3 === 0
        ? "#ffcc66"
        : variant === MELEE.TOP_DOWN
        ? "#cc8844"
        : "#aa6644";
    addParticle(particles, {
      x: x + (_r() - 0.5) * 20,
      y: y + (_r() - 0.5) * 12,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      r: 2 + _r() * 2,
      life: PARTICLES.MELEE_LIFE,
      maxLife: PARTICLES.MELEE_LIFE,
      color,
    });
  }
}

export function spawnBottomUpDustFromPlatform(particles, px, py) {
  for (let i = 0; i < 12; i++) {
    addParticle(particles, {
      x: px + (_r() - 0.5) * 40,
      y: py,
      vx: (_r() - 0.5) * 2,
      vy: -1 - _r() * 2,
      r: 4 + _r() * 4,
      life: 35,
      maxLife: 35,
      color: "#5a5048",
    });
  }
}

export function spawnMissEffect(particles, x, y, grounded) {
  if (grounded) {
    for (let i = 0; i < 12; i++) {
      const a = Math.PI * 0.2 + _r() * Math.PI * 0.6;
      const sp = 1 + _r() * 2;
      addParticle(particles, {
        x: x + (_r() - 0.5) * 16,
        y,
        vx: Math.cos(a) * sp * (_r() > 0.5 ? 1 : -1),
        vy: -0.3 - _r() * 1,
        r: 3 + _r() * 3,
        life: 35,
        maxLife: 35,
        color: "#4a4540",
      });
    }
  } else {
    for (let i = 0; i < 16; i++) {
      const a = _r() * Math.PI * 2;
      const sp = 0.8 + _r() * 2;
      addParticle(particles, {
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 0.5,
        r: 2 + _r() * 2,
        life: 25,
        maxLife: 25,
        color: "#888866",
      });
    }
  }
}

export function spawnHitParticles(particles, x, y) {
  const n = 24 + Math.floor(_r() * 10);
  for (let i = 0; i < n; i++) {
    const a = _r() * Math.PI * 2;
    const sp = 1.5 + _r() * 4;
    addParticle(particles, {
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 0.5,
      r: 1.5 + _r() * 2.5,
      life: PARTICLES.HIT_LIFE,
      maxLife: PARTICLES.HIT_LIFE,
      color: i < n / 3 ? "#2a1515" : "#cc2244",
    });
  }
}
