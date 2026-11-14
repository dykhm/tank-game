import { explosive, homing } from "../components/components";
import { Vector2 } from "../utils/vector2";
import { Entity } from "./entity";

export function createHomingMissile(position) {
	const missile = new Entity(position, new Vector2(), 10, "homingMissile")
		.with(homing({ targetKind: "tank", speed: 100 }))
		.with(explosive());

	missile.ttl = 5;
	return missile;
}
