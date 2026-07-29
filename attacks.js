// =================================================
// ATTACKS - ORBS / CHARGE SHOT / EXPLOSIONS / MELEE-TELEPORT
// =================================================

import { player, mouse, camera, activeObjects, teleportStrike } from "./state.js";
import { triggerScreenShake, spawnBossHitEffect } from "./combat.js";

// =================================================
// CHARGE PARTICLE SPEED
// the fuller the power bar, the faster the orange
// charge/regen/boost particles move
// =================================================

export function chargeParticleSpeedMultiplier() {
    return 0.4 + player.power * 1.6;
}

// =================================================
// RELEASE CHARGED SHOT
// Charge level is driven by how much of the power bar has
// actually been drained into this charge (not a fixed frame
// timer), so holding longer keeps growing the shot for as
// long as there's power left. Called on SPACE release, or
// automatically the instant the power bar hits empty mid-charge.
// =================================================

export function releaseChargedShot() {
    const chargeLevel = Math.max(0, Math.min(1, player.chargeDrained / player.maxPower));

    fireOrb(chargeLevel);

    player.charging = false;
    player.chargeFrames = 0;
    player.chargeDrained = 0;
}

export function fireOrb(chargeLevel = 0) {
    // lock target now
    const targetX = mouse.x + camera.x;
    const targetY = mouse.y;

    const originX = player.x + 25;
    const originY = player.y + 25;

    const angle = Math.atan2(targetY - originY, targetX - originX);

    activeObjects.push({
        type: "orb",
        owner: "player",

        x: originX,
        y: originY,

        targetX,
        targetY,

        dx: Math.cos(angle),
        dy: Math.sin(angle),

        speed: 15,

        // uncapped growth - at chargeLevel 1 this is a genuinely
        // huge "super" orb, not just a slightly bigger dot
        size: 12 + chargeLevel * 90,
        glow: 25 + chargeLevel * 140,

        chargeLevel,
    });
}

// same shot mechanic as the player's SPACE blast, aimed at the
// player instead of the mouse cursor
export function bossFireOrb(boss, chargeLevel = 0) {
    const targetX = player.x + player.width / 2;
    const targetY = player.y + player.height / 2;

    const originX = boss.x + boss.width / 2;
    const originY = boss.y + boss.radii[2];

    const angle = Math.atan2(targetY - originY, targetX - originX);

    activeObjects.push({
        type: "orb",
        owner: "boss",

        x: originX,
        y: originY,

        targetX,
        targetY,

        dx: Math.cos(angle),
        dy: Math.sin(angle),

        speed: 13,

        size: 14 + chargeLevel * 30,
        glow: 25 + chargeLevel * 45,

        chargeLevel,
    });

    // recoil kick - fire pushes the boss's body back slightly
    boss.squishVelX -= 0.12 * boss.facing;
    boss.squishVelY += 0.1;
}

// =================================================
// EXPLOSION
// Also triggers screen shake directly, scaled by the charge
// level (i.e. by how big/damaging the underlying hit was).
// =================================================

export function createExplosion(x, y, chargeLevel = 0) {
    activeObjects.push({
        type: "explosion",
        x,
        y,
        radius: 5 + chargeLevel * 60,
        growth: 4 + chargeLevel * 20,
        life: 1,
    });

    triggerScreenShake(6 + chargeLevel * 40);
}

// =================================================
// ORB CLASH CHECK
// If a player orb and a boss orb touch mid-air, the larger orb
// punches through at full strength and destroys the smaller
// one outright. Only equal-size orbs mutually cancel out.
// =================================================

const CLASH_EQUAL_SIZE_TOLERANCE = 1.5;

export function checkOrbClashes() {
    for (let i = 0; i < activeObjects.length; i++) {
        const a = activeObjects[i];
        if (a.type !== "orb" || a.clashed) continue;

        for (let j = i + 1; j < activeObjects.length; j++) {
            const b = activeObjects[j];
            if (b.type !== "orb" || b.clashed) continue;
            if (a.owner === b.owner) continue;

            const d = Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
            if (d > a.size + b.size) continue;

            const sizeDiff = a.size - b.size;

            if (Math.abs(sizeDiff) <= CLASH_EQUAL_SIZE_TOLERANCE) {
                // evenly matched - both cancel out
                const mx = (a.x + b.x) / 2;
                const my = (a.y + b.y) / 2;

                createExplosion(mx, my, Math.max(a.chargeLevel, b.chargeLevel) + 0.15);
                spawnBossHitEffect(mx, my, "#ffffff");

                a.clashed = true;
                b.clashed = true;
            } else {
                // bigger orb punches through unaffected, smaller
                // orb is destroyed on the spot
                const winner = sizeDiff > 0 ? a : b;
                const loser = sizeDiff > 0 ? b : a;

                loser.clashed = true;

                createExplosion(loser.x, loser.y, loser.chargeLevel * 0.6);
                spawnBossHitEffect(loser.x, loser.y, "#ffffff");
                // winner keeps its position/size/velocity exactly as-is
            }
        }
    }
}

// =================================================
// TELEPORT STRIKE (MOVEMENT)
// =================================================

export function teleportStrikeTo(worldX, worldY) {
    // first hit in a chain - remember true origin
    if (!teleportStrike.active) {
        teleportStrike.originX = player.x;
        teleportStrike.originY = player.y;
        teleportStrike.active = true;
    }

    // cancel any pending return - we're chaining
    if (teleportStrike.returnTimeout) {
        clearTimeout(teleportStrike.returnTimeout);
    }

    // teleport to clicked spot
    player.x = worldX - 25;
    player.y = worldY - 25;

    // queue the return - fires only if no more clicks come in
    teleportStrike.returnTimeout = setTimeout(() => {
        player.x = teleportStrike.originX;
        player.y = teleportStrike.originY;

        teleportStrike.active = false;
        teleportStrike.returnTimeout = null;
    }, teleportStrike.returnDelay);
}

// =================================================
// MELEE ATK SWIPE (DOM ring at the click point)
// =================================================

export function meleeAtkSwipe(screenX, screenY) {
    const el = document.createElement("div");
    el.className = "melee-atk-swipe";
    el.style.left = screenX - 20 + "px";
    el.style.top = screenY - 20 + "px";

    document.body.appendChild(el);

    el.addEventListener("animationend", () => {
        el.remove();
    });
}

// =================================================
// BOSS STRIKE TELEGRAPH RING (DOM)
// Flashes right as a boss commits to an attack, converting the
// world-space origin into current screen-space.
// =================================================

export function spawnBossStrikeEffect(worldX, worldY, facing, color = "#ffffff") {
    const screenX = worldX - camera.x;
    const screenY = worldY;

    const el = document.createElement("div");
    el.className = "boss-strike-ring";
    el.style.left = screenX - 32 + "px";
    el.style.top = screenY - 32 + "px";
    el.style.borderColor = color;
    el.style.boxShadow = "0 0 20px 4px " + color;

    document.body.appendChild(el);

    el.addEventListener("animationend", () => {
        el.remove();
    });
}
