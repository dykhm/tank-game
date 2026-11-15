import {
	addTank,
	createRng,
	createWorld,
	DT,
	decodeInputs,
	decodeSnapshot,
	encodeInputs,
	encodeInputsJson,
	encodeSnapshot,
	encodeSnapshotJson,
	INPUT,
	Predictor,
	rand,
	snapshot,
	stateHash,
	step,
} from "../../shared/index.js";

function bot(seed) {
	const rng = createRng(seed);
	let bits = 0;
	return () => {
		if (rand(rng) < 0.08) {
			bits = [
				0,
				INPUT.UP,
				INPUT.DOWN,
				INPUT.LEFT,
				INPUT.RIGHT,
				INPUT.UP | INPUT.RIGHT,
				INPUT.DOWN | INPUT.LEFT,
			][Math.floor(rand(rng) * 7)];
		}
		return rand(rng) < 0.1 ? bits | INPUT.FIRE : bits;
	};
}

function makeWorld(seed) {
	const world = createWorld(seed, { missileInterval: 1.2, maxMissiles: 10 });
	addTank(world, 1);
	addTank(world, 2);
	return world;
}

function run(world, ticks, bots) {
	let seq = 0;
	for (let i = 0; i < ticks; i++) {
		seq++;
		const inputs = new Map(bots.map((b, n) => [n + 1, { seq, bits: b() }]));
		step(world, inputs);
	}
}

const a = makeWorld(12345);
const b = makeWorld(12345);
const c = makeWorld(54321);
run(a, 1800, [bot(1), bot(2)]);
run(b, 1800, [bot(1), bot(2)]);
run(c, 1800, [bot(1), bot(2)]);
console.log("== детермінізм (1800 кроків = 60 с)");
console.log(
	"  той самий seed:",
	stateHash(a).toString(16),
	stateHash(b).toString(16),
	stateHash(a) === stateHash(b) ? "OK" : "FAIL",
);
console.log(
	"  інший seed    :",
	stateHash(c).toString(16),
	stateHash(a) !== stateHash(c) ? "OK (відрізняється)" : "FAIL",
);

const w = makeWorld(777);
run(w, 400, [bot(3), bot(4)]);
const snap = snapshot(w, 1234);
const bin = encodeSnapshot(snap);
const back = decodeSnapshot(bin);
let maxPos = 0;
for (const [i, t] of snap.tanks.entries()) {
	maxPos = Math.max(
		maxPos,
		Math.abs(t.x - back.tanks[i].x),
		Math.abs(t.y - back.tanks[i].y),
	);
}
const ok =
	back.tick === snap.tick &&
	back.ack === 1234 &&
	back.tanks.length === snap.tanks.length &&
	back.bullets.length === snap.bullets.length;
const json = encodeSnapshotJson(snap);
const inputs = [
	{ seq: 65534, bits: 9 },
	{ seq: 65535, bits: 17 },
	{ seq: 0, bits: 8 },
];
const inBack = decodeInputs(encodeInputs(inputs));
console.log("\n== протокол");
console.log(
	`  snapshot round-trip: ${ok ? "OK" : "FAIL"}, макс. похибка позиції ${maxPos.toFixed(3)} px`,
);
console.log(
	`  input round-trip   : ${JSON.stringify(inBack) === JSON.stringify(inputs) ? "OK" : "FAIL"}`,
);
console.log(
	`  у знімку: ${snap.tanks.length} кораблі, ${snap.bullets.length} куль, ${snap.missiles.length} ракет, ${snap.pickups.length} бонус`,
);
console.log("  | пакет | JSON, байт | бінарний, байт |");
console.log("  |---|---|---|");
console.log(`  | знімок | ${json.length} | ${bin.byteLength} |`);
console.log(
	`  | 1 input | ${encodeInputsJson(inputs.slice(0, 1)).length} | ${encodeInputs(inputs.slice(0, 1)).byteLength} |`,
);
console.log(
	`  | 4 input (з повтором) | ${encodeInputsJson(inputs.concat(inputs[0])).length} | ${encodeInputs(inputs.concat(inputs[0])).byteLength} |`,
);
console.log(
	`  знімки при 30/с на одного клієнта: JSON ${((json.length * 30) / 1024).toFixed(1)} КБ/с, бінарно ${((bin.byteLength * 30) / 1024).toFixed(1)} КБ/с`,
);

function drift(oneWay, jitter, ticks = 1800) {
	const world = makeWorld(999);
	const rng = createRng(4242);
	const myBot = bot(10);
	const otherBot = bot(11);
	const predictor = new Predictor();

	const toServer = [];
	const toClient = [];
	const queue = [];
	let applied = 0;
	let held = 0;
	const errors = [];

	for (let k = 0; k < ticks; k++) {
		predictor.tick(myBot());
		const delay = oneWay + Math.floor(rand(rng) * (jitter + 1));
		for (const i of predictor.pending.slice(-4))
			toServer.push({ at: k + delay, input: i });

		for (const m of toServer.filter((m) => m.at <= k)) {
			if (m.input.seq > applied && !queue.some((q) => q.seq === m.input.seq))
				queue.push(m.input);
		}
		toServer.splice(0, toServer.length, ...toServer.filter((m) => m.at > k));
		queue.sort((x, y) => x.seq - y.seq);
		const next = queue.shift();
		if (next) {
			applied = next.seq;
			held = next.bits;
		}
		step(
			world,
			new Map([
				[1, { seq: applied, bits: next ? next.bits : held & ~INPUT.FIRE }],
				[2, { seq: k, bits: otherBot() }],
			]),
		);
		toClient.push({
			at: k + oneWay + Math.floor(rand(rng) * (jitter + 1)),
			snap: snapshot(world, applied),
		});

		const due = toClient
			.filter((m) => m.at <= k)
			.sort((x, y) => x.snap.tick - y.snap.tick);
		toClient.splice(0, toClient.length, ...toClient.filter((m) => m.at > k));
		for (const m of due) {
			const own = decodeSnapshot(encodeSnapshot(m.snap)).tanks.find(
				(t) => t.id === 1,
			);
			const err = predictor.reconcile(own, m.snap.ack);
			if (k > 60 && err < 100) errors.push(err);
		}
	}
	errors.sort((x, y) => x - y);
	const mean = errors.reduce((s, e) => s + e, 0) / errors.length;
	return {
		mean,
		p95: errors[Math.floor(errors.length * 0.95)],
		max: errors[errors.length - 1],
	};
}

console.log("\n== поправка при передбаченні (px на знімок), 60 с");
console.log("  | RTT (≈) | розкид | сер. | p95 | макс |");
console.log("  |---|---|---|---|---|");
for (const [oneWay, jitter] of [
	[0, 0],
	[1, 0],
	[2, 0],
	[2, 2],
	[3, 3],
]) {
	const r = drift(oneWay, jitter);
	console.log(
		`  | ${Math.round(oneWay * 2 * DT * 1000)} мс | 0..${Math.round(jitter * DT * 1000)} мс | ${r.mean.toFixed(3)} | ${r.p95.toFixed(3)} | ${r.max.toFixed(3)} |`,
	);
}
