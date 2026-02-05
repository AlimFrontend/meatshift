/**
 * utils.js — математика и хелперы без игровой логики.
 */

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function getGroundY(platforms, x, floorY) {
  if (!platforms?.length) return typeof floorY === "number" ? floorY : 0;
  for (const p of platforms) {
    if (p.x <= x && x <= p.x + p.w) return p.y;
  }
  return floorY;
}

export function resolvePlatform(platforms, obj, ow, oh) {
  let grounded = false;
  for (const p of platforms) {
    const ox = obj.x,
      oy = obj.y;
    const penL = ox + ow - p.x;
    const penR = p.x + p.w - ox;
    const penT = oy + oh - p.y;
    const penB = p.y + p.h - oy;
    if (penL <= 0 || penR <= 0 || penT <= 0 || penB <= 0) continue;
    const minX = Math.min(penL, penR);
    const minY = Math.min(penT, penB);
    if (minX < minY) {
      obj.x += penL < penR ? -penL : penR;
      obj.vx = 0;
    } else {
      obj.y += penT < penB ? -penT : penB;
      obj.vy = 0;
      if (penT <= penB) grounded = true;
    }
  }
  return grounded;
}

export function platformCollide(platforms, x, y, w, h) {
  for (const p of platforms) {
    if (x + w > p.x && x < p.x + p.w && y + h > p.y && y < p.y + p.h)
      return true;
  }
  return false;
}

export function platformLeft(platforms, e) {
  for (const p of platforms) {
    if (
      e.y + e.h >= p.y - 2 &&
      e.y + e.h <= p.y + p.h &&
      e.x + e.w > p.x &&
      e.x < p.x + p.w
    )
      return p.x;
  }
  return -1e6;
}

export function platformRight(platforms, e) {
  for (const p of platforms) {
    if (
      e.y + e.h >= p.y - 2 &&
      e.y + e.h <= p.y + p.h &&
      e.x + e.w > p.x &&
      e.x < p.x + p.w
    )
      return p.x + p.w;
  }
  return 1e6;
}

export function getBloodAt(bloodPools, x, y) {
  let sum = 0;
  for (const p of bloodPools) {
    const d = Math.hypot(x - p.x, y - p.y);
    if (d < p.r) sum += p.alpha * (1 - d / p.r);
  }
  return Math.min(1, sum);
}

const _shakeRand = () => (Math.random() - 0.5) * 2;
export function getCameraShakeOffset(shakeState, CAMERA_SHAKE_DURATION = 9) {
  const {
    frames: sf,
    strength: ss,
    biasFrames: bf,
    biasX: bx,
    biasY: by,
    platformFrames: pf,
  } = shakeState;
  let strength = 0;
  if (sf > 0) strength = ss * (sf / CAMERA_SHAKE_DURATION);
  if (pf > 0) strength += pf * 0.4;
  let x = _shakeRand() * strength;
  let y = _shakeRand() * strength;
  if (bf > 0) {
    const bias = (bf / 6) * strength;
    x += bx * bias;
    y += by * bias;
  }
  return { x, y };
}

let _seed = 0;
export function random() {
  _seed = (_seed * 9301 + 49297) % 233280;
  return _seed / 233280;
}
export function setRandomSeed(s) {
  _seed = s;
}
export function randomRange(min, max) {
  return min + random() * (max - min);
}
export function randomInt(min, max) {
  return min + Math.floor(random() * (max - min + 1));
}
