import { DT, HEIGHT, WIDTH } from "./constants.js";
import { lerpAngle, lerpWrap, wrap, wrapDelta } from "./physics.js";
import { seqDiff } from "./protocol.js";
import { stepTank } from "./sim.js";

const MAX_PENDING = 120;
const SNAP_DISTANCE = 100;

export class Predictor {
	constructor() {
		this.reset();
	}

	reset() {
		this.seq = 0;
		this.pending = []; 
		this.tank = null;
		this.prev = null;
		this.offset = { x: 0, y: 0 }; 
		this.error = 0; 
	}

	tick(bits) {
		this.seq = (this.seq + 1) & 0xffff;
		const input = { seq: this.seq, bits };
		this.pending.push(input);
		if (this.pending.length > MAX_PENDING) this.pending.shift();

		let fired = null;
		if (this.tank) {
			this.prev = { x: this.tank.x, y: this.tank.y, angle: this.tank.angle };
			fired = stepTank(this.tank, bits, DT);
		}
		return { input, fired };
	}

	acknowledge(ack) {
		this.pending = this.pending.filter((i) => seqDiff(i.seq, ack) > 0);
	}

	reconcile(own, ack) {
		this.acknowledge(ack);

		const next = { ...own, vx: 0, vy: 0 };
		for (const i of this.pending) stepTank(next, i.bits, DT);

		if (!this.tank) {
			this.tank = next;
			this.prev = { x: next.x, y: next.y, angle: next.angle };
			this.error = 0;
			return 0;
		}

		const ex = wrapDelta(this.tank.x - next.x, WIDTH);
		const ey = wrapDelta(this.tank.y - next.y, HEIGHT);
		const error = Math.sqrt(ex * ex + ey * ey);

		if (error > SNAP_DISTANCE) {
			this.offset = { x: 0, y: 0 };
			this.prev = { x: next.x, y: next.y, angle: next.angle };
		} else {
			this.offset.x += ex;
			this.offset.y += ey;
			this.prev.x -= ex;
			this.prev.y -= ey;
		}
		this.tank = next;
		this.error = error;
		return error;
	}

	decay(dtSeconds, smoothMs) {
		const k = smoothMs > 0 ? Math.exp((-dtSeconds * 3000) / smoothMs) : 0;
		this.offset.x *= k;
		this.offset.y *= k;
	}

	position(alpha) {
		if (!this.tank) return null;
		const { prev, tank, offset } = this;
		return {
			x: wrap(lerpWrap(prev.x, tank.x, alpha, WIDTH) + offset.x, WIDTH),
			y: wrap(lerpWrap(prev.y, tank.y, alpha, HEIGHT) + offset.y, HEIGHT),
			angle: lerpAngle(prev.angle, tank.angle, alpha),
		};
	}
}