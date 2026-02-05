// MEATSHIFT — 2D платформер. Гравитация, прыжки, даш, волны по убийствам. Апгрейды сбрасываются при смерти.

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const W = canvas.width;
const H = canvas.height;

// —— Физика «тяжести» (пиксели/тик, 60 тиков/сек) ——
const GRAVITY = 1.0; // 0.8–1.2
const TERMINAL_VELOCITY = 14; // 12–15
const JUMP_VEL = -28.28; // высота прыжка ×2 (200%) — игрок легко достаёт до первой платформы
const DOUBLE_JUMP_VEL = -20;
const RUN_ACCEL = 1.1;
const RUN_MAX = 5.5;
const GROUND_FRICTION = 0.78;
const AIR_FRICTION = 0.96;
// Dash: +200% длины (в 3 раза длиннее шага), cooldown 6 сек
const DASH_SPEED = 14;
const DASH_FRAMES = 12; // итого ~168 px за рывок
const DASH_COOLDOWN = 300; // 5 сек (60*5), только по кулдауну
const DASH_EXIT_SPEED = 3; // инерция после даша — замедление до полной остановки
const WALL_SLIDE_SPEED = 1.2;
const WALL_JUMP_VX = 7;
const WALL_JUMP_VY = -12;
// Ground Pound (S в воздухе): радиус +150%, AoE ударная волна, частицы/тряска синхронны с радиусом
const GROUND_POUND_GRAVITY_MUL = 3; // ускорение падения ×3
const GROUND_POUND_RADIUS = 150; // было 60, увеличен на 150% (60 + 90)
const GROUND_POUND_DAMAGE = 25;
const GROUND_POUND_LANDING_FRAMES = 18;
const GROUND_POUND_COOLDOWN = 180; // 3 секунды (отдельная способность, не часть атаки)

const PLAYER_W = 32;
const PLAYER_H = 48;
const PLATFORM_H = 40;
const PLATFORM_MIN_W = 100; // достаточно широкие для безопасного приземления
const PLATFORM_MAX_W = 220;
// Один ряд платформ; высота от пола до низа первой платформы = 80% от высоты прыжка
const JUMP_HEIGHT_PX = (JUMP_VEL * JUMP_VEL) / (2 * GRAVITY); // ≈400 при JUMP_VEL=-28.28
const FLOOR_TO_FIRST_PLATFORM = Math.round(0.35 * JUMP_HEIGHT_PX); // платформы ниже (35% высоты прыжка)
const NUM_ROWS = 1; // ТЗ: количество рядов = 1
const CHUNK_WIDTH = 420;
const ARENA_WIDTH = 1100; // пол уже — узкая коробка
const ARENA_HEIGHT = Math.max(H * 2.5, 1600);
const SPAWN_PLATFORM_LIMIT = 10;
const WAVES_BEFORE_EMPTY = 14; // после N волн — пустые платформы (пауза спавна)
const TRAINING_PLATFORMS = 6;
const WAVE_PAUSE_MIN = 80;
const WAVE_PAUSE_EXTRA = 70;
const PARTICLE_LIFETIME = 90; // 1–2 сек, не перегружать
const MAX_PARTICLES = 220;
const LANDING_DUST_VEL = 8; // порог падения для пыли
const BLOOD_POOL_DECAY = 0.012;
const MAX_ENEMIES = 80; // лимит одновременных врагов (волны масштабируются)
const MELEE_KNOCKBACK = 7; // фиксированное отталкивание врага от игрока при ударе
const MELEE_PARTICLE_COUNT_MIN = 14;
const MELEE_PARTICLE_COUNT_MAX = 24;
const MELEE_PARTICLE_LIFE = 18; // быстро исчезают
const BONUS_APPEAR_DELAY = 60; // 1.0 сек после последнего врага до экрана бонусов
const WAVE_ANNOUNCE_FRAMES = 75; // ~1.25 сек показ "ВОЛНА N"
const WAVE_1_ENEMY_COUNT = 10;
const WAVE_SCALE_PER_WAVE = 1.1; // +10% за волну

// —— Фидбэк при уроне ——
const CAMERA_SHAKE_STRENGTH = 3; // 2–4 px
const CAMERA_SHAKE_DURATION = 9; // ~0.15 сек
const HIT_PAUSE_FRAMES = 5; // hit-stop 0.05–0.1 сек при попадании
const ENEMY_STUN_FRAMES = 5; // 0.05–0.1 сек
const HURT_FLASH_FRAMES = 6; // красный flash
const HIT_PARTICLE_LIFE = 22; // мелкие частицы при ударе по врагу

let cameraX = 0;
let cameraTargetX = 0;
let cameraY = 0;
let cameraTargetY = 0;
const CAMERA_LAG = 0.06; // задержка камеры за игроком (инерция)
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
let goreRemains = [];
let corpses = [];
let dashTrail = [];
let meleeTrail = []; // след оружия при атаке (визуал), макс 8 точек
let waveEnemiesTarget = WAVE_1_ENEMY_COUNT; // сколько врагов в текущей волне
let waveEnemiesSpawned = 0;
let waveAnnounceFrames = WAVE_ANNOUNCE_FRAMES;
let wavePauseFrames = 0;
let waveBonusDelayFrames = -1; // 1 сек задержка перед бонусами после завершения волны (-1 = не активна)

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
  cooldownReductions: 0, // снижение КД способностей, макс 2 за игру
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
  groundPoundCooldown: 0, // КД 3 сек, отдельно от атаки
};

function runSpeed() {
  return RUN_MAX * Math.pow(1.1, player.upgrades.speed);
}
function meleeDamage() {
  return 18 * Math.pow(1.1, player.upgrades.damage);
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

let dashUsesLeft = 1;

// —— Звуки (Web Audio API, процедурные) ——
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

// —— Триггер при уроне игроку: пауза + тряска + flash + звук ——
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

// —— Арена-коробка: ПОЛ (сплошной внизу), СТЕНЫ, ПОТОЛОК, платформы ВНУТРИ, порталы в стенах ——
const FLOOR_HEIGHT = 48;
const FLOOR_Y = ARENA_HEIGHT - FLOOR_HEIGHT;
const PORTAL_W = 32;
const PORTAL_H = 56;

function getPlatformAt(x) {
  return platforms.find((p) => x >= p.x && x < p.x + p.w);
}

function isFloor(p) {
  return p.y >= FLOOR_Y - 2 && p.y <= FLOOR_Y + 2 && p.w >= ARENA_WIDTH - 10;
}

// Уровень пола/платформы в точке x (верх поверхности, на которую падают частицы)
function getGroundY(x) {
  if (!platforms || !platforms.length)
    return typeof FLOOR_Y === "number" ? FLOOR_Y : 0;
  for (const plat of platforms) {
    if (plat.x <= x && x <= plat.x + plat.w) return plat.y;
  }
  return FLOOR_Y;
}

const PORTAL_POSITIONS = [];

// Один ряд платформ: 2–3 штуки, равномерно по X; высота = 80% прыжка от пола; между ними зазор для прыжка
function ensurePlatformsUpTo(x) {
  if (worldRight >= ARENA_WIDTH) return;
  const rowY = FLOOR_Y - FLOOR_TO_FIRST_PLATFORM - PLATFORM_H; // низ платформы на 80% прыжка выше пола
  const numPlats = 2 + Math.floor(Math.random() * 2); // 2 или 3
  const segmentWidth = ARENA_WIDTH / (numPlats + 1);
  const minGap = 80; // зазор между платформами — игрок переходит прыжком
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
  // Порталы: уровень пола и уровень единственного ряда платформ
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

// —— Коллизия AABB с платформой (проникновение по минимальной оси) ——
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
      if (penT <= penB) grounded = true; // стоим сверху
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

function getGroundY(x, w) {
  let best = H + 100;
  for (const p of platforms) {
    if (
      x + w > p.x &&
      x < p.x + p.w &&
      p.y < best &&
      p.y >= player.y + player.h - 1
    )
      best = p.y;
  }
  return best;
}

// —— Input ——
window.addEventListener("keydown", (e) => {
  keys[e.code] = true;
  if (e.code === "KeyW" || e.code === "Space") e.preventDefault();
});
window.addEventListener("keyup", (e) => {
  keys[e.code] = false;
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

// —— Прыжок, даш, атака ——
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
  // ТЗ: даш только по кулдауну 5 сек; при КД — ничего не происходит
  if (player.dashCooldown > 0 || player.dashFrames > 0) return;
  player.dashFrames = DASH_FRAMES;
  player.dashDir = player.facing;
  player.dashCooldown = getDashCooldown();
  playDashSound();
  spawnDashParticles(player.x + player.w / 2, player.y + player.h / 2);
}
const MELEE_TOP_DOWN = 0; // взмах сверху вниз
const MELEE_BOTTOM_UP = 1; // взмах снизу вверх
// ТЗ: анимация удара мечом — 15 кадров (~0.25 сек), удар в середине, КД 25 кадров
const MELEE_ANIM_FRAMES = 15;
const MELEE_HIT_AT_FRAME = 7; // середина анимации (кадр 7 из 15)
const MELEE_COOLDOWN_FRAMES = 25;
// Масштаб: длина меча 1.5–2× на замахе, толщина 1.2–1.5×, макс длина ≈2.5–3 ширины игрока (32px)
const MELEE_LENGTH_SCALE = 1.8;
const MELEE_THICKNESS_SCALE = 1.35;
const MELEE_MAX_LENGTH = Math.min(130, PLAYER_W * 3.5);
// Комбо: следующая атака в течение 0.5 сек → +40% радиуса хитбокса, макс 3 стака (+120%). Не влияет на урон и анимацию.
const COMBO_WINDOW_FRAMES = 30; // 0.5 сек при 60 FPS
const COMBO_RADIUS_PER_STACK = 0.4; // +40% за стак
const COMBO_MAX_STACKS = 3;
const MELEE_HIT_MARGIN = 28; // ширина зоны попадания вдоль сегмента атаки

function tryMelee() {
  if (player.meleeCooldown > 0 || player.meleeFrames > 0) return;

  // Направление атаки = направление движения (facing)
  const dir = player.facing;
  player.attackDirX = dir;
  player.attackDirY = 0;
  player.attackAngle = dir > 0 ? 0 : Math.PI;

  if (player.comboFrames > COMBO_WINDOW_FRAMES) player.comboStacks = 0;
  else
    player.comboStacks = Math.min(
      COMBO_MAX_STACKS,
      (player.comboStacks || 0) + 1
    );
  player.comboFrames = 0;

  player.meleeFrames = MELEE_ANIM_FRAMES;
  player.meleeCooldown = MELEE_COOLDOWN_FRAMES;
  player.meleeVariant = player.meleeAlternate
    ? MELEE_BOTTOM_UP
    : MELEE_TOP_DOWN;
  player.meleeAlternate = 1 - player.meleeAlternate;
  playMeleeSwingSound();
}

// —— Лимит частиц (производительность) ——
function addParticle(p) {
  if (!particles || !Array.isArray(particles)) particles = [];
  if (particles.length >= MAX_PARTICLES) particles.shift();
  particles.push(p);
}

// —— Ground Pound: частицы и разброс синхронизированы с радиусом AoE ——
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

// —— Частицы и горе (25–35 за удар/смерть, тянутся вниз гравитацией) ——
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
  const idx = enemies.indexOf(e);
  if (idx !== -1) enemies.splice(idx, 1);
  kills++;
  // Апгрейды только в конце волны (см. проверку wave cleared в loop)
}

// Партиклы вылетают в направлении атаки (attackAngle)
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
    if (knockbackDir) {
      e.vx += knockbackDir.x * MELEE_KNOCKBACK;
      e.vy += knockbackDir.y * MELEE_KNOCKBACK;
    } else {
      e.vx += e.x < player.x ? -MELEE_KNOCKBACK : MELEE_KNOCKBACK;
    }
    e.stunFrames = ENEMY_STUN_FRAMES;
    spawnHitParticles(e.x + e.w / 2, e.y + e.h / 2);
    cameraShakeFrames = Math.max(cameraShakeFrames, 5);
    cameraShakeStrength = Math.max(cameraShakeStrength, 1.5);
  }
}

// ТЗ: базовое здоровье врагов увеличено в 1.5 раза (от него масштабируются волны)
const ENEMY_TYPES = {
  runner: {
    hp: 15,
    w: 28,
    h: 32,
    speed: 2.8, // база ×0.7 (ТЗ: враги на 30% медленнее)
    color: "#a03030",
    big: false,
    baseDmg: 8,
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
  },
  flyer: {
    hp: 12,
    w: 24,
    h: 24,
    speed: 0.84,
    color: "#604060",
    big: false,
    fly: true,
    baseDmg: 4,
  },
  big: {
    hp: 53,
    w: 40,
    h: 48,
    speed: 1.4,
    color: "#503030",
    big: true,
    baseDmg: 14,
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

  // Волна завершена: живых врагов 0, спавн заблокирован. Лечение + задержка 1 сек до бонусов.
  if (waveEnemiesSpawned >= waveEnemiesTarget && enemies.length === 0) {
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

function updateEnemy(e, dt) {
  if (e.stunFrames > 0) {
    e.stunFrames--;
    return;
  }
  const typ = ENEMY_TYPES[e.type];
  if (!typ) return;

  // Цель врага = позиция игрока (всегда идём к игроку, не стоим, не патрулируем)
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
  { id: "regen", label: "+10% maxHP/сек регенерации" },
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
  let pool = UPGRADE_LIST.filter(
    (u) =>
      u.id !== "cooldown" ||
      (player.cooldownReductions || 0) < (u.maxPicks || 999)
  );
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

// —— Кровь под ногами (скольжение) ——
function getBloodAt(x, y) {
  let sum = 0;
  bloodPools.forEach((p) => {
    const d = Math.hypot(x - p.x, y - p.y);
    if (d < p.r) sum += p.alpha * (1 - d / p.r);
  });
  return Math.min(1, sum);
}

// —— Game loop ——
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
    if (keys.Space) tryMelee(); // ТЗ: обычная атака только на ПРОБЕЛ

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
            damageEnemy(e, GROUND_POUND_DAMAGE);
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
    player.meleeFrames--;
    if (player.meleeFrames === 0) meleeTrail = [];
    if (player.meleeFrames === MELEE_HIT_AT_FRAME) {
      const comboMult = 1 + (player.comboStacks || 0) * COMBO_RADIUS_PER_STACK;
      const hitLen = Math.min(
        MELEE_MAX_LENGTH,
        Math.round(70 * MELEE_LENGTH_SCALE * comboMult)
      );
      const cx = player.x + player.w / 2;
      const cy = player.y + player.h / 2;
      const ax = player.attackDirX;
      const ay = player.attackDirY;
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
        if (dist >= MELEE_HIT_MARGIN) return;
        damageEnemy(e, meleeDamage(), { x: ax, y: ay });
        hitSomething = true;
      });
      if (hitSomething) {
        spawnMeleeHitParticles(
          player.meleeVariant,
          hitCx,
          hitCy,
          player.attackAngle
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
  if (player.meleeCooldown > 0) player.meleeCooldown--;
  if (player.meleeFrames <= 0) player.comboFrames++;
  if (player.groundPoundCooldown > 0) player.groundPoundCooldown--;

  if (player.upgrades.regen > 0) {
    player.hp += (player.maxHp * 0.1 * player.upgrades.regen * dt60) / 60;
    player.hp = Math.min(player.hp, player.maxHp);
  }

  updateWaveSpawn();
  enemies.forEach((e) => updateEnemy(e, dt60));

  if (!particles || !Array.isArray(particles)) particles = [];
  // Частицы: летят → падают на пол → лежат 1–2 сек (restLife) → удаляются
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

  goreRemains.forEach((g) => (g.alpha -= 0.006));
  goreRemains = goreRemains.filter((g) => g.alpha > 0.05);

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

  document.getElementById("kills").textContent = kills;
  const speedPct = (runSpeed() / RUN_MAX) * 100;
  document.getElementById("speed").textContent = speedPct.toFixed(0) + "%";
  const dashCdSec = (player.dashCooldown / 60).toFixed(1);
  document.getElementById("overdriveText").textContent =
    player.dashCooldown > 0 ? `Даш КД ${dashCdSec}с` : "Даш готов";

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

  // ТЗ: у каждого врага HP-бар по центру над моделью, фиксированная ширина, виден всегда
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

  const barW = 40;
  ctx.fillStyle = "#330000";
  ctx.fillRect(player.x, player.y - 10, barW, 5);
  ctx.fillStyle =
    player.hp > 50 ? "#22cc22" : player.hp > 25 ? "#ccaa22" : "#cc2222";
  ctx.fillRect(player.x, player.y - 10, barW * (player.hp / player.maxHp), 5);

  if (player.meleeFrames > 0) {
    const totalFrames = MELEE_ANIM_FRAMES;
    const progress = 1 - player.meleeFrames / totalFrames;
    const extendPhase = progress <= 0.5 ? progress * 2 : 1;
    const L = 1 + extendPhase * (MELEE_LENGTH_SCALE - 1);
    const baseLen = 25;
    const tipDist = Math.min(
      MELEE_MAX_LENGTH - player.w,
      Math.round(baseLen * L)
    );
    const cx = player.x + player.w / 2;
    const cy = player.y + player.h / 2;
    const ax = player.attackDirX;
    const ay = player.attackDirY;
    const tipX = cx + ax * tipDist;
    const tipY = cy + ay * tipDist;
    const alpha = 0.5 + progress * 0.5;
    const bladeHalfW = 6;

    if (meleeTrail.length < 8) meleeTrail.push({ x: tipX, y: tipY });
    meleeTrail.forEach((p, i) => {
      const a = (1 - i / meleeTrail.length) * 0.3;
      if (a <= 0) return;
      ctx.fillStyle = `rgba(255, 160, 80, ${a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
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
      player.meleeVariant === MELEE_TOP_DOWN
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
      const glow =
        player.meleeHitFlash / Math.round(12 * MELEE_THICKNESS_SCALE);
      ctx.fillStyle = `rgba(255, 230, 180, ${glow})`;
      ctx.beginPath();
      ctx.arc(tipX, tipY, 10 + glow * 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Частицы — в мировых координатах; на полу рисуем с alpha=1 (видны все 2 сек), в полёте — по life
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

  // ТЗ: перед волной — "ВОЛНА N" на весь экран, крупно, по центру, короткая анимация появления
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
  kills = 0;
  enemies = [];
  particles = [];
  bloodPools = [];
  corpses = [];
  goreRemains = [];
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
