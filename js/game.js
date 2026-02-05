// MEATSHIFT — 2D платформер, волны врагов, апгрейды (сбрасываются при смерти).

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const hudCanvas = document.getElementById("hud");
const hudCtx = hudCanvas ? hudCanvas.getContext("2d") : null;
const W = canvas.width;
const H = canvas.height;

const GRAVITY = 1.0;
const TERMINAL_VELOCITY = 14;
const JUMP_VEL = -28.28;
const DOUBLE_JUMP_VEL = -20;
const RUN_ACCEL = 1.1;
const RUN_MAX = 5.5;
const GROUND_FRICTION = 0.78;
const AIR_FRICTION = 0.96;
const DASH_SPEED = 14;
const DASH_FRAMES = 12;
const DASH_COOLDOWN = 300;
const DASH_EXIT_SPEED = 3;
const WALL_SLIDE_SPEED = 1.2;
const WALL_JUMP_VX = 7;
const WALL_JUMP_VY = -12;
const GROUND_POUND_GRAVITY_MUL = 3;
const GROUND_POUND_RADIUS = 150;
const GROUND_POUND_DAMAGE = 25;
const GROUND_POUND_LANDING_FRAMES = 18;
const GROUND_POUND_COOLDOWN = 180;

const PLAYER_W = 32;
const PLAYER_H = 48;
const PLATFORM_H = 40;
const PLATFORM_MIN_W = 100;
const PLATFORM_MAX_W = 220;
const JUMP_HEIGHT_PX = (JUMP_VEL * JUMP_VEL) / (2 * GRAVITY);
const FLOOR_TO_FIRST_PLATFORM = Math.round(0.35 * JUMP_HEIGHT_PX);
const ARENA_WIDTH = 1100;
const ARENA_HEIGHT = Math.max(H * 2.5, 1600);
const PARTICLE_LIFETIME = 90;
const MAX_PARTICLES = 220;
const LANDING_DUST_VEL = 8;
const BLOOD_POOL_DECAY = 0.012;
const MAX_ENEMIES = 80;
const MELEE_KNOCKBACK = 7;
const MELEE_PARTICLE_COUNT_MIN = 14;
const MELEE_PARTICLE_COUNT_MAX = 24;
const MELEE_PARTICLE_LIFE = 18;
const BONUS_APPEAR_DELAY = 60;
const WAVE_ANNOUNCE_FRAMES = 75;
const WAVE_1_ENEMY_COUNT = 10;
const WAVE_SCALE_PER_WAVE = 1.1;

const CAMERA_SHAKE_STRENGTH = 3;
const CAMERA_SHAKE_DURATION = 9;
const HIT_PAUSE_FRAMES = 5;
const ENEMY_STUN_FRAMES = 5;
const HURT_FLASH_FRAMES = 6;
const HIT_PARTICLE_LIFE = 22;

let cameraX = 0;
let cameraTargetX = 0;
let cameraY = 0;
let cameraTargetY = 0;
const CAMERA_LAG = 0.06;
let platformShakeFrames = 0;
let worldRight = 0;
let gameTime = 0;
let kills = 0;
let showUpgradeScreen = false;
let upgradeScreenOpened = false;
let gameOver = false;
let cameraShakeFrames = 0;
let cameraShakeStrength = 0;
let cameraShakeBiasX = 0;
let cameraShakeBiasY = 0;
let cameraShakeBiasFrames = 0;
let hitPauseFrames = 0;
let keys = {};
let platforms = [];
let bloodPools = [];
let particles = [];
let enemies = [];
let corpses = [];
let dashTrail = [];
let meleeTrail = [];
let attackTrail = [];
let waveEnemiesTarget = WAVE_1_ENEMY_COUNT;
let waveEnemiesSpawned = 0;
let waveAnnounceFrames = WAVE_ANNOUNCE_FRAMES;
let wavePauseFrames = 0;
let waveBonusDelayFrames = -1;
const HUD_COUNTER_PULSE_FRAMES = 240;
const HUD_COUNTER_PULSE_GROW_FRAMES = 120;
let hudKillWavePulseFrames = 0;
let hudCounterScale = 1;

const player = {
  x: 200,
  y: 0,
  vx: 0,
  vy: 0,
  w: PLAYER_W,
  h: PLAYER_H,
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
  comboResetAfterSwing: false,
  attackFacing: 1,
  groundPound: false,
  groundPoundLandingFrames: 0,
  groundPoundCooldown: 0,
  regenAccumulatorMs: 0,
  bossBuffFrames: 0,
};

function runSpeed() {
  const bossMult = player.bossBuffFrames > 0 ? 1.1 : 1;
  return RUN_MAX * Math.pow(1.1, player.upgrades.speed) * bossMult;
}
function meleeDamage() {
  const bossMult = player.bossBuffFrames > 0 ? 1.1 : 1;
  return 18 * Math.pow(1.1, player.upgrades.damage) * bossMult;
}
function getDashCooldown() {
  return Math.max(60, DASH_COOLDOWN - (player.cooldownReductions || 0) * 60);
}
function getGroundPoundCooldown() {
  return Math.max(
    60,
    GROUND_POUND_COOLDOWN - (player.cooldownReductions || 0) * 60
  );
}

let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (_) {}
  }
  if (audioCtx && audioCtx.state === "suspended")
    audioCtx.resume().catch(() => {});
  return audioCtx;
}
function playTone(freq, duration, type, vol, slideFreq) {
  const ctx = ensureAudio();
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

function playHitSound() {
  ensureAudio();
  if (!audioCtx) return;
  playTone(120, 0.06, "square", 0.08);
}
function playJumpSound() {
  playTone(280, 0.08, "sine", 0.06, 380);
}
function playDoubleJumpSound() {
  playTone(420, 0.06, "sine", 0.05, 520);
}
function playDashSound() {
  playTone(180, 0.04, "sawtooth", 0.04, 90);
}
function playMeleeSwingSound() {
  playTone(90, 0.03, "sawtooth", 0.05);
}
function playMeleeHitSound() {
  playTone(150, 0.05, "square", 0.06, 100);
}
function playKillSound() {
  playTone(200, 0.1, "square", 0.07, 80);
}
function playGroundPoundSound() {
  playTone(70, 0.12, "sine", 0.1, 45);
}
function playUpgradeSound() {
  playTone(330, 0.06, "sine", 0.05, 440);
  setTimeout(() => {
    if (audioCtx) playTone(440, 0.08, "sine", 0.05, 550);
  }, 80);
}
function playWaveSound() {
  playTone(220, 0.1, "square", 0.06, 180);
}
function playPickUpgradeSound() {
  playTone(520, 0.05, "sine", 0.06, 660);
}

function onPlayerHit() {
  hitPauseFrames = HIT_PAUSE_FRAMES;
  cameraShakeFrames = CAMERA_SHAKE_DURATION;
  cameraShakeStrength = CAMERA_SHAKE_STRENGTH;
  player.hurtFlashFrames = HURT_FLASH_FRAMES;
  playHitSound();
}

function getCameraShakeOffset() {
  let strength = 0;
  if (cameraShakeFrames > 0) {
    const t = cameraShakeFrames / CAMERA_SHAKE_DURATION;
    strength = cameraShakeStrength * t;
  }
  if (platformShakeFrames > 0) strength += platformShakeFrames * 0.4;
  let x = (Math.random() - 0.5) * 2 * strength;
  let y = (Math.random() - 0.5) * 2 * strength;
  if (cameraShakeBiasFrames > 0) {
    const bias = (cameraShakeBiasFrames / 6) * strength;
    x += cameraShakeBiasX * bias;
    y += cameraShakeBiasY * bias;
  }
  return { x, y };
}

const FLOOR_HEIGHT = 48;
const FLOOR_Y = ARENA_HEIGHT - FLOOR_HEIGHT;
const PORTAL_W = 32;
const PORTAL_H = 56;

function getGroundY(x) {
  if (!platforms || !platforms.length)
    return typeof FLOOR_Y === "number" ? FLOOR_Y : 0;
  for (const plat of platforms) {
    if (plat.x <= x && x <= plat.x + plat.w) return plat.y;
  }
  return FLOOR_Y;
}

const PORTAL_POSITIONS = [];

function ensurePlatformsUpTo(x) {
  if (worldRight >= ARENA_WIDTH) return;
  const rowY = FLOOR_Y - FLOOR_TO_FIRST_PLATFORM - PLATFORM_H;
  const numPlats = 2 + Math.floor(Math.random() * 2);
  const segmentWidth = ARENA_WIDTH / (numPlats + 1);
  const minGap = 80;
  const maxPlatW = Math.max(PLATFORM_MIN_W, segmentWidth - minGap);
  const platW = Math.min(PLATFORM_MAX_W, maxPlatW);
  for (let i = 0; i < numPlats; i++) {
    const centerX = segmentWidth * (i + 1);
    let px = centerX - platW / 2;
    px = Math.max(24, Math.min(px, ARENA_WIDTH - platW - 24));
    platforms.push({
      x: px,
      y: rowY,
      w: platW,
      h: PLATFORM_H,
      shakeFrames: 0,
      rowIndex: 0,
      isFloor: false,
    });
  }
  worldRight = ARENA_WIDTH;
}

function initFirstPlatforms() {
  platforms = [];
  worldRight = 0;
  platforms.push({
    x: 0,
    y: FLOOR_Y,
    w: ARENA_WIDTH,
    h: FLOOR_HEIGHT,
    shakeFrames: 0,
    rowIndex: -1,
    isFloor: true,
  });
  ensurePlatformsUpTo(ARENA_WIDTH);
  PORTAL_POSITIONS.length = 0;
  PORTAL_POSITIONS.push(
    { x: 12, y: FLOOR_Y - 40, side: "left" },
    { x: ARENA_WIDTH - 12 - PORTAL_W, y: FLOOR_Y - 40, side: "right" }
  );
  const platformRowY = FLOOR_Y - FLOOR_TO_FIRST_PLATFORM - PLATFORM_H;
  if (platformRowY > 80) {
    PORTAL_POSITIONS.push(
      { x: 12, y: platformRowY - 40, side: "left" },
      { x: ARENA_WIDTH - 12 - PORTAL_W, y: platformRowY - 40, side: "right" }
    );
  }
  player.x = ARENA_WIDTH / 2 - player.w / 2;
  player.y = FLOOR_Y - PLAYER_H;
  player.vx = 0;
  player.vy = 0;
}

function resolvePlatform(obj, ow, oh) {
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

function platformCollide(x, y, w, h) {
  for (const p of platforms) {
    if (x + w > p.x && x < p.x + p.w && y + h > p.y && y < p.y + p.h)
      return true;
  }
  return false;
}

window.addEventListener("keydown", (e) => {
  keys[e.code] = true;
  if (e.code === "KeyW" || e.code === "Space") e.preventDefault();
});
window.addEventListener("keyup", (e) => {
  keys[e.code] = false;
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

function tryJump() {
  if (player.dashFrames > 0) return;
  if (player.grounded) {
    player.vy = JUMP_VEL;
    player.grounded = false;
    player.usedDoubleJump = false;
    playJumpSound();
    spawnJumpDust(player.x + player.w / 2, player.y + player.h);
  } else if (!player.usedDoubleJump && player.canDoubleJump) {
    player.vy = DOUBLE_JUMP_VEL;
    player.usedDoubleJump = true;
    playDoubleJumpSound();
    spawnDoubleJumpParticles(player.x + player.w / 2, player.y + player.h / 2);
  }
}
function tryWallJump() {
  if (player.wallSlideLeft) {
    player.vx = WALL_JUMP_VX;
    player.vy = WALL_JUMP_VY;
    player.wallSlideLeft = false;
    player.usedDoubleJump = false;
  } else if (player.wallSlideRight) {
    player.vx = -WALL_JUMP_VX;
    player.vy = WALL_JUMP_VY;
    player.wallSlideRight = false;
    player.usedDoubleJump = false;
  }
}
function tryDash() {
  if (player.dashCooldown > 0 || player.dashFrames > 0) return;
  player.dashFrames = DASH_FRAMES;
  player.dashDir = player.facing;
  player.dashCooldown = getDashCooldown();
  playDashSound();
  spawnDashParticles(player.x + player.w / 2, player.y + player.h / 2);
}
const MELEE_TOP_DOWN = 0;
const MELEE_BOTTOM_UP = 1;
const MELEE_ANIM_FRAMES = 15;
const MELEE_HIT_AT_FRAME = 7;
const MELEE_ANIM_SPEED = 2;
const MELEE_COOLDOWN_FRAMES = Math.max(1, Math.floor(25 / MELEE_ANIM_SPEED));
const MELEE_LENGTH_SCALE = 1.8;
const MELEE_THICKNESS_SCALE = 1.35;
const MELEE_MAX_LENGTH = Math.min(130, PLAYER_W * 3.5);
const COMBO_WINDOW_FRAMES = Math.round(0.6 * 60);
const COMBO_RADIUS_PER_STACK = 0.4;
const COMBO_MAX_STACKS = 3;
const MELEE_HIT_MARGIN = 28;
const MELEE_HIT_MARGIN_BOSS = 48;

function tryMelee() {
  if (player.meleeCooldown > 0 || player.meleeFrames > 0) return;
  player.attackFacing = player.facing;

  if (player.comboFrames > COMBO_WINDOW_FRAMES) player.comboStacks = 0;
  else
    player.comboStacks = Math.min(
      COMBO_MAX_STACKS,
      (player.comboStacks || 0) + 1
    );
  player.comboFrames = 0;
  if (player.comboStacks >= COMBO_MAX_STACKS)
    player.comboResetAfterSwing = true;

  player.meleeFrames = MELEE_ANIM_FRAMES;
  player.meleeCooldown = MELEE_COOLDOWN_FRAMES;
  player.meleeVariant = player.meleeAlternate
    ? MELEE_BOTTOM_UP
    : MELEE_TOP_DOWN;
  player.meleeAlternate = 1 - player.meleeAlternate;
  playMeleeSwingSound();
}

function addParticle(p) {
  if (!particles || !Array.isArray(particles)) particles = [];
  if (particles.length >= MAX_PARTICLES) particles.shift();
  particles.push(p);
}

function spawnGroundPoundEffect(x, y) {
  const scale = GROUND_POUND_RADIUS / 60; // относительный масштаб (база 60)
  const n = Math.floor(28 * scale) + Math.floor(Math.random() * 16 * scale);
  const spread = 2 + Math.random() * 5 * scale;
  const life = Math.round(55 * scale);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = spread * (0.6 + Math.random() * 0.8);
    addParticle({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 2,
      r: 3 + Math.random() * 5 * scale,
      life,
      maxLife: life,
      color: i < n / 2 ? "#4a4540" : "#6a2020",
    });
  }
}

function spawnLandingDust(x, y) {
  const n = 14 + Math.floor(Math.random() * 8);
  for (let i = 0; i < n; i++) {
    const a = Math.PI * 0.3 + Math.random() * Math.PI * 0.4;
    const sp = 1.5 + Math.random() * 3;
    addParticle({
      x: x + (Math.random() - 0.5) * 20,
      y,
      vx: Math.cos(a) * sp * (Math.random() > 0.5 ? 1 : -1),
      vy: -0.5 - Math.random() * 2,
      r: 4 + Math.random() * 6,
      life: 50,
      maxLife: 50,
      color: "#4a4540",
    });
  }
}

function spawnJumpDust(x, y) {
  const n = 10 + Math.floor(Math.random() * 6);
  for (let i = 0; i < n; i++) {
    const a = Math.PI * 0.5 + Math.random() * Math.PI * 0.5;
    const sp = 2 + Math.random() * 4;
    addParticle({
      x: x + (Math.random() - 0.5) * 24,
      y,
      vx: Math.cos(a) * sp * (Math.random() > 0.5 ? 1 : -1),
      vy: -1 - Math.random() * 3,
      r: 3 + Math.random() * 5,
      life: 45,
      maxLife: 45,
      color: "#4a4540",
    });
  }
}

function spawnDoubleJumpParticles(x, y) {
  const n = 12 + Math.floor(Math.random() * 8);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 1.5 + Math.random() * 3;
    addParticle({
      x: x + (Math.random() - 0.5) * 16,
      y: y + (Math.random() - 0.5) * 8,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 2,
      r: 2 + Math.random() * 3,
      life: 35,
      maxLife: 35,
      color: i % 3 === 0 ? "#6a6a88" : "#4a4a60",
    });
  }
}

function spawnDashParticles(x, y) {
  const n = 14 + Math.floor(Math.random() * 10);
  const dir = player.facing;
  for (let i = 0; i < n; i++) {
    const a =
      dir > 0
        ? Math.PI * 0.3 + Math.random() * 0.4 * Math.PI
        : Math.PI * 0.5 + Math.random() * 0.4 * Math.PI;
    const sp = 3 + Math.random() * 5;
    addParticle({
      x: x + (Math.random() - 0.5) * 20,
      y: y + (Math.random() - 0.5) * 12,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp * 0.5,
      r: 2.5 + Math.random() * 3,
      life: 28,
      maxLife: 28,
      color: i % 2 === 0 ? "#5a5566" : "#3a3540",
    });
  }
}

function spawnGore(x, y, size) {
  const n = 25 + Math.floor(Math.random() * 11);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 4 + Math.random() * 8;
    addParticle({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 1,
      r: 2.5 + Math.random() * 4,
      life: PARTICLE_LIFETIME,
      maxLife: PARTICLE_LIFETIME,
      color: i < n / 3 ? "#3a1818" : i < (n * 2) / 3 ? "#8b2020" : "#cc2244",
    });
  }
  bloodPools.push({ x, y, r: size * 1.5, alpha: 0.65 });
  corpses.push({
    x: x - 12,
    y: y - 8,
    w: 24,
    h: 16,
    alpha: 1,
    decay: 0.008,
  });
  cameraShakeFrames = Math.max(cameraShakeFrames, 5);
  cameraShakeStrength = Math.max(cameraShakeStrength, 1.5);
}

function killEnemy(e) {
  if (e.type === "boss" && Math.random() < BOSS_GIANT_BONE_DROP_CHANCE) {
    pickups.push({
      x: e.x + e.w / 2 - 14,
      y: e.y + e.h / 2 - 14,
      w: 28,
      h: 28,
      type: "giant_bone",
    });
  }
  if (e.type !== "boss") {
    bonesCount += 1 + Math.floor(Math.random() * 6);
  }
  const idx = enemies.indexOf(e);
  if (idx !== -1) enemies.splice(idx, 1);
  kills++;
  hudKillWavePulseFrames = HUD_COUNTER_PULSE_FRAMES;
}

function spawnMeleeHitParticles(variant, x, y, attackAngle) {
  const n =
    MELEE_PARTICLE_COUNT_MIN +
    Math.floor(
      Math.random() * (MELEE_PARTICLE_COUNT_MAX - MELEE_PARTICLE_COUNT_MIN + 1)
    );
  const life = MELEE_PARTICLE_LIFE;
  const baseAngle = attackAngle != null ? attackAngle : 0;
  const spread = 0.8;
  for (let i = 0; i < n; i++) {
    const a = baseAngle + (Math.random() - 0.5) * spread;
    const sp = 2 + Math.random() * 4;
    const vx = Math.cos(a) * sp;
    const vy = Math.sin(a) * sp;
    const color =
      i % 3 === 0
        ? "#ffcc66"
        : variant === MELEE_TOP_DOWN
        ? "#cc8844"
        : "#aa6644";
    addParticle({
      x: x + (Math.random() - 0.5) * 20,
      y: y + (Math.random() - 0.5) * 12,
      vx,
      vy,
      r: 2 + Math.random() * 2,
      life,
      maxLife: life,
      color,
    });
  }
}

function spawnBottomUpDustFromPlatform(px, py) {
  for (let i = 0; i < 12; i++) {
    addParticle({
      x: px + (Math.random() - 0.5) * 40,
      y: py,
      vx: (Math.random() - 0.5) * 2,
      vy: -1 - Math.random() * 2,
      r: 4 + Math.random() * 4,
      life: 35,
      maxLife: 35,
      color: "#5a5048",
    });
  }
}

function spawnMissEffect(x, y, grounded) {
  if (grounded) {
    for (let i = 0; i < 12; i++) {
      const a = Math.PI * 0.2 + Math.random() * Math.PI * 0.6;
      const sp = 1 + Math.random() * 2;
      addParticle({
        x: x + (Math.random() - 0.5) * 16,
        y,
        vx: Math.cos(a) * sp * (Math.random() > 0.5 ? 1 : -1),
        vy: -0.3 - Math.random() * 1,
        r: 3 + Math.random() * 3,
        life: 35,
        maxLife: 35,
        color: "#4a4540",
      });
    }
  } else {
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.8 + Math.random() * 2;
      addParticle({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 0.5,
        r: 2 + Math.random() * 2,
        life: 25,
        maxLife: 25,
        color: "#888866",
      });
    }
  }
}

function spawnHitParticles(x, y) {
  const n = 24 + Math.floor(Math.random() * 10);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 1.5 + Math.random() * 4;
    addParticle({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 0.5,
      r: 1.5 + Math.random() * 2.5,
      life: HIT_PARTICLE_LIFE,
      maxLife: HIT_PARTICLE_LIFE,
      color: i < n / 3 ? "#2a1515" : "#cc2244",
    });
  }
}

function damageEnemy(e, dmg, knockbackDir) {
  e.hp -= dmg;
  if (e.hp <= 0) {
    spawnGore(e.x + e.w / 2, e.y + e.h / 2, e.w);
    killEnemy(e);
    playKillSound();
  } else {
    playMeleeHitSound();
    const typ = ENEMY_TYPES[e.type];
    if (typ && typ.canBeKnockedBack !== false) {
      if (knockbackDir) {
        e.vx += knockbackDir.x * MELEE_KNOCKBACK;
        e.vy += knockbackDir.y * MELEE_KNOCKBACK;
      } else {
        e.vx += e.x < player.x ? -MELEE_KNOCKBACK : MELEE_KNOCKBACK;
      }
    }
    e.stunFrames = ENEMY_STUN_FRAMES;
    spawnHitParticles(e.x + e.w / 2, e.y + e.h / 2);
    cameraShakeFrames = Math.max(cameraShakeFrames, 5);
    cameraShakeStrength = Math.max(cameraShakeStrength, 1.5);
  }
}

const ENEMY_TYPES = {
  runner: {
    hp: 15,
    w: 28,
    h: 32,
    speed: 2.8,
    color: "#a03030",
    big: false,
    baseDmg: 8,
    canBeKnockedBack: true,
  },
  jumper: {
    hp: 21,
    w: 26,
    h: 36,
    speed: 2.1,
    color: "#805050",
    big: false,
    jumpVel: -10,
    baseDmg: 8,
    canBeKnockedBack: true,
  },
  flyer: {
    hp: 12,
    w: 24,
    h: 24,
    speed: 1.6,
    color: "#604060",
    big: false,
    fly: true,
    baseDmg: 4,
    canBeKnockedBack: true,
  },
  big: {
    hp: 53,
    w: 40,
    h: 48,
    speed: 1.4,
    color: "#503030",
    big: true,
    baseDmg: 14,
    canBeKnockedBack: false,
  },
  boss: {
    hp: 530,
    w: 80,
    h: 96,
    speed: 2.8 * 0.7,
    color: "#402020",
    big: true,
    baseDmg: 28,
    canBeKnockedBack: false,
  },
};

// Враги только из порталов. ТЗ: масштабирование волн — HP и урон +10% за волну
function spawnEnemyFromSide(side, waveIndex) {
  const portals = PORTAL_POSITIONS.filter((p) => p.side === side);
  if (portals.length === 0) return;
  const portal = portals[Math.floor(Math.random() * portals.length)];
  const types = ["runner", "jumper", "flyer", "big"];
  const typeKey = types[Math.floor(Math.random() * types.length)];
  const t = ENEMY_TYPES[typeKey];
  if (!t) return;
  const waveMult = Math.pow(WAVE_SCALE_PER_WAVE, Math.max(0, waveIndex - 1));
  const hp = Math.round(t.hp * waveMult);
  const fromLeft = side === "left";
  const x = fromLeft ? portal.x + 8 : portal.x + PORTAL_W - 8 - t.w;
  const dir = fromLeft ? 1 : -1;
  const y = portal.y + PORTAL_H - t.h - 4;
  const yClamp = Math.max(32, Math.min(ARENA_HEIGHT - t.h - 32, y));
  enemies.push({
    type: typeKey,
    x,
    y: yClamp,
    goalX: player.x,
    goalY: player.y,
    w: t.w,
    h: t.h,
    vx: 0,
    vy: 0,
    hp,
    maxHp: hp,
    damageMultiplier: waveMult, // урон врага игроку масштабируется волной
    speed: t.speed,
    color: t.color,
    grounded: false,
    fly: t.fly || false,
    jumpVel: t.jumpVel || 0,
    jumpCooldown: 0,
    dir,
    stunFrames: 0,
    landingFrames: 0,
  });
}

let waveCount = 1; // текущая волна (1-based), бесконечные волны
let waveSpawnCooldown = 0; // задержка между спавнами внутри волны
let waveBossSpawned = false;
let bonesCount = 0;
let pickups = [];
const BOSS_GIANT_BONE_DROP_CHANCE = 0.1;
const BOSS_BUFF_FRAMES = 60 * 30; // 30 сек

function updateWaveSpawn() {
  // Показываем "ВОЛНА N" — не спавним
  if (waveAnnounceFrames > 0) {
    waveAnnounceFrames--;
    return;
  }
  // Пауза между волнами (после очистки волны, перед апгрейдом уже показан и выбран)
  if (wavePauseFrames > 0) {
    wavePauseFrames--;
    return;
  }
  // Апгрейд показывается — не спавним до выбора
  if (showUpgradeScreen) return;

  // Волна завершена: все враги убиты. Сначала спавним босса, после смерти босса — бонусы.
  if (waveEnemiesSpawned >= waveEnemiesTarget && enemies.length === 0) {
    if (!waveBossSpawned) {
      spawnBoss();
      waveBossSpawned = true;
    } else {
      if (waveBonusDelayFrames < 0) {
        const healAmount = player.hp * 0.5;
        player.hp = Math.min(player.hp + healAmount, player.maxHp);
        waveBonusDelayFrames = BONUS_APPEAR_DELAY;
      }
      waveBonusDelayFrames--;
      if (waveBonusDelayFrames <= 0) {
        showUpgradeScreen = true;
        upgradeScreenOpened = false;
        waveBonusDelayFrames = -1;
        waveBossSpawned = false;
      }
    }
    return;
  }

  if (waveEnemiesSpawned >= waveEnemiesTarget) return; // ждём пока добьют
  if (enemies.length >= MAX_ENEMIES) return;

  waveSpawnCooldown--;
  if (waveSpawnCooldown > 0) return;
  waveSpawnCooldown = 8 + Math.floor(Math.random() * 12);

  const fromLeft = Math.random() < 0.5;
  spawnEnemyFromSide(fromLeft ? "left" : "right", waveCount);
  waveEnemiesSpawned++;
  if (waveEnemiesSpawned < waveEnemiesTarget && Math.random() < 0.35) {
    spawnEnemyFromSide(fromLeft ? "right" : "left", waveCount);
    waveEnemiesSpawned++;
  }
}

function spawnBoss() {
  const side = Math.random() < 0.5 ? "left" : "right";
  const portals = PORTAL_POSITIONS.filter((p) => p.side === side);
  if (portals.length === 0) return;
  const portal = portals[Math.floor(Math.random() * portals.length)];
  const t = ENEMY_TYPES.boss;
  const fromLeft = side === "left";
  const x = fromLeft ? portal.x + 8 : portal.x + PORTAL_W - 8 - t.w;
  const dir = fromLeft ? 1 : -1;
  const y = portal.y + PORTAL_H - t.h - 4;
  const yClamp = Math.max(32, Math.min(ARENA_HEIGHT - t.h - 32, y));
  enemies.push({
    type: "boss",
    x,
    y: yClamp,
    goalX: player.x,
    goalY: player.y,
    w: t.w,
    h: t.h,
    vx: 0,
    vy: 0,
    hp: t.hp,
    maxHp: t.hp,
    damageMultiplier: 1,
    speed: t.speed,
    color: t.color,
    grounded: false,
    fly: false,
    jumpVel: 0,
    jumpCooldown: 0,
    dir,
    stunFrames: 0,
    landingFrames: 0,
  });
}

function updateEnemy(e, dt) {
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
    const exCenter = e.x + e.w / 2;
    const eyCenter = e.y + e.h / 2;
    const pxCenter = player.x + player.w / 2;
    const pyCenter = player.y + player.h / 2;
    let dx = pxCenter - exCenter;
    let dy = pyCenter - eyCenter;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    e.dir = dx > 0 ? 1 : -1;
    const targetVx = dx * e.speed;
    const targetVy = dy * e.speed;
    const flyLerp = 0.32;
    e.vx += (targetVx - e.vx) * flyLerp;
    e.vy += (targetVy - e.vy) * flyLerp;
    e.x += e.vx;
    e.y += e.vy;
    resolvePlatform(e, e.w, e.h);
    e.x = Math.max(0, Math.min(ARENA_WIDTH - e.w, e.x));
    e.y = Math.max(24, Math.min(ARENA_HEIGHT - e.h - 24, e.y));
  } else {
    e.dir = player.x > e.x ? 1 : -1;
    e.vy += GRAVITY;
    if (e.vy > TERMINAL_VELOCITY) e.vy = TERMINAL_VELOCITY;
    e.x += e.vx;
    e.y += e.vy;
    e.grounded = resolvePlatform(e, e.w, e.h);

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
    const atLeftEdge = onPlat && e.x <= platformLeft(e) + 2;
    const atRightEdge = onPlat && e.x + e.w >= platformRight(e) - 2;
    // Игрок ниже — не разворачиваемся у края, сходим с платформы (не застреваем)
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
      // Игрок выше — прыгаем на платформы; у края — прыгаем чтобы не застрять
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
    } else if (e.type === "big" || e.type === "boss") {
      const targetVx = e.dir * e.speed;
      e.vx += (targetVx - e.vx) * 0.12;
      if (
        shouldTurnAtEdge &&
        ((atLeftEdge && e.dir < 0) || (atRightEdge && e.dir > 0))
      )
        e.dir *= -1;
    }

    e.vx *= 0.92;
    e.x = Math.max(0, Math.min(ARENA_WIDTH - e.w, e.x));
    e.y = Math.max(0, Math.min(ARENA_HEIGHT - e.h, e.y));
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
      player.hp -= dmg * (dt / 60);
      player.knockbackVx = player.x < e.x ? -6 : 6;
      const enemyKnockback = 1.5;
      e.vx += player.x < e.x ? enemyKnockback : -enemyKnockback;
      onPlayerHit();
    }
  }
}

function platformLeft(e) {
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
function platformRight(e) {
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

const UPGRADE_LIST = [
  { id: "damage", label: "+10% урона атаки" },
  { id: "speed", label: "+10% скорости" },
  { id: "cooldown", label: "−1 сек КД способностей", maxPicks: 2 },
  { id: "regen", label: "+0.2% maxHP/сек регенерации", maxPicks: 5 },
  { id: "maxHp", label: "+10% макс. здоровья" },
];

function applyUpgrade(id) {
  playPickUpgradeSound();
  if (id === "cooldown") {
    if ((player.cooldownReductions || 0) < 2)
      player.cooldownReductions = (player.cooldownReductions || 0) + 1;
  } else if (player.upgrades[id] !== undefined) {
    player.upgrades[id]++;
  }
  if (id === "maxHp") {
    player.maxHp = Math.round(
      player.baseMaxHp * Math.pow(1.1, player.upgrades.maxHp)
    );
  }
  showUpgradeScreen = false;
  document.getElementById("upgradeScreen").classList.remove("visible");
  waveCount++;
  hudKillWavePulseFrames = HUD_COUNTER_PULSE_FRAMES;
  waveEnemiesSpawned = 0;
  waveEnemiesTarget = Math.max(
    WAVE_1_ENEMY_COUNT,
    Math.round(
      WAVE_1_ENEMY_COUNT * Math.pow(WAVE_SCALE_PER_WAVE, waveCount - 1)
    )
  );
  waveAnnounceFrames = WAVE_ANNOUNCE_FRAMES;
  playWaveSound();
}

function openUpgradeScreen() {
  const container = document.getElementById("upgradeButtons");
  container.innerHTML = "";
  let pool = UPGRADE_LIST.filter((u) => {
    if (u.id === "cooldown")
      return (player.cooldownReductions || 0) < (u.maxPicks || 999);
    if (u.id === "regen")
      return (player.upgrades.regen || 0) < (u.maxPicks || 999);
    return true;
  });
  pool = [...pool].sort(() => Math.random() - 0.5).slice(0, 3);
  pool.forEach((u) => {
    const btn = document.createElement("button");
    btn.textContent = u.label;
    btn.onclick = () => applyUpgrade(u.id);
    container.appendChild(btn);
  });
  document.getElementById("upgradeScreen").classList.add("visible");
  playUpgradeSound();
}

function getBloodAt(x, y) {
  let sum = 0;
  bloodPools.forEach((p) => {
    const d = Math.hypot(x - p.x, y - p.y);
    if (d < p.r) sum += p.alpha * (1 - d / p.r);
  });
  return Math.min(1, sum);
}

let lastTime = performance.now();
function loop(now) {
  const dt = Math.min(2, (now - lastTime) / 16.67);
  lastTime = now;
  const dt60 = dt * 60;

  if (gameOver) {
    requestAnimationFrame(loop);
    return;
  }

  if (showUpgradeScreen) {
    if (!upgradeScreenOpened) {
      openUpgradeScreen();
      upgradeScreenOpened = true;
    }
    requestAnimationFrame(loop);
    return;
  }

  if (hitPauseFrames > 0) {
    hitPauseFrames--;
    if (cameraShakeFrames > 0) cameraShakeFrames--;
    if (player.hurtFlashFrames > 0) player.hurtFlashFrames--;
    draw();
    requestAnimationFrame(loop);
    return;
  }

  gameTime += dt60;

  ensurePlatformsUpTo(cameraX + W);

  if (player.dashFrames > 0) {
    if (dashTrail.length < 8)
      dashTrail.push({ x: player.x, y: player.y, alpha: 0.6 });
    player.dashFrames--;
    player.x += player.dashDir * DASH_SPEED;
    player.x = Math.max(0, Math.min(ARENA_WIDTH - player.w, player.x));
    if (player.dashFrames === 0) {
      player.vx = player.dashDir * DASH_EXIT_SPEED;
    }
  } else {
    dashTrail = [];
    if (player.dashCooldown > 0) player.dashCooldown--;

    const left = keys.KeyA || keys.ArrowLeft;
    const right = keys.KeyD || keys.ArrowRight;
    if (left && !right) player.facing = -1;
    if (right && !left) player.facing = 1;

    if (keys.KeyW) {
      tryJump();
      tryWallJump();
    }
    if (!player.grounded && keys.KeyS && player.groundPoundCooldown <= 0)
      player.groundPound = true;
    if (player.grounded) player.groundPound = false;
    if (keys.ShiftLeft) tryDash();
    if (keys.Space) tryMelee();

    const accel = (left && !right ? -1 : right && !left ? 1 : 0) * RUN_ACCEL;
    const maxSp = runSpeed();
    player.vx += accel;
    player.vx += player.knockbackVx;
    player.knockbackVx *= 0.7;
    if (Math.abs(player.vx) > maxSp) player.vx = player.vx > 0 ? maxSp : -maxSp;

    const blood = getBloodAt(player.x + player.w / 2, player.y + player.h);
    const friction = player.grounded
      ? blood > 0.25
        ? 0.92
        : GROUND_FRICTION
      : AIR_FRICTION;
    player.vx *= friction;
    player.vy += GRAVITY;
    if (player.groundPound)
      player.vy += GRAVITY * (GROUND_POUND_GRAVITY_MUL - 1);
    const maxFall = player.groundPound
      ? TERMINAL_VELOCITY * 2.5
      : TERMINAL_VELOCITY;
    if (player.vy > maxFall) player.vy = maxFall;

    if (player.grounded && (player.wallSlideLeft || player.wallSlideRight)) {
      player.vy = Math.min(player.vy, WALL_SLIDE_SPEED);
    }

    player.x += player.vx;
    player.y += player.vy;
    player.x = Math.max(0, Math.min(ARENA_WIDTH - player.w, player.x));
    player.y = Math.max(0, Math.min(ARENA_HEIGHT - player.h, player.y));

    const fallVy = player.vy;

    const wasGrounded = player.grounded;
    player.wallSlideLeft = false;
    player.wallSlideRight = false;
    if (!player.grounded && (left || right)) {
      const step = 4;
      const checkX = player.x + (left ? -step : player.w + step);
      if (platformCollide(checkX, player.y, player.w, player.h)) {
        if (left) player.wallSlideLeft = true;
        else player.wallSlideRight = true;
      }
    }

    player.grounded = resolvePlatform(player, player.w, player.h);

    if (player.grounded && !wasGrounded) {
      if (player.groundPound) {
        const cx = player.x + player.w / 2;
        const cy = player.y + player.h;
        enemies.forEach((e) => {
          const ex = e.x + e.w / 2,
            ey = e.y + e.h / 2;
          const d = Math.hypot(ex - cx, ey - cy);
          if (d < GROUND_POUND_RADIUS) {
            const bossMult = player.bossBuffFrames > 0 ? 1.1 : 1;
            damageEnemy(e, GROUND_POUND_DAMAGE * bossMult);
            if (e.hp <= 0) spawnGore(e.x + e.w / 2, e.y + e.h / 2, e.w);
          }
        });
        spawnGroundPoundEffect(cx, cy);
        const shakeScale = GROUND_POUND_RADIUS / 60; // тряска синхронна с радиусом
        cameraShakeFrames = Math.max(
          cameraShakeFrames,
          Math.round(12 * shakeScale)
        );
        cameraShakeStrength = Math.max(cameraShakeStrength, 3 * shakeScale);
        platformShakeFrames = Math.round(10 * shakeScale);
        player.groundPoundLandingFrames = GROUND_POUND_LANDING_FRAMES;
        player.groundPoundCooldown = getGroundPoundCooldown();
        playGroundPoundSound();
      } else if (fallVy >= LANDING_DUST_VEL) {
        spawnLandingDust(player.x + player.w / 2, player.y + player.h);
        platformShakeFrames = 6;
        const under = platforms.find(
          (p) =>
            player.x + player.w > p.x &&
            player.x < p.x + p.w &&
            player.y + player.h >= p.y - 2 &&
            player.y + player.h <= p.y + p.h
        );
        if (under) under.shakeFrames = 8;
      }
      player.groundPound = false;
    }
    player.previousVy = player.vy;
  }

  if (player.meleeFrames > 0) {
    player.meleeFrames = Math.max(0, player.meleeFrames - MELEE_ANIM_SPEED);
    if (player.meleeFrames === 0) {
      if (player.comboResetAfterSwing) {
        player.comboStacks = 0;
        player.comboResetAfterSwing = false;
      }
      if (meleeTrail.length > 0) {
        attackTrail = meleeTrail.map((p) => ({ x: p.x, y: p.y, alpha: 0.85 }));
        meleeTrail = [];
      }
    }
    const hitFrameCrossed =
      player.meleeFrames <= MELEE_HIT_AT_FRAME &&
      player.meleeFrames + MELEE_ANIM_SPEED > MELEE_HIT_AT_FRAME;
    if (hitFrameCrossed) {
      const facing = player.attackFacing ?? player.facing;
      const comboMult = 1 + (player.comboStacks || 0) * COMBO_RADIUS_PER_STACK;
      const hitLen = Math.min(
        MELEE_MAX_LENGTH,
        Math.round(35 * MELEE_LENGTH_SCALE * comboMult)
      );
      const cx = player.x + player.w / 2;
      const cy = player.y + player.h / 2;
      const progressHit = 1 - MELEE_HIT_AT_FRAME / MELEE_ANIM_FRAMES;
      const angleHit =
        player.meleeVariant === MELEE_TOP_DOWN
          ? -Math.PI / 2 + progressHit * Math.PI
          : Math.PI / 2 - progressHit * Math.PI;
      const ax = facing * Math.cos(angleHit);
      const ay = Math.sin(angleHit);
      const tipX = cx + ax * hitLen;
      const tipY = cy + ay * hitLen;
      const hitCx = (cx + tipX) / 2;
      const hitCy = (cy + tipY) / 2;
      let hitSomething = false;
      enemies.forEach((e) => {
        const ex = e.x + e.w / 2;
        const ey = e.y + e.h / 2;
        const t = (ex - cx) * ax + (ey - cy) * ay;
        if (t < 0 || t > hitLen) return;
        const projX = cx + ax * t;
        const projY = cy + ay * t;
        const dist = Math.hypot(ex - projX, ey - projY);
        const margin =
          e.type === "boss" ? MELEE_HIT_MARGIN_BOSS : MELEE_HIT_MARGIN;
        if (dist >= margin) return;
        damageEnemy(e, meleeDamage(), { x: ax, y: ay });
        hitSomething = true;
      });
      if (hitSomething) {
        spawnMeleeHitParticles(
          player.meleeVariant,
          hitCx,
          hitCy,
          Math.atan2(ay, ax)
        );
        hitPauseFrames = HIT_PAUSE_FRAMES;
        cameraShakeBiasX = ax * 3;
        cameraShakeBiasY = ay * 3;
        cameraShakeBiasFrames = 6;
        if (player.meleeVariant === MELEE_BOTTOM_UP && player.grounded) {
          const under = platforms.find(
            (p) =>
              player.x + player.w > p.x &&
              player.x < p.x + p.w &&
              player.y + player.h >= p.y - 2 &&
              player.y + player.h <= p.y + p.h
          );
          if (under)
            spawnBottomUpDustFromPlatform(player.x + player.w / 2, under.y);
        }
        player.meleeHitFlash = Math.round(12 * MELEE_THICKNESS_SCALE);
      } else {
        spawnMissEffect(hitCx, hitCy, player.grounded);
      }
    }
  }
  if (player.meleeCooldown > 0)
    player.meleeCooldown = Math.max(0, player.meleeCooldown - MELEE_ANIM_SPEED);
  if (player.meleeFrames <= 0) player.comboFrames++;
  if (player.groundPoundCooldown > 0) player.groundPoundCooldown--;

  for (let i = 0; i < attackTrail.length; i++) {
    attackTrail[i].alpha -= 0.032;
  }
  attackTrail = attackTrail.filter((p) => p.alpha > 0);

  if (player.upgrades.regen > 0) {
    player.regenAccumulatorMs = (player.regenAccumulatorMs || 0) + dt * 1000;
    if (player.regenAccumulatorMs >= 1000) {
      const heal = player.maxHp * 0.002 * player.upgrades.regen;
      player.hp = Math.min(player.hp + heal, player.maxHp);
      player.regenAccumulatorMs -= 1000;
    }
  }
  if (player.bossBuffFrames > 0) player.bossBuffFrames--;

  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    const px = p.x + p.w / 2;
    const py = p.y + p.h / 2;
    const overlap =
      player.x + player.w > p.x &&
      player.x < p.x + p.w &&
      player.y + player.h > p.y &&
      player.y < p.y + p.h;
    if (overlap && p.type === "giant_bone") {
      player.bossBuffFrames = BOSS_BUFF_FRAMES;
      pickups.splice(i, 1);
    }
  }

  updateWaveSpawn();
  enemies.forEach((e) => updateEnemy(e, dt60));

  if (!particles || !Array.isArray(particles)) particles = [];
  const REST_FRAMES_MIN = 60;
  const REST_FRAMES_MAX = 120;
  particles = particles.filter((p) => {
    if (p.grounded) {
      p.restLife = (p.restLife ?? 0) - 1;
      return p.restLife > 0;
    }
    p.x += p.vx;
    p.y += p.vy;
    p.vy += GRAVITY * 0.5;
    p.vx *= 0.98;
    const r = p.r != null ? p.r : 3;
    const groundY = getGroundY(p.x);
    if (p.y + r >= groundY) {
      p.y = groundY - r;
      p.vy = 0;
      p.vx *= 0.3;
      p.grounded = true;
      p.restLife =
        REST_FRAMES_MIN +
        Math.floor(Math.random() * (REST_FRAMES_MAX - REST_FRAMES_MIN + 1));
      p.maxRestLife = p.restLife;
      return true;
    }
    p.life = (p.life != null ? p.life : 30) - 1;
    return p.life > 0;
  });

  bloodPools.forEach((p) => {
    p.alpha = Math.max(0, p.alpha - BLOOD_POOL_DECAY);
  });
  bloodPools = bloodPools.filter((p) => p.alpha > 0.05);

  corpses.forEach((c) => {
    c.alpha = Math.max(0, c.alpha - c.decay);
  });
  corpses = corpses.filter((c) => c.alpha > 0.05);

  cameraTargetX = player.x - W / 3;
  cameraTargetX = Math.max(0, Math.min(cameraTargetX, ARENA_WIDTH - W));
  cameraTargetY = player.y - H / 2;
  cameraTargetY = Math.max(0, Math.min(cameraTargetY, ARENA_HEIGHT - H));
  cameraX += (cameraTargetX - cameraX) * CAMERA_LAG;
  cameraY += (cameraTargetY - cameraY) * CAMERA_LAG;
  if (player.groundPoundLandingFrames > 0) player.groundPoundLandingFrames--;
  if (cameraShakeFrames > 0) cameraShakeFrames--;
  if (cameraShakeBiasFrames > 0) cameraShakeBiasFrames--;
  if (platformShakeFrames > 0) platformShakeFrames--;
  if (player.meleeHitFlash > 0) player.meleeHitFlash--;
  platforms.forEach((p) => {
    if (p.shakeFrames > 0) p.shakeFrames--;
  });
  if (player.hurtFlashFrames > 0) player.hurtFlashFrames--;

  if (player.hp <= 0 || player.y < -50 || player.y > ARENA_HEIGHT + 50) {
    gameOver = true;
    if (player.y > ARENA_HEIGHT + 50 || player.y < -50) {
      cameraShakeFrames = 8;
      cameraShakeStrength = 2;
      playHitSound();
    }
    document.getElementById("gameOver").classList.add("visible");
    document.getElementById("finalKills").textContent = kills;
  }

  draw();
  requestAnimationFrame(loop);
}

function draw() {
  const shake = getCameraShakeOffset();
  const cx = -cameraX + shake.x;
  const cy = -cameraY + shake.y;

  ctx.save();
  ctx.translate(cx, cy);

  ctx.fillStyle = "#0d0a0a";
  ctx.fillRect(cameraX - 60, cameraY - 60, W + 120, H + 120);

  ctx.fillStyle = "#1a1815";
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
  ctx.fillStyle = "#3a3530";
  ctx.fillRect(0, 0, 24, ARENA_HEIGHT);
  ctx.fillRect(ARENA_WIDTH - 24, 0, 24, ARENA_HEIGHT);
  ctx.fillRect(0, 0, ARENA_WIDTH, 24);
  ctx.fillRect(0, ARENA_HEIGHT - 24, ARENA_WIDTH, 24);

  ctx.fillStyle = "#252018";
  ctx.fillRect(0, FLOOR_Y, ARENA_WIDTH, FLOOR_HEIGHT);
  ctx.strokeStyle = "#4a4035";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, FLOOR_Y, ARENA_WIDTH, FLOOR_HEIGHT);

  PORTAL_POSITIONS.forEach((port) => {
    if (port.x + PORTAL_W < cameraX - 50 || port.x > cameraX + W + 50) return;
    if (port.y + PORTAL_H < cameraY - 50 || port.y > cameraY + H + 50) return;
    ctx.fillStyle = "#1a0a15";
    ctx.fillRect(port.x, port.y, PORTAL_W, PORTAL_H);
    ctx.strokeStyle = "#6a2060";
    ctx.lineWidth = 3;
    ctx.strokeRect(port.x, port.y, PORTAL_W, PORTAL_H);
    ctx.fillStyle = "rgba(120, 40, 100, 0.4)";
    ctx.fillRect(port.x + 4, port.y + 4, PORTAL_W - 8, PORTAL_H - 8);
  });

  bloodPools.forEach((p) => {
    if (p.x + p.r < cameraX - 50 || p.x - p.r > cameraX + W + 50) return;
    if (p.y + p.r < cameraY - 50 || p.y - p.r > cameraY + H + 50) return;
    ctx.fillStyle = `rgba(80, 10, 10, ${p.alpha * 0.55})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  });

  corpses.forEach((c) => {
    if (c.x + c.w < cameraX - 50 || c.x > cameraX + W + 50) return;
    if (c.y + c.h < cameraY - 50 || c.y > cameraY + H + 50) return;
    ctx.fillStyle = `rgba(60, 20, 15, ${c.alpha})`;
    ctx.fillRect(c.x, c.y, c.w, c.h);
  });

  platforms.forEach((p) => {
    if (p.isFloor) return;
    if (p.x + p.w < cameraX - 50 || p.x > cameraX + W + 50) return;
    if (p.y + p.h < cameraY - 50 || p.y > cameraY + H + 50) return;
    const shake =
      p.shakeFrames > 0 ? (Math.random() - 0.5) * 2 * (p.shakeFrames / 8) : 0;
    const py = p.y + shake;
    ctx.fillStyle = "#2a2520";
    ctx.fillRect(p.x, py, p.w, p.h);
    ctx.strokeStyle = "#4a4035";
    ctx.lineWidth = 2;
    ctx.strokeRect(p.x, py, p.w, p.h);
  });

  const ENEMY_HP_BAR_W = 28;
  const ENEMY_HP_BAR_H = 4;
  enemies.forEach((e) => {
    if (e.x + e.w < cameraX - 50 || e.x > cameraX + W + 50) return;
    if (e.y + e.h < cameraY - 50 || e.y > cameraY + H + 50) return;
    ctx.fillStyle = e.color;
    ctx.fillRect(e.x, e.y, e.w, e.h);
    if (e.stunFrames > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${
        (e.stunFrames / ENEMY_STUN_FRAMES) * 0.5
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
    if (ENEMY_TYPES[e.type] && ENEMY_TYPES[e.type].fly) {
      const ex = e.x + e.w / 2;
      const ey = e.y - 12;
      const dx = player.x + player.w / 2 - ex;
      const dy = player.y + player.h / 2 - ey;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const ax = ex + ux * 14;
      const ay = ey + uy * 14;
      const wing = 6;
      const lx = ax - ux * 8 - uy * wing;
      const ly = ay - uy * 8 + ux * wing;
      const rx = ax - ux * 8 + uy * wing;
      const ry = ay - uy * 8 - ux * wing;
      ctx.fillStyle = "rgba(255, 180, 80, 0.9)";
      ctx.beginPath();
      ctx.moveTo(ex + ux * 4, ey + uy * 4);
      ctx.lineTo(lx, ly);
      ctx.lineTo(ax, ay);
      ctx.lineTo(rx, ry);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 220, 120, 0.8)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  });

  pickups.forEach((p) => {
    if (p.x + p.w < cameraX - 50 || p.x > cameraX + W + 50) return;
    if (p.y + p.h < cameraY - 50 || p.y > cameraY + H + 50) return;
    if (p.type === "giant_bone") {
      ctx.fillStyle = "#c4a574";
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeStyle = "#8a7048";
      ctx.lineWidth = 2;
      ctx.strokeRect(p.x, p.y, p.w, p.h);
      ctx.font = "10px Courier New";
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Кость", p.x + p.w / 2, p.y + p.h / 2);
    }
  });

  dashTrail.forEach((t, i) => {
    const a = t.alpha * (1 - i / dashTrail.length) * 0.5;
    if (a <= 0) return;
    ctx.fillStyle = `rgba(255, 120, 60, ${a})`;
    ctx.fillRect(t.x, t.y, player.w, player.h);
  });

  const flash =
    player.hurtFlashFrames > 0 ? player.hurtFlashFrames / HURT_FLASH_FRAMES : 0;
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
    const t = 1 - player.groundPoundLandingFrames / GROUND_POUND_LANDING_FRAMES;
    const r = GROUND_POUND_RADIUS * t; // визуал ударной волны = радиус AoE
    const alpha = 0.5 * (1 - t);
    ctx.strokeStyle = `rgba(255, 180, 80, ${alpha})`;
    ctx.lineWidth = Math.max(6, 4 * (GROUND_POUND_RADIUS / 60)); // толщина синхронна с радиусом
    ctx.beginPath();
    ctx.arc(player.x + player.w / 2, player.y + player.h, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  const comboMultStick = 1 + (player.comboStacks || 0) * COMBO_RADIUS_PER_STACK;
  const stickLen = Math.min(
    MELEE_MAX_LENGTH,
    Math.round(35 * MELEE_LENGTH_SCALE * comboMultStick)
  );
  const gripX = player.x + player.w / 2;
  const gripY = player.y + player.h / 2;

  if (player.meleeFrames > 0) {
    const totalFrames = MELEE_ANIM_FRAMES;
    const progress = 1 - player.meleeFrames / totalFrames;
    const facing = player.attackFacing ?? player.facing;
    const angle =
      player.meleeVariant === MELEE_TOP_DOWN
        ? -Math.PI / 2 + progress * Math.PI
        : Math.PI / 2 - progress * Math.PI;
    const tipX = gripX + facing * stickLen * Math.cos(angle);
    const tipY = gripY + stickLen * Math.sin(angle);

    const isCombo = (player.comboStacks || 0) > 0;
    const hitboxAlpha = 0.2 + (isCombo ? 0.15 : 0);
    const hitboxColor = isCombo ? "rgba(255, 200, 80," : "rgba(255, 120, 60,";
    const coneW = MELEE_HIT_MARGIN * 0.8;
    const conePerpX = -Math.sin(angle) * coneW;
    const conePerpY = facing * Math.cos(angle) * coneW;
    ctx.beginPath();
    ctx.moveTo(gripX, gripY);
    ctx.lineTo(tipX + conePerpX, tipY + conePerpY);
    ctx.lineTo(tipX - conePerpX, tipY - conePerpY);
    ctx.closePath();
    ctx.fillStyle = hitboxColor + hitboxAlpha + ")";
    ctx.fill();
    ctx.strokeStyle = hitboxColor + (hitboxAlpha + 0.1) + ")";
    ctx.lineWidth = 2;
    ctx.stroke();

    if (meleeTrail.length < 16) meleeTrail.push({ x: tipX, y: tipY });
    meleeTrail.forEach((p, i) => {
      const a = (1 - i / meleeTrail.length) * 0.35;
      if (a <= 0) return;
      ctx.fillStyle = `rgba(255, 160, 80, ${a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    const alpha = 0.5 + progress * 0.5;
    const bladeHalfW = 6;
    const bladePerpX = -Math.sin(angle) * bladeHalfW;
    const bladePerpY = facing * Math.cos(angle) * bladeHalfW;
    ctx.beginPath();
    ctx.moveTo(gripX - bladePerpX, gripY - bladePerpY);
    ctx.lineTo(gripX + bladePerpX, gripY + bladePerpY);
    ctx.lineTo(tipX + bladePerpX, tipY + bladePerpY);
    ctx.lineTo(tipX - bladePerpX, tipY - bladePerpY);
    ctx.closePath();
    const bladeColor = isCombo
      ? `rgba(255, 220, 120, ${alpha * 0.9})`
      : player.meleeVariant === MELEE_TOP_DOWN
      ? `rgba(255, 180, 90, ${alpha * 0.85})`
      : `rgba(255, 120, 60, ${alpha * 0.85})`;
    ctx.fillStyle = bladeColor;
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 200, 120, ${alpha})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(gripX, gripY);
    ctx.lineTo(tipX, tipY);
    ctx.strokeStyle = `rgba(255, 220, 150, ${alpha * 0.9})`;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.stroke();

    if (player.meleeHitFlash > 0) {
      const glow =
        player.meleeHitFlash / Math.round(12 * MELEE_THICKNESS_SCALE);
      ctx.fillStyle = `rgba(255, 230, 180, ${glow})`;
      ctx.beginPath();
      ctx.arc(tipX, tipY, 10 + glow * 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  attackTrail.forEach((p, i) => {
    if (p.alpha <= 0) return;
    const a = p.alpha * (1 - i / Math.max(1, attackTrail.length)) * 0.5;
    ctx.fillStyle = `rgba(255, 140, 60, ${a})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  if (particles && particles.length > 0) {
    particles.forEach((p) => {
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
  }

  ctx.restore();

  if (hudCtx) {
    hudCtx.clearRect(0, 0, W, H);

    if (hudKillWavePulseFrames > 0) {
      hudKillWavePulseFrames--;
      const elapsed = HUD_COUNTER_PULSE_FRAMES - hudKillWavePulseFrames;
      if (elapsed <= HUD_COUNTER_PULSE_GROW_FRAMES) {
        hudCounterScale = 1 + 0.2 * (elapsed / HUD_COUNTER_PULSE_GROW_FRAMES);
      } else {
        const t =
          (elapsed - HUD_COUNTER_PULSE_GROW_FRAMES) /
          HUD_COUNTER_PULSE_GROW_FRAMES;
        const easeOut = 1 - (1 - t) * (1 - t);
        hudCounterScale = 1.2 - 0.2 * easeOut;
      }
    } else {
      hudCounterScale = 1;
    }

    hudCtx.textAlign = "center";
    hudCtx.textBaseline = "top";
    hudCtx.font = "14px Courier New";
    hudCtx.shadowColor = "rgba(0,0,0,0.9)";
    hudCtx.shadowBlur = 4;
    hudCtx.shadowOffsetX = 1;
    hudCtx.shadowOffsetY = 1;
    hudCtx.fillStyle = "#fff";
    const pivotX = W / 2;
    const pivotY = 20;
    hudCtx.save();
    hudCtx.translate(pivotX, pivotY);
    hudCtx.scale(hudCounterScale, hudCounterScale);
    hudCtx.translate(-pivotX, -pivotY);
    hudCtx.fillText("Убийства: " + kills, W / 2, 12);
    hudCtx.fillText("Волна: " + waveCount, W / 2, 28);
    hudCtx.restore();
    hudCtx.shadowBlur = 0;
    hudCtx.shadowOffsetX = 0;
    hudCtx.shadowOffsetY = 0;

    const hx = 16,
      hy = 12,
      hw = 220,
      hh = 16;
    hudCtx.fillStyle = "rgba(0,0,0,0.6)";
    hudCtx.fillRect(hx - 2, hy - 2, hw + 4, hh + 4);
    hudCtx.strokeStyle = "#cc2222";
    hudCtx.lineWidth = 2;
    hudCtx.strokeRect(hx - 2, hy - 2, hw + 4, hh + 4);
    hudCtx.fillStyle = "#440000";
    hudCtx.fillRect(hx, hy, hw, hh);
    hudCtx.fillStyle = "#cc2222";
    hudCtx.fillRect(hx, hy, hw * Math.max(0, player.hp / player.maxHp), hh);
    if (player.upgrades.regen > 0 && player.regenAccumulatorMs != null) {
      const regenProgress = Math.min(
        1,
        (player.regenAccumulatorMs || 0) / 1000
      );
      const regenBarY = hy + hh + 2;
      const regenBarH = 3;
      hudCtx.fillStyle = "rgba(80, 40, 20, 0.8)";
      hudCtx.fillRect(hx, regenBarY, hw, regenBarH);
      hudCtx.fillStyle = "rgba(255, 180, 80, 0.5 + 0.4 * regenProgress)";
      hudCtx.fillRect(hx, regenBarY, hw * regenProgress, regenBarH);
    }
    hudCtx.font = "bold 11px Courier New";
    hudCtx.fillStyle = "#ffdd88";
    hudCtx.textAlign = "left";
    hudCtx.textBaseline = "top";
    hudCtx.fillText("HP", hx, hy - 12);

    const ay = hy + hh + (player.upgrades.regen > 0 ? 14 : 8),
      aw = hw,
      ah = 8;
    hudCtx.fillStyle = "rgba(0,0,0,0.6)";
    hudCtx.fillRect(hx - 2, ay - 2, aw + 4, ah + 4);
    hudCtx.strokeStyle = "#888";
    hudCtx.lineWidth = 1;
    hudCtx.strokeRect(hx - 2, ay - 2, aw + 4, ah + 4);
    const attackReady = player.meleeCooldown <= 0;
    const comboActive = player.comboFrames < COMBO_WINDOW_FRAMES;
    const attackFill = attackReady
      ? 1
      : 1 - player.meleeCooldown / MELEE_COOLDOWN_FRAMES;
    hudCtx.fillStyle = comboActive
      ? "rgba(255, 180, 60, 0.9)"
      : "rgba(80, 80, 80, 0.8)";
    hudCtx.fillRect(hx, ay, aw, ah);
    hudCtx.fillStyle = comboActive
      ? "rgba(255, 220, 100, 0.95)"
      : "rgba(200, 120, 60, 0.9)";
    hudCtx.fillRect(hx, ay, aw * attackFill, ah);
    if (comboActive) {
      hudCtx.strokeStyle = "rgba(255, 200, 80, 0.8)";
      hudCtx.lineWidth = 2;
      hudCtx.strokeRect(hx, ay - 2, aw + 4, ah + 4);
    }
    hudCtx.font = "10px Courier New";
    hudCtx.fillStyle = "#ccc";
    hudCtx.fillText(attackReady ? "Атака готова" : "КД атаки", hx, ay + ah + 2);

    const bonesY = ay + ah + 18;
    hudCtx.fillStyle = "#e8dcc8";
    hudCtx.font = "11px Courier New";
    hudCtx.fillText("Кости: " + bonesCount, hx, bonesY);
  }

  const buffsEl = document.getElementById("buffsPanel");
  if (buffsEl) {
    const lines = [];
    lines.push("×2 атака");
    if ((player.upgrades.regen || 0) > 0)
      lines.push("Реген " + (player.upgrades.regen * 0.2).toFixed(1) + "%");
    if (player.comboFrames < COMBO_WINDOW_FRAMES)
      lines.push("Радиус + (комбо)");
    if ((player.upgrades.speed || 0) > 0)
      lines.push("Скорость +" + player.upgrades.speed * 10 + "%");
    if ((player.upgrades.damage || 0) > 0)
      lines.push("Урон +" + player.upgrades.damage * 10 + "%");
    if ((player.upgrades.maxHp || 0) > 0)
      lines.push("Макс. HP +" + player.upgrades.maxHp * 10 + "%");
    if (player.bossBuffFrames > 0) lines.push("Сила босса +10%");
    buffsEl.innerHTML = lines.length ? lines.join("<br>") : "";
    buffsEl.style.display = lines.length ? "block" : "none";
  }

  if (waveAnnounceFrames > 0) {
    const progress = 1 - waveAnnounceFrames / WAVE_ANNOUNCE_FRAMES;
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
  if (od)
    od.style.width =
      (player.dashCooldown > 0
        ? (1 - player.dashCooldown / getDashCooldown()) * 100
        : 100) + "%";
}

document.getElementById("restartBtn").addEventListener("click", () => {
  location.reload();
});

document.getElementById("upgradeScreen").addEventListener("click", (e) => {
  if (e.target.id === "upgradeScreen") showUpgradeScreen = false;
});

function init() {
  initFirstPlatforms();
  player.baseMaxHp = 100;
  player.upgrades = { speed: 0, damage: 0, regen: 0, maxHp: 0 };
  player.cooldownReductions = 0;
  player.maxHp = 100;
  player.hp = player.maxHp;
  player.regenAccumulatorMs = 0;
  player.attackFacing = player.facing;
  kills = 0;
  hudKillWavePulseFrames = 0;
  hudCounterScale = 1;
  waveBossSpawned = false;
  bonesCount = 0;
  pickups = [];
  player.bossBuffFrames = 0;
  attackTrail = [];
  meleeTrail = [];
  enemies = [];
  particles = [];
  bloodPools = [];
  corpses = [];
  cameraX = 0;
  cameraTargetX = 0;
  cameraY = Math.max(0, Math.min(player.y - H / 2, ARENA_HEIGHT - H));
  cameraTargetY = cameraY;
  waveCount = 1;
  waveEnemiesTarget = WAVE_1_ENEMY_COUNT;
  waveEnemiesSpawned = 0;
  waveAnnounceFrames = WAVE_ANNOUNCE_FRAMES;
  wavePauseFrames = 0;
  waveSpawnCooldown = 0;
  waveBonusDelayFrames = -1;
  gameOver = false;
  showUpgradeScreen = false;
  upgradeScreenOpened = false;
  document.getElementById("gameOver").classList.remove("visible");
  document.getElementById("upgradeScreen").classList.remove("visible");
}
init();
requestAnimationFrame(loop);
