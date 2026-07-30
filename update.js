// =================================================
// UPDATE - THE PER-FRAME SIMULATION STEP
// =================================================

import { canvas } from "./dom.js";
import { world, player, bosses, camera, keys, mouse, activeObjects, screenShake } from "./state.js";
import { CAMERA_DEADZONE, BOSS_HIT_RADIUS } from "./constants.js";
import {
    CHARGE_DRAIN_PER_FRAME,
    POWER_REGEN_PER_FRAME,
    POWER_BOOST_DRAIN_PER_FRAME,
    FLY_EASE,
    FLY_MAX_SPEED,
    FLY_BOOST_EASE,
    FLY_BOOST_MAX_SPEED,
    KNOCKBACK_DECAY,
} from "./constants.js";
import { spawnFlameParticle, spawnDustParticle, updateFlameParticles } from "./particles.js";
import { chargeParticleSpeedMultiplier, releaseChargedShot, checkOrbClashes, createExplosion } from "./attacks.js";
import { damageBoss, damagePlayer, orbDamageFromSize, spawnBossHitEffect } from "./combat.js";
import { updateBoss, updateBossDeathPieces } from "./boss.js";

// =================================================
// ACTIVE OBJECTS (orbs / hit rings / sparks / explosions)
// =================================================

function updateActiveObjects() {
    checkOrbClashes();

    for (let i = activeObjects.length - 1; i >= 0; i--) {
        const obj = activeObjects[i];

        // ---- orb ----
        if (obj.type === "orb") {
            if (obj.clashed) {
                activeObjects.splice(i, 1);
                continue;
            }

            obj.x += obj.dx * obj.speed;
            obj.y += obj.dy * obj.speed;

            const distance = Math.sqrt((obj.targetX - obj.x) ** 2 + (obj.targetY - obj.y) ** 2);

            if (distance <= obj.speed) {
                createExplosion(obj.targetX, obj.targetY, obj.chargeLevel);

                // player shots hurt any boss they land on, boss
                // shots hurt the player (damage is driven directly
                // by the orb's actual size)
                if (obj.owner === "player") {
                    for (const b of bosses) {
                        if (!b.alive) continue;

                        const bcx = b.x + b.width / 2;
                        const bcy = b.y + b.height / 2;
                        const d = Math.sqrt((bcx - obj.targetX) ** 2 + (bcy - obj.targetY) ** 2);

                        if (d <= BOSS_HIT_RADIUS + obj.chargeLevel * 30) {
                            damageBoss(b, orbDamageFromSize(obj.size, "player"), obj.targetX);
                            spawnBossHitEffect(obj.targetX, obj.targetY, "#ffffff");
                        }
                    }
                }

                if (obj.owner === "boss") {
                    const pcx = player.x + player.width / 2;
                    const pcy = player.y + player.height / 2;
                    const d = Math.sqrt((pcx - obj.targetX) ** 2 + (pcy - obj.targetY) ** 2);

                    if (d <= 35 + obj.chargeLevel * 30) {
                        damagePlayer(orbDamageFromSize(obj.size, "boss"), obj.x);
                        spawnBossHitEffect(obj.targetX, obj.targetY, "#ffb347");
                    }
                }

                activeObjects.splice(i, 1);
            }
        }

        // ---- boss hit ring ----
        if (obj.type === "bossHit") {
            obj.radius += 6;
            obj.life -= 0.09;

            if (obj.life <= 0) activeObjects.splice(i, 1);
        }

        // ---- boss hit spark ----
        if (obj.type === "bossHitSpark") {
            obj.x += obj.dx;
            obj.y += obj.dy;

            obj.dx *= 0.9;
            obj.dy *= 0.9;

            obj.life -= 0.07;

            if (obj.life <= 0) activeObjects.splice(i, 1);
        }

        // ---- explosion ----
        if (obj.type === "explosion") {
            obj.radius += obj.growth;
            obj.life -= 0.05;

            if (obj.life <= 0) activeObjects.splice(i, 1);
        }
    }
}

// =================================================
// MAIN UPDATE
// =================================================

export function update() {
    // ---- SPACE charge blast (hold to charge, release to fire) ----
    if (keys[" "] && player.power > 0) {
        player.charging = true;
        player.chargeFrames++;

        const drainAmt = Math.min(CHARGE_DRAIN_PER_FRAME, player.power);
        player.power -= drainAmt;
        player.chargeDrained += drainAmt;

        if (player.power <= 0) {
            // whole bar spent mid-hold - this IS the super attack,
            // unleash it immediately rather than waiting on keyup
            releaseChargedShot();
        }
    } else {
        player.charging = false;
    }

    if (player.charging && player.power > 0) {
        spawnFlameParticle("orange", undefined, chargeParticleSpeedMultiplier());
        spawnFlameParticle("orange", undefined, chargeParticleSpeedMultiplier());
    }

    // ---- power charge (hold S) / boost drain (hold S while flying) ----
    player.regening = false;
    player.boosting = false;

    // boosting only actually engages while there's power left to
    // drain - at 0 power, Q+S falls back to a plain (non-boosted)
    // hover with no drain and no particles
    const wantsBoost = keys["q"] && keys["s"];
    const isBoosting = wantsBoost && player.power > 0;

    if (isBoosting) {
        player.boosting = true;

        player.power -= POWER_BOOST_DRAIN_PER_FRAME;
        if (player.power < 0) player.power = 0;

        spawnFlameParticle("orange", undefined, chargeParticleSpeedMultiplier());
        spawnFlameParticle("orange", undefined, chargeParticleSpeedMultiplier());
    } else if (keys["s"] && !wantsBoost) {
        player.regening = true;

        player.power += POWER_REGEN_PER_FRAME;
        if (player.power > player.maxPower) player.power = player.maxPower;

        if (player.power > 0) {
            spawnFlameParticle("orange", undefined, chargeParticleSpeedMultiplier());
            spawnFlameParticle("orange", undefined, chargeParticleSpeedMultiplier());
        }
    }

    updateFlameParticles();

    // ---- fly (hold Q) ----
    if (keys["q"]) {
        player.flying = true;

        const targetX = mouse.x + camera.x - player.width / 2;
        const targetY = mouse.y - player.height / 2;

        // gentle ease toward the cursor, plus a max-speed cap so a
        // big cursor jump drifts across the distance instead of
        // snapping most of the way there in one frame. Holding S
        // while flying boosts both the ease and speed cap, but only
        // while there's power left to fund it.
        const ease = player.boosting ? FLY_BOOST_EASE : FLY_EASE;
        const maxSpeed = player.boosting ? FLY_BOOST_MAX_SPEED : FLY_MAX_SPEED;

        let moveX = (targetX - player.x) * ease;
        let moveY = (targetY - player.y) * ease;

        const moveDist = Math.sqrt(moveX * moveX + moveY * moveY);

        if (moveDist > maxSpeed) {
            const scale = maxSpeed / moveDist;
            moveX *= scale;
            moveY *= scale;
        }

        player.x += moveX;
        player.y += moveY;

        if (player.y + player.height > world.groundY) {
            player.y = world.groundY - player.height;
        }

        player.velocityY = 0;
        player.grounded = false;
    } else {
        player.flying = false;

        // gravity
        player.velocityY += player.gravity;
        player.y += player.velocityY;

        // ground collision
        if (player.y + player.height >= world.groundY) {
            player.y = world.groundY - player.height;
            player.velocityY = 0;
            player.grounded = true;
        }
    }

    // ---- knockback (from combo/damage-triggered hit feedback) ----
    if (player.knockbackVX) {
        player.x += player.knockbackVX;
        player.knockbackVX *= KNOCKBACK_DECAY;

        if (Math.abs(player.knockbackVX) < 0.4) {
            player.knockbackVX = 0;
        }

        if (Math.abs(player.knockbackVX) > 1) {
            spawnDustParticle(player);
        }
    }

    // ---- world limits ----
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > world.width) player.x = world.width - player.width;

    // ---- camera (dead-zone follow) ----
    // only scrolls once the player nears the left/right edge of
    // the screen, instead of locking the player to exact center
    const screenX = player.x - camera.x;

    if (screenX > canvas.width - CAMERA_DEADZONE) {
        camera.x = player.x - (canvas.width - CAMERA_DEADZONE);
    } else if (screenX < CAMERA_DEADZONE) {
        camera.x = player.x - CAMERA_DEADZONE;
    }

    if (camera.x < 0) camera.x = 0;
    if (camera.x > world.width - canvas.width) camera.x = world.width - canvas.width;

    // ---- smear fade ----
    if (player.smear > 0) player.smear -= 0.08;

    // ---- screen shake countdown ----
    if (screenShake.time > 0) screenShake.time--;

    updateActiveObjects();

    // both bosses run their own independent step stack - fully
    // simultaneous, neither waits for the other
    for (const b of bosses) {
        updateBoss(b);
        updateBossDeathPieces(b);
    }
}
