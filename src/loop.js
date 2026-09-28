export function createLoop(update, render) {
	const FIXED_DT = 1 / 60;

	let previousTime = performance.now();
	let accumulator = 0;

	let steps = 0;
	let frames = 0;
	let statsTime = 0;

	function loop(currentTime) {
		const frameTime = currentTime - previousTime;
		previousTime = currentTime;

		accumulator += frameTime / 1000;
		while (accumulator >= FIXED_DT) {
			update(FIXED_DT);

			accumulator -= FIXED_DT;
			steps++;
		}

		const alpha = accumulator / FIXED_DT;

		render(alpha);

		frames++;

		if (currentTime - statsTime >= 1000) {
			document.querySelector("#steps").textContent = steps;
			document.querySelector("#frames").textContent = frames;
			document.querySelector("#frame-time").textContent = frameTime.toFixed(1);

			steps = 0;
			frames = 0;
			statsTime = currentTime;
		}
		requestAnimationFrame(loop);
	}
	requestAnimationFrame(loop);
}

