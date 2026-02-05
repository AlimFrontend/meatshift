/**
 * render.js — отрисовка мира, игрока, врагов, частиц, UI. Без игровой логики.
 */

import { ARENA, MELEE, GROUND_POUND, FEEDBACK } from "./config.js";
import { getCameraShakeOffset } from "./utils.js";

const ENEMY_HP_BAR_W = 28;
const ENEMY_HP_BAR_H = 4;

export function render(ctx, state) {
  const {
    W,
    H,
    cameraX,
    cameraY,
    shakeState,
    player,
    enemies,
    platforms,
    particles,
    bloodPools,
    corpses,
    dashTrail,
    meleeTrail,
    portalPositions,
    waveAnnounceFrames,
    waveCount,
  } = state;
  const floorY = state.floorY;
  const shake = getCameraShakeOffset(
    shakeState,
    FEEDBACK.CAMERA_SHAKE_DURATION
  );
  const cx = -cameraX + shake.x;
  const cy = -cameraY + shake.y;

  ctx.save();
  ctx.translate(cx, cy);

  ctx.fillStyle = "#0d0a0a";
  ctx.fillRect(cameraX - 60, cameraY - 60, W + 120, H + 120);
  ctx.fillStyle = "#1a1815";
  ctx.fillRect(0, 0, state.arenaWidth, state.arenaHeight);
  ctx.fillStyle = "#3a3530";
  ctx.fillRect(0, 0, 24, state.arenaHeight);
  ctx.fillRect(state.arenaWidth - 24, 0, 24, state.arenaHeight);
  ctx.fillRect(0, 0, state.arenaWidth, 24);
  ctx.fillRect(0, state.arenaHeight - 24, state.arenaWidth, 24);
  ctx.fillStyle = "#252018";
  ctx.fillRect(0, floorY, state.arenaWidth, ARENA.FLOOR_HEIGHT);
  ctx.strokeStyle = "#4a4035";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, floorY, state.arenaWidth, ARENA.FLOOR_HEIGHT);

  (portalPositions || []).forEach((port) => {
    if (port.x + ARENA.PORTAL_W < cameraX - 50 || port.x > cameraX + W + 50)
      return;
    if (port.y + ARENA.PORTAL_H < cameraY - 50 || port.y > cameraY + H + 50)
      return;
    ctx.fillStyle = "#1a0a15";
    ctx.fillRect(port.x, port.y, ARENA.PORTAL_W, ARENA.PORTAL_H);
    ctx.strokeStyle = "#6a2060";
    ctx.lineWidth = 3;
    ctx.strokeRect(port.x, port.y, ARENA.PORTAL_W, ARENA.PORTAL_H);
    ctx.fillStyle = "rgba(120, 40, 100, 0.4)";
    ctx.fillRect(
      port.x + 4,
      port.y + 4,
      ARENA.PORTAL_W - 8,
      ARENA.PORTAL_H - 8
    );
  });

  (bloodPools || []).forEach((p) => {
    if (p.x + p.r < cameraX - 50 || p.x - p.r > cameraX + W + 50) return;
    if (p.y + p.r < cameraY - 50 || p.y - p.r > cameraY + H + 50) return;
    ctx.fillStyle = `rgba(80, 10, 10, ${p.alpha * 0.55})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  });

  (corpses || []).forEach((c) => {
    if (c.x + c.w < cameraX - 50 || c.x > cameraX + W + 50) return;
    if (c.y + c.h < cameraY - 50 || c.y > cameraY + H + 50) return;
    ctx.fillStyle = `rgba(60, 20, 15, ${c.alpha})`;
    ctx.fillRect(c.x, c.y, c.w, c.h);
  });

  (platforms || []).forEach((p) => {
    if (p.isFloor) return;
    if (p.x + p.w < cameraX - 50 || p.x > cameraX + W + 50) return;
    if (p.y + p.h < cameraY - 50 || p.y > cameraY + H + 50) return;
    const sh =
      p.shakeFrames > 0 ? (Math.random() - 0.5) * 2 * (p.shakeFrames / 8) : 0;
    const py = p.y + sh;
    ctx.fillStyle = "#2a2520";
    ctx.fillRect(p.x, py, p.w, p.h);
    ctx.strokeStyle = "#4a4035";
    ctx.lineWidth = 2;
    ctx.strokeRect(p.x, py, p.w, p.h);
  });

  (enemies || []).forEach((e) => {
    if (e.x + e.w < cameraX - 50 || e.x > cameraX + W + 50) return;
    if (e.y + e.h < cameraY - 50 || e.y > cameraY + H + 50) return;
    ctx.fillStyle = e.color;
    ctx.fillRect(e.x, e.y, e.w, e.h);
    if (e.stunFrames > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${
        (e.stunFrames / FEEDBACK.ENEMY_STUN_FRAMES) * 0.5
      })`;
      ctx.fillRect(e.x, e.y, e.w, e.h);
    }
    const barX = e.x + (e.w - ENEMY_HP_BAR_W) / 2;
    const barY = e.y - ENEMY_HP_BAR_H - 4;
    ctx.fillStyle = "#330000";
    ctx.fillRect(barX, barY, ENEMY_HP_BAR_W, ENEMY_HP_BAR_H);
    ctx.fillStyle =
      e.hp / e.maxHp > 0.5
        ? "#cc2222"
        : e.hp / e.maxHp > 0.25
        ? "#cc8822"
        : "#cc2222";
    ctx.fillRect(
      barX,
      barY,
      ENEMY_HP_BAR_W * Math.max(0, e.hp / e.maxHp),
      ENEMY_HP_BAR_H
    );
  });

  (dashTrail || []).forEach((t, i) => {
    const a = t.alpha * (1 - i / dashTrail.length) * 0.5;
    if (a <= 0) return;
    ctx.fillStyle = `rgba(255, 120, 60, ${a})`;
    ctx.fillRect(t.x, t.y, player.w, player.h);
  });

  const flash =
    player.hurtFlashFrames > 0
      ? player.hurtFlashFrames / FEEDBACK.HURT_FLASH_FRAMES
      : 0;
  ctx.fillStyle =
    flash > 0
      ? `rgb(255, ${Math.floor(80 + (1 - flash) * 100)}, ${Math.floor(
          44 + (1 - flash) * 80
        )})`
      : "#ff6644";
  ctx.fillRect(player.x, player.y, player.w, player.h);
  if (flash > 0) {
    ctx.fillStyle = `rgba(255, 40, 40, ${flash * 0.6})`;
    ctx.fillRect(player.x, player.y, player.w, player.h);
  }
  ctx.strokeStyle = "#330000";
  ctx.lineWidth = 2;
  ctx.strokeRect(player.x, player.y, player.w, player.h);

  if (player.groundPoundLandingFrames > 0) {
    const t = 1 - player.groundPoundLandingFrames / GROUND_POUND.LANDING_FRAMES;
    const r = GROUND_POUND.RADIUS * t;
    ctx.strokeStyle = `rgba(255, 180, 80, ${0.5 * (1 - t)})`;
    ctx.lineWidth = Math.max(6, 4 * (GROUND_POUND.RADIUS / 60));
    ctx.beginPath();
    ctx.arc(player.x + player.w / 2, player.y + player.h, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  const barW = 40;
  ctx.fillStyle = "#330000";
  ctx.fillRect(player.x, player.y - 10, barW, 5);
  ctx.fillStyle =
    player.hp > 50 ? "#22cc22" : player.hp > 25 ? "#ccaa22" : "#cc2222";
  ctx.fillRect(player.x, player.y - 10, barW * (player.hp / player.maxHp), 5);

  if (player.meleeFrames > 0) {
    drawMelee(ctx, player);
  }

  (particles || []).forEach((p) => {
    const pr = typeof p.r === "number" && p.r > 0 ? p.r : 3;
    const px = Number(p.x);
    const py = Number(p.y);
    const alpha = p.grounded ? 1 : Number(p.life) / (Number(p.maxLife) || 1);
    if (alpha <= 0) return;
    ctx.fillStyle = p.color || "#cc6644";
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
    ctx.globalAlpha = 1;
  });

  ctx.restore();

  if (waveAnnounceFrames > 0) {
    const progress = 1 - waveAnnounceFrames / 75;
    const appear = progress < 0.12 ? progress / 0.12 : 1;
    const disappear = waveAnnounceFrames < 25 ? waveAnnounceFrames / 25 : 1;
    const alpha = Math.min(1, appear * disappear);
    ctx.fillStyle = `rgba(0,0,0,${0.4 * alpha})`;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    const scale = progress < 0.15 ? 0.3 + (progress / 0.15) * 0.7 : 1;
    ctx.scale(scale, scale);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = `rgba(255, 80, 50, ${alpha})`;
    ctx.font = "bold 64px Courier New";
    ctx.fillText("ВОЛНА " + waveCount, 0, 0);
    ctx.restore();
  }

  const od = document.getElementById("overdriveBar");
  if (od && state.getDashCooldown)
    od.style.width =
      (player.dashCooldown > 0
        ? (1 - player.dashCooldown / state.getDashCooldown()) * 100
        : 100) + "%";
}

function drawMelee(ctx, player) {
  const totalFrames = MELEE.ANIM_FRAMES;
  const progress = 1 - player.meleeFrames / totalFrames;
  const extendPhase = progress <= 0.5 ? progress * 2 : 1;
  const L = 1 + extendPhase * (MELEE.LENGTH_SCALE - 1);
  const tipDist = Math.min(MELEE.MAX_LENGTH - player.w, Math.round(25 * L));
  const cx = player.x + player.w / 2;
  const cy = player.y + player.h / 2;
  const ax = player.attackDirX;
  const ay = player.attackDirY;
  const tipX = cx + ax * tipDist;
  const tipY = cy + ay * tipDist;
  const alpha = 0.5 + progress * 0.5;
  const bladeHalfW = 6;

  (player._meleeTrail || []).forEach((pt, i) => {
    const a = (1 - i / (player._meleeTrail.length || 1)) * 0.3;
    if (a <= 0) return;
    ctx.fillStyle = `rgba(255, 160, 80, ${a})`;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  const perpX = -ay * bladeHalfW;
  const perpY = ax * bladeHalfW;
  ctx.beginPath();
  ctx.moveTo(cx - perpX, cy - perpY);
  ctx.lineTo(cx + perpX, cy + perpY);
  ctx.lineTo(tipX + perpX, tipY + perpY);
  ctx.lineTo(tipX - perpX, tipY - perpY);
  ctx.closePath();
  ctx.fillStyle =
    player.meleeVariant === MELEE.TOP_DOWN
      ? `rgba(255, 180, 90, ${alpha * 0.85})`
      : `rgba(255, 120, 60, ${alpha * 0.85})`;
  ctx.fill();
  ctx.strokeStyle = `rgba(255, 200, 120, ${alpha})`;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(tipX, tipY);
  ctx.strokeStyle = `rgba(255, 220, 150, ${alpha * 0.9})`;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.stroke();
  if (player.meleeHitFlash > 0) {
    const glow = player.meleeHitFlash / Math.round(12 * MELEE.THICKNESS_SCALE);
    ctx.fillStyle = `rgba(255, 230, 180, ${glow})`;
    ctx.beginPath();
    ctx.arc(tipX, tipY, 10 + glow * 6, 0, Math.PI * 2);
    ctx.fill();
  }
}
