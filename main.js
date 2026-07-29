// =================================================
// MAIN - ENTRY POINT
// Imports every module so their side effects (DOM listeners,
// element lookups) register, then runs the game loop.
// =================================================

import "./dom.js";
import { game } from "./state.js";
import { initInput } from "./input.js";
import { initGameControls } from "./game.js";
import { update } from "./update.js";
import { draw } from "./render.js";
import { updateHUD, updateStatsHUD } from "./hud.js";

initInput();
initGameControls();

function loop() {
    if (game.state === "playing") {
        update();
    }

    draw();
    updateHUD();
    updateStatsHUD();

    requestAnimationFrame(loop);
}

loop();
