import { Explosion } from "./explosion";
import { Vector2 } from "./vector2";

export const homing = ({ targetKind, speed, turnRate = Infinity }) => ({
	name: "homing",
	update(entity, dt) {
		const target = entity.world?.nearest(targetKind, entity.position);
		if (!target) return; 

		const desired = target.position.sub(entity.position).angle();
		const current = entity.velocity.length() > 0 ? entity.velocity.angle() : desired;

		const diff = Math.atan2(Math.sin(desired - current), Math.cos(desired - current));
		const maxTurn = turnRate * dt;
		const turn = Math.max(-maxTurn, Math.min(maxTurn, diff));

		entity.velocity = Vector2.fromAngle(current + turn).scale(speed);
	},
});

export const explosive = () => ({
	name: "explosive",
	onDeath(entity, world) {
		world.spawn(new Explosion(entity.position));
	},
});

export const pickup = (effect, color) => ({
	name: "pickup",
	effect,
	color,
});