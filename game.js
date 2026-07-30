// =================================================
// GAME STATE MACHINE (start / playing / gameover)
// =================================================

import { overlays } from "./dom.js";
import {
    player,
    bosses,
    camera,
    activeObjects,
    flameParticles,
    screenShake,
    stats,
    keys,
    game,
} from "./state.js";
import { spawnBothBosses } from "./boss.js";
import { setOnPlayerDeath } from "./combat.js";

export function startGame() {
    game.state = "playing";

    overlays.start.style.display = "none";
    overlays.gameOver.style.display = "none";

    spawnBothBosses(bosses);
}

export function endGame() {
    game.state = "gameover";

    // freeze any in-flight input/motion so nothing keeps acting
    // after the overlay appears
    player.charging = false;
    player.knockbackVX = 0;

    for (const key in keys) {
        keys[key] = false;
    }

    overlays.finalHits.textContent = stats.hits;
    overlays.finalCombo.textContent = stats.combo;
    overlays.finalWins.textContent = stats.wins;

    overlays.gameOver.style.display = "flex";
}

export function resetGame() {
    // ---- player ----
    player.x = 250;
    player.y = 300;
    player.velocityY = 0;
    player.grounded = false;
    player.smear = 0;
    player.dashDirection = 0;
    player.flying = false;
    player.health = player.maxHealth;
    player.power = player.maxPower;
    player.charging = false;
    player.chargeFrames = 0;
    player.chargeDrained = 0;
    player.regening = false;
    player.hitStreak = 0;
    player.lastHitTime = 0;
    player.knockbackVX = 0;

    // ---- camera ----
    camera.x = 0;

    // ---- bosses ----
    for (const b of bosses) {
        b.alive = false;
        b.dying = false;
        b.deathPieces = [];
    }

    // ---- world FX ----
    activeObjects.length = 0;
    flameParticles.length = 0;
    screenShake.time = 0;
    screenShake.magnitude = 0;

    // ---- HUD stats ----
    stats.hits = 0;
    stats.combo = 0;
    stats.wins = 0;
}

export function initGameControls() {
    // wire combat.js's death trigger back to endGame without a
    // circular import between combat.js and game.js
    setOnPlayerDeath(endGame);

    overlays.startButton.addEventListener("click", () => {
        startGame();
    });

    overlays.restartButton.addEventListener("click", () => {
        resetGame();
        startGame();
    });
}
