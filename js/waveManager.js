/**
 * waveManager.js — волны врагов: счётчики, спавн по таймеру, переход к апгрейдам.
 */

import { WAVE, ENEMY_LIMIT } from "./config.js";
import { getActiveEnemies, spawnEnemy } from "./enemy.js";

let waveCount = 1;
let waveEnemiesTarget = WAVE.FIRST_ENEMY_COUNT;
let waveEnemiesSpawned = 0;
let waveAnnounceFrames = WAVE.ANNOUNCE_FRAMES;
let waveSpawnCooldown = 0;
let waveBonusDelayFrames = -1;

export function getWaveCount() {
  return waveCount;
}
export function getWaveEnemiesTarget() {
  return waveEnemiesTarget;
}
export function getWaveEnemiesSpawned() {
  return waveEnemiesSpawned;
}
export function getWaveAnnounceFrames() {
  return waveAnnounceFrames;
}
export function getWaveBonusDelayFrames() {
  return waveBonusDelayFrames;
}

export function setWaveAnnounceFrames(v) {
  waveAnnounceFrames = v;
}
export function setWaveBonusDelayFrames(v) {
  waveBonusDelayFrames = v;
}

export function startNextWave(player) {
  waveCount++;
  waveEnemiesSpawned = 0;
  waveEnemiesTarget = Math.max(
    WAVE.FIRST_ENEMY_COUNT,
    Math.round(
      WAVE.FIRST_ENEMY_COUNT * Math.pow(WAVE.SCALE_PER_WAVE, waveCount - 1)
    )
  );
  waveAnnounceFrames = WAVE.ANNOUNCE_FRAMES;
}

export function updateWaveSpawn(
  portalPositions,
  arenaHeight,
  showUpgradeScreen,
  onHeal,
  onShowUpgrade
) {
  if (waveAnnounceFrames > 0) {
    waveAnnounceFrames--;
    return;
  }
  if (showUpgradeScreen) return;

  const enemies = getActiveEnemies();
  if (waveEnemiesSpawned >= waveEnemiesTarget && enemies.length === 0) {
    if (waveBonusDelayFrames < 0) {
      onHeal();
      waveBonusDelayFrames = WAVE.BONUS_APPEAR_DELAY;
    }
    waveBonusDelayFrames--;
    if (waveBonusDelayFrames <= 0) {
      onShowUpgrade();
      waveBonusDelayFrames = -1;
    }
    return;
  }

  if (waveEnemiesSpawned >= waveEnemiesTarget || enemies.length >= ENEMY_LIMIT)
    return;

  waveSpawnCooldown--;
  if (waveSpawnCooldown > 0) return;
  waveSpawnCooldown = 8 + Math.floor(Math.random() * 12);

  const fromLeft = Math.random() < 0.5;
  spawnEnemy(
    portalPositions,
    fromLeft ? "left" : "right",
    waveCount,
    arenaHeight
  );
  waveEnemiesSpawned++;
  if (waveEnemiesSpawned < waveEnemiesTarget && Math.random() < 0.35) {
    spawnEnemy(
      portalPositions,
      fromLeft ? "right" : "left",
      waveCount,
      arenaHeight
    );
    waveEnemiesSpawned++;
  }
}

export function resetWaves(playerRef) {
  waveCount = 1;
  waveEnemiesTarget = WAVE.FIRST_ENEMY_COUNT;
  waveEnemiesSpawned = 0;
  waveAnnounceFrames = WAVE.ANNOUNCE_FRAMES;
  waveBonusDelayFrames = -1;
}
