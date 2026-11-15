import { PROTOCOL_VERSION } from "./constants.js";

export const MSG = { SNAPSHOT: 1, INPUT: 2, PING: 3, PONG: 4 };
const LE = true;

export const seqDiff = (a, b) => ((a - b + 0x8000) & 0xffff) - 0x8000;

const POS_SCALE = 16;
const clamp = (v, max) => Math.max(0, Math.min(max, v));
const qPos = (v) => clamp(Math.round(v * POS_SCALE), 0xffff);
const dPos = (q) => q / POS_SCALE;
const qAngle = (a) => Math.round((a / Math.PI) * 32767);
const dAngle = (q) => (q / 32767) * Math.PI;

class Writer {
	constructor(size) {
		this.view = new DataView(new ArrayBuffer(size));
		this.o = 0;
	}
	u8(v) {
		this.view.setUint8(this.o, v);
		this.o += 1;
	}
	u16(v) {
		this.view.setUint16(this.o, v, LE);
		this.o += 2;
	}
	i16(v) {
		this.view.setInt16(this.o, v, LE);
		this.o += 2;
	}
	u32(v) {
		this.view.setUint32(this.o, v, LE);
		this.o += 4;
	}
	get buffer() {
		return this.view.buffer;
	}
}

class Reader {
	constructor(data) {
		this.view = ArrayBuffer.isView(data)
			? new DataView(data.buffer, data.byteOffset, data.byteLength)
			: new DataView(data);
		this.o = 0;
	}
	u8() {
		const v = this.view.getUint8(this.o);
		this.o += 1;
		return v;
	}
	u16() {
		const v = this.view.getUint16(this.o, LE);
		this.o += 2;
		return v;
	}
	i16() {
		const v = this.view.getInt16(this.o, LE);
		this.o += 2;
		return v;
	}
	u32() {
		const v = this.view.getUint32(this.o, LE);
		this.o += 4;
		return v;
	}
}

function header(reader, expectedType) {
	const version = reader.u8();
	if (version !== PROTOCOL_VERSION) throw new Error(`bad protocol version ${version}`);
	const type = reader.u8();
	if (expectedType !== undefined && type !== expectedType) throw new Error(`bad type ${type}`);
	return type;
}

export function messageType(data) {
	return header(new Reader(data));
}

export function encodeSnapshot(s) {
	const w = new Writer(
		13 + 13 * s.tanks.length + 9 * s.bullets.length + 6 * s.missiles.length + 7 * s.pickups.length,
	);
	w.u8(PROTOCOL_VERSION);
	w.u8(MSG.SNAPSHOT);
	w.u32(s.tick);
	w.u16(s.ack);
	w.u8(s.tanks.length);
	w.u16(s.bullets.length);
	w.u8(s.missiles.length);
	w.u8(s.pickups.length);

	for (const t of s.tanks) {
		w.u8(t.id);
		w.u16(qPos(t.x));
		w.u16(qPos(t.y));
		w.i16(qAngle(t.angle));
		w.u8(t.hp);
		w.u8(t.dead ? 1 : 0);
		w.u8(clamp(Math.round(t.cooldown * 1000), 255));
		w.u8(clamp(t.homingShots, 255));
		w.u16(clamp(t.score, 0xffff));
	}
	for (const b of s.bullets) {
		w.u16(b.id);
		w.u8(b.owner);
		w.u16(b.seq);
		w.u16(qPos(b.x));
		w.u16(qPos(b.y));
	}
	for (const m of s.missiles) {
		w.u16(m.id);
		w.u16(qPos(m.x));
		w.u16(qPos(m.y));
	}
	for (const p of s.pickups) {
		w.u16(p.id);
		w.u8(p.type);
		w.u16(qPos(p.x));
		w.u16(qPos(p.y));
	}
	return w.buffer;
}

export function decodeSnapshot(data) {
	const r = new Reader(data);
	header(r, MSG.SNAPSHOT);
	const tick = r.u32();
	const ack = r.u16();
	const nTanks = r.u8();
	const nBullets = r.u16();
	const nMissiles = r.u8();
	const nPickups = r.u8();

	const s = { tick, ack, tanks: [], bullets: [], missiles: [], pickups: [] };
	for (let i = 0; i < nTanks; i++) {
		s.tanks.push({
			id: r.u8(),
			x: dPos(r.u16()),
			y: dPos(r.u16()),
			angle: dAngle(r.i16()),
			hp: r.u8(),
			dead: r.u8() === 1,
			cooldown: r.u8() / 1000,
			homingShots: r.u8(),
			score: r.u16(),
		});
	}
	for (let i = 0; i < nBullets; i++) {
		s.bullets.push({ id: r.u16(), owner: r.u8(), seq: r.u16(), x: dPos(r.u16()), y: dPos(r.u16()) });
	}
	for (let i = 0; i < nMissiles; i++) {
		s.missiles.push({ id: r.u16(), x: dPos(r.u16()), y: dPos(r.u16()) });
	}
	for (let i = 0; i < nPickups; i++) {
		s.pickups.push({ id: r.u16(), type: r.u8(), x: dPos(r.u16()), y: dPos(r.u16()) });
	}
	return s;
}

const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;

export function encodeSnapshotJson(s) {
	return JSON.stringify({
		type: "snap",
		tick: s.tick,
		ack: s.ack,
		tanks: s.tanks.map((t) => ({
			id: t.id,
			x: r2(t.x),
			y: r2(t.y),
			angle: r3(t.angle),
			hp: t.hp,
			dead: t.dead,
			cooldown: r3(t.cooldown),
			homingShots: t.homingShots,
			score: t.score,
		})),
		bullets: s.bullets.map((b) => ({ id: b.id, owner: b.owner, seq: b.seq, x: r2(b.x), y: r2(b.y) })),
		missiles: s.missiles.map((m) => ({ id: m.id, x: r2(m.x), y: r2(m.y) })),
		pickups: s.pickups.map((p) => ({ id: p.id, type: p.type, x: r2(p.x), y: r2(p.y) })),
	});
}

export function encodeInputs(inputs) {
	const w = new Writer(3 + 3 * inputs.length);
	w.u8(PROTOCOL_VERSION);
	w.u8(MSG.INPUT);
	w.u8(inputs.length);
	for (const i of inputs) {
		w.u16(i.seq);
		w.u8(i.bits);
	}
	return w.buffer;
}

export function decodeInputs(data) {
	const r = new Reader(data);
	header(r, MSG.INPUT);
	const count = r.u8();
	const inputs = [];
	for (let i = 0; i < count; i++) inputs.push({ seq: r.u16(), bits: r.u8() });
	return inputs;
}

export function encodeInputsJson(inputs) {
	return JSON.stringify({ type: "input", inputs });
}

export function encodePing(type, t) {
	const w = new Writer(6);
	w.u8(PROTOCOL_VERSION);
	w.u8(type);
	w.u32(t >>> 0);
	return w.buffer;
}

export function decodePing(data) {
	const r = new Reader(data);
	const type = header(r);
	return { type, t: r.u32() };
}