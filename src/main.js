import "./style.css";

import { createInput } from "./input";
import { createLoop } from "./loop";
import { createHomingMissile } from "./missile";
import { createPickup, PICKUP_TYPES } from "./pickup";
import { render } from "./render";
import { Tank } from "./tank";
import { Vector2 } from "./vector2";
import { World } from "./world";

const MISSILE_INTERVAL = 2.5;
const MAX_MISSILES = 5;
const RESPAWN_DELAY = 2;

const $ = (selector) => document.querySelector(selector);

const width = window.innerWidth;
const height = window.innerHeight;
const dpr = window.devicePixelRatio || 1;

const canvas = $(".game");
canvas.width = width * dpr;
canvas.height = height * dpr;
canvas.style.width = `${width}px`;
canvas.style.height = `${height}px`;

const ctx = canvas.getContext("2d");
ctx.scale(dpr, dpr);

const world = new World();
let tank;
let respawnTimer = 0;
let missileTimer = 0;

const input = createInput((action) => {
	if (action === "fire") tank.fire();
});

function spawnTank() {
	tank = world.spawn(new Tank(new Vector2(width / 2, height / 2), input));
	respawnTimer = RESPAWN_DELAY;
}

function spawnMissile() {
	const angle = Math.random() * Math.PI * 2;
	const distance = 180 + Math.random() * 100;
	const offset = Vector2.fromAngle(angle).scale(distance);

	world.spawn(createHomingMissile(tank.position.add(offset)));
}

function spawnPickup() {
	const types = Object.keys(PICKUP_TYPES);
	const type = types[Math.floor(Math.random() * types.length)];
	const position = new Vector2(Math.random() * width, Math.random() * height);

	world.spawn(createPickup(position, type));
}

function update(dt) {
	world.step(dt);

	if (tank.dead) {
		respawnTimer -= dt;
		if (respawnTimer <= 0) spawnTank();
	} else {
		missileTimer += dt;
		if (missileTimer >= MISSILE_INTERVAL) {
			missileTimer = 0;
			if (world.count("homingMissile") < MAX_MISSILES) spawnMissile();
		}
	}

	if (world.count("pickup") === 0) spawnPickup();
}

spawnTank();
spawnMissile();
spawnPickup();

createLoop(update, (alpha) => {
	render(ctx, world, alpha, width, height);

	$("#hp").textContent = tank.hp;
	$("#score").textContent = world.score;
	$("#homing-shots").textContent = tank.homingShots;
	$("#respawn").textContent = tank.dead
		? `respawn in ${Math.max(0, respawnTimer).toFixed(1)} s`
		: "";
});