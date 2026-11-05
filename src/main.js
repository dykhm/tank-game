import "./style.css";

import { loadAll, loadJson } from "./assets/assets";
import { connectAudio, unlockAudio } from "./assets/audio";
import { createPickup, PICKUP_TYPES } from "./components/pickup";
import { createHomingMissile } from "./entities/missile";
import { Tank } from "./entities/tank";
import { World } from "./entities/world";
import { createInput } from "./input";
import { Lobby } from "./lobby/lobby";
import { createLobbyView } from "./lobby/lobbyView";
import { createLoop } from "./loop";
import { render } from "./render";
import { Vector2 } from "./utils/vector2";

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


function drawLoading(text, progress) {
	const barWidth = 300;
	const x = (width - barWidth) / 2;
	const y = height / 2;

	ctx.clearRect(0, 0, width, height);
	ctx.fillStyle = "rgb(40, 12, 163)";
	ctx.strokeStyle = "rgb(40, 12, 163)";
	ctx.font = "20px 'Zen Dots'";
	ctx.textAlign = "center";
	ctx.fillText(text, width / 2, y - 20);
	ctx.strokeRect(x, y, barWidth, 20);
	ctx.fillRect(x, y, barWidth * progress, 20);
}

function errorText(err) {
	if (err.name === "AbortError") return "Loading cancelled";
	if (err.name === "TimeoutError") return "Network timeout";
	if (err.name === "HttpError") return `Server error: ${err.message}`;
	if (err instanceof SyntaxError) return "Broken JSON file";
	return "Network error";
}

let assets;
const lobby = new Lobby();
createLobbyView(lobby);
lobby.addEventListener("join", (event) => startGame(event.detail));

async function load() {
	$("#retry").hidden = true;

	const controller = new AbortController();
	const onKey = (e) => {
		if (e.key === "Escape") controller.abort();
	};
	window.addEventListener("keydown", onKey);

	try {
		drawLoading("Loading... (Esc = cancel)", 0);
		const manifest = await loadJson("/manifest.json", controller.signal);
		assets = await loadAll(manifest, controller.signal, (p) =>
			drawLoading("Loading... (Esc = cancel)", p),
		);

		connectAudio(assets.sounds);
		ctx.clearRect(0, 0, width, height);
		$("#lobby").hidden = false;
		lobby.start();
	} catch (err) {
		controller.abort(); 
		drawLoading(errorText(err), 0);
		$("#retry").hidden = false;
	} finally {
		window.removeEventListener("keydown", onKey);
	}
}

$("#retry").addEventListener("click", load);


let world;
let tank;
let input;
let arena;
let respawnTimer = 0;
let missileTimer = 0;

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
		if (missileTimer >= arena.missileInterval) {
			missileTimer = 0;
			if (world.count("homingMissile") < arena.maxMissiles) spawnMissile();
		}
	}

	if (world.count("pickup") === 0) spawnPickup();
}

function startGame({ name, room }) {
	unlockAudio(); 
	arena = room.arena;

	$("#lobby").hidden = true;
	$(".hud").hidden = false;
	$("#player").textContent = `${name} @ ${room.name}`;

	world = new World();
	input = createInput((action) => {
		if (action === "fire") tank.fire();
	});

	spawnTank();
	spawnMissile();
	spawnPickup();

	createLoop(update, (alpha) => {
		render(ctx, world, alpha, width, height, assets.images.sprites);

		$("#hp").textContent = tank.hp;
		$("#score").textContent = world.score;
		$("#homing-shots").textContent = tank.homingShots;
		$("#respawn").textContent = tank.dead
			? `respawn in ${Math.max(0, respawnTimer).toFixed(1)} s`
			: "";
	});
}

load();
