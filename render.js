// =================================================
// RENDER - EVERYTHING DRAWN TO THE CANVAS EACH FRAME
// =================================================

import { canvas, ctx } from "./dom.js";
import { world, player, bosses, camera, activeObjects, screenShake } from "./state.js";
import { clamp } from "./math.js";
import { drawFlameParticles } from "./particles.js";
import {
    BACKGROUND_URL,
    PLAYER_IDLE_URL,
    PLAYER_FLY_URL,
    PLAYER_FLY_AWAY_URL,
    PLAYER_HIT_AWAY_URL,
    PLAYER_CHARGE_URL,
    PLAYER_CHARGE_P1_URL,
    PLAYER_CHARGE_P2_URL,
    PLAYER_SPRITE_SCALE,
    PLAYER_SPRITE_Y_OFFSET,
    PLAYER_PUNCH_URLS,
    PLAYER_KICK_URLS,
    PLAYER_KNOCKBACK_TILT_DEGREES,
} from "./constants.js";
import { SHAKE_DURATION_FRAMES } from "./constants.js";

// =================================================
// BACKGROUND IMAGE (drawn behind the ground, slow parallax)
// =================================================

const bgImage = new Image();
bgImage.crossOrigin = "anonymous";
let bgImageLoaded = false;

bgImage.onload = () => {
    bgImageLoaded = true;
};

bgImage.src = BACKGROUND_URL;

// =================================================
// PLAYER SPRITES (static - one image per state)
// =================================================

const playerSprites = {
    idle: { img: new Image(), loaded: false, src: PLAYER_IDLE_URL },
    fly: { img: new Image(), loaded: false, src: PLAYER_FLY_URL },
    dashAway: { img: new Image(), loaded: false, src: PLAYER_FLY_AWAY_URL },
    hitAway: { img: new Image(), loaded: false, src: PLAYER_HIT_AWAY_URL },
    charge: { img: new Image(), loaded: false, src: PLAYER_CHARGE_URL },
    chargeP1: { img: new Image(), loaded: false, src: PLAYER_CHARGE_P1_URL },
    chargeP2: { img: new Image(), loaded: false, src: PLAYER_CHARGE_P2_URL },
};

// punch (ground click cycle P1-P3) and kick (air click cycle
// K1-K3) poses, each as their own 3-entry array
const punchSprites = PLAYER_PUNCH_URLS.map((src) => ({ img: new Image(), loaded: false, src }));
const kickSprites = PLAYER_KICK_URLS.map((src) => ({ img: new Image(), loaded: false, src }));

for (const key in playerSprites) {
    const sprite = playerSprites[key];
    sprite.img.crossOrigin = "anonymous";
    sprite.img.onload = () => {
        sprite.loaded = true;
    };
    sprite.img.src = sprite.src;
}

for (const sprite of [...punchSprites, ...kickSprites]) {
    sprite.img.crossOrigin = "anonymous";
    sprite.img.onload = () => {
        sprite.loaded = true;
    };
    sprite.img.src = sprite.src;
}

function drawBackground() {
    if (!bgImageLoaded) return;

    const imgH = world.groundY;
    const scale = imgH / bgImage.height;
    const imgW = bgImage.width * scale;

    if (imgW <= 0) return;

    const parallax = 0.35;
    let offsetX = -((camera.x * parallax) % imgW);
    if (offsetX > 0) offsetX -= imgW;

    ctx.save();
    for (let x = offsetX; x < canvas.width; x += imgW) {
        ctx.drawImage(bgImage, x, 0, imgW, imgH);
    }
    ctx.restore();
}

// =================================================
// GROUND
// =================================================

function drawGround() {
    const groundH = canvas.height - world.groundY;
    ctx.fillStyle = "#7a5230";
    ctx.fillRect(0, world.groundY, world.width, groundH);
}

// =================================================
// BOSS
// Snowman stack of 3 circles, bottom to top, with squash/stretch
// + per-circle wobble applied so it reads as a soft, living body.
// =================================================

function drawBoss(boss) {
    if (!boss.alive) return;

    const centerX = boss.x + boss.width / 2;
    const baseY = boss.y + boss.height - boss.walkBob;

    const color = "#dfefff";
    let glowColor = "#8fd8ff";

    const currentStep = boss.stepStack[boss.stepIndex];

    if (currentStep === "fire") glowColor = "#ffb347";
    if (currentStep === "melee") glowColor = "#ff5c5c";
    if (currentStep === "charge") glowColor = "#c37bff";

    // trailing smear during the charge dash - motion blur feel
    if (currentStep === "charge" && boss.chargeState === "dash") {
        ctx.save();
        ctx.filter = "blur(12px)";
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = glowColor;
        ctx.beginPath();
        ctx.ellipse(centerX - boss.facing * 60, baseY - 60, 60, 40, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    let stackY = baseY;

    // big soft outer halo behind the whole snowman so the glow
    // reads clearly from a distance
    ctx.save();
    ctx.filter = "blur(30px)";
    ctx.globalAlpha = 0.55 + boss.telegraph * 0.25;
    ctx.fillStyle = glowColor;
    ctx.beginPath();
    ctx.ellipse(centerX, baseY - 70, 95 + boss.telegraph * 40, 105 + boss.telegraph * 40, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    for (let i = 0; i < boss.radii.length; i++) {
        const r = boss.radii[i];
        const wobbleX = boss.circleWobble[i];

        const cx = centerX + wobbleX;
        const cy = stackY - r;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(boss.squishX, boss.squishY);

        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);

        ctx.fillStyle = color;

        ctx.shadowBlur = 40 + boss.telegraph * 55;
        ctx.shadowColor = glowColor;

        ctx.fill();

        ctx.lineWidth = 3;
        ctx.strokeStyle = glowColor;
        ctx.stroke();

        ctx.restore();

        stackY = cy - r * 0.35;
    }

    // simple eyes on the top circle so it reads as a face/direction
    const headR = boss.radii[2];
    const headCx = centerX + boss.circleWobble[2];
    const headCy = stackY + headR - headR * 0.35;

    ctx.save();
    ctx.fillStyle = "#222";
    ctx.beginPath();
    ctx.arc(headCx + boss.facing * 5, headCy - 2, 3, 0, Math.PI * 2);
    ctx.arc(headCx - boss.facing * 3, headCy - 2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // health bar above the boss
    const barW = 90,
        barH = 8;
    const barX = centerX - barW / 2;
    const barY = boss.y - 30;

    ctx.save();
    ctx.fillStyle = "#222";
    ctx.fillRect(barX, barY, barW, barH);

    const pct = Math.max(0, boss.health / boss.maxHealth);
    ctx.fillStyle = "#ff4d4d";
    ctx.fillRect(barX, barY, barW * pct, barH);

    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);
    ctx.restore();
}

function drawBossDeathPieces(boss) {
    if (!boss.dying) return;

    for (const p of boss.deathPieces) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);

        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);

        ctx.beginPath();
        ctx.arc(0, 0, p.r, 0, Math.PI * 2);

        ctx.fillStyle = "#dfefff";

        ctx.shadowBlur = 35;
        ctx.shadowColor = "#8fd8ff";

        ctx.fill();

        ctx.lineWidth = 3;
        ctx.strokeStyle = "#8fd8ff";
        ctx.stroke();

        // a little cracked-line detail so the piece doesn't read
        // as a perfectly clean circle mid-tumble
        ctx.beginPath();
        ctx.moveTo(-p.r * 0.4, -p.r * 0.3);
        ctx.lineTo(p.r * 0.2, p.r * 0.1);
        ctx.lineTo(-p.r * 0.1, p.r * 0.5);
        ctx.strokeStyle = "rgba(143,216,255,0.6)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.restore();
    }
}

// =================================================
// ACTIVE OBJECTS (orbs / explosions / hit rings / sparks)
// =================================================

function drawActiveObjects() {
    for (const obj of activeObjects) {
        if (obj.type === "orb") {
            ctx.save();

            // big charged shots get an actual blur, scaling with
            // charge, plus a soft halo behind them
            const isBigCharge = obj.chargeLevel > 0.4;

            if (isBigCharge) {
                const blurAmt = (obj.chargeLevel - 0.4) * 18;

                ctx.filter = "blur(" + blurAmt.toFixed(1) + "px)";
                ctx.globalAlpha = 0.35;
                ctx.fillStyle = obj.owner === "boss" ? "#ffb347" : "#8fe9ff";

                ctx.beginPath();
                ctx.arc(obj.x, obj.y, obj.size * 1.7, 0, Math.PI * 2);
                ctx.fill();

                ctx.globalAlpha = 1;
                ctx.filter = "blur(" + (blurAmt * 0.4).toFixed(1) + "px)";
            }

            ctx.shadowBlur = obj.glow;
            ctx.shadowColor = obj.owner === "boss" ? "#ff8a3d" : "cyan";

            ctx.fillStyle =
                obj.owner === "boss"
                    ? obj.chargeLevel > 0.55
                        ? "#fff2df"
                        : "#ff8a3d"
                    : obj.chargeLevel > 0.55
                    ? "#eafcff"
                    : "cyan";

            ctx.beginPath();
            ctx.arc(obj.x, obj.y, obj.size, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }

        if (obj.type === "bossHit") {
            ctx.save();
            ctx.globalAlpha = obj.life;

            ctx.strokeStyle = obj.color;
            ctx.lineWidth = 4;

            ctx.shadowBlur = 20;
            ctx.shadowColor = obj.color;

            ctx.beginPath();
            ctx.arc(obj.x, obj.y, obj.radius, 0, Math.PI * 2);
            ctx.stroke();

            ctx.restore();
        }

        if (obj.type === "bossHitSpark") {
            ctx.save();
            ctx.globalAlpha = obj.life;

            ctx.fillStyle = obj.color;
            ctx.shadowBlur = 12;
            ctx.shadowColor = obj.color;

            ctx.beginPath();
            ctx.arc(obj.x, obj.y, 4 * obj.life, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }

        if (obj.type === "explosion") {
            ctx.save();
            ctx.fillStyle = "orange";
            ctx.globalAlpha = obj.life;

            ctx.beginPath();
            ctx.arc(obj.x, obj.y, obj.radius, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }
    }
}

// =================================================
// PLAYER
// (charge glow uses ctx.shadowBlur since a plain CSS box-shadow
// can't apply to canvas-drawn shapes)
// =================================================

function drawPlayerSmear() {
    if (player.smear <= 0) return;

    ctx.save();
    ctx.filter = "blur(15px)";
    ctx.globalAlpha = player.smear;
    ctx.fillStyle = "red";
    ctx.fillRect(player.x - player.dashDirection * 100, player.y, 150, player.height);
    ctx.restore();
}

function getActivePlayerSprite() {
    // an active, not-yet-expired click-cycle pose takes priority
    // over the normal idle/fly sprite
    if (player.strikePoseType && performance.now() < player.strikePoseUntil) {
        const poseSet = player.strikePoseType === "ground" ? punchSprites : kickSprites;
        return poseSet[player.strikePoseFrame];
    }

    // while the post-dash smear is visible, show the direction-
    // relative dash pose instead of the normal fly/idle sprite
    if (player.smear > 0) {
        return player.dashPoseType === "away" ? playerSprites.dashAway : playerSprites.fly;
    }

    // while being knocked back from a hit, show the dedicated
    // hit-away pose - independent of the smear check above; no
    // priority between them, whichever condition is true fires
    // while the hit-away pose window is active - independent of
    // how long the physics knockback (knockbackVX) actually takes
    // to fully decay, see KNOCKBACK_POSE_DURATION_MS
    if (performance.now() < player.knockbackPoseUntil) {
        return playerSprites.hitAway;
    }

    // SPACE charge shot - chargep1 for the entire hold, chargep2
    // for a short window after release (or until any other key
    // is pressed - see CHARGE_RELEASE_POSE_DURATION_MS). Checked
    // independently of the grounded S-charge below; whichever
    // condition is true fires, no override priority between them.
    if (player.charging) {
        return playerSprites.chargeP1;
    }

    if (performance.now() < player.chargeReleasePoseUntil) {
        return playerSprites.chargeP2;
    }

    // grounded power-charge (holding S while not flying) - shown
    // independently of the checks above, whichever is true fires
    if (player.regening && player.grounded) {
        return playerSprites.charge;
    }

    return player.flying ? playerSprites.fly : playerSprites.idle;
}

function drawPlayer() {
    ctx.save();

    if (player.charging) {
        const chargePct = clamp(player.chargeDrained / player.maxPower, 0, 1);
        ctx.shadowBlur = 25 + chargePct * 35;
        ctx.shadowColor = "orange";
    } else if (player.regening) {
        ctx.shadowBlur = 30;
        ctx.shadowColor = "orange";
    }

    const sprite = getActivePlayerSprite();

    if (sprite.loaded) {
        const drawW = player.width * PLAYER_SPRITE_SCALE;
        const drawH = player.height * PLAYER_SPRITE_SCALE;

        // anchor bottom-center to the hitbox, so the visual size
        // grows without moving the character's feet or changing
        // any collision math elsewhere
        const centerX = player.x + player.width / 2;
        const footY = player.y + player.height;
        const drawY = -drawH + PLAYER_SPRITE_Y_OFFSET; // relative to footY

        // mirror horizontally around the sprite's own center based
        // on player.facing (1 = right/unflipped, -1 = left/mirrored).
        // assumes the source art faces right by default - flip the
        // sign here if it turns out to face left instead.
        // origin is pinned to the feet (not the top of the hitbox)
        // so the knockback tilt below pivots from the ground, not
        // from somewhere above the character's head.
        ctx.translate(centerX, footY);
        ctx.scale(player.facing, 1);

        // knockback tilt - snaps to a fixed angle for the same
        // short pose window as the hit-away sprite above (not
        // tied to the full physics knockback decay), snaps back
        // to 0 the instant the window ends. Leans in the direction
        // of the knockback push, like a punch impact.
        // multiplying by player.facing cancels out the mirror
        // above so the lean direction is correct in world space
        // regardless of which way the player is currently facing.
        if (performance.now() < player.knockbackPoseUntil && player.knockbackVX !== 0) {
            const tiltRadians = (PLAYER_KNOCKBACK_TILT_DEGREES * Math.PI) / 180;
            const tiltSign = Math.sign(player.knockbackVX);
            ctx.rotate(tiltSign * player.facing * tiltRadians);
        }

        ctx.drawImage(sprite.img, -drawW / 2, drawY, drawW, drawH);
    } else {
        // fallback while the sprite is still loading (or missing)
        ctx.fillStyle = "red";
        ctx.fillRect(player.x, player.y, player.width, player.height);
    }

    ctx.restore();
}

// =================================================
// MAIN DRAW
// =================================================

export function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawBackground();

    ctx.save();

    // screen shake (combo-hit / big-hit / explosion feedback) -
    // offsets the whole world render by a small decaying random amount
    let shakeX = 0,
        shakeY = 0;

    if (screenShake.time > 0) {
        const power = screenShake.magnitude * (screenShake.time / SHAKE_DURATION_FRAMES);
        shakeX = (Math.random() - 0.5) * 2 * power;
        shakeY = (Math.random() - 0.5) * 2 * power;
    }

    ctx.translate(-camera.x + shakeX, shakeY);

    drawGround();

    drawPlayerSmear();

    // flame particles drawn BEHIND player so the body reads
    // clearly against the glow
    drawFlameParticles();

    // bosses drawn before the player so the player reads on top
    for (const b of bosses) {
        drawBoss(b);
        drawBossDeathPieces(b);
    }

    drawPlayer();

    drawActiveObjects();

    ctx.restore();
}
