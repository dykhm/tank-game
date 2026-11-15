import { HEIGHT, WIDTH } from "./constants.js";

export const wrap = (value, max) => ((value % max) + max) % max;

export function wrapDelta(d, max) {
	if (d > max / 2) return d - max;
	if (d < -max / 2) return d + max;
	return d;
}

export function lerpWrap(a, b, t, max) {
	return wrap(a + wrapDelta(b - a, max) * t, max);
}

export function lerpAngle(a, b, t) {
	const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
	return a + d * t;
}

export function integrate(entity, dt) {
	entity.x = wrap(entity.x + entity.vx * dt, WIDTH);
	entity.y = wrap(entity.y + entity.vy * dt, HEIGHT);
}