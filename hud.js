// =================================================
// HUD - HEALTH/POWER BARS + HITS/COMBO/WINS COUNTERS
// =================================================

import { hud } from "./dom.js";
import { player, stats } from "./state.js";

export function updateHUD() {
    const healthPct = Math.max(0, (player.health / player.maxHealth) * 100);
    const powerPct = Math.max(0, (player.power / player.maxPower) * 100);

    hud.healthFill.style.width = healthPct + "%";
    hud.powerFill.style.width = powerPct + "%";

    hud.healthValue.textContent = Math.round(player.health);
    hud.powerValue.textContent = player.power.toFixed(2);
}

export function updateStatsHUD() {
    hud.hitsValue.textContent = stats.hits;
    hud.comboValue.textContent = stats.combo;
    hud.winsValue.textContent = stats.wins;
}
