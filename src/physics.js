import { Vector2 } from "./vector2";

const wrap = (value, max) => ((value % max) + max) % max;

export function integrate(entity, dt) {
	entity.position = entity.position.add(entity.velocity.scale(dt));
}

export function wrapAround(position, width = window.innerWidth, height = window.innerHeight) {
	return new Vector2(wrap(position.x, width), wrap(position.y, height));
}