import { Entity } from "../entities/entity";
import { Vector2 } from "../utils/vector2";
import { pickup } from "./components";

const HOMING_SHOTS = 3;

export const PICKUP_TYPES = {
	heal: { sprite: "heal", effect: (tank) => tank.heal() },
	homingAmmo: {
		sprite: "homingAmmo",
		effect: (tank) => tank.addHomingShots(HOMING_SHOTS),
	},
};

export function createPickup(position, type) {
	const { effect, sprite } = PICKUP_TYPES[type];
	return new Entity(position, new Vector2(), 10, "pickup").with(
		pickup(effect, sprite),
	);
}
