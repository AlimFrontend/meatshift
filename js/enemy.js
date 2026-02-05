/**
 * enemy.js — враги: типы, пул, спавн, AI, урон игроку.
 */

import { PHYSICS, MELEE, ENEMY_TYPES, WAVE } from "./config.js";
import { resolvePlatform, platformLeft, platformRight } from "./utils.js";

const POOL_SIZE = 120;
const pool = [];
const active = [];

function createEnemyInstance() {
  return {
    type: "",
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    goalX: 0,
    goalY: 0,
    vx: 0,
    vy: 0,
    hp: 0,
    maxHp: 0,
    damageMultiplier: 1,
    speed: 0,
    color: "#000",
    grounded: false,
    fly: false,
    jumpVel: 0,
    jumpCooldown: 0,
    dir: 1,
    stunFrames: 0,
    landingFrames: 0,
  };
}

for (let i = 0; i < POOL_SIZE; i++) pool.push(createEnemyInstance());

function obtainFromPool() {
  return pool.pop() || createEnemyInstance();
}

function releaseToPool(e) {
  const idx = active.indexOf(e);
  if (idx !== -1) active.splice(idx, 1);
  pool.push(e);
}

export function getActiveEnemies() {
  return active;
}

export function spawnEnemy(portalPositions, side, waveIndex, arenaHeight) {
  const portals = portalPositions.filter((p) => p.side === side);
  if (portals.length === 0) return null;
  const portal = portals[Math.floor(Math.random() * portals.length)];
  const types = ["runner", "jumper", "flyer", "big"];
  const typeKey = types[Math.floor(Math.random() * types.length)];
  const t = ENEMY_TYPES[typeKey];
  if (!t) return null;
  const waveMult = Math.pow(WAVE.SCALE_PER_WAVE, Math.max(0, waveIndex - 1));
  const hp = Math.round(t.hp * waveMult);
  const fromLeft = side === "left";
  const x = fromLeft ? portal.x + 8 : portal.x + 32 - 8 - t.w;
  const dir = fromLeft ? 1 : -1;
  const y = portal.y + 56 - t.h - 4;
  const yClamp = Math.max(32, Math.min(arenaHeight - t.h - 32, y));

  const e = obtainFromPool();
  e.type = typeKey;
  e.x = x;
  e.y = yClamp;
  e.goalX = 0;
  e.goalY = 0;
  e.w = t.w;
  e.h = t.h;
  e.vx = 0;
  e.vy = 0;
  e.hp = hp;
  e.maxHp = hp;
  e.damageMultiplier = waveMult;
  e.speed = t.speed;
  e.color = t.color;
  e.grounded = false;
  e.fly = t.fly || false;
  e.jumpVel = t.jumpVel || 0;
  e.jumpCooldown = 0;
  e.dir = dir;
  e.stunFrames = 0;
  e.landingFrames = 0;
  active.push(e);
  return e;
}

export function updateEnemy(
  e,
  dt,
  dt60,
  gameTime,
  player,
  platforms,
  arenaWidth,
  arenaHeight,
  onDamagePlayer,
  onPlayerHit
) {
  if (e.stunFrames > 0) {
    e.stunFrames--;
    return;
  }
  const typ = ENEMY_TYPES[e.type];
  if (!typ) return;

  e.goalX = player.x;
  e.goalY = player.y;
  const wasGrounded = e.grounded;

  if (typ.fly) {
    e.dir = player.x > e.x ? 1 : -1;
    e.vy = 0;
    e.y += Math.sin(gameTime * 0.08) * 0.5;
    const targetVx = e.dir * e.speed;
    e.vx += (targetVx - e.vx) * 0.12;
    e.x += e.vx;
    e.x = Math.max(0, Math.min(arenaWidth - e.w, e.x));
    e.y = Math.max(24, Math.min(arenaHeight - e.h - 24, e.y));
  } else {
    e.dir = player.x > e.x ? 1 : -1;
    e.vy += PHYSICS.GRAVITY;
    if (e.vy > PHYSICS.TERMINAL_VELOCITY) e.vy = PHYSICS.TERMINAL_VELOCITY;
    e.x += e.vx;
    e.y += e.vy;
    e.grounded = resolvePlatform(platforms, e, e.w, e.h);

    if (e.type === "jumper" && e.grounded && !wasGrounded) {
      e.landingFrames = 10;
      e.vx *= 0.2;
    }
    if (e.landingFrames > 0) e.landingFrames--;

    const onPlat = platforms.some(
      (p) =>
        e.y + e.h >= p.y - 2 &&
        e.y + e.h <= p.y + 5 &&
        e.x + e.w > p.x &&
        e.x < p.x + p.w
    );
    const atLeftEdge = onPlat && e.x <= platformLeft(platforms, e) + 2;
    const atRightEdge = onPlat && e.x + e.w >= platformRight(platforms, e) - 2;
    const playerBelow = player.y > e.y + e.h * 0.3;
    const shouldTurnAtEdge = !playerBelow;

    if (e.type === "runner") {
      const targetVx = e.dir * e.speed;
      e.vx += (targetVx - e.vx) * 0.18;
      if (
        shouldTurnAtEdge &&
        ((atLeftEdge && e.dir < 0) || (atRightEdge && e.dir > 0))
      )
        e.dir *= -1;
    } else if (e.type === "jumper") {
      e.jumpCooldown--;
      const playerAbove = e.goalY + player.h < e.y + e.h * 0.5;
      if (
        e.grounded &&
        e.jumpCooldown <= 0 &&
        Math.abs(e.goalX - e.x) < 320 &&
        (playerAbove || (atLeftEdge && e.dir < 0) || (atRightEdge && e.dir > 0))
      ) {
        e.vy = e.jumpVel || -10;
        e.jumpCooldown = 50;
      }
      const targetVx = e.landingFrames > 0 ? 0 : e.dir * e.speed;
      e.vx += (targetVx - e.vx) * 0.15;
      if (
        shouldTurnAtEdge &&
        ((atLeftEdge && e.dir < 0) || (atRightEdge && e.dir > 0))
      )
        e.dir *= -1;
    } else if (e.type === "big") {
      const targetVx = e.dir * e.speed;
      e.vx += (targetVx - e.vx) * 0.12;
      if (
        shouldTurnAtEdge &&
        ((atLeftEdge && e.dir < 0) || (atRightEdge && e.dir > 0))
      )
        e.dir *= -1;
    }

    e.vx *= 0.92;
    e.x = Math.max(0, Math.min(arenaWidth - e.w, e.x));
    e.y = Math.max(0, Math.min(arenaHeight - e.h, e.y));
  }

  if (player.meleeFrames <= 0 && player.dashFrames <= 0) {
    const hit =
      player.x + player.w > e.x &&
      player.x < e.x + e.w &&
      player.y + player.h > e.y &&
      player.y < e.y + e.h;
    if (hit) {
      const baseDmg = ENEMY_TYPES[e.type]?.baseDmg ?? 8;
      const dmg = baseDmg * (e.damageMultiplier ?? 1);
      onDamagePlayer(dmg * (dt / 60), player.x < e.x ? 1 : -1);
      e.vx += player.x < e.x ? 1.5 : -1.5;
      onPlayerHit();
    }
  }
}

export function damageEnemy(e, dmg, knockbackDir, playerX, onKill, onHit) {
  e.hp -= dmg;
  if (e.hp <= 0) {
    onKill(e);
  } else {
    onHit(e);
    if (knockbackDir) {
      e.vx += knockbackDir.x * MELEE.KNOCKBACK;
      e.vy += knockbackDir.y * MELEE.KNOCKBACK;
    } else {
      e.vx += e.x < playerX ? -MELEE.KNOCKBACK : MELEE.KNOCKBACK;
    }
    e.stunFrames = 5;
  }
}

export function killEnemy(e) {
  const idx = active.indexOf(e);
  if (idx !== -1) active.splice(idx, 1);
  pool.push(e);
}

export function resetEnemies() {
  while (active.length) releaseToPool(active[0]);
}
