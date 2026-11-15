export const PROTOCOL_VERSION = 1;

export const TICK_RATE = 30;
export const DT = 1 / TICK_RATE;
export const TICK_MS = 1000 / TICK_RATE;

export const WIDTH = 1280;
export const HEIGHT = 720;

export const INPUT = { UP: 1, DOWN: 2, LEFT: 4, RIGHT: 8, FIRE: 16 };

export const TANK = {
	SPEED: 120,
	RADIUS: 12,
	MAX_HP: 3,
	FIRE_COOLDOWN: 0.25,
	NOSE_OFFSET: 38,
	RESPAWN_DELAY: 2,
};
export const BULLET = { SPEED: 250, RADIUS: 3, TTL: 2, TURN_RATE: 4 };
export const MISSILE = { SPEED: 100, RADIUS: 10, TTL: 5 };
export const PICKUP = { RADIUS: 10, HOMING_SHOTS: 3 };
export const PICKUP_TYPES = ["heal", "homingAmmo"];