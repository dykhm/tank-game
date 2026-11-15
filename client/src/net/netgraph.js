const $ = (selector) => document.querySelector(selector);

export function startNetgraph(game, socket, settings) {
	const text = $("#netgraph-text");
	const canvas = $("#netgraph-canvas");
	const ctx = canvas.getContext("2d");
	$("#netgraph").hidden = false;

	let lastIn = 0;
	let lastOut = 0;
	let lastTime = performance.now();

	setInterval(() => {
		const now = performance.now();
		const seconds = (now - lastTime) / 1000;
		const inKB = (socket.bytesIn - lastIn) / seconds / 1024;
		const outKB = (socket.bytesOut - lastOut) / seconds / 1024;
		lastIn = socket.bytesIn;
		lastOut = socket.bytesOut;
		lastTime = now;

		text.textContent = [
			`RTT: ${game.rtt.toFixed(0)} ms`,
			`snapshot age: ${game.snapshotAge.toFixed(0)} ms`,
			`in: ${inKB.toFixed(1)} KB/s   out: ${outKB.toFixed(1)} KB/s`,
			`input queue: ${game.pendingInputs}`,
			`correction: ${game.predictor.error.toFixed(2)} px (max ${game.correctionMax.toFixed(2)})`,
			settings,
		].join("\n");
		game.correctionMax = 0;
		draw();
	}, 250);

	function draw() {
		const { width, height } = canvas;
		ctx.clearRect(0, 0, width, height);
		const bar = width / 90;
		ctx.fillStyle = "rgb(116, 24, 24)";
		game.correctionHistory.forEach((value, i) => {
			const h = Math.min(1, value / 8) * height;
			ctx.fillRect(i * bar, height - h, Math.max(1, bar - 1), h);
		});
	}
}