export class Vector2 {
	constructor(x = 0, y = 0) {
		this.x = x;
		this.y = y;
	}

	static fromAngle(angle) {
		return new Vector2(Math.cos(angle), Math.sin(angle));
	}

	add(v) {
		return new Vector2(this.x + v.x, this.y + v.y);
	}

	sub(v) {
		return new Vector2(this.x - v.x, this.y - v.y);
	}

	scale(n) {
		return new Vector2(this.x * n, this.y * n);
	}

	length() {
		return Math.hypot(this.x, this.y);
	}

	normalize() {
		const length = this.length();
		return length === 0 ? new Vector2() : this.scale(1 / length);
	}

	dot(v) {
		return this.x * v.x + this.y * v.y;
	}

	distanceTo(v) {
		return this.sub(v).length();
	}

	angle() {
		return Math.atan2(this.y, this.x);
	}
}