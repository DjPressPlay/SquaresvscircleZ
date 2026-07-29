// =================================================
// MATH / EASING HELPERS
// =================================================

export function lerp(a, b, t) {
    return a + (b - a) * t;
}

export function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

export function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

export function easeInCubic(t) {
    return t * t * t;
}

// slight overshoot on the way out - gives a soft, springy
// "settle" instead of a hard stop
export function easeOutBack(t) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// generic critically-damped-ish spring step. mutates nothing -
// returns [newPos, newVel] so callers decide what to store.
export function springStep(pos, vel, target, stiffness, damping) {
    const force = (target - pos) * stiffness - vel * damping;
    vel += force;
    pos += vel;
    return [pos, vel];
}
