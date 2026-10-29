import { Entity } from "./entity";
import { Vector2 } from "./vector2";

export class Explosion extends Entity {
	constructor(position) {
		super(position, new Vector2(), 0, "explosion");

		this.particles = Array.from({ length: 15 }, () => {
			const angle = Math.random() * Math.PI * 2;
			const speed = 30 + Math.random() * 100;

			return {
				position,
				velocity: Vector2.fromAngle(angle).scale(speed),
				life: 0.5 + Math.random() * 0.5,
			};
		});
	}

	update(dt) {
		for (const p of this.particles) {
			p.position = p.position.add(p.velocity.scale(dt));
			p.life -= dt;
		}

		this.particles = this.particles.filter((p) => p.life > 0);
		this.dead = this.particles.length === 0;
	}
}