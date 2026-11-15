import {
	BULLET,
	DT,
	HEIGHT,
	INPUT,
	MISSILE,
	PICKUP,
	PICKUP_TYPES,
	TANK,
	WIDTH,
} from "./constants.js";
import { integrate, wrap } from "./physics.js";
import { createRng, rand } from "./rng.js";

export const DEFAULT_ARENA = { missileInterval: 2.5, maxMissiles: 5 };

export function createWorld(seed, arena = DEFAULT_ARENA) {
	return {
		tick: 0,
		rng: createRng(seed),
		nextId: 1,
		arena,
		missileTimer: 0,
		tanks: [],
		bullets: [],
		missiles: [],
		pickups: [],
	};
}

const newId = (world) => {
	const id = world.nextId;
	world.nextId = (id % 65535) + 1;
	return id;
};

function randomPoint(world) {
	const x = rand(world.rng) * WIDTH;
	const y = rand(world.rng) * HEIGHT;
	return { x, y };
}

export function addTank(world, id) {
	const { x, y } = randomPoint(world);
	const tank = {
		id,
		x,
		y,
		vx: 0,
		vy: 0,
		angle: 0,
		hp: TANK.MAX_HP,
		cooldown: 0,
		homingShots: 0,
		score: 0,
		dead: false,
		respawn: 0,
	};
	world.tanks.push(tank);
	return tank;
}

export function removeTank(world, id) {
	world.tanks = world.tanks.filter((t) => t.id !== id);
	world.bullets = world.bullets.filter((b) => b.owner !== id);
}

export function stepTank(tank, bits, dt) {
	if (tank.dead) return null;
	tank.cooldown = Math.max(0, tank.cooldown - dt);

	const dx = (bits & INPUT.RIGHT ? 1 : 0) - (bits & INPUT.LEFT ? 1 : 0);
	const dy = (bits & INPUT.DOWN ? 1 : 0) - (bits & INPUT.UP ? 1 : 0);
	const length = Math.sqrt(dx * dx + dy * dy);

	tank.vx = length ? (dx / length) * TANK.SPEED : 0;
	tank.vy = length ? (dy / length) * TANK.SPEED : 0;
	if (length) {
		let angle = Math.atan2(dy, dx) + Math.PI / 2;
		if (angle > Math.PI) angle -= 2 * Math.PI;
		tank.angle = angle;
	}
	integrate(tank, dt);

	if (!(bits & INPUT.FIRE) || tank.cooldown > 0) return null;
	tank.cooldown = TANK.FIRE_COOLDOWN;

	const dirX = Math.sin(tank.angle);
	const dirY = -Math.cos(tank.angle);
	const homing = tank.homingShots > 0;
	if (homing) tank.homingShots--;
	return {
		x: wrap(tank.x + dirX * TANK.NOSE_OFFSET, WIDTH),
		y: wrap(tank.y + dirY * TANK.NOSE_OFFSET, HEIGHT),
		vx: dirX * BULLET.SPEED,
		vy: dirY * BULLET.SPEED,
		homing,
	};
}

function nearest(list, from) {
	let best = null;
	let bestDistance = Infinity;
	for (const e of list) {
		if (e.dead) continue;
		const dx = e.x - from.x;
		const dy = e.y - from.y;
		const distance = dx * dx + dy * dy;
		if (distance < bestDistance) {
			best = e;
			bestDistance = distance;
		}
	}
	return best;
}

function steer(entity, target, speed, turnRate, dt) {
	if (!target) return;
	const desired = Math.atan2(target.y - entity.y, target.x - entity.x);
	const moving = entity.vx !== 0 || entity.vy !== 0;
	const current = moving ? Math.atan2(entity.vy, entity.vx) : desired;
	const diff = Math.atan2(Math.sin(desired - current), Math.cos(desired - current));
	const maxTurn = turnRate * dt;
	const turn = Math.max(-maxTurn, Math.min(maxTurn, diff));
	entity.vx = Math.cos(current + turn) * speed;
	entity.vy = Math.sin(current + turn) * speed;
}

function overlap(a, ra, b, rb) {
	const dx = a.x - b.x;
	const dy = a.y - b.y;
	const radius = ra + rb;
	return dx * dx + dy * dy <= radius * radius;
}

function damage(tank) {
	tank.hp = Math.max(0, tank.hp - 1);
	if (tank.hp === 0) {
		tank.dead = true;
		tank.respawn = TANK.RESPAWN_DELAY;
		tank.vx = 0;
		tank.vy = 0;
	}
}

function respawn(world, tank) {
	const { x, y } = randomPoint(world);
	Object.assign(tank, { x, y, hp: TANK.MAX_HP, cooldown: 0, homingShots: 0, dead: false });
}

export function step(world, inputs) {
	world.tick++;

	for (const tank of world.tanks) {
		if (tank.dead) {
			tank.respawn -= DT;
			if (tank.respawn <= 0) respawn(world, tank);
			continue;
		}
		const input = inputs.get(tank.id);
		const spec = stepTank(tank, input?.bits ?? 0, DT);
		if (spec) {
			world.bullets.push({
				id: newId(world),
				owner: tank.id,
				seq: input.seq,
				...spec,
				ttl: BULLET.TTL,
				dead: false,
			});
		}
	}

	for (const b of world.bullets) {
		if (b.homing) steer(b, nearest(world.missiles, b), BULLET.SPEED, BULLET.TURN_RATE, DT);
		integrate(b, DT);
		b.ttl -= DT;
		if (b.ttl <= 0) b.dead = true;
	}
	for (const m of world.missiles) {
		steer(m, nearest(world.tanks, m), MISSILE.SPEED, Infinity, DT);
		integrate(m, DT);
		m.ttl -= DT;
		if (m.ttl <= 0) m.dead = true;
	}

	world.missileTimer += DT;
	if (world.missileTimer >= world.arena.missileInterval) {
		world.missileTimer = 0;
		const alive = world.tanks.filter((t) => !t.dead);
		if (alive.length > 0 && world.missiles.length < world.arena.maxMissiles) {
			const target = alive[Math.floor(rand(world.rng) * alive.length)];
			const angle = rand(world.rng) * Math.PI * 2;
			const distance = 180 + rand(world.rng) * 100;
			world.missiles.push({
				id: newId(world),
				x: wrap(target.x + Math.cos(angle) * distance, WIDTH),
				y: wrap(target.y + Math.sin(angle) * distance, HEIGHT),
				vx: 0,
				vy: 0,
				ttl: MISSILE.TTL,
				dead: false,
			});
		}
	}

	collide(world);

	world.bullets = world.bullets.filter((e) => !e.dead);
	world.missiles = world.missiles.filter((e) => !e.dead);
	world.pickups = world.pickups.filter((e) => !e.dead);

	if (world.pickups.length === 0) {
		const type = Math.floor(rand(world.rng) * PICKUP_TYPES.length);
		const { x, y } = randomPoint(world);
		world.pickups.push({ id: newId(world), type, x, y, dead: false });
	}
}

function collide(world) {
	const tanks = world.tanks;

	for (const b of world.bullets) {
		for (const m of world.missiles) {
			if (b.dead || m.dead || !overlap(b, BULLET.RADIUS, m, MISSILE.RADIUS)) continue;
			b.dead = true;
			m.dead = true;
			const owner = tanks.find((t) => t.id === b.owner);
			if (owner) owner.score++;
		}
	}
	for (const b of world.bullets) {
		for (const t of tanks) {
			if (b.dead || t.dead || b.owner === t.id) continue;
			if (!overlap(b, BULLET.RADIUS, t, TANK.RADIUS)) continue;
			b.dead = true;
			damage(t);
		}
	}
	for (const m of world.missiles) {
		for (const t of tanks) {
			if (m.dead || t.dead || !overlap(m, MISSILE.RADIUS, t, TANK.RADIUS)) continue;
			m.dead = true;
			damage(t);
		}
	}
	for (const p of world.pickups) {
		for (const t of tanks) {
			if (p.dead || t.dead || !overlap(p, PICKUP.RADIUS, t, TANK.RADIUS)) continue;
			p.dead = true;
			if (PICKUP_TYPES[p.type] === "heal") t.hp = Math.min(TANK.MAX_HP, t.hp + 1);
			else t.homingShots += PICKUP.HOMING_SHOTS;
		}
	}
}

export function snapshot(world, ack = 0) {
	return {
		tick: world.tick,
		ack,
		tanks: world.tanks.map((t) => ({
			id: t.id,
			x: t.x,
			y: t.y,
			angle: t.angle,
			hp: t.hp,
			dead: t.dead,
			cooldown: t.cooldown,
			homingShots: t.homingShots,
			score: t.score,
		})),
		bullets: world.bullets.map((b) => ({ id: b.id, owner: b.owner, seq: b.seq, x: b.x, y: b.y })),
		missiles: world.missiles.map((m) => ({ id: m.id, x: m.x, y: m.y })),
		pickups: world.pickups.map((p) => ({ id: p.id, type: p.type, x: p.x, y: p.y })),
	};
}

export function stateHash(world) {
	const text = JSON.stringify(world);
	let hash = 0x811c9dc5;
	for (let i = 0; i < text.length; i++) {
		hash ^= text.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	return hash >>> 0;
}