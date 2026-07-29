// =================================================
// DOM REFERENCES
// Every getElementById call lives here so no other file
// needs to know the HTML structure/IDs directly.
// =================================================

export const canvas = document.getElementById("game");
export const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

export const hud = {
    healthFill: document.getElementById("healthFill"),
    powerFill: document.getElementById("powerFill"),
    healthValue: document.getElementById("healthValue"),
    powerValue: document.getElementById("powerValue"),
    hitsValue: document.getElementById("hitsValue"),
    comboValue: document.getElementById("comboValue"),
    winsValue: document.getElementById("winsValue"),
};

export const overlays = {
    start: document.getElementById("startScreen"),
    gameOver: document.getElementById("gameOverScreen"),
    startButton: document.getElementById("startButton"),
    restartButton: document.getElementById("restartButton"),
    finalHits: document.getElementById("finalHits"),
    finalCombo: document.getElementById("finalCombo"),
    finalWins: document.getElementById("finalWins"),
};
