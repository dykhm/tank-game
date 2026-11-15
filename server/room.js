import { randomInt } from "node:crypto";
import { EventEmitter } from "node:events";
import {
	addTank,
	createWorld,
	encodeSnapshot,
	encodeSnapshotJson,
	INPUT,
	removeTank,
	seqDiff,
	snapshot,
	step,
	TICK_MS,
	TICK_RATE,
} from "../shared/index.js";

const MAX_BUFFERED = 64 * 1024;
const MAX_QUEUE = 6; 
const MAX_CATCHUP = 5; 

export class Room extends EventEmitter {
	members = new Map(); 
	world = null;
	timer = null;
	nextTickAt = 0;

	constructor({ id, name, max, arena }) {
		super();
		Object.assign(this, { id, name, max, arena });
	}

	#freeId() {
		const used = new Set([...this.members.values()].map((p) => p.id));
		for (let id = 1; id < 256; id++) if (!used.has(id)) return id;
		throw new Error("no free player id");
	}

	join(ws, name, format = "bin") {
		const player = {
			id: this.#freeId(),
			name,
			format,
			queue: [],
			recvSeq: 0, 
			applied: 0, 
			bits: 0,
		};
		this.members.set(ws, player);

		if (!this.world) this.#start();
		addTank(this.world, player.id);

		ws.send(
			JSON.stringify({
				type: "welcome",
				id: player.id,
				seed: this.seed,
				tickRate: TICK_RATE,
				tick: this.world.tick,
			}),
		);
		this.emit("join", { name });
		this.broadcast({ type: "joined", name, players: this.#players() });
	}

	leave(ws) {
		const player = this.members.get(ws);
		if (!player) return;
		this.members.delete(ws);
		if (this.world) removeTank(this.world, player.id);
		this.emit("leave", { name: player.name });
		this.broadcast({ type: "left", name: player.name });
		if (this.members.size === 0) {
			this.#stop();
			this.emit("empty");
		}
	}

	chat(ws, text) {
		const name = this.members.get(ws).name;
		this.emit("chat", { name, text });
		this.broadcast({ type: "chat", name, text });
	}

	input(ws, inputs) {
		const player = this.members.get(ws);
		for (const { seq, bits } of inputs) {
			if (seqDiff(seq, player.recvSeq) <= 0) continue; 
			player.recvSeq = seq;
			player.queue.push({ seq, bits: bits & 31 });
		}
	}

	#players() {
		return [...this.members.values()].map((p) => ({ id: p.id, name: p.name }));
	}

	broadcast(message) {
		const data = JSON.stringify(message);
		for (const ws of this.members.keys()) {
			if (ws.readyState !== ws.OPEN) continue;
			if (ws.bufferedAmount > MAX_BUFFERED) continue;
			ws.send(data);
		}
	}

	#start() {
		this.seed = randomInt(2 ** 32);
		this.world = createWorld(this.seed, this.arena);
		this.nextTickAt = performance.now();

		const run = () => {
			const now = performance.now();
			let steps = 0;
			while (this.nextTickAt <= now && steps < MAX_CATCHUP) {
				this.#tick();
				this.nextTickAt += TICK_MS;
				steps++;
			}
			if (this.nextTickAt < now) this.nextTickAt = now; 
			this.timer = setTimeout(run, Math.max(0, this.nextTickAt - performance.now()));
		};
		run();
	}

	#stop() {
		clearTimeout(this.timer);
		this.timer = null;
		this.world = null;
	}

	#tick() {
		const inputs = new Map();
		for (const p of this.members.values()) {
			if (p.queue.length > MAX_QUEUE) p.queue.splice(0, p.queue.length - MAX_QUEUE);
			const next = p.queue.shift();
			if (next) {
				p.applied = next.seq;
				p.bits = next.bits;
				inputs.set(p.id, next);
			} else {
				inputs.set(p.id, { seq: p.applied, bits: p.bits & ~INPUT.FIRE });
			}
		}
		step(this.world, inputs);

		const snap = snapshot(this.world, 0);
		for (const [ws, p] of this.members) {
			if (ws.readyState !== ws.OPEN || ws.bufferedAmount > MAX_BUFFERED) continue;
			snap.ack = p.applied;
			ws.send(p.format === "json" ? encodeSnapshotJson(snap) : encodeSnapshot(snap));
		}
	}
}