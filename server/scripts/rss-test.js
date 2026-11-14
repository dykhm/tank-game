import { createWriteStream, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { get } from "node:http";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const BASE = "http://localhost:3000";
const FILE = "logs/big.ndjson";
const SECONDS = 30;

if (!existsSync(FILE)) {
	mkdirSync("logs", { recursive: true });
	async function* lines() {
		for (let i = 0; i < 1_000_000; i++) {
			yield `${JSON.stringify({ time: i, type: "chat", name: "bot", text: "x".repeat(60) })}\n`;
		}
	}
	await pipeline(Readable.from(lines()), createWriteStream(FILE));
}

const samples = [];
const started = Date.now();
const timer = setInterval(async () => {
	const { rss } = await (await fetch(`${BASE}/health`)).json();
	samples.push([(Date.now() - started) / 1000, rss / 1024 / 1024]);
}, 500);

get(`${BASE}/api/rooms/big/log`, (res) => {
	res.on("data", () => {
		res.pause();
		setTimeout(() => res.resume(), 100);
	});
	setTimeout(() => {
		clearInterval(timer);
		res.destroy();
		saveSvg();
		process.exit(0);
	}, SECONDS * 1000);
});

function saveSvg() {
	const W = 600;
	const H = 300;
	const max = Math.max(...samples.map((s) => s[1])) * 2; 
	const points = samples
		.map(([t, mb]) => `${(t / SECONDS) * (W - 60) + 50},${H - 30 - (mb / max) * (H - 50)}`)
		.join(" ");
	mkdirSync("docs", { recursive: true });
	writeFileSync(
		"docs/rss.svg",
		`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="sans-serif" font-size="12">
<rect width="100%" height="100%" fill="white"/>
<polyline points="${points}" fill="none" stroke="blue" stroke-width="2"/>
<line x1="50" y1="${H - 30}" x2="${W - 10}" y2="${H - 30}" stroke="black"/>
<line x1="50" y1="10" x2="50" y2="${H - 30}" stroke="black"/>
<text x="55" y="22">rss, MB (0 - ${max.toFixed(0)})</text>
<text x="${W - 110}" y="${H - 10}">time, s (0 - ${SECONDS})</text>
</svg>`,
	);
	const mb = samples.map((s) => s[1]);
	console.log(`saved docs/rss.svg, rss min/max MB: ${Math.min(...mb).toFixed(1)} / ${Math.max(...mb).toFixed(1)}`);
}