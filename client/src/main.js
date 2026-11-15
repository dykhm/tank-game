import "./style.css";

import { DT, INPUT } from "../../shared/index.js";
import { loadAll, loadJson } from "./assets/assets";
import { connectAudio, unlockAudio } from "./assets/audio";
import { createInput } from "./input";
import { Lobby } from "./lobby/lobby";
import { createLobbyView } from "./lobby/lobbyView";
import { createLoop } from "./loop";
import { startChat } from "./net/chat";
import { NetGame } from "./net/game";
import { startNetgraph } from "./net/netgraph";
import { GameSocket } from "./net/socket";
import { render } from "./render";

const params = new URLSearchParams(location.search);
const num = (key, fallback) =>
	params.has(key) ? Number(params.get(key)) || 0 : fallback;
const settings = {
	predict: params.get("predict") !== "0", 
	lag: num("lag", 0), 
	jitter: num("jitter", 0), 
	loss: num("loss", 0), 
	interp: num("interp", 100), 
	smooth: num("smooth", 100), 
	json: params.get("format") === "json", 
};

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

const BIT_BY_ACTION = {
	up: INPUT.UP,
	down: INPUT.DOWN,
	left: INPUT.LEFT,
	right: INPUT.RIGHT,
};

function startGame({ name, room }) {
	unlockAudio();

	$("#lobby").hidden = true;
	$(".hud").hidden = false;
	$("#player").textContent = `${name} @ ${room.name}`;

	const protocol = location.protocol === "https:" ? "wss" : "ws";
	const socket = new GameSocket(`${protocol}://${location.host}/ws`, settings);
	socket.addEventListener("open", () =>
		socket.send({
			type: "join",
			room: room.id,
			name,
			format: settings.json ? "json" : "bin",
		}),
	);
	startChat(socket);

	const game = new NetGame(socket, {
		predict: settings.predict,
		interpMs: settings.interp,
		smoothMs: settings.smooth,
		json: settings.json,
	});
	startNetgraph(
		game,
		socket,
		`predict=${settings.predict ? "on" : "off"} lag=${settings.lag} jitter=${settings.jitter} ` +
			`loss=${settings.loss} interp=${settings.interp} smooth=${settings.smooth} ` +
			`format=${settings.json ? "json" : "bin"}`,
	);

	let firePending = false;
	const input = createInput((action) => {
		if (action === "fire") firePending = true;
	});

	function readBits() {
		let bits = 0;
		for (const [action, bit] of Object.entries(BIT_BY_ACTION))
			if (input(action)) bits |= bit;
		if (firePending) bits |= INPUT.FIRE;
		firePending = false;
		return bits;
	}

	createLoop(
		() => game.tick(readBits()),
		(alpha, frameDt) => {
			render(
				ctx,
				game.view(frameDt, alpha),
				assets.images.sprites,
				game.names,
				width,
				height,
			);

			const own = game.ownState;
			$("#hp").textContent = own?.hp ?? 0;
			$("#score").textContent = own?.score ?? 0;
			$("#homing-shots").textContent = own?.homingShots ?? 0;
			$("#respawn").textContent = own?.dead ? "destroyed, respawning..." : "";
		},
		DT,
	);
}

load();
