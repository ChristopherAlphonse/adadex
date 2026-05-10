import { MASCOT_COLORS } from "../../app/mascotPalette";
// ─── Mascot visual derivation (seeded from coordination id) ───────────────
export { MASCOT_COLORS };
export const ANIMATIONS = ["sway", "walk", "jog", "float", "swim-up"];
export const EXPRESSIONS = ["normal", "happy", "angry", "surprised"];
export const ACCESSORIES = [
    "none",
    "none",
    "long",
    "mohawk",
    "side-sweep",
    "curly",
    "afro",
];
export function hashString(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
}
export function seededRandom(seed) {
    let s = seed;
    return () => {
        s = (s * 16807 + 0) % 2147483647;
        return (s - 1) / 2147483646;
    };
}
export function deriveMascotVisuals(coordination) {
    const rng = seededRandom(hashString(coordination.coordinationId));
    const stored = coordination.mascot;
    return {
        color: coordination.color ??
            MASCOT_COLORS[hashString(coordination.coordinationId) % MASCOT_COLORS.length],
        animation: stored?.animation ??
            ANIMATIONS[Math.floor(rng() * ANIMATIONS.length)],
        expression: stored?.expression ??
            EXPRESSIONS[Math.floor(rng() * EXPRESSIONS.length)],
        accessory: stored?.accessory ??
            ACCESSORIES[Math.floor(rng() * ACCESSORIES.length)],
        hairColor: stored?.hairColor ?? undefined,
    };
}
