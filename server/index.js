import { createReadStream, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join } from "node:path";
import { pipeline } from "node:stream";
import { WebSocketServer } from "ws";
import { config } from "./config.js";
import { createMatchLog } from "./matchLog.js";
import { Room } from "./room.js";

const PRESETS = [
	{ id: "easy", name: "Easy", max: 4, arena: { missileInterval: 4, maxMissiles: 3 } },
	{ id: "normal", name: "Normal", max: 4, arena: { missileInterval: 2.5, maxMissiles: 5 } },
	{ id: "hard", name: "Hard", max: 8, arena: { missileInterval: 1.2, maxMissiles: 10 } },
];

const MIME = {
	".html": "text/html",
	".js": "text/javascript",
	".css": "text/css",
	".json": "application/json",
	".png": "image/png",
	".wav": "audio/wav",
	".ndjson": "application/x-ndjson",
};

const MAX_MESSAGE = 1024; 
const MAX_PER_SECOND = 20; 
const JOIN_TIMEOUT = 5000;
const PING_INTERVAL = 15000;

mkdirSync(config.logDir, { recursive: true });
const rooms = new Map();


function createRoom(preset) {
	const room = new Room(preset);
	const log = createMatchLog(join(config.logDir, `${preset.id}.ndjson`));
	for (const type of ["join", "leave", "chat"]) {
		room.on(type, (data) => log.write({ type, ...data }));
	}
	room.on("error", (err) => console.error("room error:", err));
	room.on("empty", () => {
		log.end();
		rooms.delete(room.id);
	});
	room.log = log;
	rooms.set(room.id, room);
	return room;
}


function sendJson(res, status, data) {
	res.writeHead(status, { "Content-Type": "application/json" });
	res.end(JSON.stringify(data));
}

function sendFile(res, file) {
	const stream = createReadStream(file);
	stream.once("open", () => {
		res.writeHead(200, { "Content-Type": MIME[extname(file)] ?? "application/octet-stream" });
		pipeline(stream, res, () => {}); 
	});
	stream.once("error", () => {
		if (!res.headersSent) sendJson(res, 404, { error: "not found" });
	});
}

async function readJson(req) {
	const chunks = [];
	let size = 0;
	for await (const chunk of req) {
		size += chunk.length;
		if (size > MAX_MESSAGE) throw new Error("body too large");
		chunks.push(chunk);
	}
	return JSON.parse(Buffer.concat(chunks).toString());
}

async function handle(req, res) {
	let decoded;
	try {
		decoded = decodeURIComponent(req.url);
	} catch {
		return sendJson(res, 400, { error: "bad url" });
	}
	if (decoded.includes("..")) return sendJson(res, 400, { error: "bad path" });

	const { pathname } = new URL(req.url, "http://localhost");

	if (req.method === "GET" && pathname === "/health") {
		return sendJson(res, 200, { status: "ok", rss: process.memoryUsage().rss });
	}

	if (pathname === "/api/rooms") {
		if (req.method === "GET") {
			return sendJson(
				res,
				200,
				PRESETS.map((p) => ({ ...p, players: rooms.get(p.id)?.members.size ?? 0 })),
			);
		}
		if (req.method === "POST") {
			const body = await readJson(req);
			const preset = PRESETS.find((p) => p.id === body.id);
			if (!preset) return sendJson(res, 404, { error: "unknown room" });
			const room = rooms.get(preset.id) ?? createRoom(preset);
			return sendJson(res, 201, { id: room.id, name: room.name });
		}
	}

	const replay = pathname.match(/^\/api\/rooms\/([\w-]+)\/log$/);
	if (req.method === "GET" && replay) {
		return sendFile(res, join(config.logDir, `${replay[1]}.ndjson`));
	}

	if (req.method === "GET") {
		return sendFile(res, join(config.clientDir, pathname === "/" ? "index.html" : pathname));
	}
	sendJson(res, 404, { error: "not found" });
}

const server = createServer((req, res) => {
	handle(req, res).catch(() => {
		if (!res.headersSent) sendJson(res, 400, { error: "bad request" });
	});
});


const isStr = (v, max) => typeof v === "string" && v.length > 0 && v.length <= max;
const SCHEMAS = {
	join: (m) => isStr(m.room, 32) && isStr(m.name, 20),
	chat: (m) => isStr(m.text, 200),
	leave: () => true,
};

function parse(text) {
	let msg;
	try {
		msg = JSON.parse(text);
	} catch {
		return { code: 4002, reason: "bad json" };
	}
	if (typeof msg !== "object" || msg === null || typeof msg.type !== "string") {
		return { code: 4002, reason: "bad shape" };
	}
	const check = SCHEMAS[msg.type];
	if (!check) return { code: 4001, reason: "unknown type" };
	if (!check(msg)) return { code: 4002, reason: "bad shape" };
	return { msg };
}

const wss = new WebSocketServer({ server, path: "/ws", maxPayload: MAX_MESSAGE });

wss.on("connection", (ws) => {
	let room = null;
	let windowStart = Date.now();
	let count = 0;
	ws.missedPongs = 0;

	const joinTimer = setTimeout(() => ws.close(4008, "join timeout"), JOIN_TIMEOUT);

	ws.on("error", (err) => console.error("ws error:", err.message));
	ws.on("pong", () => {
		ws.missedPongs = 0;
	});

	ws.on("message", (data, isBinary) => {
		const now = Date.now();
		if (now - windowStart >= 1000) {
			windowStart = now;
			count = 0;
		}
		if (++count > MAX_PER_SECOND) return ws.close(4029, "rate limit");

		const { msg, code, reason } = isBinary
			? { code: 4002, reason: "binary not allowed" }
			: parse(data.toString());
		if (!msg) return ws.close(code, reason);

		if (msg.type === "join") {
			if (room) return ws.close(4002, "already joined");
			const target = rooms.get(msg.room);
			if (!target) return ws.close(4004, "no such room");
			if (target.members.size >= target.max) return ws.close(4009, "room full");
			clearTimeout(joinTimer);
			room = target;
			room.join(ws, msg.name);
			return;
		}
		if (!room) return ws.close(4003, "join first");
		if (msg.type === "chat") room.chat(ws, msg.text);
		else if (msg.type === "leave") ws.close(1000, "bye");
	});

	ws.on("close", () => {
		clearTimeout(joinTimer);
		room?.leave(ws);
	});
});

const heartbeat = setInterval(() => {
	for (const ws of wss.clients) {
		if (ws.missedPongs >= 2) {
			ws.terminate();
		} else {
			ws.missedPongs++;
			ws.ping();
		}
	}
}, PING_INTERVAL);


let shuttingDown = false;
async function shutdown() {
	if (shuttingDown) return;
	shuttingDown = true;
	clearInterval(heartbeat);

	const logs = [...rooms.values()].map((r) => r.log);
	await Promise.all(
		[...wss.clients].map(
			(ws) =>
				new Promise((resolve) => {
					ws.once("close", resolve);
					ws.close(1001, "server shutting down");
					setTimeout(() => ws.terminate(), 2000).unref();
				}),
		),
	);
	for (const log of logs) log.end();
	await Promise.allSettled(logs.map((l) => l.done)); 

	server.close();
	process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

server.listen(config.port, () => console.log(`Server on http://localhost:${config.port}`));