// =================================================
// SHARED GAME STATE
// Every other module imports what it needs from here.
// Objects are exported directly so their properties can be
// mutated from any file (ES module bindings only forbid
// re-assigning the imported name itself, not its contents).
// =================================================

export const world = {
    width: 5000,
    groundY: 450,
};

export const player = {
    x: 250,
    y: 300,

    width: 50,
    height: 50,

    velocityY: 0,
    gravity: 0.8,
    jumpPower: 15,

    grounded: false,

    smear: 0,
    dashDirection: 0,

    flying: false,
    boosting: false,

    // which way the sprite faces: 1 = right, -1 = left.
    // purely visual (mirrors the drawn sprite) - never affects
    // aiming, hitboxes, or attack targeting
    facing: 1,

    health: 300,
    maxHealth: 300,

    power: 1,
    maxPower: 1,

    charging: false,
    chargeFrames: 0,
    chargeDrained: 0,

    regening: false,

    // hit feedback (combo streak + knockback)
    hitStreak: 0,
    lastHitTime: 0,
    knockbackVX: 0,
};

// click melee/teleport strike only works within this radius of the player
export const strikeRange = player.width * 5;

// =================================================
// BOSS FACTORY
// Same move-set as the player: walk/approach, fire, melee
// lunge, charge dash. A factory (not a single object) so
// multiple independent bosses can exist at once, each with
// its own fresh arrays/state.
// =================================================

export function createBossState() {
    return {
        x: 0,
        y: 0,

        // bounding box (ground collision / world limits)
        width: 70,
        height: 120,

        // circle radii, bottom to top - the "snowman" look
        radii: [35, 25, 17],

        velocityY: 0,
        gravity: 0.8,
        grounded: false,

        alive: false,

        health: 300,
        maxHealth: 300,

        // ---- movement feel ----
        vx: 0, // current horizontal velocity (eased, not instant)
        facing: 1,
        walkBob: 0, // purely visual hop while walking

        // ---- squash & stretch (soft body feel) ----
        squishX: 1,
        squishY: 1,
        squishVelX: 0,
        squishVelY: 0,

        // per-circle secondary-motion wobble (bottom to top)
        circleWobble: [0, 0, 0],
        circleWobbleVel: [0, 0, 0],

        bobTime: 0,

        // ---- STEP STACK ----
        // cycles through these behaviors, spending stepDuration
        // frames in each before moving on
        stepStack: ["search", "fire", "melee", "charge"],
        stepIndex: 0,
        stepTimer: 0,
        stepDuration: 180,

        // shared telegraph/windup progress (0-1)
        telegraph: 0,

        // ---- melee sub-state ----
        meleeState: "idle", // idle -> anticipate -> lunge -> hold -> return
        meleeTimer: 0,
        meleeOriginX: 0,
        meleeOriginY: 0,
        meleeLungeFromX: 0,
        meleeLungeToX: 0,
        meleeHasHit: false,

        // ---- charge sub-state ----
        chargeState: "idle", // idle -> windup -> dash -> settle
        chargeTimer: 0,
        chargeFromX: 0,
        chargeToX: 0,
        chargeHasHit: false,

        // ---- death / respawn cycle ----
        dying: false,
        deathPieces: [],

        // ---- knockback (from qualifying player hits) ----
        knockbackVX: 0,

        // which side of the player this boss spawns/respawns on
        side: "right",
    };
}

// two independent bosses, flanking the player - both run
// their own step stack simultaneously
export const bosses = [createBossState(), createBossState()];

export const camera = { x: 0 };

export const dash = {
    distance: 200,
    cooldown: false,
    cooldownTime: 300,
};

export const keys = {};

export const mouse = { x: 0, y: 0 };

// projectiles / explosions / hit rings / hit sparks
export const activeObjects = [];

// flame + dust particles
export const flameParticles = [];

export const teleportStrike = {
    active: false,
    originX: 0,
    originY: 0,
    returnDelay: 150,
    returnTimeout: null,
};

export const screenShake = {
    time: 0,
    magnitude: 0,
};

// HUD stat counters (hits landed / current combo / battles won)
export const stats = {
    hits: 0,
    combo: 0,
    wins: 0,
};

// game state machine: "start" | "playing" | "gameover"
export const game = {
    state: "start",
};
