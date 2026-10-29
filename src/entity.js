import { integrate } from "./physics";

export class Entity {
	static #nextId = 1;
	#id = Entity.#nextId++;

	constructor(position, velocity, radius, kind) {
		this.position = position;
		this.velocity = velocity;
		this.radius = radius;
		this.kind = kind;

		this.previousPosition = position;
		this.dead = false;
		this.ttl = Infinity;
		this.world = null;
		this.components = new Map();
	}

	get id() {
		return this.#id;
	}

	with(component) {
		this.components.set(component.name, component);
		return this;
	}

	has(name) {
		return this.components.has(name);
	}

	get(name) {
		return this.components.get(name);
	}

	update(dt) {
		this.previousPosition = this.position;

		for (const component of this.components.values()) {
			component.update?.(this, dt);
		}

		integrate(this, dt);

		this.ttl -= dt;
		if (this.ttl <= 0) {
			this.dead = true;
		}
	}
}