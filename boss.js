// =================================================
// BOSS AI - MOVEMENT / ATTACK STATE MACHINE + SPAWN/DEATH
// =================================================

import { player, camera, world, stats, game } from "./state.js";
import { hud, canvas } from "./dom.js";
import { clamp, lerp, easeInCubic, easeOutCubic, easeOutBack, springStep } from "./math.js";
import {
    BOSS_WALK_SPEED,
    BOSS_MELEE_RANGE,
    BOSS_MELEE_ANTICIPATE_FRAMES,
    BOSS_MELEE_LUNGE_FRAMES,
    BOSS_MELEE_HOLD_FRAMES,
    BOSS_MELEE_RETURN_FRAMES,
    BOSS_MELEE_DAMAGE,
    BOSS_CHARGE_WINDUP_FRAMES,
    BOSS_CHARGE_DASH_FRAMES,
    BOSS_CHARGE_SETTLE_FRAMES,
    BOSS_CHARGE_DISTANCE,
    BOSS_CHARGE_DAMAGE,
    BOSS_FIRE_INTERVAL,
    BOSS_HIT_RADIUS,
    BOSS_RESPAWN_DELAY,
    BOSS_DEATH_PIECE_FADE_RATE,
    KNOCKBACK_DECAY,
} from "./constants.js";
import { spawnFlameParticle, spawnDustParticle } from "./particles.js";
import { bossFireOrb, spawnBossStrikeEffect } from "./attacks.js";
import { damagePlayer, spawnBossHitEffect, popStat } from "./combat.js";

// =================================================
// STEP STACK - CALLED EVERY TIME A BOSS ENTERS A NEW
// BEHAVIOR STATE. RESETS SUB-STATE TIMERS SO EACH PHASE
// STARTS CLEAN.
// =================================================

export function enterBossStep(boss, step) {
    boss.telegraph = 0;

    if (step === "melee") {
        boss.meleeState = "idle";
        boss.meleeTimer = 0;
        boss.meleeHasHit = false;
    }

    if (step === "charge") {
        boss.chargeState = "idle";
        boss.chargeTimer = 0;
        boss.chargeHasHit = false;
    }
}

// =================================================
// BOSS BEHAVIOR - SEARCH
// Smooth, momentum based approach - eases velocity toward a
// target speed so it accelerates/decelerates like it has real mass.
// =================================================

function bossSearch(boss, dx) {
    const dist = Math.abs(dx);

    let targetVx = clamp(dx * 0.03, -BOSS_WALK_SPEED, BOSS_WALK_SPEED);

    // once fairly close, ease off so it doesn't overshoot/jitter
    if (dist < 60) {
        targetVx *= dist / 60;
    }

    boss.vx += (targetVx - boss.vx) * 0.08;

    // visual-only walk hop, driven by current speed
    boss.walkBob = Math.sin(boss.bobTime * 4) * Math.min(Math.abs(boss.vx), BOSS_WALK_SPEED) * 0.6;
}

// =================================================
// BOSS BEHAVIOR - FIRE
// Plants itself, sways gently, periodically winds up and lets
// an orb rip with a recoil pop.
// =================================================

function bossFire(boss) {
    // ease to a stop rather than braking instantly
    boss.vx += (0 - boss.vx) * 0.1;

    const cycle = boss.stepTimer % BOSS_FIRE_INTERVAL;
    const windup = Math.floor(BOSS_FIRE_INTERVAL * 0.5);

    if (cycle < windup) {
        // charging up - compress slightly, more so as it gets closer to firing
        boss.telegraph = cycle / windup;
        boss.squishVelY -= boss.telegraph * 0.01;

        spawnFlameParticle("orange", boss);
    } else if (cycle === windup) {
        const chargeLevel = 0.3 + Math.random() * 0.4;

        bossFireOrb(boss, chargeLevel);

        const originX = boss.x + boss.width / 2;
        const originY = boss.y + boss.radii[2];

        spawnBossStrikeEffect(originX, originY, boss.facing, "#ffb347");

        boss.telegraph = 0;
    }
}

// =================================================
// BOSS BEHAVIOR - MELEE
// anticipate (squat) -> lunge (eased dash toward player) ->
// hold (impact) -> spring back to origin with a soft overshoot.
// =================================================

function bossMelee(boss, dx) {
    const dist = Math.abs(dx);

    if (boss.meleeState === "idle") {
        // not close enough yet - approach like search until in range
        if (dist > BOSS_MELEE_RANGE) {
            bossSearch(boss, dx);
            return;
        }

        boss.meleeState = "anticipate";
        boss.meleeTimer = 0;
        boss.meleeOriginX = boss.x;
        boss.meleeOriginY = boss.y;
        boss.meleeHasHit = false;

        boss.vx = 0;
    }

    if (boss.meleeState === "anticipate") {
        boss.meleeTimer++;

        const t = boss.meleeTimer / BOSS_MELEE_ANTICIPATE_FRAMES;
        boss.telegraph = clamp(t, 0, 1);

        // squat down and lean back opposite the lunge direction
        boss.squishX = lerp(1, 0.72, boss.telegraph);
        boss.squishY = lerp(1, 1.35, boss.telegraph);

        if (boss.meleeTimer >= BOSS_MELEE_ANTICIPATE_FRAMES) {
            boss.meleeState = "lunge";
            boss.meleeTimer = 0;
            boss.meleeLungeFromX = boss.x;
            boss.meleeLungeToX = boss.x + boss.facing * (dist * 0.85);

            boss.squishVelX += boss.facing * 0.25;
            boss.squishVelY -= 0.2;

            spawnBossStrikeEffect(
                boss.x + boss.width / 2 + boss.facing * 40,
                boss.y + boss.height * 0.4,
                boss.facing,
                "#ff5c5c"
            );
        }
    } else if (boss.meleeState === "lunge") {
        boss.meleeTimer++;

        const t = clamp(boss.meleeTimer / BOSS_MELEE_LUNGE_FRAMES, 0, 1);
        const eased = easeInCubic(t);

        boss.x = lerp(boss.meleeLungeFromX, boss.meleeLungeToX, eased);

        // stretched out along the direction of travel
        boss.squishX = lerp(0.72, 1.3, eased);
        boss.squishY = lerp(1.35, 0.75, eased);

        if (!boss.meleeHasHit) {
            const pcx = player.x + player.width / 2;
            const pcy = player.y + player.height / 2;
            const bcx = boss.x + boss.width / 2;
            const bcy = boss.y + boss.height / 2;

            const d = Math.sqrt((pcx - bcx) ** 2 + (pcy - bcy) ** 2);

            if (d <= BOSS_HIT_RADIUS + player.width / 2) {
                damagePlayer(BOSS_MELEE_DAMAGE, bcx);
                boss.meleeHasHit = true;

                spawnBossHitEffect(pcx, pcy, "#ff5c5c");

                boss.squishVelX -= boss.facing * 0.3;
                boss.squishVelY += 0.35;
            }
        }

        if (t >= 1) {
            boss.meleeState = "hold";
            boss.meleeTimer = 0;
        }
    } else if (boss.meleeState === "hold") {
        boss.meleeTimer++;

        if (boss.meleeTimer >= BOSS_MELEE_HOLD_FRAMES) {
            boss.meleeState = "return";
            boss.meleeTimer = 0;
            boss.meleeLungeFromX = boss.x;
        }
    } else if (boss.meleeState === "return") {
        boss.meleeTimer++;

        const t = clamp(boss.meleeTimer / BOSS_MELEE_RETURN_FRAMES, 0, 1);

        // easeOutBack gives it a little overshoot/settle wobble
        // instead of snapping straight back to its spot
        const eased = easeOutBack(t);

        boss.x = lerp(boss.meleeLungeFromX, boss.meleeOriginX, eased);

        boss.squishX = lerp(boss.squishX, 1, 0.15);
        boss.squishY = lerp(boss.squishY, 1, 0.15);

        if (t >= 1) {
            boss.meleeState = "idle";
            boss.meleeTimer = 0;
            boss.telegraph = 0;
        }
    }
}

// =================================================
// BOSS BEHAVIOR - CHARGE
// Long telegraphed windup (coil back), then a fast eased dash
// burst toward the player with a stretched silhouette, settling
// with a bouncy overshoot instead of stopping dead.
// =================================================

function bossCharge(boss, dx) {
    const dist = Math.abs(dx);

    if (boss.chargeState === "idle") {
        boss.chargeState = "windup";
        boss.chargeTimer = 0;
        boss.vx = 0;
    }

    if (boss.chargeState === "windup") {
        boss.chargeTimer++;

        const t = boss.chargeTimer / BOSS_CHARGE_WINDUP_FRAMES;
        boss.telegraph = clamp(t, 0, 1);

        // coil backwards away from the player, compressing
        boss.squishX = lerp(1, 0.65, boss.telegraph);
        boss.squishY = lerp(1, 1.45, boss.telegraph);

        spawnFlameParticle("orange", boss);

        if (boss.chargeTimer >= BOSS_CHARGE_WINDUP_FRAMES) {
            boss.chargeState = "dash";
            boss.chargeTimer = 0;
            boss.chargeHasHit = false;

            boss.chargeFromX = boss.x;

            const travel = Math.min(dist + 40, BOSS_CHARGE_DISTANCE);
            boss.chargeToX = boss.x + boss.facing * travel;

            spawnBossStrikeEffect(
                boss.x + boss.width / 2 + boss.facing * 50,
                boss.y + boss.height * 0.5,
                boss.facing,
                "#c37bff"
            );
        }
    } else if (boss.chargeState === "dash") {
        boss.chargeTimer++;

        const t = clamp(boss.chargeTimer / BOSS_CHARGE_DASH_FRAMES, 0, 1);
        const eased = easeOutCubic(t);

        boss.x = lerp(boss.chargeFromX, boss.chargeToX, eased);

        // stretched thin along the dash direction, like a blur
        boss.squishX = lerp(0.65, 1.5, t);
        boss.squishY = lerp(1.45, 0.65, t);

        spawnFlameParticle("white", boss);
        spawnFlameParticle("white", boss);

        if (!boss.chargeHasHit) {
            const pcx = player.x + player.width / 2;
            const pcy = player.y + player.height / 2;
            const bcx = boss.x + boss.width / 2;
            const bcy = boss.y + boss.height / 2;

            const d = Math.sqrt((pcx - bcx) ** 2 + (pcy - bcy) ** 2);

            if (d <= BOSS_HIT_RADIUS + player.width / 2) {
                damagePlayer(BOSS_CHARGE_DAMAGE, bcx);
                boss.chargeHasHit = true;

                spawnBossHitEffect(pcx, pcy, "#c37bff");
            }
        }

        if (t >= 1) {
            boss.chargeState = "settle";
            boss.chargeTimer = 0;
        }
    } else if (boss.chargeState === "settle") {
        boss.chargeTimer++;

        const t = clamp(boss.chargeTimer / BOSS_CHARGE_SETTLE_FRAMES, 0, 1);

        boss.squishX = lerp(boss.squishX, 1, 0.12);
        boss.squishY = lerp(boss.squishY, 1, 0.12);

        boss.telegraph = lerp(boss.telegraph, 0, 0.1);

        if (t >= 1) {
            boss.chargeState = "idle";
            boss.telegraph = 0;
        }
    }
}

// =================================================
// UPDATE A SINGLE BOSS (called once per frame for each boss)
// =================================================

export function updateBoss(boss) {
    // health hit zero - kick off the death/respawn cycle instead
    // of just vanishing
    if (boss.alive && boss.health <= 0 && !boss.dying) {
        triggerBossDeath(boss);
    }

    if (!boss.alive) return;

    boss.bobTime += 0.06;

    // ---- step stack cycling ----
    boss.stepTimer++;

    if (boss.stepTimer >= boss.stepDuration) {
        boss.stepTimer = 0;
        boss.stepIndex = (boss.stepIndex + 1) % boss.stepStack.length;

        enterBossStep(boss, boss.stepStack[boss.stepIndex]);
    }

    const currentStep = boss.stepStack[boss.stepIndex];
    const dx = player.x + player.width / 2 - (boss.x + boss.width / 2);

    if (Math.abs(dx) > 4) {
        boss.facing = dx >= 0 ? 1 : -1;
    }

    if (currentStep === "search") bossSearch(boss, dx);
    else if (currentStep === "fire") bossFire(boss);
    else if (currentStep === "melee") bossMelee(boss, dx);
    else if (currentStep === "charge") bossCharge(boss, dx);

    // ---- integrate horizontal movement ----
    // (melee lunge/return and charge dash directly set boss.x
    // themselves via easing, so only add vx when nothing else
    // is actively overriding position this frame)
    const posLocked =
        (currentStep === "melee" && boss.meleeState !== "idle") ||
        (currentStep === "charge" && boss.chargeState !== "idle" && boss.chargeState !== "windup");

    if (!posLocked) {
        boss.x += boss.vx;
    }

    // ---- knockback (from a qualifying player hit) ----
    if (boss.knockbackVX) {
        boss.x += boss.knockbackVX;
        boss.knockbackVX *= KNOCKBACK_DECAY;

        if (Math.abs(boss.knockbackVX) < 0.4) {
            boss.knockbackVX = 0;
        }

        if (Math.abs(boss.knockbackVX) > 1) {
            spawnDustParticle(boss);
        }
    }

    // ---- gravity / ground ----
    boss.velocityY += boss.gravity;
    boss.y += boss.velocityY;

    if (boss.y + boss.height >= world.groundY) {
        if (boss.velocityY > 6) {
            boss.squishVelY -= boss.velocityY * 0.015;
        }

        boss.y = world.groundY - boss.height;
        boss.velocityY = 0;
        boss.grounded = true;
    } else {
        boss.grounded = false;
    }

    // ---- world limits ----
    if (boss.x < 0) boss.x = 0;
    if (boss.x + boss.width > world.width) boss.x = world.width - boss.width;

    // ---- squash & stretch spring back to normal ----
    const sx = springStep(boss.squishX, boss.squishVelX, 1, 0.05, 0.35);
    boss.squishX = sx[0];
    boss.squishVelX = sx[1];

    const sy = springStep(boss.squishY, boss.squishVelY, 1, 0.05, 0.35);
    boss.squishY = sy[0];
    boss.squishVelY = sy[1];

    // ---- per-circle jelly wobble (secondary motion) ----
    const speedFactor = Math.min(Math.abs(boss.vx) + Math.abs(boss.velocityY) * 0.2, 10);

    for (let i = 0; i < 3; i++) {
        const target = Math.sin(boss.bobTime * 3 + i * 1.1) * (1.5 + speedFactor * 0.4);

        const w = springStep(boss.circleWobble[i], boss.circleWobbleVel[i], target, 0.12, 0.45);
        boss.circleWobble[i] = w[0];
        boss.circleWobbleVel[i] = w[1];
    }
}

// =================================================
// SPAWN A BOSS ON A GIVEN SIDE
// "left" spawns near/left of the player (flanking); "right"
// spawns off the right edge of the current screen.
// =================================================

export function spawnBoss(boss, side) {
    boss.alive = true;
    boss.dying = false;
    boss.deathPieces = [];
    boss.health = boss.maxHealth;
    boss.knockbackVX = 0;
    boss.side = side;

    if (side === "left") {
        boss.x = clamp(player.x - 400, 0, world.width - boss.width);
        boss.facing = 1;
    } else {
        boss.x = camera.x + canvas.width + 150;
        boss.facing = -1;
    }

    boss.y = world.groundY - boss.height;

    boss.vx = 0;
    boss.squishX = 1;
    boss.squishY = 1;
    boss.squishVelX = 0;
    boss.squishVelY = 0;
    boss.circleWobble = [0, 0, 0];
    boss.circleWobbleVel = [0, 0, 0];

    boss.stepIndex = 0;
    boss.stepTimer = 0;

    enterBossStep(boss, boss.stepStack[boss.stepIndex]);
}

// spawns both bosses flanking the player and staggers their
// step cycles so they don't move in lockstep
export function spawnBothBosses(bosses) {
    spawnBoss(bosses[0], "left");
    spawnBoss(bosses[1], "right");

    bosses[1].stepIndex = 2;
    bosses[1].stepTimer = 0;
    enterBossStep(bosses[1], bosses[1].stepStack[bosses[1].stepIndex]);
}

// =================================================
// BOSS DEATH / RESPAWN CYCLE
// Instead of vanishing at 0 health, the boss breaks apart into
// its 3 body circles, each tumbling under gravity with its own
// rotation while fading out. Once every piece has fully faded, a
// fresh boss spawns back on its own side and the fight continues.
// =================================================

export function triggerBossDeath(boss) {
    boss.alive = false;
    boss.dying = true;

    boss.deathPieces = [];

    const centerX = boss.x + boss.width / 2;
    let stackY = boss.y + boss.height - boss.walkBob;

    for (let i = 0; i < boss.radii.length; i++) {
        const r = boss.radii[i];
        const wobbleX = boss.circleWobble[i];

        const cx = centerX + wobbleX;
        const cy = stackY - r;

        boss.deathPieces.push({
            x: cx,
            y: cy,
            r,

            vx: (Math.random() - 0.5) * 7,
            vy: -5 - Math.random() * 4,

            rotation: 0,
            rotationSpeed: (Math.random() - 0.5) * 0.3,

            life: 1,
        });

        stackY = cy - r * 0.35;
    }
}

export function updateBossDeathPieces(boss) {
    if (!boss.dying) return;

    let allFaded = true;

    for (const p of boss.deathPieces) {
        p.vy += 0.8;

        p.x += p.vx;
        p.y += p.vy;

        p.rotation += p.rotationSpeed;

        p.life -= BOSS_DEATH_PIECE_FADE_RATE;

        if (p.life > 0) allFaded = false;
    }

    if (allFaded) {
        boss.dying = false;
        boss.deathPieces = [];

        stats.wins++;
        popStat(hud.winsValue);

        setTimeout(() => {
            if (game.state === "playing") spawnBoss(boss, boss.side);
        }, BOSS_RESPAWN_DELAY);
    }
}
