import { explosive, homing } from "./components";
import { Entity } from "./entity";
import { Vector2 } from "./vector2";

export function createHomingMissile(position) {
	const missile = new Entity(position, new Vector2(), 10, "homingMissile")
		.with(homing({ targetKind: "tank", speed: 100 }))
		.with(explosive());

	missile.ttl = 5;
	return missile;
}