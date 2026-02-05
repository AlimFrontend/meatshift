/**
 * player.js — игрок: движение, прыжки, даш, меле, ground pound. Статы и способности.
 */

import {
  PHYSICS,
  DASH,
  WALL,
  GROUND_POUND,
  MELEE,
  PLAYER_SIZE,
} from "./config.js";
import { resolvePlatform, platformCollide } from "./utils.js";

export function createPlayer() {
  return {
    x: 200,
    y: 0,
    vx: 0,
    vy: 0,
    w: PLAYER_SIZE.W,
    h: PLAYER_SIZE.H,
    grounded: false,
    canDoubleJump: true,
    usedDoubleJump: false,
    dashFrames: 0,
    dashCooldown: 0,
    dashDir: 1,
    meleeFrames: 0,
    meleeCooldown: 0,
    facing: 1,
    hp: 100,
    maxHp: 100,
    baseMaxHp: 100,
    knockbackVx: 0,
    wallSlideLeft: false,
    wallSlideRight: false,
    upgrades: { speed: 0, damage: 0, regen: 0, maxHp: 0 },
    cooldownReductions: 0,
    hurtFlashFrames: 0,
    previousVy: 0,
    meleeVariant: 0,
    meleeHitFlash: 0,
    meleeAlternate: 0,
    comboFrames: 999,
    comboStacks: 0,
    attackDirX: 1,
    attackDirY: 0,
    attackAngle: 0,
    groundPound: false,
    groundPoundLandingFrames: 0,
    groundPoundCooldown: 0,
  };
}

export function runSpeed(player) {
  return PHYSICS.RUN_MAX * Math.pow(1.1, player.upgrades.speed);
}

export function meleeDamage(player) {
  return MELEE.BASE_DAMAGE * Math.pow(1.1, player.upgrades.damage);
}

export function getDashCooldown(player) {
  return Math.max(60, DASH.COOLDOWN - (player.cooldownReductions || 0) * 60);
}

export function getGroundPoundCooldown(player) {
  return Math.max(
    60,
    GROUND_POUND.COOLDOWN - (player.cooldownReductions || 0) * 60
  );
}

export function updatePlayer(
  dt,
  dt60,
  keys,
  platforms,
  arenaWidth,
  arenaHeight,
  floorY,
  callbacks
) {
  const p = callbacks.getPlayer();
  const bloodAt = callbacks.getBloodAt?.() ?? 0;

  if (p.dashFrames > 0) {
    p.dashFrames--;
    p.x += p.dashDir * DASH.SPEED;
    p.x = Math.max(0, Math.min(arenaWidth - p.w, p.x));
    if (p.dashFrames === 0) p.vx = p.dashDir * DASH.EXIT_SPEED;
    callbacks.onDashTrail?.();
    return;
  }

  callbacks.clearDashTrail?.();
  if (p.dashCooldown > 0) p.dashCooldown--;

  const left = keys.KeyA || keys.ArrowLeft;
  const right = keys.KeyD || keys.ArrowRight;
  if (left && !right) p.facing = -1;
  if (right && !left) p.facing = 1;

  if (keys.KeyW) {
    tryJump(p, callbacks);
    tryWallJump(p);
  }
  if (!p.grounded && keys.KeyS && p.groundPoundCooldown <= 0)
    p.groundPound = true;
  if (p.grounded) p.groundPound = false;
  if (keys.ShiftLeft) tryDash(p, callbacks);
  if (keys.Space) tryMelee(p, callbacks);

  const accel =
    (left && !right ? -1 : right && !left ? 1 : 0) * PHYSICS.RUN_ACCEL;
  const maxSp = runSpeed(p);
  p.vx += accel;
  p.vx += p.knockbackVx;
  p.knockbackVx *= 0.7;
  if (Math.abs(p.vx) > maxSp) p.vx = p.vx > 0 ? maxSp : -maxSp;

  const friction = p.grounded
    ? bloodAt > 0.25
      ? 0.92
      : PHYSICS.GROUND_FRICTION
    : PHYSICS.AIR_FRICTION;
  p.vx *= friction;
  p.vy += PHYSICS.GRAVITY;
  if (p.groundPound) p.vy += PHYSICS.GRAVITY * (GROUND_POUND.GRAVITY_MUL - 1);
  const maxFall = p.groundPound
    ? PHYSICS.TERMINAL_VELOCITY * 2.5
    : PHYSICS.TERMINAL_VELOCITY;
  if (p.vy > maxFall) p.vy = maxFall;

  if (p.grounded && (p.wallSlideLeft || p.wallSlideRight))
    p.vy = Math.min(p.vy, WALL.SLIDE_SPEED);

  p.x += p.vx;
  p.y += p.vy;
  p.x = Math.max(0, Math.min(arenaWidth - p.w, p.x));
  p.y = Math.max(0, Math.min(arenaHeight - p.h, p.y));
  const fallVy = p.vy;

  const wasGrounded = p.grounded;
  p.wallSlideLeft = false;
  p.wallSlideRight = false;
  if (!p.grounded && (left || right)) {
    const step = 4;
    const checkX = p.x + (left ? -step : p.w + step);
    if (platformCollide(platforms, checkX, p.y, p.w, p.h)) {
      if (left) p.wallSlideLeft = true;
      else p.wallSlideRight = true;
    }
  }

  p.grounded = resolvePlatform(platforms, p, p.w, p.h);

  if (p.grounded && !wasGrounded) {
    if (p.groundPound) callbacks.onGroundPound?.();
    else if (fallVy >= 8) callbacks.onLand?.(true);
    p.groundPound = false;
  }
  p.previousVy = p.vy;

  if (p.meleeFrames > 0) {
    p.meleeFrames--;
    if (p.meleeFrames === 0) callbacks.clearMeleeTrail?.();
  }
  if (p.meleeCooldown > 0) p.meleeCooldown--;
  if (p.meleeFrames <= 0) p.comboFrames++;
  if (p.groundPoundCooldown > 0) p.groundPoundCooldown--;
  if (p.groundPoundLandingFrames > 0) p.groundPoundLandingFrames--;
  if (p.hurtFlashFrames > 0) p.hurtFlashFrames--;
  if (p.meleeHitFlash > 0) p.meleeHitFlash--;

  if (p.upgrades.regen > 0) {
    p.hp += (p.maxHp * 0.1 * p.upgrades.regen * dt60) / 60;
    p.hp = Math.min(p.hp, p.maxHp);
  }
}

function tryJump(p, callbacks) {
  if (p.dashFrames > 0) return;
  if (p.grounded) {
    p.vy = PHYSICS.JUMP_VEL;
    p.grounded = false;
    p.usedDoubleJump = false;
    callbacks.onJump?.();
  } else if (!p.usedDoubleJump && p.canDoubleJump) {
    p.vy = PHYSICS.DOUBLE_JUMP_VEL;
    p.usedDoubleJump = true;
    callbacks.onDoubleJump?.();
  }
}

function tryWallJump(p) {
  if (p.wallSlideLeft) {
    p.vx = WALL.JUMP_VX;
    p.vy = WALL.JUMP_VY;
    p.wallSlideLeft = false;
    p.usedDoubleJump = false;
  } else if (p.wallSlideRight) {
    p.vx = -WALL.JUMP_VX;
    p.vy = WALL.JUMP_VY;
    p.wallSlideRight = false;
    p.usedDoubleJump = false;
  }
}

function tryDash(p, callbacks) {
  if (p.dashCooldown > 0 || p.dashFrames > 0) return;
  p.dashFrames = DASH.FRAMES;
  p.dashDir = p.facing;
  p.dashCooldown = getDashCooldown(p);
  callbacks.onDash?.();
}

function tryMelee(p, callbacks) {
  if (p.meleeCooldown > 0 || p.meleeFrames > 0) return;
  const dir = p.facing;
  p.attackDirX = dir;
  p.attackDirY = 0;
  p.attackAngle = dir > 0 ? 0 : Math.PI;
  if (p.comboFrames > MELEE.COMBO_WINDOW_FRAMES) p.comboStacks = 0;
  else
    p.comboStacks = Math.min(MELEE.COMBO_MAX_STACKS, (p.comboStacks || 0) + 1);
  p.comboFrames = 0;
  p.meleeFrames = MELEE.ANIM_FRAMES;
  p.meleeCooldown = MELEE.COOLDOWN_FRAMES;
  p.meleeVariant = p.meleeAlternate ? MELEE.BOTTOM_UP : MELEE.TOP_DOWN;
  p.meleeAlternate = 1 - p.meleeAlternate;
  callbacks.onMeleeStart?.();
}

export function isMeleeHitFrame(player) {
  return player.meleeFrames === MELEE.HIT_AT_FRAME;
}

export function getMeleeHitData(player) {
  const comboMult =
    1 + (player.comboStacks || 0) * MELEE.COMBO_RADIUS_PER_STACK;
  const hitLen = Math.min(
    MELEE.MAX_LENGTH,
    Math.round(70 * MELEE.LENGTH_SCALE * comboMult)
  );
  const cx = player.x + player.w / 2;
  const cy = player.y + player.h / 2;
  const ax = player.attackDirX;
  const ay = player.attackDirY;
  const tipX = cx + ax * hitLen;
  const tipY = cy + ay * hitLen;
  return {
    cx,
    cy,
    tipX,
    tipY,
    hitLen,
    ax,
    ay,
    hitCx: (cx + tipX) / 2,
    hitCy: (cy + tipY) / 2,
  };
}
