// =================================================
// TUNABLE CONSTANTS
// Change gameplay feel from here without touching logic files.
// =================================================

// ---- dash ----
export const DASH_DISTANCE = 200;
export const DASH_COOLDOWN_MS = 300;

// ---- boss movement / attacks ----
export const BOSS_WALK_SPEED = 4.5;

export const BOSS_MELEE_RANGE = 140;
export const BOSS_MELEE_ANTICIPATE_FRAMES = 22;
export const BOSS_MELEE_LUNGE_FRAMES = 12;
export const BOSS_MELEE_HOLD_FRAMES = 6;
export const BOSS_MELEE_RETURN_FRAMES = 26;
export const BOSS_MELEE_DAMAGE = 26;

export const PLAYER_MELEE_DAMAGE = 22;
export const PLAYER_MELEE_HIT_RADIUS = 70;

export const BOSS_CHARGE_WINDUP_FRAMES = 42;
export const BOSS_CHARGE_DASH_FRAMES = 16;
export const BOSS_CHARGE_SETTLE_FRAMES = 24;
export const BOSS_CHARGE_DISTANCE = 260;
export const BOSS_CHARGE_DAMAGE = 22;

export const BOSS_FIRE_INTERVAL = 55;

export const BOSS_HIT_RADIUS = 50;

// ---- charge blast (SPACE) ----
export const CHARGE_DRAIN_PER_FRAME = 0.004;

// ---- power regen (S) ----
export const POWER_REGEN_PER_FRAME = 0.008;

// ---- fly (Q) / boost (Q + S) ----
export const FLY_EASE = 0.045;
export const FLY_MAX_SPEED = 6;

export const FLY_BOOST_EASE = 0.09;
export const FLY_BOOST_MAX_SPEED = 13;

export const POWER_BOOST_DRAIN_PER_FRAME = 0.006;

// ---- hit feedback (knockback + shake) ----
export const COMBO_HIT_THRESHOLD = 4;
export const COMBO_HIT_WINDOW_MS = 1200;
export const HIGH_DAMAGE_THRESHOLD = 20;

export const KNOCKBACK_FORCE = 30;
export const KNOCKBACK_DECAY = 0.945;

export const BOSS_KNOCKBACK_FORCE = 30;
export const BOSS_HIGH_DAMAGE_THRESHOLD = 20;

export const SHAKE_DURATION_FRAMES = 18;
export const SHAKE_MAGNITUDE = 14;

// ---- boss death / respawn ----
export const BOSS_RESPAWN_DELAY = 900;
export const BOSS_DEATH_PIECE_FADE_RATE = 1 / 150;

// ---- camera ----
export const CAMERA_DEADZONE = 250;

// ---- assets ----
export const LOGO_URL = "https://assets.skool.com/f/0f7f15bc8d494ed0b4bfb968b9a216e4/541fffc1cea14960993a5a8e0658ab60598d9b6c653e411abc475e6338312e3f";
export const BACKGROUND_URL = "https://assets.skool.com/f/0f7f15bc8d494ed0b4bfb968b9a216e4/a66063279a524ad8af777aeece2c3241abd6bbc7a4b84671b827ae91be4ce8d7.png";

// player sprites - static, one image per state
export const PLAYER_IDLE_URL = "assets/player/player-idle.png";
export const PLAYER_FLY_URL = "assets/player/player-fly.png";

// dash-direction sprite - shown while the post-dash smear is
// visible, in place of fly/idle, when dashing away from the
// closer enemy (see player.dashPoseType in state.js)
export const PLAYER_FLY_AWAY_URL = "assets/player/playerflyaway.png";

// click-cycle strike poses - grounded clicks cycle P1->P2->P3,
// airborne clicks cycle K1->K2->K3, each resuming where it left
// off. Shown briefly on click, then reverts to idle/fly.
export const PLAYER_PUNCH_URLS = [
    "assets/player/P1.png",
    "assets/player/P2.png",
    "assets/player/P3.png",
];
export const PLAYER_KICK_URLS = [
    "assets/player/K1.png",
    "assets/player/K2.png",
    "assets/player/K3.png",
];

// how long a punch/kick pose stays on screen before reverting
// back to idle/fly
export const STRIKE_POSE_DURATION_MS = 180;

// visual size multiplier for the player sprite - the hitbox
// (player.width/height in state.js) stays the same so dash
// distance, melee range, etc. don't shift; only the drawn
// image gets bigger, anchored to the bottom-center of the hitbox
export const PLAYER_SPRITE_SCALE = 4;

// if the sprite's transparent padding leaves a gap above the
// ground, nudge the drawn image down by this many px. Doesn't
// touch the hitbox/collision - purely visual.
export const PLAYER_SPRITE_Y_OFFSET = 8;

// if the two bosses are within this many px of equally close,
// treat it as a tie and face whichever side the mouse is on
// instead of arbitrarily picking one
export const PLAYER_FACING_TIE_THRESHOLD = 40;
