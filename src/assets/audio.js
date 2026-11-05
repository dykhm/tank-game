import { bus } from "../utils/bus";

let ctx = null;

export function unlockAudio() {
	ctx ??= new AudioContext();
	ctx.resume();
}

function play(buffer) {
	if (!ctx) return;
	const source = ctx.createBufferSource();
	source.buffer = buffer;
	source.connect(ctx.destination);
	source.start();
}

export function connectAudio(sounds) {
	bus.addEventListener("fired", () => play(sounds.fire));
	bus.addEventListener("hit", () => play(sounds.hit));
	bus.addEventListener("exploded", () => play(sounds.explode));
}
