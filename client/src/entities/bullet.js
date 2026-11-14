import { Entity } from "./entity";

export class Bullet extends Entity {
	constructor(position, velocity, owner) {
		super(position, velocity, 3, "bullet");
		this.owner = owner; 
		this.ttl = 2;
	}
}