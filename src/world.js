import { resolveCollisions } from "./collision";

export class World {
	entities = new Map(); 
	score = 0;

	spawn(entity) {
		entity.world = this;
		this.entities.set(entity.id, entity);
		return entity;
	}

	despawn(entity) {
		entity.dead = true;
	}

	get(id) {
		return this.entities.get(id);
	}

	*[Symbol.iterator]() {
		yield* this.entities.values();
	}

	*ofKind(kind) {
		for (const entity of this) {
			if (entity.kind === kind) {
				yield entity;
			}
		}
	}

	count(kind) {
		return [...this.ofKind(kind)].length;
	}

	nearest(kind, from) {
		let best = null;
		let bestDistance = Infinity;

		for (const entity of this.ofKind(kind)) {
			if (entity.dead) continue;

			const distance = entity.position.distanceTo(from);
			if (distance < bestDistance) {
				best = entity;
				bestDistance = distance;
			}
		}
		return best;
	}

	step(dt) {
		for (const entity of this) {
			if (!entity.dead) entity.update(dt);
		}

		resolveCollisions(this);
		this.sweep();
	}

	sweep() {
		for (const entity of [...this]) {
			if (!entity.dead) continue;

			this.entities.delete(entity.id);
			for (const component of entity.components.values()) {
				component.onDeath?.(entity, this);
			}
		}
	}
}