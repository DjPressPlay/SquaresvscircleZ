// =================================================
// INPUT - KEYBOARD (move/dash/jump/fly/charge/regen)
// AND MOUSE (aim + melee/teleport strike click)
// =================================================

import { canvas } from "./dom.js";
import { player, bosses, camera, dash, keys, mouse, game, strikeRange } from "./state.js";
import { PLAYER_MELEE_DAMAGE, PLAYER_MELEE_HIT_RADIUS, STRIKE_POSE_DURATION_MS } from "./constants.js";
import { spawnFlameParticle } from "./particles.js";
import { lerp } from "./math.js";
import { meleeAtkSwipe, teleportStrikeTo, releaseChargedShot } from "./attacks.js";
import { damageBoss, spawnBossHitEffect } from "./combat.js";

export function initInput() {
    // =================================================
    // MOUSE MOVE (aim tracking)
    // =================================================

    canvas.addEventListener("mousemove", (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    });

    // =================================================
    // MELEE / TELEPORT STRIKE (click)
    // =================================================

    canvas.addEventListener("click", (e) => {
        if (game.state !== "playing") return;

        const clickX = e.clientX + camera.x;
        const clickY = e.clientY;

        const playerCenterX = player.x + 25;
        const playerCenterY = player.y + 25;

        const distance = Math.sqrt((clickX - playerCenterX) ** 2 + (clickY - playerCenterY) ** 2);

        if (distance <= strikeRange) {
            meleeAtkSwipe(e.clientX, e.clientY);
            teleportStrikeTo(clickX, clickY);
            advanceStrikePose();

            // melee hit check - if the strike point lands close
            // enough to a boss, it counts as a landed melee hit.
            // checks every living boss so either (or both, if
            // overlapping) can be hit.
            for (const b of bosses) {
                if (!b.alive) continue;

                const bossCenterX = b.x + b.width / 2;
                const bossCenterY = b.y + b.height / 2;

                const bossDist = Math.sqrt((clickX - bossCenterX) ** 2 + (clickY - bossCenterY) ** 2);

                if (bossDist <= PLAYER_MELEE_HIT_RADIUS) {
                    damageBoss(b, PLAYER_MELEE_DAMAGE, clickX);
                    spawnBossHitEffect(clickX, clickY, "#ffffff");
                }
            }
        }
    });

    // =================================================
    // KEY STATE TRACKING (for held keys like Q - fly)
    // =================================================

    window.addEventListener("keydown", (e) => {
        keys[e.key.toLowerCase()] = true;

        // pressing any other key ends the post-release charge
        // pose early (player wants to look at/act on whatever
        // they just fired) - see CHARGE_RELEASE_POSE_DURATION_MS
        if (e.key !== " ") player.chargeReleasePoseUntil = 0;
    });

    window.addEventListener("keyup", (e) => {
        keys[e.key.toLowerCase()] = false;

        // release SPACE - fire whatever charge was built up
        if (e.key === " " && player.charging) {
            releaseChargedShot();
        }
    });

    // =================================================
    // KEY PRESS ACTIONS (dash / jump)
    // =================================================

    window.addEventListener("keydown", (e) => {
        if (game.state !== "playing") return;

        const key = e.key.toLowerCase();

        // dash left
        if (key === "a" && !dash.cooldown) {
            doDash(-1);
        }

        // dash right
        if (key === "d" && !dash.cooldown) {
            doDash(1);
        }

        // jump
        if (key === "w" && player.grounded) {
            player.velocityY = -player.jumpPower;
            player.grounded = false;
        }

        // fire is handled by the charge/release system (see update.js)
    });
}

// =================================================
// CLICK CYCLE - PUNCH (ground) / KICK (air) POSE
// Each of the two cycles remembers its own position and
// resumes there next time that state is clicked into. Every
// valid strike click (within strikeRange) advances one step,
// hit or miss.
// =================================================

function advanceStrikePose() {
    if (player.grounded) {
        player.strikePoseType = "ground";
        player.strikePoseFrame = player.groundStrikeIndex;
        player.groundStrikeIndex = (player.groundStrikeIndex + 1) % 3;
    } else {
        player.strikePoseType = "air";
        player.strikePoseFrame = player.airStrikeIndex;
        player.airStrikeIndex = (player.airStrikeIndex + 1) % 3;
    }

    player.strikePoseUntil = performance.now() + STRIKE_POSE_DURATION_MS;
}

function doDash(direction) {
    const dashStartX = player.x;

    player.x += direction * dash.distance;
    player.dashDirection = direction;
    player.dashPoseType = direction === player.facing ? "toward" : "away";
    player.smear = 1;

    for (let i = 0; i < 10; i++) {
        const t = i / 9;
        spawnFlameParticle("white", {
            x: lerp(dashStartX, player.x, t),
            y: player.y,
            width: player.width,
            height: player.height,
        });
    }

    dash.cooldown = true;
    setTimeout(() => {
        dash.cooldown = false;
    }, dash.cooldownTime);
}
