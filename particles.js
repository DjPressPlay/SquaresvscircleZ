// =================================================
// FLAME / DUST PARTICLES
// Reused for charge FX, power regen/boost FX, dash trails,
// and the dust kicked up during knockback slides.
// =================================================

import { ctx } from "./dom.js";
import { flameParticles, world, player } from "./state.js";

export function spawnFlameParticle(color = "orange", owner = player, speedMultiplier = 1) {
    const cx = owner.x + owner.width / 2;
    const cy = owner.y + owner.height / 2;

    const edgeAngle = Math.random() * Math.PI * 2;
    const spawnRadius = 30 + Math.random() * 10;

    flameParticles.push({
        x: cx + Math.cos(edgeAngle) * spawnRadius,
        y: cy + Math.sin(edgeAngle) * spawnRadius,

        vx: (Math.random() - 0.5) * 1.2 * speedMultiplier,
        vy: (-1 - Math.random() * 1.5) * speedMultiplier,

        size: 6 + Math.random() * 8,

        life: 1,

        color,
    });
}

// dust kicked up along the ground while an entity is being
// slid by knockback - grounds the slide as a real physical
// shove instead of just a screen-space nudge
export function spawnDustParticle(entity) {
    const footX = entity.x + entity.width / 2;

    flameParticles.push({
        x: footX + (Math.random() - 0.5) * 24,
        y: world.groundY - Math.random() * 6,

        vx: (Math.random() - 0.5) * 1.5,
        vy: -0.4 - Math.random() * 0.6,

        size: 8 + Math.random() * 10,

        life: 1,

        color: "dust",
    });
}

export function updateFlameParticles() {
    for (let i = flameParticles.length - 1; i >= 0; i--) {
        const p = flameParticles[i];

        p.x += p.vx;
        p.y += p.vy;

        p.life -= 0.045;
        p.size *= 0.96;

        if (p.life <= 0) {
            flameParticles.splice(i, 1);
        }
    }
}

export function drawFlameParticles() {
    for (const p of flameParticles) {
        ctx.save();

        ctx.globalAlpha = Math.max(0, p.life);

        const isCyan = p.color === "cyan";
        const isWhite = p.color === "white";
        const isDust = p.color === "dust";

        ctx.shadowBlur = isDust ? 6 : 18;
        ctx.shadowColor = isDust
            ? "rgba(150,130,100,0.5)"
            : isCyan
            ? "#22b6ff"
            : isWhite
            ? "#ffffff"
            : "orange";

        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);

        if (isDust) {
            grad.addColorStop(0, "rgba(214,196,158,0.85)");
            grad.addColorStop(0.6, "rgba(163,140,108,0.45)");
            grad.addColorStop(1, "rgba(120,100,80,0)");
        } else if (isCyan) {
            grad.addColorStop(0, "#eafcff");
            grad.addColorStop(0.5, "#22b6ff");
            grad.addColorStop(1, "rgba(0,96,198,0)");
        } else if (isWhite) {
            grad.addColorStop(0, "#ffffff");
            grad.addColorStop(0.5, "#e8e8e8");
            grad.addColorStop(1, "rgba(255,255,255,0)");
        } else {
            grad.addColorStop(0, "#fff59d");
            grad.addColorStop(0.5, "#ff9800");
            grad.addColorStop(1, "rgba(255,60,0,0)");
        }

        ctx.fillStyle = grad;

        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(p.size, 0), 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
