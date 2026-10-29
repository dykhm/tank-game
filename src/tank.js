import { Bullet } from "./bullet";
import { explosive, homing } from "./components";
import { Entity } from "./entity";
import { wrapAround } from "./physics";
import { Vector2 } from "./vector2";

const SPEED = 120;
const BULLET_SPEED = 250;
const MAX_HP = 3;
const FIRE_COOLDOWN = 0.25;
const NOSE_OFFSET = 38; 

export class Tank extends Entity {
	#hp = MAX_HP;
	#cooldown = 0;

	constructor(position, input) {
		super(position, new Vector2(), 12, "tank");
		this.input = input;
		this.angle = 0;
		this.previousAngle = 0;
		this.homingShots = 0;
		this.with(explosive());
	}

	get hp() {
		return this.#hp;
	}

	update(dt) {
		this.previousAngle = this.angle;
		this.#cooldown = Math.max(0, this.#cooldown - dt);

		const direction = new Vector2(
			Number(this.input("right")) - Number(this.input("left")),
			Number(this.input("down")) - Number(this.input("up")),
		);

		this.velocity = direction.normalize().scale(SPEED);
		if (direction.length() > 0) {
			this.angle = Math.atan2(direction.y, direction.x) + Math.PI / 2;
		}

		super.update(dt);
		this.position = wrapAround(this.position);
	}

	takeDamage(amount = 1) {
		this.#hp = Math.max(0, this.#hp - amount);
		if (this.#hp === 0) {
			this.dead = true;
		}
	}

	heal(amount = 1) {
		this.#hp = Math.min(MAX_HP, this.#hp + amount);
	}

	addHomingShots(count) {
		this.homingShots += count;
	}

	fire() {
		if (this.dead || this.#cooldown > 0) return;
		this.#cooldown = FIRE_COOLDOWN;

		const direction = new Vector2(Math.sin(this.angle), -Math.cos(this.angle));
		const nose = this.position.add(direction.scale(NOSE_OFFSET));
		const bullet = new Bullet(nose, direction.scale(BULLET_SPEED), this);

		if (this.homingShots > 0) {
			this.homingShots--;
			bullet.with(
				homing({
					targetKind: "homingMissile",
					speed: BULLET_SPEED,
					turnRate: 4,
				}),
			);
		}

		this.world.spawn(bullet);
	}
}
