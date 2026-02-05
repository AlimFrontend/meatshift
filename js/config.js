/**
 * config.js — баланс и числовые константы (без хардкода в коде).
 */

export const PHYSICS = {
  GRAVITY: 1.0,
  TERMINAL_VELOCITY: 14,
  JUMP_VEL: -28.28,
  DOUBLE_JUMP_VEL: -20,
  RUN_ACCEL: 1.1,
  RUN_MAX: 5.5,
  GROUND_FRICTION: 0.78,
  AIR_FRICTION: 0.96,
};

export const DASH = {
  SPEED: 14,
  FRAMES: 12,
  COOLDOWN: 300,
  EXIT_SPEED: 3,
};

export const WALL = {
  SLIDE_SPEED: 1.2,
  JUMP_VX: 7,
  JUMP_VY: -12,
};

export const GROUND_POUND = {
  GRAVITY_MUL: 3,
  RADIUS: 150,
  DAMAGE: 25,
  LANDING_FRAMES: 18,
  COOLDOWN: 180,
};

export const PLAYER_SIZE = { W: 32, H: 48 };

export const ARENA = {
  WIDTH: 1100,
  HEIGHT_MIN: 1600,
  FLOOR_HEIGHT: 48,
  PORTAL_W: 32,
  PORTAL_H: 56,
};

export const PLATFORM = {
  H: 40,
  MIN_W: 100,
  MAX_W: 220,
  FLOOR_TO_FIRST_RATIO: 0.35,
};

export const WAVE = {
  PAUSE_MIN: 80,
  PAUSE_EXTRA: 70,
  SCALE_PER_WAVE: 1.1,
  FIRST_ENEMY_COUNT: 10,
  BONUS_APPEAR_DELAY: 60,
  ANNOUNCE_FRAMES: 75,
};

export const FEEDBACK = {
  CAMERA_SHAKE_STRENGTH: 3,
  CAMERA_SHAKE_DURATION: 9,
  HIT_PAUSE_FRAMES: 5,
  ENEMY_STUN_FRAMES: 5,
  HURT_FLASH_FRAMES: 6,
};

export const MELEE = {
  TOP_DOWN: 0,
  BOTTOM_UP: 1,
  ANIM_FRAMES: 15,
  HIT_AT_FRAME: 7,
  COOLDOWN_FRAMES: 25,
  LENGTH_SCALE: 1.8,
  THICKNESS_SCALE: 1.35,
  MAX_LENGTH: Math.min(130, PLAYER_SIZE.W * 3.5),
  COMBO_WINDOW_FRAMES: 30,
  COMBO_RADIUS_PER_STACK: 0.4,
  COMBO_MAX_STACKS: 3,
  HIT_MARGIN: 28,
  BASE_DAMAGE: 18,
  KNOCKBACK: 7,
};

export const PARTICLES = {
  LIFETIME: 90,
  MAX_COUNT: 220,
  REST_FRAMES_MIN: 60,
  REST_FRAMES_MAX: 120,
  GRAVITY_MUL: 0.5,
  MELEE_COUNT_MIN: 14,
  MELEE_COUNT_MAX: 24,
  MELEE_LIFE: 18,
  HIT_LIFE: 22,
  LANDING_DUST_VEL: 8,
};

export const DECALS = {
  BLOOD_POOL_DECAY: 0.012,
  CORPSE_DECAY: 0.008,
};

export const ENEMY_LIMIT = 80;

export const ENEMY_TYPES = {
  runner: { hp: 15, w: 28, h: 32, speed: 2.8, color: "#a03030", baseDmg: 8 },
  jumper: {
    hp: 21,
    w: 26,
    h: 36,
    speed: 2.1,
    color: "#805050",
    baseDmg: 8,
    jumpVel: -10,
  },
  flyer: {
    hp: 12,
    w: 24,
    h: 24,
    speed: 0.84,
    color: "#604060",
    baseDmg: 4,
    fly: true,
  },
  big: { hp: 53, w: 40, h: 48, speed: 1.4, color: "#503030", baseDmg: 14 },
};

export const UPGRADE_LIST = [
  { id: "damage", label: "+10% урона атаки" },
  { id: "speed", label: "+10% скорости" },
  { id: "cooldown", label: "−1 сек КД способностей", maxPicks: 2 },
  { id: "regen", label: "+10% maxHP/сек регенерации" },
  { id: "maxHp", label: "+10% макс. здоровья" },
];

export const CAMERA = { LAG: 0.06 };
