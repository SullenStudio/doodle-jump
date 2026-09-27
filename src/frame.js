// Clamped delta-time. The clamp stops a backgrounded tab's first frame after
// refocus from teleporting entities straight through collision checks.
export const DT = () => Math.min(dt(), 1 / 30);
