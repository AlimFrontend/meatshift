/**
 * level.js — платформы, пол, порталы, генерация уровня.
 */

import { ARENA, PLATFORM, PLAYER_SIZE } from "./config.js";

let platforms = [];
let portalPositions = [];
let worldRight = 0;

const JUMP_HEIGHT_PX = (28.28 * 28.28) / (2 * 1.0);
const FLOOR_TO_FIRST_PLATFORM = Math.round(
  PLATFORM.FLOOR_TO_FIRST_RATIO * JUMP_HEIGHT_PX
);

export function getPlatforms() {
  return platforms;
}

export function getPortalPositions() {
  return portalPositions;
}

export function getFloorY(arenaHeight) {
  return arenaHeight - ARENA.FLOOR_HEIGHT;
}

function isFloor(p, floorY) {
  return p.y >= floorY - 2 && p.y <= floorY + 2 && p.w >= ARENA.WIDTH - 10;
}

export function ensurePlatformsUpTo(arenaHeight, viewRight, canvasW) {
  const floorY = arenaHeight - ARENA.FLOOR_HEIGHT;
  if (worldRight >= ARENA.WIDTH) return;
  const rowY = floorY - FLOOR_TO_FIRST_PLATFORM - PLATFORM.H;
  const numPlats = 2 + Math.floor(Math.random() * 2);
  const segmentWidth = ARENA.WIDTH / (numPlats + 1);
  const minGap = 80;
  const maxPlatW = Math.max(PLATFORM.MIN_W, segmentWidth - minGap);
  const platW = Math.min(PLATFORM.MAX_W, maxPlatW);
  for (let i = 0; i < numPlats; i++) {
    const centerX = segmentWidth * (i + 1);
    let px = centerX - platW / 2;
    px = Math.max(24, Math.min(px, ARENA.WIDTH - platW - 24));
    platforms.push({
      x: px,
      y: rowY,
      w: platW,
      h: PLATFORM.H,
      shakeFrames: 0,
      rowIndex: 0,
      isFloor: false,
    });
  }
  worldRight = ARENA.WIDTH;
}

export function initPlatforms(arenaHeight, playerRef) {
  platforms = [];
  worldRight = 0;
  const floorY = arenaHeight - ARENA.FLOOR_HEIGHT;
  platforms.push({
    x: 0,
    y: floorY,
    w: ARENA.WIDTH,
    h: ARENA.FLOOR_HEIGHT,
    shakeFrames: 0,
    rowIndex: -1,
    isFloor: true,
  });
  ensurePlatformsUpTo(arenaHeight, 0, 0);
  portalPositions.length = 0;
  portalPositions.push(
    { x: 12, y: floorY - 40, side: "left" },
    { x: ARENA.WIDTH - 12 - ARENA.PORTAL_W, y: floorY - 40, side: "right" }
  );
  const platformRowY = floorY - FLOOR_TO_FIRST_PLATFORM - PLATFORM.H;
  if (platformRowY > 80) {
    portalPositions.push(
      { x: 12, y: platformRowY - 40, side: "left" },
      {
        x: ARENA.WIDTH - 12 - ARENA.PORTAL_W,
        y: platformRowY - 40,
        side: "right",
      }
    );
  }
  if (playerRef) {
    playerRef.x = ARENA.WIDTH / 2 - playerRef.w / 2;
    playerRef.y = floorY - PLAYER_SIZE.H;
    playerRef.vx = 0;
    playerRef.vy = 0;
  }
}

export function tickPlatformShake() {
  platforms.forEach((p) => {
    if (p.shakeFrames > 0) p.shakeFrames--;
  });
}
