/**
 * main.js — игровой цикл, state-машина, инициализация. Один requestAnimationFrame, update(dt) / render(ctx).
 */

import { ARENA, FEEDBACK, MELEE, GROUND_POUND, PHYSICS, PARTICLES, DECALS, WAVE } from "./config.js";
import { getBloodAt } from "./utils.js";
import { createPlayer, updatePlayer, runSpeed, getDashCooldown, getGroundPoundCooldown, meleeDamage, getMeleeHitData } from "./player.js";
import { getPlatforms, getPortalPositions, getFloorY, ensurePlatformsUpTo, initPlatforms, tickPlatformShake } from "./level.js";
import { getActiveEnemies, updateEnemy, damageEnemy, killEnemy, resetEnemies } from "./enemy.js";
import { getWaveCount, getWaveAnnounceFrames, setWaveAnnounceFrames, updateWaveSpawn, startNextWave, resetWaves } from "./waveManager.js";
import { isUpgradeScreenVisible, setUpgradeScreenVisible, setUpgradeScreenOpened, openUpgradeScreen, applyUpgrade } from "./upgradeSystem.js";
import { updateParticles, spawnGroundPoundEffect, spawnLandingDust, spawnJumpDust, spawnDoubleJumpParticles, spawnDashParticles, spawnGore, spawnMeleeHitParticles, spawnBottomUpDustFromPlatform, spawnMissEffect, spawnHitParticles } from "./effects.js";
import { playHit, playJump, playDoubleJump, playDash, playMeleeSwing, playMeleeHit, playKill, playGroundPound, playUpgrade, playWave, playPickUpgrade } from "./audio.js";
import { render } from "./render.js";

const MENU = "MENU";
const PLAYING = "PLAYING";
const UPGRADE = "UPGRADE";
const PAUSED = "PAUSED";
const GAME_OVER = "GAME_OVER";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const W = canvas.width;
const H = canvas.height;
const ARENA_HEIGHT = Math.max(H * 2.5, 1600);

let gameState = PLAYING;
let player;
let particles = [];
let bloodPools = [];
let corpses = [];
let dashTrail = [];
let meleeTrail = [];
let cameraX = 0, cameraTargetX = 0, cameraY = 0, cameraTargetY = 0;
let gameTime = 0;
let kills = 0;
let lastTime = performance.now();
let keys = {};

const shakeState = {
  frames: 0,
  strength: 0,
  biasX: 0,
  biasY: 0,
  biasFrames: 0,
  platformFrames: 0,
};
let hitPauseFrames = 0;

function setState(s) {
  gameState = s;
}

function onPlayerHit() {
  hitPauseFrames = FEEDBACK.HIT_PAUSE_FRAMES;
  shakeState.frames = FEEDBACK.CAMERA_SHAKE_DURATION;
  shakeState.strength = FEEDBACK.CAMERA_SHAKE_STRENGTH;
  player.hurtFlashFrames = FEEDBACK.HURT_FLASH_FRAMES;
  playHit();
}

function healAfterWave() {
  const healAmount = player.hp * 0.5;
  player.hp = Math.min(player.hp + healAmount, player.maxHp);
}

function showUpgradeUI() {
  setState(UPGRADE);
  openUpgradeScreen(player, () => playUpgrade(), () => {
    playPickUpgrade();
    startNextWave();
    playWave();
    setState(PLAYING);
    setUpgradeScreenOpened(false);
  });
}

function init() {
  player = createPlayer();
  initPlatforms(ARENA_HEIGHT, player);
  resetWaves();
  resetEnemies();
  particles = [];
  bloodPools = [];
  corpses = [];
  dashTrail = [];
  meleeTrail = [];
  cameraX = 0;
  cameraTargetX = 0;
  cameraY = Math.max(0, Math.min(player.y - H / 2, ARENA_HEIGHT - H));
  cameraTargetY = cameraY;
  gameTime = 0;
  kills = 0;
  gameState = PLAYING;
  hitPauseFrames = 0;
  shakeState.frames = 0;
  shakeState.strength = 0;
  shakeState.biasFrames = 0;
  shakeState.platformFrames = 0;
  setUpgradeScreenVisible(false);
  setUpgradeScreenOpened(false);
  document.getElementById("gameOver")?.classList.remove("visible");
  document.getElementById("upgradeScreen")?.classList.remove("visible");
}

function update(dt) {
  const dt60 = dt * 60;
  const platforms = getPlatforms();
  const portalPositions = getPortalPositions();
  const floorY = getFloorY(ARENA_HEIGHT);
  const arenaW = ARENA.WIDTH;
  const enemies = getActiveEnemies();

  ensurePlatformsUpTo(ARENA_HEIGHT, cameraX + W, W);

  const callbacks = {
    getPlayer: () => player,
    getBloodAt: () => getBloodAt(bloodPools, player.x + player.w / 2, player.y + player.h),
    onDashTrail: () => { if (dashTrail.length < 8) dashTrail.push({ x: player.x, y: player.y, alpha: 0.6 }); },
    clearDashTrail: () => { dashTrail.length = 0; },
    onJump: () => {
      playJump();
      spawnJumpDust(particles, player.x + player.w / 2, player.y + player.h);
    },
    onDoubleJump: () => {
      playDoubleJump();
      spawnDoubleJumpParticles(particles, player.x + player.w / 2, player.y + player.h / 2);
    },
    onDash: () => {
      playDash();
      spawnDashParticles(particles, player.x + player.w / 2, player.y + player.h / 2, player.facing);
    },
    onMeleeStart: () => playMeleeSwing(),
    clearMeleeTrail: () => { meleeTrail.length = 0; },
    onLand: (hard) => {
      if (hard) {
        spawnLandingDust(particles, player.x + player.w / 2, player.y + player.h);
        shakeState.platformFrames = 6;
        const under = platforms.find((p) => player.x + player.w > p.x && player.x < p.x + p.w && player.y + player.h >= p.y - 2 && player.y + player.h <= p.y + p.h);
        if (under) under.shakeFrames = 8;
      }
    },
    onGroundPound: () => {
      const cx = player.x + player.w / 2;
      const cy = player.y + player.h;
      enemies.forEach((e) => {
        const ex = e.x + e.w / 2, ey = e.y + e.h / 2;
        if (Math.hypot(ex - cx, ey - cy) < GROUND_POUND.RADIUS) {
          damageEnemy(e, GROUND_POUND.DAMAGE, null, player.x, () => {
            spawnGore(particles, bloodPools, corpses, e.x + e.w / 2, e.y + e.h / 2, e.w);
            killEnemy(e);
            kills++;
            playKill();
          }, () => {
            playMeleeHit();
            spawnHitParticles(particles, e.x + e.w / 2, e.y + e.h / 2);
            shakeState.frames = Math.max(shakeState.frames, 5);
            shakeState.strength = Math.max(shakeState.strength, 1.5);
          });
        }
      });
      spawnGroundPoundEffect(particles, cx, cy);
      const scale = GROUND_POUND.RADIUS / 60;
      shakeState.frames = Math.max(shakeState.frames, Math.round(12 * scale));
      shakeState.strength = Math.max(shakeState.strength, 3 * scale);
      shakeState.platformFrames = Math.round(10 * scale);
      player.groundPoundLandingFrames = GROUND_POUND.LANDING_FRAMES;
      player.groundPoundCooldown = getGroundPoundCooldown(player);
      playGroundPound();
    },
  };

  updatePlayer(dt, dt60, keys, platforms, arenaW, ARENA_HEIGHT, floorY, callbacks);

  if (player.meleeFrames > 0) {
    const tipDist = Math.min(MELEE.MAX_LENGTH - player.w, Math.round(25 * (1 + (1 - player.meleeFrames / MELEE.ANIM_FRAMES <= 0.5 ? (1 - player.meleeFrames / MELEE.ANIM_FRAMES) * 2 : 1) * (MELEE.LENGTH_SCALE - 1)));
    const tipX = player.x + player.w / 2 + player.attackDirX * tipDist;
    const tipY = player.y + player.h / 2 + player.attackDirY * tipDist;
    if (meleeTrail.length < 8) meleeTrail.push({ x: tipX, y: tipY });

    if (player.meleeFrames === MELEE.HIT_AT_FRAME) {
      const hitData = getMeleeHitData(player);
      let hitSomething = false;
      enemies.forEach((e) => {
        const ex = e.x + e.w / 2, ey = e.y + e.h / 2;
        const t = (ex - hitData.cx) * hitData.ax + (ey - hitData.cy) * hitData.ay;
        if (t < 0 || t > hitData.hitLen) return;
        const projX = hitData.cx + hitData.ax * t, projY = hitData.cy + hitData.ay * t;
        if (Math.hypot(ex - projX, ey - projY) >= MELEE.HIT_MARGIN) return;
        damageEnemy(e, meleeDamage(player), { x: hitData.ax, y: hitData.ay }, player.x, () => {
          spawnGore(particles, bloodPools, corpses, e.x + e.w / 2, e.y + e.h / 2, e.w);
          killEnemy(e);
          kills++;
          playKill();
        }, () => {
          playMeleeHit();
          spawnHitParticles(particles, e.x + e.w / 2, e.y + e.h / 2);
          shakeState.frames = Math.max(shakeState.frames, 5);
          shakeState.strength = Math.max(shakeState.strength, 1.5);
        });
        hitSomething = true;
      });
      if (hitSomething) {
        spawnMeleeHitParticles(particles, player.meleeVariant, hitData.hitCx, hitData.hitCy, player.attackAngle);
        hitPauseFrames = FEEDBACK.HIT_PAUSE_FRAMES;
        shakeState.biasX = hitData.ax * 3;
        shakeState.biasY = hitData.ay * 3;
        shakeState.biasFrames = 6;
        if (player.meleeVariant === MELEE.BOTTOM_UP && player.grounded) {
          const under = platforms.find((p) => player.x + player.w > p.x && player.x < p.x + p.w && player.y + player.h >= p.y - 2 && player.y + player.h <= p.y + p.h);
          if (under) spawnBottomUpDustFromPlatform(particles, player.x + player.w / 2, under.y);
        }
        player.meleeHitFlash = Math.round(12 * MELEE.THICKNESS_SCALE);
      } else {
        spawnMissEffect(particles, hitData.hitCx, hitData.hitCy, player.grounded);
      }
    }
  }

  updateWaveSpawn(portalPositions, ARENA_HEIGHT, isUpgradeScreenVisible(), healAfterWave, showUpgradeUI);

  enemies.forEach((e) => updateEnemy(e, dt, dt60, gameTime, player, platforms, arenaW, ARENA_HEIGHT, (dmg, dir) => {
    player.hp -= dmg;
    player.knockbackVx = dir < 0 ? -6 : 6;
    onPlayerHit();
  }, onPlayerHit));

  updateParticles(particles, platforms, floorY);

  bloodPools.forEach((p) => { p.alpha = Math.max(0, p.alpha - DECALS.BLOOD_POOL_DECAY); });
  bloodPools = bloodPools.filter((p) => p.alpha > 0.05);
  corpses.forEach((c) => { c.alpha = Math.max(0, c.alpha - (c.decay || DECALS.CORPSE_DECAY)); });
  corpses = corpses.filter((c) => c.alpha > 0.05);

  cameraTargetX = Math.max(0, Math.min(player.x - W / 3, arenaW - W));
  cameraTargetY = Math.max(0, Math.min(player.y - H / 2, ARENA_HEIGHT - H));
  cameraX += (cameraTargetX - cameraX) * 0.06;
  cameraY += (cameraTargetY - cameraY) * 0.06;
  if (shakeState.frames > 0) shakeState.frames--;
  if (shakeState.biasFrames > 0) shakeState.biasFrames--;
  if (shakeState.platformFrames > 0) shakeState.platformFrames--;
  tickPlatformShake();

  if (player.hp <= 0 || player.y < -50 || player.y > ARENA_HEIGHT + 50) {
    setState(GAME_OVER);
    if (player.y > ARENA_HEIGHT + 50 || player.y < -50) {
      shakeState.frames = 8;
      shakeState.strength = 2;
      playHit();
    }
    document.getElementById("gameOver")?.classList.add("visible");
    const el = document.getElementById("finalKills");
    if (el) el.textContent = kills;
  }

  gameTime += dt60;
}

function buildRenderState() {
  const platforms = getPlatforms();
  const floorY = getFloorY(ARENA_HEIGHT);
  player._meleeTrail = meleeTrail;
  return {
    W,
    H,
    cameraX,
    cameraY,
    shakeState,
    player,
    enemies: getActiveEnemies(),
    platforms,
    particles,
    bloodPools,
    corpses,
    dashTrail,
    meleeTrail,
    portalPositions: getPortalPositions(),
    waveAnnounceFrames: getWaveAnnounceFrames(),
    waveCount: getWaveCount(),
    floorY,
    arenaWidth: ARENA.WIDTH,
    arenaHeight: ARENA_HEIGHT,
    getDashCooldown: () => getDashCooldown(player),
  };
}

function draw() {
  render(ctx, buildRenderState());
}

function loop(now) {
  const dt = Math.min(2, (now - lastTime) / 16.67);
  lastTime = now;

  if (gameState === GAME_OVER) {
    draw();
    requestAnimationFrame(loop);
    return;
  }

  if (gameState === UPGRADE) {
    draw();
    requestAnimationFrame(loop);
    return;
  }

  if (hitPauseFrames > 0) {
    hitPauseFrames--;
    if (shakeState.frames > 0) shakeState.frames--;
    if (player.hurtFlashFrames > 0) player.hurtFlashFrames--;
    draw();
    requestAnimationFrame(loop);
    return;
  }

  update(dt);

  document.getElementById("kills").textContent = kills;
  const speedEl = document.getElementById("speed");
  if (speedEl) speedEl.textContent = (runSpeed(player) / PHYSICS.RUN_MAX * 100).toFixed(0) + "%";
  const odText = document.getElementById("overdriveText");
  if (odText) odText.textContent = player.dashCooldown > 0 ? `Даш КД ${(player.dashCooldown / 60).toFixed(1)}с` : "Даш готов";

  draw();
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (e) => {
  keys[e.code] = true;
  if (e.code === "KeyW" || e.code === "Space") e.preventDefault();
});
window.addEventListener("keyup", (e) => { keys[e.code] = false; });
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

document.getElementById("restartBtn")?.addEventListener("click", () => {
  init();
  lastTime = performance.now();
});

document.getElementById("upgradeScreen")?.addEventListener("click", (e) => {
  if (e.target.id === "upgradeScreen") {
    setUpgradeScreenVisible(false);
    document.getElementById("upgradeScreen")?.classList.remove("visible");
    startNextWave();
    playWave();
    setState(PLAYING);
    setUpgradeScreenOpened(false);
  }
});

init();
requestAnimationFrame(loop);
