import {
	BULLET,
	DT,
	decodePing,
	decodeSnapshot,
	encodeInputs,
	encodeInputsJson,
	encodePing,
	HEIGHT,
	integrate,
	lerpAngle,
	lerpWrap,
	MSG,
	Predictor,
	seqDiff,
	TICK_MS,
	WIDTH,
} from "../../../shared/index.js";
import { emit } from "../utils/bus";

const REDUNDANCY = 4;
const MAX_SNAPSHOTS = 40;

const clamp01 = (v) => Math.max(0, Math.min(1, v));

export class NetGame {
	constructor(
		socket,
		{ predict = true, interpMs = 100, smoothMs = 100, json = false } = {},
	) {
		Object.assign(this, { socket, predict, interpMs, smoothMs, json });
		this.predictor = new Predictor();
		this.names = new Map();
		this.#resetState();

		this.rtt = 0;
		this.correctionMax = 0;
		this.correctionHistory = [];

		socket.addEventListener("message", (e) => this.#onJson(e.detail));
		socket.addEventListener("binary", (e) => this.#onBinary(e.detail));
		setInterval(
			() => socket.sendGame(encodePing(MSG.PING, performance.now())),
			1000,
		);
	}

	#resetState() {
		this.id = null;
		this.snaps = [];
		this.latest = null;
		this.clockOffset = null;
		this.lastRecv = 0;
		this.localBullets = [];
		this.predictor.reset();
	}

	#onJson(m) {
		if (m.type === "welcome") {
			this.#resetState();
			this.id = m.id;
		} else if (m.type === "joined") {
			for (const p of m.players) this.names.set(p.id, p.name);
		} else if (m.type === "snap") {
			this.#onSnapshot(m);
		}
	}

	#onBinary(buffer) {
		try {
			const type = new Uint8Array(buffer)[1];
			if (type === MSG.SNAPSHOT) this.#onSnapshot(decodeSnapshot(buffer));
			else if (type === MSG.PONG)
				this.rtt = performance.now() - decodePing(buffer).t;
		} catch (err) {
			console.warn("bad packet", err);
		}
	}

	#onSnapshot(snap) {
		if (this.id === null) return;
		if (this.latest && snap.tick <= this.latest.tick) return;

		const now = performance.now();
		snap.recv = now;
		this.lastRecv = now;

		const sample = snap.tick * TICK_MS - now;
		this.clockOffset =
			this.clockOffset === null
				? sample
				: this.clockOffset + (sample - this.clockOffset) * 0.1;

		this.snaps.push(snap);
		if (this.snaps.length > MAX_SNAPSHOTS) this.snaps.shift();
		this.latest = snap;

		if (!this.predict) {
			this.predictor.acknowledge(snap.ack);
			return;
		}
		const own = snap.tanks.find((t) => t.id === this.id);
		if (!own) return;

		const error = this.predictor.reconcile(own, snap.ack);
		this.correctionMax = Math.max(this.correctionMax, error);
		this.correctionHistory.push(error);
		if (this.correctionHistory.length > 90) this.correctionHistory.shift();

		const confirmed = new Set(
			snap.bullets.filter((b) => b.owner === this.id).map((b) => b.seq),
		);
		this.localBullets = this.localBullets.filter(
			(b) => seqDiff(b.seq, snap.ack) > 0 || confirmed.has(b.seq),
		);
	}

	get pendingInputs() {
		return this.predictor.pending.length;
	}

	get snapshotAge() {
		return this.lastRecv ? performance.now() - this.lastRecv : 0;
	}

	get ownState() {
		return this.latest?.tanks.find((t) => t.id === this.id) ?? null;
	}

	tick(bits) {
		if (this.id === null) return;
		const { input, fired } = this.predictor.tick(bits);

		const batch = this.predictor.pending.slice(-REDUNDANCY);
		this.socket.sendGame(
			this.json ? encodeInputsJson(batch) : encodeInputs(batch),
		);

		if (this.predict && fired && !fired.homing) {
			this.localBullets.push({ ...fired, seq: input.seq, ttl: BULLET.TTL });
			emit("fired");
		}
		for (const b of this.localBullets) {
			integrate(b, DT);
			b.ttl -= DT;
		}
		this.localBullets = this.localBullets.filter((b) => b.ttl > 0);
	}

	view(frameDt, alpha) {
		if (!this.latest) return null;
		this.predictor.decay(frameDt, this.smoothMs);

		const renderTime = performance.now() + this.clockOffset - this.interpMs;
		let a = this.snaps[0];
		let b = a;
		for (let i = this.snaps.length - 1; i >= 0; i--) {
			if (this.snaps[i].tick * TICK_MS <= renderTime) {
				a = this.snaps[i];
				b = this.snaps[i + 1] ?? a;
				break;
			}
		}
		const span = (b.tick - a.tick) * TICK_MS;
		const t = span > 0 ? clamp01((renderTime - a.tick * TICK_MS) / span) : 0;

		const blend = (listA, listB, angles) => {
			const before = new Map(listA.map((e) => [e.id, e]));
			return listB.map((e) => {
				const p = before.get(e.id);
				if (!p || p.dead || e.dead) return e;
				const out = {
					...e,
					x: lerpWrap(p.x, e.x, t, WIDTH),
					y: lerpWrap(p.y, e.y, t, HEIGHT),
				};
				if (angles) out.angle = lerpAngle(p.angle, e.angle, t);
				return out;
			});
		};

		const tanks = blend(a.tanks, b.tanks, true).map((tank) => ({
			...tank,
			own: tank.id === this.id,
		}));
		const own = tanks.find((tank) => tank.own);
		if (own) {
			if (this.predict) {
				const p = this.predictor.position(alpha);
				if (p) Object.assign(own, p);
			} else {
				Object.assign(own, this.ownState);
			}
		}

		const bullets = blend(a.bullets, b.bullets, false).filter(
			(bullet) => !(this.predict && bullet.owner === this.id),
		);
		return {
			tanks,
			bullets: bullets.concat(this.localBullets),
			missiles: blend(a.missiles, b.missiles, false),
			pickups: b.pickups,
		};
	}
}
