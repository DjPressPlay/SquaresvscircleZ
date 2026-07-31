// =================================================
// COMBAT - DAMAGE / KNOCKBACK / SCREEN SHAKE / HIT FX
// =================================================

import { player, activeObjects, screenShake, stats, game } from "./state.js";
import { hud } from "./dom.js";
import {
    COMBO_HIT_THRESHOLD,
    COMBO_HIT_WINDOW_MS,
    HIGH_DAMAGE_THRESHOLD,
    KNOCKBACK_FORCE,
    KNOCKBACK_POSE_DURATION_MS,
    BOSS_KNOCKBACK_FORCE,
    BOSS_HIGH_DAMAGE_THRESHOLD,
    SHAKE_DURATION_FRAMES,
    SHAKE_MAGNITUDE,
} from "./constants.js";

// callback wired in by game.js so combat.js doesn't need to
// import the game-state-machine module directly (avoids a
// circular import between combat.js and game.js)
let onPlayerDeath = () => {};
export function setOnPlayerDeath(fn) {
    onPlayerDeath = fn;
}

// =================================================
// ORB DAMAGE FROM SIZE
// Damage is derived directly from the orb's actual rendered
// size instead of a parallel chargeLevel formula, so size and
// damage can never drift apart.
// =================================================

export function orbDamageFromSize(size, owner) {
    if (owner === "player") {
        // player orb: size 12 (charge 0) -> 102 (charge 1, full power drained)
        // damage:      10                -> 150
        return 10 + (size - 12) * (140 / 90);
    } else {
        // boss orb: size 14 (charge 0) -> 44 (charge 1)
        // damage:    8                 -> 28
        return 8 + (size - 14) * (20 / 30);
    }
}

// =================================================
// SCREEN SHAKE
// =================================================

export function triggerScreenShake(magnitude = SHAKE_MAGNITUDE) {
    // if a stronger shake is already mid-flight, don't let a
    // weaker one cut it short - take whichever is bigger
    if (screenShake.time <= 0 || magnitude >= screenShake.magnitude) {
        screenShake.magnitude = magnitude;
    }
    screenShake.time = SHAKE_DURATION_FRAMES;
}

// =================================================
// KNOCKBACK
// =================================================

export function triggerPlayerKnockback(sourceX) {
    const playerCenterX = player.x + player.width / 2;

    const dir =
        sourceX === undefined
            ? Math.random() < 0.5
                ? -1
                : 1
            : playerCenterX < sourceX
            ? -1
            : 1;

    player.knockbackVX = dir * KNOCKBACK_FORCE;
    player.knockbackPoseUntil = performance.now() + KNOCKBACK_POSE_DURATION_MS;

    if (!player.flying) {
        player.velocityY = -11;
        player.grounded = false;
    }

    triggerScreenShake();
}

// mirror of triggerPlayerKnockback, but for a boss being
// shoved back by a qualifying player hit
export function triggerBossKnockback(boss, sourceX) {
    const bossCenterX = boss.x + boss.width / 2;

    const dir =
        sourceX === undefined
            ? Math.random() < 0.5
                ? -1
                : 1
            : bossCenterX < sourceX
            ? -1
            : 1;

    boss.knockbackVX = dir * BOSS_KNOCKBACK_FORCE;

    // small upward pop so it reads as being launched back
    boss.velocityY = -8;
    boss.grounded = false;

    triggerScreenShake();
}

// =================================================
// HUD STAT POP ANIMATION
// =================================================

export function popStat(el) {
    el.classList.remove("stat-pop");
    // force a reflow so the animation can restart even if it
    // was just applied a moment ago
    void el.offsetWidth;
    el.classList.add("stat-pop");
}

// =================================================
// DAMAGE APPLICATION
// =================================================

export function damagePlayer(amount, sourceX) {
    player.health -= amount;
    if (player.health < 0) player.health = 0;

    // taking a hit breaks the player's own outgoing combo
    stats.combo = 0;

    // ---- combo tracking (for the player's own knockback trigger) ----
    const now = performance.now();

    if (now - player.lastHitTime <= COMBO_HIT_WINDOW_MS) {
        player.hitStreak++;
    } else {
        player.hitStreak = 1;
    }

    player.lastHitTime = now;

    const comboTriggered = player.hitStreak >= COMBO_HIT_THRESHOLD;
    const damageTriggered = amount >= HIGH_DAMAGE_THRESHOLD;

    if (comboTriggered) {
        player.hitStreak = 0;
    }

    if (comboTriggered || damageTriggered) {
        triggerPlayerKnockback(sourceX);
    }

    // ---- health hit zero - end the game ----
    if (player.health <= 0 && game.state === "playing") {
        onPlayerDeath();
    }
}

export function damageBoss(boss, amount, sourceX) {
    boss.health -= amount;

    // little compress-pop reaction when hit, keeps it feeling soft
    boss.squishVelY += 0.15;
    boss.squishVelX += (Math.random() - 0.5) * 0.1;

    if (boss.health < 0) boss.health = 0;

    // ---- HUD counters ----
    stats.hits++;
    stats.combo++;

    popStat(hud.hitsValue);
    popStat(hud.comboValue);

    // ---- qualifying hit -> shove the boss back ----
    if (amount >= BOSS_HIGH_DAMAGE_THRESHOLD) {
        triggerBossKnockback(boss, sourceX);
    }
}

// =================================================
// HIT FLASH EFFECT
// Flashes at the moment an attack actually lands - a bright
// ring + a burst of sparks.
// =================================================

export function spawnBossHitEffect(x, y, color = "#ff4d4d") {
    activeObjects.push({
        type: "bossHit",
        x,
        y,
        life: 1,
        radius: 8,
        color,
    });

    for (let i = 0; i < 8; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 3 + Math.random() * 4;

        activeObjects.push({
            type: "bossHitSpark",
            x,
            y,
            dx: Math.cos(angle) * speed,
            dy: Math.sin(angle) * speed,
            life: 1,
            color,
        });
    }
}
