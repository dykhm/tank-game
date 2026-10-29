import { pickup } from "./components";
import { Entity } from "./entity";
import { Vector2 } from "./vector2";

const HOMING_SHOTS = 3;

export const PICKUP_TYPES = {
	heal: { color: "green", effect: (tank) => tank.heal() },
	homingAmmo: {
		color: "dodgerblue",
		effect: (tank) => tank.addHomingShots(HOMING_SHOTS),
	},
};

export function createPickup(position, type) {
	const { effect, color } = PICKUP_TYPES[type];
	return new Entity(position, new Vector2(), 10, "pickup").with(
		pickup(effect, color),
	);
}